import { describe, it, expect } from "vitest";
import {
  freeSpaceRefDb,
  wallAttenuationDb,
  segmentsCross,
  wallLossAlongDb,
  rssiAtDbm,
  bestRssiDbm,
  rangeForRssiM,
  rssiColor,
  computeHeatmap,
  coveredFraction,
  radioForBand,
  type AccessPointPlacement,
} from "../wifiCoverage";
import { WALL_MATERIAL_DEFAULTS, type FloorplanWall, type WifiBand } from "../types";

/** 1:50 — a paper mm is 50 real mm, so 20 paper mm is one metre. */
const scale = 50;
const MM_PER_M = 1000 / scale;

function wall(over: Partial<FloorplanWall> = {}): FloorplanWall {
  return {
    id: "w1",
    material: "drywall",
    thicknessMm: 100,
    pointsMm: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
    ...over,
  };
}

describe("free-space reference", () => {
  it("matches the textbook figures at one metre", () => {
    expect(freeSpaceRefDb("2.4")).toBeCloseTo(40.2, 1);
    expect(freeSpaceRefDb("5")).toBeCloseTo(47.3, 1);
    expect(freeSpaceRefDb("6")).toBeCloseTo(48.0, 1);
  });
});

describe("wall attenuation", () => {
  it("lands inside the measured range for each build-up at 5 GHz", () => {
    // Ranges are what these walls actually measure; the defaults are calibrated to them.
    const cases: [FloorplanWall["material"], number, number, number][] = [
      ["drywall", 100, 3, 5],
      ["wood", 40, 3, 4],
      ["glass", 24, 3, 6],
      ["glass-coated", 24, 20, 30],
      ["brick-hollow", 100, 6, 8],
      ["brick-solid", 200, 12, 15],
      ["concrete", 200, 20, 25],
      ["concrete-reinforced", 250, 25, 31],
    ];
    for (const [material, thicknessMm, lo, hi] of cases) {
      const db = wallAttenuationDb({ material, thicknessMm }, "5");
      expect(db, `${material} @ ${thicknessMm}mm = ${db.toFixed(1)} dB`).toBeGreaterThanOrEqual(lo);
      expect(db, `${material} @ ${thicknessMm}mm = ${db.toFixed(1)} dB`).toBeLessThanOrEqual(hi);
    }
  });

  it("grows with thickness and with frequency", () => {
    const thin = wallAttenuationDb({ material: "concrete", thicknessMm: 100 }, "5");
    const thick = wallAttenuationDb({ material: "concrete", thicknessMm: 300 }, "5");
    expect(thick).toBeGreaterThan(thin);

    const bands: WifiBand[] = ["2.4", "5", "6"];
    const vals = bands.map((b) => wallAttenuationDb({ material: "brick-solid", thicknessMm: 200 }, b));
    expect(vals[0]).toBeLessThan(vals[1]);
    expect(vals[1]).toBeLessThan(vals[2]);
  });

  it("keeps a thickness-independent material flat", () => {
    // Metal blocks by being metal, not by being thick.
    expect(wallAttenuationDb({ material: "metal", thicknessMm: 2 }, "5"))
      .toBeCloseTo(wallAttenuationDb({ material: "metal", thicknessMm: 200 }, "5"), 6);
  });

  it("takes a measured override in place of the default", () => {
    const measured = { concrete: { baseDb: 10, perCmDb: 0.5 } };
    const std = wallAttenuationDb({ material: "concrete", thicknessMm: 200 }, "5");
    const over = wallAttenuationDb({ material: "concrete", thicknessMm: 200 }, "5", measured);
    expect(std).toBeCloseTo(WALL_MATERIAL_DEFAULTS.concrete.baseDb + 0.7 * 20, 5);
    expect(over).toBeCloseTo(10 + 0.5 * 20, 5);
  });
});

