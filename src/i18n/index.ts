/**
 * Lightweight i18n for FACESchematic.
 *
 * Design: the **English source string is the key**. `t("Save As...")` looks the
 * string up in the active locale's dictionary and falls back to the key itself
 * when there is no translation yet. That means a half-finished dictionary is
 * never broken UI — untranslated bits simply stay English — and a translated
 * component keeps reading like English source in the diff.
 *
 * Disambiguation: two English strings that need different translations get a
 * `::context` suffix, e.g. `t("Open::verb")`. The suffix is stripped for the
 * fallback, so it never leaks into the UI.
 *
 * Interpolation: `t("Removed {n} symbols", { n: 3 })`.
 *
 * Reactivity: React components call `useT()` (subscribes to locale changes and
 * returns `t`). Non-React modules (store actions, PDF/report builders) call the
 * plain `t()` — they run at event time, when the module-level locale is current.
 *
 * The default locale comes from the build (`VITE_DEFAULT_LOCALE`), so the FACE
 * Docker image ships German while the public build stays English. The user's own
 * choice in Preferences overrides it and is kept in localStorage.
 */
import { useSyncExternalStore } from "react";
import { DE } from "./de";

export type Locale = "en" | "de";

export const LOCALES: Locale[] = ["en", "de"];

/** Language names, each written in its own language (never translated). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
};

const STORAGE_KEY = "easyschematic-locale";

function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "de";
}

/** Build-time default: `VITE_DEFAULT_LOCALE=de` in the FACE Dockerfile. */
export const DEFAULT_LOCALE: Locale = (() => {
  const raw = (import.meta.env?.VITE_DEFAULT_LOCALE as string | undefined)?.toLowerCase();
  return isLocale(raw) ? raw : "en";
})();

function readStored(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* private mode / storage disabled */
  }
  return DEFAULT_LOCALE;
}

let current: Locale = readStored();

const listeners = new Set<() => void>();

const DICTIONARIES: Record<Locale, Readonly<Record<string, string>>> = {
  en: {}, // English is the key set — nothing to look up
  de: DE,
};

export function getLocale(): Locale {
  return current;
}

/** Switch language. Persists the choice and re-renders every `useT()` consumer. */
export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  syncDocumentLang();
  for (const listener of listeners) listener();
}

/** Whether a locale was explicitly chosen, as opposed to inherited from the build. */
export function hasExplicitLocale(): boolean {
  try {
    return isLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

function syncDocumentLang(): void {
  if (typeof document !== "undefined") document.documentElement.lang = current;
}

syncDocumentLang();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Strip a `::context` disambiguation suffix — the English source is what's left. */
function fallbackFor(key: string): string {
  const at = key.indexOf("::");
  return at === -1 ? key : key.slice(0, at);
}

function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/**
 * Translate `key` into the active locale, falling back to the English source.
 * In React components prefer `useT()` so the text updates when the user
 * switches language.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const translated = DICTIONARIES[current][key] ?? fallbackFor(key);
  return vars ? interpolate(translated, vars) : translated;
}

/** The active locale, as reactive state. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
}

/**
 * `t` bound to the component's render: the component re-renders on a language
 * switch. `t` itself is module-level and stable, so it is safe in dependency
 * arrays and `useCallback`/`useMemo` bodies.
 */
export function useT(): typeof t {
  useLocale();
  return t;
}

/** Every key the active dictionary knows — used by the audit script. */
export function dictionaryFor(locale: Locale): Readonly<Record<string, string>> {
  return DICTIONARIES[locale];
}
