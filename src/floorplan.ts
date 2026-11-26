/**
 * Floorplan page geometry and bookkeeping.
 *
 * Coordinate model — everything on a floorplan page lives in **paper mm**, measured
 * from the paper's top-left corner, exactly like print-sheet viewports. The page's
 * `scaleDenominator` is the only bridge to the building: at 1:50, 1 mm on paper is
 * 50 mm on site. Keeping symbols in paper mm means a scale change re-labels the plan
 * without moving anything, and the calibration tool only ever has to resize the
 * underlay.
 *
 * This module is deliberately free of React and of the store so the math stays testable.
 */

import { getPaperSize, PAGE_MARGIN_IN, PAPER_SIZES } from "./printConfig";
import { getLocale, type Locale } from "./i18n";
import { defaultSymbolLibraryIdFor } from "./symbolLibrary";
import type { FloorplanSymbolShape,
  CompanyProfile,
  CoverageMic,
  CoverageOptics,
  CoverageShape,
  MicCoverageSpec,
  DoriLevel,
  FloorplanCoverage,
  FloorplanKind,
  PlanSymbolSpec,
  FloorplanDrawingBlock,
  FloorplanDrawingField,
  FloorplanLegendBox,
  FloorplanMask,
  FloorplanNote,
  FloorplanPage,
  FloorplanRevision,
  FloorplanSymbol,
  FloorplanSymbolGroup,
  FloorplanToken,
  FloorplanUnderlay,
  FloorplanWall,
  FloorplanDimension,
  TitleBlock,
} from "./types";
import { DEFAULT_FLOORPLAN_SCALE, DEFAULT_FLOORPLAN_SYMBOL_SIZE_MM, DORI_PX_PER_M, RSSI_STEPS, WALL_AP_APERTURE_DEG } from "./types";
import { VIEWING_KEY_LIMIT_AT, viewingKeyColors, viewingLacksResolution } from "./projectionViewing";
import { visibleProjections } from "./projection";
import { CONTRAST_BAND_COLORS, contrastApplication, formatContrast, pictureContrast, rateContrast, type ContrastApplication, type ContrastBand } from "./projectionContrast";

export const IN_TO_MM = 25.4;
export const PAGE_MARGIN_MM = PAGE_MARGIN_IN * IN_TO_MM;
/** PDF user-space units are points (1/72 in). */
export const PT_TO_MM = IN_TO_MM / 72;

export interface Vec2 {
  x: number;
  y: number;
}

export interface RectMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Architectural scales offered in the toolbar. Custom denominators stay allowed. */
export const FLOORPLAN_SCALES = [20, 25, 50, 75, 100, 125, 200, 250, 500];

/** Legend colors that stay distinguishable on a printed plan and in dark mode. */
export const FLOORPLAN_GROUP_COLORS = [
  "#e11d1d", // red
  "#1d4ed8", // blue
  "#22d3ee", // cyan
  "#facc15", // yellow
  "#f97316", // orange
  "#16a34a", // green
  "#a855f7", // violet
  "#000000", // black
];

// ── Scale ────────────────────────────────────────────────────────────

/** Paper mm → real-world mm at the page's drawing scale. */
export function paperMmToRealMm(paperMm: number, scaleDenominator: number): number {
  return paperMm * scaleDenominator;
}

/** Real-world mm → paper mm at the page's drawing scale. */
export function realMmToPaperMm(realMm: number, scaleDenominator: number): number {
  return scaleDenominator === 0 ? 0 : realMm / scaleDenominator;
}

/** "1:50" — the scale as it belongs in the title block. */
export function formatScale(scaleDenominator: number): string {
  return `1:${scaleDenominator}`;
}

/** Real-world distance between two points on the sheet, in mm. */
export function measureRealDistanceMm(a: Vec2, b: Vec2, scaleDenominator: number): number {
  return paperMmToRealMm(Math.hypot(b.x - a.x, b.y - a.y), scaleDenominator);
}

/** Real-world distance formatted the way plans annotate it (metres, 2 decimals). */
export function formatMetres(realMm: number): string {
  return `${(realMm / 1000).toFixed(2)} m`;
}

// ── Dimension lines ──────────────────────────────────────────────────

/** How a dimension line is drawn, in paper mm — shared by the sheet and the PDF so the two
 *  cannot drift apart. */
export const DIMENSION_COLOR = "#1d4ed8";
export const DIMENSION_LINE_MM = 0.25;
/** Font size of the figure on paper (3 mm is 8.5 pt). */
export const DIMENSION_TEXT_MM = 3;
const DIMENSION_TICK_MM = 1.5;
const DIMENSION_LABEL_GAP_MM = 0.8;

export interface DimensionLayout {
  /** The distance at the page's scale, as written on the line. */
  text: string;
  /** Bottom-middle of the figure. */
  labelAtMm: Vec2;
  /** Clockwise rotation of the figure. Always readable: between -90° and 90°, a vertical
   *  line read from the bottom up as on any drawing. */
  labelAngleDeg: number;
  /** The short stroke across the line at each end. */
  ticksMm: [Vec2, Vec2][];
}

export function dimensionLayout(
  dim: { fromMm: Vec2; toMm: Vec2 },
  scaleDenominator: number,
): DimensionLayout | null {
  const dx = dim.toMm.x - dim.fromMm.x;
  const dy = dim.toMm.y - dim.fromMm.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0.01)) return null;
  // The direction the figure is read in: left to right, and bottom to top when vertical.
  let rx = dx / len;
  let ry = dy / len;
  if (rx < -1e-9 || (Math.abs(rx) <= 1e-9 && ry > 0)) {
    rx = -rx;
    ry = -ry;
  }
  // "Above" for somebody reading along r, with y pointing down the sheet.
  const up = { x: ry, y: -rx };
  const mid = { x: (dim.fromMm.x + dim.toMm.x) / 2, y: (dim.fromMm.y + dim.toMm.y) / 2 };
  const tick = (p: Vec2): [Vec2, Vec2] => [
    { x: p.x + up.x * DIMENSION_TICK_MM, y: p.y + up.y * DIMENSION_TICK_MM },
    { x: p.x - up.x * DIMENSION_TICK_MM, y: p.y - up.y * DIMENSION_TICK_MM },
  ];
  return {
    text: formatMetres(measureRealDistanceMm(dim.fromMm, dim.toMm, scaleDenominator)),
    labelAtMm: { x: mid.x + up.x * DIMENSION_LABEL_GAP_MM, y: mid.y + up.y * DIMENSION_LABEL_GAP_MM },
    labelAngleDeg: (Math.atan2(ry, rx) * 180) / Math.PI,
    ticksMm: [tick(dim.fromMm), tick(dim.toMm)],
  };
}

// ── Snapping a measuring point ───────────────────────────────────────

/** What a measuring point caught: a corner (of a wall, or the end of a dimension line), the
 *  face of a wall, or only the horizontal/vertical through the first point. */
export type MeasureSnapKind = "corner" | "edge" | "axis";

export interface MeasureSnap {
  pointMm: Vec2;
  kind: MeasureSnapKind;
}

export interface MeasureSnapTargets {
  walls?: FloorplanWall[];
  dimensions?: FloorplanDimension[];
  scaleDenominator: number;
}

/**
 * The outline of a wall as it is drawn: both faces, set off from the axis by half the
 * thickness at the page's scale and mitred where a run turns, plus the two butt ends.
 * A measurement goes from face to face — the clear width — never from axis to axis.
 */
function wallOutline(wall: FloorplanWall, scaleDenominator: number): { corners: Vec2[]; edges: [Vec2, Vec2][] } {
  const pts = wall.pointsMm.filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) > 1e-6);
  if (pts.length < 2) return { corners: [], edges: [] };
  const half = realMmToPaperMm(wall.thicknessMm, scaleDenominator) / 2;
  const normals: Vec2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.hypot(dx, dy);
    normals.push({ x: -dy / len || 0, y: dx / len || 0 });
  }
  const side = (s: 1 | -1): Vec2[] => pts.map((p, k) => {
    const before = normals[k - 1];
    const after = normals[k];
    if (!before || !after) {
      const n = before ?? after;
      return { x: p.x + s * half * n.x, y: p.y + s * half * n.y };
    }
    // Where the two set-off faces meet. A run doubling back on itself has no such point.
    const dot = before.x * after.x + before.y * after.y;
    if (1 + dot < 0.05) return { x: p.x + s * half * after.x, y: p.y + s * half * after.y };
    return {
      x: p.x + (s * half * (before.x + after.x)) / (1 + dot),
      y: p.y + (s * half * (before.y + after.y)) / (1 + dot),
    };
  });
  const a = side(1);
  const b = side(-1);
  const edges: [Vec2, Vec2][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    edges.push([a[i], a[i + 1]], [b[i], b[i + 1]]);
  }
  edges.push([a[0], b[0]], [a[a.length - 1], b[b.length - 1]]);
  return { corners: [...a, ...b], edges };
}

function nearestOnSegment(p: Vec2, [a, b]: [Vec2, Vec2]): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * Where a measuring click near `p` should land, or null when nothing is within
 * `toleranceMm` (paper mm — the caller turns a few screen pixels into it, so the catch
 * feels the same at every zoom).
 *
 * A corner beats a face. With `anchorMm` — the first point of the measurement — the second
 * point also holds the horizontal or vertical through it; where that line crosses a wall
 * face, the point is on the face *and* level with the first, which is how a clear width is
 * measured square.
 */
export function snapMeasurePoint(
  p: Vec2,
  targets: MeasureSnapTargets,
  toleranceMm: number,
  anchorMm?: Vec2 | null,
): MeasureSnap | null {
  const dist = (q: Vec2) => Math.hypot(q.x - p.x, q.y - p.y);
  const corners: Vec2[] = [];
  const edges: [Vec2, Vec2][] = [];
  for (const wall of targets.walls ?? []) {
    if (wall.hidden) continue;
    const outline = wallOutline(wall, targets.scaleDenominator);
    corners.push(...outline.corners);
    edges.push(...outline.edges);
  }
  for (const d of targets.dimensions ?? []) corners.push(d.fromMm, d.toMm);

  let corner: Vec2 | null = null;
  for (const c of corners) {
    if (dist(c) <= toleranceMm && (!corner || dist(c) < dist(corner))) corner = c;
  }
  if (corner) return { pointMm: { x: corner.x, y: corner.y }, kind: "corner" };

  // The horizontal or vertical through the first point, whichever the pointer is closer to.
  let axis: { horizontal: boolean; pointMm: Vec2 } | null = null;
  if (anchorMm) {
    const offH = Math.abs(p.y - anchorMm.y);
    const offV = Math.abs(p.x - anchorMm.x);
    if (Math.min(offH, offV) <= toleranceMm) {
      axis = offH <= offV
        ? { horizontal: true, pointMm: { x: p.x, y: anchorMm.y } }
        : { horizontal: false, pointMm: { x: anchorMm.x, y: p.y } };
    }
  }

  let onEdge: Vec2 | null = null;
  let onEdgeAndAxis: Vec2 | null = null;
  for (const edge of edges) {
    const q = nearestOnSegment(p, edge);
    if (dist(q) > toleranceMm) continue;
    if (!onEdge || dist(q) < dist(onEdge)) onEdge = q;
    if (!axis || !anchorMm) continue;
    // Where this face crosses the held line.
    const [a, b] = edge;
    const along = axis.horizontal ? b.y - a.y : b.x - a.x;
    if (Math.abs(along) < 1e-9) continue; // the face runs along the line, no single crossing
    const t = ((axis.horizontal ? anchorMm.y - a.y : anchorMm.x - a.x)) / along;
    if (t < 0 || t > 1) continue;
    const x: Vec2 = axis.horizontal
      ? { x: a.x + t * (b.x - a.x), y: anchorMm.y }
      : { x: anchorMm.x, y: a.y + t * (b.y - a.y) };
    if (dist(x) > 2 * toleranceMm) continue;
    if (!onEdgeAndAxis || dist(x) < dist(onEdgeAndAxis)) onEdgeAndAxis = x;
  }
  if (onEdgeAndAxis) return { pointMm: onEdgeAndAxis, kind: "edge" };
  if (onEdge) return { pointMm: onEdge, kind: "edge" };
  if (axis) return { pointMm: axis.pointMm, kind: "axis" };
  return null;
}

// ── Sheet geometry ───────────────────────────────────────────────────

/** Sheet size in mm, honoring orientation (landscape swaps the paper's axes, matching
 *  PrintSheetRenderer). */
export function sheetSizeMm(page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">): { w: number; h: number } {
  const paper = getPaperSize(page.paperId, page.customWidthIn, page.customHeightIn);
  const wIn = page.orientation === "landscape" ? paper.heightIn : paper.widthIn;
  const hIn = page.orientation === "landscape" ? paper.widthIn : paper.heightIn;
  return { w: wIn * IN_TO_MM, h: hIn * IN_TO_MM };
}

/** The area inside the printed content border. */
export function drawingAreaMm(page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">): RectMm {
  const { w, h } = sheetSizeMm(page);
  return {
    x: PAGE_MARGIN_MM,
    y: PAGE_MARGIN_MM,
    w: w - 2 * PAGE_MARGIN_MM,
    h: h - 2 * PAGE_MARGIN_MM,
  };
}

/** Fit a rectangle of the given aspect inside `area`, centered, never upscaling past
 *  `preferredSizeMm` when the source carries a physical size of its own (PDF pages do). */
export function fitRectInArea(
  naturalWidthPx: number,
  naturalHeightPx: number,
  area: RectMm,
  preferredSizeMm?: { w: number; h: number },
): { positionMm: Vec2; sizeMm: { w: number; h: number } } {
  const aspect = naturalHeightPx === 0 ? 1 : naturalWidthPx / naturalHeightPx;
  let w = preferredSizeMm?.w ?? area.w;
  let h = preferredSizeMm?.h ?? area.w / aspect;
  // Shrink to fit — a plan larger than the sheet would otherwise land half off-paper.
  const shrink = Math.min(area.w / w, area.h / h, 1);
  w *= shrink;
  h *= shrink;
  return {
    positionMm: { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2 },
    sizeMm: { w, h },
  };
}

