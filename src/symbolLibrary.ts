/**
 * The BHE symbol library — the drawn symbols of German security engineering.
 *
 * The BHE (Bundesverband Sicherheitstechnik) publishes one symbol per component, and plans
 * handed to an installer, an insurer or a Sachverständiger are read against them. Drawing a
 * camera as a triangle is fine for a workshop sketch and wrong for a Anlagenbeschreibung.
 *
 * What ships is the index, not the artwork: every symbol is an SVG under public/symbols/bhe/
 * fetched by id, so a plan file carries the id — nothing about the drawing itself travels
 * through a project file, and re-drawn artwork reaches old plans.
 *
 * The whole library, index included, is that one served directory: nothing of it is in the
 * source tree, because the drawings are BHE member material and this repository is public
 * (see BHE_SYMBOLS.md). It is loaded once at startup; until it answers — and forever, on a
 * build that does not carry it — every lookup here says "nothing" and the app draws the
 * shapes it always drew.
 */

export interface SymbolLibrarySymbol {
  /** "<category>/<name>", e.g. "9-1-kameras/fix-dome". Stable: it is what a plan stores. */
  id: string;
  /** As the CD names it, e.g. "Schwenk-Neige Kamera". */
  name: string;
}

export interface SymbolLibraryCategory {
  id: string;
  /** BHE's own numbering, e.g. "9.1" — the order plans and the prospectus are in. */
  no: string;
  label: string;
  /** The top-level chapter, e.g. "Video-Überwachungstechnik". */
  section: string;
  symbols: SymbolLibrarySymbol[];
}

export interface SymbolLibraryHit {
  id: string;
  name: string;
  category: SymbolLibraryCategory;
}

/** Where the artwork is served from. Same origin, so a canvas drawn from it stays clean
 *  and the PDF export can rasterize it. */
export const SYMBOL_LIBRARY_BASE = "/symbols/bhe/";

let loaded: SymbolLibraryCategory[] = [];
let loading: Promise<SymbolLibraryCategory[]> | null = null;

export function symbolLibraryCategories(): SymbolLibraryCategory[] {
  return loaded;
}

/** Fetch the catalogue once. Safe to call from anywhere and as often as you like: the
 *  second caller gets the first one's promise, and a build without the library resolves
 *  to nothing rather than failing. */
export function loadSymbolLibrary(): Promise<SymbolLibraryCategory[]> {
  if (loading) return loading;
  loading = fetch(`${SYMBOL_LIBRARY_BASE}catalog.json`)
    .then((res) => (res.ok ? res.json() : { categories: [] }))
    .then((data: { categories?: SymbolLibraryCategory[] }) => {
      loaded = Array.isArray(data.categories) ? data.categories : [];
      return loaded;
    })
    .catch(() => {
      loaded = [];
      return loaded;
    });
  return loading;
}

/** Tests drive the catalogue directly rather than over the network. */
export function __setSymbolLibraryForTests(categories: SymbolLibraryCategory[]): void {
  loaded = categories;
  loading = Promise.resolve(categories);
}

/** Is the artwork installed on this build? Empty means the CD was never converted. */
export function symbolLibraryInstalled(categories: SymbolLibraryCategory[] = loaded): boolean {
  return categories.length > 0;
}

export function symbolLibraryUrl(id: string): string {
  return `${SYMBOL_LIBRARY_BASE}${id}.svg`;
}

export function findSymbolLibraryEntry(
  id: string | undefined,
  categories: SymbolLibraryCategory[] = loaded,
): SymbolLibraryHit | undefined {
  if (!id) return undefined;
  for (const category of categories) {
    const symbol = category.symbols.find((s) => s.id === id);
    if (symbol) return { id: symbol.id, name: symbol.name, category };
  }
  return undefined;
}

/** What to call a symbol in the UI. A plan drawn on a build with the library open on one
 *  without it still says something sensible rather than showing a raw id. */
export function symbolLibraryName(
  id: string | undefined,
  categories: SymbolLibraryCategory[] = loaded,
): string {
  if (!id) return "";
  const hit = findSymbolLibraryEntry(id, categories);
  if (hit) return hit.name;
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Free-text search over name and category. Matches at the start of a word rank first —
 *  typing "dome" should offer Fix-Dome before "Vandalismusgeschützte Domekuppel". */
export function searchSymbolLibrary(
  query: string,
  categories: SymbolLibraryCategory[] = loaded,
  limit = 80,
): SymbolLibraryHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { hit: SymbolLibraryHit; score: number }[] = [];
  for (const category of categories) {
    const inCategory = `${category.no} ${category.label} ${category.section}`.toLowerCase().includes(q);
    for (const symbol of category.symbols) {
      const name = symbol.name.toLowerCase();
      let score = -1;
      if (name.startsWith(q)) score = 3;
      else if (new RegExp(`\\b${escapeRegExp(q)}`).test(name)) score = 2;
      else if (name.includes(q)) score = 1;
      else if (inCategory) score = 0;
      if (score >= 0) hits.push({ hit: { id: symbol.id, name: symbol.name, category }, score });
    }
  }
  return hits
    .sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name, "de"))
    .slice(0, limit)
    .map((h) => h.hit);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Which BHE symbol a device type asks for.
 *
 * Short abbreviations are anchored (\bpir\b, not /pir/): unanchored they hide inside
 * ordinary words — "aspirating" carries a pir, "patch-panel" an atc — and a switch then
 * comes out wearing a motion detector.
 *
 * The rules are written against the CD's numbering and its German names rather than against
 * exact ids: the chapter a symbol lives in is fixed by the BHE, the file name is not, and a
 * rule that finds nothing simply yields nothing — the device then keeps the drawn shape it
 * has always had. That is why every rule may list several names, narrowest first.
 */
