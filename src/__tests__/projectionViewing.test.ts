import { describe, it, expect } from "vitest";
import {
  viewingLimits,
  farEdgeDistanceM,
  sideLimitM,
  rateSeat,
  requiredPictureHeightM,
  audienceCornersM,
  evaluateViewing,
  audienceOutlineMm,
  audienceTurnHandleMm,
  resizeAudienceFromCorner,
  defaultAudienceFor,
  viewingAreaOutlineMm,
  viewingPatchesMm,
  AUDIENCE_MIN_SIDE_M,
  type AudienceRect,
} from "../projectionViewing";

/** 100″ in 16:10, as in the spec's examples. */
const W = 2.16;
const H = 1.35;

describe("viewing limits", () => {
  it("BDM: farthest viewer is picture height × 200 × element height", () => {
    const l = viewingLimits({ pictureHeightM: H, settings: { task: "bdm", elementPct: 3 } });
    expect(l.farthestM).toBeCloseTo(8.1, 6);
    expect(l.viewingRatio).toBeCloseTo(6, 6);
  });

  it("BDM defaults to 3 % element height", () => {
    expect(viewingLimits({ pictureHeightM: H, settings: { task: "bdm" } }).farthestM).toBeCloseTo(8.1, 6);
  });

  it("ADM: farthest viewer is picture height × 3438 ÷ vertical pixels", () => {
    const l = viewingLimits({ pictureHeightM: H, settings: { task: "adm", pixelsV: 1200 } });
    expect(l.farthestM).toBeCloseTo(3.86775, 5);
  });

  it("ADM without a pixel count claims no farthest viewer", () => {
    expect(viewingLimits({ pictureHeightM: H, settings: { task: "adm" } }).farthestM).toBeNull();
  });

  it("closest viewer looks up 30° to the picture's upper edge", () => {
    const l = viewingLimits({
      pictureHeightM: H,
      screenBottomM: 1.0,
      settings: { task: "bdm", eyeHeightM: 1.2 },
    });
    // Viewing factor 1.35 + (1.00 − 1.20) = 1.15 m.
    expect(l.closestM).toBeCloseTo(1.15 * 1.732, 6);
  });

  it("eye height defaults to 1.20 m, seated", () => {
    const l = viewingLimits({ pictureHeightM: H, screenBottomM: 1.0, settings: { task: "bdm" } });
    expect(l.closestM).toBeCloseTo(1.15 * 1.732, 6);
  });

  it("no closest viewer without the picture's lower edge", () => {
    expect(viewingLimits({ pictureHeightM: H, settings: { task: "bdm" } }).closestM).toBeNull();
  });

  it("no closest viewer when the viewing factor is under half the picture height", () => {
    // Lower edge 0.40 m, eyes 1.20 m → factor 0.55 m < 0.675 m.
    const l = viewingLimits({ pictureHeightM: H, screenBottomM: 0.4, settings: { task: "bdm" } });
    expect(l.closestM).toBeNull();
  });

  it("ADM has no closest viewer, as in AVIXA's calculator", () => {
    const l = viewingLimits({
      pictureHeightM: H,
      screenBottomM: 1.0,
      settings: { task: "adm", pixelsV: 1200 },
    });
    expect(l.closestM).toBeNull();
  });
});

