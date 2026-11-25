import { describe, it, expect } from "vitest";
import {
  CONTRAST_LEVELS,
  contrastLevelReached,
  CONTRAST_APPLICATIONS,
  contrastApplication,
  displayContrast,
  formatContrast,
  pictureContrast,
  projectedContrast,
  rateContrast,
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

describe("the rating scale of Epson's Brightness & Contrast guide", () => {
  it("carries Epson's rooms with their usual light and band limits", () => {
    expect(CONTRAST_APPLICATIONS.map((a) => [a.id, a.ambientLux, [...a.bands]])).toEqual([
      ["meeting", 140, [20, 15, 8, 3]],
      ["classroom", 210, [15, 10, 7, 5]],
      ["hall", 140, [15, 7, 5, 3]],
      ["living", 70, [10, 5, 4, 3]],
      ["theatre", 14, [80, 50, 30, 20]],
    ]);
    expect(contrastApplication(undefined).id).toBe("meeting");
  });

  it("puts a contrast into one of five bands for the room", () => {
    expect(rateContrast(25, "meeting")!.band).toBe("best");
    expect(rateContrast(20, "meeting")!.band).toBe("best");
    expect(rateContrast(19.9, "meeting")!.band).toBe("recommended");
    expect(rateContrast(12, "meeting")!.band).toBe("enough");
    expect(rateContrast(5, "meeting")!.band).toBe("limit");
    expect(rateContrast(2.9, "meeting")!.band).toBe("too-low");
    // The same picture rates worse in a cinema.
    expect(rateContrast(25, "theatre")!.band).toBe("limit");
    expect(rateContrast(25)!.band).toBe("best");
    expect(rateContrast(Number.NaN)).toBeNull();
  });

  it("places the mark as Epson does: five equal bands, linear inside each", () => {
    expect(rateContrast(500, "meeting")!.at).toBe(0);
    expect(rateContrast(200, "meeting")!.at).toBe(0);
    // Top band runs from 200 down to 20: halfway is 110.
    expect(rateContrast(110, "meeting")!.at).toBeCloseTo(0.1, 6);
    expect(rateContrast(20, "meeting")!.at).toBeCloseTo(0.2, 6);
    expect(rateContrast(15, "meeting")!.at).toBeCloseTo(0.4, 6);
    expect(rateContrast(11.5, "meeting")!.at).toBeCloseTo(0.5, 6);
    expect(rateContrast(3, "meeting")!.at).toBeCloseTo(0.8, 6);
    expect(rateContrast(1.5, "meeting")!.at).toBeCloseTo(0.9, 6);
    expect(rateContrast(0, "meeting")!.at).toBe(1);
  });

  it("works out a picture's contrast from the projection's own fields", () => {
    expect(pictureContrast({}, 1000)).toBeNull();
    expect(pictureContrast({ light: { ambientLux: 100 } }, undefined)).toBeNull();
    const beamer = pictureContrast({ light: { ambientLux: 100 } }, 1000)!;
    expect(beamer.ratio).toBeCloseTo(1100 / (1000 / 300 + 100), 6);
    expect(beamer.required).toBe(15);
    expect(pictureContrast({ viewing: { task: "adm" }, light: { ambientLux: 100 } }, 1000)!.required).toBe(50);
    // A display needs its luminance, not a screen illuminance.
    expect(pictureContrast({ kind: "display", light: { ambientLux: 300 } }, 1000)).toBeNull();
    const display = pictureContrast({ kind: "display", light: { ambientLux: 300, nits: 350 } }, undefined)!;
    const reflected = (300 * 0.05) / Math.PI;
    expect(display.ratio).toBeCloseTo((350 + reflected) / (0.35 + reflected), 6);
  });

  it("prints a contrast the way the scale reads", () => {
    expect(formatContrast(12.04)).toBe("12.0:1");
    expect(formatContrast(12.04, ",")).toBe("12,0:1");
    expect(formatContrast(150.4)).toBe("150:1");
    expect(formatContrast(250)).toBe("> 200:1");
  });
});