// ── Calibration ──────────────────────────────────────────────────────

export interface CalibrationResult {
  positionMm: Vec2;
  sizeMm: { w: number; h: number };
  /** Real-world mm per underlay source pixel after calibration. */
  mmPerPx: number;
  /** Factor the underlay was resized by. */
  factor: number;
}

/**
 * Solve the underlay's size from a measured reference: the user clicks two points that
 * span a known real-world distance, and the underlay is scaled so that distance comes
 * out right at the page's drawing scale. The midpoint of the two picked points stays
 * put, so the area being calibrated does not run away under the cursor.
 *
 * Returns null when the two points coincide (nothing to solve) or the underlay is
 * degenerate.
 */
export function computeCalibration(
  underlay: Pick<FloorplanUnderlay, "positionMm" | "sizeMm" | "naturalWidthPx">,
  pickA: Vec2,
  pickB: Vec2,
  realDistanceMm: number,
  scaleDenominator: number,
): CalibrationResult | null {
  const currentPaperDist = Math.hypot(pickB.x - pickA.x, pickB.y - pickA.y);
  if (currentPaperDist <= 0 || realDistanceMm <= 0) return null;
  if (underlay.sizeMm.w <= 0 || underlay.sizeMm.h <= 0 || underlay.naturalWidthPx <= 0) return null;

  const targetPaperDist = realMmToPaperMm(realDistanceMm, scaleDenominator);
  const factor = targetPaperDist / currentPaperDist;

  const mid = { x: (pickA.x + pickB.x) / 2, y: (pickA.y + pickB.y) / 2 };
  const sizeMm = { w: underlay.sizeMm.w * factor, h: underlay.sizeMm.h * factor };
  const positionMm = {
    x: mid.x - (mid.x - underlay.positionMm.x) * factor,
    y: mid.y - (mid.y - underlay.positionMm.y) * factor,
  };

  return {
    positionMm,
    sizeMm,
    mmPerPx: paperMmToRealMm(sizeMm.w / underlay.naturalWidthPx, scaleDenominator),
    factor,
  };
}

/** How close a measured scale has to come to a standard one to be taken as that one. Two
 *  clicks on a plotted line are a few tenths of a millimetre off; 2 % absorbs that without
 *  pulling a genuinely odd scan onto a scale it was not drawn at. */
const STANDARD_SCALE_TOLERANCE = 0.02;

/**
 * The scale a measurement says the page is at: two points on the sheet and the distance they
 * are apart on site. Used when the plan itself must not move — a locked underlay — so the
 * page's scale gives way instead of the drawing.
 *
 * A plot was made at a standard scale, so a result close to one is taken as that one. A
 * scanned or photographed plan is at no standard scale, and then the measured value stands.
 */
export function calibratedScale(pickA: Vec2, pickB: Vec2, realDistanceMm: number): number | null {
  const paper = Math.hypot(pickB.x - pickA.x, pickB.y - pickA.y);
  if (!(paper > 0) || !(realDistanceMm > 0)) return null;
  const measured = realDistanceMm / paper;
  const standard = [...FLOORPLAN_SCALES, 1000, 2000, 5000]
    .find((s) => Math.abs(measured / s - 1) <= STANDARD_SCALE_TOLERANCE);
  if (standard) return standard;
  return measured >= 20 ? Math.round(measured) : Math.round(measured * 10) / 10;
}

/** Real-world mm per underlay source pixel for an already-placed underlay. */
export function underlayMmPerPx(underlay: FloorplanUnderlay, scaleDenominator: number): number | undefined {
  if (underlay.naturalWidthPx <= 0 || underlay.sizeMm.w <= 0) return undefined;
  return paperMmToRealMm(underlay.sizeMm.w / underlay.naturalWidthPx, scaleDenominator);
}

/**
 * Is this plan lying on the sheet at the size it was plotted at?
 *
 * An architect's PDF carries its physical page size, and the import lays it on the sheet at
 * exactly that. As long as it is, the page's scale is a statement about the plan ("this is
 * drawn at 1:100") and changing it must leave the drawing alone — see setFloorplanScale.
 * Once the plan was resized, by hand or by a calibration, its size on paper is a
 * measurement instead and the scale converts it.
 *
 * Images have no plotted size, and a DXF goes on at its real size. A PDF from before the
 * dpi was kept counts when it still covers the sheet.
 */
export function underlayAtPlottedSize(
  underlay: Pick<FloorplanUnderlay, "kind" | "dpi" | "naturalWidthPx" | "naturalHeightPx" | "sizeMm">,
  sheet: { w: number; h: number },
): boolean {
  if (underlay.kind !== "pdf" || underlay.naturalWidthPx <= 0 || underlay.sizeMm.w <= 0) return false;
  // The dpi is kept rounded, and a poster-sized sheet is rasterized at few of them: 2 %.
  const near = (a: number, b: number) => b > 0 && Math.abs(a / b - 1) < 0.02;
  if (underlay.dpi && underlay.dpi > 0) return near(underlay.sizeMm.w, (underlay.naturalWidthPx / underlay.dpi) * 25.4);
  return near(underlay.sizeMm.w, sheet.w) && near(underlay.sizeMm.h, sheet.h);
}

/** Re-fit an underlay when the drawing scale changes so the plan keeps covering the
 *  same real-world extent: at 1:100 a building draws half as large as at 1:50.
 *  Anchored on the underlay's top-left corner. */
export function rescaleUnderlayForScale(
  underlay: FloorplanUnderlay,
  oldScaleDenominator: number,
  newScaleDenominator: number,
): { positionMm: Vec2; sizeMm: { w: number; h: number } } {
  if (oldScaleDenominator <= 0 || newScaleDenominator <= 0) {
    return { positionMm: underlay.positionMm, sizeMm: underlay.sizeMm };
  }
  const factor = oldScaleDenominator / newScaleDenominator;
  return {
    positionMm: underlay.positionMm,
    sizeMm: { w: underlay.sizeMm.w * factor, h: underlay.sizeMm.h * factor },
  };
}

// ── Symbol numbering ─────────────────────────────────────────────────

/** Split a trailing integer off a label: "4.12" → ["4.", 12, 2]. */
function splitTrailingNumber(label: string): { head: string; num: number; width: number } | null {
  const m = /^(.*?)(\d+)\s*$/.exec(label);
  if (!m) return null;
  return { head: m[1], num: Number(m[2]), width: m[2].length };
}

/**
 * Next number for a symbol in a group. Continues the group's last label ("4.1" → "4.2",
 * "SB.09" → "SB.10"), which is what plans actually do: the planner names the first symbol
 * of a zone and the rest follow. Falls back to the group's prefix, then to a plain count.
 * Never returns a label already taken inside the group.
 */
export function nextSymbolLabel(existingLabels: string[], labelPrefix?: string): string {
  const taken = new Set(existingLabels.map((l) => l.trim()));
  const last = [...existingLabels].reverse().find((l) => l.trim().length > 0);

  let candidate: string;
  const parsedLast = last ? splitTrailingNumber(last.trim()) : null;
  if (parsedLast) {
    candidate = parsedLast.head + String(parsedLast.num + 1).padStart(parsedLast.width, "0");
  } else if (last) {
    // A named symbol with no number ("Sub left") — start a numbered series off it.
    candidate = `${last.trim()} 2`;
  } else if (labelPrefix) {
    const parsedPrefix = splitTrailingNumber(labelPrefix);
    candidate = parsedPrefix
      ? parsedPrefix.head + String(parsedPrefix.num).padStart(parsedPrefix.width, "0")
      : `${labelPrefix}1`;
  } else {
    candidate = String(existingLabels.length + 1);
  }

  // Collisions happen after a manual rename; walk forward until the number is free.
  let guard = 0;
  while (taken.has(candidate) && guard++ < 1000) {
    const parsed = splitTrailingNumber(candidate);
    candidate = parsed
      ? parsed.head + String(parsed.num + 1).padStart(parsed.width, "0")
      : `${candidate}-1`;
  }
  return candidate;
}

/**
 * What a coverage area is captioned with.
 *
 * An anchored area carries the device's number — the wedge in front of camera K7 says K7.
 * That used to be copied when the area was made, and then everything that renumbers a
 * symbol had to remember to carry the copy along; miss one path and the sheet shows two
 * numbers for one device, with nothing saying which is current. So it is not copied any
 * more: it is read from the symbol, every time it is drawn.
 *
 * `ownLabel` is the way out for the planner who writes their own words ("Zufahrt Nord"),
 * and for a free-standing area, which has no device to read from.
 */
export function coverageLabelOf(
  coverage: Pick<FloorplanCoverage, "label" | "ownLabel" | "symbolId" | "mic">,
  symbols: Pick<FloorplanSymbol, "id" | "label">[],
): string {
  if (coverage.ownLabel) return coverage.label ?? "";
  // A microphone's areas lie around the device that already carries the number; printing
  // it again on each of up to eight areas only clutters the room.
  if (coverage.mic) return "";
  const symbol = coverage.symbolId ? symbols.find((s) => s.id === coverage.symbolId) : undefined;
  // A dangling symbol id (the device was deleted) falls back to whatever text is there.
  return symbol ? symbol.label : coverage.label ?? "";
}

/** Renumber a group's symbols sequentially from `startLabel` in placement order. */
export function renumberGroup(symbols: FloorplanSymbol[], startLabel: string): FloorplanSymbol[] {
  const parsed = splitTrailingNumber(startLabel.trim());
  if (!parsed) return symbols.map((s, i) => ({ ...s, label: i === 0 ? startLabel : `${startLabel}${i + 1}` }));
  return symbols.map((s, i) => ({
    ...s,
    label: parsed.head + String(parsed.num + i).padStart(parsed.width, "0"),
  }));
}

// ── Legend ───────────────────────────────────────────────────────────

export interface LegendRow {
  groupId: string;
  label: string;
  color: string;
  shape: FloorplanSymbolGroup["shape"];
  description?: string;
  imageSrc?: string;
  imageUrl?: string;
  imageCaption?: string;
  glyph?: string;
  /** The group's uploaded symbol picture, so the legend shows what the plan shows. */
  symbolImageSrc?: string;
  /** The group's BHE symbol, same reason. */
  symbolLibraryId?: string;
  /** And whether it is drawn in the group's colour — a legend that explains a red symbol
   *  with a black one explains nothing. */
  tintSymbol?: boolean;
  /** How many symbols of this group sit on the plan. */
  count: number;
}

/** Symbols of a switched-off group are not drawn, exported or listed. */
export function isGroupVisible(group: Pick<FloorplanSymbolGroup, "hidden"> | undefined): boolean {
  return Boolean(group) && !group!.hidden;
}

/** What to show for a legend row's product shot: the uploaded copy first, else the
 *  remote reference (template image now, Odoo product image later). */
export function legendRowImage(row: Pick<LegendRow, "imageSrc" | "imageUrl">): string | undefined {
  return row.imageSrc || row.imageUrl || undefined;
}

/** Legend rows for a page: one per symbol group, in group order. Honors the box's
 *  "only groups in use" setting and per-group hiding. */
export function buildLegendRows(page: Pick<FloorplanPage, "groups" | "symbols" | "legend">): LegendRow[] {
  const counts = new Map<string, number>();
  for (const s of page.symbols) counts.set(s.groupId, (counts.get(s.groupId) ?? 0) + 1);

  return page.groups
    // A switched-off layer is not on the plan, so it has nothing to explain in the legend.
    .filter((g) => !g.hidden)
    .filter((g) => !g.hiddenInLegend)
    .filter((g) => !page.legend.onlyUsedGroups || (counts.get(g.id) ?? 0) > 0)
    .map((g) => ({
      groupId: g.id,
      label: g.label,
      color: g.color,
      shape: g.shape,
      description: g.description,
      imageSrc: g.imageSrc,
      imageUrl: g.imageUrl,
      imageCaption: g.imageCaption,
      glyph: g.glyph,
      symbolImageSrc: g.symbolImageSrc,
      symbolLibraryId: g.symbolLibraryId,
      tintSymbol: g.tintSymbol,
      count: counts.get(g.id) ?? 0,
    }));
}

/**
 * Does the legend carry the company block (logo, name, address, contact)?
 *
 * Off unless switched on. The drawing block already names who drew the sheet; repeating it
 * under the legend put our address on the plan twice and ate room the legend rows need.
 * The switch stays, for a sheet that goes out without a drawing block.
 */
export function legendShowsCompany(legend: Pick<FloorplanLegendBox, "showCompany">): boolean {
  return legend.showCompany === true;
}

/** Legend box height in mm for the given rows — the renderer and the PDF export share
 *  this so the on-screen box and the printed one agree. */
export function legendHeightMm(rows: LegendRow[], legend: FloorplanLegendBox, company?: CompanyProfile | null, lineRowCount = 0, keyStepCounts: number | number[] = 0): number {
  const notes = (legend.notes ?? []).filter((n) => n.trim().length > 0);
  const rowH = legend.showImages ? LEGEND_ROW_WITH_IMAGE_MM : LEGEND_ROW_MM;
  let h = LEGEND_TITLE_MM + rows.length * rowH + LEGEND_PAD_MM * 2;
  if (lineRowCount > 0) h += LEGEND_LINES_GAP_MM + LEGEND_LINES_TITLE_MM + LEGEND_LINE_ROW_MM * (lineRowCount + 1);
  // One block per colour key (Wi-Fi signal, viewing quality), each with its own heading.
  for (const steps of Array.isArray(keyStepCounts) ? keyStepCounts : [keyStepCounts]) {
    if (steps > 0) h += LEGEND_RSSI_GAP_MM + LEGEND_RSSI_TITLE_MM + LEGEND_RSSI_ROW_MM * steps;
  }
  if (notes.length > 0) h += LEGEND_NOTES_GAP_MM + LEGEND_NOTES_TITLE_MM + notes.length * LEGEND_NOTE_LINE_MM;
  if (legendShowsCompany(legend) && hasCompanyProfile(company)) h += legendCompanyHeightMm(company);
  // A stretched box covers what sits under it — the planner's way of hiding the
  // architect's legend without a separate cover.
  return Math.max(h, legend.minHeightMm ?? 0);
}

