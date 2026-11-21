/**
 * The Odoo-connector way into the editor (SPEC-cloud-bridge.md): the tab says hello to the
 * FACE backend, keeps a long poll open, runs each command through the same handlers as the
 * local WebSocket bridge, and posts the answer back. The backend is played by a fetch mock.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

let store: typeof import("../store").useSchematicStore;
let bridge: typeof import("../mcpBridge");
let PROTOCOL_VERSION: number;

const fetchMock = vi.fn();
type Reply = () => Promise<Response>;
let helloReplies: Reply[];
let pollReplies: Reply[];

function reply(status: number, body?: unknown): Reply {
  return () =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    );
}

/** A poll that waits until the tab gives up on it (stop()). */
function hanging(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
}

const callsTo = (p: string) => fetchMock.mock.calls.filter(([url]) => String(url).startsWith(p));
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
const status = () => ({ status: store.getState().mcpBridgeStatus, detail: store.getState().mcpBridgeStatusDetail });

beforeAll(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = memoryStorage();
  vi.stubGlobal("fetch", fetchMock);
  ({ useSchematicStore: store } = await import("../store"));
  bridge = await import("../mcpBridge");
  ({ PROTOCOL_VERSION } = await import("../mcp/protocol"));
});

beforeEach(() => {
  fetchMock.mockReset();
  helloReplies = [];
  pollReplies = [];
  store.setState({ schematicName: "Pier 99" });
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith("/face/bridge/hello")) return (helloReplies.shift() ?? reply(204))();
    if (url.startsWith("/face/bridge/poll")) {
      const next = pollReplies.shift();
      return next ? next() : hanging(init);
    }
    if (url.startsWith("/face/bridge/respond")) return reply(204)();
    return reply(404)();
  });
});

afterEach(() => {
  bridge.relayBridge.stop();
});

describe("relay bridge (Odoo connector)", () => {
  it("says hello with the tab id, schematic name and protocol version, then shows connected", async () => {
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(status().status).toBe("connected"));
    const hello = bodyOf(callsTo("/face/bridge/hello")[0]);
    expect(hello).toMatchObject({ schematicName: "Pier 99", protocolVersion: PROTOCOL_VERSION });
    expect(hello.tabId).toMatch(/^[\w-]{1,64}$/);
    const init = callsTo("/face/bridge/hello")[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-FACE-Request"]).toBe("1");
  });

  it("runs a polled command through the existing handlers and posts the answer", async () => {
    store.setState({ nodes: [], edges: [] });
    pollReplies.push(reply(200, { type: "command", requestId: "r1", command: "list_devices", params: {} }));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(callsTo("/face/bridge/respond")).toHaveLength(1));
    const answer = bodyOf(callsTo("/face/bridge/respond")[0]);
    expect(answer).toMatchObject({ requestId: "r1", ok: true });
    expect(answer.result).toEqual(await bridge.handlers.list_devices({}));
    expect(answer.tabId).toBe(bodyOf(callsTo("/face/bridge/hello")[0]).tabId);
    // …and keeps polling for the next one.
    await vi.waitFor(() => expect(callsTo("/face/bridge/poll").length).toBeGreaterThanOrEqual(2));
  });

  it("answers an unknown command with ok:false and a message", async () => {
    pollReplies.push(reply(200, { type: "command", requestId: "r2", command: "rm_rf", params: {} }));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(callsTo("/face/bridge/respond")).toHaveLength(1));
    const answer = bodyOf(callsTo("/face/bridge/respond")[0]);
    expect(answer).toMatchObject({ requestId: "r2", ok: false });
    expect(answer.error).toMatch(/rm_rf/);
  });

  it("a failing handler becomes ok:false with the handler's message", async () => {
    pollReplies.push(reply(200, { type: "command", requestId: "r3", command: "get_device", params: { nodeId: "gibt-es-nicht" } }));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(callsTo("/face/bridge/respond")).toHaveLength(1));
    const answer = bodyOf(callsTo("/face/bridge/respond")[0]);
    expect(answer.ok).toBe(false);
    expect(answer.error).toBeTruthy();
  });

  it("an empty poll (204) simply polls again", async () => {
    pollReplies.push(reply(204), reply(204));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(callsTo("/face/bridge/poll").length).toBeGreaterThanOrEqual(3));
    expect(callsTo("/face/bridge/hello")).toHaveLength(1);
  });

  it("'unbound' (backend restarted) → says hello again and carries on", async () => {
    pollReplies.push(reply(409, { reason: "unbound" }));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(callsTo("/face/bridge/hello")).toHaveLength(2));
    await vi.waitFor(() => expect(callsTo("/face/bridge/poll").length).toBeGreaterThanOrEqual(2));
    expect(status().status).toBe("connected");
  });

  it("'superseded' → stops and says another tab took over", async () => {
    pollReplies.push(reply(200, { type: "superseded" }));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(status()).toEqual({ status: "error", detail: "Another tab took the AI connection." }));
    await new Promise((r) => setTimeout(r, 20));
    expect(callsTo("/face/bridge/poll")).toHaveLength(1);
  });

  it("signed out (401) → stops and asks to sign in", async () => {
    helloReplies.push(reply(401, { error: "Nicht angemeldet." }));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(status()).toEqual({ status: "error", detail: "Sign in with Odoo first (top right)." }));
    expect(callsTo("/face/bridge/poll")).toHaveLength(0);
  });

  it("an outdated app (protocol 409 on hello) stops with the backend's reason", async () => {
    helloReplies.push(reply(409, { reason: "protocol", error: "Bitte die Seite neu laden — die App passt nicht zum Server." }));
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(status().status).toBe("error"));
    expect(status().detail).toMatch(/neu laden/);
  });

  it("a network error retries after a pause instead of giving up", async () => {
    vi.useFakeTimers();
    try {
      helloReplies.push(() => Promise.reject(new TypeError("Failed to fetch")));
      bridge.relayBridge.start();
      await vi.waitFor(() => expect(status().status).toBe("connecting"));
      expect(callsTo("/face/bridge/hello")).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1100);
      expect(callsTo("/face/bridge/hello")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stop() ends the waiting poll and shows off", async () => {
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(callsTo("/face/bridge/poll")).toHaveLength(1));
    bridge.relayBridge.stop();
    expect(status().status).toBe("off");
    const init = callsTo("/face/bridge/poll")[0][1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(callsTo("/face/bridge/poll")).toHaveLength(1);
  });
});

