/**
 * A DXF through the plan import: it arrives as an underlay that is already to scale.
 *
 * The point of importing DXF rather than a plotted PDF is that nobody has to calibrate. So
 * the tests that matter most here are the scale ones: a drawing in mm, in cm and in inches
 * all have to come out at their real size, and a building too large for the sheet at the
 * page's scale has to get a scale it fits at.
 */
import { describe, it, expect } from "vitest";
import { importUnderlayFile } from "../floorplanUnderlay";
import { placeDxfOnSheet } from "../dxfImport";

function dxf(...pairs: [number | string, string | number][]): string {
  return pairs.map(([code, value]) => `${code}\n${value}`).join("\n") + "\n";
}

/** A 10 000 × 5 000 unit rectangle on "Wand", a line on "Möbel", in the given $INSUNITS. */
function plan(insunits?: number): string {
  return dxf(
    [0, "SECTION"], [2, "HEADER"],
    ...(insunits === undefined ? [] : [[9, "$INSUNITS"], [70, insunits]] as [number | string, string | number][]),
    [0, "ENDSEC"],
    [0, "SECTION"], [2, "TABLES"], [0, "TABLE"], [2, "LAYER"],
    [0, "LAYER"], [2, "Wand"], [70, 0], [62, 7],
    [0, "LAYER"], [2, "Möbel"], [70, 0], [62, 3],
    [0, "ENDTAB"], [0, "ENDSEC"],
    [0, "SECTION"], [2, "ENTITIES"],
    [0, "LWPOLYLINE"], [8, "Wand"], [90, 4], [70, 1],
    [10, 0], [20, 0], [10, 10000], [20, 0], [10, 10000], [20, 5000], [10, 0], [20, 5000],
    [0, "LINE"], [8, "Möbel"], [10, 1000], [20, 1000], [11, 2000], [21, 2000],
    [0, "ENDSEC"], [0, "EOF"],
  );
}

const fileOf = (text: string, name = "EG.dxf") => new File([text], name, { type: "application/dxf" });

const svgOf = (src: string) => {
  const b64 = src.slice(src.indexOf(",") + 1);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
};

describe("a DXF as an underlay", () => {
  it("comes in as a vector drawing, not a raster", async () => {
    const imported = await importUnderlayFile(fileOf(plan(4)));
    expect(imported.kind).toBe("dxf");
    expect(imported.src.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(svgOf(imported.src)).toContain("<svg");
  });

  it("knows what one pixel is worth on site, whatever unit the drawing uses", async () => {
    // One drawing unit is one pixel of the picture, so a unit's worth is the mm per pixel.
    expect((await importUnderlayFile(fileOf(plan(4)))).mmPerPx).toBe(1);
    expect((await importUnderlayFile(fileOf(plan(5)))).mmPerPx).toBe(10);
    expect((await importUnderlayFile(fileOf(plan(6)))).mmPerPx).toBe(1000);
    expect((await importUnderlayFile(fileOf(plan(1)))).mmPerPx).toBe(25.4);
  });

  it("says when it guessed the unit, and takes a different one when asked", async () => {
    const guessed = await importUnderlayFile(fileOf(plan()));
    expect(guessed.dxf).toMatchObject({ unit: "mm", unitAssumed: true });
    const told = await importUnderlayFile(fileOf(plan()), { dxfUnit: "cm" });
    expect(told.dxf).toMatchObject({ unit: "cm", unitAssumed: false });
    expect(told.mmPerPx).toBe(10);
  });

  it("is as many pixels as the drawing has units, plus a thin margin", async () => {
    const imported = await importUnderlayFile(fileOf(plan(4)));
    expect(imported.naturalWidthPx).toBeGreaterThanOrEqual(10000);
    expect(imported.naturalWidthPx).toBeLessThan(10200);
    // The margin is half a percent of the long edge on every side: 50 units here, both ways.
    expect(imported.naturalWidthPx).toBe(10100);
    expect(imported.naturalHeightPx).toBe(5100);
  });

  it("offers the drawing's layers and leaves out the ones switched off", async () => {
    const all = await importUnderlayFile(fileOf(plan(4)));
    expect(all.layers?.map((l) => [l.name, l.visible])).toEqual([["Wand", true], ["Möbel", true]]);
    const quiet = await importUnderlayFile(fileOf(plan(4)), { layers: { Möbel: false } });
    expect(quiet.layers?.find((l) => l.name === "Möbel")?.visible).toBe(false);
    // The furniture line is gone from the picture, the walls are not.
    expect(svgOf(quiet.src).length).toBeLessThan(svgOf(all.src).length);
    expect(svgOf(quiet.src)).toContain("Z");
  });

  it("keeps a picture too big to embed out of the project — it is rasterized instead", async () => {
    // The cap is lowered for the test; rasterizing needs a canvas, which the test hands in.
    let asked: { width: number; height: number } | undefined;
    const imported = await importUnderlayFile(fileOf(plan(4)), {
      maxInlineSvgBytes: 100,
      rasterizeSvg: async (_src, width, height) => {
        asked = { width, height };
        return { src: "data:image/png;base64,AAAA", widthPx: width / 4, heightPx: height / 4 };
      },
    });
    expect(asked).toBeDefined();
    expect(imported.src.startsWith("data:image/png")).toBe(true);
    expect(imported.dxf?.rasterized).toBe(true);
    // A quarter of the pixels each way: one pixel is now four drawing units, four mm.
    expect(imported.mmPerPx).toBe(4);
  });

  it("refuses a DWG and says what to send instead", async () => {
    await expect(importUnderlayFile(fileOf("binary", "EG.dwg"))).rejects.toThrow(/DXF/);
  });
});

describe("placing it on the sheet", () => {
  const area = { x: 10, y: 10, w: 800, h: 560 }; // roughly A1 landscape inside its border

  it("draws it at the page's scale when it fits", () => {
    // 10 m × 5 m at 1:50 is 200 × 100 mm on paper.
    const placed = placeDxfOnSheet({ widthPx: 10000, heightPx: 5000, mmPerPx: 1 }, area, 50, true);
    expect(placed.scaleDenominator).toBe(50);
    expect(placed.sizeMm).toEqual({ w: 200, h: 100 });
    expect(placed.fits).toBe(true);
    // Centred in the drawing area.
    expect(placed.positionMm).toEqual({ x: 10 + 300, y: 10 + 230 });
  });

  it("moves to the next standard scale when the building does not fit", () => {
    // 60 m × 30 m: 1200 mm at 1:50 is too wide, 600 mm at 1:100 fits.
    const placed = placeDxfOnSheet({ widthPx: 60000, heightPx: 30000, mmPerPx: 1 }, area, 50, true);
    expect(placed.scaleDenominator).toBe(100);
    expect(placed.sizeMm).toEqual({ w: 600, h: 300 });
  });

  it("keeps the page's scale when it may not change it, and says it does not fit", () => {
    // A page with symbols on it: changing its scale would move every device off its spot.
    const placed = placeDxfOnSheet({ widthPx: 60000, heightPx: 30000, mmPerPx: 1 }, area, 50, false);
    expect(placed.scaleDenominator).toBe(50);
    expect(placed.fits).toBe(false);
  });

  it("goes past the usual building scales for a site plan", () => {
    // 600 m across is a site plan, not a floor: 1:1000 is what it needs.
    const placed = placeDxfOnSheet({ widthPx: 600000, heightPx: 300000, mmPerPx: 1 }, area, 50, true);
    expect(placed.scaleDenominator).toBe(1000);
    expect(placed.fits).toBe(true);
  });
});
