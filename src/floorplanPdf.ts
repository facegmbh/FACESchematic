/**
 * Floorplan PDF export.
 *
 * Draws each floorplan page at true paper size, so a plan printed at 100 % is a scaled
 * drawing a fitter can measure off: the sheet is the paper, positions are the same paper
 * mm the editor stores, and the underlay lands at exactly the size calibration solved for.
 */

import { jsPDF } from "jspdf";
import type { FloorplanPage, FloorplanSymbolGroup, SchematicNode, SchematicPage, TitleBlock } from "./types";
import { getPaperSize } from "./printConfig";
import { loadInterFont } from "./rackPdf";
import { drawTitleBlockMm } from "./printSheetPdf";
import {
  buildLegendRows,
  legendHeightMm,
  symbolLabelAnchor,
  symbolPolygon,
  IN_TO_MM,
  LEGEND_NOTES_GAP_MM,
  LEGEND_NOTES_TITLE_MM,
  LEGEND_NOTE_LINE_MM,
  LEGEND_PAD_MM,
  LEGEND_ROW_MM,
  LEGEND_ROW_WITH_IMAGE_MM,
  LEGEND_TITLE_MM,
  PAGE_MARGIN_MM,
  type LegendRow,
} from "./floorplan";

const MM_TO_PT = 72 / IN_TO_MM;
/** Where the red rule under the legend title sits inside the title row. */
const LEGEND_TITLE_RULE_MM = LEGEND_TITLE_MM - 3;

export interface FloorplanPdfOptions {
  pages: SchematicPage[];
  nodes: SchematicNode[];
  schematicName: string;
  titleBlock?: TitleBlock;
}

/** #rrggbb → [r, g, b]; falls back to black for anything unparseable. */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

/** Draw one symbol at (cx, cy) in mm. */
function drawSymbol(doc: jsPDF, group: FloorplanSymbolGroup, cx: number, cy: number, sizeMm: number) {
  const [r, g, b] = hexToRgb(group.color);
  doc.setFillColor(r, g, b);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.2);
  if (group.shape === "circle") {
    doc.circle(cx, cy, sizeMm / 2, "FD");
    return;
  }
  const pts = symbolPolygon(group.shape, sizeMm);
  if (pts.length === 0) return;
  // jsPDF wants relative segments from the starting point.
  const deltas: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    deltas.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
  }
  doc.lines(deltas, cx + pts[0].x, cy + pts[0].y, [1, 1], "FD", true);
}

/** Legend box: one row per symbol group, then the free-text installation notes. */
function drawLegend(doc: jsPDF, page: FloorplanPage, rows: LegendRow[], notes: string[]) {
  const { positionMm: pos, widthMm } = page.legend;
  const heightMm = legendHeightMm(rows, page.legend);

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
  doc.text(page.legend.title, innerX, y + 3.4, { baseline: "alphabetic", maxWidth: innerW });
  doc.setDrawColor(200, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(innerX, y + LEGEND_TITLE_RULE_MM, innerX + innerW, y + LEGEND_TITLE_RULE_MM);
  y += LEGEND_TITLE_MM;

  const rowH = page.legend.showImages ? LEGEND_ROW_WITH_IMAGE_MM : LEGEND_ROW_MM;
  for (const row of rows) {
    const centerY = y + rowH / 2;
    drawSymbol(doc, { id: row.groupId, label: row.label, color: row.color, shape: row.shape }, innerX + page.symbolSizeMm / 2, centerY, page.symbolSizeMm);

    const textX = innerX + page.symbolSizeMm + 2;
    const imageW = page.legend.showImages && row.imageSrc ? 22 : 0;
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

    if (page.legend.showImages && row.imageSrc) {
      const imgH = rowH - 3;
      const imgX = innerX + innerW - imageW;
      try {
        doc.addImage(row.imageSrc, imageFormat(row.imageSrc), imgX, y + 1.5, imageW - 6, imgH, undefined, "FAST");
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

  if (notes.length > 0) {
    y += LEGEND_NOTES_GAP_MM;
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.15);
    doc.line(innerX, y, innerX + innerW, y);
    doc.setFont("Inter", "bold");
    doc.setFontSize(3 * MM_TO_PT);
    doc.setTextColor(17, 17, 17);
    doc.text(page.legend.notesTitle ?? "", innerX, y + 3.6, { maxWidth: innerW });
    y += LEGEND_NOTES_TITLE_MM;

    doc.setFont("Inter", "normal");
    doc.setFontSize(2.6 * MM_TO_PT);
    doc.setTextColor(34, 34, 34);
    for (const note of notes) {
      doc.text(note, innerX, y + LEGEND_NOTE_LINE_MM * 0.75, { maxWidth: innerW });
      y += LEGEND_NOTE_LINE_MM;
    }
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
      const { positionMm: pos, sizeMm: size, src } = page.underlay;
      try {
        doc.addImage(src, imageFormat(src), pos.x, pos.y, size.w, size.h, undefined, "MEDIUM");
      } catch {
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(10);
        doc.text("Underlay could not be embedded", pos.x + 5, pos.y + 10);
      }
    }

    // Content border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.12);
    doc.rect(PAGE_MARGIN_MM, PAGE_MARGIN_MM, pageW - 2 * PAGE_MARGIN_MM, pageH - 2 * PAGE_MARGIN_MM);

    // Symbols
    const groupById = new Map(page.groups.map((g) => [g.id, g]));
    for (const symbol of page.symbols) {
      const group = groupById.get(symbol.groupId);
      if (!group) continue;
      drawSymbol(doc, group, symbol.positionMm.x, symbol.positionMm.y, page.symbolSizeMm);

      const anchor = symbolLabelAnchor(symbol, page.symbolSizeMm);
      doc.setFont("Inter", "bold");
      doc.setFontSize(page.labelSizeMm * MM_TO_PT);
      doc.setTextColor(17, 17, 17);
      doc.text(symbol.label, anchor.x, anchor.y, { baseline: "middle" });
    }

    // Legend
    const rows = buildLegendRows(page);
    const notes = (page.legend.notes ?? []).filter((n) => n.trim().length > 0);
    if (page.legend.visible && (rows.length > 0 || notes.length > 0)) {
      drawLegend(doc, page, rows, notes);
    }

    if (page.showTitleBlock && opts.titleBlock) {
      await drawTitleBlockMm(doc, pageW, pageH, opts.titleBlock, i + 1, planPages.length);
    }
  }

  const safeName = opts.schematicName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "Untitled";
  doc.save(`${safeName} - Floorplans.pdf`);
}
