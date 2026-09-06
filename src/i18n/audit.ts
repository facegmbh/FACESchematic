/**
 * Translation audit — `npm run i18n:audit`.
 *
 * Scans the source for `t("…")` calls and reports which keys the German
 * dictionary does not cover yet. Because an untranslated key falls back to its
 * own English text, a miss is a cosmetic gap, never a crash — so this is a
 * report, not a gate. `--check` makes it exit non-zero when the gap grows past
 * a threshold, for use in CI.
 *
 * Run with: npx tsx src/i18n/audit.ts [--check] [--list]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DE } from "./de";

const SRC = join(process.cwd(), "src");

/** `t("…")` / `t('…')` — a single-line literal first argument, which is how every call is written. */
const CALL = /\bt\(\s*(["'])((?:\\.|(?!\1)[^\\])*?)\1/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // The dictionaries themselves are not call sites.
      if (entry === "i18n" || entry === "__tests__") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Turn a source-code string literal back into the runtime string it denotes. */
function unescape(literal: string): string {
  return literal
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\(["'\\`])/g, "$1");
}

const missing = new Map<string, string[]>();
let calls = 0;

for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(CALL)) {
    calls++;
    const key = unescape(match[2]);
    if (key in DE) continue;
    const where = relative(process.cwd(), file);
    const seen = missing.get(key);
    if (seen) {
      if (!seen.includes(where)) seen.push(where);
    } else {
      missing.set(key, [where]);
    }
  }
}

const translated = calls - [...missing.values()].reduce((n, files) => n + files.length, 0);
const pct = calls === 0 ? 100 : Math.round((translated / calls) * 100);

console.log(`t() call sites : ${calls}`);
console.log(`German entries : ${Object.keys(DE).length}`);
console.log(`covered        : ${pct}%`);
console.log(`missing keys   : ${missing.size}`);

if (process.argv.includes("--list")) {
  for (const [key, files] of [...missing].sort()) {
    console.log(`\n  ${JSON.stringify(key)}\n    ${files.join("\n    ")}`);
  }
} else if (missing.size > 0) {
  console.log(`\nRun with --list to see them.`);
}

// Untranslated strings degrade to English, so only a real regression should fail CI.
if (process.argv.includes("--check") && pct < 90) {
  console.error(`\nGerman coverage fell to ${pct}% (want 90% or better).`);
  process.exit(1);
}