export const LEGEND_PAD_MM = 4;
export const LEGEND_TITLE_MM = 9;
export const LEGEND_ROW_MM = 10;
export const LEGEND_ROW_WITH_IMAGE_MM = 14;
export const LEGEND_NOTES_GAP_MM = 3;
export const LEGEND_NOTES_TITLE_MM = 6;
export const LEGEND_NOTE_LINE_MM = 4.2;
/** Line table: gap above, heading, one header row + one row per line. */
export const LEGEND_LINES_GAP_MM = 3;
export const LEGEND_LINES_TITLE_MM = 6;
export const LEGEND_LINE_ROW_MM = 4.2;
/** Column shares of the line table: line, name/feed, count, load. */
export const LEGEND_LINE_COLS = [0.12, 0.5, 0.1, 0.28] as const;
export const DEFAULT_LEGEND_LINES_TITLE = "LINES / AMPLIFIER CHANNELS";
/** Wi-Fi colour key: gap above, heading, one row per RSSI step. */
export const LEGEND_RSSI_GAP_MM = 3;
export const LEGEND_RSSI_TITLE_MM = 6;
export const LEGEND_RSSI_ROW_MM = 4.2;
/** Swatch width as a share of the legend's inner width. */
export const LEGEND_RSSI_SWATCH_SHARE = 0.16;
export const DEFAULT_RSSI_SCALE_TITLE = "SIGNALSTÄRKE";

/** Does this plan print the Wi-Fi colour key? Explicit setting first, else a coverage
 *  plan with its heatmap switched on. */
export function legendShowsRssiScale(
  page: Pick<FloorplanPage, "legend" | "kind" | "heatmap" | "hidePlanning">,
): boolean {
  if (page.hidePlanning) return false;
  if (page.legend.showRssiScale !== undefined) return page.legend.showRssiScale;
  return page.kind === "wifi" && Boolean(page.heatmap?.visible);
}

/** Coverage areas are off: switched off on their own, or with everything else that only
 *  serves planning. */
export function coveragesHidden(page: Pick<FloorplanPage, "hideCoverages" | "hidePlanning">): boolean {
  return Boolean(page.hideCoverages || page.hidePlanning);
}

/** Does this plan show a heatmap of an audience area? Then its colours need explaining. */
export function legendShowsViewingKey(
  page: Pick<FloorplanPage, "projections" | "symbols" | "groups" | "hidePlanning">,
): boolean {
  if (page.hidePlanning) return false;
  return (page.projections ?? []).some((p) => {
    if (p.hidden || !p.audience || p.viewing?.heatmap === false || viewingLacksResolution(p)) return false;
    const symbol = page.symbols.find((s) => s.id === p.symbolId);
    if (!symbol) return false;
    return !page.groups.find((g) => g.id === (p.groupId ?? symbol.groupId))?.hidden;
  });
}

/** A block of colour swatches in the legend: what a heatmap's colours mean. */
export interface LegendColorKey {
  id: "rssi" | "viewing" | "contrast";
  title: string;
  /** One swatch and caption per row. Empty for a key that is a gradient. */
  steps: { color: string; label: string }[];
  /** A continuous scale instead of steps: one bar of colours, captions under it at `at`
   *  (0 = left end, 1 = right end). */
  gradient?: { colors: string[]; labels: { at: number; text: string }[] };
  /** A rating scale per picture: a caption, then a bar of bands with a mark where the
   *  picture sits (0 = left end, 1 = right end). `ends` names the two ends of the bars,
   *  once, under the last one. */
  scales?: { bars: { id: string; caption: string; colors: string[]; markerAt: number }[]; ends: [string, string] };
}

/** Rows a colour key takes in the legend: one per step, or bar plus captions. */
export function legendKeyRows(key: LegendColorKey): number {
  if (key.scales) return key.scales.bars.length * 2 + 1;
  return key.gradient ? 2 : key.steps.length;
}

/** Colours in a gradient key's bar — enough to read as a blend at legend size. */
const LEGEND_GRADIENT_COLORS = 32;

const VIEWING_KEY_TEXT: Record<Locale, { title: string; good: string; limit: string; outside: string }> = {
  de: { title: "SICHTGÜTE (AVIXA)", good: "gut", limit: "Grenze", outside: "außerhalb" },
  en: { title: "VIEWING QUALITY (AVIXA)", good: "good", limit: "limit", outside: "outside" },
};

const CONTRAST_KEY_TEXT: Record<Locale, {
  title: string;
  bands: Record<ContrastBand, string>;
  rooms: Record<ContrastApplication, string>;
}> = {
  de: {
    title: "BILDKONTRAST IM RAUMLICHT",
    bands: { best: "sehr gut", recommended: "empfohlen", enough: "ausreichend", limit: "Grenze", "too-low": "zu niedrig" },
    rooms: { meeting: "Besprechungsraum", classroom: "Klassenraum", hall: "Saal", living: "Wohnraum", theatre: "Kino" },
  },
  en: {
    title: "PICTURE CONTRAST IN ROOM LIGHT",
    bands: { best: "best", recommended: "recommended", enough: "enough", limit: "limit", "too-low": "too low" },
    rooms: { meeting: "meeting room", classroom: "classroom", hall: "hall", living: "living room", theatre: "cinema" },
  },
};

/** The words of the contrast scale, for the panel and the legend alike. */
export function contrastKeyText(locale: Locale = getLocale()) {
  return CONTRAST_KEY_TEXT[locale] ?? CONTRAST_KEY_TEXT.en;
}

/** One picture's contrast rating as the legend prints it. */
export interface PictureContrastRow {
  projectionId: string;
  /** The projector's or display's label on the plan. */
  label: string;
  ratio: number;
  band: ContrastBand;
  markerAt: number;
  application: ContrastApplication;
  ambientLux: number;
}

/** Every visible picture whose contrast can be worked out — room light stated, light
 *  output known. None on an execution plan. */
export function pictureContrastRows(
  page: Pick<FloorplanPage, "projections" | "symbols" | "groups" | "scaleDenominator" | "hidePlanning">,
): PictureContrastRow[] {
  if (page.hidePlanning) return [];
  const rows: PictureContrastRow[] = [];
  // Only pictures whose room light is stated are worked out at all.
  const stated = (page.projections ?? []).filter((p) => p.light?.ambientLux !== undefined);
  if (stated.length === 0) return [];
  for (const { projection, geometry } of visibleProjections({ ...page, projections: stated })) {
    const result = pictureContrast(projection, geometry.result.lux);
    const rating = result && rateContrast(result.ratio, projection.light?.application);
    if (!result || !rating) continue;
    rows.push({
      projectionId: projection.id,
      label: page.symbols.find((s) => s.id === projection.symbolId)?.label ?? "",
      ratio: result.ratio,
      band: rating.band,
      markerAt: rating.at,
      application: contrastApplication(projection.light?.application).id,
      ambientLux: projection.light?.ambientLux ?? 0,
    });
  }
  return rows;
}

/** The colour keys this plan's legend carries, in the order they are printed. The screen,
 *  the PDF and the legend's height all read this one list. */
export function legendColorKeys(
  page: Pick<FloorplanPage, "legend" | "kind" | "heatmap" | "projections" | "symbols" | "groups" | "scaleDenominator" | "hidePlanning">,
  locale: Locale = getLocale(),
): LegendColorKey[] {
  const keys: LegendColorKey[] = [];
  if (legendShowsRssiScale(page)) {
    keys.push({ id: "rssi", title: page.legend.rssiScaleTitle ?? DEFAULT_RSSI_SCALE_TITLE, steps: RSSI_STEPS.map((s) => ({ color: s.color, label: s.label })) });
  }
  if (legendShowsViewingKey(page)) {
    const text = VIEWING_KEY_TEXT[locale] ?? VIEWING_KEY_TEXT.en;
    keys.push({
      id: "viewing",
      title: text.title,
      steps: [],
      gradient: {
        colors: viewingKeyColors(LEGEND_GRADIENT_COLORS),
        labels: [{ at: 0, text: text.good }, { at: VIEWING_KEY_LIMIT_AT, text: text.limit }, { at: 1, text: text.outside }],
      },
    });
  }
  const contrast = pictureContrastRows(page);
  if (contrast.length > 0) {
    const text = contrastKeyText(locale);
    const decimal = locale === "de" ? "," : ".";
    keys.push({
      id: "contrast",
      title: text.title,
      steps: [],
      scales: {
        bars: contrast.map((c) => ({
          id: c.projectionId,
          caption: [c.label, formatContrast(c.ratio, decimal), text.bands[c.band], `${text.rooms[c.application]} ${Math.round(c.ambientLux)} lx`].filter(Boolean).join(" · "),
          colors: [...CONTRAST_BAND_COLORS],
          markerAt: c.markerAt,
        })),
        ends: [text.bands.best, text.bands["too-low"]],
      },
    });
  }
  return keys;
}

/** Default legend box, parked in the sheet's top-right corner. */
export function createDefaultLegend(page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">): FloorplanLegendBox {
  const area = drawingAreaMm(page);
  const widthMm = Math.min(140, area.w * 0.38);
  return {
    visible: true,
    // Left to the plan kind and the interface language; see legendTitleOf.
    title: undefined,
    positionMm: { x: area.x + area.w - widthMm - 4, y: area.y + 4 },
    widthMm,
    showImages: true,
    // Groups are created on purpose — list them even before the first symbol lands, so
    // the legend reads as the plan's key from the first minute.
    onlyUsedGroups: false,
    notesTitle: undefined,
    notes: [],
  };
}

// ── Schedule ─────────────────────────────────────────────────────────

export interface FloorplanScheduleRow {
  symbolId: string;
  label: string;
  groupLabel: string;
  deviceLabel: string;
  /** Position in the building, in metres, relative to the drawing area's top-left. */
  xM: number;
  yM: number;
  notes?: string;
}

/**
 * Tabular view of what sits on the plan — the basis for a per-plan device list.
 * Coordinates are real-world metres from the drawing area's top-left corner, which is
 * the only origin the sheet can offer until the user calibrates an origin point.
 */
export function buildFloorplanSchedule(
  page: FloorplanPage,
  deviceLabelFor: (deviceNodeId: string) => string | undefined,
): FloorplanScheduleRow[] {
  const area = drawingAreaMm(page);
  const groupById = new Map(page.groups.map((g) => [g.id, g]));
  return page.symbols.map((s) => ({
    symbolId: s.id,
    label: s.label,
    groupLabel: groupById.get(s.groupId)?.label ?? "",
    deviceLabel: (s.deviceNodeId ? deviceLabelFor(s.deviceNodeId) : undefined) ?? "",
    xM: paperMmToRealMm(s.positionMm.x - area.x, page.scaleDenominator) / 1000,
    yM: paperMmToRealMm(s.positionMm.y - area.y, page.scaleDenominator) / 1000,
    notes: s.notes,
  }));
}

// ── Symbol geometry ──────────────────────────────────────────────────

/** Points of a symbol outline, centered on the origin, for a given shape and size.
 *  Circles are drawn by the renderers directly; the polygons come from here so screen
 *  and PDF stay identical. */
export function symbolPolygon(shape: FloorplanSymbolGroup["shape"], sizeMm: number): Vec2[] {
  const r = sizeMm / 2;
  switch (shape) {
    case "square":
      return [{ x: -r, y: -r }, { x: r, y: -r }, { x: r, y: r }, { x: -r, y: r }];
    case "diamond":
      return [{ x: 0, y: -r }, { x: r, y: 0 }, { x: 0, y: r }, { x: -r, y: 0 }];
    case "triangle": {
      // Equilateral, centered on its centroid so it optically sits on the same spot as a circle.
      const h = r * 1.732;
      return [{ x: 0, y: -r }, { x: h / 2, y: r * 0.75 }, { x: -h / 2, y: r * 0.75 }];
    }
    default:
      return [];
  }
}

/** Names for the shape pickers (device editor, group editor). */
export const FLOORPLAN_SYMBOL_SHAPE_LABELS: Record<FloorplanSymbolShape, string> = {
  circle: "Circle",
  square: "Square",
  triangle: "Triangle",
  diamond: "Diamond",
  projector: "Projector (top view)",
  rack: "Rack (top view)",
  display: "Display (top view)",
  camera: "Camera (top view)",
};

/** One stroke of a symbol picture, centered on the origin. `color` fills with the group
 *  color under a dark outline; `contrast` fills with the glyph color (black or white,
 *  whichever reads on the group color) and has no outline; `none` is an outline only,
 *  drawn in the contrast color — like lines. Every renderer (sheet, sidebar chip, PDF)
 *  walks the same list so a projector looks like the same projector everywhere. */
/** Ink for a pictogram's details — lens, beam, cabinet diagonals, screen face. Fixed dark
 *  rather than the glyph's contrast color, because a beam leaves the body and a white line
 *  on white paper is no line at all. */
export const SYMBOL_INK = "#333333";

/** Default outline around a symbol body, and its thickness as a fraction of the symbol
 *  size. Screen and paper share both, so a symbol is outlined identically on either. */
export const DEFAULT_SYMBOL_OUTLINE = "#3c3c3c";
export const DEFAULT_SYMBOL_OUTLINE_RATIO = 0.04;

/** Outline color of a group's symbol body. */
export function symbolOutlineColor(group: Pick<FloorplanSymbolGroup, "outlineColor">): string {
  return group.outlineColor || DEFAULT_SYMBOL_OUTLINE;
}

/** Outline thickness for a symbol drawn `drawSize` wide, where the page draws symbols
 *  `symbolSizeMm` wide on paper. Callers on screen pass pixels and get pixels; the PDF
 *  passes mm and gets mm, so a legend chip and the printed symbol keep the same
 *  proportions. Returns 0 when the group asked for no outline. */
