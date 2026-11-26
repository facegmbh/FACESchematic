/**
 * A detector arrives with the area its maker states.
 *
 * Asked for 26.11.2026: the Telenot and Ajax components FACE buys and sells go into the
 * library "mit BHE Symbol und Abdeckung". A motion detector's datasheet says "15 m, 90°";
 * a template carries that, and the area drawn for the device starts from it instead of
 * from a generic wedge somebody has to correct.
 */
import { describe, it, expect } from "vitest";
import { defaultCoverageForDevice, detectionCoverageFor } from "../floorplan";
import { DEVICE_TEMPLATES } from "../deviceLibrary";

describe("a detector's coverage from its datasheet", () => {
  it("draws a wedge with the stated reach and angle", () => {
    const c = detectionCoverageFor({ shape: "sector", rangeM: 15, apertureDeg: 90 });
    expect(c).toMatchObject({ shape: "sector", rangeM: 15, apertureDeg: 90 });
    expect(c.opacity).toBeGreaterThan(0);
  });

  it("draws a ceiling detector as a circle and a curtain as a corridor", () => {
    expect(detectionCoverageFor({ shape: "circle", rangeM: 5 })).toMatchObject({ shape: "circle", rangeM: 5 });
    expect(detectionCoverageFor({ shape: "circle", rangeM: 5 }).apertureDeg).toBeUndefined();
    expect(detectionCoverageFor({ shape: "rect", rangeM: 25, widthM: 2 })).toMatchObject({ shape: "rect", rangeM: 25, widthM: 2 });
  });

  it("wins over the generic wedge of the device type", () => {
    const generic = defaultCoverageForDevice("motion-detector");
    const stated = defaultCoverageForDevice("motion-detector", { detection: { shape: "sector", rangeM: 25, apertureDeg: 6 } });
    expect(stated.rangeM).toBe(25);
    expect(stated.apertureDeg).toBe(6);
    expect(stated.rangeM).not.toBe(generic.rangeM);
    expect(stated.optics).toBeUndefined();
  });
});

describe("the library's detection data", () => {
  const withDetection = DEVICE_TEMPLATES.filter((t) => t.detection);

  it("is there for motion detectors", () => {
    expect(withDetection.length).toBeGreaterThan(10);
  });

  it("is plausible: a reach in metres, an angle a lens can have", () => {
    for (const t of withDetection) {
      const d = t.detection!;
      expect(d.rangeM, t.label).toBeGreaterThan(0);
      expect(d.rangeM, t.label).toBeLessThanOrEqual(60);
      if (d.shape === "sector") {
        expect(d.apertureDeg, t.label).toBeGreaterThan(0);
        expect(d.apertureDeg, t.label).toBeLessThanOrEqual(360);
      }
      if (d.shape === "rect") expect(d.widthM, t.label).toBeGreaterThan(0);
    }
  });
});
