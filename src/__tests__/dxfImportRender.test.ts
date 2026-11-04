/**
 * Drawing a DXF: every entity kind, and the block placement maths that most of a real
 * architect's drawing hangs on (doors, windows, furniture — all INSERTs).
 *
 * Geometry is checked in drawing coordinates (y up, the way the DXF states it) through
 * flattenDxf; the SVG step on top only flips and formats, and gets its own tests below.
 */
import { describe, it, expect } from "vitest";
import type { IBlock, IEntity } from "dxf-parser";
import { flattenDxf, isArcSeg, renderDxfToSvg, type DxfShape } from "../dxfImport/render";
import type { DxfDrawing } from "../dxfImport/parse";

/** Entities are plain objects from the parser; the tests build them the same way. */
const ent = (type: string, layer: string, fields: Record<string, unknown>): IEntity =>
  ({ type, layer, ...fields }) as unknown as IEntity;

const P = (x: number, y: number) => ({ x, y, z: 0 });

function drawing(entities: IEntity[], over: Partial<DxfDrawing> = {}): DxfDrawing {
  return {
    unit: "mm",
    unitAssumed: false,
    extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    layers: [{ name: "0", visible: true }],
    entities,
    blocks: {},
    ...over,
  };
}

const block = (name: string, entities: IEntity[], base = P(0, 0)): IBlock =>
  ({ name, entities, position: base }) as unknown as IBlock;

/** The points a path visits, rounded so float noise from rotation does not matter. */
function visits(shape: DxfShape | undefined): [number, number][] {
  if (!shape || shape.kind !== "path") return [];
  const r = (n: number) => Math.round(n * 1000) / 1000 + 0; // + 0 folds -0 into 0
  return [shape.start, ...shape.segs.map((s) => s.to)].map((p) => [r(p.x), r(p.y)]);
}

const pathsOf = (d: DxfDrawing, hidden?: string[]) =>
  flattenDxf(d, { hiddenLayers: new Set(hidden ?? []) }).shapes.filter((s) => s.kind === "path");

