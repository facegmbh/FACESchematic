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
import type { FloorplanSymbolShape,
  CompanyProfile,
  CoverageOptics,
  CoverageShape,
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
  TitleBlock,
} from "./types";
import { DEFAULT_FLOORPLAN_SCALE, DEFAULT_FLOORPLAN_SYMBOL_SIZE_MM, DORI_PX_PER_M, WALL_AP_APERTURE_DEG } from "./types";

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
  imageUrl?: string;
  imageCaption?: string;
  glyph?: string;
  /** The group's uploaded symbol picture, so the legend shows what the plan shows. */
  symbolImageSrc?: string;
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
      count: counts.get(g.id) ?? 0,
    }));
}

/** Legend box height in mm for the given rows — the renderer and the PDF export share
 *  this so the on-screen box and the printed one agree. */
export function legendHeightMm(rows: LegendRow[], legend: FloorplanLegendBox, company?: CompanyProfile | null, lineRowCount = 0): number {
  const notes = (legend.notes ?? []).filter((n) => n.trim().length > 0);
  const rowH = legend.showImages ? LEGEND_ROW_WITH_IMAGE_MM : LEGEND_ROW_MM;
  let h = LEGEND_TITLE_MM + rows.length * rowH + LEGEND_PAD_MM * 2;
  if (lineRowCount > 0) h += LEGEND_LINES_GAP_MM + LEGEND_LINES_TITLE_MM + LEGEND_LINE_ROW_MM * (lineRowCount + 1);
  if (notes.length > 0) h += LEGEND_NOTES_GAP_MM + LEGEND_NOTES_TITLE_MM + notes.length * LEGEND_NOTE_LINE_MM;
  if (legend.showCompany !== false && hasCompanyProfile(company)) h += legendCompanyHeightMm(company);
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
    // Groups are created on purpose — list them even before the first symbol lands, so
    // the legend reads as the plan's key from the first minute.
    onlyUsedGroups: false,
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
  const fields: FloorplanDrawingField[] = [
    { id: nextDrawingFieldId(), label: "Project", value: "{{showName}}", wide: true },
    { id: nextDrawingFieldId(), label: "Client", value: "{{venue}}", wide: true },
    { id: nextDrawingFieldId(), label: "Scale", value: "{{scale}}" },
    { id: nextDrawingFieldId(), label: "Sheet", value: "{{sheetSize}}" },
    { id: nextDrawingFieldId(), label: "Date", value: "{{date}}" },
    { id: nextDrawingFieldId(), label: "Drawn by", value: "{{designer}}" },
  ];
  const block: FloorplanDrawingBlock = {
    visible: true,
    positionMm: { x: 0, y: 0 },
    widthMm,
    title: "{{pageLabel}}",
    subtitle: "{{drawingTitle}}",
    fields,
    revisions: [],
    revisionHeaders: ["Rev", "Date", "Change", "By", "Chk"],
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
  coverage: Pick<FloorplanCoverage, "shape" | "rangeM" | "apertureDeg" | "widthM" | "optics">,
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
  coverage: Pick<FloorplanCoverage, "shape" | "rangeM" | "apertureDeg" | "widthM" | "optics">,
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
  opts?: { rangeM?: number; mount?: "ceiling" | "wall" },
): Omit<FloorplanCoverage, "id"> {
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
  const out = rotateVec(coverage.shape === "circle" ? { x: 0, y: r } : { x: r, y: 0 }, turn);
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
    widthM: shape === "rect" ? DEFAULT_COVERAGE_WIDTH_M : undefined,
    opacity: DEFAULT_COVERAGE_OPACITY,
  };
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
export function planSymbolFor(src: { planSymbol?: PlanSymbolSpec; deviceType?: string; templateId?: string; id?: string; modelNumber?: string; label?: string }): Required<Pick<PlanSymbolSpec, "shape" | "color">> & Pick<PlanSymbolSpec, "glyph" | "imageSrc" | "outlineColor" | "outlineWidthMm"> {
  const seed = src.templateId ?? src.id ?? src.modelNumber ?? src.label ?? "";
  return {
    shape: src.planSymbol?.shape ?? defaultSymbolShapeFor(src.deviceType),
    color: src.planSymbol?.color ?? defaultSymbolColorFor(seed),
    glyph: src.planSymbol?.glyph?.trim().slice(0, 2) || undefined,
    imageSrc: src.planSymbol?.imageSrc || undefined,
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

export const FLOORPLAN_KIND_PRESETS: Record<FloorplanKind, FloorplanKindPreset> = {
  generic: {
    labelTemplate: "{{n}}",
    legendTitle: "LEGEND",
    legendNotesTitle: "INSTALLATION NOTES",
    legendLinesTitle: "LINES / AMPLIFIER CHANNELS",
    revisionHeaders: ["Rev", "Date", "Change", "By", "Chk"],
    fieldLabels: ["Project", "Client", "Scale", "Sheet", "Date", "Drawn by"],
    drawingSubtitle: "{{drawingTitle}}",
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
