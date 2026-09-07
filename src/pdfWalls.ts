/**
 * Walls out of the architect's PDF, so nobody has to trace them.
 *
 * A vector PDF still carries the drawing as geometry, and pdf.js hands that geometry out
 * as an operator list. This module walks it, keeps every straight segment with the layer
 * it was drawn on and the pen it was drawn with, and then turns the segments of a chosen
 * layer into walls.
 *
 * Two things the real plan taught us (e2e/CBC-Osnabrück…pdf, an A1 ground floor at 1:50):
 *
 *  - Walls live on their own layer, "00 CEI Wände" there. Layer choice beats every pen
 *    or length heuristic — the thick pen on that plan belonged to a bar counter, and a
 *    filter by pen would have made the counter a wall.
 *  - A wall is drawn as its two faces: parallel segments a wall's thickness apart. Pairing
 *    them gives the centre line *and* the thickness — 120, 140, 240 and 440 mm come straight
 *    out of that plan — which is exactly the number the Wi-Fi heatmap needs.
 *
 * Coordinates: pdf.js user space is y-up; `convertToViewportPoint` at scale 1 turns it into
 * the y-down point frame the raster underlay was rendered in. From there the sheet is one
 * linear map through the underlay's placement, so however the plan was moved, scaled or
 * re-rendered, a wall lands where the drawing shows it.
 *
 * Everything here is pure over an injected page object, so the unit test drives it with
 * pdf.js's Node build against the real plan while the app passes a page from the web build.
 */

import type { Vec2 } from "./floorplan";
import type { FloorplanUnderlay, FloorplanWall, WallMaterial } from "./types";

/** The slice of pdf.js's PDFPageProxy this module touches. */
export interface PdfPageLike {
  getViewport(opts: { scale: number }): {
    width: number;
    height: number;
    convertToViewportPoint(x: number, y: number): [number, number] | number[];
  };
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  /** pdf.js mixes text items with marked-content markers that carry no `str`. */
  getTextContent(): Promise<{ items: ReadonlyArray<object> }>;
}

/** pdf.js's OPS table — operator name → number. Passed in because both builds export it. */
export type PdfOps = Record<string, number>;

/** One straight piece of the drawing, in the raster's point frame (scale 1, y down). */
export interface PdfSegment {
  a: Vec2;
  b: Vec2;
  /** Pen width on the sheet, in mm. 0 for the edges of a filled shape. */
  lineWidthMm: number;
  filled: boolean;
  layerId?: string;
  layerName?: string;
}

export interface PdfLayerSummary {
  id: string;
  name: string;
  /** Segments drawn on it. */
  count: number;
}

export interface PdfPageGeometry {
  widthPt: number;
  heightPt: number;
  segments: PdfSegment[];
  layers: PdfLayerSummary[];
  /** Drawing scale stated in the page text ("1:50"), as the denominator. */
  scaleDenominator?: number;
}

const PT_TO_MM = 25.4 / 72;

