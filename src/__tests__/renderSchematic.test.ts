/**
 * FACE: render_schematic (SPEC-schaltplan-layout.md, Task 26) — Claude sees the drawing as a PNG.
 * The capture itself needs a browser (checked with Playwright); here: what gets captured, at what
 * scale, and what the command does around it (size budget, base64, page switch and back).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { renderBounds, renderPixelRatio, RENDER_PADDING } from "../renderSchematic";
import type { SchematicNode } from "../types";

const capture = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../renderSchematic", async (orig) => ({
  ...(await orig<typeof import("../renderSchematic")>()),
  captureSchematicPng: capture.fn,
}));

function room(id: string, x: number, y: number, w: number, h: number, parentId?: string) {
  return { id, type: "room", position: { x, y }, parentId, data: { label: id }, style: { width: w, height: h } } as unknown as SchematicNode;
}
function device(id: string, x: number, y: number, parentId?: string) {
  return {
    id, type: "device", position: { x, y }, parentId, measured: { width: 160, height: 96 },
    data: { label: id, deviceType: "test", ports: [] },
  } as unknown as SchematicNode;
}

describe("renderBounds", () => {
  it("the whole drawing: every node, plus a margin", () => {
    const b = renderBounds([device("a", 0, 0), device("b", 400, 200)]);
    expect(b).toEqual({ x: -RENDER_PADDING, y: -RENDER_PADDING, width: 560 + 2 * RENDER_PADDING, height: 296 + 2 * RENDER_PADDING });
  });

  it("one room: just that room (nested rooms resolved to the canvas), plus a margin", () => {
    const nodes = [room("ort", 1000, 500, 800, 600), room("rack", 32, 48, 208, 400, "ort"), device("far", 0, 0)];
    expect(renderBounds(nodes, "rack")).toEqual({
      x: 1032 - RENDER_PADDING, y: 548 - RENDER_PADDING, width: 208 + 2 * RENDER_PADDING, height: 400 + 2 * RENDER_PADDING,
    });
  });

  it("the whole drawing includes lines that run outside the devices; a room crop does not", () => {
    const nodes = [room("ort", 0, 0, 400, 300), device("a", 32, 48, "ort")];
    const routes = { e1: { waypoints: [{ x: 192, y: 96 }, { x: 900, y: 96 }, { x: 900, y: 700 }] } };
    const whole = renderBounds(nodes, undefined, routes);
    expect(whole.x + whole.width).toBe(900 + RENDER_PADDING);
    expect(whole.y + whole.height).toBe(700 + RENDER_PADDING);
    expect(renderBounds(nodes, "ort", routes).width).toBe(400 + 2 * RENDER_PADDING);
  });

  it("hidden nodes do not stretch the picture", () => {
    const hidden = { ...device("h", 5000, 5000), hidden: true } as SchematicNode;
    expect(renderBounds([device("a", 0, 0), hidden]).width).toBe(160 + 2 * RENDER_PADDING);
  });
});

describe("renderPixelRatio", () => {
  it("small drawings are sharp (2×), never more", () => {
    expect(renderPixelRatio({ width: 400, height: 300 }, 1600)).toBe(2);
  });
  it("large drawings shrink so the longest side fits", () => {
    expect(renderPixelRatio({ width: 4000, height: 1000 }, 1600)).toBeCloseTo(0.4);
    expect(renderPixelRatio({ width: 1000, height: 3200 }, 1600)).toBeCloseTo(0.5);
  });
});

describe("render_schematic command", () => {
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
  const png = (bytes: number) => new Blob([new Uint8Array(bytes).fill(7)], { type: "image/png" });

  beforeAll(async () => {
    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
    ({ useSchematicStore: store } = await import("../store"));
    ({ runCommand: run } = await import("../mcpBridge"));
  });

  beforeEach(() => {
    capture.fn.mockReset();
    store.setState({ nodes: [room("ort", 0, 0, 800, 600), device("a", 32, 48, "ort")] as never, edges: [], activePage: "schematic" });
  });

  it("returns the PNG as base64 with its size", async () => {
    capture.fn.mockResolvedValue(png(3));
    const r = await run("render_schematic", {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = r.result as { image: { mimeType: string; data: string }; width: number; height: number; bytes: number };
    expect(result.image).toEqual({ mimeType: "image/png", data: "BwcH" });
    expect(result.bytes).toBe(3);
    // 880 px wide at 2× would be 1760 — the longest side is held to the default 1600.
    expect(result.width).toBe(1600);
    expect(result.height).toBe(Math.round((600 + 2 * RENDER_PADDING) * (1600 / 880)));
  });

  it("a picture over the budget is taken again, smaller", async () => {
    capture.fn.mockResolvedValueOnce(png(4_000_000)).mockResolvedValueOnce(png(500_000));
    const r = await run("render_schematic", {});
    expect(r.ok).toBe(true);
    expect(capture.fn).toHaveBeenCalledTimes(2);
    const [, firstRatio] = capture.fn.mock.calls[0];
    const [, secondRatio] = capture.fn.mock.calls[1];
    expect(secondRatio).toBeLessThan(firstRatio);
    expect((r as { result: { bytes: number } }).result.bytes).toBe(500_000);
  });

  it("roomId captures only that room", async () => {
    capture.fn.mockResolvedValue(png(3));
    await run("render_schematic", { roomId: "ort" });
    expect(capture.fn.mock.calls[0][0]).toEqual(renderBounds(store.getState().nodes, "ort"));
    expect((await run("render_schematic", { roomId: "a" })).ok).toBe(false);
  });

  it("from another page it shows the schematic for the picture and goes back", async () => {
    store.setState({ activePage: "rack-page-1" });
    let pageDuringCapture = "";
    capture.fn.mockImplementation(async () => {
      pageDuringCapture = store.getState().activePage;
      return png(3);
    });
    await run("render_schematic", {});
    expect(pageDuringCapture).toBe("schematic");
    expect(store.getState().activePage).toBe("rack-page-1");
  });

  it("goes back to the page even when the capture fails, and says why", async () => {
    store.setState({ activePage: "rack-page-1" });
    capture.fn.mockRejectedValue(new Error("canvas too large"));
    const r = await run("render_schematic", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("canvas too large");
    expect(store.getState().activePage).toBe("rack-page-1");
  });

  it("an empty drawing has nothing to show", async () => {
    store.setState({ nodes: [], edges: [] });
    expect((await run("render_schematic", {})).ok).toBe(false);
    expect(capture.fn).not.toHaveBeenCalled();
  });

  it("maxSize is checked", async () => {
    capture.fn.mockResolvedValue(png(3));
    expect((await run("render_schematic", { maxSize: 50 })).ok).toBe(false);
    expect((await run("render_schematic", { maxSize: "big" })).ok).toBe(false);
    expect((await run("render_schematic", { maxSize: 800 })).ok).toBe(true);
  });
});
