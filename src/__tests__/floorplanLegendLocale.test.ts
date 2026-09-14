import { describe, it, expect, afterEach } from "vitest";
import {
  createDefaultLegend,
  floorplanKindPreset,
  isOwnLegendHeading,
  legendLinesTitleOf,
  legendNotesTitleOf,
  legendTitleOf,
} from "../floorplan";
import { getLocale, setLocale } from "../i18n";
import type { FloorplanPage } from "../types";

const paper = { paperId: "A1", orientation: "landscape" } as const;

function page(over: Partial<FloorplanPage> = {}): Pick<FloorplanPage, "kind" | "legend"> {
  return { kind: "generic", legend: createDefaultLegend(paper), ...over } as Pick<FloorplanPage, "kind" | "legend">;
}

afterEach(() => setLocale("en"));

describe("legend headings follow the interface language", () => {
  it("heads a fresh plan in the language the user is working in", () => {
    setLocale("de");
    const de = page();
    expect(legendTitleOf(de)).toBe("LEGENDE & MONTAGE");
    expect(legendNotesTitleOf(de)).toBe("MONTAGEHINWEISE");

    setLocale("en");
    expect(legendTitleOf(de)).toBe("LEGEND");
    expect(legendNotesTitleOf(de)).toBe("INSTALLATION NOTES");
  });

  it("bakes nothing into a new legend, so switching language moves it too", () => {
    const legend = createDefaultLegend(paper);
    expect(legend.title).toBeUndefined();
    expect(legend.notesTitle).toBeUndefined();
  });

  it("keeps a heading somebody typed, in whatever language", () => {
    const typed = page({ legend: { ...createDefaultLegend(paper), title: "Schallplan Erdgeschoss" } } as Partial<FloorplanPage>);
    setLocale("de");
    expect(legendTitleOf(typed)).toBe("Schallplan Erdgeschoss");
    setLocale("en");
    expect(legendTitleOf(typed)).toBe("Schallplan Erdgeschoss");
  });

  it("treats a heading we wrote ourselves as untouched, in either language", () => {
    // This is what lets an older project catch up: it was saved with our own English
    // heading, and nobody ever typed it.
    expect(isOwnLegendHeading("LEGEND")).toBe(true);
    expect(isOwnLegendHeading("BESCHALLUNG - LEGENDE & MONTAGE")).toBe(true);
    expect(isOwnLegendHeading("MONTAGEHINWEISE")).toBe(true);
    expect(isOwnLegendHeading("Schallplan Erdgeschoss")).toBe(false);
    expect(isOwnLegendHeading(undefined)).toBe(false);

    const old = page({ legend: { ...createDefaultLegend(paper), title: "LEGEND" } } as Partial<FloorplanPage>);
    setLocale("de");
    expect(legendTitleOf(old)).toBe("LEGENDE & MONTAGE");
  });

  it("follows the plan kind as well as the language", () => {
    setLocale("de");
    expect(legendTitleOf(page({ kind: "loudspeaker" }))).toBe("BESCHALLUNG - LEGENDE & MONTAGE");
    expect(legendTitleOf(page({ kind: "wifi" }))).toBe("WLAN-AUSLEUCHTUNG - LEGENDE & MONTAGE");
    expect(legendLinesTitleOf(page({ kind: "loudspeaker" }))).toBe("LINIEN / ENDSTUFENKANÄLE");

    setLocale("en");
    expect(legendTitleOf(page({ kind: "loudspeaker" }))).toBe("SOUND SYSTEM - LEGEND & MOUNTING");
    expect(legendTitleOf(page({ kind: "wifi" }))).toBe("WI-FI COVERAGE - LEGEND & MOUNTING");
  });

  it("gives every kind a full set of headings in both languages", () => {
    for (const locale of ["en", "de"] as const) {
      for (const kind of ["generic", "wifi", "loudspeaker"] as const) {
        const p = floorplanKindPreset(kind, locale);
        expect(p.legendTitle.length).toBeGreaterThan(0);
        expect(p.legendNotesTitle.length).toBeGreaterThan(0);
        expect(p.legendLinesTitle.length).toBeGreaterThan(0);
        expect(p.fieldLabels).toHaveLength(6);
        expect(p.revisionHeaders).toHaveLength(5);
      }
    }
    // The label template is geometry, not language — it must not drift between the two.
    for (const kind of ["generic", "wifi", "loudspeaker"] as const) {
      expect(floorplanKindPreset(kind, "de").labelTemplate).toBe(floorplanKindPreset(kind, "en").labelTemplate);
    }
  });

  it("writes the drawing block's own labels in the working language", () => {
    setLocale("de");
    expect(floorplanKindPreset("generic").fieldLabels[0]).toBe("Bauvorhaben");
    setLocale("en");
    expect(floorplanKindPreset("generic").fieldLabels[0]).toBe("Project");
    expect(getLocale()).toBe("en");
  });
});
