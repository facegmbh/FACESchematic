/**
 * The load model is checked against the Bose PowerShareX Design Tool v1.0.3 worked
 * example (PSX4804D; channels AMU108 ×2, AMU108 ×2, DM10P-Sub ×1, SMS118 ×2, all Lo-Z),
 * whose intermediate cells were read off the spreadsheet.
 */
import { describe, it, expect } from "vitest";
import type { AmplifierLoadSpec, SpeakerLoadSpec } from "../types";
import {
  computeAmplifierLoad,
  computeChannelDemand,
  defaultLineMode,
  defaultTapW,
  formatChannelLoad,
  formatHeadroom,
  hasAmpLoadData,
  hasSpeakerLoadData,
  pickTapW,
  resolveAmpLimits,
  statusForHeadroom,
  PROFILE_ACTIVE_POWER_DB,
} from "../speakerLoad";

const PSX4804D: AmplifierLoadSpec = {
  channels: 4,
  ratedW: { ohm2: 1500, ohm4: 1200, ohm8: 1300, v70: 2100, v100: 2200 },
  totalRatedW: 4800,
  maxBurstPerChannelW: 2200,
  maxBurstTotalW: 6000,
  maxAvgTotalW: 840,
  peakVoltageV: 139,
  peakCurrentA: 45,
  minImpedanceOhm: 2,
};

const AMU108: SpeakerLoadSpec = { impedanceOhm: 8, rmsPowerW: 200, tapsW: [80, 40, 20, 10, 5], profile: "FR" };
const DM10P_SUB: SpeakerLoadSpec = { impedanceOhm: 8, rmsPowerW: 250, tapsW: [150, 80, 40, 20], profile: "SW" };
const SMS118: SpeakerLoadSpec = { impedanceOhm: 4, rmsPowerW: 750, profile: "SW" };
const DM6: SpeakerLoadSpec = { impedanceOhm: 8, rmsPowerW: 100, tapsW: [80, 40, 20, 10, 5, 2.5], profile: "FR" };

describe("profile table", () => {
  it("matches the Bose active-power figures", () => {
    expect(PROFILE_ACTIVE_POWER_DB.SW).toBe(14);
    expect(PROFILE_ACTIVE_POWER_DB.LF).toBeCloseTo(15.4, 6);
    expect(PROFILE_ACTIVE_POWER_DB.MF).toBeCloseTo(17.2, 6);
    expect(PROFILE_ACTIVE_POWER_DB.HF).toBeCloseTo(19.8, 6);
    expect(PROFILE_ACTIVE_POWER_DB.FR).toBeCloseTo(16.8206, 3);
  });
});

