/**
 * Calibrating a locked underlay.
 *
 * Reported 23.11.2026: "Wenn ich kalibriere, wird der Planhintergrund aus der PDF skaliert,
 * obwohl er gesperrt ist." A lock means the drawing stays where it is on the sheet. So for
 * a locked underlay the measurement is resolved the other way round: the drawing keeps its
 * place and size, and the page's scale gives way. For an architect's PDF that fills the
 * sheet that is also simply right — a plan plotted at 1:100 on a page set to 1:50 should end
 * up at 1:100, not blown up to twice the sheet.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { calibratedScale } from "../floorplan";
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

describe("the scale a measurement gives", () => {
  // 100 mm on paper that are 10 m on site: 1:100.
  const A = { x: 50, y: 50 };
  const B = { x: 150, y: 50 };

  it("reads the scale straight from the measurement", () => {
    expect(calibratedScale(A, B, 10_000)).toBe(100);
    expect(calibratedScale(A, B, 5_000)).toBe(50);
  });

  it("lands on the standard scale a plot was made at, despite a click a little off", () => {
    // Two clicks on a plotted line are never exact: 10.04 m over 100 mm is still 1:100.
    expect(calibratedScale(A, B, 10_040)).toBe(100);
    expect(calibratedScale(A, B, 9_970)).toBe(100);
  });

  it("keeps an odd scale honest — a scanned plan is at no standard scale", () => {
    expect(calibratedScale(A, B, 8_740)).toBe(87);
    // Below 1:20 the fraction still matters.
    expect(calibratedScale(A, B, 1_240)).toBe(12.4);
  });

  it("refuses what cannot be a measurement", () => {
    expect(calibratedScale(A, A, 10_000)).toBeNull();
    expect(calibratedScale(A, B, 0)).toBeNull();
  });
});

describe("calibrating in the store", () => {
  let pageId = "";

  beforeEach(() => {
    useSchematicStore.setState({ nodes: [], edges: [], pages: [] });
    pageId = st().addFloorplanPage("EG");
    st().setFloorplanUnderlay(pageId, {
      src: "data:image/png;base64,AAAA",
      kind: "pdf",
      naturalWidthPx: 1000,
      naturalHeightPx: 700,
      positionMm: { x: 10, y: 10 },
      sizeMm: { w: 800, h: 560 },
    });
    // The page starts at 1:50; the plan was really plotted at 1:100.
  });

  it("leaves a locked plan where it is and corrects the page's scale instead", () => {
    st().updateFloorplanUnderlay(pageId, { locked: true });
    expect(plan().scaleDenominator).toBe(50);
    const ok = st().calibrateFloorplan(pageId, { x: 100, y: 100 }, { x: 200, y: 100 }, 10_000);
    expect(ok).toBe(true);
    expect(plan().underlay?.positionMm).toEqual({ x: 10, y: 10 });
    expect(plan().underlay?.sizeMm).toEqual({ w: 800, h: 560 });
    expect(plan().scaleDenominator).toBe(100);
    // mm per pixel follows the new scale: 800 paper mm × 100 over 1000 px = 80 mm per px.
    expect(plan().underlay?.mmPerPx).toBeCloseTo(80, 6);
  });

  it("keeps the symbols on their spot of the drawing", () => {
    st().updateFloorplanUnderlay(pageId, { locked: true });
    const groupId = st().addFloorplanGroup(pageId, { label: "Kameras", color: "#e11d1d", shape: "camera" });
    st().addFloorplanSymbol(pageId, { groupId, positionMm: { x: 300, y: 200 }, label: "K1" });
    st().calibrateFloorplan(pageId, { x: 100, y: 100 }, { x: 200, y: 100 }, 10_000);
    expect(plan().symbols[0].positionMm).toEqual({ x: 300, y: 200 });
  });

  it("still fits an unlocked plan to the page's scale, as before", () => {
    st().calibrateFloorplan(pageId, { x: 100, y: 100 }, { x: 200, y: 100 }, 10_000);
    expect(plan().scaleDenominator).toBe(50);
    // At 1:50 the 10 m need 200 mm of paper instead of 100: the plan doubles.
    expect(plan().underlay?.sizeMm.w).toBeCloseTo(1600, 6);
  });

  it("undoes the scale change in one step", () => {
    st().updateFloorplanUnderlay(pageId, { locked: true });
    st().calibrateFloorplan(pageId, { x: 100, y: 100 }, { x: 200, y: 100 }, 10_000);
    st().undo();
    expect(plan().scaleDenominator).toBe(50);
  });
});
