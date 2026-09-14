/**
 * Räume aus den Wänden: aus einem Klick ins Rauminnere wird ein Polygon.
 *
 * Die Wände liegen bereits im Plan — als Mittellinien mit realer Dicke, gelesen aus der
 * Ebene des Architekten (`pdfWalls.ts`). Was fehlt, ist die Fläche dazwischen. Sie wird
 * hier nicht aus einem Graphen der Wandsegmente gebildet, sondern gerastert und geflutet:
 *
 *   1. Wände in ein Raster stempeln, jede mit ihrer echten Dicke
 *   2. vom Saatpunkt aus fluten, bis die Wände die Ausbreitung stoppen
 *   3. den Rand der gefluteten Fläche ablaufen und den Streckenzug vereinfachen
 *
 * **Warum Raster und nicht Graph.** Ein planarer Graph liefert exakte Polygone — und
 * scheitert an einer 2-mm-Lücke, wo zwei Wandzüge nicht ganz aneinanderstoßen. Genau die
 * gibt es in jedem Architektenplan, und sie ist mit bloßem Auge nicht zu sehen. Das
 * Fluten verzeiht sie, sobald man die Wände ein wenig dicker stempelt, als sie sind
 * (`bridgeGapsMm`). Für eine Lichtrechnung ist ein Polygon auf fünf Zentimeter genau
 * ohnehin mehr als genug: gebraucht wird, welche Rasterpunkte im Raum liegen, wie groß
 * der Boden ist und wo die Umrandung gezeichnet wird.
 *
 * **Was herauskommt, ist ein Vorschlag.** Läuft die Flut bis an den Blattrand, war der
 * Raum nicht geschlossen — dann kommt kein Polygon zurück, sondern die Auskunft, dass die
 * Flut ausgelaufen ist. Bestätigt und korrigiert wird im Editor; das ist die Entscheidung
 * aus dem Plan und keine Einschränkung dieses Moduls.
 *
 * Koordinaten wie überall auf dem Blatt: Papier-Millimeter. Wanddicken sind reale
 * Millimeter und werden über den Maßstab umgerechnet.
 */

import type { FloorplanWall } from "./types";
import type { Vec2 } from "./floorplan";

/** Kantenlänge einer Rasterzelle in Papier-mm. Bei 1:50 sind 2 mm zehn reale Zentimeter —
 *  fein genug für einen Raumumriss und grob genug, um ein A1-Blatt in Millisekunden zu
 *  rastern. */
export const DEFAULT_ROOM_CELL_MM = 2;

/** Wie viel dicker die Wände gestempelt werden, in realen mm je Seite. Schließt die
 *  Haarrisse, an denen ein exaktes Verfahren scheitert, ohne eine Tür zuzumauern. */
export const DEFAULT_BRIDGE_GAPS_MM = 60;

export interface RoomSuggestOptions {
  scaleDenominator: number;
  /** Der Ausschnitt, in dem gesucht wird — üblicherweise die Zeichenfläche der Seite. */
  area: { x: number; y: number; w: number; h: number };
  cellMm?: number;
  bridgeGapsMm?: number;
}

export type RoomSuggestion =
  | { ok: true; pointsMm: Vec2[]; areaMm2: number; cellMm: number }
  | { ok: false; reason: "outside" | "on-wall" | "leaked" | "too-small" };