describe("one seat", () => {
  it("distance is measured to the picture's farther edge", () => {
    expect(farEdgeDistanceM(4, 0, 2)).toBeCloseTo(Math.hypot(4, 1), 9);
    expect(farEdgeDistanceM(4, 3, 2)).toBeCloseTo(Math.hypot(4, 4), 9);
    expect(farEdgeDistanceM(4, -3, 2)).toBeCloseTo(Math.hypot(4, 4), 9);
  });

  it("side limit: 60° from the far edge", () => {
    expect(sideLimitM(3, 2.15)).toBeCloseTo(1.732 * 3 - 1.075, 6);
    // Right at the picture the area is narrower than the picture: nothing fits.
    expect(sideLimitM(0.3, 2.15)).toBeLessThan(0);
  });

  const limits = { farthestM: 8.1, closestM: 2, viewingRatio: 6 };

  it("rates a seat in the middle as good", () => {
    expect(rateSeat(4, 0, W, limits)).toBe("good");
  });

  it("rates the last fifth before the limit as marginal", () => {
    // 80 % of 8.1 m is 6.48 m.
    expect(rateSeat(7, 0, W, limits)).toBe("marginal");
    expect(rateSeat(6.2, 0, W, limits)).toBe("good");
  });

  it("rates beyond the limit as too far", () => {
    expect(rateSeat(8.2, 0, W, limits)).toBe("too-far");
  });

  it("a seat exactly on the limit is not too far", () => {
    const d = Math.sqrt(8.1 ** 2 - (W / 2) ** 2);
    expect(rateSeat(d, 0, W, limits)).toBe("marginal");
  });

  it("rates in front of the closest viewer as too near", () => {
    expect(rateSeat(1.5, 0, W, limits)).toBe("too-near");
  });

  it("rates outside the 60° lines as too oblique", () => {
    // At 3 m the area reaches 1.732 × 3 − 1.08 = 4.12 m to the side.
    expect(rateSeat(3, 4.5, W, limits)).toBe("too-oblique");
    expect(rateSeat(3, -4.5, W, limits)).toBe("too-oblique");
  });

  it("rates an angle past 80 % of 60° as marginal", () => {
    // 48° to the far edge at 3 m: |x| + 1.08 = 3 × tan 48° = 3.33.
    expect(rateSeat(3, 2.4, W, limits)).toBe("marginal");
    expect(rateSeat(3, 2.0, W, limits)).toBe("good");
  });

  it("rates a seat behind the picture plane as behind", () => {
    expect(rateSeat(0, 0, W, limits)).toBe("behind");
    expect(rateSeat(-1, 0, W, limits)).toBe("behind");
  });

  it("without limits only the angle counts", () => {
    const none = { farthestM: null, closestM: null, viewingRatio: null };
    expect(rateSeat(30, 0, W, none)).toBe("good");
    expect(rateSeat(1, 5, W, none)).toBe("too-oblique");
  });
});

describe("picture height a seat needs", () => {
  it("on the axis it returns the height whose far edge distance is exactly the limit", () => {
    const h = requiredPictureHeightM(9.4, 0, 1.6, 6)!;
    expect(farEdgeDistanceM(9.4, 0, h * 1.6) / h).toBeCloseTo(6, 6);
  });

  it("off the axis as well", () => {
    const h = requiredPictureHeightM(7, 3, 1.6, 6)!;
    expect(farEdgeDistanceM(7, 3, h * 1.6) / h).toBeCloseTo(6, 6);
  });

  it("is undefined when no height can satisfy the ratio", () => {
    // Ratio 0.5 with a 16:10 picture: half the width alone is 0.8 heights away.
    expect(requiredPictureHeightM(3, 0, 1.6, 0.5)).toBeNull();
  });
});

