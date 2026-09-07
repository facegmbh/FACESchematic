import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectScaleInText,
  extractPdfGeometry,
  guessWallLayer,
  thicknessHistogram,
  toFloorplanWalls,
  wallsFromGeometry,
  type PdfPageGeometry,
} from "../pdfWalls";

/**
 * Driven against a real architect's plan: an A1 ground floor at 1:50 with fifteen named
 * layers, one of them the walls. The numbers asserted below are what that drawing
 * contains, not what a model predicts — this is the calibration the feature was gated on.
 */
const FIXTURE = join(__dirname, "..", "..", "e2e", "CBC-Osnabrück_CEI_5010A-EG_260814.pdf");

describe("scale detection", () => {
  it("reads the stated scale and ignores things that only look like one", () => {
    expect(detectScaleInText("Grundriss EG  M 1:50  Blatt 3")).toBe(50);
    expect(detectScaleInText("Maßstab 1 : 100")).toBe(100);
    expect(detectScaleInText("Raum 1:2 Bad")).toBeUndefined();
    expect(detectScaleInText("keine Angabe")).toBeUndefined();
  });
});

describe("wall layer guess", () => {
  it("finds the walls under their usual names, in either language", () => {
    expect(guessWallLayer([{ id: "a", name: "00 CEI Bodenbelag" }, { id: "b", name: "00 CEI Wände" }])).toBe("b");
    expect(guessWallLayer([{ id: "x", name: "A-WALL" }])).toBe("x");
    expect(guessWallLayer([{ id: "y", name: "Mauerwerk" }])).toBe("y");
    expect(guessWallLayer([{ id: "z", name: "Möbel" }])).toBeUndefined();
  });
});

