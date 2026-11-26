/**
 * The manual's language. English on the docs' own host; the FACE image builds the German
 * edition (DOCS_LOCALE=de, see docs/vite.config.ts and the Dockerfile).
 *
 * The pages themselves are whole files: a German page lives in src/pages-de/ under the name
 * of its English original and replaces it at build time. A page without a German file is
 * shown in English — an upstream page added later appears instead of going missing. This
 * map covers only the frame around them: navigation, page titles, the search box.
 */
import de from "./locale-de.json";

declare const __DOCS_LOCALE__: string;

export const LOCALE: "en" | "de" = __DOCS_LOCALE__ === "de" ? "de" : "en";

const table: Record<string, string> = LOCALE === "de" ? de : {};

export function tr(text: string): string {
  return table[text] ?? text;
}
