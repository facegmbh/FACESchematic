/**
 * Floorplan PDF export.
 *
 * Draws each floorplan page at true paper size, so a plan printed at 100 % is a scaled
 * drawing a fitter can measure off: the sheet is the paper, positions are the same paper
 * mm the editor stores, and the underlay lands at exactly the size calibration solved for.
 */

import { jsPDF } from "jspdf";
import type { CompanyProfile, ConnectionEdge, DeviceData, DeviceTemplate, FloorplanNote, FloorplanPage, FloorplanSymbolGroup, SchematicNode, SchematicPage, TitleBlock, WallMaterial, WallMaterialSpec } from "./types";
import { DEFAULT_HEATMAP, WALL_MATERIAL_COLORS } from "./types";
import { collectAccessPoints, computeHeatmap, rssiColor } from "./wifiCoverage";
import { getTemplateById } from "./templateApi";
import { buildLegendLineRows, computeLineLoads, legendShowsLines, type LegendLineRow, type LoadSpecLookup } from "./speakerLines";
import { t } from "./i18n";
import { getPaperSize } from "./printConfig";
import { loadInterFont } from "./rackPdf";
import { drawTitleBlockMm } from "./printSheetPdf";
import { fetchImageAsDataUrl, isVectorUnderlay, rasterizeLibrarySymbol, rasterizeVectorForPrint, rotatedImageDataUrl } from "./floorplanUnderlay";
import { symbolLibraryUrl } from "./symbolLibrary";
import { tintSymbol } from "./symbolTint";
import {
  coverageLabelOf,
  buildLegendRows,
  realMmToPaperMm,
  drawingAreaMm,
  coverageColor,
  coverageLabelAnchorMm,
  coveragePointsOnSheet,
  isCoverageVisible,
  DEFAULT_COVERAGE_OPACITY,
  layoutDrawingBlock,
  layoutNote,
  legendHeightMm,
  legendShowsCompany,
  legendRowImage,
  companyProfileLines,
  hasCompanyProfile,
  LEGEND_COMPANY_GAP_MM,
  LEGEND_COMPANY_LINE_MM,
  LEGEND_COMPANY_LOGO_MM,
  symbolLabelAnchor,
  SYMBOL_INK,
  isGroupVisible,
  symbolOutlineColor,
  symbolOutlineWidth,
  rotateVec,
  rotatedSquareFactor,
  symbolGlyphOffset,
  symbolGlyphScale,
  symbolPrimitives,
  glyphColorOn,
  DB_DISCLAIMER_FONT_MM,
  DB_FIELD_LABEL_FONT_MM,
  DB_FIELD_VALUE_FONT_MM,
  DB_PAD_MM,
  DB_REV_COLS,
  DB_REV_FONT_MM,
  DB_REV_ROW_MM,
  DB_SUBTITLE_FONT_MM,
  DB_TITLE_FONT_MM,
  IN_TO_MM,
  LEGEND_NOTES_GAP_MM,
  LEGEND_NOTES_TITLE_MM,
  LEGEND_NOTE_LINE_MM,
  LEGEND_LINES_GAP_MM,
  LEGEND_LINES_TITLE_MM,
  LEGEND_RSSI_GAP_MM,
  LEGEND_RSSI_TITLE_MM,
  LEGEND_RSSI_ROW_MM,
  LEGEND_RSSI_SWATCH_SHARE,
  legendColorKeys,
  coveragesHidden,
  symbolFootprintMm,
  symbolFootprintOutlineMm,
  legendKeyRows,
  LEGEND_LINE_ROW_MM,
  LEGEND_LINE_COLS,
  legendLinesTitleOf,
  legendNotesTitleOf,
  legendTitleOf,
  LEGEND_PAD_MM,
  LEGEND_ROW_MM,
  LEGEND_ROW_WITH_IMAGE_MM,
  LEGEND_TITLE_MM,
  PAGE_MARGIN_MM,
  type LegendRow,
} from "./floorplan";
import { VIEWING_HEATMAP_OPACITY, VIEWING_HINT_COLOR, VIEWING_OK_COLOR, viewingHeatmap, viewingOnSheet, viewingRasterPng } from "./projectionViewing";
import { displayBarMm, displayOnSymbol } from "./projection";
import { PROJECTION_IN_PICTURE_COLOR, PROJECTION_OK_COLOR, PROJECTION_WARN_COLOR, inPictureLabel, projectionCaption, projectionCaptionAnchorMm, sectionBoxMm, visibleProjections, type SectionRole } from "./projection";

const MM_TO_PT = 72 / IN_TO_MM;
/** Where the red rule under the legend title sits inside the title row. */
const LEGEND_TITLE_RULE_MM = LEGEND_TITLE_MM - 3;

export interface FloorplanPdfOptions {
  pages: SchematicPage[];
  nodes: SchematicNode[];
  /** Custom templates, so an access point's radio spec can be resolved for the heatmap. */
  customTemplates?: DeviceTemplate[];
  /** Measured wall attenuation overriding the calibrated defaults (store.wallMaterials). */
  wallMaterials?: Partial<Record<WallMaterial, WallMaterialSpec>>;
  /** Connections — needed for the legend's line table (amplifier channel per line). */
  edges?: ConnectionEdge[];
  /** Where speaker / amplifier load specs come from (store.loadSpecLookup). */
  loadSpecLookup?: LoadSpecLookup;
  schematicName: string;
  titleBlock?: TitleBlock;
  companyProfile?: CompanyProfile;
}

const EMPTY_TITLE_BLOCK: TitleBlock = {
  showName: "", venue: "", designer: "", engineer: "", date: "", drawingTitle: "", company: "", revision: "", logo: "", customFields: [],
};

/** #rrggbb → [r, g, b]; falls back to black for anything unparseable. */
/** Fill/stroke alpha. jsPDF exposes it only through a graphics state, and older builds
 *  have neither setGState nor GState — there a faded shape prints opaque rather than not
 *  at all, which is the safer of the two failures on a plan. */
/** The heatmap grid as a PNG data URL, one pixel per sample. Returns undefined where
 *  there is no canvas (a non-browser export), and the plan then prints without it. */
