/**
 * The manufacturer data behind the projection planner: which projectors exist, and what
 * their lenses throw. It is one generated file (tools/epsonThrowData.mjs) that is not part
 * of the repository, so everything here has to cope with it being absent — the planner
 * then works from a typed throw ratio alone.
 */
import type { ProjectionFormat, ProjectionOptics, ProjectionShiftRange } from "./types";

export const PROJECTION_CATALOG_URL = "/projection/epson.json";

export interface CatalogLens {
  formats: ProjectionFormat[];
  shift?: ProjectionShiftRange;
  /** "1.35 - 2.20", as the datasheet prints it. */
  throwRatio?: string;
}

export interface CatalogModel {
  name: string;
  code: string;
  lumens?: number;
  /** The panel's resolution as Epson names it: "WUXGA", "Full HD and 4KE". Missing in a
   *  data file generated before this was kept. */
  resolution?: string;
  /** Interchangeable-lens bodies: panel size, the lenses that fit, the one it ships with. */
  lcd?: string;
  lenses?: string[];
  standardLens?: string;
}

export interface ProjectionCatalog {
  source: string;
  fetched: string;
  models: CatalogModel[];
  /** Built-in lenses by projector code. */
  optics: Record<string, CatalogLens>;
  /** Interchangeable lenses by "id@panel size". */
  lenses: Record<string, CatalogLens>;
  /** Light output and shift of one body with one lens. */
  perBody: Record<string, Record<string, { lumens?: number; shift?: ProjectionShiftRange }>>;
}

let pending: Promise<ProjectionCatalog | null> | null = null;

/** Fetch the catalog once. Resolves to null when it is not installed. */
export function loadProjectionCatalog(): Promise<ProjectionCatalog | null> {
  pending ??= fetch(PROJECTION_CATALOG_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data && Array.isArray(data.models) ? (data as ProjectionCatalog) : null))
    .catch(() => null);
  return pending;
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function findModel(catalog: ProjectionCatalog, name: string): CatalogModel | undefined {
  return catalog.models.find((m) => m.name === name);
}

/** Models whose name contains every word typed, best (shortest) names first. */
export function searchModels(catalog: ProjectionCatalog, query: string, limit = 30): CatalogModel[] {
  const words = query.split(/\s+/).map(norm).filter(Boolean);
  if (words.length === 0) return [];
  const seen = new Set<string>();
  return catalog.models
    .filter((m) => {
      const n = norm(m.name);
      if (!words.every((w) => n.includes(w)) || seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    })
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Recognise a device from the drawing: the catalog model whose name appears in one of
 * the device's texts (model number, label). The longest name wins, so "EB-L610U" is not
 * mistaken for a shorter sibling.
 */
export function guessModel(catalog: ProjectionCatalog, texts: (string | undefined)[]): CatalogModel | undefined {
  const hay = texts.filter((t): t is string => !!t).map(norm);
  if (hay.length === 0) return undefined;
  let best: CatalogModel | undefined;
  let bestLen = 0;
  for (const m of catalog.models) {
    for (const part of m.name.split("/")) {
      const n = norm(part);
      if (n.length < 5 || n.length <= bestLen) continue;
      if (hay.some((h) => h.includes(n))) {
        best = m;
        bestLen = n.length;
      }
    }
  }
  return best;
}

/** Vertical pixel counts of the resolutions projectors are named by. */
const RESOLUTION_ROWS: [RegExp, number][] = [
  [/^(4k|uhd)/, 2160],
  [/^wquxga/, 2400],
  [/^wuxga/, 1200],
  [/^(full\s*hd|fhd|1080p?)/, 1080],
  [/^sxga\+/, 1050],
  [/^sxga/, 1024],
  [/^wxga\+/, 900],
  [/^wxga/, 800],
  [/^xga/, 768],
  [/^(hd|720p?)\b/, 720],
  [/^svga/, 600],
  [/^vga/, 480],
];

/**
 * The vertical pixel count behind a resolution name, or undefined for a name not known.
 * Where a model is listed as "WUXGA and 4KE" the panel itself counts — the enhancement
 * shifts those pixels, it does not add panel rows — so the name is read from its start.
 * A "1920x1200" style figure is read as it stands.
 */
export function pixelsVOfResolution(name: string | undefined): number | undefined {
  const text = (name ?? "").trim().toLowerCase();
  if (!text) return undefined;
  const figure = /(\d{3,5})\s*[x×]\s*(\d{3,5})/.exec(text);
  if (figure) return Number(figure[2]);
  return RESOLUTION_ROWS.find(([pattern]) => pattern.test(text))?.[1];
}

/** The optics of a model, with the given lens or the one it ships with. */
export function opticsForModel(
  catalog: ProjectionCatalog,
  model: CatalogModel,
  lensId?: string,
): { optics: ProjectionOptics; lens?: string; throwRatio?: string } | null {
  if (!model.lenses) {
    const lens = catalog.optics[model.code];
    if (!lens) return null;
    return {
      optics: { formats: lens.formats, shift: lens.shift, lumens: model.lumens, pixelsV: pixelsVOfResolution(model.resolution) },
      throwRatio: lens.throwRatio,
    };
  }
  const id = lensId && model.lenses.includes(lensId) ? lensId : (model.standardLens ?? model.lenses[0]);
  const lens = catalog.lenses[`${id}@${model.lcd}`];
  if (!lens) return null;
  const body = catalog.perBody[model.code]?.[id];
  return {
    optics: {
      formats: lens.formats,
      shift: body?.shift ?? lens.shift,
      lumens: body?.lumens ?? model.lumens,
      pixelsV: pixelsVOfResolution(model.resolution),
    },
    lens: id,
    throwRatio: lens.throwRatio,
  };
}