describe("ray casting through walls", () => {
  it("counts a proper crossing and ignores a miss", () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
    expect(segmentsCross(a, b, { x: 5, y: -5 }, { x: 5, y: 5 })).toBe(true);
    expect(segmentsCross(a, b, { x: 20, y: -5 }, { x: 20, y: 5 })).toBe(false);
    // Parallel walls are never crossed.
    expect(segmentsCross(a, b, { x: 0, y: 1 }, { x: 10, y: 1 })).toBe(false);
  });

  it("charges a run once per leg the ray actually passes through", () => {
    // An L: down the left, then along the top. A ray through the middle of the vertical
    // leg pays for that leg alone, not for the whole run.
    const run: FloorplanWall = wall({ pointsMm: [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }] });
    const oneLeg = wallLossAlongDb({ x: 0, y: 50 }, { x: 300, y: 50 }, [run], "5");
    expect(oneLeg).toBeCloseTo(wallAttenuationDb(run, "5"), 5);

    // A ray that enters below the corner and leaves above it crosses both legs and pays
    // twice — which is right, it really does go through two walls.
    const bothLegs = wallLossAlongDb({ x: 50, y: 20 }, { x: 150, y: 150 }, [run], "5");
    expect(bothLegs).toBeCloseTo(2 * wallAttenuationDb(run, "5"), 5);
  });

  it("treats a ray exactly through a shared vertex as a graze, not two walls", () => {
    // Degenerate: the ray touches the corner and then runs along the second leg. Only a
    // proper crossing counts, so this reads as no wall at all. Erring low is the safe
    // direction — a plan that overstates attenuation would add access points nobody needs.
    const run: FloorplanWall = wall({ pointsMm: [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }] });
    expect(wallLossAlongDb({ x: 0, y: 100 }, { x: 300, y: 100 }, [run], "5")).toBe(0);
  });

  it("adds up every wall on the path", () => {
    const w1 = wall({ id: "a", pointsMm: [{ x: 50, y: -50 }, { x: 50, y: 50 }] });
    const w2 = wall({ id: "b", material: "brick-solid", thicknessMm: 200, pointsMm: [{ x: 150, y: -50 }, { x: 150, y: 50 }] });
    const loss = wallLossAlongDb({ x: 0, y: 0 }, { x: 300, y: 0 }, [w1, w2], "5");
    expect(loss).toBeCloseTo(wallAttenuationDb(w1, "5") + wallAttenuationDb(w2, "5"), 5);
  });

  it("skips a hidden wall, because a switched-off layer is not there", () => {
    const hidden = wall({ hidden: true, pointsMm: [{ x: 50, y: -50 }, { x: 50, y: 50 }] });
    expect(wallLossAlongDb({ x: 0, y: 0 }, { x: 100, y: 0 }, [hidden], "5")).toBe(0);
  });
});

describe("signal level", () => {
  const ap: AccessPointPlacement = { positionMm: { x: 0, y: 0 }, txDbm: 20, gainDbi: 5.5 };
  const base = { band: "5" as WifiBand, scaleDenominator: scale, pathLossExponent: 2.6 };

  it("matches what you measure in line of sight", () => {
    // 20 dBm + 5.5 dBi at 5 GHz: about -40 dBm at 5 m and -48 dBm at 10 m.
    expect(rssiAtDbm(ap, { x: 5 * MM_PER_M, y: 0 }, base)).toBeCloseTo(-40, 0);
    expect(rssiAtDbm(ap, { x: 10 * MM_PER_M, y: 0 }, base)).toBeCloseTo(-48, 0);
  });

  it("is independent of the drawing scale", () => {
    // Ten metres is ten metres, whether the plan is 1:50 or 1:100.
    const at50 = rssiAtDbm(ap, { x: 10 * (1000 / 50), y: 0 }, { ...base, scaleDenominator: 50 });
    const at100 = rssiAtDbm(ap, { x: 10 * (1000 / 100), y: 0 }, { ...base, scaleDenominator: 100 });
    expect(at50).toBeCloseTo(at100, 6);
  });

  it("drops by exactly the wall's loss when one is in the way", () => {
    const w = wall({ pointsMm: [{ x: 5 * MM_PER_M, y: -100 }, { x: 5 * MM_PER_M, y: 100 }] });
    const clear = rssiAtDbm(ap, { x: 10 * MM_PER_M, y: 0 }, base);
    const through = rssiAtDbm(ap, { x: 10 * MM_PER_M, y: 0 }, { ...base, walls: [w] });
    expect(clear - through).toBeCloseTo(wallAttenuationDb(w, "5"), 5);
  });

  it("does not blow up at the antenna itself", () => {
    const atAp = rssiAtDbm(ap, { x: 0, y: 0 }, base);
    expect(Number.isFinite(atAp)).toBe(true);
    // Clamped at one metre, so it can never read above the free-space value there.
    expect(atAp).toBeCloseTo(20 + 5.5 - freeSpaceRefDb("5"), 5);
  });

  it("reports the best access point, which is the one a client joins", () => {
    const far: AccessPointPlacement = { positionMm: { x: 40 * MM_PER_M, y: 0 }, txDbm: 20, gainDbi: 5.5 };
    const at = { x: 10 * MM_PER_M, y: 0 };
    const best = bestRssiDbm([ap, far], at, base);
    expect(best).toBeCloseTo(rssiAtDbm(ap, at, base), 6);
    expect(best).toBeGreaterThan(rssiAtDbm(far, at, base));
  });

  it("falls off faster in a cluttered building", () => {
    const office = rssiAtDbm(ap, { x: 15 * MM_PER_M, y: 0 }, { ...base, pathLossExponent: 2.6 });
    const cluttered = rssiAtDbm(ap, { x: 15 * MM_PER_M, y: 0 }, { ...base, pathLossExponent: 3.2 });
    expect(cluttered).toBeLessThan(office);
  });
});

