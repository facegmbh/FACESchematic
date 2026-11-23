import { describe, it, expect } from "vitest";
import {
  parseAspect,
  pictureSize,
  throwRangeM,
  evaluateProjection,
  resizeSurface,
  projectionGeometry,
  symbolPositionForDistance,
  maxVerticalShift,
} from "../projection";
import type { FloorplanProjection, ProjectionOptics } from "../types";

/** Epson EB-L610U as published in Epson's throw distance simulator (code H901). */
const L610U: ProjectionOptics = {
  formats: [
    { ratio: "16:10", wide: [2.95848, -3.5728], tele: [4.7743, -3.5078], sizeMin: 50, sizeMax: 500 },
    { ratio: "4:3", wide: [3.34923, -3.5728], tele: [5.40488, -3.5078], sizeMin: 45, sizeMax: 440 },
  ],
  shift: { vMin: -50, vMax: 50, hMin: -20, hMax: 20, hvMin: -12, hvMax: 12 },
  lumens: 6000,
};

/** ELPLL06 long-throw lens on a 0.76" panel. */
const ELPLL06: ProjectionOptics = {
  formats: [{ ratio: "16:10", wide: [11.2814, -18.3553], tele: [15.2059, -18.2552], sizeMin: 50, sizeMax: 300 }],
};

/** Width and height in metres of a diagonal in inches. */
function surface(diagIn: number, aspect: string) {
  const r = parseAspect(aspect);
  const h = (diagIn * 0.0254) / Math.hypot(r, 1);
  return { widthM: h * r, heightM: h };
}

describe("picture size", () => {
  it("reads an aspect ratio", () => {
    expect(parseAspect("16:10")).toBeCloseTo(1.6);
    expect(parseAspect("2.35:1")).toBeCloseTo(2.35);
    expect(parseAspect("nonsense")).toBeCloseTo(1.6);
  });

  it("fills a surface of its own shape", () => {
    const s = surface(100, "16:10");
    const p = pictureSize(s.widthM, s.heightM, "16:10");
    expect(p.widthM).toBeCloseTo(2.154, 3);
    expect(p.heightM).toBeCloseTo(1.346, 3);
    expect(p.diagonalIn).toBeCloseTo(100, 5);
  });

  it("letterboxes into a surface of another shape", () => {
    const p = pictureSize(3, 3, "16:9");
    expect(p.widthM).toBeCloseTo(3);
    expect(p.heightM).toBeCloseTo(1.6875);
    const q = pictureSize(4, 1, "4:3");
    expect(q.heightM).toBeCloseTo(1);
    expect(q.widthM).toBeCloseTo(4 / 3);
  });
});

describe("throw distance", () => {
  it("matches Epson's simulator for the EB-L610U", () => {
    const at = (d: number, a: string) => {
      const s = surface(d, a);
      return throwRangeM(L610U, a, pictureSize(s.widthM, s.heightM, a))!;
    };
    expect(at(80, "16:10").minM).toBeCloseTo(2.331, 3);
    expect(at(80, "16:10").maxM).toBeCloseTo(3.784, 3);
    expect(at(100, "16:10").minM).toBeCloseTo(2.923, 3);
    expect(at(100, "16:10").maxM).toBeCloseTo(4.739, 3);
    expect(at(150, "16:10").maxM).toBeCloseTo(7.126, 3);
    expect(at(100, "4:3").minM).toBeCloseTo(3.3135, 3);
    expect(at(100, "4:3").maxM).toBeCloseTo(5.37, 3);
  });

  it("matches for an interchangeable lens", () => {
    const s = surface(200, "16:10");
    const r = throwRangeM(ELPLL06, "16:10", pictureSize(s.widthM, s.heightM, "16:10"))!;
    expect(r.minM).toBeCloseTo(22.379, 2);
    expect(r.maxM).toBeCloseTo(30.229, 2);
  });

  it("uses a typed throw ratio when there is no manufacturer data", () => {
    const r = throwRangeM({ throwMin: 1.5, throwMax: 2 }, "16:9", pictureSize(3, 1.6875, "16:9"))!;
    expect(r.minM).toBeCloseTo(4.5);
    expect(r.maxM).toBeCloseTo(6);
  });

  it("falls back to the lens's first format for a ratio it does not list", () => {
    // Same picture width → roughly the same distance, whatever the height.
    const r = throwRangeM(ELPLL06, "16:9", pictureSize(4.308, 4.308 / (16 / 9), "16:9"))!;
    expect(r.minM).toBeCloseTo(22.38, 1);
  });

  it("has no range without optics", () => {
    expect(throwRangeM({}, "16:10", pictureSize(2, 1.25, "16:10"))).toBeNull();
  });
});