export function symbolOutlineWidth(
  group: Pick<FloorplanSymbolGroup, "outlineWidthMm">,
  drawSize: number,
  symbolSizeMm: number = DEFAULT_FLOORPLAN_SYMBOL_SIZE_MM,
): number {
  const mm = group.outlineWidthMm ?? symbolSizeMm * DEFAULT_SYMBOL_OUTLINE_RATIO;
  if (mm <= 0) return 0;
  return symbolSizeMm > 0 ? (mm / symbolSizeMm) * drawSize : 0;
}

export type SymbolPrimitive =
  | { kind: "polygon"; points: Vec2[]; fill: "color" | "contrast" | "none" }
  | { kind: "circle"; center: Vec2; r: number; fill: "color" | "contrast" | "none" }
  | { kind: "line"; from: Vec2; to: Vec2 };

function rectPrimitive(x0: number, y0: number, x1: number, y1: number, fill: "color" | "contrast" | "none"): SymbolPrimitive {
  return { kind: "polygon", points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], fill };
}

/** The picture of a symbol shape, fitted into a sizeMm square around the origin. The
 *  abstract shapes are one filled outline; the pictograms are top views: a projector's
 *  body with lens and beam, a rack as the cabinet rectangle with the crossed diagonals
 *  architects use for cabinets, a display as a thin bar with its mount, a camera as body
 *  and lens cone. */
export function symbolPrimitives(shape: FloorplanSymbolShape, sizeMm: number): SymbolPrimitive[] {
  const r = sizeMm / 2;
  switch (shape) {
    case "circle":
      return [{ kind: "circle", center: { x: 0, y: 0 }, r, fill: "color" }];
    case "square":
    case "diamond":
    case "triangle":
      return [{ kind: "polygon", points: symbolPolygon(shape, sizeMm), fill: "color" }];
    case "projector":
      return [
        rectPrimitive(-r, -0.55 * r, 0.45 * r, 0.55 * r, "color"),
        { kind: "circle", center: { x: 0.5 * r, y: 0 }, r: 0.3 * r, fill: "contrast" },
        { kind: "line", from: { x: 0.8 * r, y: -0.1 * r }, to: { x: r, y: -0.55 * r } },
        { kind: "line", from: { x: 0.8 * r, y: 0.1 * r }, to: { x: r, y: 0.55 * r } },
      ];
    case "rack":
      return [
        rectPrimitive(-0.6 * r, -0.85 * r, 0.6 * r, 0.85 * r, "color"),
        rectPrimitive(-0.42 * r, -0.67 * r, 0.42 * r, 0.67 * r, "none"),
        { kind: "line", from: { x: -0.42 * r, y: -0.67 * r }, to: { x: 0.42 * r, y: 0.67 * r } },
        { kind: "line", from: { x: 0.42 * r, y: -0.67 * r }, to: { x: -0.42 * r, y: 0.67 * r } },
      ];
    case "display":
      return [
        rectPrimitive(-0.15 * r, 0.2 * r, 0.15 * r, 0.5 * r, "color"),
        rectPrimitive(-r, -0.22 * r, r, 0.22 * r, "color"),
        { kind: "line", from: { x: -0.85 * r, y: -0.08 * r }, to: { x: 0.85 * r, y: -0.08 * r } },
      ];
    case "camera":
      return [
        rectPrimitive(-0.9 * r, -0.42 * r, 0.15 * r, 0.42 * r, "color"),
        { kind: "polygon", points: [{ x: 0.15 * r, y: -0.22 * r }, { x: 0.9 * r, y: -0.5 * r }, { x: 0.9 * r, y: 0.5 * r }, { x: 0.15 * r, y: 0.22 * r }], fill: "color" },
        { kind: "circle", center: { x: -0.38 * r, y: 0 }, r: 0.16 * r, fill: "contrast" },
      ];
    default:
      return [{ kind: "circle", center: { x: 0, y: 0 }, r, fill: "color" }];
  }
}

// ── Symbols in true size ─────────────────────────────────────────────

/** The least a true-size symbol is drawn with on paper, so a small device does not vanish
 *  on a small-scale plan. */
export const FOOTPRINT_MIN_MM = 1.2;

/** A device's outline in plan, on paper. */
export interface SymbolFootprint {
  /** Across the device and along it, paper mm, before the symbol's own rotation. */
  wMm: number;
  hMm: number;
  /** A round body (a ceiling loudspeaker) rather than a box. */
  round: boolean;
  /** Drawn larger than true size because it would otherwise be too small to see. */
  enlarged: boolean;
}

type Dimensions = { widthMm?: number; heightMm?: number; depthMm?: number };

/** The two sides of a device seen from above, in real mm, or null when one is unknown. */
export function footprintSidesMm(
  group: Pick<FloorplanSymbolGroup, "footprint">,
  device: Dimensions | undefined,
): { wMm: number; hMm: number } | null {
  const w = device?.widthMm;
  const h = group.footprint === "height" ? device?.heightMm : device?.depthMm;
  if (!w || !h || !(w > 0) || !(h > 0)) return null;
  return { wMm: w, hMm: h };
}

/**
 * A symbol's true-size outline, or null when the group does not ask for one or the device
 * does not say how large it is — the caller then draws the pictogram, so a plan never
 * shows a guessed size.
 */
export function symbolFootprintMm(
  group: Pick<FloorplanSymbolGroup, "trueSize" | "footprint" | "shape">,
  device: Dimensions | undefined,
  scaleDenominator: number,
): SymbolFootprint | null {
  if (!group.trueSize || !(scaleDenominator > 0)) return null;
  const sides = footprintSidesMm(group, device);
  if (!sides) return null;
  const w = sides.wMm / scaleDenominator, h = sides.hMm / scaleDenominator;
  return {
    wMm: Math.max(FOOTPRINT_MIN_MM, w),
    hMm: Math.max(FOOTPRINT_MIN_MM, h),
    round: group.shape === "circle",
    enlarged: w < FOOTPRINT_MIN_MM || h < FOOTPRINT_MIN_MM,
  };
}

/** The outline as a closed polygon on the sheet: four corners of a box, or a ring of
 *  points for a round body. For the PDF, which has no rotated rectangle or ellipse. */
export function symbolFootprintOutlineMm(footprint: SymbolFootprint, centerMm: Vec2, rotationDeg = 0): Vec2[] {
  const local: Vec2[] = footprint.round
    ? Array.from({ length: 36 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 36;
        return { x: (Math.cos(a) * footprint.wMm) / 2, y: (Math.sin(a) * footprint.hMm) / 2 };
      })
    : [
        { x: -footprint.wMm / 2, y: -footprint.hMm / 2 },
        { x: footprint.wMm / 2, y: -footprint.hMm / 2 },
        { x: footprint.wMm / 2, y: footprint.hMm / 2 },
        { x: -footprint.wMm / 2, y: footprint.hMm / 2 },
      ];
  return local.map((p) => {
    const r = rotateVec(p, rotationDeg);
    return { x: centerMm.x + r.x, y: centerMm.y + r.y };
  });
}

/** Where the glyph sits relative to the symbol center, so it lands on the body of a
 *  pictogram (left of a projector's lens) and on the optical center of a triangle. */
export function symbolGlyphOffset(shape: FloorplanSymbolShape, sizeMm: number): Vec2 {
  switch (shape) {
    case "triangle": return { x: 0, y: sizeMm * 0.12 };
    case "projector": return { x: -sizeMm * 0.16, y: 0 };
    case "camera": return { x: -sizeMm * 0.06, y: 0 };
    case "display": return { x: 0, y: -sizeMm * 0.01 };
    default: return { x: 0, y: 0 };
  }
}

/** Glyph font size as a fraction of the symbol size. Pictograms have less body to write on
 *  than a full circle, so their glyph shrinks to stay clear of lens, diagonals and beam. */
export function symbolGlyphScale(shape: FloorplanSymbolShape, glyph: string): number {
  const twoChars = glyph.length > 1;
  switch (shape) {
    case "projector":
    case "rack":
    case "camera":
      return twoChars ? 0.3 : 0.4;
    case "display":
      return twoChars ? 0.26 : 0.34;
    default:
      return twoChars ? 0.42 : 0.55;
  }
}

/** Where a symbol's number is drawn, in paper mm (left-aligned, vertically centered). */
export function symbolLabelAnchor(symbol: FloorplanSymbol, symbolSizeMm: number): Vec2 {
  const offset = symbol.labelOffsetMm ?? { x: symbolSizeMm * 0.75 + 1.5, y: 0 };
  return { x: symbol.positionMm.x + offset.x, y: symbol.positionMm.y + offset.y };
}

/** Clamp a symbol to the sheet so it can never be dragged off the paper. */
export function clampToSheet(pos: Vec2, page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">): Vec2 {
  const { w, h } = sheetSizeMm(page);
  return { x: Math.min(Math.max(pos.x, 0), w), y: Math.min(Math.max(pos.y, 0), h) };
}

// ── Text wrapping ────────────────────────────────────────────────────

/** Average glyph advance as a fraction of the cap height for the Inter face at plan
 *  sizes. Used to wrap text identically on screen and in the PDF, so a note never
 *  reflows between the two. Slightly conservative on purpose: a line breaking early
 *  is invisible, a line overflowing its box is not. */
export const AVG_GLYPH_WIDTH_FACTOR = 0.58;

/** Word-wrap `text` into lines that fit `widthMm` at `fontSizeMm`. Explicit newlines
 *  always break; over-long words are hard-split so nothing can escape the box. */
export function wrapText(text: string, widthMm: number, fontSizeMm: number): string[] {
  const charW = Math.max(0.1, fontSizeMm * AVG_GLYPH_WIDTH_FACTOR);
  const maxChars = Math.max(1, Math.floor(widthMm / charW));
  const out: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (paragraph.trim() === "") { out.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      let w = word;
      while (w.length > maxChars) {
        if (line) { out.push(line); line = ""; }
        out.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= maxChars) line += " " + w;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

// ── Drawing block (Plankopf) ─────────────────────────────────────────

/** What a `{{token}}` in a drawing block resolves against. */
export interface FloorplanTokenContext {
  titleBlock: Pick<TitleBlock, "showName" | "venue" | "designer" | "engineer" | "date" | "drawingTitle" | "company" | "revision">;
  page: Pick<FloorplanPage, "label" | "scaleDenominator" | "paperId" | "orientation" | "customWidthIn" | "customHeightIn">;
  projectName: string;
  /** The planning company, for the {{companyName}} / {{companyAddress}} / {{companyContact}} tokens. */
  company?: CompanyProfile | null;
}

/** Replace every `{{token}}` (see FLOORPLAN_TOKENS) in `text`. Unknown tokens are
 *  left as typed so a typo stays visible instead of vanishing. */
export function resolveFloorplanTokens(text: string, ctx: FloorplanTokenContext): string {
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, raw: string) => {
    const token = raw as FloorplanToken;
    switch (token) {
      case "scale": return formatScale(ctx.page.scaleDenominator);
      case "sheetSize": return formatSheetSize(ctx.page);
      case "pageLabel": return ctx.page.label;
      case "projectName": return ctx.projectName;
      case "companyName": return ctx.company?.name ?? "";
      case "companyAddress": return (ctx.company?.addressLines ?? []).filter((l) => l.trim()).join("\n");
      case "companyContact": return companyContactLine(ctx.company ?? null);
      case "showName": case "venue": case "designer": case "engineer":
      case "date": case "drawingTitle": case "company": case "revision":
        return ctx.titleBlock[token] ?? "";
      default: return match;
    }
  });
}

/** "594 × 841 mm (A1)" — how the sheet size reads in a drawing block. */
export function formatSheetSize(page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">): string {
  const { w, h } = sheetSizeMm(page);
  const paper = getPaperSize(page.paperId, page.customWidthIn, page.customHeightIn);
  const name = page.paperId === "custom" ? "" : ` (${paper.label})`;
  return `${Math.round(w)} × ${Math.round(h)} mm${name}`;
}

let drawingFieldCounter = 0;
/** Ids for drawing block fields; stable enough for React keys and MCP references. */
export function nextDrawingFieldId(): string {
  return `fpfield-${Date.now().toString(36)}-${++drawingFieldCounter}`;
}

/** Drawing block for a new page: revision table empty, fields wired to the project
 *  title block through tokens, parked in the sheet's bottom-right corner. */
export function createDefaultDrawingBlock(page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">): FloorplanDrawingBlock {
  const area = drawingAreaMm(page);
  // Architects' title blocks run about 150–160 mm wide on A-series sheets; matching that
  // lets ours cover theirs without a first resize.
  const widthMm = Math.min(160, area.w * 0.32);
  // The block is drawn on the sheet, so its labels are written in the interface language at
  // the moment the page is created and then belong to the plan.
  const preset = floorplanKindPreset("generic");
  const values = ["{{showName}}", "{{venue}}", "{{scale}}", "{{sheetSize}}", "{{date}}", "{{designer}}"];
  const fields: FloorplanDrawingField[] = preset.fieldLabels.map((label, i) => ({
    id: nextDrawingFieldId(),
    label,
    value: values[i],
    ...(i < 2 ? { wide: true } : {}),
  }));
  const block: FloorplanDrawingBlock = {
    visible: true,
    positionMm: { x: 0, y: 0 },
    widthMm,
    title: "{{pageLabel}}",
    subtitle: "{{drawingTitle}}",
    fields,
    revisions: [],
    revisionHeaders: [...preset.revisionHeaders] as FloorplanDrawingBlock["revisionHeaders"],
    disclaimer: "",
    showLogo: true,
    showNorthArrow: true,
    northRotationDeg: 0,
  };
  // Height depends on content; place it once we know it.
  const h = layoutDrawingBlock(block, {
    titleBlock: { showName: "", venue: "", designer: "", engineer: "", date: "", drawingTitle: "", company: "", revision: "" },
    page: { ...page, label: "", scaleDenominator: DEFAULT_FLOORPLAN_SCALE },
    projectName: "",
  }, { hasLogo: false }).heightMm;
  // Real project values (a two-line client address, a logo) grow the block past this
  // empty-content estimate — leave headroom so it still lands inside the border.
  const headroom = DB_FOOTER_MM + DB_FIELD_VALUE_FONT_MM * 3;
  block.positionMm = { x: area.x + area.w - widthMm - 4, y: Math.max(area.y, area.y + area.h - h - headroom - 4) };
  return block;
}

