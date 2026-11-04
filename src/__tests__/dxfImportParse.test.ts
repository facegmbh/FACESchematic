/**
 * Reading an architect's DXF: units, extents, layers, blocks.
 *
 * The fixtures are written here by hand, pair by pair, the way a DXF really looks. That is
 * on purpose: a real drawing from a customer project is not something to keep in a public
 * repository, and a hand-written file says in the test itself which group code the
 * behaviour hangs on.
 */
import { describe, it, expect } from "vitest";
import { MM_PER_DXF_UNIT, parseDxf } from "../dxfImport/parse";

/** DXF is a flat list of (group code, value) pairs — this keeps the fixtures readable. */
function dxf(...pairs: [number | string, string | number][]): string {
  return pairs.map(([code, value]) => `${code}\n${value}`).join("\n") + "\n";
}

const header = (...entries: [number | string, string | number][]) =>
  dxf([0, "SECTION"], [2, "HEADER"], ...entries, [0, "ENDSEC"]);

const tables = (...entries: [number | string, string | number][]) =>
  dxf([0, "SECTION"], [2, "TABLES"], [0, "TABLE"], [2, "LAYER"], ...entries, [0, "ENDTAB"], [0, "ENDSEC"]);

const entities = (...entries: [number | string, string | number][]) =>
  dxf([0, "SECTION"], [2, "ENTITIES"], ...entries, [0, "ENDSEC"]);

const line = (layer: string, x1: number, y1: number, x2: number, y2: number): [number, string | number][] =>
  [[0, "LINE"], [8, layer], [10, x1], [20, y1], [11, x2], [21, y2]];

const EOF = dxf([0, "EOF"]);

/** The smallest file the parser should accept: one line, on one layer. */
function minimalDrawing(...headerEntries: [number | string, string | number][]): string {
  return header(...headerEntries)
    + tables([0, "LAYER"], [2, "0"], [70, 0], [62, 7])
    + entities(...line("0", 0, 0, 1000, 500))
    + EOF;
}

describe("units", () => {
  const unitOf = async (insunits: number | null) =>
    (await parseDxf(insunits === null ? minimalDrawing() : minimalDrawing([9, "$INSUNITS"], [70, insunits])));

  it("reads what the drawing says", async () => {
    expect((await unitOf(4)).unit).toBe("mm");
    expect((await unitOf(5)).unit).toBe("cm");
    expect((await unitOf(6)).unit).toBe("m");
    expect((await unitOf(1)).unit).toBe("in");
    expect((await unitOf(2)).unit).toBe("ft");
  });

  it("assumes mm when the drawing says nothing, and says that it assumed", async () => {
    // German architectural DXF are in mm almost without exception — but a guess has to be
    // visible, so the import dialog can offer to change it.
    for (const insunits of [null, 0]) {
      const drawing = await unitOf(insunits);
      expect(drawing.unit).toBe("mm");
      expect(drawing.unitAssumed).toBe(true);
    }
    expect((await unitOf(4)).unitAssumed).toBe(false);
  });

  it("knows what a unit is worth in millimetres", () => {
    expect(MM_PER_DXF_UNIT).toEqual({ mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 });
  });
});

