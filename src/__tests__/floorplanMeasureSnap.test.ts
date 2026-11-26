/**
 * The measuring tool catches what is drawn on the plan.
 *
 * Asked for 26.11.2026 ("einrasten wäre gut"): a measurement is only as good as the two
 * clicks. Near a wall corner the point lands on the corner, near a wall face on the face,
 * near the end of a dimension line on that end — and the second point holds the horizontal
 * or vertical through the first, so a clear width is measured square.
 */
import { describe, it, expect } from "vitest";
import { snapMeasurePoint } from "../floorplan";
import type { FloorplanWall } from "../types";

/** A 200 mm wall at 1:100 is 2 mm on paper: faces 1 mm either side of the axis. */
const wall = (pointsMm: { x: number; y: number }[], extra: Partial<FloorplanWall> = {}): FloorplanWall => ({
  id: "w1", pointsMm, material: "drywall", thicknessMm: 200, ...extra,
});
const TOL = 2;

describe("snapping a measuring point", () => {
  const horizontal = wall([{ x: 100, y: 100 }, { x: 200, y: 100 }]);
  const on = { walls: [horizontal], scaleDenominator: 100 };

  it("leaves a point alone when nothing is near", () => {
    expect(snapMeasurePoint({ x: 150, y: 150 }, on, TOL)).toBeNull();
    expect(snapMeasurePoint({ x: 150, y: 150 }, { scaleDenominator: 100 }, TOL)).toBeNull();
  });

  it("lands on the corner of a wall, where its face ends", () => {
    const s = snapMeasurePoint({ x: 100.8, y: 98.4 }, on, TOL)!;
    expect(s.kind).toBe("corner");
    expect(s.pointMm.x).toBeCloseTo(100);
    expect(s.pointMm.y).toBeCloseTo(99);
  });

  it("lands on the face of a wall, not on its axis", () => {
    const below = snapMeasurePoint({ x: 150, y: 101.6 }, on, TOL)!;
    expect(below.kind).toBe("edge");
    expect(below.pointMm.x).toBeCloseTo(150);
    expect(below.pointMm.y).toBeCloseTo(101);
    const above = snapMeasurePoint({ x: 150, y: 98.2 }, on, TOL)!;
    expect(above.pointMm.y).toBeCloseTo(99);
  });

  it("follows the scale: the same wall is thinner on a 1:200 sheet", () => {
    const s = snapMeasurePoint({ x: 150, y: 101 }, { ...on, scaleDenominator: 200 }, TOL)!;
    expect(s.pointMm.y).toBeCloseTo(100.5);
  });

  it("prefers a corner over the face it sits on", () => {
    expect(snapMeasurePoint({ x: 199.2, y: 101.3 }, on, TOL)!.kind).toBe("corner");
  });

  it("ignores hidden walls", () => {
    expect(snapMeasurePoint({ x: 150, y: 101.6 }, { walls: [wall(horizontal.pointsMm, { hidden: true })], scaleDenominator: 100 }, TOL)).toBeNull();
  });

  it("finds the mitred corner of a run that turns", () => {
    const run = wall([{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }]);
    const outer = snapMeasurePoint({ x: 201.5, y: 98.5 }, { walls: [run], scaleDenominator: 100 }, TOL)!;
    expect(outer.kind).toBe("corner");
    expect(outer.pointMm.x).toBeCloseTo(201);
    expect(outer.pointMm.y).toBeCloseTo(99);
    const inner = snapMeasurePoint({ x: 198.6, y: 101.4 }, { walls: [run], scaleDenominator: 100 }, TOL)!;
    expect(inner.pointMm.x).toBeCloseTo(199);
    expect(inner.pointMm.y).toBeCloseTo(101);
  });

  it("lands on the end of a dimension line", () => {
    const s = snapMeasurePoint(
      { x: 50.9, y: 49.5 },
      { dimensions: [{ id: "d", fromMm: { x: 50, y: 50 }, toMm: { x: 90, y: 50 } }], scaleDenominator: 100 },
      TOL,
    )!;
    expect(s.kind).toBe("corner");
    expect(s.pointMm).toEqual({ x: 50, y: 50 });
  });

  it("holds the horizontal or vertical through the first point", () => {
    const anchor = { x: 20, y: 30 };
    const h = snapMeasurePoint({ x: 80, y: 31.2 }, { scaleDenominator: 100 }, TOL, anchor)!;
    expect(h.kind).toBe("axis");
    expect(h.pointMm).toEqual({ x: 80, y: 30 });
    const v = snapMeasurePoint({ x: 19.1, y: 90 }, { scaleDenominator: 100 }, TOL, anchor)!;
    expect(v.pointMm).toEqual({ x: 20, y: 90 });
    expect(snapMeasurePoint({ x: 80, y: 40 }, { scaleDenominator: 100 }, TOL, anchor)).toBeNull();
  });

  it("measures a clear width square: the face opposite, level with the first point", () => {
    // Two walls facing each other, 50 mm apart on paper between their faces.
    const left = wall([{ x: 100, y: 0 }, { x: 100, y: 200 }]);
    const right = wall([{ x: 152, y: 0 }, { x: 152, y: 200 }], { id: "w2" });
    const targets = { walls: [left, right], scaleDenominator: 100 };
    const first = snapMeasurePoint({ x: 101.7, y: 80 }, targets, TOL)!;
    expect(first.pointMm).toEqual({ x: 101, y: 80 });
    const second = snapMeasurePoint({ x: 150.4, y: 81.1 }, targets, TOL, first.pointMm)!;
    expect(second.kind).toBe("edge");
    expect(second.pointMm.x).toBeCloseTo(151);
    expect(second.pointMm.y).toBeCloseTo(80);
  });
});