describe("audience rectangle", () => {
  /** Scale 1:100, so 10 mm on the sheet is one metre. The picture faces right. */
  const screen = { screenCenterMm: { x: 100, y: 100 }, screenRotationDeg: 0 };
  const scale = 100;

  it("turns the rectangle into seats in front of and beside the picture", () => {
    // 4 m wide, 6 m deep, its middle 5 m in front of the picture.
    const rect: AudienceRect = { centerMm: { x: 150, y: 100 }, widthM: 4, depthM: 6, rotationDeg: 0 };
    const c = audienceCornersM(rect, screen, scale);
    expect(c.map((p) => p.d).sort((a, b) => a - b)).toEqual([2, 2, 8, 8].map((v) => expect.closeTo(v, 6)));
    expect(c.map((p) => p.x).sort((a, b) => a - b)).toEqual([-2, -2, 2, 2].map((v) => expect.closeTo(v, 6)));
  });

  it("follows a turned picture", () => {
    // Picture faces down the sheet; the rectangle 5 m in front of it, shifted 1 m sideways.
    const turned = { screenCenterMm: { x: 100, y: 100 }, screenRotationDeg: 90 };
    const rect: AudienceRect = { centerMm: { x: 90, y: 150 }, widthM: 2, depthM: 2, rotationDeg: 90 };
    const c = audienceCornersM(rect, turned, scale);
    expect(Math.min(...c.map((p) => p.d))).toBeCloseTo(4, 6);
    expect(Math.max(...c.map((p) => p.d))).toBeCloseTo(6, 6);
    expect(Math.min(...c.map((p) => p.x))).toBeCloseTo(0, 6);
    expect(Math.max(...c.map((p) => p.x))).toBeCloseTo(2, 6);
  });

  it("a rectangle turned against the picture reaches farther at one corner", () => {
    const rect: AudienceRect = { centerMm: { x: 150, y: 100 }, widthM: 4, depthM: 4, rotationDeg: 45 };
    const c = audienceCornersM(rect, screen, scale);
    expect(Math.max(...c.map((p) => p.d))).toBeCloseTo(5 + Math.SQRT2 * 2, 6);
    expect(Math.min(...c.map((p) => p.d))).toBeCloseTo(5 - Math.SQRT2 * 2, 6);
  });

  const base = {
    pictureWidthM: W,
    pictureHeightM: H,
    screenBottomM: 1.0,
    settings: { task: "bdm" as const, elementPct: 3 },
    ...screen,
    scaleDenominator: scale,
  };

  it("without a rectangle reports the limits only", () => {
    const r = evaluateViewing(base);
    expect(r.limits.farthestM).toBeCloseTo(8.1, 6);
    expect(r.zone).toBeNull();
    expect(r.issues).toEqual([]);
    expect(r.requiredHeightM).toBeUndefined();
  });

  it("a rectangle inside the recommendation raises nothing", () => {
    const audience: AudienceRect = { centerMm: { x: 150, y: 100 }, widthM: 4, depthM: 4, rotationDeg: 0 };
    const r = evaluateViewing({ ...base, audience });
    expect(r.zone!.nearestM).toBeCloseTo(3, 6);
    expect(r.zone!.farthestM).toBeCloseTo(Math.hypot(7, 2 + W / 2), 6);
    expect(r.zone!.maxAngleDeg).toBeCloseTo((Math.atan((2 + W / 2) / 3) * 180) / Math.PI, 6);
    expect(r.issues).toEqual([]);
    expect(r.requiredHeightM).toBeUndefined();
  });

  it("a last row too far back says by how much and what picture height it needs", () => {
    const audience: AudienceRect = { centerMm: { x: 160, y: 100 }, widthM: 4, depthM: 7, rotationDeg: 0 };
    const r = evaluateViewing({ ...base, audience });
    const far = Math.hypot(9.5, 2 + W / 2);
    expect(r.zone!.farthestM).toBeCloseTo(far, 6);
    expect(r.issues).toEqual([{ kind: "too-far", byM: expect.closeTo(far - 8.1, 6) }]);
    const h = r.requiredHeightM!;
    expect(h).toBeGreaterThan(H);
    expect(farEdgeDistanceM(9.5, 2, h * (W / H)) / h).toBeCloseTo(6, 6);
  });

  it("a front row too close says by how much", () => {
    const audience: AudienceRect = { centerMm: { x: 130, y: 100 }, widthM: 1, depthM: 3, rotationDeg: 0 };
    const r = evaluateViewing({ ...base, audience });
    expect(r.zone!.nearestM).toBeCloseTo(1.5, 6);
    expect(r.issues).toEqual([{ kind: "too-near", byM: expect.closeTo(1.15 * 1.732 - 1.5, 6) }]);
  });

  it("a wide front row is too oblique", () => {
    const audience: AudienceRect = { centerMm: { x: 140, y: 100 }, widthM: 12, depthM: 3, rotationDeg: 0 };
    const r = evaluateViewing({ ...base, audience });
    expect(r.issues.map((i) => i.kind)).toContain("too-oblique");
    const oblique = r.issues.find((i) => i.kind === "too-oblique")!;
    expect(oblique.deg).toBeCloseTo((Math.atan((6 + W / 2) / 2.5) * 180) / Math.PI, 6);
  });

  it("a rectangle reaching behind the picture is reported as behind, nothing else", () => {
    const audience: AudienceRect = { centerMm: { x: 105, y: 100 }, widthM: 2, depthM: 2, rotationDeg: 0 };
    const r = evaluateViewing({ ...base, audience });
    expect(r.issues).toEqual([{ kind: "behind" }]);
  });
});

