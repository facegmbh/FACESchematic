/**
 * The manual's language. English on the docs' own host; the FACE image builds the German
 * edition (DOCS_LOCALE=de, see docs/vite.config.ts and the Dockerfile).
 *
 * The pages themselves are whole files: a German page lives in src/pages-de/ under the name
 * of its English original and replaces it at build time. A page without a German file is
 * shown in English — an upstream page added later appears instead of going missing. This
 * map covers only the frame around them: navigation, page titles, the search box — and the
 * product name, which in the German edition is the FACE build's.
 */
import de from "./locale-de.json";
import deHidden from "./locale-de-hidden.json";

declare const __DOCS_LOCALE__: string;

export const LOCALE: "en" | "de" = __DOCS_LOCALE__ === "de" ? "de" : "en";

const table: Record<string, string> = LOCALE === "de" ? de : {};

/**
 * Pages the German edition leaves out of navigation and search. It is FACE's manual: hosting
 * the upstream app yourself and the upstream public API are not what a colleague looks for,
 * and what they describe (accounts, cloud save) does not exist in the FACE build. The pages
 * themselves stay reachable by their address.
 */
export const HIDDEN_PAGES: string[] = LOCALE === "de" ? deHidden : [];

export function tr(text: string): string {
  return table[text] ?? text;
}