describe("computeChannelDemand", () => {
  it("Lo-Z: requested power is twice the continuous rating, impedance divides by count (AMU108 ×2)", () => {
    const d = computeChannelDemand({ mode: "lo-z", speakers: [{ spec: AMU108, count: 2 }] });
    expect(d.requestedW).toBe(800);
    expect(d.peakW).toBe(1600);
    expect(d.averageW).toBeCloseTo(33.2706, 3);
    expect(d.impedanceOhm).toBe(4);
    expect(d.minImpedanceOhm).toBeCloseTo(3.2, 9);
    expect(d.peakVoltageV).toBeCloseTo(80, 9);
    expect(d.peakCurrentA).toBeCloseTo(22.3607, 3);
  });

  it("Lo-Z subwoofer (DM10P-Sub ×1) and 4 Ω pair (SMS118 ×2) match the sheet", () => {
    const sub = computeChannelDemand({ mode: "lo-z", speakers: [{ spec: DM10P_SUB, count: 1 }] });
    expect(sub.requestedW).toBe(500);
    expect(sub.averageW).toBeCloseTo(39.8107, 3);
    expect(sub.impedanceOhm).toBe(8);
    expect(sub.minImpedanceOhm).toBeCloseTo(6.2, 9);
    expect(sub.peakVoltageV).toBeCloseTo(89.4427, 3);
    expect(sub.peakCurrentA).toBeCloseTo(12.7000, 3);

    const sms = computeChannelDemand({ mode: "lo-z", speakers: [{ spec: SMS118, count: 2 }] });
    expect(sms.requestedW).toBe(3000);
    expect(sms.averageW).toBeCloseTo(238.864, 2);
    expect(sms.impedanceOhm).toBe(2);
    expect(sms.minImpedanceOhm).toBeCloseTo(1.7, 9);
    expect(sms.peakVoltageV).toBeCloseTo(109.545, 2);
    expect(sms.peakCurrentA).toBeCloseTo(59.409, 2);
  });

  it("mixes models on one channel: powers add, impedances parallel", () => {
    const d = computeChannelDemand({ mode: "lo-z", speakers: [{ spec: AMU108, count: 1 }, { spec: DM6, count: 1 }] });
    expect(d.requestedW).toBe(600);
    expect(d.impedanceOhm).toBe(4);
    expect(d.speakerCount).toBe(2);
  });

  it("Hi-Z: tap sum, line impedance V²/P, the highest tap by default and a chosen tap when set", () => {
    const d = computeChannelDemand({ mode: "100v", speakers: [{ spec: DM6, count: 6 }] });
    expect(d.requestedW).toBe(480); // 6 × 80 W
    expect(d.impedanceOhm).toBeCloseTo(100 * 100 / 480, 6);
    expect(d.minImpedanceOhm).toBeCloseTo((100 * 100 / 480) * 0.85 + 0.4, 6);
    const tapped = computeChannelDemand({ mode: "70v", speakers: [{ spec: DM6, count: 6 }], tapW: 20 });
    expect(tapped.requestedW).toBe(120);
    expect(tapped.impedanceOhm).toBeCloseTo(70 * 70 / 120, 6);
  });

  it("applies the output offset in dB and counts speakers without data separately", () => {
    const d = computeChannelDemand({ mode: "lo-z", speakers: [{ spec: AMU108, count: 2 }, { spec: undefined, count: 3 }], gainOffsetDb: -3 });
    expect(d.requestedW).toBeCloseTo(800 * Math.pow(10, -0.3), 6);
    expect(d.speakerCount).toBe(5);
    expect(d.speakersWithoutData).toBe(3);
  });

  it("a speaker with no transformer has no data in Hi-Z, and one without impedance none in Lo-Z", () => {
    expect(hasSpeakerLoadData(SMS118, "100v")).toBe(false);
    expect(hasSpeakerLoadData(SMS118, "lo-z")).toBe(true);
    expect(hasSpeakerLoadData({ rmsPowerW: 100 }, "lo-z")).toBe(false);
    expect(hasSpeakerLoadData(undefined, "lo-z")).toBe(false);
  });
});

describe("taps", () => {
  it("defaults to the highest tap and snaps a wish to the next tap at or below", () => {
    expect(defaultTapW(DM6)).toBe(80);
    expect(defaultTapW(SMS118)).toBeUndefined();
    expect(pickTapW(DM6, 25)).toBe(20);
    expect(pickTapW(DM6, 80)).toBe(80);
    expect(pickTapW(DM6, 1)).toBe(2.5); // below the lowest tap → lowest
    expect(pickTapW({ impedanceOhm: 8 }, 30)).toBe(30); // no tap list → as requested
  });
});

