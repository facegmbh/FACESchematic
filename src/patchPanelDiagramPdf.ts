import { jsPDF } from "jspdf";
import type { TitleBlock } from "./types";
import type { ReportLayout } from "./reportLayout";
import { getPageDimensions, REPORT_MARGIN_MM } from "./reportLayout";
import { loadInterFont, drawGridBlock } from "./reportPdf";
import type { DiagramFace, DiagramPanel } from "./patchPanelDiagram";

/**
 * PDF renderer for the graphical patch plan. Mirrors the on-screen SVG in
 * `components/PatchPanelDiagram.tsx` using jsPDF vector primitives. Connectors
 * are drawn as their text label (rather than the SVG icon) to keep the export
 * self-contained. Header/footer reuse the shared report grid renderer.
 */

// ─── Geometry (mm) ───
const PORT_NUM_H = 4.5;
const JACK_H = 7;
const FACE_H = 15;
const FACE_GAP = 2;
const CELL_GAP = 3;
const MAX_CELL_W = 46;
const MIN_CELL_W = 28;
const MUTED: [number, number, number] = [156, 163, 175];
const INK: [number, number, number] = [31, 41, 55];

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return INK;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function trunc(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function drawFace(doc: jsPDF, face: DiagramFace, x: number, y: number, w: number, cellCharW: number, sideLabel?: string) {
  const jackX = x + 1;
  const jackW = w - 2;
  const cx = x + w / 2;
  const [cr, cg, cb] = hexToRgb(face.color);
  const [tr, tg, tb] = face.connected ? INK : MUTED;

  // Jack body
  doc.setDrawColor(face.connected ? cr : MUTED[0], face.connected ? cg : MUTED[1], face.connected ? cb : MUTED[2]);
  doc.setLineWidth(0.4);
  if (!face.connected) doc.setLineDashPattern([0.8, 0.6], 0);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(jackX, y, jackW, JACK_H, 1, 1, "FD");
  doc.setLineDashPattern([], 0);

  // Signal color chip
  doc.setFillColor(cr, cg, cb);
  doc.roundedRect(jackX, y, 1.4, JACK_H, 0.6, 0.6, "F");

  // Connector label (centered)
  doc.setFont("Inter", "normal");
  doc.setFontSize(6);
  doc.setTextColor(tr, tg, tb);
  const connText = trunc(face.connector || "", Math.max(4, cellCharW - 4));
  if (connText) doc.text(connText, cx, y + JACK_H / 2 + 1, { align: "center" });

  // Side label R/F
  if (sideLabel) {
    doc.setFont("Inter", "bold");
    doc.setFontSize(5.5);
    doc.text(sideLabel, jackX + 2.5, y + JACK_H - 1.4);
    doc.setFont("Inter", "normal");
  }
  // Gender badge
  if (face.gender && face.gender !== "—") {
    doc.setFont("Inter", "bold");
    doc.setFontSize(6);
    doc.text(face.gender, jackX + jackW - 1.5, y + JACK_H - 1.4, { align: "right" });
    doc.setFont("Inter", "normal");
  }

  // Remote device
  doc.setFontSize(6);
  doc.setTextColor(tr, tg, tb);
  doc.text(face.connected ? trunc(face.remoteDevice || "—", cellCharW) : "frei", cx, y + JACK_H + 3, { align: "center" });

  // Remote port · cable id
  const line2 = [face.remotePort, face.cableId].filter(Boolean).join(" · ");
  if (face.connected && line2) {
    doc.setFontSize(5.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(trunc(line2, cellCharW + 2), cx, y + JACK_H + 6.4, { align: "center" });
  }
}

export async function renderPatchPanelDiagramPdf(
  layout: ReportLayout,
  titleBlock: TitleBlock,
  panels: DiagramPanel[],
  filename: string,
): Promise<void> {
  const { widthMm, heightMm } = getPageDimensions(layout.paperSize, layout.orientation);
  const doc = new jsPDF({ orientation: layout.orientation, unit: "mm", format: layout.paperSize });
  await loadInterFont(doc);

  const contentW = widthMm - 2 * REPORT_MARGIN_MM;
  const topLimit = REPORT_MARGIN_MM + layout.headerHeightMm + 4;
  const bottomLimit = heightMm - REPORT_MARGIN_MM - layout.footerHeightMm - 2;

  drawGridBlock(doc, layout, titleBlock, "header", widthMm, 1, 1);
  let y = topLimit;

  const newPage = () => {
    doc.addPage();
    y = REPORT_MARGIN_MM + 6;
  };

  for (const panel of panels) {
    const cellH = (panel.hasPassthrough ? PORT_NUM_H + FACE_H * 2 + FACE_GAP : PORT_NUM_H + FACE_H) + 2;
    const cols = panel.columns;
    const cellW = Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, (contentW - (cols - 1) * CELL_GAP) / cols));
    const cellCharW = Math.max(6, Math.round(cellW / 1.7));
    const pct = panel.totalCount > 0 ? Math.round((panel.connectedCount / panel.totalCount) * 100) : 0;

    // Panel title (start a new page if it doesn't even fit a title + one row)
    if (y + 8 + cellH > bottomLimit) newPage();
    const drawPanelTitle = (contd: boolean) => {
      doc.setFont("Inter", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(panel.panel + (contd ? " (Cont'd)" : ""), REPORT_MARGIN_MM, y);
      doc.setFont("Inter", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${panel.panelRoom}   ·   ${panel.connectedCount}/${panel.totalCount} belegt (${pct}%)`, REPORT_MARGIN_MM, y + 4.5);
      y += 9;
    };
    drawPanelTitle(false);

    // Grid of ports, paginated per row.
    for (let rowIdx = 0; rowIdx < panel.rows; rowIdx++) {
      if (y + cellH > bottomLimit) {
        newPage();
        drawPanelTitle(true);
      }
      for (let col = 0; col < cols; col++) {
        const i = rowIdx * cols + col;
        if (i >= panel.ports.length) break;
        const port = panel.ports[i];
        const cx = REPORT_MARGIN_MM + col * (cellW + CELL_GAP);

        // Port number
        doc.setFont("Inter", "bold");
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(trunc(port.position, cellCharW), cx + cellW / 2, y + 3, { align: "center" });
        doc.setFont("Inter", "normal");

        const faceTop = y + PORT_NUM_H;
        if (port.passthrough) {
          drawFace(doc, port.rear!, cx, faceTop, cellW, cellCharW, "R");
          drawFace(doc, port.front!, cx, faceTop + FACE_H + FACE_GAP, cellW, cellCharW, "F");
        } else {
          drawFace(doc, port.face, cx, faceTop, cellW, cellCharW);
        }
      }
      y += cellH;
    }
    y += 6;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawGridBlock(doc, layout, titleBlock, "footer", widthMm, p, totalPages);
  }

  doc.save(filename);
}