describe("audience rectangle on the sheet", () => {
  const scale = 100;
  const rect: AudienceRect = { centerMm: { x: 150, y: 100 }, widthM: 4, depthM: 6, rotationDeg: 0 };

  it("outline goes round, far side last", () => {
    expect(audienceOutlineMm(rect, scale)).toEqual([
      { x: expect.closeTo(120, 6), y: expect.closeTo(80, 6) },
      { x: expect.closeTo(120, 6), y: expect.closeTo(120, 6) },
      { x: expect.closeTo(180, 6), y: expect.closeTo(120, 6) },
      { x: expect.closeTo(180, 6), y: expect.closeTo(80, 6) },
    ]);
  });

  it("dragging a corner keeps the opposite one in place", () => {
    const before = audienceOutlineMm(rect, scale);
    const next = resizeAudienceFromCorner(rect, 2, { x: 200, y: 130 }, scale);
    const after = audienceOutlineMm(next, scale);
    expect(after[0].x).toBeCloseTo(before[0].x, 6);
    expect(after[0].y).toBeCloseTo(before[0].y, 6);
    expect(after[2].x).toBeCloseTo(200, 6);
    expect(after[2].y).toBeCloseTo(130, 6);
    expect(next.depthM).toBeCloseTo(8, 6);
    expect(next.widthM).toBeCloseTo(5, 6);
  });

  it("works on a turned rectangle", () => {
    const turned: AudienceRect = { ...rect, rotationDeg: 30 };
    const before = audienceOutlineMm(turned, scale);
    const next = resizeAudienceFromCorner(turned, 1, { x: 140, y: 150 }, scale);
    const after = audienceOutlineMm(next, scale);
    expect(after[3].x).toBeCloseTo(before[3].x, 6);
    expect(after[3].y).toBeCloseTo(before[3].y, 6);
    expect(after[1].x).toBeCloseTo(140, 6);
    expect(after[1].y).toBeCloseTo(150, 6);
    expect(next.rotationDeg).toBe(30);
  });

  it("cannot be pulled inside out or smaller than half a metre", () => {
    const next = resizeAudienceFromCorner(rect, 2, { x: 100, y: 60 }, scale);
    expect(next.widthM).toBeCloseTo(AUDIENCE_MIN_SIDE_M, 6);
    expect(next.depthM).toBeCloseTo(AUDIENCE_MIN_SIDE_M, 6);
    const after = audienceOutlineMm(next, scale);
    expect(after[0].x).toBeCloseTo(120, 6);
    expect(after[0].y).toBeCloseTo(80, 6);
  });

  it("the turn handle sits beyond the far side", () => {
    expect(audienceTurnHandleMm(rect, scale, 5)).toEqual({ x: expect.closeTo(185, 6), y: expect.closeTo(100, 6) });
  });

  const screen = { screenCenterMm: { x: 100, y: 100 }, screenRotationDeg: 0 };
  const picture = { pictureWidthM: W, pictureHeightM: H, ...screen };

  it("a new area is parallel to the picture and inside the recommendation", () => {
    const limits = viewingLimits({ pictureHeightM: H, screenBottomM: 1.0, settings: { task: "bdm" } });
    const audience = defaultAudienceFor(picture, limits, scale);
    expect(audience.rotationDeg).toBe(0);
    const r = evaluateViewing({ ...picture, screenBottomM: 1.0, settings: { task: "bdm" }, audience, scaleDenominator: scale });
    expect(r.issues).toEqual([]);
    expect(r.zone!.nearestM).toBeCloseTo(1.5 * H, 6);
  });

  it("a new area still has a size without a farthest viewer", () => {
    const limits = viewingLimits({ pictureHeightM: H, settings: { task: "adm" } });
    const audience = defaultAudienceFor(picture, limits, scale);
    expect(audience.depthM).toBeCloseTo(4, 6);
    expect(audience.widthM).toBeGreaterThan(0);
  });

  it("the recommended area's outline lies exactly on the limits", () => {
    const limits = viewingLimits({ pictureHeightM: H, screenBottomM: 1.0, settings: { task: "bdm" } });
    const outline = viewingAreaOutlineMm(limits, W, screen, scale)!;
    // Back to seats: 10 mm per metre, picture facing right, so d runs along x.
    const seats = outline.map((p) => ({ d: (p.x - 100) / 10, x: (p.y - 100) / 10 }));
    for (const s of seats) {
      expect(s.d).toBeGreaterThanOrEqual(limits.closestM! - 1e-6);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(sideLimitM(s.d, W) + 1e-6);
      expect(farEdgeDistanceM(s.d, s.x, W)).toBeLessThanOrEqual(limits.farthestM! + 1e-6);
    }
    // The near line sits at the closest viewer, the arc reaches the farthest one.
    expect(Math.min(...seats.map((s) => s.d))).toBeCloseTo(limits.closestM!, 6);
    expect(Math.max(...seats.map((s) => farEdgeDistanceM(s.d, s.x, W)))).toBeCloseTo(limits.farthestM!, 6);
  });

  it("no outline without a farthest viewer", () => {
    const limits = viewingLimits({ pictureHeightM: H, settings: { task: "adm" } });
    expect(viewingAreaOutlineMm(limits, W, screen, scale)).toBeNull();
  });

  it("no outline when the closest viewer is already beyond the farthest", () => {
    expect(viewingAreaOutlineMm({ farthestM: 2, closestM: 3, viewingRatio: 1.5 }, W, screen, scale)).toBeNull();
  });
});

