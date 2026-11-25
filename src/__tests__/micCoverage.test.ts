/**
 * A ceiling microphone's coverage: the maker's area under it, and how much of that area a
 * talker can still be heard in once the mounting height is taken off the talker distance.
 */
import { describe, it, expect } from "vitest";
import {
  clampMicSideM,
  clipToConvex,
  coverageLabelAnchorMm,
  coverageLabelOf,
  coveragePointsOnSheet,
  defaultCoverageForDevice,
  formatCoverageSpec,
  micCoverageFor,
  micCoverageIssues,
  micReachM,
  micReachOnSheet,
  nextMicCoverage,
  polygonArea,
} from "../floorplan";
import { templates as audio } from "../devices/audio";
import { micCoverageSpecFor } from "../micCoverageData";
import type { FloorplanCoverage, FloorplanPage, MicCoverageSpec } from "../types";

const MXA920 = audio.find((t) => t.modelNumber === "MXA920")!.micCoverage!;
const MXA901 = audio.find((t) => t.modelNumber === "MXA901")!.micCoverage!;
const MXA902 = audio.find((t) => t.modelNumber === "MXA902")!.micCoverage!;

/** 1:100 — one metre is 10 mm on paper. */
function pageWith(coverages: FloorplanCoverage[]): Pick<FloorplanPage, "symbols" | "scaleDenominator" | "coverages"> {
  return {
    scaleDenominator: 100,
    symbols: [{ id: "s1", groupId: "g", positionMm: { x: 200, y: 150 }, label: "M1" }] as FloorplanPage["symbols"],
    coverages,
  };
}
const area = (spec: MicCoverageSpec, extra: Partial<FloorplanCoverage> = {}): FloorplanCoverage =>
  ({ id: "c1", ...micCoverageFor(spec), symbolId: "s1", ...extra });

describe("the maker's figures", () => {
  it("MXA920: 9 × 9 m, eight areas, talkers up to 4.9 m, mounted up to 3.7 m", () => {
    expect(MXA920).toMatchObject({ areaM: { w: 9, d: 9 }, maxAreas: 8, maxTalkerDistanceM: 4.9, maxMountHeightM: 3.7, dedicatedAreaM: { w: 2, d: 2 } });
  });
  it("MXA901 can be narrowed to 3 m, MXA902 is fixed, neither states a talker distance", () => {
    expect(MXA901).toMatchObject({ areaM: { w: 6.1, d: 6.1 }, minSideM: 3 });
    expect(MXA902.fixed).toBe(true);
    expect(MXA901.maxTalkerDistanceM).toBeUndefined();
    expect(MXA902.maxTalkerDistanceM).toBeUndefined();
  });
});

describe("a microphone from the shared library", () => {
  it("is known by its model, however the name is written", () => {
    expect(micCoverageSpecFor({ label: "MXA 920 Ceiling Array Microphone" })).toBe(MXA920);
    expect(micCoverageSpecFor({ label: "Deckenmikrofon", modelNumber: "MXA920W-S" })).toBe(MXA920);
    expect(micCoverageSpecFor({ label: "Shure MXA925" })).toBe(MXA920);
    expect(micCoverageSpecFor({ label: "MXA-901" })).toBe(MXA901);
    expect(micCoverageSpecFor({ label: "Shure MXA710" })).toBeUndefined();
    expect(micCoverageSpecFor(undefined)).toBeUndefined();
  });
  it("its areas do not repeat the device's number", () => {
    const c = area(MXA920);
    expect(coverageLabelOf(c, pageWith([c]).symbols)).toBe("");
    expect(coverageLabelOf({ ...c, label: "Podium", ownLabel: true }, pageWith([c]).symbols)).toBe("Podium");
  });
});

