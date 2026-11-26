/**
 * The scale of an architect's PDF.
 *
 * Reported 25.11.2026: "Wenn ich den Plan-Maßstab ändere, sollte sich der Plan doch auch mit
 * füllen." A PDF lies on the sheet at the size it was plotted at — the sheet took its format
 * from it. Setting the scale there says what the plan is drawn at; it must not shrink the
 * drawing to half the sheet. And the scale usually stands on the plan as text, so the import
 * reads it.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { measureRealDistanceMm, underlayAtPlottedSize } from "../floorplan";
import { detectScalesInText } from "../pdfWalls";
import type { FloorplanPage, FloorplanUnderlay } from "../types";

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

// An A1 landscape sheet (841 × 594 mm) rasterized at 150 dpi.
const A1_PDF: FloorplanUnderlay = {
  src: "data:image/png;base64,AAAA",
  kind: "pdf",
  dpi: 150,
  naturalWidthPx: Math.round((841 / 25.4) * 150),
  naturalHeightPx: Math.round((594 / 25.4) * 150),
  positionMm: { x: 0, y: 0 },
  sizeMm: { w: 841, h: 594 },
};
const SHEET = { w: 841, h: 594 };

describe("is the plan lying at the size it was plotted at?", () => {
  it("yes for a PDF at its own page size", () => {
    expect(underlayAtPlottedSize(A1_PDF, SHEET)).toBe(true);
  });

  it("yes wherever it was moved to — size is what counts", () => {
    const moved: FloorplanUnderlay = { ...A1_PDF, positionMm: { x: 40, y: -12 } };
    expect(underlayAtPlottedSize(moved, SHEET)).toBe(true);
  });

  it("yes for a PDF from an older project that kept no dpi but covers the sheet", () => {
    expect(underlayAtPlottedSize({ ...A1_PDF, dpi: undefined }, SHEET)).toBe(true);
  });

  it("no once it was resized — by hand or by a calibration", () => {
    expect(underlayAtPlottedSize({ ...A1_PDF, sizeMm: { w: 420, h: 297 } }, SHEET)).toBe(false);
  });

  it("no for a photo or a scan: an image has no plotted size", () => {
    expect(underlayAtPlottedSize({ ...A1_PDF, kind: "image" }, SHEET)).toBe(false);
  });

  it("no for a DXF, which goes on at its real size instead", () => {
    expect(underlayAtPlottedSize({ ...A1_PDF, kind: "dxf" }, SHEET)).toBe(false);
  });
});

describe("changing the scale of a page", () => {
  let pageId = "";

  beforeEach(() => {
    useSchematicStore.setState({ nodes: [], edges: [], pages: [] });
    pageId = st().addFloorplanPage("EG");
  });

  it("leaves a PDF at its plotted size where it is: the scale is a statement about the plan", () => {
    st().setFloorplanUnderlay(pageId, A1_PDF);
    expect(plan().scaleDenominator).toBe(50);
    st().setFloorplanScale(pageId, 100);
    expect(plan().scaleDenominator).toBe(100);
    expect(plan().underlay?.positionMm).toEqual({ x: 0, y: 0 });
    expect(plan().underlay?.sizeMm).toEqual({ w: 841, h: 594 });
    // What is measured on it follows: 100 mm on paper are now 10 m.
    expect(measureRealDistanceMm({ x: 0, y: 0 }, { x: 100, y: 0 }, plan().scaleDenominator)).toBe(10_000);
    expect(plan().underlay?.mmPerPx).toBeCloseTo((841 * 100) / A1_PDF.naturalWidthPx, 6);
  });

  it("keeps the symbols on their spot of the drawing", () => {
    st().setFloorplanUnderlay(pageId, A1_PDF);
    const groupId = st().addFloorplanGroup(pageId, { label: "Kameras", color: "#e11d1d", shape: "camera" });
    st().addFloorplanSymbol(pageId, { groupId, positionMm: { x: 300, y: 200 }, label: "K1" });
    st().setFloorplanScale(pageId, 100);
    expect(plan().symbols[0].positionMm).toEqual({ x: 300, y: 200 });
  });

  it("is one undo step", () => {
    st().setFloorplanUnderlay(pageId, A1_PDF);
    st().setFloorplanScale(pageId, 100);
    st().undo();
    expect(plan().scaleDenominator).toBe(50);
    expect(plan().underlay?.sizeMm).toEqual({ w: 841, h: 594 });
  });

  it("still keeps the building's real size for a plan that was calibrated by resizing it", () => {
    st().setFloorplanUnderlay(pageId, { ...A1_PDF, sizeMm: { w: 420, h: 296.6 } });
    st().setFloorplanScale(pageId, 100);
    expect(plan().underlay?.sizeMm.w).toBeCloseTo(210);
  });

  it("still keeps the building's real size for an image", () => {
    st().setFloorplanUnderlay(pageId, { ...A1_PDF, kind: "image", dpi: undefined, sizeMm: { w: 400, h: 282 }, positionMm: { x: 20, y: 20 } });
    st().setFloorplanScale(pageId, 100);
    expect(plan().underlay?.sizeMm.w).toBeCloseTo(200);
  });
});

describe("the scales a plan states in its text", () => {
  it("finds the one scale of a sheet", () => {
    expect(detectScalesInText("Grundriss EG  M 1:100  Blatt 3")).toEqual([100]);
    expect(detectScalesInText("Maßstab 1 : 50")).toEqual([50]);
  });

  it("names every scale once when the sheet carries details at another one", () => {
    expect(detectScalesInText("Grundriss 1:100 · Detail A 1:20 · Schnitt 1:100")).toEqual([100, 20]);
  });

  it("finds nothing in room numbers, times and ratios", () => {
    expect(detectScalesInText("Raum 1:2 Bad · 11:50 Uhr · Gefälle 1:12")).toEqual([]);
    expect(detectScalesInText("")).toEqual([]);
  });
});