/** Fixed metrics of the drawing block, in paper mm. */
export const DB_PAD_MM = 3;
export const DB_TITLE_FONT_MM = 7;
export const DB_SUBTITLE_FONT_MM = 3.2;
export const DB_FIELD_LABEL_FONT_MM = 2.1;
export const DB_FIELD_VALUE_FONT_MM = 3;
export const DB_REV_FONT_MM = 2.4;
export const DB_REV_ROW_MM = 4.6;
export const DB_DISCLAIMER_FONT_MM = 2.2;
export const DB_FOOTER_MM = 22;
/** Revision table column widths as fractions of the inner width: index, date, change, by, chk. */
export const DB_REV_COLS = [0.09, 0.15, 0.56, 0.1, 0.1] as const;

export interface DrawingBlockSection {
  kind: "revisions" | "disclaimer" | "title" | "fields" | "footer";
  /** Top edge relative to the block's top, in mm. */
  yMm: number;
  heightMm: number;
}

export interface DrawingBlockFieldCell {
  field: FloorplanDrawingField;
  label: string;
  /** Wrapped, token-resolved value lines. */
  lines: string[];
  /** Cell rect relative to the block's top-left, in mm. */
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

export interface DrawingBlockLayout {
  widthMm: number;
  heightMm: number;
  innerXMm: number;
  innerWMm: number;
  sections: DrawingBlockSection[];
  /** Resolved title/subtitle. */
  title: string;
  subtitle: string;
  disclaimerLines: string[];
  fieldCells: DrawingBlockFieldCell[];
  /** Revision rows, newest first as plans print them, already token-free. */
  revisionRows: FloorplanRevision[];
  showFooter: boolean;
}

/**
 * Lay the drawing block out top-to-bottom: revision table → disclaimer → title band →
 * field grid → footer (logo + north arrow). Every measurement is in paper mm so the
 * renderer and the PDF exporter draw the same boxes at the same places.
 */
export function layoutDrawingBlock(
  block: FloorplanDrawingBlock,
  ctx: FloorplanTokenContext,
  opts: { hasLogo: boolean },
): DrawingBlockLayout {
  const innerX = DB_PAD_MM;
  const innerW = Math.max(20, block.widthMm - 2 * DB_PAD_MM);
  const sections: DrawingBlockSection[] = [];
  let y = 0;

  // Revision table: header + rows. Newest issue on top, like the reference plans.
  const revisionRows = [...block.revisions].reverse();
  if (revisionRows.length > 0) {
    const h = DB_REV_ROW_MM * (revisionRows.length + 1) + DB_PAD_MM;
    sections.push({ kind: "revisions", yMm: y, heightMm: h });
    y += h;
  }

  const disclaimer = resolveFloorplanTokens(block.disclaimer ?? "", ctx).trim();
  const disclaimerLines = disclaimer ? wrapText(disclaimer, innerW, DB_DISCLAIMER_FONT_MM) : [];
  if (disclaimerLines.length > 0) {
    const h = disclaimerLines.length * DB_DISCLAIMER_FONT_MM * 1.45 + DB_PAD_MM * 2;
    sections.push({ kind: "disclaimer", yMm: y, heightMm: h });
    y += h;
  }

  const title = resolveFloorplanTokens(block.title, ctx).trim();
  const subtitle = resolveFloorplanTokens(block.subtitle ?? "", ctx).trim();
  {
    const h = DB_PAD_MM * 2 + DB_TITLE_FONT_MM * 1.3 + (subtitle ? DB_SUBTITLE_FONT_MM * 1.6 : 0);
    sections.push({ kind: "title", yMm: y, heightMm: h });
    y += h;
  }

  // Field grid: two columns, `wide` fields span both. Each cell is label + wrapped value.
  const fieldCells: DrawingBlockFieldCell[] = [];
  if (block.fields.length > 0) {
    const gap = 1.5;
    const colW = (innerW - gap) / 2;
    let rowY = y + DB_PAD_MM;
    let col = 0;
    let rowH = 0;
    const flushRow = () => { rowY += rowH; col = 0; rowH = 0; };
    for (const field of block.fields) {
      const wide = Boolean(field.wide);
      if (wide && col === 1) flushRow();
      const w = wide ? innerW : colW;
      const x = innerX + (col === 1 ? colW + gap : 0);
      const label = resolveFloorplanTokens(field.label, ctx);
      const value = resolveFloorplanTokens(field.value, ctx);
      const lines = wrapText(value, w - 2, DB_FIELD_VALUE_FONT_MM);
      const h = DB_FIELD_LABEL_FONT_MM * 1.5 + lines.length * DB_FIELD_VALUE_FONT_MM * 1.4 + 1.5;
      fieldCells.push({ field, label, lines, xMm: x, yMm: rowY, wMm: w, hMm: h });
      rowH = Math.max(rowH, h);
      if (wide || col === 1) flushRow();
      else col = 1;
    }
    if (col === 1) flushRow();
    // Cells in a row share the row's height so their borders line up.
    for (const cell of fieldCells) {
      const rowMates = fieldCells.filter((c) => c.yMm === cell.yMm);
      cell.hMm = Math.max(...rowMates.map((c) => c.hMm));
    }
    const h = rowY - y + DB_PAD_MM;
    sections.push({ kind: "fields", yMm: y, heightMm: h });
    y += h;
  }

  const showFooter = (block.showLogo && opts.hasLogo) || block.showNorthArrow;
  if (showFooter) {
    sections.push({ kind: "footer", yMm: y, heightMm: DB_FOOTER_MM });
    y += DB_FOOTER_MM;
  }

  // A stretched block gives the extra room to the title band — that is where architects'
  // blocks carry their whitespace, so ours reads the same when laid over one.
  const minH = block.minHeightMm ?? 0;
  if (y < minH) {
    const extra = minH - y;
    const titleIdx = sections.findIndex((s) => s.kind === "title");
    if (titleIdx >= 0) {
      sections[titleIdx].heightMm += extra;
      for (let i = titleIdx + 1; i < sections.length; i++) sections[i].yMm += extra;
      for (const cell of fieldCells) cell.yMm += extra;
    }
    y = minH;
  }

  return {
    widthMm: block.widthMm,
    heightMm: y,
    innerXMm: innerX,
    innerWMm: innerW,
    sections,
    title,
    subtitle,
    disclaimerLines,
    fieldCells,
    revisionRows,
    showFooter,
  };
}

/** Next revision index after the last one: "A" → "B", "01" → "02", nothing → "A". */
export function nextRevisionIndex(revisions: FloorplanRevision[]): string {
  const last = revisions[revisions.length - 1]?.index?.trim();
  if (!last) return "A";
  if (/^\d+$/.test(last)) return String(Number(last) + 1).padStart(last.length, "0");
  if (/^[A-Za-z]$/.test(last)) {
    const code = last.charCodeAt(0);
    const isUpper = last === last.toUpperCase();
    const z = isUpper ? 90 : 122;
    return code >= z ? last + (isUpper ? "A" : "a") : String.fromCharCode(code + 1);
  }
  return `${last}+`;
}

/** Formats today's date the way German plans stamp it (04.09.26). */
export function formatPlanDate(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

// ── Notes ────────────────────────────────────────────────────────────

/** Wrapped lines and box height of a note, shared by screen and PDF. */
export function layoutNote(note: FloorplanNote): { lines: string[]; heightMm: number; lineHeightMm: number } {
  const pad = note.boxed ? 1.5 : 0;
  const lines = wrapText(note.text, note.widthMm - 2 * pad, note.fontSizeMm);
  const lineHeightMm = note.fontSizeMm * 1.4;
  return { lines, heightMm: lines.length * lineHeightMm + 2 * pad, lineHeightMm };
}

// ── Sheet ↔ plan format ──────────────────────────────────────────────

export interface PaperChoice {
  paperId: string;
  orientation: "landscape" | "portrait";
  customWidthIn?: number;
  customHeightIn?: number;
}

/** Paper sizes may differ from the nominal by this much and still count as a match —
 *  PDF plotters round page boxes by a millimetre or two. */
const PAPER_MATCH_TOLERANCE_MM = 3;

/**
 * Pick the sheet format that matches a physical page size — the imported architect's
 * drawing keeps its own format instead of being parked on a differently shaped sheet.
 * Standard sizes are matched in either orientation; anything else becomes a custom sheet
 * of exactly that size.
 */
export function matchPaperToSize(widthMm: number, heightMm: number): PaperChoice {
  const orientation: PaperChoice["orientation"] = widthMm > heightMm ? "landscape" : "portrait";
  const shortMm = Math.min(widthMm, heightMm);
  const longMm = Math.max(widthMm, heightMm);
  for (const paper of PAPER_SIZES) {
    const w = paper.widthIn * IN_TO_MM;
    const h = paper.heightIn * IN_TO_MM;
    if (Math.abs(w - shortMm) <= PAPER_MATCH_TOLERANCE_MM && Math.abs(h - longMm) <= PAPER_MATCH_TOLERANCE_MM) {
      return { paperId: paper.id, orientation };
    }
  }
  // Custom sheets store portrait dimensions plus an orientation, like the standard ones.
  return {
    paperId: "custom",
    orientation,
    customWidthIn: shortMm / IN_TO_MM,
    customHeightIn: longMm / IN_TO_MM,
  };
}

/**
 * Placement that makes the underlay cover the whole sheet, edge to edge. A PDF page
 * whose format the sheet already matches lands 1:1; an image (no physical size) is
 * fitted inside the sheet with its aspect kept, centered — stretching a scan would
 * corrupt every distance measured off it.
 */
export function fillSheetPlacement(
  page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">,
  underlay: Pick<FloorplanUnderlay, "naturalWidthPx" | "naturalHeightPx">,
): { positionMm: Vec2; sizeMm: { w: number; h: number } } {
  const sheet = sheetSizeMm(page);
  const aspect = underlay.naturalHeightPx > 0 ? underlay.naturalWidthPx / underlay.naturalHeightPx : 1;
  const sheetAspect = sheet.w / sheet.h;
  // Within a percent of the sheet's aspect the source IS the sheet — cover it exactly so
  // a rounding difference never leaves a hairline of white at one edge.
  if (Math.abs(aspect / sheetAspect - 1) < 0.01) {
    return { positionMm: { x: 0, y: 0 }, sizeMm: { w: sheet.w, h: sheet.h } };
  }
  return fitRectInArea(underlay.naturalWidthPx, underlay.naturalHeightPx, { x: 0, y: 0, w: sheet.w, h: sheet.h });
}

// ── Masks ────────────────────────────────────────────────────────────

/** Smallest cover worth keeping — anything smaller is a slipped click, not a mask. */
export const MASK_MIN_SIZE_MM = 4;

/** Normalize a drag from `a` to `b` into a top-left rect, clamped to the sheet. */
export function rectFromDrag(
  a: Vec2,
  b: Vec2,
  page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">,
): Pick<FloorplanMask, "positionMm" | "sizeMm"> {
  const p = clampToSheet(a, page);
  const q = clampToSheet(b, page);
  const x = Math.min(p.x, q.x);
  const y = Math.min(p.y, q.y);
  return { positionMm: { x, y }, sizeMm: { w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) } };
}

// ── Coverage areas ───────────────────────────────────────────────────

export const DEFAULT_COVERAGE_COLOR = "#0ea5e9";
/** Areas overlap constantly — two detectors watching one room is the normal case, and a
 *  plan is only judgeable if the overlap is still readable. Hence a light fill. */
export const DEFAULT_COVERAGE_OPACITY = 0.22;
export const DEFAULT_COVERAGE_RANGE_M = 12;
export const DEFAULT_COVERAGE_APERTURE_DEG = 90;
export const DEFAULT_COVERAGE_WIDTH_M = 2;
/** Smallest reach worth drawing, and the largest that is still a device rather than a
 *  mistyped field. */
export const COVERAGE_MIN_RANGE_M = 0.5;
export const COVERAGE_MAX_RANGE_M = 300;

/** Arc resolution: one point every few degrees keeps a circle smooth at plan scale while
 *  a page full of areas stays a few hundred points, not a few thousand. */
const COVERAGE_ARC_STEP_DEG = 4;

function clampRange(m: number): number {
  if (!Number.isFinite(m)) return DEFAULT_COVERAGE_RANGE_M;
  return Math.min(COVERAGE_MAX_RANGE_M, Math.max(COVERAGE_MIN_RANGE_M, m));
}

/** The aperture a sector actually draws with, in degrees (1–360). */
export function coverageApertureDeg(coverage: Pick<FloorplanCoverage, "apertureDeg">): number {
  const a = coverage.apertureDeg ?? DEFAULT_COVERAGE_APERTURE_DEG;
  if (!Number.isFinite(a)) return DEFAULT_COVERAGE_APERTURE_DEG;
  return Math.min(360, Math.max(1, a));
}

// ── Camera optics: from lens and sensor to a range ───────────────────

export const DEFAULT_COVERAGE_ASPECT_RATIO = 16 / 9;
export const DEFAULT_DORI_LEVEL: DoriLevel = "recognise";
/** Sensor sizes worth offering as presets — the ones cameras are actually sold in. */
export const COVERAGE_MP_PRESETS = [2, 4, 5, 8, 12];
export const COVERAGE_ASPECT_PRESETS: { label: string; value: number }[] = [
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
];

/** How many pixels wide the sensor is, derived from megapixels and the aspect ratio.
 *  w × h = MP and w ÷ h = aspect, so w = √(MP · aspect). */
export function coverageHorizontalPixels(optics: Pick<CoverageOptics, "megapixels" | "aspectRatio">): number {
  const mp = Math.max(0.1, Number.isFinite(optics.megapixels) ? optics.megapixels : 2);
  const aspect = optics.aspectRatio && optics.aspectRatio > 0 ? optics.aspectRatio : DEFAULT_COVERAGE_ASPECT_RATIO;
  return Math.sqrt(mp * 1e6 * aspect);
}

/** How wide the scene is, in metres, at a given distance from a lens of this angle.
 *  Straight trigonometry: the field of view is an isoceles triangle. */
export function coverageSceneWidthM(hfovDeg: number, distanceM: number): number {
  const half = (Math.min(179, Math.max(1, hfovDeg)) * Math.PI) / 360;
  return 2 * distanceM * Math.tan(half);
}

/** Pixel density at a given distance, in pixels per metre of scene width — the number
 *  every DORI judgement is actually made on. */
export function coveragePixelDensityAt(
  optics: Pick<CoverageOptics, "megapixels" | "aspectRatio">,
  hfovDeg: number,
  distanceM: number,
): number {
  const width = coverageSceneWidthM(hfovDeg, distanceM);
  return width <= 0 ? 0 : coverageHorizontalPixels(optics) / width;
}

/**
 * The distance at which this lens still delivers the pixel density its DORI level needs.
 * Inverting the density formula: d = pixels ÷ (2 · required · tan(hfov/2)).
 *
 * This is why a camera's area cannot be dragged to size — widen the lens and the reach
 * genuinely shrinks, because the same pixels are spread over more scene.
 */
export function coverageDoriRangeM(optics: CoverageOptics, hfovDeg: number): number {
  const required = DORI_PX_PER_M[optics.dori] ?? DORI_PX_PER_M[DEFAULT_DORI_LEVEL];
  const half = (Math.min(179, Math.max(1, hfovDeg)) * Math.PI) / 360;
  const tan = Math.tan(half);
  if (tan <= 0 || required <= 0) return DEFAULT_COVERAGE_RANGE_M;
  return coverageHorizontalPixels(optics) / (2 * required * tan);
}

/**
 * The reach an area is actually drawn with. A camera's comes from its optics, everything
 * else carries the metres someone typed. Single source of truth on purpose: the derived
 * range is never written back, so it cannot drift out of step with the lens.
 */
export function effectiveRangeM(
  coverage: Pick<FloorplanCoverage, "rangeM" | "optics" | "apertureDeg">,
): number {
  if (!coverage.optics) return clampRange(coverage.rangeM);
  return clampRange(coverageDoriRangeM(coverage.optics, coverageApertureDeg(coverage)));
}

/** A box's width in metres: its own, else as wide as it is long — a square. */
export function coverageBoxWidthM(coverage: Pick<FloorplanCoverage, "rangeM" | "widthM">): number {
  const w = coverage.widthM;
  return Number.isFinite(w) && (w as number) > 0 ? clampRange(w as number) : clampRange(coverage.rangeM);
}

/** A box's offset from its anchor in paper mm, unrotated. Zero for every other shape. */
export function coverageOffsetMm(coverage: Pick<FloorplanCoverage, "shape" | "offsetM">, scaleDenominator: number): Vec2 {
  if (coverage.shape !== "box" || !coverage.offsetM) return { x: 0, y: 0 };
  return {
    x: realMmToPaperMm(coverage.offsetM.x * 1000, scaleDenominator),
    y: realMmToPaperMm(coverage.offsetM.y * 1000, scaleDenominator),
  };
}

/**
 * The outline of a coverage area in paper mm, relative to its anchor point and unrotated
 * (0° faces +x, to the right of the sheet). One closed polygon serves both renderers:
 * the screen draws it as an SVG path, the PDF as a filled path, so what is judged on
 * screen is what prints.
 *
 * The shapes are anchored the way the device sits: a sector and a rect start at the
 * device and reach away from it, a circle is centred on it.
 */
export function coverageOutlineMm(
  coverage: Pick<FloorplanCoverage, "shape" | "rangeM" | "apertureDeg" | "widthM" | "optics" | "offsetM">,
  scaleDenominator: number,
): Vec2[] {
  const r = realMmToPaperMm(effectiveRangeM(coverage) * 1000, scaleDenominator);
  if (r <= 0) return [];

  const arc = (fromDeg: number, toDeg: number): Vec2[] => {
    const span = toDeg - fromDeg;
    const steps = Math.max(2, Math.ceil(Math.abs(span) / COVERAGE_ARC_STEP_DEG));
    const pts: Vec2[] = [];
    for (let i = 0; i <= steps; i++) {
      const rad = ((fromDeg + (span * i) / steps) * Math.PI) / 180;
      pts.push({ x: r * Math.cos(rad), y: r * Math.sin(rad) });
    }
    return pts;
  };

  switch (coverage.shape) {
    case "circle":
      // A full ring: no apex, or the polygon would close through the centre.
      return arc(0, 360).slice(0, -1);
    case "rect": {
      const halfW = realMmToPaperMm(Math.max(0.1, coverage.widthM ?? DEFAULT_COVERAGE_WIDTH_M) * 1000, scaleDenominator) / 2;
      return [
        { x: 0, y: -halfW },
        { x: r, y: -halfW },
        { x: r, y: halfW },
        { x: 0, y: halfW },
      ];
    }
    case "box": {
      // Around the device, not in front of it — and off to one side where the seats are.
      const halfW = realMmToPaperMm(coverageBoxWidthM(coverage) * 1000, scaleDenominator) / 2;
      const o = coverageOffsetMm(coverage, scaleDenominator);
      return [
        { x: o.x - r / 2, y: o.y - halfW },
        { x: o.x + r / 2, y: o.y - halfW },
        { x: o.x + r / 2, y: o.y + halfW },
        { x: o.x - r / 2, y: o.y + halfW },
      ];
    }
    case "sector":
    default: {
      const aperture = coverageApertureDeg(coverage);
      // At 360° the wedge has become a ring — drawing the apex would leave a seam.
      if (aperture >= 360) return arc(0, 360).slice(0, -1);
      return [{ x: 0, y: 0 }, ...arc(-aperture / 2, aperture / 2)];
    }
  }
}

/** Where the area sits on the sheet: its symbol's position when anchored, else its own. */
export function coverageAnchorMm(
  coverage: Pick<FloorplanCoverage, "symbolId" | "positionMm">,
  symbols: readonly Pick<FloorplanSymbol, "id" | "positionMm">[],
): Vec2 {
  if (coverage.symbolId) {
    const symbol = symbols.find((s) => s.id === coverage.symbolId);
    if (symbol) return { ...symbol.positionMm };
  }
  return { ...coverage.positionMm };
}

/** Which way the area faces: the symbol's own aim plus the area's offset when anchored,
 *  so turning a camera on the plan turns what it sees. */
export function coverageRotationDeg(
  coverage: Pick<FloorplanCoverage, "symbolId" | "rotationDeg">,
  symbols: readonly Pick<FloorplanSymbol, "id" | "rotationDeg">[],
): number {
  const own = coverage.rotationDeg ?? 0;
  if (!coverage.symbolId) return own;
  const symbol = symbols.find((s) => s.id === coverage.symbolId);
  return own + (symbol?.rotationDeg ?? 0);
}

/** The area's outline placed on the sheet: turned, then moved onto its anchor. Absolute
 *  paper mm, ready to draw. */
export function coveragePointsOnSheet(
  coverage: FloorplanCoverage,
  page: Pick<FloorplanPage, "symbols" | "scaleDenominator">,
): Vec2[] {
  const anchor = coverageAnchorMm(coverage, page.symbols);
  const turn = coverageRotationDeg(coverage, page.symbols);
  return coverageOutlineMm(coverage, page.scaleDenominator).map((p) => {
    const r = rotateVec(p, turn);
    return { x: anchor.x + r.x, y: anchor.y + r.y };
  });
}

/** An SVG path for a coverage outline — the same points the PDF fills. */
export function coveragePathD(points: readonly Vec2[], mmToPx: (mm: number) => number): string {
  if (points.length === 0) return "";
  const seg = points.map((p, i) => `${i === 0 ? "M" : "L"}${mmToPx(p.x).toFixed(2)} ${mmToPx(p.y).toFixed(2)}`);
  return `${seg.join(" ")} Z`;
}

/** The fill an area is drawn with: its own color, else its group's, else the default. */
export function coverageColor(
  coverage: Pick<FloorplanCoverage, "color" | "groupId">,
  groups: readonly Pick<FloorplanSymbolGroup, "id" | "color">[],
): string {
  if (coverage.color) return coverage.color;
  const group = coverage.groupId ? groups.find((g) => g.id === coverage.groupId) : undefined;
  return group?.color ?? DEFAULT_COVERAGE_COLOR;
}

/** Is this area drawn at all? Its own switch first, then its group's layer. */
export function isCoverageVisible(
  coverage: Pick<FloorplanCoverage, "hidden" | "groupId">,
  groups: readonly Pick<FloorplanSymbolGroup, "id" | "hidden">[],
): boolean {
  if (coverage.hidden) return false;
  if (!coverage.groupId) return true;
  const group = groups.find((g) => g.id === coverage.groupId);
  // An area filed under a group that no longer exists is orphaned, not hidden.
  return group ? isGroupVisible(group) : true;
}

/** How an area reads in a legend or a list: "12.0 m / 90°", "R 8.0 m", "15.0 × 2.0 m",
 *  and for a camera the lens it follows from: "4 MP · 90° · 10.7 m (recognise)". */
export function formatCoverageSpec(
  coverage: Pick<FloorplanCoverage, "shape" | "rangeM" | "apertureDeg" | "widthM" | "optics" | "mic">,
): string {
  const range = effectiveRangeM(coverage).toFixed(1);
  if (coverage.optics) {
    const mp = coverage.optics.megapixels;
    return `${mp} MP · ${Math.round(coverageApertureDeg(coverage))}° · ${range} m (${coverage.optics.dori})`;
  }
  switch (coverage.shape) {
    case "circle":
      return `R ${range} m`;
    case "rect":
      return `${range} × ${Math.max(0.1, coverage.widthM ?? DEFAULT_COVERAGE_WIDTH_M).toFixed(1)} m`;
    case "box": {
      const size = `${range} × ${coverageBoxWidthM(coverage).toFixed(1)} m`;
      return coverage.mic ? `${size} · H ${coverage.mic.mountHeightM.toFixed(1)} m` : size;
    }
    case "sector":
    default:
      return `${range} m / ${Math.round(coverageApertureDeg(coverage))}°`;
  }
}

/** A camera area for a device that has just been placed: a generic lens at the level most
 *  plans are actually judged on. */
export function defaultCameraOptics(): CoverageOptics {
  return { megapixels: 4, aspectRatio: DEFAULT_COVERAGE_ASPECT_RATIO, dori: DEFAULT_DORI_LEVEL };
}

/** Device types whose coverage is a lens rather than a measured reach. The broadcast
 *  camera types are in here too: a PTZ documenting a room is aimed the same way. */
export const CAMERA_DEVICE_TYPES = new Set(["ip-camera", "camera", "ptz-camera"]);

export function isCameraDeviceType(deviceType?: string): boolean {
  return Boolean(deviceType && CAMERA_DEVICE_TYPES.has(deviceType));
}

/** Device types that radiate all round rather than in a direction. A ceiling access
 *  point has no aim, so a wedge would be a lie about it. */
export const OMNI_DEVICE_TYPES = new Set(["access-point", "network-wifi"]);

export function isAccessPointDeviceType(deviceType?: string): boolean {
  return Boolean(deviceType && OMNI_DEVICE_TYPES.has(deviceType));
}

/**
 * A new area for a device, already set up the way that kind of device is judged.
 *
 *  - a camera gets a lens that computes its own reach from megapixels and angle;
 *  - an access point gets a circle, because it radiates all round — a wall-mounted one
 *    can be switched to a sector afterwards;
 *  - everything else gets a wedge and a reach in metres off the datasheet.
 *
 * `rangeM` lets the caller supply a computed reach — for an access point that is its own
 * free-run radius, which the caller can work out because it holds the radio spec.
 */
export function defaultCoverageForDevice(
  deviceType?: string,
  opts?: { rangeM?: number; mount?: "ceiling" | "wall"; mic?: MicCoverageSpec },
): Omit<FloorplanCoverage, "id"> {
  // A ceiling microphone is judged by the floor under it, whatever its device type says.
  if (opts?.mic) return micCoverageFor(opts.mic);
  if (isAccessPointDeviceType(deviceType)) {
    // A wall or in-wall unit throws into the room; only a ceiling unit is all round.
    if (opts?.mount === "wall") {
      const wedge = defaultCoverage("sector");
      return { ...wedge, apertureDeg: WALL_AP_APERTURE_DEG, rangeM: opts?.rangeM ?? wedge.rangeM };
    }
    const circle = defaultCoverage("circle");
    return { ...circle, rangeM: opts?.rangeM ?? circle.rangeM };
  }
  const base = defaultCoverage("sector");
  const withRange = opts?.rangeM ? { ...base, rangeM: opts.rangeM } : base;
  if (!isCameraDeviceType(deviceType)) return withRange;
  return { ...withRange, optics: defaultCameraOptics() };
}

/**
 * Should this area offer the camera-optics control at all?
 *
 * Only where a lens is a possibility. An area anchored to an access point has no lens —
 * it radiates — and one anchored to a motion detector is judged in metres off a
 * datasheet. A free-standing area keeps the control, because it may well stand for a
 * camera nobody has chosen yet.
 *
 * An area that already carries optics always keeps the control, whatever it is anchored
 * to: hiding the only way out of a state is worse than showing an odd choice.
 */
export function coverageOffersOptics(
  coverage: Pick<FloorplanCoverage, "optics">,
  anchoredDeviceType?: string,
): boolean {
  if (coverage.optics) return true;
  if (!anchoredDeviceType) return true;
  return isCameraDeviceType(anchoredDeviceType);
}

/** Where an area's caption goes: just past the far edge, along the direction it faces, so
 *  the text sits outside the fill instead of being swallowed by it. */
export function coverageLabelAnchorMm(
  coverage: FloorplanCoverage,
  page: Pick<FloorplanPage, "symbols" | "scaleDenominator">,
): Vec2 {
  const anchor = coverageAnchorMm(coverage, page.symbols);
  const turn = coverageRotationDeg(coverage, page.symbols);
  const r = realMmToPaperMm(effectiveRangeM(coverage) * 1000, page.scaleDenominator) + 2;
  // A circle has no direction to write along, so its caption drops below the ring.
  const o = coverageOffsetMm(coverage, page.scaleDenominator);
  const local = coverage.shape === "circle"
    ? { x: 0, y: r }
    // A box reaches half its length either way from its middle.
    : coverage.shape === "box" ? { x: o.x + (r - 2) / 2 + 2, y: o.y } : { x: r, y: 0 };
  const out = rotateVec(local, turn);
  return { x: anchor.x + out.x, y: anchor.y + out.y };
}

/** A new area for a device that has just been aimed on the plan, taking its reach from
 *  the shape's defaults. Callers override whatever the datasheet says. */
export function defaultCoverage(shape: CoverageShape = "sector"): Omit<FloorplanCoverage, "id"> {
  return {
    shape,
    positionMm: { x: 0, y: 0 },
    rangeM: DEFAULT_COVERAGE_RANGE_M,
    apertureDeg: shape === "sector" ? DEFAULT_COVERAGE_APERTURE_DEG : undefined,
    widthM: shape === "rect" ? DEFAULT_COVERAGE_WIDTH_M : shape === "box" ? DEFAULT_COVERAGE_RANGE_M : undefined,
    opacity: DEFAULT_COVERAGE_OPACITY,
  };
}

// ── Ceiling microphones ──────────────────────────────────────────────

/** Where a ceiling microphone hangs when nobody has said: an ordinary suspended ceiling. */
export const DEFAULT_MIC_MOUNT_HEIGHT_M = 2.7;
/** A seated talker's mouth above the floor. */
export const DEFAULT_TALKER_HEIGHT_M = 1.2;
export const MIC_MOUNT_HEIGHT_RANGE_M = { min: 1.8, max: 12 };

/** The area a microphone covers out of the box: the maker's size, centred under it. */
export function micCoverageFor(spec: MicCoverageSpec, opts?: { dedicated?: boolean; mountHeightM?: number }): Omit<FloorplanCoverage, "id"> {
  const dedicated = Boolean(opts?.dedicated && spec.dedicatedAreaM);
  const area = dedicated ? spec.dedicatedAreaM! : spec.areaM;
  const mic: CoverageMic = {
    mountHeightM: opts?.mountHeightM ?? DEFAULT_MIC_MOUNT_HEIGHT_M,
    maxTalkerDistanceM: spec.maxTalkerDistanceM,
    maxMountHeightM: spec.maxMountHeightM,
    minSideM: spec.minSideM,
    maxSideM: spec.fixed || spec.minSideM !== undefined ? Math.max(spec.areaM.w, spec.areaM.d) : undefined,
    fixed: spec.fixed || dedicated || undefined,
    maxAreas: spec.maxAreas,
    dedicated: dedicated || undefined,
  };
  return {
    shape: "box",
    positionMm: { x: 0, y: 0 },
    rangeM: area.d,
    widthM: area.w,
    opacity: DEFAULT_COVERAGE_OPACITY,
    mic,
  };
}

/**
 * How far out a talker may sit, measured along the floor from the point under the
 * microphone. The maker states the straight line from mouth to array; the height between
 * the two eats part of it, so a higher ceiling leaves a smaller circle.
 *
 * Null when the maker states no distance. Zero when the microphone hangs so high that
 * even the seat right under it is too far.
 */
export function micReachM(mic: Pick<CoverageMic, "mountHeightM" | "talkerHeightM" | "maxTalkerDistanceM">): number | null {
  const d = mic.maxTalkerDistanceM;
  if (!d || d <= 0) return null;
  const rise = Math.max(0, mic.mountHeightM - (mic.talkerHeightM ?? DEFAULT_TALKER_HEIGHT_M));
  return rise >= d ? 0 : Math.sqrt(d * d - rise * rise);
}

/** The area of a simple polygon, whichever way it winds. */
export function polygonArea(points: readonly Vec2[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/** `subject` cut down to what lies inside the convex polygon `clip` (Sutherland–Hodgman). */
export function clipToConvex(subject: readonly Vec2[], clip: readonly Vec2[]): Vec2[] {
  if (clip.length < 3) return [];
  // Which side is inside depends on the way the clip polygon winds.
  let twice = 0;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    twice += a.x * b.y - b.x * a.y;
  }
  const sign = twice >= 0 ? 1 : -1;
  let out = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const side = (p: Vec2) => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k], q = input[(k + 1) % input.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const f = sp / (sp - sq);
        out.push({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f });
      }
    }
  }
  return out;
}