/** Fläche eines Polygons in Papier-mm², über die Trapezformel. Vorzeichenfrei. */
export function polygonAreaMm2(points: readonly Vec2[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Liegt der Punkt im Polygon? Strahlverfahren, Kanten zählen als innen genug — für ein
 *  Lux-Raster spielt ein Punkt genau auf der Wand keine Rolle. */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Umfang eines geschlossenen Streckenzugs in Papier-mm. */
export function polygonPerimeterMm(points: readonly Vec2[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/** Abstand eines Punktes zu einer Strecke, in derselben Einheit wie die Eingabe. */
function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

interface Grid {
  cols: number;
  rows: number;
  cellMm: number;
  originMm: Vec2;
  /** 1 = Wand. */
  wall: Uint8Array;
}

/**
 * Die Wände in ein Raster stempeln.
 *
 * Es wird über die Segmente gelaufen und je Segment nur dessen Umgebung geprüft, nicht
 * für jede Zelle über alle Wände — sonst wäre ein A1-Blatt mit ein paar hundert
 * Wandsegmenten eine Millionenrechnung.
 */
export function rasterizeWalls(
  walls: readonly FloorplanWall[],
  opts: Required<Pick<RoomSuggestOptions, "scaleDenominator" | "area" | "cellMm" | "bridgeGapsMm">>,
): Grid {
  const { area, cellMm } = opts;
  const cols = Math.max(1, Math.ceil(area.w / cellMm) + 1);
  const rows = Math.max(1, Math.ceil(area.h / cellMm) + 1);
  const wall = new Uint8Array(cols * rows);
  const origin = { x: area.x, y: area.y };
  // Dicken sind real, das Raster ist Papier: durch den Maßstab teilen.
  const scale = opts.scaleDenominator > 0 ? opts.scaleDenominator : 1;
  const bridgePaperMm = Math.max(0, opts.bridgeGapsMm) / scale;

  for (const w of walls) {
    if (w.hidden) continue;
    const halfPaperMm = Math.max(0, w.thicknessMm) / 2 / scale + bridgePaperMm;
    const pts = w.pointsMm;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const minX = Math.min(a.x, b.x) - halfPaperMm;
      const maxX = Math.max(a.x, b.x) + halfPaperMm;
      const minY = Math.min(a.y, b.y) - halfPaperMm;
      const maxY = Math.max(a.y, b.y) + halfPaperMm;
      const c0 = Math.max(0, Math.floor((minX - origin.x) / cellMm));
      const c1 = Math.min(cols - 1, Math.ceil((maxX - origin.x) / cellMm));
      const r0 = Math.max(0, Math.floor((minY - origin.y) / cellMm));
      const r1 = Math.min(rows - 1, Math.ceil((maxY - origin.y) / cellMm));
      for (let r = r0; r <= r1; r++) {
        const y = origin.y + r * cellMm;
        for (let c = c0; c <= c1; c++) {
          const idx = r * cols + c;
          if (wall[idx]) continue;
          if (distanceToSegment({ x: origin.x + c * cellMm, y }, a, b) <= halfPaperMm) wall[idx] = 1;
        }
      }
    }
  }
  return { cols, rows, cellMm, originMm: origin, wall };
}

/**
 * Vom Saatpunkt aus fluten, solange keine Wand im Weg ist.
 *
 * Vierfach verbunden, nicht achtfach: diagonal darf die Flut nicht durch eine Wandecke
 * schlüpfen, die nur über Eck berührt.
 */
function floodFill(grid: Grid, seedCol: number, seedRow: number): { filled: Uint8Array; leaked: boolean; count: number } {
  const { cols, rows, wall } = grid;
  const filled = new Uint8Array(cols * rows);
  const seedIdx = seedRow * cols + seedCol;
  if (wall[seedIdx]) return { filled, leaked: false, count: 0 };

  const stack = [seedIdx];
  filled[seedIdx] = 1;
  let count = 0;
  let leaked = false;
  while (stack.length > 0) {
    const idx = stack.pop()!;
    count++;
    const c = idx % cols;
    const r = (idx - c) / cols;
    // Erreicht die Flut den Rand des Ausschnitts, war der Raum nicht geschlossen.
    if (c === 0 || r === 0 || c === cols - 1 || r === rows - 1) leaked = true;
    if (c > 0 && !wall[idx - 1] && !filled[idx - 1]) { filled[idx - 1] = 1; stack.push(idx - 1); }
    if (c < cols - 1 && !wall[idx + 1] && !filled[idx + 1]) { filled[idx + 1] = 1; stack.push(idx + 1); }
    if (r > 0 && !wall[idx - cols] && !filled[idx - cols]) { filled[idx - cols] = 1; stack.push(idx - cols); }
    if (r < rows - 1 && !wall[idx + cols] && !filled[idx + cols]) { filled[idx + cols] = 1; stack.push(idx + cols); }
  }
  return { filled, leaked, count };
}

/**
 * Den Rand der gefluteten Fläche ablaufen (Moore-Nachbarschaft mit Jacobs
 * Abbruchbedingung) und als Kette von Zellkoordinaten zurückgeben.
 */
function traceBoundary(filled: Uint8Array, cols: number, rows: number): { c: number; r: number }[] {
  const at = (c: number, r: number) => (c < 0 || r < 0 || c >= cols || r >= rows ? 0 : filled[r * cols + c]);
  // Startzelle: die erste gefüllte in Lesereihenfolge; sie hat garantiert keinen gefüllten
  // Nachbarn links oder darüber und liegt damit auf dem äußeren Rand.
  let start = -1;
  for (let i = 0; i < filled.length; i++) if (filled[i]) { start = i; break; }
  if (start < 0) return [];
  const startC = start % cols;
  const startR = (start - startC) / cols;

  // Im Uhrzeigersinn, beginnend links vom Startpunkt.
  const dirs = [
    { dc: -1, dr: 0 }, { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
    { dc: 1, dr: 0 }, { dc: 1, dr: 1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 1 },
  ];
  const chain: { c: number; r: number }[] = [{ c: startC, r: startR }];
  let cur = { c: startC, r: startR };
  let backtrack = 0; // Richtung, aus der wir gekommen sind
  const maxSteps = filled.length * 4;

  for (let step = 0; step < maxSteps; step++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = dirs[(backtrack + k) % 8];
      const nc = cur.c + d.dc;
      const nr = cur.r + d.dr;
      if (at(nc, nr)) {
        // Die Gegenrichtung ist der neue Ausgangspunkt der Suche, ein Feld zurückgedreht.
        backtrack = ((backtrack + k) + 5) % 8;
        cur = { c: nc, r: nr };
        found = true;
        break;
      }
    }
    if (!found) break; // einzelne Zelle ohne Nachbarn
    if (cur.c === startC && cur.r === startR) break;
    chain.push(cur);
  }
  return chain;
}

/** Douglas-Peucker: den Streckenzug auf seine tragenden Punkte eindampfen. */
export function simplifyPolyline(points: readonly Vec2[], toleranceMm: number): Vec2[] {
  if (points.length < 3) return [...points];
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], first, last);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist <= toleranceMm) return [first, last];
  const left = simplifyPolyline(points.slice(0, index + 1), toleranceMm);
  const right = simplifyPolyline(points.slice(index), toleranceMm);
  return [...left.slice(0, -1), ...right];
}

