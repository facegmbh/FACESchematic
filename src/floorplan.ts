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

import { getPaperSize, PAGE_MARGIN_IN } from "./printConfig";
import type {
  FloorplanLegendBox,
  FloorplanPage,
  FloorplanSymbol,
  FloorplanSymbolGroup,
  FloorplanUnderlay,
} from "./types";

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

/** Real-world mm per underlay source pixel for an already-placed underlay. */
export function underlayMmPerPx(underlay: FloorplanUnderlay, scaleDenominator: number): number | undefined {
  if (underlay.naturalWidthPx <= 0 || underlay.sizeMm.w <= 0) return undefined;
  return paperMmToRealMm(underlay.sizeMm.w / underlay.naturalWidthPx, scaleDenominator);
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
  imageCaption?: string;
  /** How many symbols of this group sit on the plan. */
  count: number;
}

/** Legend rows for a page: one per symbol group, in group order. Honors the box's
 *  "only groups in use" setting and per-group hiding. */
export function buildLegendRows(page: Pick<FloorplanPage, "groups" | "symbols" | "legend">): LegendRow[] {
  const counts = new Map<string, number>();
  for (const s of page.symbols) counts.set(s.groupId, (counts.get(s.groupId) ?? 0) + 1);

  return page.groups
    .filter((g) => !g.hiddenInLegend)
    .filter((g) => !page.legend.onlyUsedGroups || (counts.get(g.id) ?? 0) > 0)
    .map((g) => ({
      groupId: g.id,
      label: g.label,
      color: g.color,
      shape: g.shape,
      description: g.description,
      imageSrc: g.imageSrc,
      imageCaption: g.imageCaption,
      count: counts.get(g.id) ?? 0,
    }));
}

/** Legend box height in mm for the given rows — the renderer and the PDF export share
 *  this so the on-screen box and the printed one agree. */
export function legendHeightMm(rows: LegendRow[], legend: FloorplanLegendBox): number {
  const notes = (legend.notes ?? []).filter((n) => n.trim().length > 0);
  const rowH = legend.showImages ? LEGEND_ROW_WITH_IMAGE_MM : LEGEND_ROW_MM;
  let h = LEGEND_TITLE_MM + rows.length * rowH + LEGEND_PAD_MM * 2;
  if (notes.length > 0) h += LEGEND_NOTES_GAP_MM + LEGEND_NOTES_TITLE_MM + notes.length * LEGEND_NOTE_LINE_MM;
  return h;
}

export const LEGEND_PAD_MM = 4;
export const LEGEND_TITLE_MM = 9;
export const LEGEND_ROW_MM = 10;
export const LEGEND_ROW_WITH_IMAGE_MM = 14;
export const LEGEND_NOTES_GAP_MM = 3;
export const LEGEND_NOTES_TITLE_MM = 6;
export const LEGEND_NOTE_LINE_MM = 4.2;

/** Default legend box, parked in the sheet's top-right corner. */
export function createDefaultLegend(page: Pick<FloorplanPage, "paperId" | "orientation" | "customWidthIn" | "customHeightIn">): FloorplanLegendBox {
  const area = drawingAreaMm(page);
  const widthMm = Math.min(140, area.w * 0.38);
  return {
    visible: true,
    title: "LEGEND",
    positionMm: { x: area.x + area.w - widthMm - 4, y: area.y + 4 },
    widthMm,
    showImages: true,
    onlyUsedGroups: true,
    notesTitle: "INSTALLATION NOTES",
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