function heatmapPng(grid: { cols: number; rows: number; dbm: Float32Array }): string | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const img = ctx.createImageData(grid.cols, grid.rows);
  for (let i = 0; i < grid.dbm.length; i++) {
    const dbm = grid.dbm[i];
    const o = i * 4;
    if (!Number.isFinite(dbm)) continue; // transparent: no access point reaches here
    const [r, g, b] = hexToRgb(rssiColor(dbm));
    img.data[o] = r;
    img.data[o + 1] = g;
    img.data[o + 2] = b;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

function setPdfAlpha(doc: jsPDF, alpha: number): void {
  const gs = (doc as unknown as { setGState?: (s: unknown) => void; GState?: (o: unknown) => unknown });
  if (gs.setGState && gs.GState) gs.setGState(gs.GState({ opacity: alpha }));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

/** Draw one symbol at (cx, cy) in mm, with the group's glyph inside when it has one.
 *  Walks the same primitives as the screen renderer (symbolPrimitives), so a pictogram on
 *  paper is the pictogram on screen. */
function drawSymbol(
  doc: jsPDF,
  group: Pick<FloorplanSymbolGroup, "shape" | "color" | "glyph" | "symbolImageSrc" | "symbolLibraryId" | "outlineColor" | "outlineWidthMm">,
  cx: number,
  cy: number,
  sizeMm: number,
  rotationDeg = 0,
  /** The picture to draw instead of the shape — the group's upload, or a BHE symbol
   *  rasterized for print. `turned` says it already carries rotationDeg: jsPDF cannot
   *  rotate a raster the way an SVG transform does, so the caller does it beforehand. */
  picture?: { src: string; turned: boolean },
) {
  const [r, g, b] = hexToRgb(group.color);
  const [cr, cg, cb] = hexToRgb(glyphColorOn(group.color));
  const [ir, ig, ib] = hexToRgb(SYMBOL_INK);
  const [or_, og, ob] = hexToRgb(symbolOutlineColor(group));
  const outlineMm = symbolOutlineWidth(group, sizeMm, sizeMm);
  const turn = (v: { x: number; y: number }) => rotateVec(v, rotationDeg);

  // A picture is the symbol: it replaces shape, color and glyph. A turned raster grew by
  // rotatedSquareFactor, so it is placed that much larger to keep its scale.
  const src = picture?.src ?? group.symbolImageSrc;
  if (src) {
    const side = sizeMm * (picture?.turned ? rotatedSquareFactor(rotationDeg) : 1);
    try {
      doc.addImage(src, imageFormat(src), cx - side / 2, cy - side / 2, side, side, undefined, "MEDIUM");
    } catch {
      doc.setDrawColor(cr, cg, cb);
      doc.setLineWidth(0.2);
      doc.rect(cx - sizeMm / 2, cy - sizeMm / 2, sizeMm, sizeMm, "S");
    }
    return;
  }

  for (const prim of symbolPrimitives(group.shape, sizeMm)) {
    if (prim.kind === "line") {
      const from = turn(prim.from), to = turn(prim.to);
      doc.setDrawColor(ir, ig, ib);
      doc.setLineWidth(Math.max(0.15, sizeMm * 0.07));
      doc.line(cx + from.x, cy + from.y, cx + to.x, cy + to.y);
      continue;
    }
    // Filled body: group color under a dark outline. Contrast detail: glyph color, no
    // outline. Outline-only: the contrast color as a stroke.
    let style: "F" | "S" | "FD";
    if (prim.fill === "color") {
      doc.setFillColor(r, g, b);
      if (outlineMm > 0) {
        doc.setDrawColor(or_, og, ob);
        doc.setLineWidth(outlineMm);
      }
      style = outlineMm > 0 ? "FD" : "F";
    } else if (prim.fill === "contrast") {
      doc.setFillColor(cr, cg, cb);
      doc.setDrawColor(ir, ig, ib);
      doc.setLineWidth(Math.max(0.1, sizeMm * 0.05));
      style = "FD";
    } else {
      doc.setDrawColor(ir, ig, ib);
      doc.setLineWidth(Math.max(0.1, sizeMm * 0.05));
      style = "S";
    }
    if (prim.kind === "circle") {
      const c = turn(prim.center);
      doc.circle(cx + c.x, cy + c.y, prim.r, style);
    } else if (prim.points.length > 0) {
      // jsPDF wants relative segments from the starting point.
      const pts = prim.points.map(turn);
      const deltas: [number, number][] = [];
      for (let i = 1; i < pts.length; i++) {
        deltas.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
      }
      doc.lines(deltas, cx + pts[0].x, cy + pts[0].y, [1, 1], style, true);
    }
  }
  const glyph = group.glyph?.trim().slice(0, 2);
  if (glyph) {
    const at = turn(symbolGlyphOffset(group.shape, sizeMm));
    doc.setFont("Inter", "bold");
    doc.setFontSize(sizeMm * symbolGlyphScale(group.shape, glyph) * MM_TO_PT);
    doc.setTextColor(cr, cg, cb);
    doc.text(glyph, cx + at.x, cy + at.y, { align: "center", baseline: "middle" });
  }
}

/** Which picture a symbol prints with, and whether it is already turned: the turned raster
 *  when there is one, else the flat picture drawn square to the sheet. */
function pictureForSymbol(
  group: FloorplanSymbolGroup,
  rotationDeg: number,
  base: string | undefined,
  turned: Map<string, string>,
): { src: string; turned: boolean } | undefined {
  if (!base) return undefined;
  const rot = (((rotationDeg % 360) + 360) % 360);
  const spun = rot ? turned.get(`${group.id}|${rot}`) : undefined;
  return spun ? { src: spun, turned: true } : { src: base, turned: false };
}

/** Legend box: one row per symbol group, then the free-text installation notes. */
function drawLegend(doc: jsPDF, page: FloorplanPage, rows: LegendRow[], notes: string[], images: Map<string, string>, company: CompanyProfile | undefined, lineRows: LegendLineRow[] = [], librarySymbols: Map<string, string> = new Map()) {
  const colorKeys = legendColorKeys(page);
  const { positionMm: pos, widthMm } = page.legend;
  const heightMm = legendHeightMm(rows, page.legend, company, lineRows.length, colorKeys.map(legendKeyRows));

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(68, 68, 68);
  doc.setLineWidth(0.25);
  doc.rect(pos.x, pos.y, widthMm, heightMm, "FD");

  const innerX = pos.x + LEGEND_PAD_MM;
  const innerW = widthMm - 2 * LEGEND_PAD_MM;
  let y = pos.y + LEGEND_PAD_MM;

  // Title with the red rule the reference plans use.
  doc.setFont("Inter", "bold");
  doc.setFontSize(4.5 * MM_TO_PT);
  doc.setTextColor(17, 17, 17);
  doc.text(legendTitleOf(page), innerX, y + 3.4, { baseline: "alphabetic", maxWidth: innerW });
  doc.setDrawColor(200, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(innerX, y + LEGEND_TITLE_RULE_MM, innerX + innerW, y + LEGEND_TITLE_RULE_MM);
  y += LEGEND_TITLE_MM;

  const rowH = page.legend.showImages ? LEGEND_ROW_WITH_IMAGE_MM : LEGEND_ROW_MM;
  for (const row of rows) {
    const centerY = y + rowH / 2;
    const rowSymbol = librarySymbols.get(row.groupId);
    drawSymbol(doc, row, innerX + page.symbolSizeMm / 2, centerY, page.symbolSizeMm, 0,
      rowSymbol ? { src: rowSymbol, turned: false } : undefined);

    const textX = innerX + page.symbolSizeMm + 2;
    const rowImage = images.get(row.groupId);
    const imageW = page.legend.showImages && rowImage ? 22 : 0;
    const textW = Math.max(10, innerW - (textX - innerX) - imageW - 2);

    doc.setFont("Inter", "bold");
    doc.setFontSize(3.2 * MM_TO_PT);
    doc.setTextColor(17, 17, 17);
    doc.text(row.label, textX, centerY - (row.description ? 0.6 : -1), { baseline: "middle", maxWidth: textW });

    if (row.description) {
      doc.setFont("Inter", "normal");
      doc.setFontSize(2.6 * MM_TO_PT);
      doc.setTextColor(51, 51, 51);
      doc.text(row.description, textX, centerY + 2.8, { baseline: "middle", maxWidth: textW });
    }

    if (page.legend.showImages && rowImage) {
      const imgH = rowH - 3;
      const imgX = innerX + innerW - imageW;
      try {
        doc.addImage(rowImage, imageFormat(rowImage), imgX, y + 1.5, imageW - 6, imgH, undefined, "FAST");
      } catch {
        // A legend image that jsPDF can't decode must not take the whole export down.
      }
      if (row.imageCaption) {
        doc.setFont("Inter", "bold");
        doc.setFontSize(2.4 * MM_TO_PT);
        doc.setTextColor(17, 17, 17);
        doc.text(row.imageCaption, innerX + innerW, centerY, { baseline: "middle", align: "right" });
      }
    }
    y += rowH;
  }

  // Line table: line → amplifier channel, speaker count, load.
  if (lineRows.length > 0) {
    y += LEGEND_LINES_GAP_MM;
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.15);
    doc.line(innerX, y, innerX + innerW, y);
    doc.setFont("Inter", "bold");
    doc.setFontSize(3 * MM_TO_PT);
    doc.setTextColor(17, 17, 17);
    doc.text(legendLinesTitleOf(page), innerX, y + 3.6, { maxWidth: innerW });
    y += LEGEND_LINES_TITLE_MM;
    const colX = [0, 1, 2, 3].map((i) => innerX + LEGEND_LINE_COLS.slice(0, i).reduce((a, c) => a + c, 0) * innerW);
    const colW = LEGEND_LINE_COLS.map((c) => c * innerW);
    const cell = (text: string, col: number, rowY: number, bold: boolean, align: "left" | "right" = "left") => {
      doc.setFont("Inter", bold ? "bold" : "normal");
      doc.setFontSize(2.4 * MM_TO_PT);
      doc.setTextColor(34, 34, 34);
      const x = align === "right" ? colX[col] + colW[col] - 1 : colX[col];
      doc.text(text, x, rowY + LEGEND_LINE_ROW_MM * 0.72, { maxWidth: colW[col] - 1, align });
    };
    cell(t("Line"), 0, y, true); cell(t("Amplifier · channel"), 1, y, true); cell(t("Qty"), 2, y, true, "right"); cell(t("Load"), 3, y, true);
    y += LEGEND_LINE_ROW_MM;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(innerX, y - 0.6, innerX + innerW, y - 0.6);
    for (const r of lineRows) {
      cell(r.lineNo, 0, y, true);
      cell(r.name ? `${r.feed} — ${r.name}` : r.feed, 1, y, false);
      cell(String(r.count), 2, y, false, "right");
      cell(r.load, 3, y, false);
      y += LEGEND_LINE_ROW_MM;
    }
  }

  // Colour keys — the same swatches the heatmaps are painted with, so the print
  // explains itself.
  for (const colorKey of colorKeys) {
    y += LEGEND_RSSI_GAP_MM;
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.15);
    doc.line(innerX, y, innerX + innerW, y);
    doc.setFont("Inter", "bold");
    doc.setFontSize(3 * MM_TO_PT);
    doc.setTextColor(17, 17, 17);
    doc.text(colorKey.title, innerX, y + 3.6, { maxWidth: innerW });
    y += LEGEND_RSSI_TITLE_MM;
    if (colorKey.gradient) {
      // A continuous scale: one bar of colours, its captions on the row below.
      const { colors, labels } = colorKey.gradient;
      const cell = innerW / colors.length;
      colors.forEach((c, i) => {
        const [r, g, b] = hexToRgb(c);
        doc.setFillColor(r, g, b);
        // A hair of overlap, so no white shows between neighbouring cells.
        doc.rect(innerX + i * cell, y + 0.6, cell + (i < colors.length - 1 ? 0.05 : 0), LEGEND_RSSI_ROW_MM - 1.2, "F");
      });
      y += LEGEND_RSSI_ROW_MM;
      doc.setFont("Inter", "normal");
      doc.setFontSize(2.4 * MM_TO_PT);
      doc.setTextColor(34, 34, 34);
      for (const l of labels) {
        doc.text(l.text, innerX + l.at * innerW, y + LEGEND_RSSI_ROW_MM * 0.72, { align: l.at <= 0 ? "left" : l.at >= 1 ? "right" : "center" });
      }
      y += LEGEND_RSSI_ROW_MM;
    }
    if (colorKey.scales) {
      // One rating scale per picture: caption, then the bands with a mark on them.
      const { bars, ends } = colorKey.scales;
      doc.setFontSize(2.4 * MM_TO_PT);
      for (const bar of bars) {
        doc.setFont("Inter", "normal");
        doc.setTextColor(34, 34, 34);
        doc.text(bar.caption, innerX, y + LEGEND_RSSI_ROW_MM * 0.72, { maxWidth: innerW });
        y += LEGEND_RSSI_ROW_MM;
        const cell = innerW / bar.colors.length;
        bar.colors.forEach((c, i) => {
          const [r, g, b] = hexToRgb(c);
          doc.setFillColor(r, g, b);
          doc.rect(innerX + i * cell, y + 0.9, cell + (i < bar.colors.length - 1 ? 0.05 : 0), LEGEND_RSSI_ROW_MM - 1.8, "F");
        });
        // The mark: a black bar with a white edge, readable on every band.
        const mx = innerX + Math.min(1, Math.max(0, bar.markerAt)) * innerW;
        doc.setFillColor(255, 255, 255);
        doc.rect(mx - 0.55, y + 0.2, 1.1, LEGEND_RSSI_ROW_MM - 0.4, "F");
        doc.setFillColor(17, 17, 17);
        doc.rect(mx - 0.3, y + 0.2, 0.6, LEGEND_RSSI_ROW_MM - 0.4, "F");
        y += LEGEND_RSSI_ROW_MM;
      }
      doc.setFont("Inter", "normal");
      doc.setTextColor(34, 34, 34);
      doc.text(ends[0], innerX, y + LEGEND_RSSI_ROW_MM * 0.72);
      doc.text(ends[1], innerX + innerW, y + LEGEND_RSSI_ROW_MM * 0.72, { align: "right" });
      y += LEGEND_RSSI_ROW_MM;
    }
    const swatchW = innerW * LEGEND_RSSI_SWATCH_SHARE;
    for (const step of colorKey.steps) {
      const [r, g, b] = hexToRgb(step.color);
      doc.setFillColor(r, g, b);
      doc.rect(innerX, y + 0.6, swatchW, LEGEND_RSSI_ROW_MM - 1.2, "F");
      doc.setFont("Inter", "normal");
      doc.setFontSize(2.4 * MM_TO_PT);
      doc.setTextColor(34, 34, 34);
      doc.text(step.label, innerX + swatchW + 2, y + LEGEND_RSSI_ROW_MM * 0.72, { maxWidth: innerW - swatchW - 2 });
      y += LEGEND_RSSI_ROW_MM;
    }
  }

  if (notes.length > 0) {
    y += LEGEND_NOTES_GAP_MM;
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.15);
    doc.line(innerX, y, innerX + innerW, y);
    doc.setFont("Inter", "bold");
    doc.setFontSize(3 * MM_TO_PT);
    doc.setTextColor(17, 17, 17);
    doc.text(legendNotesTitleOf(page), innerX, y + 3.6, { maxWidth: innerW });
    y += LEGEND_NOTES_TITLE_MM;

    doc.setFont("Inter", "normal");
    doc.setFontSize(2.6 * MM_TO_PT);
    doc.setTextColor(34, 34, 34);
    for (const note of notes) {
      doc.text(note, innerX, y + LEGEND_NOTE_LINE_MM * 0.75, { maxWidth: innerW });
      y += LEGEND_NOTE_LINE_MM;
    }
  }

  // Company block: logo left, name/address/contact right.
  if (legendShowsCompany(page.legend) && hasCompanyProfile(company)) {
    y += LEGEND_COMPANY_GAP_MM;
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.15);
    doc.line(innerX, y, innerX + innerW, y);
    y += 1;
    let textX = innerX;
    if (company.logo) {
      try {
        const img = new Image();
        img.src = company.logo;
        const aspect = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 2.5;
        const logoW = Math.min(LEGEND_COMPANY_LOGO_MM * aspect, 40);
        doc.addImage(company.logo, imageFormat(company.logo), innerX, y, logoW, LEGEND_COMPANY_LOGO_MM, undefined, "FAST");
        textX = innerX + logoW + 3;
      } catch {
        // No logo is better than no plan.
      }
    }
    companyProfileLines(company).forEach((line, i) => {
      doc.setFont("Inter", i === 0 ? "bold" : "normal");
      doc.setFontSize((i === 0 ? 2.8 : 2.4) * MM_TO_PT);
      doc.setTextColor(34, 34, 34);
      doc.text(line, textX, y + i * LEGEND_COMPANY_LINE_MM + LEGEND_COMPANY_LINE_MM / 2, { baseline: "middle", maxWidth: innerX + innerW - textX });
    });
  }
}

