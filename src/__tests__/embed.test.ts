import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isEmbedded, listenForEmbeddedSchematic, READY, LOAD, LOADED, ERROR } from "../embed";

/** The default allowlist — src/embed.ts falls back to this without a build arg. */
const ALLOWED = "https://portal.face-gmbh.com";
const HOSTILE = "https://evil.example.com";

/**
 * The suite runs in the project's node environment (no jsdom dependency), so the
 * handful of window APIs embed.ts touches are stood up by hand.
 */
function fakeWindow(search = "") {
  const listeners: ((event: { origin: string; data: unknown }) => void)[] = [];
  const posted: { message: unknown; origin: string }[] = [];
  return {
    posted,
    listenerCount: () => listeners.length,
    emit: (origin: string, data: unknown) => listeners.forEach((l) => l({ origin, data })),
    win: {
      location: { search },
      parent: {
        postMessage: (message: unknown, origin: string) => posted.push({ message, origin }),
      },
      addEventListener: (type: string, fn: (e: { origin: string; data: unknown }) => void) => {
        if (type === "message") listeners.push(fn);
      },
      removeEventListener: (type: string, fn: (e: { origin: string; data: unknown }) => void) => {
        if (type !== "message") return;
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      },
    },
  };
}

describe("embedded viewer protocol", () => {
  let env: ReturnType<typeof fakeWindow>;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    env = fakeWindow();
    vi.stubGlobal("window", env.win);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.unstubAllGlobals();
  });

  it("announces itself to the allowed origin only", () => {
    cleanup = listenForEmbeddedSchematic(() => {});
    expect(env.posted).toEqual([{ message: { type: READY }, origin: ALLOWED }]);
  });

  it("imports a drawing sent from the allowed origin", () => {
    const seen: unknown[] = [];
    cleanup = listenForEmbeddedSchematic((data) => seen.push(data));
    const schematic = { version: 42, name: "Saal", nodes: [], edges: [] };
    env.emit(ALLOWED, { type: LOAD, schematic });
    expect(seen).toEqual([schematic]);
    expect(env.posted.at(-1)?.message).toEqual({ type: LOADED });
  });

  // The point of the origin check: a drawing carries customer installations.
  it("ignores a drawing from any other origin", () => {
    const seen: unknown[] = [];
    cleanup = listenForEmbeddedSchematic((data) => seen.push(data));
    env.posted.length = 0;
    env.emit(HOSTILE, { type: LOAD, schematic: { version: 42, nodes: [], edges: [] } });
    expect(seen).toEqual([]);
    expect(env.posted).toEqual([]);
  });

  it("ignores unrelated messages from the allowed origin", () => {
    const seen: unknown[] = [];
    cleanup = listenForEmbeddedSchematic((data) => seen.push(data));
    env.posted.length = 0;
    env.emit(ALLOWED, { type: "something-else", schematic: { nodes: [] } });
    env.emit(ALLOWED, "just a string");
    env.emit(ALLOWED, null);
    expect(seen).toEqual([]);
    expect(env.posted).toEqual([]);
  });

  it("reports a load without a usable payload instead of importing it", () => {
    let called = false;
    cleanup = listenForEmbeddedSchematic(() => {
      called = true;
    });
    env.emit(ALLOWED, { type: LOAD, schematic: "not an object" });
    expect(called).toBe(false);
    expect(env.posted.at(-1)?.message).toMatchObject({ type: ERROR });
  });

  it("reports an import failure back to the embedding page", () => {
    cleanup = listenForEmbeddedSchematic(() => {
      throw new Error("broken file");
    });
    env.emit(ALLOWED, { type: LOAD, schematic: { nodes: [] } });
    expect(env.posted.at(-1)?.message).toMatchObject({ type: ERROR, reason: "broken file" });
  });

  it("stops listening after cleanup", () => {
    const seen: unknown[] = [];
    listenForEmbeddedSchematic((data) => seen.push(data))();
    expect(env.listenerCount()).toBe(0);
    env.emit(ALLOWED, { type: LOAD, schematic: { nodes: [] } });
    expect(seen).toEqual([]);
  });

  it("detects embed mode from the query string", () => {
    vi.stubGlobal("window", fakeWindow("?embed=1").win);
    expect(isEmbedded()).toBe(true);
    vi.stubGlobal("window", fakeWindow("?embed=0").win);
    expect(isEmbedded()).toBe(false);
    vi.stubGlobal("window", fakeWindow("").win);
    expect(isEmbedded()).toBe(false);
  });
});
