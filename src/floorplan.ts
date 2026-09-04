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
import type {
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
import { DEFAULT_FLOORPLAN_SCALE } from "./types";

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
  /** How many symbols of this group sit on the plan. */
  count: number;
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