describe("planning read-outs", () => {
  it("inverts to a free-run radius and back", () => {
    const ap = { txDbm: 20, gainDbi: 5.5 };
    const r = rangeForRssiM(ap, -67, "5", 2.6);
    expect(r).toBeGreaterThan(20);
    const back = rssiAtDbm(
      { positionMm: { x: 0, y: 0 }, ...ap },
      { x: r * MM_PER_M, y: 0 },
      { band: "5", scaleDenominator: scale, pathLossExponent: 2.6 },
    );
    expect(back).toBeCloseTo(-67, 4);
  });

  it("reaches less far on 6 GHz than on 2.4 for the same radio", () => {
    const ap = { txDbm: 20, gainDbi: 5.5 };
    const low = rangeForRssiM(ap, -67, "2.4", 2.6);
    const high = rangeForRssiM(ap, -67, "6", 2.6);
    expect(high).toBeLessThan(low);
  });

  it("colours the -67 dBm sign-off step distinctly from either neighbour", () => {
    expect(rssiColor(-45)).not.toBe(rssiColor(-65));
    expect(rssiColor(-65)).not.toBe(rssiColor(-70));
    expect(rssiColor(-200)).toBe(rssiColor(-90));
  });

  it("falls back to a plain indoor radio when a model carries no spec", () => {
    expect(radioForBand(undefined, "5")).toEqual({ txDbm: 20, gainDbi: 3, supported: false });
    const spec = { bands: ["2.4", "5"] as WifiBand[], txDbm: { "5": 23 }, gainDbi: { "5": 6 } };
    expect(radioForBand(spec, "5")).toEqual({ txDbm: 23, gainDbi: 6, supported: true });
    expect(radioForBand(spec, "6").supported).toBe(false);
  });
});

describe("heatmap grid", () => {
  const area = { x: 0, y: 0, w: 200, h: 100 };
  const opts = { band: "5" as WifiBand, scaleDenominator: scale, pathLossExponent: 2.6, pitchMm: 10 };

  it("samples the whole area at the requested pitch", () => {
    const g = computeHeatmap([{ positionMm: { x: 0, y: 0 }, txDbm: 20, gainDbi: 5.5 }], area, opts);
    expect(g.cols).toBe(21);
    expect(g.rows).toBe(11);
    expect(g.dbm.length).toBe(21 * 11);
    expect(g.originMm).toEqual({ x: 0, y: 0 });
  });

  it("is strongest at the access point and weakest in the far corner", () => {
    const g = computeHeatmap([{ positionMm: { x: 0, y: 0 }, txDbm: 20, gainDbi: 5.5 }], area, opts);
    expect(g.dbm[0]).toBeGreaterThan(g.dbm[g.dbm.length - 1]);
  });

  it("says nothing is covered when there is no access point", () => {
    const g = computeHeatmap([], area, opts);
    expect(coveredFraction(g, -67)).toBe(0);
    expect(g.dbm.every((v) => v === -Infinity)).toBe(true);
  });

  it("reports a coverage share that a wall reduces", () => {
    const ap = { positionMm: { x: 0, y: 50 }, txDbm: 20, gainDbi: 5.5 };
    const clear = coveredFraction(computeHeatmap([ap], area, opts), -67);
    const blocked = coveredFraction(
      computeHeatmap([ap], area, {
        ...opts,
        walls: [wall({ material: "concrete", thicknessMm: 250, pointsMm: [{ x: 40, y: -50 }, { x: 40, y: 150 }] })],
      }),
      -67,
    );
    expect(clear).toBeGreaterThan(blocked);
  });
});

