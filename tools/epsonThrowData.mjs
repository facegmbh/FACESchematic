/**
 * Fetch the data behind Epson's Throw Distance Simulator and boil it down to the one file
 * the projection planner loads: public/projection/epson.json.
 *
 * The simulator (files.support.epson.com/pdc) computes from plain JSON: per lens and
 * aspect ratio a linear fit of throw distance against picture diagonal, the lens shift
 * limits and the light output. Only those figures are kept — no pictures, no connector
 * lists — which turns about 5 MB into a few hundred kB.
 *
 *   node tools/epsonThrowData.mjs            fetch from Epson
 *   node tools/epsonThrowData.mjs <dir>      read the six *.json from a local directory
 *
 * The result is Epson's material. It is generated, not committed — see PROJECTION_DATA.md
 * for how it reaches the server.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://files.support.epson.com/pdc/en/static/data";
const OUT = join(ROOT, "public", "projection", "epson.json");
const LOCAL = process.argv[2];

async function load(name) {
  if (LOCAL) return JSON.parse(readFileSync(join(LOCAL, `${name}.json`), "utf8").replace(/^﻿/, ""));
  const res = await fetch(`${BASE}/${name}.json`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
  return JSON.parse((await res.text()).replace(/^﻿/, ""));
}

/** The simulator stores shift as percent, except where a value below 1 is already a fraction. */
const pct = (v) => (Math.abs(v) < 1 ? v * 100 : v);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function shiftOf(row) {
  const s = {
    vMin: pct(num(row.lensShiftVMin)),
    vMax: pct(num(row.lensShiftVMax)),
    hMin: pct(num(row.lensShiftHMin)),
    hMax: pct(num(row.lensShiftHMax)),
    hvMin: pct(num(row.lensShiftHvMin)),
    hvMax: pct(num(row.lensShiftHvMax)),
  };
  return Object.values(s).some((v) => v !== 0) ? s : undefined;
}

/** The up to five "ratioN / s2dWaN / …" column groups of a lens row. */
function formatsOf(row) {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    const ratio = row[`ratio${i}`];
    if (typeof ratio !== "string" || !ratio.includes(":")) continue;
    const wa = num(row[`s2dWa${i}`]);
    const ta = num(row[`s2dTa${i}`]);
    if (!wa || !ta) continue;
    out.push({
      ratio,
      wide: [wa, num(row[`s2dWb${i}`])],
      tele: [ta, num(row[`s2dTb${i}`])],
      sizeMin: num(row[`sizeWMin${i}`]),
      sizeMax: num(row[`sizeWMax${i}`]),
    });
  }
  // The panel's own shape first: it is what a new projection starts with.
  out.sort((a, b) => (b.ratio === row.aspectRatio) - (a.ratio === row.aspectRatio));
  return out;
}

const [brightness, lensLists, optionLenses, fixedLenses, projectors] = await Promise.all(
  ["brightness", "optionLensList", "optionLensSpec", "projectorLensSpec", "projectorSpec"].map(load),
);

/** Built-in lenses, by projector code. */
const optics = {};
for (const row of fixedLenses) {
  if (optics[row.code]) continue;
  const formats = formatsOf(row);
  if (formats.length === 0) continue;
  optics[row.code] = { formats, shift: shiftOf(row), throwRatio: row.throwRatio };
}

/** Interchangeable lenses, by "id@panel size" — the same lens throws differently on a
 *  larger panel. */
const lenses = {};
for (const row of optionLenses) {
  if (typeof row.id !== "string") continue;
  const key = `${row.id}@${row.lcdSize}`;
  if (lenses[key]) continue;
  const formats = formatsOf(row);
  if (formats.length === 0) continue;
  lenses[key] = { formats, shift: shiftOf(row), throwRatio: row.throwRatio };
}

/** Per projector and lens: light output and the shift this body allows with that lens. */
const perBody = {};
for (const row of brightness.optionLens ?? []) {
  (perBody[row.code] ??= {})[row.lensId] = { lumens: num(row.brightness) || undefined, shift: shiftOf(row) };
}
const lensesFor = Object.fromEntries(lensLists.map((l) => [l.code, l.lenses]));

const seen = new Set();
const models = [];
for (const p of projectors) {
  const key = `${p.name}|${p.code}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const m = { name: p.name, code: p.code, lumens: num(p.whiteNormal) || undefined };
  if (p.lensExchange) {
    const usable = (lensesFor[p.code] ?? []).filter((id) => lenses[`${id}@${p.lcdSize}`]);
    if (usable.length === 0) continue;
    m.lcd = p.lcdSize;
    m.lenses = usable;
    if (usable.includes(p.standardLens)) m.standardLens = p.standardLens;
  } else if (!optics[p.code]) continue;
  models.push(m);
}
models.sort((a, b) => a.name.localeCompare(b.name));

const usedCodes = new Set(models.map((m) => m.code));
for (const code of Object.keys(optics)) if (!usedCodes.has(code)) delete optics[code];
for (const code of Object.keys(perBody)) if (!usedCodes.has(code)) delete perBody[code];

const catalog = {
  source: "Epson Throw Distance Simulator",
  fetched: new Date().toISOString().slice(0, 10),
  models,
  optics,
  lenses,
  perBody,
};
mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(catalog);
writeFileSync(OUT, json);
console.log(
  `${models.length} Modelle, ${Object.keys(optics).length} feste Optiken, ${Object.keys(lenses).length} Wechselobjektive → ${OUT} (${Math.round(json.length / 1024)} kB)`,
);