describe("evaluating a setup", () => {
  const s100 = surface(100, "16:10");
  const base = { optics: L610U, aspect: "16:10", ...s100, lateralM: 0 };

  it("turns the distance into zoom", () => {
    expect(evaluateProjection({ ...base, distanceM: 2.923 }).zoom).toBeCloseTo(0, 2);
    expect(evaluateProjection({ ...base, distanceM: 4.739 }).zoom).toBeCloseTo(1, 2);
    const mid = evaluateProjection({ ...base, distanceM: (2.923 + 4.739) / 2 });
    expect(mid.zoom).toBeCloseTo(0.5, 2);
    expect(mid.issues).toEqual([]);
  });

  it("says by how much the projector is too near or too far", () => {
    const near = evaluateProjection({ ...base, distanceM: 2.5 });
    expect(near.issues).toHaveLength(1);
    expect(near.issues[0].kind).toBe("too-near");
    expect(near.issues[0].byM).toBeCloseTo(0.423, 2);
    const far = evaluateProjection({ ...base, distanceM: 6 });
    expect(far.issues[0].kind).toBe("too-far");
    expect(far.issues[0].byM).toBeCloseTo(1.261, 2);
  });

  it("flags a projector behind the surface", () => {
    expect(evaluateProjection({ ...base, distanceM: -1 }).issues[0].kind).toBe("behind");
  });

  it("flags a picture the lens cannot focus", () => {
    const tiny = surface(30, "16:10");
    expect(evaluateProjection({ ...base, ...tiny, distanceM: 1 }).issues.map((i) => i.kind)).toContain("too-small");
    const huge = surface(600, "16:10");
    expect(evaluateProjection({ ...base, ...huge, distanceM: 20 }).issues.map((i) => i.kind)).toContain("too-large");
  });

  it("turns a sideways offset into horizontal shift", () => {
    const w = s100.widthM;
    const ok = evaluateProjection({ ...base, distanceM: 3.5, lateralM: 0.1 * w });
    expect(ok.shiftH).toBeCloseTo(10);
    expect(ok.issues).toEqual([]);
    const off = evaluateProjection({ ...base, distanceM: 3.5, lateralM: -0.34 * w });
    expect(off.shiftH).toBeCloseTo(-34);
    expect(off.issues[0]).toMatchObject({ kind: "shift-h", limit: 20 });
  });

  it("wants a lens without shift on the picture's centre line", () => {
    const fixed = { ...base, optics: { ...L610U, shift: undefined } };
    expect(evaluateProjection({ ...fixed, distanceM: 3.5, lateralM: 0 }).issues).toEqual([]);
    expect(evaluateProjection({ ...fixed, distanceM: 3.5, lateralM: 0.3 }).issues[0].kind).toBe("shift-h");
  });

  it("tapers the vertical shift as the picture moves sideways", () => {
    const sh = L610U.shift!;
    expect(maxVerticalShift(sh, 0)).toEqual({ min: -50, max: 50 });
    expect(maxVerticalShift(sh, 20)).toEqual({ min: -12, max: 12 });
    expect(maxVerticalShift(sh, -10).max).toBeCloseTo(31);
  });

  it("checks vertical shift once both heights are known", () => {
    const h = s100.heightM;
    // Lens level with the picture's lower edge → picture sits half its height above the axis.
    const ok = evaluateProjection({ ...base, distanceM: 3.5, screenBottomM: 1, lensHeightM: 1 });
    expect(ok.shiftV).toBeCloseTo(50);
    expect(ok.issues).toEqual([]);
    const high = evaluateProjection({ ...base, distanceM: 3.5, screenBottomM: 1, lensHeightM: 1 + 2 * h });
    expect(high.shiftV).toBeCloseTo(-150);
    expect(high.issues[0]).toMatchObject({ kind: "shift-v", limit: 50 });
    expect(ok.lensHeightRangeM!.min).toBeCloseTo(1);
    expect(ok.lensHeightRangeM!.max).toBeCloseTo(1 + h);
    expect(evaluateProjection({ ...base, distanceM: 3.5 }).shiftV).toBeUndefined();
  });

  it("spells out the brightness", () => {
    const e = evaluateProjection({ ...base, distanceM: 3.5 });
    expect(e.areaM2).toBeCloseTo(2.9, 2);
    expect(e.lux).toBeCloseTo(6000 / e.areaM2, 5);
    expect(evaluateProjection({ ...base, distanceM: 3.5, screenGain: 1.2 }).lux).toBeCloseTo((6000 * 1.2) / e.areaM2, 5);
    expect(evaluateProjection({ ...base, optics: ELPLL06, distanceM: 10 }).lux).toBeUndefined();
  });
});

