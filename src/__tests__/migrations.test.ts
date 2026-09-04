import { describe, it, expect } from "vitest";
import { migrateSchematic, CURRENT_SCHEMA_VERSION, STUB_LABEL_Z_INDEX } from "../migrations";

describe("stub-label z-index normalization (#178)", () => {
  it("stamps a z-index on a stub-label node that lacks one (current-version file)", () => {
    const out = migrateSchematic({
      version: CURRENT_SCHEMA_VERSION,
      nodes: [
        { id: "s1", type: "stub-label", position: { x: 0, y: 0 }, data: {} },
        { id: "d1", type: "device", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [],
    });
    const stub = out.nodes.find((n: { id: string }) => n.id === "s1");
    const device = out.nodes.find((n: { id: string }) => n.id === "d1");
    expect(stub.zIndex).toBe(STUB_LABEL_Z_INDEX);
    expect(device.zIndex).toBeUndefined(); // only stub-labels are touched
  });

  it("leaves an already-correct z-index untouched (no needless rewrite)", () => {
    const nodes = [{ id: "s1", type: "stub-label", position: { x: 0, y: 0 }, zIndex: STUB_LABEL_Z_INDEX, data: {} }];
    const out = migrateSchematic({ version: CURRENT_SCHEMA_VERSION, nodes, edges: [] });
    expect(out.nodes).toBe(nodes); // same reference — nothing changed
  });
});

describe("v39→v40 bundles migration", () => {
  it("adds an empty bundles map and bumps version", () => {
    const out = migrateSchematic({ version: 39, nodes: [], edges: [] });
    expect(out.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.bundles).toEqual({});
  });

  it("drops a dangling bundleId and dissolves <2-member bundles", () => {
    const out = migrateSchematic({
      version: 39,
      nodes: [],
      edges: [
        { id: "e1", data: { signalType: "sdi", bundleId: "ghost" } }, // no such bundle
        { id: "e2", data: { signalType: "sdi", bundleId: "b1" } }, // bundle with only 1 member
      ],
      bundles: { b1: { id: "b1" } },
    });
    expect(out.edges[0].data.bundleId).toBeUndefined();
    expect(out.edges[1].data.bundleId).toBeUndefined();
    expect(out.bundles).toEqual({});
  });

  it("keeps a valid ≥2-member bundle", () => {
    const out = migrateSchematic({
      version: 39,
      nodes: [],
      edges: [
        { id: "e1", data: { signalType: "sdi", bundleId: "b1" } },
        { id: "e2", data: { signalType: "hdmi", bundleId: "b1" } },
      ],
      bundles: { b1: { id: "b1", label: "Snake A" } },
    });
    expect(out.edges[0].data.bundleId).toBe("b1");
    expect(out.edges[1].data.bundleId).toBe("b1");
    expect(out.bundles.b1.label).toBe("Snake A");
  });
});

describe("v43→v44 floorplan drawing block migration", () => {
  it("gives a floorplan page saved before v44 a drawing block and an empty notes list", () => {
    const out = migrateSchematic({
      version: 43,
      nodes: [],
      edges: [],
      pages: [
        { id: "floorplan-1", type: "floorplan", label: "EG", paperId: "iso-a1", orientation: "landscape", scaleDenominator: 50, groups: [], symbols: [], legend: { visible: true } },
        { id: "rackpage-1", type: "rack-elevation", label: "Racks", racks: [], placements: [], accessories: [] },
      ],
    });
    expect(out.version).toBe(CURRENT_SCHEMA_VERSION);
    const fp = out.pages[0];
    expect(fp.drawingBlock.visible).toBe(true);
    expect(fp.drawingBlock.fields.length).toBeGreaterThan(0);
    expect(fp.notes).toEqual([]);
    // Other page types are untouched
    expect(out.pages[1]).not.toHaveProperty("drawingBlock");
  });

  it("keeps an existing drawing block", () => {
    const block = { visible: false, positionMm: { x: 1, y: 2 }, widthMm: 80, title: "T", fields: [], revisions: [], revisionHeaders: ["a", "b", "c", "d", "e"], showLogo: false, showNorthArrow: false, northRotationDeg: 0 };
    const out = migrateSchematic({ version: 43, nodes: [], edges: [], pages: [{ id: "floorplan-1", type: "floorplan", drawingBlock: block, notes: [{ id: "fpnote-1" }] }] });
    expect(out.pages[0].drawingBlock).toBe(block);
    expect(out.pages[0].notes).toHaveLength(1);
  });
});
