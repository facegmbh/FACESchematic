/**
 * The BHE symbol library: lookup, search and the device-type assignment.
 *
 * Every test drives a stub catalogue rather than the generated one — the artwork is member
 * material and is not in the repository, so the installed catalogue is empty on CI and the
 * rules would otherwise be untested. The stub keeps the CD's real shape: BHE chapter
 * numbers and the German names the files carry.
 */
import { describe, it, expect } from "vitest";
import {
  defaultSymbolLibraryIdFor,
  findSymbolLibraryEntry,
  searchSymbolLibrary,
  symbolLibraryInstalled,
  symbolLibraryName,
  symbolLibraryUrl,
  type SymbolLibraryCategory,
} from "../symbolLibrary";

const CATALOG: SymbolLibraryCategory[] = [
  {
    id: "9-1-kameras", no: "9.1", label: "Kameras", section: "Video-Überwachungstechnik",
    symbols: [
      { id: "9-1-kameras/boxkamera", name: "Boxkamera" },
      { id: "9-1-kameras/bullet-kamera", name: "Bullet-Kamera" },
      { id: "9-1-kameras/fix-dome", name: "Fix-Dome" },
      { id: "9-1-kameras/speed-dome", name: "Speed-Dome" },
      { id: "9-1-kameras/thermal-kamera", name: "Thermal-Kamera" },
    ],
  },
  {
    id: "1-einbruchmeldetechnik", no: "1", label: "Einbruchmeldetechnik", section: "Einbruchmeldetechnik",
    symbols: [
      { id: "1-einbruchmeldetechnik/passiv-infrarot-melder", name: "Passiv-Infrarot-Melder" },
      { id: "1-einbruchmeldetechnik/magnetkontakt", name: "Magnetkontakt" },
      { id: "1-einbruchmeldetechnik/glasbruchmelder", name: "Glasbruchmelder" },
    ],
  },
  {
    id: "4-signalgeber", no: "4", label: "Signalgeber", section: "Signalgeber",
    symbols: [
      { id: "4-signalgeber/sirene-innen", name: "Sirene innen" },
      { id: "4-signalgeber/blitzleuchte", name: "Blitzleuchte" },
    ],
  },
];

describe("looking a symbol up", () => {
  it("finds it with its category, and serves it from the build", () => {
    const hit = findSymbolLibraryEntry("9-1-kameras/fix-dome", CATALOG);
    expect(hit?.name).toBe("Fix-Dome");
    expect(hit?.category.no).toBe("9.1");
    expect(symbolLibraryUrl("9-1-kameras/fix-dome")).toBe("/symbols/bhe/9-1-kameras/fix-dome.svg");
  });

  it("still names a symbol this build does not have", () => {
    // A plan drawn where the library is installed, opened where it is not.
    expect(symbolLibraryName("9-1-kameras/fix-dome", [])).toBe("Fix dome");
    expect(symbolLibraryName(undefined, CATALOG)).toBe("");
    expect(symbolLibraryInstalled([])).toBe(false);
    expect(symbolLibraryInstalled(CATALOG)).toBe(true);
  });
});

describe("searching", () => {
  it("puts the name that starts with the query first", () => {
    const hits = searchSymbolLibrary("dome", CATALOG);
    expect(hits[0].name).toBe("Fix-Dome"); // "Speed-Dome" only contains it
    expect(hits.map((h) => h.name)).toContain("Speed-Dome");
  });

  it("finds by chapter as well, so 'Signalgeber' offers what is in it", () => {
    expect(searchSymbolLibrary("signalgeber", CATALOG).map((h) => h.name).sort())
      .toEqual(["Blitzleuchte", "Sirene innen"]);
  });

  it("answers nothing to an empty query rather than the whole CD", () => {
    expect(searchSymbolLibrary("   ", CATALOG)).toEqual([]);
    expect(searchSymbolLibrary("xyzzy", CATALOG)).toEqual([]);
  });
});

describe("assigning a symbol to a device type", () => {
  const idFor = (type: string) => defaultSymbolLibraryIdFor(type, CATALOG);

  it("gives each camera the one it is", () => {
    expect(idFor("ptz-camera")).toBe("9-1-kameras/speed-dome");
    expect(idFor("thermal-camera")).toBe("9-1-kameras/thermal-kamera");
    expect(idFor("dome-camera")).toBe("9-1-kameras/fix-dome");
    expect(idFor("bullet-camera")).toBe("9-1-kameras/bullet-kamera");
    // Nothing more specific said: the fixed dome is the camera on most plans.
    expect(idFor("ip-camera")).toBe("9-1-kameras/fix-dome");
  });

  it("covers the intrusion side", () => {
    expect(idFor("motion-detector")).toBe("1-einbruchmeldetechnik/passiv-infrarot-melder");
    expect(idFor("door-contact")).toBe("1-einbruchmeldetechnik/magnetkontakt");
    expect(idFor("glass-break")).toBe("1-einbruchmeldetechnik/glasbruchmelder");
    expect(idFor("siren")).toBe("4-signalgeber/sirene-innen");
  });

  it("says nothing where the CD has nothing, instead of guessing", () => {
    // Chapter 5 is not in this stub, so a smoke detector finds no symbol and the device
    // keeps the shape it always had.
    expect(idFor("smoke-detector")).toBeUndefined();
    expect(idFor("network-switch")).toBeUndefined();
    expect(idFor("")).toBeUndefined();
    expect(defaultSymbolLibraryIdFor("ip-camera", [])).toBeUndefined();
  });
});
