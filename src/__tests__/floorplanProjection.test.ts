/**
 * A projection on the plan, through the store: it belongs to its projector symbol, the
 * distance slider moves that symbol, and a whole drag is one step to undo.
 */
import { it, expect, beforeAll, beforeEach } from "vitest";
import { defaultProjectionFor, projectionGeometry, symbolPositionForDistance, visibleProjections } from "../projection";
import type { FloorplanPage, ProjectionOptics } from "../types";

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
const plan = (id = pageId): FloorplanPage => st().pages.find((p): p is FloorplanPage => p.id === id)!;

const L610U: ProjectionOptics = {
  formats: [{ ratio: "16:10", wide: [2.95848, -3.5728], tele: [4.7743, -3.5078], sizeMin: 50, sizeMax: 500 }],
  lumens: 6000,
};

let pageId = "";
let groupId = "";

/** A projector at (100, 100) looking right, with its default picture. */
function projector(): { symbolId: string; projectionId: string } {
  const symbolId = st().addFloorplanSymbol(pageId, { groupId, positionMm: { x: 100, y: 100 }, label: "B1" });
  const symbol = plan().symbols.find((s) => s.id === symbolId)!;
  const projectionId = st().addFloorplanProjection(pageId, defaultProjectionFor(symbol, L610U, plan().scaleDenominator), 0);
  return { symbolId, projectionId };
}

beforeEach(() => {
  useSchematicStore.setState({ nodes: [], edges: [], pages: [] });
  pageId = st().addFloorplanPage("EG");
  groupId = st().addFloorplanGroup(pageId, { label: "Beamer", color: "#0e7490", shape: "projector" });
});

it("starts with a 100″ picture straight ahead, in the middle of the throw range", () => {
  const { symbolId } = projector();
  const p = plan();
  const [shown] = visibleProjections(p);
  expect(shown.projection.symbolId).toBe(symbolId);
  expect(shown.geometry.result.picture.diagonalIn).toBeCloseTo(100);
  expect(shown.geometry.result.zoom).toBeCloseTo(0.5, 2);
  expect(shown.geometry.lateralM).toBeCloseTo(0);
  expect(shown.geometry.result.issues).toEqual([]);
  // To the right of the projector, facing back at it.
  expect(shown.projection.screenCenterMm.x).toBeGreaterThan(100);
  expect(shown.projection.screenRotationDeg).toBe(180);
});

it("keeps one projection per projector", () => {
  const { symbolId } = projector();
  const symbol = plan().symbols.find((s) => s.id === symbolId)!;
  st().addFloorplanProjection(pageId, defaultProjectionFor(symbol, L610U, 50));
  expect(plan().projections).toHaveLength(1);
});

it("moves the projector, not the picture, when the distance is set", () => {
  const { symbolId, projectionId } = projector();
  const before = plan().projections![0];
  const symbol = plan().symbols.find((s) => s.id === symbolId)!;
  const at = symbolPositionForDistance(before, symbol.positionMm, 3, plan().scaleDenominator);
  st().updateFloorplanProjection(pageId, projectionId, {}, { symbolPositionMm: at });
  const after = plan();
  expect(after.projections![0].screenCenterMm).toEqual(before.screenCenterMm);
  const moved = after.symbols.find((s) => s.id === symbolId)!;
  expect(projectionGeometry(after.projections![0], moved.positionMm, after.scaleDenominator).distanceM).toBeCloseTo(3);
});

it("records a whole drag as one undo step", () => {
  const { symbolId, projectionId } = projector();
  const start = { ...plan().symbols.find((s) => s.id === symbolId)!.positionMm };
  const before = st().undoSize;
  [90, 80, 70].forEach((x, i) => {
    st().updateFloorplanProjection(pageId, projectionId, {}, { symbolPositionMm: { x, y: 100 }, continuing: i > 0 });
  });
  expect(st().undoSize).toBe(before + 1);
  st().undo();
  expect(plan().symbols.find((s) => s.id === symbolId)!.positionMm).toEqual(start);
});

it("goes with its projector when the symbol is removed, and comes back on undo", () => {
  const { symbolId } = projector();
  st().removeFloorplanSymbol(pageId, symbolId);
  expect(plan().projections).toEqual([]);
  st().undo();
  expect(plan().projections).toHaveLength(1);
});

it("is hidden with its group and by its own switch", () => {
  const { projectionId } = projector();
  st().updateFloorplanGroup(pageId, groupId, { hidden: true });
  expect(visibleProjections(plan())).toEqual([]);
  st().updateFloorplanGroup(pageId, groupId, { hidden: false });
  st().updateFloorplanProjection(pageId, projectionId, { hidden: true });
  expect(visibleProjections(plan())).toEqual([]);
});

it("follows the copied symbol when the page is duplicated", () => {
  projector();
  const copyId = st().duplicateFloorplanPage(pageId)!;
  const copy = plan(copyId);
  expect(copy.projections).toHaveLength(1);
  expect(copy.symbols.map((s) => s.id)).toContain(copy.projections![0].symbolId);
  expect(copy.projections![0].id).not.toBe(plan().projections![0].id);
  expect(copy.projections![0].symbolId).not.toBe(plan().projections![0].symbolId);
});

it("survives a round trip through the project file", () => {
  projector();
  const json = st().exportToJSON();
  useSchematicStore.setState({ nodes: [], edges: [], pages: [] });
  st().importFromJSON(json);
  const p = st().pages.find((x): x is FloorplanPage => x.type === "floorplan")!;
  expect(p.projections).toHaveLength(1);
  expect(p.projections![0].optics.lumens).toBe(6000);
});
