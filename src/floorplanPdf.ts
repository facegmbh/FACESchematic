/**
 * Floorplan PDF export.
 *
 * Draws each floorplan page at true paper size, so a plan printed at 100 % is a scaled
 * drawing a fitter can measure off: the sheet is the paper, positions are the same paper
 * mm the editor stores, and the underlay lands at exactly the size calibration solved for.
 */

import { jsPDF } from "jspdf";
import type { CompanyProfile, ConnectionEdge, FloorplanNote, FloorplanPage, FloorplanSymbolGroup, SchematicNode, SchematicPage, TitleBlock } from "./types";
import { buildLegendLineRows, computeLineLoads, legendShowsLines, type LegendLineRow, type LoadSpecLookup } from "./speakerLines";
import { getPaperSize } from "./printConfig";
import { loadInterFont } from "./rackPdf";
import { drawTitleBlockMm } from "./printSheetPdf";
import { fetchImageAsDataUrl } from "./floorplanUnderlay";
import {
  buildLegendRows,
  layoutDrawingBlock,
  layoutNote,
  legendHeightMm,
  legendRowImage,
  companyProfileLines,
  hasCompanyProfile,
  LEGEND_COMPANY_GAP_MM,
  LEGEND_COMPANY_LINE_MM,
  LEGEND_COMPANY_LOGO_MM,
  symbolLabelAnchor,
  symbolPolygon,
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
  LEGEND_LINE_ROW_MM,
  LEGEND_LINE_COLS,
  DEFAULT_LEGEND_LINES_TITLE,
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
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

/** Draw one symbol at (cx, cy) in mm, with the group's glyph inside when it has one. */
function drawSymbol(doc: jsPDF, group: Pick<FloorplanSymbolGroup, "shape" | "color" | "glyph">, cx: number, cy: number, sizeMm: number) {
  const [r, g, b] = hexToRgb(group.color);
  doc.setFillColor(r, g, b);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.2);
  if (group.shape === "circle") {
    doc.circle(cx, cy, sizeMm / 2, "FD");
  } else {
    const pts = symbolPolygon(group.shape, sizeMm);
    if (pts.length === 0) return;
    // jsPDF wants relative segments from the starting point.
    const deltas: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      deltas.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
    }
    doc.lines(deltas, cx + pts[0].x, cy + pts[0].y, [1, 1], "FD", true);
  }
  const glyph = group.glyph?.trim().slice(0, 2);
  if (glyph) {
    const [gr, gg, gb] = hexToRgb(glyphColorOn(group.color));
    doc.setFont("Inter", "bold");
    doc.setFontSize(sizeMm * (glyph.length > 1 ? 0.42 : 0.55) * MM_TO_PT);
    doc.setTextColor(gr, gg, gb);
    doc.text(glyph, cx, cy + (group.shape === "triangle" ? sizeMm * 0.12 : 0), { align: "center", baseline: "middle" });
  }
}

/** Legend box: one row per symbol group, then the free-text installation notes. */
function drawLegend(doc: jsPDF, page: FloorplanPage, rows: LegendRow[], notes: string[], images: Map<string, string>, company: CompanyProfile | undefined, lineRows: LegendLineRow[] = []) {
  const { positionMm: pos, widthMm } = page.legend;
  const heightMm = legendHeightMm(rows, page.legend, company, lineRows.length);

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
    drawSymbol(doc, row, innerX + page.symbolSizeMm / 2, centerY, page.symbolSizeMm);

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
    doc.text(page.legend.linesTitle ?? DEFAULT_LEGEND_LINES_TITLE, innerX, y + 3.6, { maxWidth: innerW });
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
    cell("Line", 0, y, true); cell("Amplifier · channel", 1, y, true); cell("Qty", 2, y, true, "right"); cell("Load", 3, y, true);
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

  // Company block: logo left, name/address/contact right.
  if (page.legend.showCompany !== false && hasCompanyProfile(company)) {
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
      const { positionMm: pos, sizeMm: size, src } = page.underlay;
      try {
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
      doc.rect(mask.positionMm.x, mask.positionMm.y, mask.sizeMm.w, mask.sizeMm.h, "F");
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
    if (page.legend.visible && (rows.length > 0 || notes.length > 0 || lineRows.length > 0)) {
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
      drawLegend(doc, page, rows, notes, images, opts.companyProfile, lineRows);
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
