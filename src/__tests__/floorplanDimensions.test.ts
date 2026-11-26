/**
 * Dimension lines on the plan.
 *
 * Asked for 25.11.2026: "Ich möchte auch Maße einzeichnen können, nach dem Messen mit einem
 * Button." A measurement can be kept: a line between the two points with the distance
 * written on it. The figure is worked out from the page's scale every time it is drawn, so
 * it is never a stale number.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { dimensionLayout } from "../floorplan";
import type { FloorplanPage } from "../types";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}

let useSchematicStore: typeof import("../store")["useSchematicStore"];

beforeAll(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
  ({ useSchematicStore } = await import("../store"));
});

const st = () => useSchematicStore.getState();
const plan = (): FloorplanPage => st().pages.find((p): p is FloorplanPage => p.type === "floorplan")!;

describe("how a dimension line is drawn", () => {
  it("writes the real distance at the page's scale", () => {
    const dim = { fromMm: { x: 100, y: 100 }, toMm: { x: 200, y: 100 } };
    expect(dimensionLayout(dim, 100)!.text).toBe(dimensionLayout({ fromMm: { x: 0, y: 0 }, toMm: { x: 200, y: 0 } }, 50)!.text);
    expect(dimensionLayout(dim, 100)!.text).toMatch(/^10[.,]00 m$/);
    expect(dimensionLayout(dim, 50)!.text).toMatch(/^5[.,]00 m$/);
  });

  it("puts the figure over the middle of the line, on the upper side", () => {
    const l = dimensionLayout({ fromMm: { x: 100, y: 100 }, toMm: { x: 200, y: 100 } }, 100)!;
    expect(l.labelAtMm.x).toBeCloseTo(150);
    expect(l.labelAtMm.y).toBeLessThan(100);
    expect(l.labelAngleDeg).toBeCloseTo(0);
  });

  it("never writes upside down: a line drawn right-to-left reads like one drawn left-to-right", () => {
    const ltr = dimensionLayout({ fromMm: { x: 100, y: 100 }, toMm: { x: 200, y: 150 } }, 100)!;
    const rtl = dimensionLayout({ fromMm: { x: 200, y: 150 }, toMm: { x: 100, y: 100 } }, 100)!;
    expect(rtl.labelAngleDeg).toBeCloseTo(ltr.labelAngleDeg);
    expect(rtl.labelAtMm.x).toBeCloseTo(ltr.labelAtMm.x);
    expect(rtl.labelAtMm.y).toBeCloseTo(ltr.labelAtMm.y);
    expect(Math.abs(ltr.labelAngleDeg)).toBeLessThanOrEqual(90);
  });

  it("reads a vertical line from the bottom up, as on a drawing", () => {
    const l = dimensionLayout({ fromMm: { x: 100, y: 100 }, toMm: { x: 100, y: 200 } }, 100)!;
    expect(l.labelAngleDeg).toBeCloseTo(-90);
    // The figure stands to the left of the line.
    expect(l.labelAtMm.x).toBeLessThan(100);
    expect(l.labelAtMm.y).toBeCloseTo(150);
  });

  it("ends in a tick across the line at both points", () => {
    const l = dimensionLayout({ fromMm: { x: 100, y: 100 }, toMm: { x: 200, y: 100 } }, 100)!;
    expect(l.ticksMm).toHaveLength(2);
    const [a, b] = l.ticksMm[0];
    expect(a.x).toBeCloseTo(100);
    expect(b.x).toBeCloseTo(100);
    expect(Math.abs(a.y - b.y)).toBeGreaterThan(1);
    expect((a.y + b.y) / 2).toBeCloseTo(100);
  });

  it("draws nothing for two clicks on the same spot", () => {
    expect(dimensionLayout({ fromMm: { x: 5, y: 5 }, toMm: { x: 5, y: 5 } }, 100)).toBeNull();
  });
});

describe("dimension lines in the store", () => {
  let pageId = "";

  beforeEach(() => {
    useSchematicStore.setState({ nodes: [], edges: [], pages: [] });
    pageId = st().addFloorplanPage("EG");
  });

  it("keeps a measurement as a dimension line", () => {
    const id = st().addFloorplanDimension(pageId, { fromMm: { x: 10, y: 20 }, toMm: { x: 110, y: 20 } });
    expect(plan().dimensions).toEqual([{ id, fromMm: { x: 10, y: 20 }, toMm: { x: 110, y: 20 } }]);
  });

  it("refuses two clicks on the same spot", () => {
    expect(st().addFloorplanDimension(pageId, { fromMm: { x: 10, y: 20 }, toMm: { x: 10, y: 20 } })).toBeNull();
    expect(plan().dimensions ?? []).toEqual([]);
  });

  it("removes one, and undo brings it back", () => {
    const a = st().addFloorplanDimension(pageId, { fromMm: { x: 0, y: 0 }, toMm: { x: 50, y: 0 } })!;
    const b = st().addFloorplanDimension(pageId, { fromMm: { x: 0, y: 10 }, toMm: { x: 50, y: 10 } })!;
    st().removeFloorplanDimension(pageId, a);
    expect(plan().dimensions!.map((d) => d.id)).toEqual([b]);
    st().undo();
    expect(plan().dimensions!.map((d) => d.id)).toEqual([a, b]);
  });

  it("stays where it is when the scale changes — the figure follows by itself", () => {
    const id = st().addFloorplanDimension(pageId, { fromMm: { x: 10, y: 20 }, toMm: { x: 110, y: 20 } })!;
    st().setFloorplanScale(pageId, 100);
    const dim = plan().dimensions!.find((d) => d.id === id)!;
    expect(dim.toMm).toEqual({ x: 110, y: 20 });
    expect(dimensionLayout(dim, plan().scaleDenominator)!.text).toMatch(/^10[.,]00 m$/);
  });

  it("comes along when the page is duplicated, under its own id", () => {
    const id = st().addFloorplanDimension(pageId, { fromMm: { x: 10, y: 20 }, toMm: { x: 110, y: 20 } })!;
    st().duplicateFloorplanPage(pageId);
    const copy = st().pages.filter((p): p is FloorplanPage => p.type === "floorplan")[1];
    expect(copy.dimensions).toHaveLength(1);
    expect(copy.dimensions![0].id).not.toBe(id);
    expect(copy.dimensions![0].toMm).toEqual({ x: 110, y: 20 });
  });
});