/** Draw the north arrow: filled left half, outlined right half, "N" below — matches NorthArrow in the view. */
function drawNorthArrow(doc: jsPDF, cx: number, cy: number, sizeMm: number, rotationDeg: number) {
  const r = sizeMm / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const rot = (x: number, y: number): [number, number] => [
    cx + x * Math.cos(rad) - y * Math.sin(rad),
    cy + x * Math.sin(rad) + y * Math.cos(rad),
  ];
  doc.setDrawColor(17, 17, 17);
  doc.setLineWidth(0.2);
  doc.circle(cx, cy, r - 0.5, "S");
  const tip = rot(0, -r * 0.88);
  const base = rot(0, r * 0.72);
  const left = rot(-r * 0.26, r * 0.72);
  const right = rot(r * 0.26, r * 0.72);
  doc.setFillColor(17, 17, 17);
  doc.lines([[base[0] - tip[0], base[1] - tip[1]], [left[0] - base[0], left[1] - base[1]]], tip[0], tip[1], [1, 1], "F", true);
  doc.lines([[base[0] - tip[0], base[1] - tip[1]], [right[0] - base[0], right[1] - base[1]]], tip[0], tip[1], [1, 1], "S", true);
  doc.setFont("Inter", "bold");
  doc.setFontSize(sizeMm * 0.16 * MM_TO_PT);
  doc.setTextColor(17, 17, 17);
  const n = rot(0, r * 0.98);
  doc.text("N", n[0], n[1], { align: "center", baseline: "bottom" });
}