describe("the area under the microphone", () => {
  it("is a box of the maker's size, centred on the device", () => {
    const c = area(MXA920);
    expect(c.shape).toBe("box");
    const pts = coveragePointsOnSheet(c, pageWith([c]));
    // 9 m at 1:100 is 90 mm: 45 mm either side of the symbol at 200 / 150.
    expect(pts.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([[155, 105], [245, 105], [245, 195], [155, 195]]);
    expect(formatCoverageSpec(c)).toBe("9.0 × 9.0 m · H 2.7 m");
  });

  it("comes from the template, whatever the device type says", () => {
    expect(defaultCoverageForDevice("wired-mic", { mic: MXA901 })).toMatchObject({ shape: "box", rangeM: 6.1, widthM: 6.1 });
    expect(defaultCoverageForDevice("wired-mic").shape).toBe("sector");
  });

  it("is shifted in metres on site and turns with the device", () => {
    const c = area(MXA920, { rangeM: 2, widthM: 2, offsetM: { x: 3, y: 0 } });
    const page = pageWith([c]);
    const straight = coveragePointsOnSheet(c, page);
    expect(Math.round(straight[0].x)).toBe(220); // 200 + 30 − 10
    page.symbols[0].rotationDeg = 90;
    const turned = coveragePointsOnSheet(c, page);
    // Along +x before, along +y after a quarter turn clockwise.
    expect(turned.every((p) => p.y >= 170 - 1e-6 && p.y <= 190 + 1e-6)).toBe(true);
    // The caption sits past the far edge of the shifted box, not at the device.
    expect(coverageLabelAnchorMm(c, page).y).toBeCloseTo(150 + 30 + 10 + 2, 5);
  });

  it("keeps a side within what the device can be set to", () => {
    const mic = area(MXA901).mic;
    expect(clampMicSideM(mic, 1)).toBe(3);
    expect(clampMicSideM(mic, 8)).toBe(6.1);
    expect(clampMicSideM(area(MXA920).mic, 12)).toBe(12);
    expect(area(MXA902).mic?.fixed).toBe(true);
  });
});

describe("how far out a talker may sit", () => {
  it("is what the height leaves of the talker distance", () => {
    // 2.7 m ceiling, mouth at 1.2 m: 1.5 m up, √(4.9² − 1.5²) = 4.66 m along the floor.
    expect(micReachM({ mountHeightM: 2.7, maxTalkerDistanceM: 4.9 })).toBeCloseTo(4.665, 2);
    // At the 3.7 m limit: 2.5 m up, 4.21 m left.
    expect(micReachM({ mountHeightM: 3.7, maxTalkerDistanceM: 4.9 })).toBeCloseTo(4.214, 2);
    // A standing talker is nearer the microphone.
    expect(micReachM({ mountHeightM: 3.7, talkerHeightM: 1.6, maxTalkerDistanceM: 4.9 })).toBeCloseTo(4.427, 2);
  });
  it("is nothing when the microphone hangs out of range, and unknown without a figure", () => {
    expect(micReachM({ mountHeightM: 6.5, maxTalkerDistanceM: 4.9 })).toBe(0);
    expect(micReachM({ mountHeightM: 2.7 })).toBeNull();
  });
});

describe("the area against the reach", () => {
  it("clips a polygon to a convex one, whichever way it winds", () => {
    const square = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    const other = [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }];
    expect(polygonArea(clipToConvex(other, square))).toBeCloseTo(1, 9);
    expect(polygonArea(clipToConvex(other, [...square].reverse()))).toBeCloseTo(1, 9);
    expect(clipToConvex([{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }], square)).toEqual([]);
  });

  it("a 9 × 9 m area at 2.7 m: the corners are out of reach", () => {
    const c = area(MXA920);
    const reach = micReachOnSheet(c, pageWith([c]))!;
    expect(reach.radiusMm).toBeCloseTo(46.65, 1);
    // Circle of 4.66 m cut by a 9 m square, over 81 m²: 83 %.
    expect(reach.share).toBeCloseTo(0.83, 2);
    expect(micCoverageIssues(c, pageWith([c]))).toEqual(["partly-out-of-reach"]);
  });

  it("a 6 × 6 m area at 2.7 m is all in reach", () => {
    const c = area(MXA920, { rangeM: 6, widthM: 6 });
    expect(micReachOnSheet(c, pageWith([c]))!.share).toBeGreaterThan(0.995);
    expect(micCoverageIssues(c, pageWith([c]))).toEqual([]);
  });

  it("hung too high: said so, and at 6.5 m nothing is in reach", () => {
    const high = area(MXA920, { mic: { ...area(MXA920).mic!, mountHeightM: 4 } });
    expect(micCoverageIssues(high, pageWith([high]))).toContain("too-high");
    const far = area(MXA920, { mic: { ...area(MXA920).mic!, mountHeightM: 6.5 } });
    const reach = micReachOnSheet(far, pageWith([far]))!;
    expect(reach.ring).toEqual([]);
    expect(reach.share).toBe(0);
    expect(micCoverageIssues(far, pageWith([far]))).toEqual(["too-high", "out-of-reach"]);
  });

  it("a shifted area is measured from the microphone, not from its own middle", () => {
    const c = area(MXA920, { rangeM: 2, widthM: 2, offsetM: { x: 5, y: 0 } });
    // 4 to 6 m out, reach 4.66 m: only the near strip is inside.
    const share = micReachOnSheet(c, pageWith([c]))!.share;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.35);
  });

  it("no reach is drawn for a model without a stated talker distance", () => {
    const c = area(MXA901);
    expect(micReachOnSheet(c, pageWith([c]))).toBeNull();
    expect(micCoverageIssues(c, pageWith([c]))).toEqual([]);
  });
});

describe("more areas on one microphone", () => {
  it("the second is steered at a seat: 2 × 2 m at the same height", () => {
    const first = area(MXA920, { mic: { ...area(MXA920).mic!, mountHeightM: 3.2 } });
    const next = nextMicCoverage([first], MXA920)!;
    expect(next).toMatchObject({ shape: "box", rangeM: 2, widthM: 2 });
    expect(next.mic).toMatchObject({ dedicated: true, fixed: true, mountHeightM: 3.2 });
  });
  it("stops at what the device carries", () => {
    const eight = Array.from({ length: 8 }, (_, i) => area(MXA920, { id: `c${i}` }));
    expect(nextMicCoverage(eight, MXA920)).toBeNull();
    expect(nextMicCoverage([area(MXA901)], MXA901)).toBeNull();
    const nine = [...eight, area(MXA920, { id: "c9" })];
    expect(micCoverageIssues(nine[0], pageWith(nine))).toContain("too-many-areas");
  });
});
