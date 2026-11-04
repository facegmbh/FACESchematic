/**
 * Drawing a parsed DXF as an SVG.
 *
 * Two steps, kept apart on purpose. flattenDxf resolves everything that is DXF-specific —
 * blocks placed inside blocks, base points, layer 0 inheriting the INSERT's layer, bulges,
 * the crossed corner order of a SOLID — into plain shapes in drawing coordinates. The SVG
 * step after it only flips y and formats numbers. That way the placement maths, which is
 * where real drawings go wrong, is testable in the units the DXF states.
 *
 * Units, because the parser mixes them: ARC angles arrive in radians (the parser converts),
 * ELLIPSE start/end are parameters in radians (native DXF), TEXT/MTEXT/INSERT rotations
 * stay in degrees.
 */
import type { IBlock, IEntity, IPoint } from "dxf-parser";
import {
  MAX_BLOCK_DEPTH,
  applyTransform,
  blockBase,
  blockNameOf,
  insertTransform,
  type DxfDrawing,
  type DxfTransform,
} from "./parse";

type Pt = { x: number; y: number };

export type DxfArcSeg = { to: Pt; arc: { r: number; large: boolean; ccw: boolean } };
export type DxfSeg = { to: Pt } | DxfArcSeg;

export const isArcSeg = (seg: DxfSeg | undefined): seg is DxfArcSeg => Boolean(seg) && "arc" in seg!;

export type DxfShape =
  | { kind: "path"; start: Pt; segs: DxfSeg[]; closed: boolean }
  | { kind: "fill"; points: Pt[] }
  | {
    kind: "text";
    at: Pt;
    lines: string[];
    height: number;
    /** Degrees, counter-clockwise, as DXF counts them. */
    rotation: number;
    anchor: "start" | "middle" | "end";
    baseline: "alphabetic" | "middle" | "hanging";
  };

export interface DxfFlattenOptions {
  /** Layers left out — the import dialog's unticked ones. */
  hiddenLayers?: ReadonlySet<string>;
}

export interface DxfFlattenResult {
  shapes: DxfShape[];
  /** Entities that were not drawn, by type. A drawing full of a type we skip says so here. */
  skipped: Record<string, number>;
}

const IDENTITY: DxfTransform = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };

/** How finely a curve is sampled when it cannot stay a true arc: 5° per step. */
const STEPS_PER_TURN = 72;

interface Ctx {
  shapes: DxfShape[];
  skipped: Record<string, number>;
  hidden: ReadonlySet<string>;
  blocks: Record<string, IBlock>;
}

export function flattenDxf(drawing: DxfDrawing, options: DxfFlattenOptions = {}): DxfFlattenResult {
  const ctx: Ctx = { shapes: [], skipped: {}, hidden: options.hiddenLayers ?? new Set(), blocks: drawing.blocks };
  walk(drawing.entities, ctx, IDENTITY, undefined, 0);
  return { shapes: ctx.shapes, skipped: ctx.skipped };
}

function walk(entities: IEntity[], ctx: Ctx, t: DxfTransform, inheritedLayer: string | undefined, depth: number): void {
  for (const e of entities) {
    // DXF's own rule: inside a block, layer 0 means "whatever layer the block is placed on".
    const layer = (!e.layer || e.layer === "0") && inheritedLayer ? inheritedLayer : e.layer || "0";
    if (ctx.hidden.has(layer)) continue;
    drawEntity(e, ctx, t, layer, depth);
  }
}

function skip(ctx: Ctx, type: string): void {
  ctx.skipped[type] = (ctx.skipped[type] ?? 0) + 1;
}