type Matrix = [number, number, number, number, number, number];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): Vec2 {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** The scale an architect states on the sheet, if the text carries one. */
export function detectScaleInText(text: string): number | undefined {
  const m = /\b1\s*:\s*(20|25|50|75|100|125|200|250|500)\b/.exec(text);
  return m ? Number(m[1]) : undefined;
}

/** The layer that holds the walls, by name. Architects are consistent about this one word,
 *  in either language and in both spellings. */
export function guessWallLayer(layers: readonly { id: string; name: string }[]): string | undefined {
  return layers.find((l) => /w[äa]nde|wall|mauer/i.test(l.name))?.id;
}

/** Layer id out of a beginMarkedContentProps argument. pdf.js passes an OCG as
 *  `{ type: "OCG", id }` and a membership dictionary as `{ type: "OCMD", ids }`. */
function layerIdOf(props: unknown): string | undefined {
  if (!props || typeof props !== "object") return undefined;
  const p = props as { id?: unknown; ids?: unknown };
  if (typeof p.id === "string") return p.id;
  if (Array.isArray(p.ids) && typeof p.ids[0] === "string") return p.ids[0];
  return undefined;
}

/**
 * Every straight segment on the page, tagged with layer and pen.
 *
 * Curves are skipped on purpose: a wall is straight, and the curved things on a plan —
 * door swings, furniture, text — are exactly what must not become walls.
 */
export async function extractPdfGeometry(
  page: PdfPageLike,
  OPS: PdfOps,
  layerNames: Record<string, string>,
): Promise<PdfPageGeometry> {
  const viewport = page.getViewport({ scale: 1 });
  const toFrame = (p: Vec2): Vec2 => {
    const [x, y] = viewport.convertToViewportPoint(p.x, p.y);
    return { x, y };
  };

  const ops = await page.getOperatorList();
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let lineWidth = 1;
  const layerStack: (string | undefined)[] = [];
  const segments: PdfSegment[] = [];
  let pending: Vec2[][] = [];

  const flush = (filled: boolean) => {
    const layerId = layerStack[layerStack.length - 1];
    // The pen scales with the CTM like everything else on the page.
    const penMm = filled ? 0 : lineWidth * Math.hypot(ctm[0], ctm[1]) * PT_TO_MM;
    for (const poly of pending) {
      for (let i = 1; i < poly.length; i++) {
        const a = toFrame(poly[i - 1]);
        const b = toFrame(poly[i]);
        if (Math.hypot(b.x - a.x, b.y - a.y) < 0.25) continue;
        segments.push({ a, b, lineWidthMm: penMm, filled, layerId, layerName: layerId ? layerNames[layerId] : undefined });
      }
    }
    pending = [];
  };

  const fillOps = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(args as unknown as Matrix, ctm);
    else if (fn === OPS.setLineWidth) lineWidth = Number(args[0]);
    else if (fn === OPS.beginMarkedContentProps) layerStack.push(layerIdOf(args[1]) ?? layerStack[layerStack.length - 1]);
    else if (fn === OPS.beginMarkedContent) layerStack.push(layerStack[layerStack.length - 1]);
    else if (fn === OPS.endMarkedContent) layerStack.pop();
    else if (fn === OPS.constructPath) {
      const [subOps, coords] = args as [number[], number[]];
      let ci = 0;
      let current: Vec2[] = [];
      let start: Vec2 | null = null;
      for (const op of subOps) {
        if (op === OPS.moveTo) {
          if (current.length > 1) pending.push(current);
          current = [applyMatrix(ctm, coords[ci], coords[ci + 1])];
          start = current[0];
          ci += 2;
        } else if (op === OPS.lineTo) {
          current.push(applyMatrix(ctm, coords[ci], coords[ci + 1]));
          ci += 2;
        } else if (op === OPS.rectangle) {
          const [x, y, w, h] = coords.slice(ci, ci + 4);
          if (current.length > 1) pending.push(current);
          pending.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]].map(([px, py]) => applyMatrix(ctm, px, py)));
          current = [];
          ci += 4;
        } else if (op === OPS.closePath) {
          if (start && current.length) current.push(start);
        } else if (op === OPS.curveTo) {
          // Drop the curve but keep walking from its end point.
          current = [applyMatrix(ctm, coords[ci + 4], coords[ci + 5])];
          ci += 6;
        } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
          current = [applyMatrix(ctm, coords[ci + 2], coords[ci + 3])];
          ci += 4;
        }
      }
      if (current.length > 1) pending.push(current);
    } else if (fn === OPS.stroke || fn === OPS.closeStroke) flush(false);
    else if (fillOps.has(fn)) flush(true);
    else if (fn === OPS.endPath) pending = [];
  }

  const counts = new Map<string, number>();
  for (const s of segments) if (s.layerId) counts.set(s.layerId, (counts.get(s.layerId) ?? 0) + 1);
  const layers: PdfLayerSummary[] = Object.entries(layerNames).map(([id, name]) => ({ id, name, count: counts.get(id) ?? 0 }));

  let scaleDenominator: number | undefined;
  try {
    const text = await page.getTextContent();
    scaleDenominator = detectScaleInText(text.items.map((it) => (it as { str?: string }).str ?? "").join(" "));
  } catch {
    // A page without a text layer states no scale; nothing to detect.
  }

  return { widthPt: viewport.width, heightPt: viewport.height, segments, layers, scaleDenominator };
}

/** One wall the drawing yields, on the sheet. */
export interface WallCandidate {
  pointsMm: [Vec2, Vec2];
  /** Real thickness read off the two faces; undefined when only one face was found. */
  thicknessMm?: number;
}

export interface WallsFromGeometryOptions {
  /** Layers to take walls from. Undefined = every layer, for a plan without a wall layer. */
  layerIds?: ReadonlySet<string>;
  /** How the raster sits on the sheet — the map from point frame to paper mm. */
  underlay: Pick<FloorplanUnderlay, "positionMm" | "sizeMm">;
  /** Frame size in points, from the geometry. */
  frame: { widthPt: number; heightPt: number };
  scaleDenominator: number;
  /** Shortest wall worth keeping, real mm. Door jambs and ticks fall below it. */
  minLengthMm?: number;
  /** Real thicknesses a pair of faces may be apart. */
  thicknessRangeMm?: [number, number];
}

interface SheetSegment {
  a: Vec2;
  b: Vec2;
  lengthMm: number;
  angle: number;
}

/**
 * Walls from the page's segments: pair each face with the parallel face across from it,
 * take the middle as the wall and the gap as its thickness. A face with no partner is
 * still a wall — a half-drawn one, and better placed without a thickness than missing.
 */