describe("the UniFi access points in the library", () => {
  it("all carry a radio spec, so dropping one on a plan is enough", async () => {
    const { DEVICE_TEMPLATES } = await import("../deviceLibrary");
    const aps = DEVICE_TEMPLATES.filter((t) => t.deviceType === "access-point");
    expect(aps.length).toBeGreaterThan(0);
    for (const ap of aps) {
      expect(ap.wifi, ap.label).toBeDefined();
      expect(ap.wifi!.bands.length, ap.label).toBeGreaterThan(0);
      for (const band of ap.wifi!.bands) {
        expect(ap.wifi!.txDbm[band], `${ap.label} ${band}`).toBeGreaterThan(0);
        expect(ap.wifi!.gainDbi[band], `${ap.label} ${band}`).toBeGreaterThan(0);
      }
    }
  });

  it("stays inside the EU EIRP caps, so a plan cannot promise an illegal install", async () => {
    const { DEVICE_TEMPLATES } = await import("../deviceLibrary");
    // 20 dBm at 2.4 GHz, 23 dBm at 5 GHz and for 6 GHz low-power indoor. EIRP is
    // transmit power plus antenna gain.
    const caps: Record<WifiBand, number> = { "2.4": 20, "5": 23, "6": 23 };
    for (const ap of DEVICE_TEMPLATES.filter((t) => t.wifi)) {
      for (const band of ap.wifi!.bands) {
        const eirp = (ap.wifi!.txDbm[band] ?? 0) + (ap.wifi!.gainDbi[band] ?? 0);
        expect(eirp, `${ap.label} ${band} GHz`).toBeLessThanOrEqual(caps[band]);
      }
    }
  });

  it("leaves a dual-band model off the 6 GHz map entirely", async () => {
    const { DEVICE_TEMPLATES } = await import("../deviceLibrary");
    const lite = DEVICE_TEMPLATES.find((t) => t.modelNumber === "U7-Lite");
    expect(lite?.wifi?.bands).toEqual(["2.4", "5"]);
    // Not "weak on 6 GHz" — not present. collectAccessPoints has to drop it.
    const { collectAccessPoints } = await import("../wifiCoverage");
    const page = {
      symbols: [{ id: "s1", groupId: "g1", positionMm: { x: 0, y: 0 }, deviceNodeId: "n1" }],
      groups: [{ id: "g1" }],
    };
    expect(collectAccessPoints(page, "6", () => lite!.wifi)).toHaveLength(0);
    expect(collectAccessPoints(page, "5", () => lite!.wifi)).toHaveLength(1);
  });

  it("skips access points on a switched-off layer", async () => {
    const { collectAccessPoints } = await import("../wifiCoverage");
    const spec = { bands: ["5"] as WifiBand[], txDbm: { "5": 17 }, gainDbi: { "5": 6 } };
    const page = {
      symbols: [{ id: "s1", groupId: "g1", positionMm: { x: 0, y: 0 }, deviceNodeId: "n1" }],
      groups: [{ id: "g1", hidden: true }],
    };
    expect(collectAccessPoints(page, "5", () => spec)).toHaveLength(0);
  });
});

describe("planning radius for an access point's circle", () => {
  it("is the free run to -60 dBm, a good signal rather than the floor", async () => {
    const { planningRadiusM } = await import("../wifiCoverage");
    const spec = { bands: ["5"] as WifiBand[], txDbm: { "5": 17 }, gainDbi: { "5": 6 } };
    // A U7 Pro in an open building: about 24 m to -60 dBm, and the -67 dBm floor is
    // roughly twice that, which is why the floor makes a poor starting circle.
    expect(planningRadiusM(spec, "5", 2.6)).toBeCloseTo(24, 0);
    expect(planningRadiusM(spec, "5", 2.6)).toBeLessThan(rangeForRssiM({ txDbm: 17, gainDbi: 6 }, -67, "5", 2.6));
  });

  it("shrinks by itself once the plan says the building is cluttered", async () => {
    const { planningRadiusM } = await import("../wifiCoverage");
    const spec = { bands: ["5"] as WifiBand[], txDbm: { "5": 17 }, gainDbi: { "5": 6 } };
    const open = planningRadiusM(spec, "5", 2.6);
    const cluttered = planningRadiusM(spec, "5", 3.2);
    expect(cluttered).toBeLessThan(open);
    expect(cluttered).toBeCloseTo(13, 0);
  });
});

describe("how the UniFi models are mounted", () => {
  it("marks the wall and in-wall units, and leaves the ceiling ones alone", async () => {
    const { DEVICE_TEMPLATES } = await import("../deviceLibrary");
    const byModel = (m: string) => DEVICE_TEMPLATES.find((t) => t.modelNumber === m);
    expect(byModel("U7-Pro-Wall")?.wifi?.mount).toBe("wall");
    expect(byModel("U7-IW")?.wifi?.mount).toBe("wall");
    // Ceiling units say nothing, which is the default.
    expect(byModel("U7-Pro")?.wifi?.mount).toBeUndefined();
    expect(byModel("E7")?.wifi?.mount).toBeUndefined();
  });
});
