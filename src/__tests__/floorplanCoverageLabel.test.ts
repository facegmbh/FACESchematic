/**
 * The number on a coverage area follows the device it is drawn on.
 *
 * The helper itself is covered in floorplan.test.ts; what is proved here is the wiring —
 * that the three store actions which can change a symbol's label all carry the anchored
 * area along. Renumbering a camera and finding the old number still printed in front of it
 * is exactly the kind of mistake that survives into a handover.
 */
import { it, expect, beforeAll, beforeEach } from "vitest";
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

let pageId = "";
let groupId = "";

/** A camera with its wedge, both numbered "K1". */
function camera(label: string): { symbolId: string; coverageId: string } {
  const symbolId = st().addFloorplanSymbol(pageId, { groupId, positionMm: { x: 100, y: 100 }, label });
  const coverageId = st().addFloorplanCoverage(pageId, {
    symbolId, groupId, shape: "sector", positionMm: { x: 100, y: 100 }, rangeM: 12, label,
  });
  return { symbolId, coverageId };
}

const areaLabel = (id: string) => plan().coverages.find((c) => c.id === id)?.label;

beforeEach(() => {
  useSchematicStore.setState({ nodes: [], edges: [], pages: [] });
  pageId = st().addFloorplanPage("EG");
  groupId = st().addFloorplanGroup(pageId, { label: "Kameras", color: "#e11d1d", shape: "triangle" });
});

it("renaming one symbol renumbers its area", () => {
  const { symbolId, coverageId } = camera("K1");
  st().updateFloorplanSymbol(pageId, symbolId, { label: "K7" });
  expect(areaLabel(coverageId)).toBe("K7");
});

it("a patch that does not touch the label leaves the area alone", () => {
  const { symbolId, coverageId } = camera("K1");
  st().updateFloorplanSymbol(pageId, symbolId, { rotationDeg: 90 });
  expect(areaLabel(coverageId)).toBe("K1");
});

it("renaming a whole selection renumbers each area with its own symbol", () => {
  const a = camera("K1");
  const b = camera("K2");
  st().updateFloorplanSymbols(pageId, [a.symbolId, b.symbolId], { label: "K9" });
  expect([areaLabel(a.coverageId), areaLabel(b.coverageId)]).toEqual(["K9", "K9"]);
});

it("renumbering the group takes every area with it", () => {
  const a = camera("K1");
  const b = camera("K2");
  st().renumberFloorplanGroup(pageId, groupId, "K10");
  expect(plan().symbols.map((s) => s.label)).toEqual(["K10", "K11"]);
  expect([areaLabel(a.coverageId), areaLabel(b.coverageId)]).toEqual(["K10", "K11"]);
});

it("an area the planner named himself keeps that name through a renumber", () => {
  const { symbolId } = camera("K1");
  const own = st().addFloorplanCoverage(pageId, {
    symbolId, groupId, shape: "sector", positionMm: { x: 100, y: 100 }, rangeM: 8, label: "Zufahrt Nord",
  });
  st().updateFloorplanSymbol(pageId, symbolId, { label: "K7" });
  expect(areaLabel(own)).toBe("Zufahrt Nord");
});