/**
 * Aus einem Punkt im Rauminneren einen Polygonvorschlag machen.
 *
 * Fehlschläge sind hier normale Antworten und keine Ausnahmen: „daneben geklickt",
 * „direkt auf eine Wand geklickt", „der Raum ist nicht geschlossen" sind allesamt Dinge,
 * die der Nutzer erfährt und behebt, nicht Dinge, die abstürzen.
 */
export function suggestRoomPolygon(
  walls: readonly FloorplanWall[],
  seedMm: Vec2,
  opts: RoomSuggestOptions,
): RoomSuggestion {
  const cellMm = opts.cellMm ?? DEFAULT_ROOM_CELL_MM;
  const bridgeGapsMm = opts.bridgeGapsMm ?? DEFAULT_BRIDGE_GAPS_MM;
  const { area } = opts;
  if (seedMm.x < area.x || seedMm.y < area.y || seedMm.x > area.x + area.w || seedMm.y > area.y + area.h) {
    return { ok: false, reason: "outside" };
  }

  const grid = rasterizeWalls(walls, { scaleDenominator: opts.scaleDenominator, area, cellMm, bridgeGapsMm });
  const seedCol = Math.round((seedMm.x - area.x) / cellMm);
  const seedRow = Math.round((seedMm.y - area.y) / cellMm);
  if (grid.wall[seedRow * grid.cols + seedCol]) return { ok: false, reason: "on-wall" };

  const { filled, leaked, count } = floodFill(grid, seedCol, seedRow);
  if (leaked) return { ok: false, reason: "leaked" };
  // Unter etwa einem halben Quadratmeter Papier ist das kein Raum, sondern eine Fuge
  // zwischen zwei Wandzügen.
  if (count < 16) return { ok: false, reason: "too-small" };

  const chain = traceBoundary(filled, grid.cols, grid.rows);
  if (chain.length < 4) return { ok: false, reason: "too-small" };
  const pts: Vec2[] = chain.map(({ c, r }) => ({ x: area.x + c * cellMm, y: area.y + r * cellMm }));
  // Toleranz von zwei Zellen: nimmt der Kontur die Treppenstufen, ohne eine Nische zu
  // schlucken.
  const simplified = simplifyPolyline([...pts, pts[0]], cellMm * 2);
  // Der Schlusspunkt wiederholt den ersten — Polygone werden hier implizit geschlossen.
  if (simplified.length > 1) simplified.pop();
  if (simplified.length < 3) return { ok: false, reason: "too-small" };

  return { ok: true, pointsMm: simplified, areaMm2: polygonAreaMm2(simplified), cellMm };
}