describe("extents", () => {
  it("takes the header's own when it has them", async () => {
    const drawing = await parseDxf(
      header([9, "$EXTMIN"], [10, -5], [20, -10], [9, "$EXTMAX"], [10, 95], [20, 40])
      + tables([0, "LAYER"], [2, "0"], [70, 0])
      + entities(...line("0", 0, 0, 10, 10))
      + EOF,
    );
    expect(drawing.extents).toEqual({ minX: -5, minY: -10, maxX: 95, maxY: 40 });
  });

  it("works them out from the drawing when the header has none", async () => {
    const drawing = await parseDxf(
      header()
      + tables([0, "LAYER"], [2, "0"], [70, 0])
      + entities(
        ...line("0", 0, 0, 1000, 500),
        [0, "CIRCLE"], [8, "0"], [10, 2000], [20, 20], [40, 50],
      )
      + EOF,
    );
    // The circle sits low and reaches its radius past the centre both ways: 2050 to the
    // right, 20 − 50 = −30 below the line.
    expect(drawing.extents).toEqual({ minX: 0, minY: -30, maxX: 2050, maxY: 500 });
  });

  it("ignores a header extent that was never filled in (min = max = 0,0)", async () => {
    // A file saved before the drawing was ever regenerated: plausible numbers, no area.
    const drawing = await parseDxf(
      header([9, "$EXTMIN"], [10, 0], [20, 0], [9, "$EXTMAX"], [10, 0], [20, 0])
      + tables([0, "LAYER"], [2, "0"], [70, 0])
      + entities(...line("0", 0, 0, 100, 60))
      + EOF,
    );
    expect(drawing.extents).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 60 });
  });

  it("ignores the 'nothing here yet' placeholder AutoCAD writes (±1e20)", async () => {
    const drawing = await parseDxf(
      header([9, "$EXTMIN"], [10, 1e20], [20, 1e20], [9, "$EXTMAX"], [10, -1e20], [20, -1e20])
      + tables([0, "LAYER"], [2, "0"], [70, 0])
      + entities(...line("0", 0, 0, 100, 60))
      + EOF,
    );
    expect(drawing.extents).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 60 });
  });
});

describe("layers", () => {
  it("lists them, and starts the ones the drawing switched off switched off", async () => {
    const drawing = await parseDxf(
      header()
      + tables(
        [0, "LAYER"], [2, "Wände"], [70, 0], [62, 7],
        [0, "LAYER"], [2, "Möblierung"], [70, 1], [62, 3],    // 70 bit 1 = frozen
        [0, "LAYER"], [2, "Bemaßung"], [70, 0], [62, -4],     // negative colour = off
      )
      + entities(...line("Wände", 0, 0, 10, 10))
      + EOF,
    );
    expect(drawing.layers.map((l) => [l.name, l.visible])).toEqual([
      ["Wände", true],
      ["Möblierung", false],
      ["Bemaßung", false],
    ]);
  });

  it("invents a layer an entity names but the table does not", async () => {
    // Drawings in the wild do this, and dropping those entities would lose walls.
    const drawing = await parseDxf(
      header() + tables([0, "LAYER"], [2, "0"], [70, 0])
      + entities(...line("A-WALL", 0, 0, 10, 10))
      + EOF,
    );
    expect(drawing.layers.map((l) => l.name)).toContain("A-WALL");
    expect(drawing.layers.find((l) => l.name === "A-WALL")?.visible).toBe(true);
  });
});

describe("blocks", () => {
  it("keeps them, so an INSERT can be drawn later", async () => {
    const drawing = await parseDxf(
      header() + tables([0, "LAYER"], [2, "0"], [70, 0])
      + dxf([0, "SECTION"], [2, "BLOCKS"],
        [0, "BLOCK"], [2, "TÜR"], [8, "0"], [10, 0], [20, 0],
        ...line("0", 0, 0, 900, 0),
        [0, "ENDBLK"],
        [0, "ENDSEC"])
      + entities([0, "INSERT"], [8, "0"], [2, "TÜR"], [10, 100], [20, 200])
      + EOF,
    );
    expect(Object.keys(drawing.blocks)).toContain("TÜR");
    expect(drawing.blocks["TÜR"].entities).toHaveLength(1);
    expect(drawing.entities[0].type).toBe("INSERT");
  });
});

describe("a file that cannot be used", () => {
  it("says what to do instead of leaving an empty sheet", async () => {
    const empty = header() + tables([0, "LAYER"], [2, "0"], [70, 0]) + entities() + EOF;
    await expect(parseDxf(empty)).rejects.toThrow(/nichts|empty|keine/i);
  });

  it("refuses something that is not a DXF at all", async () => {
    await expect(parseDxf("This is not a drawing.")).rejects.toThrow();
  });
});