/** A side length the device can actually be set to. */
export function clampMicSideM(mic: Pick<CoverageMic, "minSideM" | "maxSideM"> | undefined, sideM: number): number {
  const lo = Math.max(COVERAGE_MIN_RANGE_M, mic?.minSideM ?? COVERAGE_MIN_RANGE_M);
  const hi = Math.min(COVERAGE_MAX_RANGE_M, mic?.maxSideM ?? COVERAGE_MAX_RANGE_M);
  return Math.min(hi, Math.max(lo, sideM));
}

/** What a microphone's area looks like against its reach, on the sheet in paper mm. */
export interface MicReachOnSheet {
  /** The point under the microphone. */
  center: Vec2;
  /** How far out a talker may sit, on paper. */
  radiusMm: number;
  /** The reach as a closed ring of points. Empty when the reach is zero. */
  ring: Vec2[];
  /** The part of the area a talker can be heard in. Empty when none of it is. */
  within: Vec2[];
  /** Share of the area inside the reach, 0–1. */
  share: number;
}

/**
 * A microphone area set against the reach its mounting height leaves. Null for an area
 * that is not a microphone's, or whose maker states no talker distance.
 */
export function micReachOnSheet(
  coverage: FloorplanCoverage,
  page: Pick<FloorplanPage, "symbols" | "scaleDenominator">,
): MicReachOnSheet | null {
  if (coverage.shape !== "box" || !coverage.mic) return null;
  const reachM = micReachM(coverage.mic);
  if (reachM === null) return null;
  const center = coverageAnchorMm(coverage, page.symbols);
  const radiusMm = realMmToPaperMm(reachM * 1000, page.scaleDenominator);
  const area = coveragePointsOnSheet(coverage, page);
  const ring: Vec2[] = [];
  if (radiusMm > 0) {
    const steps = Math.ceil(360 / COVERAGE_ARC_STEP_DEG);
    for (let i = 0; i < steps; i++) {
      const rad = (i * 2 * Math.PI) / steps;
      ring.push({ x: center.x + radiusMm * Math.cos(rad), y: center.y + radiusMm * Math.sin(rad) });
    }
  }
  const within = ring.length > 0 ? clipToConvex(ring, area) : [];
  const whole = polygonArea(area);
  const share = whole > 0 && within.length >= 3 ? Math.min(1, polygonArea(within) / whole) : 0;
  return { center, radiusMm, ring, within: within.length >= 3 ? within : [], share };
}