function drawEntity(e: IEntity, ctx: Ctx, t: DxfTransform, layer: string, depth: number): void {
  const f = e as unknown as Record<string, unknown>;
  switch (e.type) {
    case "LINE": {
      const v = f.vertices as IPoint[] | undefined;
      if (v && v.length >= 2) pushPoly(ctx, [v[0], v[1]], false, t);
      return;
    }
    case "LWPOLYLINE":
    case "POLYLINE":
      return polyline(ctx, (f.vertices as (IPoint & { bulge?: number })[]) ?? [], Boolean(f.shape), ocs(e, t));
    case "CIRCLE":
      return circle(ctx, f.center as IPoint, f.radius as number, ocs(e, t));
    case "ARC":
      return arc(ctx, f.center as IPoint, f.radius as number, f.startAngle as number, f.endAngle as number, ocs(e, t));
    case "ELLIPSE":
      return ellipse(ctx, f, t);
    case "SPLINE": {
      const fit = f.fitPoints as IPoint[] | undefined;
      const pts = fit && fit.length >= 2 ? fit : (f.controlPoints as IPoint[] | undefined) ?? [];
      if (pts.length >= 2) pushPoly(ctx, pts, Boolean(f.closed), t);
      return;
    }
    case "SOLID":
      return solid(ctx, (f.points as IPoint[] | undefined) ?? [], t);
    case "TEXT":
      return text(ctx, f, t);
    case "MTEXT":
      return mtext(ctx, f, t);
    case "INSERT":
      return insert(e, ctx, t, layer, depth);
    case "DIMENSION": {
      // The dimension's lines, arrows and figure live in an anonymous block that is already
      // in world coordinates.
      const name = blockNameOf(e);
      const block = name ? ctx.blocks[name] : undefined;
      if (block?.entities && depth < MAX_BLOCK_DEPTH) walk(block.entities, ctx, t, layer, depth + 1);
      else skip(ctx, e.type);
      return;
    }
    default:
      // POINT is nearly always a construction point, HATCH is not parsed at all, 3DFACE has
      // no place on a floor plan. Counted, so a drawing that is mostly one of them says so.
      skip(ctx, e.type);
  }
}

// ── Transforms ──────────────────────────────────────────────────────

/** Same shape at every angle: arcs can stay arcs. Uneven scale turns circles into ellipses,
 *  which SVG arcs here are not, so those get sampled. */
function isSimilar(t: DxfTransform): boolean {
  const a = Math.abs(t.sx);
  const b = Math.abs(t.sy);
  return Math.abs(a - b) <= 1e-9 * Math.max(a, b, 1);
}

const isMirrored = (t: DxfTransform) => t.sx * t.sy < 0;

/** An entity drawn with its extrusion pointing down (Z = -1) is stored mirrored in x —
 *  CAD programs write mirrored arcs that way. Flipping the transform's x puts it back. */
function ocs(e: IEntity, t: DxfTransform): DxfTransform {
  const f = e as unknown as { extrusionDirectionZ?: number; extrusionDirection?: IPoint };
  const z = f.extrusionDirectionZ ?? f.extrusionDirection?.z;
  return typeof z === "number" && z < 0 ? { ...t, sx: -t.sx } : t;
}

const T = (p: Pt, t: DxfTransform): Pt => applyTransform(p, t);
const valid = <P extends Pt>(p: P | undefined): p is P =>
  Boolean(p) && Number.isFinite(p!.x) && Number.isFinite(p!.y);

// ── Shapes ──────────────────────────────────────────────────────────

function pushPoly(ctx: Ctx, pts: Pt[], closed: boolean, t: DxfTransform): void {
  const usable = pts.filter(valid);
  if (usable.length < 2) return;
  ctx.shapes.push({
    kind: "path",
    start: T(usable[0], t),
    segs: usable.slice(1).map((p) => ({ to: T(p, t) })),
    closed,
  });
}

/** Points along a circle from angle a0, turning by `sweep` radians (positive = ccw), without
 *  the starting point itself. */
function sampleArc(c: Pt, r: number, a0: number, sweep: number): Pt[] {
  const steps = Math.max(4, Math.ceil((Math.abs(sweep) / (2 * Math.PI)) * STEPS_PER_TURN));
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const a = a0 + (sweep * i) / steps;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
}