export function wallsFromGeometry(
  geometry: Pick<PdfPageGeometry, "segments">,
  opts: WallsFromGeometryOptions,
): { walls: WallCandidate[]; paired: number; unpaired: number } {
  const { underlay, frame, scaleDenominator } = opts;
  const minLengthMm = opts.minLengthMm ?? 150;
  const [minT, maxT] = opts.thicknessRangeMm ?? [50, 600];
  // Point frame → paper mm. One factor: the underlay keeps the page's aspect.
  const k = underlay.sizeMm.w / frame.widthPt;
  const toSheet = (p: Vec2): Vec2 => ({ x: underlay.positionMm.x + p.x * k, y: underlay.positionMm.y + p.y * k });
  // Real mm → paper mm.
  const paper = (realMm: number) => realMm / scaleDenominator;

  const segs: SheetSegment[] = [];
  for (const s of geometry.segments) {
    if (opts.layerIds && (!s.layerId || !opts.layerIds.has(s.layerId))) continue;
    const a = toSheet(s.a), b = toSheet(s.b);
    const lengthMm = Math.hypot(b.x - a.x, b.y - a.y) * scaleDenominator;
    if (lengthMm < minLengthMm) continue;
    segs.push({ a, b, lengthMm, angle: Math.atan2(b.y - a.y, b.x - a.x) });
  }

  const consumed = new Array<boolean>(segs.length).fill(false);
  const walls: WallCandidate[] = [];
  let paired = 0;

  for (let i = 0; i < segs.length; i++) {
    if (consumed[i]) continue;
    const s = segs[i];
    const ux = (s.b.x - s.a.x), uy = (s.b.y - s.a.y);
    const len = Math.hypot(ux, uy);
    const dx = ux / len, dy = uy / len;
    const project = (p: Vec2) => (p.x - s.a.x) * dx + (p.y - s.a.y) * dy;
    const offsetOf = (p: Vec2) => -(p.x - s.a.x) * dy + (p.y - s.a.y) * dx;

    let best = -1;
    let bestOffset = Infinity;
    for (let j = 0; j < segs.length; j++) {
      if (j === i || consumed[j]) continue;
      const o = segs[j];
      let d = Math.abs(s.angle - o.angle) % Math.PI;
      d = Math.min(d, Math.PI - d);
      if (d > (1.5 * Math.PI) / 180) continue;
      const off = Math.abs(offsetOf(o.a));
      if (off < paper(minT) || off > paper(maxT)) continue;
      const [p0, p1] = [project(o.a), project(o.b)].sort((x, y) => x - y);
      const overlap = Math.min(len, p1) - Math.max(0, p0);
      // Faces of one wall run alongside each other; a face that barely overlaps belongs
      // to the next wall along.
      if (overlap < 0.5 * Math.min(len, p1 - p0)) continue;
      if (off < bestOffset) { bestOffset = off; best = j; }
    }

    if (best >= 0) {
      const o = segs[best];
      consumed[i] = consumed[best] = true;
      paired++;
      // The wall runs over the union of both faces, on the line between them.
      const ts = [0, len, project(o.a), project(o.b)];
      const t0 = Math.min(...ts), t1 = Math.max(...ts);
      const side = Math.sign(offsetOf(o.a)) || 1;
      const half = bestOffset / 2;
      const mid = (t: number): Vec2 => ({
        x: s.a.x + dx * t - dy * half * side,
        y: s.a.y + dy * t + dx * half * side,
      });
      walls.push({ pointsMm: [mid(t0), mid(t1)], thicknessMm: Math.round((bestOffset * scaleDenominator) / 5) * 5 });
    } else {
      consumed[i] = true;
      walls.push({ pointsMm: [s.a, s.b] });
    }
  }

  return { walls, paired, unpaired: walls.length - paired };
}

/**
 * Candidates laid over the plan for picking one by one — the path for a plan whose walls
 * have no layer of their own. Transient UI state, never saved: the walls that get picked
 * are what persists.
 */
export interface WallCandidateSet {
  candidates: WallCandidate[];
  material: WallMaterial;
  /** Thickness for a candidate the drawing gave none — the plan's most common one. */
  defaultThicknessMm: number;
  /** What was extracted, for the panel: "00 CEI Wände" or "alle Ebenen". */
  sourceLabel: string;
}

/** Wall records ready for the store, with the defaults filled in where the drawing gave
 *  no thickness. */
export function toFloorplanWalls(
  candidates: readonly WallCandidate[],
  material: WallMaterial,
  defaultThicknessMm: number,
): Omit<FloorplanWall, "id">[] {
  return candidates.map((c) => ({
    pointsMm: [{ ...c.pointsMm[0] }, { ...c.pointsMm[1] }],
    material,
    thicknessMm: c.thicknessMm ?? defaultThicknessMm,
  }));
}

/** Thickness histogram in 5 mm steps — what the import dialog shows so a wrong scale is
 *  obvious before anything lands on the plan. */
export function thicknessHistogram(candidates: readonly WallCandidate[]): { thicknessMm: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const c of candidates) if (c.thicknessMm) counts.set(c.thicknessMm, (counts.get(c.thicknessMm) ?? 0) + 1);
  return [...counts.entries()].map(([thicknessMm, count]) => ({ thicknessMm, count })).sort((a, b) => b.count - a.count);
}
