import { describe, it, expect } from "vitest";
import { guessModel, opticsForModel, pixelsVOfResolution, searchModels, findModel, type ProjectionCatalog } from "../projectionData";

const f = (a: number) => [{ ratio: "16:10", wide: [a, -3] as [number, number], tele: [a * 1.6, -3] as [number, number], sizeMin: 50, sizeMax: 500 }];
const shift = { vMin: -60, vMax: 60, hMin: -18, hMax: 18, hvMin: -32, hvMax: 32 };

const catalog: ProjectionCatalog = {
  source: "test",
  fetched: "2026-11-23",
  models: [
    { name: "EB-L610U", code: "H901", lumens: 6000, resolution: "WUXGA" },
    { name: "EB-L610", code: "H900", lumens: 5000 },
    { name: "EB-870E / EB-875E", code: "H800", lumens: 4000 },
    { name: "EB-PU2216B", code: "HA67", lumens: 16000, resolution: "WUXGA and 4KE", lcd: "1.03", lenses: ["ELPLW08", "ELPLM15"], standardLens: "ELPLM15" },
  ],
  optics: { H901: { formats: f(2.96), throwRatio: "1.35 - 2.20" }, H900: { formats: f(3) }, H800: { formats: f(0.5) } },
  lenses: { "ELPLM15@1.03": { formats: f(3.4) }, "ELPLW08@1.03": { formats: f(1.8) }, "ELPLM15@0.76": { formats: f(4.6) } },
  perBody: { HA67: { ELPLM15: { lumens: 16000, shift }, ELPLW08: { lumens: 15000 } } },
};

describe("finding a model", () => {
  it("searches by the words typed", () => {
    expect(searchModels(catalog, "l610").map((m) => m.name)).toEqual(["EB-L610", "EB-L610U"]);
    expect(searchModels(catalog, "pu 2216")[0].name).toBe("EB-PU2216B");
    expect(searchModels(catalog, " ")).toEqual([]);
  });

  it("recognises a device from the drawing by its model number", () => {
    expect(guessModel(catalog, ["Epson EB-PU2216B Laserprojektor"])?.name).toBe("EB-PU2216B");
    expect(guessModel(catalog, [undefined, "eb l610u"])?.name).toBe("EB-L610U");
    expect(guessModel(catalog, ["EB-875E"])?.name).toBe("EB-870E / EB-875E");
    expect(guessModel(catalog, ["Panasonic PT-RZ21K"])).toBeUndefined();
  });
});

describe("optics of a model", () => {
  it("takes the built-in lens by projector code", () => {
    const o = opticsForModel(catalog, findModel(catalog, "EB-L610U")!)!;
    expect(o.optics.formats![0].wide[0]).toBe(2.96);
    expect(o.optics.lumens).toBe(6000);
    expect(o.lens).toBeUndefined();
    expect(o.throwRatio).toBe("1.35 - 2.20");
  });

  it("takes the standard lens at the body's panel size, with the body's shift and output", () => {
    const m = findModel(catalog, "EB-PU2216B")!;
    const std = opticsForModel(catalog, m)!;
    expect(std.lens).toBe("ELPLM15");
    expect(std.optics.formats![0].wide[0]).toBe(3.4);
    expect(std.optics.shift).toEqual(shift);
    const wide = opticsForModel(catalog, m, "ELPLW08")!;
    expect(wide.optics.formats![0].wide[0]).toBe(1.8);
    expect(wide.optics.lumens).toBe(15000);
    expect(opticsForModel(catalog, m, "NOPE")!.lens).toBe("ELPLM15");
  });
});

describe("native resolution", () => {
  it("reads the vertical pixel count off the names Epson uses", () => {
    expect(pixelsVOfResolution("WUXGA")).toBe(1200);
    expect(pixelsVOfResolution("Full HD")).toBe(1080);
    expect(pixelsVOfResolution("FHD")).toBe(1080);
    expect(pixelsVOfResolution("WXGA")).toBe(800);
    expect(pixelsVOfResolution("XGA")).toBe(768);
    expect(pixelsVOfResolution("SVGA")).toBe(600);
    expect(pixelsVOfResolution("SXGA+")).toBe(1050);
    expect(pixelsVOfResolution("4K")).toBe(2160);
    expect(pixelsVOfResolution("4K-PRO-UHD")).toBe(2160);
  });

  it("counts the panel, not the enhancement", () => {
    expect(pixelsVOfResolution("WUXGA and 4KE")).toBe(1200);
    expect(pixelsVOfResolution("Full HD and 4KE")).toBe(1080);
  });

  it("reads a figure as it stands and claims nothing for a name it does not know", () => {
    expect(pixelsVOfResolution("1920x1200")).toBe(1200);
    expect(pixelsVOfResolution("3840 × 2160")).toBe(2160);
    expect(pixelsVOfResolution("Retina")).toBeUndefined();
    expect(pixelsVOfResolution("")).toBeUndefined();
    expect(pixelsVOfResolution(undefined)).toBeUndefined();
  });

  it("travels with the model's optics, with a fixed lens and with an interchangeable one", () => {
    expect(opticsForModel(catalog, findModel(catalog, "EB-L610U")!)!.optics.pixelsV).toBe(1200);
    expect(opticsForModel(catalog, findModel(catalog, "EB-PU2216B")!)!.optics.pixelsV).toBe(1200);
    // A data file from before the resolution was kept: nothing is made up.
    expect(opticsForModel(catalog, findModel(catalog, "EB-L610")!)!.optics.pixelsV).toBeUndefined();
  });
});