/** Counter-clockwise sweep from a0 to a1, in (0, 2π]. Equal angles mean a full turn. */
function ccwSweep(a0: number, a1: number): number {
  const turn = 2 * Math.PI;
  const s = (((a1 - a0) % turn) + turn) % turn;
  return s === 0 ? turn : s;
}

function polyline(ctx: Ctx, vertices: (IPoint & { bulge?: number })[], closed: boolean, t: DxfTransform): void {
  const v = vertices.filter(valid);
  if (v.length < 2) return;
  const similar = isSimilar(t);
  const segs: DxfSeg[] = [];
  // The edge back to the first vertex is left to the path's "close" when it is straight.
  // When the last vertex carries a bulge it is an arc, and closing would draw it straight —
  // a round column drawn as two half circles would come out as a half circle and a line.
  const closesWithArc = closed && Boolean(v[v.length - 1].bulge);
  const count = closesWithArc ? v.length : v.length - 1;
  for (let i = 0; i < count; i++) {
    const p = v[i];
    const q = v[(i + 1) % v.length];
    const b = p.bulge ?? 0;
    if (!b) {
      segs.push({ to: T(q, t) });
      continue;
    }
    // A bulge is tan(θ/4) of the arc between two vertices; positive runs counter-clockwise.
    const theta = 4 * Math.atan(Math.abs(b));
    const chord = Math.hypot(q.x - p.x, q.y - p.y);
    if (chord === 0) continue;
    const r = chord / (2 * Math.sin(theta / 2));
    const ccw = b > 0;
    if (similar) {
      segs.push({
        to: T(q, t),
        arc: { r: r * Math.abs(t.sx), large: theta > Math.PI, ccw: isMirrored(t) ? !ccw : ccw },
      });
      continue;
    }
    // Uneven scale: walk the arc in its own coordinates, then place every point.
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const left = { x: -(q.y - p.y) / chord, y: (q.x - p.x) / chord };
    const offset = ((chord / 2) / Math.tan(theta / 2)) * (ccw ? 1 : -1);
    const c = { x: mid.x + left.x * offset, y: mid.y + left.y * offset };
    const a0 = Math.atan2(p.y - c.y, p.x - c.x);
    for (const s of sampleArc(c, r, a0, ccw ? theta : -theta)) segs.push({ to: T(s, t) });
  }
  if (segs.length > 0) ctx.shapes.push({ kind: "path", start: T(v[0], t), segs, closed });
}

function circle(ctx: Ctx, c: IPoint | undefined, r: number, t: DxfTransform): void {
  if (!valid(c) || !(r > 0)) return;
  const start = { x: c.x + r, y: c.y };
  if (isSimilar(t)) {
    const arcOf = { r: r * Math.abs(t.sx), large: false, ccw: !isMirrored(t) };
    ctx.shapes.push({
      kind: "path",
      start: T(start, t),
      segs: [{ to: T({ x: c.x - r, y: c.y }, t), arc: arcOf }, { to: T(start, t), arc: arcOf }],
      closed: true,
    });
    return;
  }
  pushPoly(ctx, [start, ...sampleArc(c, r, 0, 2 * Math.PI)], true, t);
}

function arc(ctx: Ctx, c: IPoint | undefined, r: number, a0: number, a1: number, t: DxfTransform): void {
  if (!valid(c) || !(r > 0) || !Number.isFinite(a0) || !Number.isFinite(a1)) return;
  const sweep = ccwSweep(a0, a1);
  const start = { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) };
  if (isSimilar(t)) {
    const end = { x: c.x + r * Math.cos(a1), y: c.y + r * Math.sin(a1) };
    ctx.shapes.push({
      kind: "path",
      start: T(start, t),
      segs: [{ to: T(end, t), arc: { r: r * Math.abs(t.sx), large: sweep > Math.PI, ccw: !isMirrored(t) } }],
      closed: false,
    });
    return;
  }
  pushPoly(ctx, [start, ...sampleArc(c, r, a0, sweep)], false, t);
}