describe("geometry from the real plan", () => {
  let geometry: PdfPageGeometry;
  let close: () => Promise<void>;

  beforeAll(async () => {
    // pdf.js's Node build; the app uses the web build through the same PdfPageLike shape.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(FIXTURE));
    const task = pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const config = await doc.getOptionalContentConfig();
    const groups = (config?.getGroups?.() ?? {}) as Record<string, { name?: unknown }>;
    const layerNames = Object.fromEntries(Object.entries(groups).map(([id, g]) => [id, String(g?.name ?? id)]));
    geometry = await extractPdfGeometry(page, pdfjs.OPS as unknown as Record<string, number>, layerNames);
    close = () => task.destroy();
  }, 30_000);

  it("sees the sheet, its layers and the stated scale", async () => {
    // A1 portrait: 594 × 841 mm is 1683.8 × 2383.9 pt.
    expect(geometry.widthPt).toBeCloseTo(1683.8, 0);
    expect(geometry.heightPt).toBeCloseTo(2383.9, 0);
    expect(geometry.layers.length).toBe(15);
    expect(geometry.scaleDenominator).toBe(50);
    const walls = geometry.layers.find((l) => l.name === "00 CEI Wände");
    expect(walls).toBeDefined();
    expect(guessWallLayer(geometry.layers)).toBe(walls!.id);
  });

  it("tags every segment with the layer it was drawn on", () => {
    const walls = geometry.layers.find((l) => l.name === "00 CEI Wände")!;
    // 578 on the wall layer, and the thick pen is the bar counter, not the walls — the
    // reason this feature picks by layer rather than by pen.
    expect(walls.count).toBe(578);
    const thickPen = geometry.segments.filter((s) => s.lineWidthMm >= 0.3);
    expect(thickPen.length).toBeGreaterThan(800);
    expect(thickPen.every((s) => s.layerName === "50 Theke Hindersmann")).toBe(true);
    expect(geometry.segments.filter((s) => s.layerId === walls.id && s.lineWidthMm >= 0.3)).toHaveLength(0);
  });

  it("pairs the wall faces into walls with the thicknesses the building actually has", () => {
    const wallsLayer = geometry.layers.find((l) => l.name === "00 CEI Wände")!;
    // The page is the sheet: the raster covers 594 × 841 mm from the top-left corner.
    const { walls, paired, unpaired } = wallsFromGeometry(geometry, {
      layerIds: new Set([wallsLayer.id]),
      underlay: { positionMm: { x: 0, y: 0 }, sizeMm: { w: 594, h: 841 } },
      frame: geometry,
      scaleDenominator: 50,
    });
    expect(walls.length).toBeGreaterThan(50);
    expect(paired).toBeGreaterThan(30);
    expect(paired + unpaired).toBe(walls.length);

    // 120 mm partitions and 240–250 mm structural walls are the plan's two families;
    // both have to come out of the pairing.
    const hist = thicknessHistogram(walls);
    const has = (mm: number) => hist.some((h) => Math.abs(h.thicknessMm - mm) <= 10 && h.count >= 3);
    expect(has(120), JSON.stringify(hist.slice(0, 6))).toBe(true);
    expect(has(240) || has(250), JSON.stringify(hist.slice(0, 6))).toBe(true);
    // Nothing comes out thinner than a stud wall or thicker than an outer wall.
    for (const h of hist) {
      expect(h.thicknessMm).toBeGreaterThanOrEqual(50);
      expect(h.thicknessMm).toBeLessThanOrEqual(600);
    }
  });

  it("lands the walls inside the drawn plan area of the sheet", () => {
    const wallsLayer = geometry.layers.find((l) => l.name === "00 CEI Wände")!;
    const { walls } = wallsFromGeometry(geometry, {
      layerIds: new Set([wallsLayer.id]),
      underlay: { positionMm: { x: 0, y: 0 }, sizeMm: { w: 594, h: 841 } },
      frame: geometry,
      scaleDenominator: 50,
    });
    // The plan occupies roughly x 129–359 mm, y 87–756 mm on this sheet (measured).
    const xs = walls.flatMap((w) => w.pointsMm.map((p) => p.x));
    const ys = walls.flatMap((w) => w.pointsMm.map((p) => p.y));
    expect(Math.min(...xs)).toBeGreaterThan(100);
    expect(Math.max(...xs)).toBeLessThan(400);
    expect(Math.min(...ys)).toBeGreaterThan(60);
    expect(Math.max(...ys)).toBeLessThan(800);
  });

  it("follows the underlay when the plan is moved or scaled on the sheet", () => {
    const wallsLayer = geometry.layers.find((l) => l.name === "00 CEI Wände")!;
    const base = wallsFromGeometry(geometry, {
      layerIds: new Set([wallsLayer.id]), frame: geometry, scaleDenominator: 50,
      underlay: { positionMm: { x: 0, y: 0 }, sizeMm: { w: 594, h: 841 } },
    });
    // The same plan placed at half size and shifted is a 1:100 drawing of the same
    // building: the walls, their count and their real thicknesses must not change, only
    // where they sit on the paper.
    const moved = wallsFromGeometry(geometry, {
      layerIds: new Set([wallsLayer.id]), frame: geometry, scaleDenominator: 100,
      underlay: { positionMm: { x: 20, y: 10 }, sizeMm: { w: 297, h: 420.5 } },
    });
    expect(moved.walls.length).toBe(base.walls.length);
    expect(moved.paired).toBe(base.paired);
    for (let i = 0; i < base.walls.length; i++) {
      expect(moved.walls[i].thicknessMm).toBe(base.walls[i].thicknessMm);
      for (let k = 0; k < 2; k++) {
        expect(moved.walls[i].pointsMm[k].x).toBeCloseTo(20 + base.walls[i].pointsMm[k].x / 2, 4);
        expect(moved.walls[i].pointsMm[k].y).toBeCloseTo(10 + base.walls[i].pointsMm[k].y / 2, 4);
      }
    }
  });

  it("offers every layer's segments when no wall layer exists", () => {
    const all = wallsFromGeometry(geometry, {
      underlay: { positionMm: { x: 0, y: 0 }, sizeMm: { w: 594, h: 841 } },
      frame: geometry,
      scaleDenominator: 50,
    });
    const wallsOnly = wallsFromGeometry(geometry, {
      layerIds: new Set([geometry.layers.find((l) => l.name === "00 CEI Wände")!.id]),
      underlay: { positionMm: { x: 0, y: 0 }, sizeMm: { w: 594, h: 841 } },
      frame: geometry,
      scaleDenominator: 50,
    });
    expect(all.walls.length).toBeGreaterThan(wallsOnly.walls.length);
  });

  it("turns candidates into store records with defaults where the drawing gave none", () => {
    const records = toFloorplanWalls(
      [{ pointsMm: [{ x: 0, y: 0 }, { x: 10, y: 0 }], thicknessMm: 240 }, { pointsMm: [{ x: 0, y: 5 }, { x: 10, y: 5 }] }],
      "brick-solid",
      115,
    );
    expect(records[0]).toMatchObject({ material: "brick-solid", thicknessMm: 240 });
    expect(records[1]).toMatchObject({ material: "brick-solid", thicknessMm: 115 });
    expect(records[1].pointsMm).toEqual([{ x: 0, y: 5 }, { x: 10, y: 5 }]);
  });

  it("releases the document", async () => {
    await close();
  });
});