/** What is wrong with a microphone's area, for the panel to say in words. */
export type MicCoverageIssue = "too-high" | "out-of-reach" | "partly-out-of-reach" | "too-many-areas";

export function micCoverageIssues(
  coverage: FloorplanCoverage,
  page: Pick<FloorplanPage, "symbols" | "scaleDenominator" | "coverages">,
): MicCoverageIssue[] {
  const mic = coverage.mic;
  if (!mic) return [];
  const issues: MicCoverageIssue[] = [];
  if (mic.maxMountHeightM && mic.mountHeightM > mic.maxMountHeightM + 1e-9) issues.push("too-high");
  const reach = micReachOnSheet(coverage, page);
  // A ring of straight pieces falls a hair short of the circle; that is not a finding.
  if (reach) {
    if (reach.share <= 0) issues.push("out-of-reach");
    else if (reach.share < 0.995) issues.push("partly-out-of-reach");
  }
  if (coverage.symbolId && mic.maxAreas) {
    const onDevice = (page.coverages ?? []).filter((c) => c.symbolId === coverage.symbolId && c.mic).length;
    if (onDevice > mic.maxAreas) issues.push("too-many-areas");
  }
  return issues;
}

/** One more area for a microphone that already has some: steered at a seat if the device
 *  has such areas, and set beside the others so it does not land on top of them. Null
 *  when the device carries no more. */
export function nextMicCoverage(
  existing: readonly FloorplanCoverage[],
  spec: MicCoverageSpec,
): Omit<FloorplanCoverage, "id"> | null {
  const mics = existing.filter((c) => c.mic);
  if (mics.length === 0) return micCoverageFor(spec);
  if (mics.length >= (spec.maxAreas ?? 1)) return null;
  const next = micCoverageFor(spec, { dedicated: true, mountHeightM: mics[0].mic!.mountHeightM });
  // Side by side along the device's own axis, a step apart per area already there.
  return { ...next, mic: { ...next.mic!, talkerHeightM: mics[0].mic!.talkerHeightM }, offsetM: { x: (mics.length - 1) * (next.rangeM + 0.5), y: 0 } };
}

// ── What is drawn but not yet wired ─────────────────────────────────

/** A symbol that stands on a plan while the schematic knows nothing about it. */
export interface PlanOnlySymbol {
  pageId: string;
  pageLabel: string;
  symbolId: string;
  /** The number as it reads on the plan, e.g. "K7". */
  label: string;
  group: FloorplanSymbolGroup;
}

/**
 * Symbols on a plan with no device behind them.
 *
 * Planning runs both ways round. Sometimes the schematic exists and the devices get placed
 * on the drawing; just as often somebody walks the building, drops cameras where they have
 * to hang, and only then works out what they are plugged into. The second way used to be a
 * dead end: the symbols stood on the sheet and nothing offered to make them real.
 *
 * A dangling link counts as missing too — the device was deleted from the schematic, the
 * symbol stayed on the plan.
 */
export function planSymbolsWithoutDevice(
  pages: Pick<FloorplanPage, "id" | "label" | "symbols" | "groups">[],
  deviceIds: ReadonlySet<string>,
): PlanOnlySymbol[] {
  const out: PlanOnlySymbol[] = [];
  for (const page of pages) {
    for (const symbol of page.symbols) {
      if (symbol.deviceNodeId && deviceIds.has(symbol.deviceNodeId)) continue;
      const group = page.groups.find((g) => g.id === symbol.groupId);
      if (!group) continue;
      out.push({ pageId: page.id, pageLabel: page.label, symbolId: symbol.id, label: symbol.label, group });
    }
  }
  return out;
}

// ── Legend text from the device library ─────────────────────────────

/** The fields a legend row can be derived from — a device template or a placed device. */
export interface LegendSource {
  label?: string;
  manufacturer?: string;
  modelNumber?: string;
  model?: string;
  installCable?: string;
  installNotes?: string;
}

/** Legend description line for a model: "Bose Professional DesignMax DM6SE | Kabel aus
 *  Decke: 2x2,5 mm²". The cable spec comes from the library, so it reads the same on
 *  every plan the model appears on. */
export function legendDescriptionFor(src: LegendSource): string | undefined {
  const name = [src.manufacturer, src.modelNumber ?? src.model].filter((v) => v && v.trim()).join(" ").trim() || src.label?.trim();
  const cable = src.installCable?.trim();
  if (!name && !cable) return undefined;
  return [name, cable].filter(Boolean).join(" | ");
}

/** Installation note line for the legend's notes block: "DM6SE: Montage an der Decke …". */
export function legendInstallNoteFor(src: LegendSource): string | undefined {
  const note = src.installNotes?.trim();
  if (!note) return undefined;
  const key = (src.modelNumber ?? src.model ?? src.label ?? "").trim();
  return key ? `${key}: ${note}` : note;
}

/** Append `line` to a legend's notes unless an identical line is already there. */
export function appendLegendNote(notes: string[] | undefined, line: string | undefined): string[] | undefined {
  if (!line) return notes;
  const existing = (notes ?? []).map((n) => n.trim());
  if (existing.includes(line.trim())) return notes;
  return [...(notes ?? []).filter((n, i, arr) => !(n.trim() === "" && i === arr.length - 1)), line];
}

// ── Company block ────────────────────────────────────────────────────

export const LEGEND_COMPANY_LOGO_MM = 12;
export const LEGEND_COMPANY_LINE_MM = 3.2;
export const LEGEND_COMPANY_GAP_MM = 3;

/** A profile is worth printing once it has a name, a line of address or a logo. */
export function hasCompanyProfile(p: CompanyProfile | null | undefined): p is CompanyProfile {
  return Boolean(p && (p.name.trim() || p.addressLines.some((l) => l.trim()) || p.logo));
}

/** "Tel. 05… · mail@… · www.…" — the contact line under the address. */
export function companyContactLine(p: CompanyProfile | null): string {
  if (!p) return "";
  return [p.phone && `Tel. ${p.phone.trim()}`, p.email?.trim(), p.web?.trim()].filter(Boolean).join(" · ");
}

/** Text lines of the company block: name first, then address, then the contact line. */
export function companyProfileLines(p: CompanyProfile): string[] {
  const lines = [p.name.trim(), ...p.addressLines.map((l) => l.trim()).filter(Boolean)];
  const contact = companyContactLine(p);
  if (contact) lines.push(contact);
  return lines.filter(Boolean);
}

/** Height the company block adds to the legend. */
export function legendCompanyHeightMm(p: CompanyProfile): number {
  const textH = companyProfileLines(p).length * LEGEND_COMPANY_LINE_MM;
  return LEGEND_COMPANY_GAP_MM + Math.max(p.logo ? LEGEND_COMPANY_LOGO_MM : 0, textH) + 1;
}

// ── Plan symbols from the device library ─────────────────────────────

/** Shape by device type when a model has no symbol of its own: what installers expect to
 *  read at a glance — round for loudspeakers, square for subs, triangles for microphones,
 *  pictograms for projectors, cameras, racks and displays, diamonds for other video. */
