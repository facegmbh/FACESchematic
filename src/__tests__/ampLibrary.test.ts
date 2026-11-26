/**
 * Amplifier load data in the library (asked for 26.11.2026: "für Blaze alles nachtragen,
 * die Audac Endstufen auch"). The load check on loudspeaker plans only says something
 * about an amplifier whose model carries its datasheet figures.
 */
import { describe, it, expect } from "vitest";
import { DEVICE_TEMPLATES } from "../deviceLibrary";
import { templates as audac } from "../devices/audac-amps";
import { templates as blaze } from "../devices/blaze-amps";
import { computeAmplifierLoad, resolveAmpLimits } from "../speakerLoad";

const speakerOuts = (t: (typeof DEVICE_TEMPLATES)[number]) =>
  t.ports.filter((p) => p.signalType === "speaker-level" && p.direction === "output").length;

describe("Blaze and Audac amplifiers", () => {
  const allBlaze = DEVICE_TEMPLATES.filter((t) => t.manufacturer === "Blaze Audio" && t.deviceType === "amplifier");

  it("are all there: 21 Blaze PowerZone models and 35 Audac amplifiers", () => {
    expect(allBlaze).toHaveLength(21);
    expect(blaze).toHaveLength(17);
    expect(audac).toHaveLength(35);
    const ids = [...allBlaze, ...audac].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(DEVICE_TEMPLATES.filter((t) => t.id === id), id).toHaveLength(1);
  });

  it("each carry load data, with one speaker output per amplifier channel", () => {
    for (const t of [...allBlaze, ...audac]) {
      expect(t.ampLoad, t.label).toBeTruthy();
      // The plan binds a line to a speaker port, so ports and channels have to agree.
      expect(speakerOuts(t), t.label).toBe(t.ampLoad!.channels);
      const limits = resolveAmpLimits(t.ampLoad!, speakerOuts(t));
      expect(limits.totalRatedW, t.label).toBeGreaterThan(0);
      expect(limits.maxBurstPerChannelW, t.label).toBeLessThanOrEqual(limits.totalRatedW);
      expect(new Set(t.ports.map((p) => p.id)).size, t.label).toBe(t.ports.length);
    }
  });

  it("know which models bridge two channels for 70 V / 100 V", () => {
    const of = (model: string) => [...allBlaze, ...audac].find((t) => t.modelNumber === model)!.ampLoad!;
    expect(of("PowerZone Connect 2004").hiZBridgesPairs).toBe(true);
    expect(of("PowerZone Connect 504D").hiZBridgesPairs).toBe(true);
    expect(of("PowerZone 504").hiZBridgesPairs).toBeUndefined();
    expect(of("SCP212").hiZBridgesPairs).toBe(true);
    expect(of("MFA208").hiZBridgesPairs).toBe(true);
    expect(of("PMQ480").hiZBridgesPairs).toBeUndefined();
  });

  it("check a Blaze Connect 2004 the way it is built: 1000 W per pair on 100 V", () => {
    const amp = allBlaze.find((t) => t.modelNumber === "PowerZone Connect 2004")!.ampLoad!;
    const line = (w: number) => ({ mode: "100v" as const, speakers: [{ spec: { tapsW: [w] }, count: 1 }] });
    const empty = { mode: "lo-z" as const, speakers: [] };
    expect(computeAmplifierLoad(amp, [line(700), empty, line(700), empty]).status).toBe("ok");
    expect(computeAmplifierLoad(amp, [line(900), line(900), empty, empty]).status).toBe("exceeds");
  });

  it("offer no 100 V mode where the amplifier has none", () => {
    const epa = audac.find((t) => t.modelNumber === "EPA254")!.ampLoad!;
    const line = { mode: "100v" as const, speakers: [{ spec: { tapsW: [20] }, count: 1 }] };
    expect(computeAmplifierLoad(epa, [line]).channels[0].status).toBe("unsupported");
    // CAP424 is the opposite: 100 V only.
    const cap = audac.find((t) => t.modelNumber === "CAP424")!.ampLoad!;
    const loZ = { mode: "lo-z" as const, speakers: [{ spec: { impedanceOhm: 8, rmsPowerW: 50 }, count: 1 }] };
    expect(computeAmplifierLoad(cap, [loZ]).channels[0].status).toBe("unsupported");
    expect(computeAmplifierLoad(cap, [line]).channels[0].status).toBe("ok");
  });
});