describe("resolveAmpLimits", () => {
  it("keeps explicit limits and derives the missing ones from the ratings", () => {
    const l = resolveAmpLimits(PSX4804D, 4);
    expect(l.maxBurstTotalW).toBe(6000);
    expect(l.peakVoltageV).toBe(139);
    expect(l.supports100V).toBe(true);
    expect(l.supportsLoZ).toBe(true);

    const bare = resolveAmpLimits({ ratedW: { ohm4: 300, ohm8: 300, v70: 300, v100: 300 } }, 4);
    expect(bare.channels).toBe(4);
    expect(bare.totalRatedW).toBe(1200);
    expect(bare.maxBurstPerChannelW).toBe(300);
    expect(bare.maxBurstTotalW).toBe(1200);
    expect(bare.maxAvgTotalW).toBeCloseTo(210, 6);
    expect(bare.peakVoltageV).toBeCloseTo(Math.SQRT2 * 100, 6); // 100 V line beats √(2·300·8) = 69 V
    expect(bare.peakCurrentA).toBeCloseTo(Math.sqrt(600 / 4), 6);
    expect(bare.minImpedanceOhm).toBe(4);
  });

  it("a Hi-Z-only amplifier defaults its lines to 100 V; the mode check flags Lo-Z as unsupported", () => {
    const hiZ: AmplifierLoadSpec = { ratedW: { v100: 240 }, channels: 1 };
    expect(defaultLineMode(hiZ)).toBe("100v");
    expect(defaultLineMode(PSX4804D)).toBe("lo-z");
    expect(defaultLineMode(undefined)).toBe("lo-z");
    const r = computeAmplifierLoad(hiZ, [{ mode: "lo-z", speakers: [{ spec: DM6, count: 2 }] }]);
    expect(r.channels[0].status).toBe("unsupported");
    expect(r.channels[0].limitedBy).toBe("mode");
  });

  it("hasAmpLoadData needs at least one rating", () => {
    expect(hasAmpLoadData(undefined)).toBe(false);
    expect(hasAmpLoadData({})).toBe(false);
    expect(hasAmpLoadData({ channels: 4 })).toBe(false);
    expect(hasAmpLoadData({ totalRatedW: 1200 })).toBe(true);
  });
});

describe("computeAmplifierLoad — the Bose worked example", () => {
  const result = computeAmplifierLoad(PSX4804D, [
    { mode: "lo-z", speakers: [{ spec: AMU108, count: 2 }] },
    { mode: "lo-z", speakers: [{ spec: AMU108, count: 2 }] },
    { mode: "lo-z", speakers: [{ spec: DM10P_SUB, count: 1 }] },
    { mode: "lo-z", speakers: [{ spec: SMS118, count: 2 }] },
  ]);

  it("sums the requested power and finds the shared-supply headroom (K35 = 5100 W, L35 = +0.706 dB)", () => {
    expect(result.totalRequestedW).toBe(5100);
    expect(result.poolBurstHeadroomDb).toBeCloseTo(0.7058, 3);
    expect(result.totalAverageW).toBeCloseTo(345.216, 2);
    expect(result.poolAverageHeadroomDb).toBeCloseTo(3.8619, 3);
  });

  it("channels 1–3 are held to the pool (+0.706 dB, nearing) and channel 4 hits the current limit (−3.119 dB, exceeds)", () => {
    for (const i of [0, 1, 2]) {
      expect(result.channels[i].headroomDb).toBeCloseTo(0.7058, 3);
      expect(result.channels[i].limitedBy).toBe("pool-burst");
      expect(result.channels[i].status).toBe("nearing");
    }
    const ch4 = result.channels[3];
    expect(ch4.headroom.current).toBeCloseTo(-3.119, 2);
    expect(ch4.headroom.voltage).toBeCloseTo(20 * Math.log10(139 / 109.545), 2);
    expect(ch4.headroom["channel-power"]).toBeCloseTo(10 * Math.log10(2200 / 3000), 3);
    expect(ch4.headroomDb).toBeCloseTo(-3.119, 2);
    expect(ch4.limitedBy).toBe("current");
    expect(ch4.status).toBe("exceeds");
    expect(result.status).toBe("exceeds");
  });

  it("per-channel limits of the unconstrained channel read as the sheet's rounds do", () => {
    const ch1 = result.channels[0];
    expect(ch1.headroom.voltage).toBeCloseTo(20 * Math.log10(139 / 80), 6);
    expect(ch1.headroom.current).toBeCloseTo(20 * Math.log10(45 / 22.3607) + 10 * Math.log10(3.2 / 4), 3);
    expect(ch1.headroom["channel-power"]).toBeCloseTo(10 * Math.log10(2200 / 800), 6); // 4.39 dB, Bose row 64
    expect(ch1.headroom["pool-average"]).toBeUndefined(); // positive average headroom is no reduction
  });
});