describe("which way in runs (Preferences → AI)", () => {
  const base = { faceBackend: true, mode: "odoo" as const, enabled: true, token: "", signedIn: true };

  it("off when the switch is off, whatever else is set", () => {
    expect(bridge.bridgeTransport({ ...base, enabled: false })).toBe("off");
    expect(bridge.bridgeTransport({ ...base, mode: "local", token: "abc", enabled: false })).toBe("off");
  });

  it("FACE build, Odoo way: runs only while signed in", () => {
    expect(bridge.bridgeTransport(base)).toBe("relay");
    expect(bridge.bridgeTransport({ ...base, signedIn: false })).toBe("off");
  });

  it("local way: the WebSocket, and only with a pairing token", () => {
    expect(bridge.bridgeTransport({ ...base, mode: "local", token: "abc" })).toBe("websocket");
    expect(bridge.bridgeTransport({ ...base, mode: "local", token: "" })).toBe("off");
  });

  it("without the FACE backend there is only the local way", () => {
    expect(bridge.bridgeTransport({ ...base, faceBackend: false, token: "abc" })).toBe("websocket");
    expect(bridge.bridgeTransport({ ...base, faceBackend: false, token: "" })).toBe("off");
  });
});

describe("default way in", () => {
  it("FACE build: Odoo — unless a pairing token is already set (keep a working local setup)", async () => {
    const { defaultMcpMode } = await import("../store");
    expect(defaultMcpMode(true, "")).toBe("odoo");
    expect(defaultMcpMode(true, "abc")).toBe("local");
    expect(defaultMcpMode(false, "")).toBe("local");
  });

  it("the choice is remembered", () => {
    store.getState().setMcpBridgeMode("local");
    expect(localStorage.getItem("easyschematic-mcp-mode")).toBe("local");
    store.getState().setMcpBridgeMode("odoo");
    expect(store.getState().mcpBridgeMode).toBe("odoo");
    expect(localStorage.getItem("easyschematic-mcp-mode")).toBe("odoo");
  });
});

describe("leaving", () => {
  it("stop() after a hello says bye, so Claude hears 'no tab' at once instead of waiting", async () => {
    bridge.relayBridge.start();
    await vi.waitFor(() => expect(status().status).toBe("connected"));
    bridge.relayBridge.stop();
    const bye = callsTo("/face/bridge/bye");
    expect(bye).toHaveLength(1);
    expect(bodyOf(bye[0]).tabId).toBe(bodyOf(callsTo("/face/bridge/hello")[0]).tabId);
    expect((bye[0][1] as RequestInit).keepalive).toBe(true);
  });

  it("stop() without a hello sends nothing", () => {
    bridge.relayBridge.stop();
    expect(callsTo("/face/bridge/bye")).toHaveLength(0);
  });
});
