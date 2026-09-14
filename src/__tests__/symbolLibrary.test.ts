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
      { id: "9-1-kameras/schwenk-neige-kamera", name: "Schwenk-Neige Kamera" },
      { id: "9-1-kameras/speed-dome", name: "Speed-Dome" },
      { id: "9-1-kameras/thermal-kamera", name: "Thermal-Kamera" },
    ],
  },
  {
    id: "1-einbruchmeldetechnik", no: "1", label: "Einbruchmeldetechnik", section: "Einbruchmeldetechnik",
    symbols: [
      // Alphabetical, as the CD is — the traps below depend on it.
      { id: "1-einbruchmeldetechnik/glasbruchmelder-aktiv", name: "Glasbruchmelder aktiv" },
      { id: "1-einbruchmeldetechnik/glasbruchmelder-passiv", name: "Glasbruchmelder passiv" },
      { id: "1-einbruchmeldetechnik/infrarot-bewegungsmelder", name: "Infrarot Bewegungsmelder" },
      { id: "1-einbruchmeldetechnik/magnetkontakt", name: "Magnetkontakt" },
      { id: "1-einbruchmeldetechnik/mikrowellen-bewegungsmelder", name: "Mikrowellen Bewegungsmelder" },
      { id: "1-einbruchmeldetechnik/ueberfallmelder", name: "Ueberfallmelder" },
    ],
  },
  {
    id: "4-signalgeber", no: "4", label: "Signalgeber", section: "Signalgeber",
    symbols: [
      { id: "4-signalgeber/klingel", name: "Klingel" },
      { id: "4-signalgeber/signalgeber-akustisch", name: "Signalgeber akustisch" },
      { id: "4-signalgeber/signalgeber-optisch", name: "Signalgeber optisch" },
      { id: "4-signalgeber/sirene", name: "Sirene" },
    ],
  },
  {
    id: "5-brandmeldetechnik", no: "5", label: "Brandmeldetechnik", section: "Brandmeldetechnik",
    symbols: [
      { id: "5-brandmeldetechnik/ansaugrauchmelder", name: "Ansaugrauchmelder" },
      { id: "5-brandmeldetechnik/rauchmelder-optisch", name: "Rauchmelder, optisch" },
    ],
  },
  {
    id: "7-zentralen-busmodule-kuerzel", no: "7", label: "Zentralen, Busmodule, Kürzel", section: "Zentralen, Busmodule, Kürzel",
    symbols: [
      { id: "7-zentralen-busmodule-kuerzel/brandmelderzentrale", name: "Brandmelderzentrale" },
      { id: "7-zentralen-busmodule-kuerzel/einbruchmelderzentrale", name: "Einbruchmelderzentrale" },
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
      .toEqual(["Klingel", "Signalgeber akustisch", "Signalgeber optisch", "Sirene"]);
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
    expect(idFor("motion-detector")).toBe("1-einbruchmeldetechnik/infrarot-bewegungsmelder");
    expect(idFor("door-contact")).toBe("1-einbruchmeldetechnik/magnetkontakt");
    expect(idFor("panic-button")).toBe("1-einbruchmeldetechnik/ueberfallmelder");
    expect(idFor("siren")).toBe("4-signalgeber/sirene");
    expect(idFor("strobe")).toBe("4-signalgeber/signalgeber-optisch");
  });

  it("takes the narrower name, not the first one that happens to match", () => {
    // Four assignments went wrong exactly this way against the real CD: "Rauchmelder"
    // also occurs inside "Ansaugrauchmelder", "zentrale" inside "Brandmelderzentrale",
    // and the chapter is stored alphabetically, so the wrong one came first.
    expect(idFor("smoke-detector")).toBe("5-brandmeldetechnik/rauchmelder-optisch");
    expect(idFor("aspirating-detector")).toBe("5-brandmeldetechnik/ansaugrauchmelder");
    expect(idFor("alarm-panel")).toBe("7-zentralen-busmodule-kuerzel/einbruchmelderzentrale");
    expect(idFor("fire-panel")).toBe("7-zentralen-busmodule-kuerzel/brandmelderzentrale");
    expect(idFor("glass-break")).toBe("1-einbruchmeldetechnik/glasbruchmelder-passiv");
  });

  it("says nothing where the CD has nothing, instead of guessing", () => {
    // Chapter 10 is not in this stub, so a card reader finds no symbol and the device
    // keeps the shape it always had.
    expect(idFor("card-reader")).toBeUndefined();
    expect(idFor("network-switch")).toBeUndefined();
    // Abbreviations hide inside ordinary words: "aspirating" carries a pir and
    // "patch-panel" an atc, and unanchored both used to pull a symbol.
    expect(idFor("patch-panel")).toBeUndefined();
    expect(idFor("pir-detector")).toBe("1-einbruchmeldetechnik/infrarot-bewegungsmelder");
    expect(idFor("")).toBeUndefined();
    expect(defaultSymbolLibraryIdFor("ip-camera", [])).toBeUndefined();
  });
});