describe("computeAmplifierLoad — edge cases", () => {
  it("a lightly loaded amplifier is simply OK, empty channels are reported as empty", () => {
    const r = computeAmplifierLoad(PSX4804D, [
      { mode: "lo-z", speakers: [{ spec: DM6, count: 2 }] },
      { mode: "lo-z", speakers: [] },
    ]);
    expect(r.channels[0].status).toBe("ok");
    expect(r.channels[0].headroomDb).toBeGreaterThan(1);
    expect(r.channels[1].status).toBe("empty");
    expect(r.status).toBe("ok");
  });

  it("too many 8 Ω speakers in parallel fall below the minimum load impedance", () => {
    const r = computeAmplifierLoad(PSX4804D, [{ mode: "lo-z", speakers: [{ spec: DM6, count: 6 }] }]); // 1.33 Ω
    expect(r.channels[0].impedanceOhm).toBeCloseTo(8 / 6, 6);
    expect(r.channels[0].status).toBe("exceeds");
    expect(r.channels[0].limitedBy).toBe("impedance");
  });

  it("Hi-Z channels are checked against the 70 V / 100 V ratings and the rated total", () => {
    const r = computeAmplifierLoad(PSX4804D, [
      { mode: "100v", speakers: [{ spec: DM6, count: 20 }] }, // 1600 W of taps
      { mode: "100v", speakers: [{ spec: DM6, count: 30 }] }, // 2400 W > 2200 W channel rating
    ]);
    expect(r.channels[0].headroom["channel-power"]).toBeCloseTo(10 * Math.log10(2200 / 1600), 6);
    expect(r.channels[1].headroom["channel-power"]).toBeCloseTo(10 * Math.log10(2200 / 2400), 6);
    expect(r.poolHiZHeadroomDb).toBeCloseTo(10 * Math.log10(4800 / 4000), 6);
    expect(r.channels[1].status).toBe("nearing");
  });

  it("without amplifier data the demand is still computed but nothing is judged", () => {
    const r = computeAmplifierLoad(undefined, [{ mode: "lo-z", speakers: [{ spec: DM6, count: 2 }] }]);
    expect(r.hasSpec).toBe(false);
    expect(r.channels[0].requestedW).toBe(400);
    expect(r.channels[0].status).toBe("no-data");
    expect(r.channels[0].headroomDb).toBeUndefined();
  });

  it("average power becomes the limiter when the long-term capacity is the bottleneck", () => {
    const hot: AmplifierLoadSpec = { ...PSX4804D, maxAvgTotalW: 100 };
    const r = computeAmplifierLoad(hot, [{ mode: "lo-z", speakers: [{ spec: SMS118, count: 1 }] }]); // avg 119 W
    expect(r.channels[0].headroom["pool-average"]).toBeLessThan(0);
    expect(r.channels[0].limitedBy).toBe("pool-average");
  });
});

describe("formatting", () => {
  it("status thresholds and labels", () => {
    expect(statusForHeadroom(3)).toBe("ok");
    expect(statusForHeadroom(1)).toBe("nearing");
    expect(statusForHeadroom(-2)).toBe("exceeds");
    expect(statusForHeadroom(undefined)).toBe("no-data");
    expect(formatHeadroom(0.7058)).toBe("+0.7 dB");
    expect(formatHeadroom(-3.119)).toBe("-3.1 dB");
    expect(formatChannelLoad({ mode: "lo-z", impedanceOhm: 4, requestedW: 800, speakerCount: 2 })).toBe("4 Ω · 800 W");
    expect(formatChannelLoad({ mode: "100v", impedanceOhm: 20.8, requestedW: 480, speakerCount: 6 })).toBe("100 V · 480 W");
    expect(formatChannelLoad({ mode: "lo-z", impedanceOhm: undefined, requestedW: 0, speakerCount: 0 })).toBe("–");
  });
});