/** The drawing block (Plankopf), walking the same layout the on-screen view renders. */
function drawDrawingBlock(doc: jsPDF, page: FloorplanPage, titleBlock: TitleBlock, projectName: string, company: CompanyProfile | undefined) {
  const block = page.drawingBlock;
  const logo = titleBlock.logo || company?.logo || "";
  const layout = layoutDrawingBlock(block, { titleBlock, page, projectName, company }, { hasLogo: Boolean(logo) });
  const { positionMm: pos } = block;
  const innerX = pos.x + layout.innerXMm;
  const innerW = layout.innerWMm;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(34, 34, 34);
  doc.setLineWidth(0.25);
  doc.rect(pos.x, pos.y, layout.widthMm, layout.heightMm, "FD");

  for (const section of layout.sections) {
    const top = pos.y + section.yMm;
    if (section.yMm > 0 && section.kind !== "disclaimer") {
      doc.setDrawColor(34, 34, 34);
      doc.setLineWidth(0.25);
      doc.line(pos.x, top, pos.x + layout.widthMm, top);
    }

    if (section.kind === "revisions") {
      const rowsY = top + DB_PAD_MM / 2;
      const colX: number[] = [innerX];
      for (const frac of DB_REV_COLS) colX.push(colX[colX.length - 1] + frac * innerW);
      const rows = [block.revisionHeaders.map((h) => h.toUpperCase()), ...layout.revisionRows.map((r) => [r.index, r.date, r.description, r.author ?? "", r.checkedBy ?? ""])];
      doc.setDrawColor(85, 85, 85);
      doc.setLineWidth(0.15);
      rows.forEach((cells, ri) => {
        const y = rowsY + ri * DB_REV_ROW_MM;
        doc.setFont("Inter", ri === 0 ? "bold" : "normal");
        doc.setFontSize((ri === 0 ? DB_REV_FONT_MM * 0.9 : DB_REV_FONT_MM) * MM_TO_PT);
        doc.setTextColor(17, 17, 17);
        cells.forEach((text, ci) => {
          const w = colX[ci + 1] - colX[ci];
          doc.rect(colX[ci], y, w, DB_REV_ROW_MM, "S");
          // Clip long text to the cell by trimming characters — jsPDF has no overflow:hidden.
          const maxChars = Math.max(1, Math.floor((w - 1.6) / (DB_REV_FONT_MM * 0.55)));
          const clipped = text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}…` : text;
          doc.text(clipped, colX[ci] + 0.8, y + DB_REV_ROW_MM / 2, { baseline: "middle" });
        });
      });
    } else if (section.kind === "disclaimer") {
      doc.setFont("Inter", "normal");
      doc.setFontSize(DB_DISCLAIMER_FONT_MM * MM_TO_PT);
      doc.setTextColor(34, 34, 34);
      const lineH = DB_DISCLAIMER_FONT_MM * 1.45;
      layout.disclaimerLines.forEach((l, i) => {
        doc.text(l, innerX, top + DB_PAD_MM + i * lineH + lineH / 2, { baseline: "middle" });
      });
    } else if (section.kind === "title") {
      const cx = pos.x + layout.widthMm / 2;
      const titleH = DB_TITLE_FONT_MM * 1.3;
      const subH = layout.subtitle ? DB_SUBTITLE_FONT_MM * 1.6 : 0;
      const contentTop = top + (section.heightMm - titleH - subH) / 2;
      doc.setFont("Inter", "bold");
      doc.setFontSize(DB_TITLE_FONT_MM * MM_TO_PT);
      doc.setTextColor(17, 17, 17);
      doc.text(layout.title, cx, contentTop + titleH / 2, { align: "center", baseline: "middle", maxWidth: innerW });
      if (layout.subtitle) {
        doc.setFont("Inter", "normal");
        doc.setFontSize(DB_SUBTITLE_FONT_MM * MM_TO_PT);
        doc.setTextColor(51, 51, 51);
        doc.text(layout.subtitle, cx, contentTop + titleH + subH / 2, { align: "center", baseline: "middle", maxWidth: innerW });
      }
    } else if (section.kind === "fields") {
      for (const cell of layout.fieldCells) {
        const x = pos.x + cell.xMm;
        const y = pos.y + cell.yMm;
        doc.setDrawColor(119, 119, 119);
        doc.setLineWidth(0.15);
        doc.rect(x, y, cell.wMm, cell.hMm, "S");
        doc.setFont("Inter", "bold");
        doc.setFontSize(DB_FIELD_LABEL_FONT_MM * MM_TO_PT);
        doc.setTextColor(68, 68, 68);
        const labelH = DB_FIELD_LABEL_FONT_MM * 1.5;
        doc.text(cell.label.toUpperCase(), x + 1, y + 0.6 + labelH / 2, { baseline: "middle", maxWidth: cell.wMm - 2 });
        doc.setFont("Inter", "normal");
        doc.setFontSize(DB_FIELD_VALUE_FONT_MM * MM_TO_PT);
        doc.setTextColor(17, 17, 17);
        const lineH = DB_FIELD_VALUE_FONT_MM * 1.4;
        cell.lines.forEach((l, i) => {
          doc.text(l, x + 1, y + 0.6 + labelH + i * lineH + lineH / 2, { baseline: "middle" });
        });
      }
    } else if (section.kind === "footer") {
      const h = section.heightMm;
      if (block.showLogo && logo) {
        try {
          const img = new Image();
          img.src = logo;
          const aspect = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 3;
          const logoH = h - 6;
          const logoW = Math.min(logoH * aspect, innerW * 0.55);
          doc.addImage(logo, imageFormat(logo), innerX, top + 3, logoW, logoH, undefined, "FAST");
        } catch {
          // A logo jsPDF can't decode is not worth failing the whole plan for.
        }
      }
      if (block.showNorthArrow) {
        const size = h - 5;
        drawNorthArrow(doc, innerX + innerW - size / 2, top + h / 2, size, block.northRotationDeg);
      }
    }
  }
}

/** Free text notes, wrapped exactly as on screen. */
function drawNotes(doc: jsPDF, notes: FloorplanNote[]) {
  for (const note of notes) {
    const nl = layoutNote(note);
    const pad = note.boxed ? 1.5 : 0;
    if (note.boxed) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(51, 51, 51);
      doc.setLineWidth(0.15);
      doc.rect(note.positionMm.x, note.positionMm.y, note.widthMm, nl.heightMm, "FD");
    }
    const [r, g, b] = hexToRgb(note.color ?? "#111111");
    doc.setFont("Inter", "normal");
    doc.setFontSize(note.fontSizeMm * MM_TO_PT);
    doc.setTextColor(r, g, b);
    nl.lines.forEach((l, i) => {
      doc.text(l, note.positionMm.x + pad, note.positionMm.y + pad + i * nl.lineHeightMm + nl.lineHeightMm / 2, { baseline: "middle" });
    });
  }
}

export async function exportFloorplanPdf(opts: FloorplanPdfOptions): Promise<void> {
  const planPages = opts.pages.filter((p): p is FloorplanPage => p.type === "floorplan");
  if (planPages.length === 0) return;

  const sizeOf = (page: FloorplanPage) => {
    const paper = getPaperSize(page.paperId, page.customWidthIn, page.customHeightIn);
    return page.orientation === "landscape"
      ? { w: paper.heightIn * IN_TO_MM, h: paper.widthIn * IN_TO_MM }
      : { w: paper.widthIn * IN_TO_MM, h: paper.heightIn * IN_TO_MM };
  };

  const first = sizeOf(planPages[0]);
  const doc = new jsPDF({ orientation: planPages[0].orientation, unit: "mm", format: [first.w, first.h] });
  await loadInterFont(doc);

  for (let i = 0; i < planPages.length; i++) {
    const page = planPages[i];
    const { w: pageW, h: pageH } = sizeOf(page);
    if (i > 0) doc.addPage([pageW, pageH], page.orientation);

    // Underlay first — everything else is drawn over the architect's drawing.
    if (page.underlay) {
      const { positionMm: pos, sizeMm: size } = page.underlay;
      try {
        // A DXF is drawn as vectors on screen; jsPDF embeds rasters only, so it is turned into
        // pixels here, once, at print resolution for the size it covers on the sheet.
        const src = isVectorUnderlay(page.underlay.src)
          ? await rasterizeVectorForPrint(page.underlay.src, size)
          : page.underlay.src;
        doc.addImage(src, imageFormat(src), pos.x, pos.y, size.w, size.h, undefined, "MEDIUM");
      } catch {
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(10);
        doc.text("Underlay could not be embedded", pos.x + 5, pos.y + 10);
      }
    }

    // Covers: white over whatever part of the architect's plan was taken out.
    doc.setFillColor(255, 255, 255);
    for (const mask of page.masks) {
      const opacity = Math.min(1, Math.max(0, mask.opacity ?? 1));
      if (opacity <= 0) continue;
      // A turned cover is drawn as a polygon: jsPDF has no transform stack for rect().
      const turn = mask.rotationDeg ?? 0;
      const half = { x: mask.sizeMm.w / 2, y: mask.sizeMm.h / 2 };
      const cx = mask.positionMm.x + half.x;
      const cy = mask.positionMm.y + half.y;
      if (opacity < 1) setPdfAlpha(doc, opacity);
      if (!turn) {
        doc.rect(mask.positionMm.x, mask.positionMm.y, mask.sizeMm.w, mask.sizeMm.h, "F");
      } else {
        const corners = [
          { x: -half.x, y: -half.y },
          { x: half.x, y: -half.y },
          { x: half.x, y: half.y },
          { x: -half.x, y: half.y },
        ].map((c) => rotateVec(c, turn));
        const deltas: [number, number][] = [];
        for (let i = 1; i < corners.length; i++) {
          deltas.push([corners[i].x - corners[i - 1].x, corners[i].y - corners[i - 1].y]);
        }
        doc.lines(deltas, cx + corners[0].x, cy + corners[0].y, [1, 1], "F", true);
      }
      if (opacity < 1) setPdfAlpha(doc, 1);
    }

    // Wi-Fi heatmap: rasterised to a canvas and placed as one image. Drawing a rectangle
    // per sample would put tens of thousands of paths in the file for a picture that is a
    // raster by nature.
    const heat = { ...DEFAULT_HEATMAP, ...(page.heatmap ?? {}) };
    // An execution plan drops what only serves planning, as the screen does.
    const planning = !page.hidePlanning;
    if (heat.visible && planning) {
      const aps = collectAccessPoints(page, heat.band, (nodeId) => {
        const node = opts.nodes.find((n) => n.id === nodeId);
        const templateId = (node?.data as DeviceData | undefined)?.templateId;
        return templateId ? getTemplateById(templateId, opts.customTemplates ?? [])?.wifi : undefined;
      });
      if (aps.length > 0) {
        const area = drawingAreaMm(page);
        const grid = computeHeatmap(aps, area, {
          band: heat.band,
          scaleDenominator: page.scaleDenominator,
          pathLossExponent: heat.pathLossExponent,
          walls: page.walls ?? [],
          materialOverrides: opts.wallMaterials,
          pitchMm: heat.gridMm,
        });
        const png = heatmapPng(grid);
        if (png) {
          const alpha = Math.min(1, Math.max(0, heat.opacity));
          if (alpha < 1) setPdfAlpha(doc, alpha);
          try {
            doc.addImage(png, "PNG", area.x, area.y, (grid.cols - 1) * grid.pitchMm, (grid.rows - 1) * grid.pitchMm, undefined, "FAST");
          } catch {
            // A heatmap that will not embed is left out rather than taking the plan down.
          }
          if (alpha < 1) setPdfAlpha(doc, 1);
        }
      }
    }

    // Walls at their real thickness — the same conversion the screen uses, so the printed
    // plan measures the way the editor showed it.
    for (const wall of page.walls ?? []) {
      if (wall.hidden || wall.pointsMm.length < 2) continue;
      const [wr, wg, wb] = hexToRgb(WALL_MATERIAL_COLORS[wall.material]);
      doc.setDrawColor(wr, wg, wb);
      doc.setLineWidth(Math.max(0.2, realMmToPaperMm(wall.thicknessMm, page.scaleDenominator)));
      doc.setLineJoin("miter");
      doc.setLineCap("butt");
      const deltas: [number, number][] = [];
      for (let k = 1; k < wall.pointsMm.length; k++) {
        deltas.push([wall.pointsMm[k].x - wall.pointsMm[k - 1].x, wall.pointsMm[k].y - wall.pointsMm[k - 1].y]);
      }
      doc.lines(deltas, wall.pointsMm[0].x, wall.pointsMm[0].y, [1, 1], "S", false);
    }
    doc.setLineJoin("round");
    doc.setLineCap("round");

    // Detection and surveillance areas, over the plan but under the symbols — the same
    // order the screen draws them in, so the print is what was judged on screen.
    for (const coverage of coveragesHidden(page) ? [] : page.coverages ?? []) {
      if (!isCoverageVisible(coverage, page.groups)) continue;
      const points = coveragePointsOnSheet(coverage, page);
      if (points.length < 3) continue;
      const [cr2, cg2, cb2] = hexToRgb(coverageColor(coverage, page.groups));
      const alpha = Math.min(1, Math.max(0, coverage.opacity ?? DEFAULT_COVERAGE_OPACITY));
      const outline = coverage.showOutline !== false;
      // jsPDF has no transform stack for filled paths, so the polygon arrives already
      // turned and placed; only the per-segment deltas it wants are computed here.
      const deltas: [number, number][] = [];
      for (let k = 1; k < points.length; k++) {
        deltas.push([points[k].x - points[k - 1].x, points[k].y - points[k - 1].y]);
      }
      doc.setFillColor(cr2, cg2, cb2);
      doc.setDrawColor(cr2, cg2, cb2);
      doc.setLineWidth(0.25);
      if (alpha < 1) setPdfAlpha(doc, alpha);
      doc.lines(deltas, points[0].x, points[0].y, [1, 1], "F", true);
      if (alpha < 1) setPdfAlpha(doc, 1);
      // The boundary is the line being documented — where the detector stops — so it is
      // drawn at full strength rather than through the fill's alpha.
      if (outline) doc.lines(deltas, points[0].x, points[0].y, [1, 1], "S", true);

      const coverageLabel = coverageLabelOf(coverage, page.symbols);
      if (coverageLabel) {
        const at = coverageLabelAnchorMm(coverage, page);
        doc.setFont("Inter", "bold");
        doc.setFontSize(page.labelSizeMm * 0.85 * MM_TO_PT);
        doc.setTextColor(17, 17, 17);
        doc.text(coverageLabel, at.x, at.y, { baseline: "middle", align: "center" });
      }
    }

    // Projectors and their pictures — the same geometry the screen draws, so the print
    // shows the position that was judged on screen.
    for (const { projection, geometry: g } of visibleProjections(page)) {
      const ok = g.result.issues.length === 0;
      const [pr, pg, pb] = hexToRgb(ok ? PROJECTION_OK_COLOR : PROJECTION_WARN_COLOR);
      const [a, b] = g.pictureMm;
      const [sa, sb] = g.surfaceMm;
      if (planning && g.distanceM > 0) {
        const cone: [number, number][] = [[a.x - g.lensMm.x, a.y - g.lensMm.y], [b.x - a.x, b.y - a.y]];
        doc.setFillColor(pr, pg, pb);
        doc.setDrawColor(pr, pg, pb);
        doc.setLineWidth(0.2);
        setPdfAlpha(doc, 0.1);
        doc.lines(cone, g.lensMm.x, g.lensMm.y, [1, 1], "F", true);
        setPdfAlpha(doc, 1);
        doc.lines(cone, g.lensMm.x, g.lensMm.y, [1, 1], "S", true);
      }
      if (planning && g.inPictureMm) {
        // Where someone stands in the picture. The screen hatches it; a flat tint prints
        // the same message without a pattern jsPDF does not have.
        const [ir, ig, ib] = hexToRgb(PROJECTION_IN_PICTURE_COLOR);
        const z = g.inPictureMm;
        const zone: [number, number][] = [];
        for (let k = 1; k < z.length; k++) zone.push([z[k].x - z[k - 1].x, z[k].y - z[k - 1].y]);
        doc.setFillColor(ir, ig, ib);
        doc.setDrawColor(ir, ig, ib);
        doc.setLineWidth(0.2);
        setPdfAlpha(doc, 0.35);
        doc.lines(zone, z[0].x, z[0].y, [1, 1], "F", true);
        setPdfAlpha(doc, 1);
        doc.lines(zone, z[0].x, z[0].y, [1, 1], "S", true);
      }
      if (planning && g.bandMm) {
        const [okR, okG, okB] = hexToRgb(PROJECTION_OK_COLOR);
        const len = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
        const tx = ((sb.x - sa.x) / len) * 1.5, ty = ((sb.y - sa.y) / len) * 1.5;
        doc.setDrawColor(okR, okG, okB);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(g.bandMm[0].x, g.bandMm[0].y, g.bandMm[1].x, g.bandMm[1].y);
        doc.setLineDashPattern([], 0);
        for (const end of g.bandMm) doc.line(end.x - tx, end.y - ty, end.x + tx, end.y + ty);
      }
      if (planning && projection.audience) {
        // The audience area and the area the viewing recommendation covers.
        const v = viewingOnSheet(projection, g.result.picture, page.scaleDenominator);
        const closed = (pts: { x: number; y: number }[]): [number, number][] =>
          pts.slice(1).map((p, k) => [p.x - pts[k].x, p.y - pts[k].y]);
        if (v.recommendedMm) {
          const [rr, rg, rb] = hexToRgb(VIEWING_OK_COLOR);
          doc.setDrawColor(rr, rg, rb);
          doc.setLineWidth(0.15);
          doc.setLineDashPattern([1.6, 0.8, 0.3, 0.8], 0);
          doc.lines(closed(v.recommendedMm), v.recommendedMm[0].x, v.recommendedMm[0].y, [1, 1], "S", true);
          doc.setLineDashPattern([], 0);
        }
        const heat = viewingHeatmap(projection, g.result.picture, page.scaleDenominator);
        const heatPng = heat ? viewingRasterPng(heat) : undefined;
        if (heat && heatPng) {
          // One upright picture over the area's box, transparent outside the area.
          setPdfAlpha(doc, VIEWING_HEATMAP_OPACITY);
          try {
            doc.addImage(heatPng, "PNG", heat.xMm, heat.yMm, heat.wMm, heat.hMm, undefined, "FAST");
          } catch {
            // A heatmap that will not embed is left out rather than taking the plan down.
          }
          setPdfAlpha(doc, 1);
        }
        if (v.audienceMm) {
          const [ar, ag, ab] = hexToRgb(v.result.issues.length === 0 ? VIEWING_OK_COLOR : VIEWING_HINT_COLOR);
          doc.setFillColor(ar, ag, ab);
          doc.setDrawColor(ar, ag, ab);
          doc.setLineWidth(0.25);
          if (!heatPng) {
            setPdfAlpha(doc, 0.06);
            doc.lines(closed(v.audienceMm), v.audienceMm[0].x, v.audienceMm[0].y, [1, 1], "F", true);
          }
          setPdfAlpha(doc, 1);
          doc.lines(closed(v.audienceMm), v.audienceMm[0].x, v.audienceMm[0].y, [1, 1], "S", true);
        }
      }
      // A display is drawn with the symbols, as a bar; only a projector has a surface line.
      if (projection.kind !== "display") {
        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.5);
        doc.line(sa.x, sa.y, sb.x, sb.y);
        doc.setDrawColor(17, 17, 17);
        doc.setLineWidth(0.8);
        doc.line(a.x, a.y, b.x, b.y);
      }
      const at = projectionCaptionAnchorMm(projection, page.labelSizeMm * 1.6);
      doc.setFont("Inter", "bold");
      doc.setFontSize(page.labelSizeMm * 0.85 * MM_TO_PT);
      if (ok) doc.setTextColor(17, 17, 17); else doc.setTextColor(pr, pg, pb);
      // The embedded font has no double prime; the plain inch mark reads the same.
      doc.text(projectionCaption(projection, g).replace("\u2033", '"'), at.x, at.y, { baseline: "middle", align: at.align === "start" ? "left" : at.align === "end" ? "right" : "center" });

      // The section box, drawn from the same geometry and styles as on screen.
      const box = planning ? sectionBoxMm(projection, g) : null;
      if (box) {
        const style: Record<SectionRole, { stroke: string; w: number; fill?: string; alpha?: number }> = {
          floor: { stroke: "#111111", w: 0.35 },
          ceiling: { stroke: "#64748b", w: 0.25 },
          beam: { stroke: "#0e7490", w: 0.2, fill: "#0e7490", alpha: 0.12 },
          picture: { stroke: "#111111", w: 0.8 },
          projector: { stroke: "#111111", w: 0.2, fill: "#334155", alpha: 1 },
          person: { stroke: "#b45309", w: 0.2, fill: "#f59e0b", alpha: 0.55 },
          "in-picture": { stroke: "#d97706", w: 1 },
        };
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(17, 17, 17);
        doc.setLineWidth(0.2);
        doc.rect(box.x, box.y, box.drawing.widthMm, box.drawing.heightMm, "FD");
        if (box.drawing.image) {
          doc.addImage(box.drawing.image.src, imageFormat(box.drawing.image.src), box.x, box.y, box.drawing.widthMm, box.drawing.heightMm, undefined, "MEDIUM");
          doc.rect(box.x, box.y, box.drawing.widthMm, box.drawing.heightMm, "S");
        }
        doc.setLineCap("butt");
        for (const item of box.drawing.items) {
          const st = style[item.role];
          const pts = item.points.map((pt) => ({ x: box.x + pt.x, y: box.y + pt.y }));
          doc.setDrawColor(...hexToRgb(st.stroke));
          doc.setLineWidth(st.w);
          if (pts.length === 2) {
            doc.line(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
            continue;
          }
          const deltas: [number, number][] = [];
          for (let k = 1; k < pts.length; k++) deltas.push([pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y]);
          if (st.fill) {
            doc.setFillColor(...hexToRgb(st.fill));
            setPdfAlpha(doc, st.alpha ?? 1);
            doc.lines(deltas, pts[0].x, pts[0].y, [1, 1], "F", true);
            setPdfAlpha(doc, 1);
          }
          doc.lines(deltas, pts[0].x, pts[0].y, [1, 1], "S", true);
        }
        doc.setLineCap("round");
        const text = g.section ? inPictureLabel(g.section) : undefined;
        if (text && box.drawing.inPictureLabelMm) {
          doc.setFont("Inter", "bold");
          doc.setFontSize(box.drawing.labelSizeMm * MM_TO_PT);
          doc.setTextColor(180, 83, 9);
          doc.text(text, box.x + box.drawing.inPictureLabelMm.x, box.y + box.drawing.inPictureLabelMm.y, { baseline: "middle", align: "center" });
        }
      }
    }

    // Content border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.12);
    doc.rect(PAGE_MARGIN_MM, PAGE_MARGIN_MM, pageW - 2 * PAGE_MARGIN_MM, pageH - 2 * PAGE_MARGIN_MM);

    // Symbols. Turned pictures are rasterized once per group + angle, not per symbol —
    // a plan with fifty rotated speakers would otherwise redraw the same canvas fifty times.
    const groupById = new Map(page.groups.map((g) => [g.id, g]));
    // A BHE symbol is an SVG on screen and has to become pixels for jsPDF — once per group,
    // whatever it costs, because the same symbol repeats all over the sheet.
    const librarySymbols = new Map<string, string>();
    for (const group of page.groups) {
      if (group.symbolImageSrc || !group.symbolLibraryId || !isGroupVisible(group)) continue;
      try {
        const plain = symbolLibraryUrl(group.symbolLibraryId);
        // Recoloured first, then rasterized — the print gets what the screen shows.
        const src = group.tintSymbol ? await tintSymbol(plain, group.color) : plain;
        librarySymbols.set(group.id, await rasterizeLibrarySymbol(src));
      } catch {
        // Library not installed on this build: the group falls back to its drawn shape.
      }
    }
    const symbolPicture = (group: FloorplanSymbolGroup): string | undefined =>
      group.symbolImageSrc || librarySymbols.get(group.id);
    const turnedSymbolImages = new Map<string, string>();
    for (const symbol of page.symbols) {
      const group = groupById.get(symbol.groupId);
      if (!group || !isGroupVisible(group)) continue;
      const rot = ((((symbol.rotationDeg ?? 0) % 360) + 360) % 360);
      const base = symbolPicture(group);
      if (!base || !rot) continue;
      const key = `${group.id}|${rot}`;
      if (turnedSymbolImages.has(key)) continue;
      try {
        turnedSymbolImages.set(key, await rotatedImageDataUrl(base, rot));
      } catch {
        // A picture that will not rotate is drawn unturned rather than dropped.
      }
    }
    for (const symbol of page.symbols) {
      const group = groupById.get(symbol.groupId);
      // A switched-off layer prints nothing — that is the point of switching it off.
      if (!group || !isGroupVisible(group)) continue;
      const rot = symbol.rotationDeg ?? 0;
      const display = displayOnSymbol(page, symbol);
      const deviceData = symbol.deviceNodeId ? (opts.nodes.find((n) => n.id === symbol.deviceNodeId)?.data as DeviceData | undefined) : undefined;
      const footprint = display ? null : symbolFootprintMm(group, deviceData, page.scaleDenominator);
      if (display) {
        // A display with a size: a bar of its true width instead of the pictogram.
        const bar = displayBarMm(display, page.scaleDenominator);
        const [dr, dg, db] = hexToRgb(group.color);
        doc.setFillColor(dr, dg, db);
        doc.setDrawColor(17, 17, 17);
        doc.setLineWidth(0.15);
        doc.lines(bar.slice(1).map((p, k) => [p.x - bar[k].x, p.y - bar[k].y] as [number, number]), bar[0].x, bar[0].y, [1, 1], "FD", true);
      } else if (footprint) {
        // True size: the device's own outline in plan, turned with the symbol.
        const ring = symbolFootprintOutlineMm(footprint, symbol.positionMm, rot);
        const [fr, fg, fb] = hexToRgb(group.color);
        const [or, og, ob] = hexToRgb(group.outlineColor || "#111111");
        doc.setFillColor(fr, fg, fb);
        doc.setDrawColor(or, og, ob);
        doc.setLineWidth(0.15);
        doc.lines(ring.slice(1).map((p, k) => [p.x - ring[k].x, p.y - ring[k].y] as [number, number]), ring[0].x, ring[0].y, [1, 1], "FD", true);
      } else {
        drawSymbol(
          doc,
          group,
          symbol.positionMm.x,
          symbol.positionMm.y,
          page.symbolSizeMm,
          rot,
          pictureForSymbol(group, rot, symbolPicture(group), turnedSymbolImages),
        );
      }

      const anchor = symbolLabelAnchor(symbol, page.symbolSizeMm);
      doc.setFont("Inter", "bold");
      doc.setFontSize(page.labelSizeMm * MM_TO_PT);
      doc.setTextColor(17, 17, 17);
      // Alignment is applied by hand along the (possibly rotated) baseline so start /
      // middle / end land on the anchor exactly as on screen; jsPDF's angle is
      // counter-clockwise, ours clockwise.
      const rotDeg = symbol.labelRotationDeg ?? 0;
      const rad = (rotDeg * Math.PI) / 180;
      const w = doc.getTextWidth(symbol.label);
      const shift = symbol.labelAlign === "end" ? -w : symbol.labelAlign === "middle" ? -w / 2 : 0;
      doc.text(symbol.label, anchor.x + shift * Math.cos(rad), anchor.y + shift * Math.sin(rad), { baseline: "middle", angle: -rotDeg });
    }

    // Notes sit above symbols, below the legend and drawing block.
    drawNotes(doc, page.notes);

    // Legend
    const rows = buildLegendRows(page);
    const notes = (page.legend.notes ?? []).filter((n) => n.trim().length > 0);
    const lineRows = legendShowsLines(page) && opts.edges && opts.loadSpecLookup
      ? buildLegendLineRows(computeLineLoads(page, opts.nodes, opts.edges, opts.loadSpecLookup))
      : [];
    if (page.legend.visible && (rows.length > 0 || notes.length > 0 || lineRows.length > 0 || legendColorKeys(page).length > 0)) {
      // Uploaded images are data URLs already; remote references are fetched now so the
      // legend prints the same picture the screen shows — when the host allows it.
      const images = new Map<string, string>();
      if (page.legend.showImages) {
        await Promise.all(rows.map(async (row) => {
          const src = legendRowImage(row);
          if (!src) return;
          const data = await fetchImageAsDataUrl(src);
          if (data) images.set(row.groupId, data);
        }));
      }
      drawLegend(doc, page, rows, notes, images, opts.companyProfile, lineRows, librarySymbols);
    }

    if (page.drawingBlock.visible) {
      drawDrawingBlock(doc, page, opts.titleBlock ?? EMPTY_TITLE_BLOCK, opts.schematicName, opts.companyProfile);
    }

    if (page.showTitleBlock && opts.titleBlock) {
      await drawTitleBlockMm(doc, pageW, pageH, opts.titleBlock, i + 1, planPages.length);
    }
  }

  const safeName = opts.schematicName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "Untitled";
  doc.save(`${safeName} - Floorplans.pdf`);
}
