import { describe, it, expect, beforeEach } from "vitest";
import { DE } from "../i18n/de";
import { getLocale, setLocale, t, LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "../i18n";

describe("i18n core", () => {
  beforeEach(() => {
    setLocale("en");
  });

  it("returns the English source when the locale is English", () => {
    expect(t("Preferences")).toBe("Preferences");
  });

  it("translates a known key once German is active", () => {
    setLocale("de");
    expect(t("Cancel")).toBe("Abbrechen");
  });

  it("falls back to the English source for a key with no German yet", () => {
    setLocale("de");
    const nonsense = "A string nobody has translated yet";
    expect(t(nonsense)).toBe(nonsense);
  });

  it("strips a ::context suffix from the fallback so it never reaches the UI", () => {
    setLocale("de");
    expect(t("Some untranslated label::somewhere")).toBe("Some untranslated label");
    expect(t("Some untranslated label::somewhere")).not.toContain("::");
  });

  it("fills {placeholders} from the vars argument", () => {
    expect(t("Removed {n} of {total} items", { n: 3, total: 9 })).toBe("Removed 3 of 9 items");
  });

  it("leaves an unknown placeholder in place rather than printing undefined", () => {
    expect(t("Removed {n} items", {})).toBe("Removed {n} items");
  });

  it("tracks the active locale", () => {
    expect(getLocale()).toBe("en");
    setLocale("de");
    expect(getLocale()).toBe("de");
  });

  it("names every locale it offers, each in its own language", () => {
    for (const locale of LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
    }
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });
});

describe("German dictionary", () => {
  it("has no empty translations", () => {
    const blank = Object.entries(DE).filter(([, value]) => value.trim() === "");
    expect(blank).toEqual([]);
  });

  it("never invents a placeholder the English source does not have", () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const mismatched = Object.entries(DE).filter(([key, value]) => {
      const wanted = new Set(placeholders(key));
      return placeholders(value).some((p) => !wanted.has(p));
    });
    expect(mismatched).toEqual([]);
  });

  it("keeps every placeholder the English source has", () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const dropped = Object.entries(DE).filter(([key, value]) => {
      const got = new Set(placeholders(value));
      return placeholders(key).some((p) => !got.has(p));
    });
    expect(dropped).toEqual([]);
  });

  it("never leaves a ::context marker in a translated string", () => {
    const leaked = Object.entries(DE).filter(([, value]) => value.includes("::"));
    expect(leaked).toEqual([]);
  });
});