function ellipse(ctx: Ctx, f: Record<string, unknown>, t: DxfTransform): void {
  const c = f.center as IPoint | undefined;
  const major = f.majorAxisEndPoint as IPoint | undefined;
  const ratio = f.axisRatio as number;
  if (!valid(c) || !valid(major) || !(ratio > 0)) return;
  const s = Number.isFinite(f.startAngle) ? (f.startAngle as number) : 0;
  const e = Number.isFinite(f.endAngle) ? (f.endAngle as number) : 2 * Math.PI;
  const sweep = ccwSweep(s, e);
  const minor = { x: -major.y * ratio, y: major.x * ratio };
  const at = (u: number) => ({
    x: c.x + major.x * Math.cos(u) + minor.x * Math.sin(u),
    y: c.y + major.y * Math.cos(u) + minor.y * Math.sin(u),
  });
  const steps = Math.max(16, Math.ceil((sweep / (2 * Math.PI)) * STEPS_PER_TURN));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) pts.push(at(s + (sweep * i) / steps));
  const full = Math.abs(sweep - 2 * Math.PI) < 1e-9;
  pushPoly(ctx, full ? pts.slice(0, -1) : pts, full, t);
}

function solid(ctx: Ctx, points: IPoint[], t: DxfTransform): void {
  const p = points.filter(valid);
  if (p.length < 3) return;
  // DXF lists a SOLID's corners as 1, 2, 4, 3. Drawn in the order given, a square is a
  // bow tie; the fourth corner is optional, and equal to the third for a triangle.
  const ordered = p.length >= 4 && (p[3].x !== p[2].x || p[3].y !== p[2].y) ? [p[0], p[1], p[3], p[2]] : [p[0], p[1], p[2]];
  ctx.shapes.push({ kind: "fill", points: ordered.map((q) => T(q, t)) });
}

// ── Text ────────────────────────────────────────────────────────────

/** The %% codes AutoCAD writes for characters a plain-text field cannot hold. */
function decodePercentCodes(s: string): string {
  return s
    .replace(/%%[cC]/g, "Ø")
    .replace(/%%[dD]/g, "°")
    .replace(/%%[pP]/g, "±")
    .replace(/%%[uUoO]/g, "") // underline / overline toggles
    .replace(/%%%/g, "%");
}

/** MTEXT carries inline formatting — fonts, heights, colours, stacked fractions. A backdrop
 *  wants the words, so the codes go and the line breaks stay. */