export function defaultSymbolShapeFor(deviceType: string | undefined): FloorplanSymbolGroup["shape"] {
  const t = (deviceType ?? "").toLowerCase();
  if (/sub/.test(t)) return "square";
  if (/mic/.test(t)) return "triangle";
  if (/projector/.test(t)) return "projector";
  if (/camera/.test(t)) return "camera";
  if (/rack/.test(t)) return "rack";
  if (/display|screen|video-wall|^monitor$|^tv$/.test(t)) return "display";
  if (/monitor|video/.test(t)) return "diamond";
  return "circle";
}

/** Stable palette color for a seed (template id, model), so a model keeps its color across
 *  plans without anyone assigning one. */
export function defaultSymbolColorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FLOORPLAN_GROUP_COLORS[h % FLOORPLAN_GROUP_COLORS.length];
}

/** The symbol a group for this model should start with: the library's own, completed
 *  with derived defaults where it says nothing. */
export function planSymbolFor(src: { planSymbol?: PlanSymbolSpec; deviceType?: string; templateId?: string; id?: string; modelNumber?: string; label?: string }): Required<Pick<PlanSymbolSpec, "shape" | "color">> & Pick<PlanSymbolSpec, "glyph" | "imageSrc" | "libraryId" | "outlineColor" | "outlineWidthMm"> {
  const seed = src.templateId ?? src.id ?? src.modelNumber ?? src.label ?? "";
  return {
    shape: src.planSymbol?.shape ?? defaultSymbolShapeFor(src.deviceType),
    color: src.planSymbol?.color ?? defaultSymbolColorFor(seed),
    glyph: src.planSymbol?.glyph?.trim().slice(0, 2) || undefined,
    imageSrc: src.planSymbol?.imageSrc || undefined,
    // The model's own choice first, else what the BHE draws for this kind of device. Both
    // may be nothing, and then the shape above is what gets drawn.
    libraryId: src.planSymbol?.libraryId || defaultSymbolLibraryIdFor(src.deviceType),
    outlineColor: src.planSymbol?.outlineColor || undefined,
    outlineWidthMm: src.planSymbol?.outlineWidthMm,
  };
}

/** How much wider a square grows when turned by `deg` — the factor both the rotated raster
 *  and its placement on the sheet use, so a turned picture keeps its scale. */
/** A point turned `deg` clockwise about the origin. Screen and legend rotate with a CSS /
 *  SVG transform; the PDF has no transform stack for filled paths, so it turns the points
 *  through here instead — both end up drawing the same picture. */
export function rotatedSquareFactor(deg: number): number {
  const rad = (deg * Math.PI) / 180;
  return Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
}

export function rotateVec(v: Vec2, deg: number): Vec2 {
  if (!deg) return v;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** Black or white, whichever reads on the given fill. */
export function glyphColorOn(fillHex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(fillHex.trim());
  if (!m) return "#000000";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? "#000000" : "#ffffff";
}

// ── Plan kinds and structured numbering ──────────────────────────────

/** Per-kind defaults for the texts a plan carries. The loudspeaker preset follows the
 *  FACE Beschallungsplan: German headings, line.speaker numbering. */
export interface FloorplanKindPreset {
  labelTemplate: string;
  legendTitle: string;
  legendNotesTitle: string;
  /** Heading of the legend's line table. */
  legendLinesTitle: string;
  revisionHeaders: [string, string, string, string, string];
  /** Field labels for the drawing block, matched by position to createDefaultDrawingBlock's fields. */
  fieldLabels: string[];
  drawingSubtitle: string;
}

/** What a plan of each kind is headed with, per language.
 *
 *  These strings are drawn on the sheet, not in the chrome, so they are data rather than
 *  t() calls: a plan keeps the wording it was drawn with. What follows the interface
 *  language is the *default* — an untouched heading reads in the user's language, and the
 *  moment someone types their own it stays exactly as typed. */
const PRESETS_EN: Record<FloorplanKind, FloorplanKindPreset> = {
  generic: {
    labelTemplate: "{{n}}",
    legendTitle: "LEGEND",
    legendNotesTitle: "INSTALLATION NOTES",
    legendLinesTitle: "LINES / AMPLIFIER CHANNELS",
    revisionHeaders: ["Rev", "Date", "Change", "By", "Chk"],
    fieldLabels: ["Project", "Client", "Scale", "Sheet", "Date", "Drawn by"],
    drawingSubtitle: "{{drawingTitle}}",
  },
  wifi: {
    // Access points are numbered plainly and read as AP1, AP2 … on the sheet.
    labelTemplate: "AP{{n}}",
    legendTitle: "WI-FI COVERAGE - LEGEND & MOUNTING",
    legendNotesTitle: "MOUNTING NOTES",
    // No amplifier lines on a radio plan; the heading is carried only for completeness.
    legendLinesTitle: "LINES",
    revisionHeaders: ["Rev", "Date", "Change", "By", "Chk"],
    fieldLabels: ["Project", "Client", "Scale", "Sheet", "Date", "Drawn by"],
    drawingSubtitle: "Wi-Fi coverage",
  },
  loudspeaker: {
    labelTemplate: "{{line}}.{{n}}",
    legendTitle: "SOUND SYSTEM - LEGEND & MOUNTING",
    legendNotesTitle: "MOUNTING NOTES",
    legendLinesTitle: "LINES / AMPLIFIER CHANNELS",
    revisionHeaders: ["Rev", "Date", "Change", "By", "Chk"],
    fieldLabels: ["Project", "Client", "Scale", "Sheet", "Date", "Drawn by"],
    drawingSubtitle: "Loudspeaker layout",
  },
};

/** The German headings follow the FACE Beschallungsplan, which is what these plans are
 *  issued as here. */
const PRESETS_DE: Record<FloorplanKind, FloorplanKindPreset> = {
  generic: {
    labelTemplate: "{{n}}",
    legendTitle: "LEGENDE & MONTAGE",
    legendNotesTitle: "MONTAGEHINWEISE",
    legendLinesTitle: "LINIEN / ENDSTUFENKANÄLE",
    revisionHeaders: ["INDEX", "DATUM", "ÄNDERUNGEN", "BEARB.", "GEPR."],
    fieldLabels: ["Bauvorhaben", "Bauherr", "Maßstab", "Blattgröße", "Datum", "Planersteller:in"],
    drawingSubtitle: "{{drawingTitle}}",
  },
  wifi: {
    labelTemplate: "AP{{n}}",
    legendTitle: "WLAN-AUSLEUCHTUNG - LEGENDE & MONTAGE",
    legendNotesTitle: "MONTAGEHINWEISE",
    legendLinesTitle: "LINIEN",
    revisionHeaders: ["INDEX", "DATUM", "ÄNDERUNGEN", "BEARB.", "GEPR."],
    fieldLabels: ["Bauvorhaben", "Bauherr", "Maßstab", "Blattgröße", "Datum", "Planersteller:in"],
    drawingSubtitle: "WLAN-Ausleuchtung",
  },
  loudspeaker: {
    labelTemplate: "{{line}}.{{n}}",
    legendTitle: "BESCHALLUNG - LEGENDE & MONTAGE",
    legendNotesTitle: "MONTAGEHINWEISE",
    legendLinesTitle: "LINIEN / ENDSTUFENKANÄLE",
    revisionHeaders: ["INDEX", "DATUM", "ÄNDERUNGEN", "BEARB.", "GEPR."],
    fieldLabels: ["Bauvorhaben", "Bauherr", "Maßstab", "Blattgröße", "Datum", "Planersteller:in"],
    drawingSubtitle: "Lautsprecherplanung",
  },
};

/** The English table stays exported under its old name — it is the base every language is
 *  measured against, and what a plan falls back to. */
export const FLOORPLAN_KIND_PRESETS: Record<FloorplanKind, FloorplanKindPreset> = PRESETS_EN;

/** The preset for a plan kind in the given language (the interface language by default). */
export function floorplanKindPreset(kind: FloorplanKind | undefined, locale: Locale = getLocale()): FloorplanKindPreset {
  const table = locale === "de" ? PRESETS_DE : PRESETS_EN;
  return table[kind ?? "generic"];
}

/** Every heading this app has ever written into a legend by itself, in every language.
 *  A stored heading that is one of these was never typed by a person, so it may follow the
 *  interface language instead of being frozen in the one it was created in. */
const OWN_LEGEND_HEADINGS: ReadonlySet<string> = new Set(
  [PRESETS_EN, PRESETS_DE].flatMap((table) =>
    Object.values(table).flatMap((p) => [p.legendTitle, p.legendNotesTitle, p.legendLinesTitle]),
  ),
);

/** True when this heading is one of ours rather than something a person typed. */
export function isOwnLegendHeading(text: string | undefined): boolean {
  return text !== undefined && OWN_LEGEND_HEADINGS.has(text.trim());
}

/** The legend's headline: what the user typed, else the plan kind's default in the
 *  interface language. */
export function legendTitleOf(page: Pick<FloorplanPage, "kind" | "legend">, locale?: Locale): string {
  const stored = page.legend.title?.trim();
  if (stored && !isOwnLegendHeading(stored)) return stored;
  return floorplanKindPreset(page.kind, locale).legendTitle;
}

/** The heading over the legend's installation notes, same rule. */
export function legendNotesTitleOf(page: Pick<FloorplanPage, "kind" | "legend">, locale?: Locale): string {
  const stored = page.legend.notesTitle?.trim();
  if (stored && !isOwnLegendHeading(stored)) return stored;
  return floorplanKindPreset(page.kind, locale).legendNotesTitle;
}

/** The heading over the legend's line table, same rule. */
export function legendLinesTitleOf(page: Pick<FloorplanPage, "kind" | "legend">, locale?: Locale): string {
  const stored = page.legend.linesTitle?.trim();
  if (stored && !isOwnLegendHeading(stored)) return stored;
  return floorplanKindPreset(page.kind, locale).legendLinesTitle;
}

/** The label template a page numbers with, falling back to its kind's preset. */
export function effectiveLabelTemplate(page: Pick<FloorplanPage, "kind" | "labelTemplate">): string {
  return page.labelTemplate?.trim() || FLOORPLAN_KIND_PRESETS[page.kind ?? "generic"].labelTemplate;
}

export interface SymbolLabelFields {
  line?: string;
  n?: number;
  group?: string;
  device?: string;
}

/** Compose a symbol label: "{{line}}.{{n}}" with line "4", n 2 → "4.2". A missing line
 *  drops its separator too ("{{line}}.{{n}}" without a line → "2"), so generic symbols on
 *  a loudspeaker plan still read cleanly. */
export function formatSymbolLabel(template: string, f: SymbolLabelFields): string {
  let out = template;
  if (!f.line?.trim()) out = out.replace(/\{\{\s*line\s*\}\}\s*[.\-/_: ]?/g, "");
  return out
    .replace(/\{\{\s*line\s*\}\}/g, f.line?.trim() ?? "")
    .replace(/\{\{\s*n\s*\}\}/g, f.n !== undefined ? String(f.n) : "")
    .replace(/\{\{\s*group\s*\}\}/g, f.group ?? "")
    .replace(/\{\{\s*device\s*\}\}/g, f.device ?? "")
    .trim();
}

/** Next speaker number on a line: one past the highest already used (gaps stay gaps). */
export function nextSeqInLine(symbols: Pick<FloorplanSymbol, "lineNo" | "seq">[], lineNo: string | undefined): number {
  const key = (lineNo ?? "").trim();
  let max = 0;
  for (const s of symbols) {
    if ((s.lineNo ?? "").trim() === key && typeof s.seq === "number" && s.seq > max) max = s.seq;
  }
  return max + 1;
}

/** Renumber one line's speakers 1…n in placement order and rebuild their labels. */
export function renumberLine(symbols: FloorplanSymbol[], lineNo: string, template: string, groupLabel: (groupId: string) => string | undefined): FloorplanSymbol[] {
  const key = lineNo.trim();
  let n = 0;
  return symbols.map((s) => {
    if ((s.lineNo ?? "").trim() !== key) return s;
    n += 1;
    return { ...s, seq: n, label: formatSymbolLabel(template, { line: key, n, group: groupLabel(s.groupId) }) };
  });
}

/** Distinct lines on a page, in first-appearance order, with their speaker counts. */
export function linesOnPage(symbols: Pick<FloorplanSymbol, "lineNo">[]): { lineNo: string; count: number }[] {
  const out: { lineNo: string; count: number }[] = [];
  for (const s of symbols) {
    const key = (s.lineNo ?? "").trim();
    if (!key) continue;
    const hit = out.find((l) => l.lineNo === key);
    if (hit) hit.count += 1; else out.push({ lineNo: key, count: 1 });
  }
  return out;
}

// ── Label placement presets ──────────────────────────────────────────

export type LabelPosition = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export const LABEL_POSITIONS: LabelPosition[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

/** Offset and alignment that put a label just outside the symbol on the given side. */
export function labelPlacementFor(
  pos: LabelPosition,
  symbolSizeMm: number,
  labelSizeMm: number,
): { labelOffsetMm: Vec2; labelAlign: "start" | "middle" | "end" } {
  const gap = 1.5;
  const r = symbolSizeMm / 2 + gap;
  const dy = r + labelSizeMm * 0.6;
  const map: Record<LabelPosition, { x: number; y: number; align: "start" | "middle" | "end" }> = {
    e: { x: r, y: 0, align: "start" },
    w: { x: -r, y: 0, align: "end" },
    n: { x: 0, y: -dy, align: "middle" },
    s: { x: 0, y: dy, align: "middle" },
    ne: { x: r * 0.75, y: -dy * 0.8, align: "start" },
    se: { x: r * 0.75, y: dy * 0.8, align: "start" },
    nw: { x: -r * 0.75, y: -dy * 0.8, align: "end" },
    sw: { x: -r * 0.75, y: dy * 0.8, align: "end" },
  };
  const m = map[pos];
  return { labelOffsetMm: { x: m.x, y: m.y }, labelAlign: m.align };
}
