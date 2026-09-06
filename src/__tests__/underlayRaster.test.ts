import { describe, it, expect } from "vitest";
import { MAX_RASTER_LONG_EDGE_PX, MAX_RASTER_PIXELS, UNDERLAY_DPI_CHOICES, DEFAULT_UNDERLAY_DPI, rasterScaleFor } from "../floorplanUnderlay";

/** Sheet sizes in PDF points (1/72 inch). */
const A4 = { w: 842, h: 595 };
const A1 = { w: 2384, h: 1684 };
const A0 = { w: 3370, h: 2384 };

const effectiveDpi = (sheet: { w: number; h: number }, dpi: number) => rasterScaleFor(sheet.w, sheet.h, dpi) * 72;
const pixels = (sheet: { w: number; h: number }, dpi: number) => {
  const s = rasterScaleFor(sheet.w, sheet.h, dpi);
  return { w: sheet.w * s, h: sheet.h * s };
};

describe("underlay raster scale", () => {
  it("hits the asked-for resolution while the sheet leaves room", () => {
    for (const sheet of [A4, A1]) {
      for (const dpi of [100, 150, 200, 300]) {
        expect(effectiveDpi(sheet, dpi)).toBeCloseTo(dpi, 6);
      }
    }
  });

  it("treats every sheet size alike, which a pixel cap did not", () => {
    // The bug this replaced: a fixed 2400 px long edge is 203 dpi on A4 and 72 on A1.
    expect(effectiveDpi(A4, DEFAULT_UNDERLAY_DPI)).toBeCloseTo(effectiveDpi(A1, DEFAULT_UNDERLAY_DPI), 6);
    expect(pixels(A1, DEFAULT_UNDERLAY_DPI).w).toBeGreaterThan(pixels(A4, DEFAULT_UNDERLAY_DPI).w);
  });

  it("caps a big sheet at what a browser will allocate, and says so through the scale", () => {
    // 500 dpi on A1 does not fit: the long edge binds at about 495 dpi.
    const a1 = pixels(A1, 500);
    expect(Math.round(a1.w)).toBe(MAX_RASTER_LONG_EDGE_PX);
    expect(effectiveDpi(A1, 500)).toBeLessThan(500);
    expect(effectiveDpi(A1, 500)).toBeGreaterThan(480);
    // Asking for more than the ceiling changes nothing.
    expect(effectiveDpi(A1, 1200)).toBeCloseTo(effectiveDpi(A1, 500), 6);
  });

  it("never asks for more pixels than a browser will back, on any sheet or setting", () => {
    for (const sheet of [A4, A1, A0, { w: 6000, h: 4000 }]) {
      for (const dpi of [...UNDERLAY_DPI_CHOICES, 1200]) {
        const { w, h } = pixels(sheet, dpi);
        expect(Math.max(w, h)).toBeLessThanOrEqual(MAX_RASTER_LONG_EDGE_PX + 1);
        expect(w * h).toBeLessThanOrEqual(MAX_RASTER_PIXELS + 1);
      }
    }
  });

  it("keeps the sheet's aspect ratio", () => {
    const { w, h } = pixels(A1, 400);
    expect(w / h).toBeCloseTo(A1.w / A1.h, 6);
  });
});
