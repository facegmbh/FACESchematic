/**
 * The Telenot and Ajax components FACE buys and sells (Odoo, 26.11.2026), each with its BHE
 * symbol and — where the maker states a reach — its detection area.
 */
import { describe, it, expect } from "vitest";
import { templates as securityFace } from "../devices/security-face";
import { DEVICE_TEMPLATES, DEVICE_TYPE_TO_CATEGORY } from "../deviceLibrary";
import { CONNECTOR_LABELS, SIGNAL_LABELS } from "../types";

describe("FACE's Telenot and Ajax components", () => {
  it("are bundled, with ids of their own", () => {
    expect(securityFace.length).toBeGreaterThan(50);
    const ids = securityFace.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const all = DEVICE_TEMPLATES.map((t) => t.id);
    for (const id of ids) expect(all.filter((x) => x === id), id).toHaveLength(1);
  });

  it("each name a BHE symbol, with a drawn shape for where the library is missing", () => {
    for (const t of securityFace) {
      expect(t.planSymbol?.libraryId, t.label).toMatch(/^\d+(-\d+)?-[a-z0-9-]+\/[a-z0-9-]+$/);
      expect(t.planSymbol?.shape, t.label).toBeTruthy();
      expect(t.planSymbol?.glyph, t.label).toBeTruthy();
    }
  });

  it("belong to Security and use only signals and connectors the app knows", () => {
    for (const t of securityFace) {
      expect(DEVICE_TYPE_TO_CATEGORY[t.deviceType], t.label).toBe("Security");
      expect(t.ports.length, t.label).toBeGreaterThan(0);
      for (const p of t.ports) {
        expect(SIGNAL_LABELS, `${t.label} / ${p.label}`).toHaveProperty(p.signalType);
        expect(CONNECTOR_LABELS, `${t.label} / ${p.label}`).toHaveProperty(p.connectorType!);
      }
      expect(new Set(t.ports.map((p) => p.id)).size, t.label).toBe(t.ports.length);
    }
  });

  it("give every motion detector the area its maker states", () => {
    const motion = securityFace.filter((t) => t.deviceType === "motion-detector");
    expect(motion.length).toBeGreaterThanOrEqual(17);
    for (const t of motion) expect(t.detection, t.label).toBeTruthy();
  });

  it("keep Telenot's buses apart: a C2B detector is on com2BUS, a B1 detector on BUS-1", () => {
    const signals = (model: string) => securityFace.find((t) => t.shortName === model)!.ports.map((p) => p.signalType);
    expect(signals("histar 1015-C2B")).toEqual(["com2bus", "com2bus"]);
    expect(signals("histar 1015-B1")).toEqual(["bus-1", "bus-1"]);
    expect(signals("comstar F215")).toEqual(["dss2"]);
  });

  it("draw the ceiling detector as a circle and the curtain as a narrow wedge", () => {
    const of = (model: string) => securityFace.find((t) => t.shortName === model)!.detection!;
    expect(of("histar DUAL B360 BUS")).toEqual({ shape: "circle", rangeM: 10 });
    expect(of("histar 1025-C2B")).toMatchObject({ shape: "sector", rangeM: 25, apertureDeg: 3 });
    expect(of("histar 1015-C2B")).toMatchObject({ shape: "sector", rangeM: 15, apertureDeg: 90 });
  });
});