describe("pinning width and height", () => {
  const p = { aspect: "16:10", widthM: 3.2, heightM: 2 };

  it("keeps the shape while nothing is pinned", () => {
    expect(resizeSurface(p, { widthM: 4 })).toMatchObject({ widthM: 4, heightM: 2.5 });
    expect(resizeSurface(p, { heightM: 1 })).toMatchObject({ widthM: 1.6, heightM: 1 });
    expect(resizeSurface(p, { diagonalIn: 100 }).widthM).toBeCloseTo(2.154, 3);
  });

  it("leaves a pinned side alone", () => {
    expect(resizeSurface({ ...p, lockHeight: true }, { widthM: 4 })).toMatchObject({ widthM: 4, heightM: 2 });
    expect(resizeSurface({ ...p, lockWidth: true }, { heightM: 1 })).toMatchObject({ widthM: 3.2, heightM: 1 });
  });

  it("re-shapes the free side when the aspect ratio changes", () => {
    const wide = resizeSurface(p, { aspect: "16:9" });
    expect(wide).toMatchObject({ aspect: "16:9", widthM: 3.2 });
    expect(wide.heightM).toBeCloseTo(1.8);
    expect(resizeSurface({ ...p, lockHeight: true }, { aspect: "4:3" }).widthM).toBeCloseTo(2 * (4 / 3));
    expect(resizeSurface({ ...p, lockWidth: true, lockHeight: true }, { aspect: "4:3" })).toMatchObject({ widthM: 3.2, heightM: 2 });
  });
});

describe("on the sheet", () => {
  /** 1:50 — a metre is 20 paper mm. */
  const scale = 50;
  const proj: FloorplanProjection = {
    id: "fpproj-1",
    symbolId: "s1",
    optics: L610U,
    aspect: "16:10",
    ...surface(100, "16:10"),
    screenCenterMm: { x: 200, y: 100 },
    // Faces left: the projector stands to the left of it.
    screenRotationDeg: 180,
  };

  it("measures distance and offset from the symbol", () => {
    const g = projectionGeometry(proj, { x: 130, y: 104 }, scale);
    expect(g.distanceM).toBeCloseTo(3.5);
    expect(Math.abs(g.lateralM)).toBeCloseTo(0.2);
    // The picture's ends lie on the surface, half a width either side of its middle.
    expect(g.pictureMm[0].x).toBeCloseTo(200);
    expect(g.pictureMm[1].x).toBeCloseTo(200);
    expect(Math.abs(g.pictureMm[0].y - g.pictureMm[1].y)).toBeCloseTo(2.154 * 20, 1);
    // The band of allowed positions runs along the lens's own line.
    expect(g.bandMm![0].x).toBeCloseTo(200 - 2.923 * 20, 1);
    expect(g.bandMm![1].x).toBeCloseTo(200 - 4.739 * 20, 1);
    expect(g.bandMm![0].y).toBeCloseTo(104);
  });

  it("moves the symbol along its line for a new distance", () => {
    const at = symbolPositionForDistance(proj, { x: 130, y: 104 }, 4, scale);
    expect(at.x).toBeCloseTo(120);
    expect(at.y).toBeCloseTo(104);
    expect(projectionGeometry(proj, at, scale).distanceM).toBeCloseTo(4);
  });

  it("works for a surface at an angle", () => {
    const turned = { ...proj, screenRotationDeg: 90 };
    // Faces down the sheet: the projector stands below it.
    const g = projectionGeometry(turned, { x: 200, y: 160 }, scale);
    expect(g.distanceM).toBeCloseTo(3);
    expect(g.lateralM).toBeCloseTo(0);
  });
});