describe("heatmap of the audience area", () => {
  const scale = 100;
  const screen = { screenCenterMm: { x: 100, y: 100 }, screenRotationDeg: 0 };
  const limits = { farthestM: 8.1, closestM: 2, viewingRatio: 6 };
  /** Shoelace area of a patch, m². */
  const areaM2 = (mm: { x: number; y: number }[]) => {
    let a = 0;
    for (let i = 0; i < mm.length; i++) {
      const p = mm[i], q = mm[(i + 1) % mm.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2 / 100;
  };

  it("an area that is good throughout is one patch", () => {
    const rect: AudienceRect = { centerMm: { x: 145, y: 100 }, widthM: 2, depthM: 3, rotationDeg: 0 };
    const patches = viewingPatchesMm(rect, W, limits, screen, scale);
    expect(patches).toHaveLength(1);
    expect(patches[0].rating).toBe("good");
    expect(areaM2(patches[0].mm)).toBeCloseTo(6, 6);
  });

  it("an area across every limit shows each rating and still covers the rectangle", () => {
    // From 1 m to 11 m in front of the picture, 12 m wide.
    const rect: AudienceRect = { centerMm: { x: 160, y: 100 }, widthM: 12, depthM: 10, rotationDeg: 0 };
    const patches = viewingPatchesMm(rect, W, limits, screen, scale);
    const ratings = new Set(patches.map((p) => p.rating));
    for (const r of ["good", "marginal", "too-far", "too-near", "too-oblique"]) expect(ratings).toContain(r);
    expect(patches.reduce((sum, p) => sum + areaM2(p.mm), 0)).toBeCloseTo(120, 6);
    // Joined, not a raster: far fewer patches than the 100 × 120 cells sampled.
    expect(patches.length).toBeLessThan(1500);
  });

  it("each patch is rated like the seat in its middle", () => {
    const rect: AudienceRect = { centerMm: { x: 160, y: 100 }, widthM: 6, depthM: 10, rotationDeg: 0 };
    for (const p of viewingPatchesMm(rect, W, limits, screen, scale)) {
      // Patches are rows of cells; a seat in the first row's middle has the patch's rating.
      const mid = { x: (p.mm[0].x + p.mm[1].x) / 2, y: (p.mm[0].y + p.mm[1].y) / 2 };
      const d = (mid.x - 100) / 10 + 0.05;
      const x = (mid.y - 100) / 10;
      const cellsWide = Math.round(Math.abs(p.mm[1].y - p.mm[0].y));
      // Only patches an odd number of cells wide have a cell centre in their middle.
      if (cellsWide % 2 === 1) expect(rateSeat(d, x, W, limits)).toBe(p.rating);
    }
  });

  it("a turned area keeps its size", () => {
    const rect: AudienceRect = { centerMm: { x: 160, y: 100 }, widthM: 5, depthM: 7, rotationDeg: 25 };
    const patches = viewingPatchesMm(rect, W, limits, screen, scale);
    expect(patches.reduce((sum, p) => sum + areaM2(p.mm), 0)).toBeCloseTo(35, 6);
  });

  it("the part behind the picture is rated behind", () => {
    const rect: AudienceRect = { centerMm: { x: 100, y: 100 }, widthM: 2, depthM: 2, rotationDeg: 0 };
    const patches = viewingPatchesMm(rect, W, { farthestM: 8.1, closestM: null, viewingRatio: 6 }, screen, scale);
    const behind = patches.filter((p) => p.rating === "behind");
    expect(behind.reduce((sum, p) => sum + areaM2(p.mm), 0)).toBeCloseTo(2, 6);
  });

  it("a very large area is sampled coarser, not without end", () => {
    const rect: AudienceRect = { centerMm: { x: 400, y: 100 }, widthM: 60, depthM: 60, rotationDeg: 0 };
    const patches = viewingPatchesMm(rect, W, limits, screen, scale);
    expect(patches.reduce((sum, p) => sum + areaM2(p.mm), 0)).toBeCloseTo(3600, 4);
    expect(patches.length).toBeLessThan(2000);
  });

  it("an area without size has no patches", () => {
    expect(viewingPatchesMm({ centerMm: { x: 0, y: 0 }, widthM: 0, depthM: 3, rotationDeg: 0 }, W, limits, screen, scale)).toEqual([]);
  });
});
