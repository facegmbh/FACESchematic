/**
 * FACE: the layout commands Claude gets through the bridge (SPEC-schaltplan-layout.md).
 * Run against the real store, like mcpEditing.test.ts.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import kapelle from "./fixtures/layout/kapelle-2026-11-21.json";

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
let run: typeof import("../mcpBridge").runCommand;

beforeAll(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
  ({ useSchematicStore: store } = await import("../store"));
  ({ runCommand: run } = await import("../mcpBridge"));
});

beforeEach(() => {
  store.setState({
    nodes: structuredClone(kapelle.nodes) as never,
    edges: structuredClone(kapelle.edges) as never,
    routedEdges: {},
  });
});

describe("check_layout", () => {
  it("reports the Kapelle's problems and changes nothing", async () => {
    const before = JSON.stringify(store.getState().nodes);
    const r = await run("check_layout", {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = r.result as { clean: boolean; findings: { kind: string; ids: string[] }[]; summary: Record<string, number> };
    expect(result.clean).toBe(false);
    expect(result.summary.outside).toBeGreaterThanOrEqual(1);
    expect(result.summary.overlap).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(store.getState().nodes)).toBe(before);
  });

  it("roomId must be a room", async () => {
    const r = await run("check_layout", { roomId: "device-27" });
    expect(r.ok).toBe(false);
  });

  it("an empty schematic is clean", async () => {
    store.setState({ nodes: [], edges: [], routedEdges: {} });
    const r = await run("check_layout", {});
    expect(r).toMatchObject({ ok: true, result: { clean: true, findings: [] } });
  });
});