describe("lines and polylines", () => {
  it("draws a line from its two vertices", () => {
    const [line] = pathsOf(drawing([ent("LINE", "0", { vertices: [P(0, 0), P(10, 5)] })]));
    expect(visits(line)).toEqual([[0, 0], [10, 5]]);
  });

  it("closes a polyline the drawing marks as closed", () => {
    const [poly] = pathsOf(drawing([ent("LWPOLYLINE", "0", {
      vertices: [P(0, 0), P(10, 0), P(10, 10)], shape: true,
    })]));
    expect(poly.kind === "path" && poly.closed).toBe(true);
    expect(visits(poly)).toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it("closes with an arc when the last vertex bulges — a round column is drawn this way", () => {
    // Two vertices, both bulging by a half circle, closed: a full circle of radius 5.
    const [column] = pathsOf(drawing([ent("LWPOLYLINE", "0", {
      vertices: [{ ...P(0, 0), bulge: 1 }, { ...P(10, 0), bulge: 1 }], shape: true,
    })]));
    const segs = column.kind === "path" ? column.segs : [];
    expect(segs).toHaveLength(2);
    expect(segs.every((s) => isArcSeg(s))).toBe(true);
    expect(visits(column)).toEqual([[0, 0], [10, 0], [0, 0]]);
  });

  it("turns a bulge into an arc — a door swing is drawn exactly this way", () => {
    // Bulge 1 = a half circle, counter-clockwise from (0,0) to (10,0), radius 5.
    const [poly] = pathsOf(drawing([ent("LWPOLYLINE", "0", {
      vertices: [{ ...P(0, 0), bulge: 1 }, P(10, 0)], shape: false,
    })]));
    const seg = poly.kind === "path" ? poly.segs[0] : undefined;
    expect(isArcSeg(seg) && seg.arc).toMatchObject({ r: 5, ccw: true, large: false });
    // Negative bulge runs the other way round.
    const [back] = pathsOf(drawing([ent("LWPOLYLINE", "0", {
      vertices: [{ ...P(0, 0), bulge: -1 }, P(10, 0)],
    })]));
    const backSeg = back.kind === "path" ? back.segs[0] : undefined;
    expect(isArcSeg(backSeg) && backSeg.arc.ccw).toBe(false);
  });
});

describe("circles, arcs, ellipses, splines", () => {
  it("draws a circle as two half arcs around its centre", () => {
    const [circle] = pathsOf(drawing([ent("CIRCLE", "0", { center: P(50, 50), radius: 10 })]));
    expect(visits(circle)).toEqual([[60, 50], [40, 50], [60, 50]]);
  });

  it("draws an arc counter-clockwise, and knows when it is the long way round", () => {
    // Parser hands angles over in radians. 0° → 270° counter-clockwise is the large arc.
    const [arc] = pathsOf(drawing([ent("ARC", "0", {
      center: P(0, 0), radius: 10, startAngle: 0, endAngle: (3 * Math.PI) / 2,
    })]));
    expect(visits(arc)).toEqual([[10, 0], [0, -10]]);
    const seg = arc.kind === "path" ? arc.segs[0] : undefined;
    expect(isArcSeg(seg) && seg.arc).toMatchObject({ r: 10, ccw: true, large: true });
  });

  it("samples an ellipse into a closed outline through its axis ends", () => {
    const [ellipse] = pathsOf(drawing([ent("ELLIPSE", "0", {
      center: P(0, 0), majorAxisEndPoint: P(20, 0), axisRatio: 0.5, startAngle: 0, endAngle: 2 * Math.PI,
    })]));
    const pts = visits(ellipse);
    expect(pts.length).toBeGreaterThan(16);
    expect(pts).toContainEqual([20, 0]);
    expect(pts.some(([x, y]) => Math.abs(x) < 0.5 && Math.abs(y - 10) < 0.5)).toBe(true);
  });

  it("follows a spline through its fit points when it has them", () => {
    const [spline] = pathsOf(drawing([ent("SPLINE", "0", {
      fitPoints: [P(0, 0), P(5, 5), P(10, 0)], controlPoints: [P(0, 0), P(5, 20), P(10, 0)],
    })]));
    expect(visits(spline)).toEqual([[0, 0], [5, 5], [10, 0]]);
  });
});

describe("blocks", () => {
  const door = block("TÜR", [ent("LINE", "0", { vertices: [P(0, 0), P(10, 0)] })]);

  it("places a block where the INSERT says", () => {
    const [line] = pathsOf(drawing(
      [ent("INSERT", "0", { name: "TÜR", position: P(100, 200) })],
      { blocks: { TÜR: door } },
    ));
    expect(visits(line)).toEqual([[100, 200], [110, 200]]);
  });

  it("turns, scales and mirrors it", () => {
    const placed = (fields: Record<string, unknown>) => visits(pathsOf(drawing(
      [ent("INSERT", "0", { name: "TÜR", position: P(0, 0), ...fields })],
      { blocks: { TÜR: door } },
    ))[0]);
    expect(placed({ rotation: 90 })).toEqual([[0, 0], [0, 10]]);
    expect(placed({ xScale: 2, yScale: 2 })).toEqual([[0, 0], [20, 0]]);
    // A negative scale is how a door hinged on the other side is drawn.
    expect(placed({ xScale: -1 })).toEqual([[0, 0], [-10, 0]]);
  });

  it("measures the block from its own base point, not from 0,0", () => {
    // The door's hinge sits at (10, 0) inside the block; placing the block at (100, 100)
    // puts the hinge there.
    const hinged = block("TÜR", [ent("LINE", "0", { vertices: [P(10, 0), P(20, 0)] })], P(10, 0));
    const [line] = pathsOf(drawing(
      [ent("INSERT", "0", { name: "TÜR", position: P(100, 100) })],
      { blocks: { TÜR: hinged } },
    ));
    expect(visits(line)).toEqual([[100, 100], [110, 100]]);
  });

  it("follows a block inside a block", () => {
    const wall = block("WAND", [ent("INSERT", "0", { name: "TÜR", position: P(5, 0) })]);
    const [line] = pathsOf(drawing(
      [ent("INSERT", "0", { name: "WAND", position: P(100, 0), rotation: 90 })],
      { blocks: { TÜR: door, WAND: wall } },
    ));
    expect(visits(line)).toEqual([[100, 5], [100, 15]]);
  });

  it("repeats a block over an INSERT's rows and columns", () => {
    const shapes = pathsOf(drawing(
      [ent("INSERT", "0", { name: "TÜR", position: P(0, 0), columnCount: 3, columnSpacing: 50, rowCount: 2, rowSpacing: 20 })],
      { blocks: { TÜR: door } },
    ));
    expect(shapes).toHaveLength(6);
    expect(shapes.map((s) => visits(s)[0])).toContainEqual([100, 20]);
  });

  it("draws a dimension through the block that carries its lines", () => {
    const dimBlock = block("*D1", [ent("LINE", "0", { vertices: [P(0, -5), P(30, -5)] })]);
    const [line] = pathsOf(drawing([ent("DIMENSION", "0", { block: "*D1" })], { blocks: { "*D1": dimBlock } }));
    expect(visits(line)).toEqual([[0, -5], [30, -5]]);
  });

  it("stops at a block that contains itself instead of hanging", () => {
    const loop = block("LOOP", [
      ent("LINE", "0", { vertices: [P(0, 0), P(1, 0)] }),
      ent("INSERT", "0", { name: "LOOP", position: P(0, 0) }),
    ]);
    const shapes = pathsOf(drawing([ent("INSERT", "0", { name: "LOOP", position: P(0, 0) })], { blocks: { LOOP: loop } }));
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.length).toBeLessThan(20);
  });

  it("keeps an arc an arc under an even scale, and samples it under an uneven one", () => {
    const round = block("RUND", [ent("ARC", "0", { center: P(0, 0), radius: 10, startAngle: 0, endAngle: Math.PI / 2 })]);
    const arcIn = (fields: Record<string, unknown>) => pathsOf(drawing(
      [ent("INSERT", "0", { name: "RUND", position: P(0, 0), ...fields })],
      { blocks: { RUND: round } },
    ))[0];
    const even = arcIn({ xScale: 2, yScale: 2 });
    expect(even.kind === "path" && even.segs.some((s) => isArcSeg(s))).toBe(true);
    const uneven = arcIn({ xScale: 2, yScale: 1 });
    expect(uneven.kind === "path" && uneven.segs.some((s) => isArcSeg(s))).toBe(false);
    expect(visits(uneven)[0]).toEqual([20, 0]);
  });

  it("runs a mirrored arc the other way round", () => {
    const round = block("RUND", [ent("ARC", "0", { center: P(0, 0), radius: 10, startAngle: 0, endAngle: Math.PI / 2 })]);
    const [arc] = pathsOf(drawing(
      [ent("INSERT", "0", { name: "RUND", position: P(0, 0), xScale: -1 })],
      { blocks: { RUND: round } },
    ));
    const seg = arc.kind === "path" ? arc.segs[0] : undefined;
    expect(isArcSeg(seg) && seg.arc.ccw).toBe(false);
  });
});

describe("layers", () => {
  const twoLayers = (insertLayer: string, innerLayer: string) => drawing(
    [ent("INSERT", insertLayer, { name: "B", position: P(0, 0) })],
    {
      blocks: { B: block("B", [ent("LINE", innerLayer, { vertices: [P(0, 0), P(1, 1)] })]) },
      layers: [{ name: "0", visible: true }, { name: "Möbel", visible: true }, { name: "Wand", visible: true }],
    },
  );

  it("leaves out what sits on a hidden layer", () => {
    const d = drawing([
      ent("LINE", "Wand", { vertices: [P(0, 0), P(1, 0)] }),
      ent("LINE", "Möbel", { vertices: [P(0, 1), P(1, 1)] }),
    ]);
    expect(pathsOf(d, ["Möbel"])).toHaveLength(1);
  });

  it("keeps blocks drawn on layer 0 when layer 0 itself is switched off", () => {
    // The case the inheritance rule exists for. Blocks are drawn on layer 0 by convention,
    // and layer 0 at the top level is where construction lines end up — switching it off
    // must not take every door and window with it.
    const d = drawing(
      [
        ent("LINE", "0", { vertices: [P(0, 0), P(1, 0)] }),
        ent("INSERT", "Wand", { name: "B", position: P(0, 0) }),
      ],
      {
        blocks: { B: block("B", [ent("LINE", "0", { vertices: [P(5, 5), P(6, 6)] })]) },
        layers: [{ name: "0", visible: true }, { name: "Wand", visible: true }],
      },
    );
    const shapes = pathsOf(d, ["0"]);
    expect(shapes).toHaveLength(1);
    expect(visits(shapes[0])).toEqual([[5, 5], [6, 6]]);
  });

  it("gives what a block draws on layer 0 the layer of the INSERT", () => {
    // DXF's own rule: layer 0 inside a block means "whatever layer the block is placed on".
    expect(pathsOf(twoLayers("Möbel", "0"), ["Möbel"])).toHaveLength(0);
    expect(pathsOf(twoLayers("Möbel", "0"), ["Wand"])).toHaveLength(1);
  });

  it("hides a block entity on its own hidden layer even when the INSERT is visible", () => {
    expect(pathsOf(twoLayers("Wand", "Möbel"), ["Möbel"])).toHaveLength(0);
  });
});

describe("text and fills", () => {
  const textOf = (e: IEntity) => flattenDxf(drawing([e])).shapes.find((s) => s.kind === "text");

  it("writes a text at its point, at its height, turned by its rotation", () => {
    const text = textOf(ent("TEXT", "0", { startPoint: P(5, 5), textHeight: 2.5, rotation: 30, text: "Büro 1.04" }));
    expect(text).toMatchObject({ kind: "text", lines: ["Büro 1.04"], height: 2.5, rotation: 30, at: { x: 5, y: 5 } });
  });

  it("anchors an aligned text at its second point", () => {
    // halign 1 = centred; DXF then measures from group 11, not group 10.
    const text = textOf(ent("TEXT", "0", { startPoint: P(0, 0), endPoint: P(50, 7), halign: 1, textHeight: 2, text: "Mitte" }));
    expect(text).toMatchObject({ at: { x: 50, y: 7 }, anchor: "middle" });
  });

  it("splits an MTEXT into its lines and drops the formatting codes", () => {
    const text = textOf(ent("MTEXT", "0", { position: P(0, 0), height: 3, text: "{\\fArial|b1;Raum}\\PFläche 24 m²" }));
    expect(text).toMatchObject({ lines: ["Raum", "Fläche 24 m²"] });
  });

  it("decodes the %% codes AutoCAD uses for Ø, ° and ±", () => {
    const text = textOf(ent("TEXT", "0", { startPoint: P(0, 0), textHeight: 1, text: "%%c100 %%d %%p5" }));
    expect(text).toMatchObject({ lines: ["Ø100 ° ±5"] });
  });

  it("fills a SOLID in DXF's crossed corner order", () => {
    // DXF lists the corners as 1, 2, 4, 3 — taken literally the square is a bow tie.
    const fill = flattenDxf(drawing([ent("SOLID", "0", { points: [P(0, 0), P(10, 0), P(0, 10), P(10, 10)] })]))
      .shapes.find((s) => s.kind === "fill");
    expect(fill && fill.kind === "fill" && fill.points.map((p) => [p.x, p.y])).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
});

describe("what is not drawn", () => {
  it("counts it instead of failing", () => {
    const result = flattenDxf(drawing([
      ent("POINT", "0", { position: P(1, 1) }),
      ent("3DFACE", "0", {}),
      ent("LINE", "0", { vertices: [P(0, 0), P(1, 1)] }),
    ]));
    expect(result.skipped).toEqual({ POINT: 1, "3DFACE": 1 });
    expect(result.shapes).toHaveLength(1);
  });
});

describe("the SVG", () => {
  it("flips the drawing upright — DXF counts y upwards, SVG downwards", () => {
    const { svg } = renderDxfToSvg(drawing([ent("LINE", "0", { vertices: [P(0, 0), P(0, 100)] })]));
    // With the drawing's own 0..100 box, y = 0 (bottom of the drawing) is the bottom of the
    // picture and y = 100 the top. The picture carries a small margin, so compare the order.
    const nums = /M\s*([\d.-]+)\s+([\d.-]+)\s*L\s*([\d.-]+)\s+([\d.-]+)/.exec(svg)!;
    expect(Number(nums[2])).toBeGreaterThan(Number(nums[4]));
  });

  it("is as big as the drawing in its own units, so one unit is one pixel", () => {
    const result = renderDxfToSvg(drawing([ent("LINE", "0", { vertices: [P(0, 0), P(100, 50)] })], {
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 50 },
    }));
    expect(result.width).toBeGreaterThanOrEqual(100);
    expect(result.width).toBeLessThan(102);
    expect(result.svg).toContain(`viewBox="0 0 ${result.width} ${result.height}"`);
  });

  it("escapes text so a drawing cannot break the picture", () => {
    const { svg } = renderDxfToSvg(drawing([ent("TEXT", "0", { startPoint: P(1, 1), textHeight: 1, text: "A<B & \"C\"" })]));
    expect(svg).toContain("A&lt;B &amp; &quot;C&quot;");
    expect(svg).not.toContain("A<B");
  });

  it("uses the ink it is given", () => {
    const { svg } = renderDxfToSvg(drawing([ent("LINE", "0", { vertices: [P(0, 0), P(1, 1)] })]), { ink: "#123456" });
    expect(svg).toContain('stroke="#123456"');
  });
});