interface AssignmentRule {
  /** Matched against the device type, lower-cased. */
  device: RegExp;
  /** Matched against the category number ("9.1") — the BHE chapter. */
  chapter: RegExp;
  /** Candidate names inside that chapter, best first. */
  names: RegExp[];
}

const ASSIGNMENT_RULES: AssignmentRule[] = [
  // ── 9 Video-Überwachungstechnik ──
  { device: /ptz|speed.?dome|schwenk/, chapter: /^9\.1$/, names: [/speed.?dome/, /schwenk/, /kamera/] },
  { device: /thermal|thermo|waerme|wärme.?kamera/, chapter: /^9\.1$/, names: [/thermal|thermo/, /kamera/] },
  { device: /dome/, chapter: /^9\.1$/, names: [/fix.?dome/, /dome/, /kamera/] },
  { device: /bullet|tube/, chapter: /^9\.1$/, names: [/bullet/, /kamera/] },
  { device: /camera|kamera/, chapter: /^9\.1$/, names: [/fix.?dome/, /boxkamera/, /kamera/] },
  { device: /nvr|recorder|rekorder|aufzeichnung/, chapter: /^9\.5$/, names: [/^nvr/, /aufzeichnung digital/] },
  { device: /monitor|display|screen/, chapter: /^9\.5$/, names: [/^monitor/] },
  { device: /ir.?(strahler|illuminator)|infrared.?illuminator/, chapter: /^9\.2$/, names: [/ir strahler/] },

  // ── 1 Einbruchmeldetechnik ──
  // Narrowest name first, always: "Rauchmelder" also matches "Ansaugrauchmelder", and the
  // first symbol in a chapter that matches at all is the one taken.
  { device: /motion|\bpir\b|bewegung/, chapter: /^1$/, names: [/infrarot bewegungsmelder/, /bewegungsmelder/] },
  { device: /glass|glasbruch/, chapter: /^1$/, names: [/glasbruchmelder passiv/, /glasbruchmelder/] },
  { device: /door.?contact|magnet|reed|oeffnung|öffnung/, chapter: /^1$/, names: [/^magnetkontakt/, /oeffnungskontakt/] },
  { device: /panic|holdup|ueberfall|überfall/, chapter: /^1$/, names: [/ueberfallmelder/] },

  // ── 4 Signalgeber ──
  { device: /strobe|blitz|beacon|optical.?signal/, chapter: /^4$/, names: [/signalgeber optisch/] },
  { device: /siren|sounder|sirene|horn/, chapter: /^4$/, names: [/^sirene/, /signalgeber akustisch/] },

  // ── 5 Brandmeldetechnik ──
  { device: /aspirat|ansaug/, chapter: /^5$/, names: [/ansaugrauchmelder/] },
  { device: /smoke|rauchmelder/, chapter: /^5$/, names: [/^rauchmelder/, /ionisationsrauchmelder/] },
  { device: /heat.?detector|waermemelder|wärmemelder/, chapter: /^5$/, names: [/^waermemelder maximal/, /^waermemelder/] },

  // ── 7 Zentralen ──
  { device: /fire.?panel|\bbma\b|\bbmz\b|brandmelderzentrale/, chapter: /^7$/, names: [/brandmelderzentrale/] },
  { device: /alarm.?panel|intrusion|einbruchmelderzentrale|\bemz\b/, chapter: /^7$/, names: [/einbruchmelderzentrale/, /komb melderzentrale/] },
  { device: /transmitter|uebertragungsgeraet|übertragungsgerät|\batc\b/, chapter: /^7$/, names: [/uebertragungsgeraet/] },

  // ── 10 Zutrittssteuerung ──
  { device: /fingerprint|biometric/, chapter: /^10$/, names: [/fingerprintleser/, /biometrischer leser/] },
  { device: /card.?reader|kartenleser|zutritt|access.?control/, chapter: /^10$/, names: [/zutrittskontrollterminal/, /ausweis- und identifikationssystem/] },
  { device: /pin.?pad|tastatur/, chapter: /^10$/, names: [/pin-tastatur/] },

  // ── 6 Schalteinrichtungen ──
  { device: /keypad|bedienteil|schalteinrichtung/, chapter: /^6$/, names: [/schalteinrichtung geistig/, /schalteinr/] },
  { device: /blockschloss|schluesselschalter|key.?switch/, chapter: /^6$/, names: [/schluesselschalter/] },

  // ── 3 Gefahrenwarnanlage ──
  { device: /water|wasser/, chapter: /^3$/, names: [/wassermelder/] },
  { device: /co.?detector|kohlenmonoxid/, chapter: /^3$/, names: [/gasmelder kohlenmonoxid/] },
  { device: /gas/, chapter: /^3$/, names: [/gasmelder brennbare/, /gasmelder/] },
];

export function defaultSymbolLibraryIdFor(
  deviceType: string | undefined,
  categories: SymbolLibraryCategory[] = loaded,
): string | undefined {
  const type = (deviceType ?? "").toLowerCase();
  if (!type) return undefined;
  for (const rule of ASSIGNMENT_RULES) {
    if (!rule.device.test(type)) continue;
    const chapters = categories.filter((c) => rule.chapter.test(c.no));
    for (const name of rule.names) {
      for (const category of chapters) {
        const symbol = category.symbols.find((s) => name.test(s.name.toLowerCase()));
        if (symbol) return symbol.id;
      }
    }
  }
  return undefined;
}