export function decodeMtext(raw: string): string {
  const OPEN = "\u0000";
  const CLOSE = "\u0001";
  const BACKSLASH = "\u0002";
  return decodePercentCodes(
    raw
      .replace(/\\\\/g, BACKSLASH)
      .replace(/\\\{/g, OPEN)
      .replace(/\\\}/g, CLOSE)
      .replace(/\\P/g, "\n")
      .replace(/\\~/g, " ")
      .replace(/\\S([^^/#;]*)[\^/#]([^;]*);/g, "$1/$2")
      .replace(/\\[ACFfHQTWpa][^;]*;/g, "")
      .replace(/\\[LlOoKkNX]/g, "")
      .replace(/[{}]/g, "")
      .replace(new RegExp(OPEN, "g"), "{")
      .replace(new RegExp(CLOSE, "g"), "}")
      .replace(new RegExp(BACKSLASH, "g"), "\\"),
  );
}

const ANCHOR_BY_HALIGN: Record<number, "start" | "middle" | "end"> = { 0: "start", 1: "middle", 2: "end", 4: "middle" };
const BASELINE_BY_VALIGN: Record<number, "alphabetic" | "middle" | "hanging"> = { 0: "alphabetic", 1: "alphabetic", 2: "middle", 3: "hanging" };

function pushText(ctx: Ctx, at: Pt, lines: string[], height: number, rotation: number, t: DxfTransform,
  anchor: "start" | "middle" | "end", baseline: "alphabetic" | "middle" | "hanging"): void {
  const kept = lines.filter((l) => l.trim().length > 0);
  if (kept.length === 0 || !(height > 0)) return;
  ctx.shapes.push({
    kind: "text",
    at: T(at, t),
    lines: kept,
    // A block scaled by 2 writes its labels twice as large; mirroring is ignored on purpose
    // — a mirrored door's room number should still read the right way round.
    height: height * Math.abs(t.sy),
    rotation: rotation + t.rot,
    anchor,
    baseline,
  });
}

function text(ctx: Ctx, f: Record<string, unknown>, t: DxfTransform): void {
  const halign = (f.halign as number | undefined) ?? 0;
  const valign = (f.valign as number | undefined) ?? 0;
  // Any alignment other than plain left/baseline is measured from the second point.
  const aligned = (halign !== 0 || valign !== 0) && valid(f.endPoint as IPoint | undefined);
  const at = (aligned ? f.endPoint : f.startPoint) as IPoint | undefined;
  if (!valid(at) || typeof f.text !== "string") return;
  pushText(ctx, at, [decodePercentCodes(f.text)], f.textHeight as number, (f.rotation as number) ?? 0, t,
    ANCHOR_BY_HALIGN[halign] ?? "start", BASELINE_BY_VALIGN[valign] ?? "alphabetic");
}

function mtext(ctx: Ctx, f: Record<string, unknown>, t: DxfTransform): void {
  const at = f.position as IPoint | undefined;
  if (!valid(at) || typeof f.text !== "string") return;
  const dir = f.directionVector as IPoint | undefined;
  const rotation = Number.isFinite(f.rotation)
    ? (f.rotation as number)
    : valid(dir) ? (Math.atan2(dir.y, dir.x) * 180) / Math.PI : 0;
  // Attachment points 1–9 read like a phone keypad: top-left to bottom-right.
  const ap = (f.attachmentPoint as number | undefined) ?? 1;
  const col = (ap - 1) % 3;
  const row = Math.floor((ap - 1) / 3);
  pushText(ctx, at, decodeMtext(f.text).split("\n"), f.height as number, rotation, t,
    col === 0 ? "start" : col === 1 ? "middle" : "end",
    row === 0 ? "hanging" : row === 1 ? "middle" : "alphabetic");
}

// ── Blocks ──────────────────────────────────────────────────────────

function insert(e: IEntity, ctx: Ctx, t: DxfTransform, layer: string, depth: number): void {
  const name = blockNameOf(e);
  const block = name ? ctx.blocks[name] : undefined;
  if (!block?.entities || depth >= MAX_BLOCK_DEPTH) {
    skip(ctx, "INSERT");
    return;
  }
  const f = e as unknown as {
    position?: IPoint;
    rotation?: number;
    columnCount?: number;
    rowCount?: number;
    columnSpacing?: number;
    rowSpacing?: number;
  };
  const base = blockBase(block);
  const cols = Math.max(1, Math.floor(f.columnCount ?? 1));
  const rows = Math.max(1, Math.floor(f.rowCount ?? 1));
  const pos = { x: f.position?.x ?? 0, y: f.position?.y ?? 0 };
  const rad = ((f.rotation ?? 0) * Math.PI) / 180;
  // An INSERT can place its block as a grid; the grid turns with the block.
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const dx = c * (f.columnSpacing ?? 0);
      const dy = r * (f.rowSpacing ?? 0);
      const at = {
        x: pos.x + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: pos.y + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
      walk(block.entities, ctx, insertTransform(e, t, base, at), layer, depth + 1);
    }
  }
}

// ── SVG ─────────────────────────────────────────────────────────────

export interface DxfSvgOptions extends DxfFlattenOptions {
  /** Colour of every line and letter. One ink: an underlay is a backdrop, and the devices
   *  placed on it have to stand out. */
  ink?: string;
  /** Line width in drawing units. Defaults to a hair relative to the drawing's size. */
  strokeWidth?: number;
}

export interface DxfSvgResult {
  svg: string;
  /** Picture size in drawing units — one unit is one pixel, so a unit's worth in mm is
   *  exactly the underlay's mm per pixel. Includes a thin margin so edge lines are not cut. */
  width: number;
  height: number;
  /** Where the drawing's origin landed in the picture, for placing it on the sheet. */
  offset: { x: number; y: number };
  skipped: Record<string, number>;
  shapeCount: number;
}

export const DEFAULT_DXF_INK = "#3f3f46";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderDxfToSvg(drawing: DxfDrawing, options: DxfSvgOptions = {}): DxfSvgResult {
  const { shapes, skipped } = flattenDxf(drawing, options);
  const { minX, minY, maxX, maxY } = drawing.extents;
  const w = Math.max(maxX - minX, 1e-9);
  const h = Math.max(maxY - minY, 1e-9);
  const longEdge = Math.max(w, h);
  const pad = longEdge * 0.005;

  // Five significant figures over the whole drawing: a 50 m building in mm keeps tenths of a
  // millimetre, the same building in metres keeps tenths of a millimetre too.
  const decimals = Math.max(0, Math.ceil(-Math.log10(longEdge / 1e5)));
  const round = (n: number) => {
    const v = Number(n.toFixed(decimals));
    return Object.is(v, -0) ? 0 : v;
  };
  const X = (x: number) => round(x - minX + pad);
  const Y = (y: number) => round(maxY - y + pad);
  const width = round(w + 2 * pad);
  const height = round(h + 2 * pad);

  const stroke: string[] = [];
  const fill: string[] = [];
  const texts: string[] = [];
  for (const s of shapes) {
    if (s.kind === "path") {
      let d = `M${X(s.start.x)} ${Y(s.start.y)}`;
      for (const seg of s.segs) {
        if (isArcSeg(seg)) {
          // A counter-clockwise arc in DXF (y up) turns clockwise once y points down, which
          // is SVG's sweep-flag 1.
          const r = round(seg.arc.r);
          d += `A${r} ${r} 0 ${seg.arc.large ? 1 : 0} ${seg.arc.ccw ? 1 : 0} ${X(seg.to.x)} ${Y(seg.to.y)}`;
        } else {
          d += `L${X(seg.to.x)} ${Y(seg.to.y)}`;
        }
      }
      stroke.push(s.closed ? `${d}Z` : d);
    } else if (s.kind === "fill") {
      fill.push(`M${s.points.map((p) => `${X(p.x)} ${Y(p.y)}`).join("L")}Z`);
    } else {
      const x = X(s.at.x);
      const y = Y(s.at.y);
      const size = round(s.height);
      const turn = s.rotation ? ` transform="rotate(${round(-s.rotation)} ${x} ${y})"` : "";
      const lines = s.lines.map((l, i) =>
        i === 0 ? escapeXml(l) : `<tspan x="${x}" dy="${round(s.height * 1.5)}">${escapeXml(l)}</tspan>`,
      ).join("");
      texts.push(
        `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${s.anchor}" dominant-baseline="${s.baseline}"${turn}>${lines}</text>`,
      );
    }
  }

  const ink = options.ink ?? DEFAULT_DXF_INK;
  const sw = round(options.strokeWidth ?? longEdge / 4000);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    stroke.length > 0
      ? `<path d="${stroke.join("")}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`
      : "",
    fill.length > 0 ? `<path d="${fill.join("")}" fill="${ink}" stroke="none"/>` : "",
    texts.length > 0 ? `<g fill="${ink}" font-family="Arial, Helvetica, sans-serif">${texts.join("")}</g>` : "",
    "</svg>",
  ];
  return {
    svg: parts.join(""),
    width,
    height,
    offset: { x: round(pad - minX), y: round(maxY + pad) },
    skipped,
    shapeCount: shapes.length,
  };
}
