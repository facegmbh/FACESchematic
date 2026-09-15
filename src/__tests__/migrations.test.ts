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

describe("v44→v45 floorplan masks migration", () => {
  it("adds an empty masks list to floorplan pages and leaves others alone", () => {
    const out = migrateSchematic({
      version: 44, nodes: [], edges: [],
      pages: [
        { id: "floorplan-1", type: "floorplan", drawingBlock: {}, notes: [] },
        { id: "printsheet-1", type: "print-sheet", viewports: [] },
      ],
    });
    expect(out.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.pages[0].masks).toEqual([]);
    expect(out.pages[1]).not.toHaveProperty("masks");
  });
});

describe("v46→v47 floorplan walls migration", () => {
  it("adds an empty wall list to floorplan pages and leaves others alone", () => {
    const out = migrateSchematic({
      version: 46, nodes: [], edges: [],
      pages: [
        { id: "floorplan-1", type: "floorplan", drawingBlock: {}, notes: [], masks: [], coverages: [] },
        { id: "printsheet-1", type: "print-sheet", viewports: [] },
      ],
    });
    expect(out.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.pages[0].walls).toEqual([]);
    expect(out.pages[1]).not.toHaveProperty("walls");
  });

  it("keeps walls a newer file already carries", () => {
    const walls = [{ id: "fpwall-1", material: "concrete", thicknessMm: 240, pointsMm: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }];
    const out = migrateSchematic({
      version: 46, nodes: [], edges: [],
      pages: [{ id: "floorplan-1", type: "floorplan", drawingBlock: {}, notes: [], masks: [], coverages: [], walls }],
    });
    expect(out.pages[0].walls).toBe(walls);
  });
});

describe("v45→v46 floorplan coverage migration", () => {
  it("adds an empty coverage list to floorplan pages and leaves others alone", () => {
    const out = migrateSchematic({
      version: 45, nodes: [], edges: [],
      pages: [
        { id: "floorplan-1", type: "floorplan", drawingBlock: {}, notes: [], masks: [] },
        { id: "printsheet-1", type: "print-sheet", viewports: [] },
      ],
    });
    expect(out.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.pages[0].coverages).toEqual([]);
    expect(out.pages[1]).not.toHaveProperty("coverages");
  });

  it("keeps coverage areas a newer file already carries", () => {
    const areas = [{ id: "fpcov-1", shape: "sector", positionMm: { x: 1, y: 2 }, rangeM: 12, apertureDeg: 90 }];
    const out = migrateSchematic({
      version: 45, nodes: [], edges: [],
      pages: [{ id: "floorplan-1", type: "floorplan", drawingBlock: {}, notes: [], masks: [], coverages: areas }],
    });
    expect(out.pages[0].coverages).toBe(areas);
  });
});

describe("v47→v48: coverage captions stop being copies", () => {
  /** One floorplan page at v47 whose areas carry captions copied when they were made. */
  const plan = (coverages: Record<string, unknown>[]) => ({
    version: 47,
    nodes: [],
    edges: [],
    pages: [{
      type: "floorplan",
      id: "p1",
      symbols: [{ id: "s1", label: "K7" }],
      coverages,
    }],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reading a migrated file
  const areas = (out: any) => out.pages[0].coverages;

  it("drops a caption that is a copy of the device's number", () => {
    const out = migrateSchematic(plan([
      { id: "c1", symbolId: "s1", label: "K1" },   // stale: the device is K7 by now
      { id: "c2", symbolId: "s1", label: "4.12" },
      { id: "c3", symbolId: "s1", label: "BM 3" },
    ]));
    expect(areas(out).map((c: { label?: string }) => c.label)).toEqual([undefined, undefined, undefined]);
    expect(areas(out).every((c: { ownLabel?: boolean }) => !c.ownLabel)).toBe(true);
  });

  it("keeps the planner's own words, and marks them as theirs", () => {
    const out = migrateSchematic(plan([{ id: "c1", symbolId: "s1", label: "Zufahrt Nord" }]));
    expect(areas(out)[0]).toMatchObject({ label: "Zufahrt Nord", ownLabel: true });
  });

  it("leaves a free-standing area its text — it has no device to read from", () => {
    const out = migrateSchematic(plan([
      { id: "c1", label: "Hof" },
      { id: "c2", label: "1.2" },
      { id: "c3" },
    ]));
    expect(areas(out)[0]).toMatchObject({ label: "Hof", ownLabel: true });
    expect(areas(out)[1]).toMatchObject({ label: "1.2", ownLabel: true });
    expect(areas(out)[2].ownLabel).toBeUndefined();
  });
});
