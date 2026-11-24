import { describe, it, expect } from "vitest";
import {
  CONTRAST_LEVELS,
  contrastLevelReached,
  displayContrast,
  projectedContrast,
  requiredContrast,
} from "../projectionContrast";

describe("what each viewing task needs", () => {
  it("names the four levels of the standard", () => {
    expect(CONTRAST_LEVELS.map((l) => [l.id, l.ratio])).toEqual([["passive", 7], ["bdm", 15], ["adm", 50], ["motion", 80]]);
    expect(requiredContrast("bdm")).toBe(15);
    expect(requiredContrast("adm")).toBe(50);
  });

  it("says which task a contrast still serves", () => {
    expect(contrastLevelReached(5)).toBeNull();
    expect(contrastLevelReached(7)).toBe("passive");
    expect(contrastLevelReached(14.9)).toBe("passive");
    expect(contrastLevelReached(15)).toBe("bdm");
    expect(contrastLevelReached(60)).toBe("adm");
    expect(contrastLevelReached(500)).toBe("motion");
  });
});

describe("a projected picture in a lit room", () => {
  it("in the dark it has the projector's own contrast", () => {
    const r = projectedContrast({ screenLux: 2000, ambientLux: 0, level: "bdm", nativeContrast: 300 })!;
    expect(r.ratio).toBeCloseTo(300, 6);
    expect(r.reached).toBe("motion");
  });

  it("room light lifts black more than white", () => {
    // 2000 lx picture, 100 lx room light, 300:1: white 2100, black 6.67 + 100.
    const r = projectedContrast({ screenLux: 2000, ambientLux: 100, level: "bdm", nativeContrast: 300 })!;
    expect(r.ratio).toBeCloseTo(2100 / (2000 / 300 + 100), 6);
    expect(r.ratio).toBeCloseTo(19.7, 1);
    expect(r.required).toBe(15);
    expect(r.ok).toBe(true);
    expect(r.reached).toBe("bdm");
  });

  it("the same room is too bright for detail work", () => {
    const r = projectedContrast({ screenLux: 2000, ambientLux: 100, level: "adm", nativeContrast: 300 })!;
    expect(r.ok).toBe(false);
    expect(r.required).toBe(50);
  });

  it("names the room light at which the task is just served", () => {
    const r = projectedContrast({ screenLux: 2000, ambientLux: 100, level: "bdm", nativeContrast: 300 })!;
    // At exactly that much light the contrast is exactly the required one.
    const at = projectedContrast({ screenLux: 2000, ambientLux: r.maxAmbientLux, level: "bdm", nativeContrast: 300 })!;
    expect(at.ratio).toBeCloseTo(15, 6);
    expect(at.ok).toBe(true);
    expect(r.maxAmbientLux).toBeCloseTo((2000 * (1 - 15 / 300)) / 14, 6);
  });

  it("a projector that cannot reach the task even in the dark allows no light at all", () => {
    const r = projectedContrast({ screenLux: 2000, ambientLux: 0, level: "motion", nativeContrast: 60 })!;
    expect(r.ok).toBe(false);
    expect(r.maxAmbientLux).toBe(0);
  });

  it("assumes 300:1 where the projector's contrast is not given", () => {
    const a = projectedContrast({ screenLux: 1500, ambientLux: 80, level: "bdm" })!;
    const b = projectedContrast({ screenLux: 1500, ambientLux: 80, level: "bdm", nativeContrast: 300 })!;
    expect(a.ratio).toBeCloseTo(b.ratio, 9);
  });

  it("claims nothing without a picture brightness", () => {
    expect(projectedContrast({ screenLux: 0, ambientLux: 100, level: "bdm" })).toBeNull();
    expect(projectedContrast({ screenLux: 2000, ambientLux: -1, level: "bdm" })).toBeNull();
    expect(projectedContrast({ screenLux: 2000, ambientLux: 100, level: "bdm", nativeContrast: 1 })).toBeNull();
  });
});

describe("a display in a lit room", () => {
  it("room light comes back off its front as lux × reflectance ÷ π", () => {
    // 350 cd/m², 300 lx, 5 % → 4.77 cd/m² of reflected light.
    const r = displayContrast({ nits: 350, ambientLux: 300, level: "adm", nativeContrast: 1000, reflectancePct: 5 })!;
    const reflected = (300 * 0.05) / Math.PI;
    expect(r.ratio).toBeCloseTo((350 + reflected) / (0.35 + reflected), 6);
    expect(r.ratio).toBeCloseTo(69.2, 1);
    expect(r.ok).toBe(true);
    expect(r.reached).toBe("adm");
  });

  it("names the room light at which the task is just served, in lux", () => {
    const r = displayContrast({ nits: 350, ambientLux: 300, level: "motion", nativeContrast: 1000, reflectancePct: 5 })!;
    expect(r.ok).toBe(false);
    const at = displayContrast({ nits: 350, ambientLux: r.maxAmbientLux, level: "motion", nativeContrast: 1000, reflectancePct: 5 })!;
    expect(at.ratio).toBeCloseTo(80, 6);
  });

  it("assumes a matt 1000:1 panel where nothing is given", () => {
    const a = displayContrast({ nits: 500, ambientLux: 200, level: "bdm" })!;
    const b = displayContrast({ nits: 500, ambientLux: 200, level: "bdm", nativeContrast: 1000, reflectancePct: 5 })!;
    expect(a.ratio).toBeCloseTo(b.ratio, 9);
  });

  it("claims nothing without the display's brightness", () => {
    expect(displayContrast({ nits: 0, ambientLux: 300, level: "bdm" })).toBeNull();
  });
});
