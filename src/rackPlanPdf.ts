import { jsPDF } from "jspdf";
import type { TitleBlock } from "./types";
import type { ReportLayout } from "./reportLayout";
import { getPageDimensions, REPORT_MARGIN_MM } from "./reportLayout";
import { loadInterFont, drawGridBlock } from "./reportPdf";
import type { RackPlanDevice, RackPlanRack } from "./rackPlan";

/**
 * PDF renderer for the cabinet / network rack plan. Mirrors the on-screen SVG
 * in `components/RackPlan.tsx` with jsPDF primitives; header/footer reuse the
 * shared report grid renderer.
 */

// ─── Geometry (mm) ───
const GUTTER = 9;
const EAR_W = 3;
const JACK_W = 8;
const JACK_H = 5.5;
const FACE_PAD = 2;
const LABEL_LANE = 32;
const ROW_GAP = 2;
const DEVICE_HEAD = 3.5;

const FACE_BG: [number, number, number] = [31, 41, 55];
const EAR_BG: [number, number, number] = [55, 65, 81];
const EMPTY_JACK: [number, number, number] = [75, 85, 99];

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [31, 41, 55];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function trunc(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function faceHeight(dev: RackPlanDevice): number {
  return Math.max(6, dev.heightU * 5);
}
function hasLabels(dev: RackPlanDevice): boolean {
  return dev.ports.some((p) => p.connected);
}
function rowHeight(dev: RackPlanDevice): number {
  const head = dev.ports.length > 0 ? DEVICE_HEAD : 1;
  return head + faceHeight(dev) + (hasLabels(dev) ? LABEL_LANE : 0);
}
function uLabel(dev: RackPlanDevice): string {
  const top = dev.uPosition + dev.heightU - 1;
  return dev.heightU > 1 ? `${dev.uPosition}-${top}` : `${dev.uPosition}`;
}

function drawDevice(doc: jsPDF, dev: RackPlanDevice, xLeft: number, yTop: number, faceW: number) {
  const head = dev.ports.length > 0 ? DEVICE_HEAD : 1;
  const y = yTop + head;
  const fh = faceHeight(dev);
  const portsX = xLeft + EAR_W + FACE_PAD;

  // U position
  doc.setFont("Inter", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(uLabel(dev), xLeft - 1.5, y + fh / 2 + 1, { align: "right" });

  // Faceplate + ears
  doc.setFillColor(...FACE_BG);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.roundedRect(xLeft, y, faceW, fh, 0.8, 0.8, "FD");
  doc.setFillColor(...EAR_BG);
  for (const ex of [xLeft, xLeft + faceW - EAR_W]) {
    doc.roundedRect(ex, y, EAR_W, fh, 0.5, 0.5, "F");
    doc.setFillColor(17, 24, 39);
    doc.circle(ex + EAR_W / 2, y + 1.4, 0.4, "F");
    doc.circle(ex + EAR_W / 2, y + fh - 1.4, 0.4, "F");
    doc.setFillColor(...EAR_BG);
  }
  // Accent stripe
  const [ar, ag, ab] = hexToRgb(dev.color);
  doc.setFillColor(ar, ag, ab);
  doc.rect(xLeft + EAR_W, y + 0.5, 0.9, fh - 1, "F");

  if (dev.ports.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(229, 231, 235);
    doc.text(trunc(dev.label, Math.floor(faceW / 2)), xLeft + faceW / 2, y + fh / 2 + 1, { align: "center" });
    return;
  }

  // Device label above the ports
  doc.setFont("Inter", "bold");
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`${trunc(dev.label, 46)}   ${dev.connectedCount}/${dev.ports.length}`, portsX, y - 1.2);
  doc.setFont("Inter", "normal");

  const labelTop = y + fh + 1.5;
  dev.ports.forEach((p, i) => {
    const jx = portsX + i * JACK_W;
    const jackY = y + (fh - JACK_H) / 2;
    if (p.connected) {
      const [r, g, b] = hexToRgb(p.color);
      doc.setFillColor(r, g, b);
      doc.setDrawColor(15, 23, 42);
    } else {
      doc.setFillColor(...EMPTY_JACK);
      doc.setDrawColor(55, 65, 81);
    }
    doc.setLineWidth(0.2);
    doc.roundedRect(jx + 0.6, jackY, JACK_W - 1.2, JACK_H, 0.6, 0.6, "FD");

    // Port number
    doc.setFontSize(5.5);
    doc.setTextColor(p.connected ? 255 : 156, p.connected ? 255 : 163, p.connected ? 255 : 175);
    doc.text(trunc(p.position, 4), jx + JACK_W / 2, jackY + JACK_H / 2 + 1, { align: "center" });

    // Vertical destination + cable-ID label
    if (p.connected) {
      const label = [p.cableId, [p.remoteRoom, p.remoteDevice].filter(Boolean).join(" · "), p.remotePort]
        .filter(Boolean)
        .join("  ");
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);
      doc.text(trunc(label, Math.floor(LABEL_LANE / 1.7)), jx + JACK_W / 2 + 1.8, labelTop, { angle: -90 });
    }
  });
}

export async function renderRackPlanPdf(
  layout: ReportLayout,
  titleBlock: TitleBlock,
  racks: RackPlanRack[],
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
  let firstOnPage = true;

  const newPage = () => {
    doc.addPage();
    y = REPORT_MARGIN_MM + 6;
    firstOnPage = true;
  };

  for (const rack of racks) {
    const maxPorts = Math.max(8, ...rack.devices.map((d) => d.ports.length));
    const faceW = Math.min(contentW - GUTTER, EAR_W * 2 + FACE_PAD * 2 + maxPorts * JACK_W);
    const usedU = rack.devices.reduce((s, d) => s + d.heightU, 0);

    if (!firstOnPage && y + 12 > bottomLimit) newPage();

    // Rack title
    doc.setFont("Inter", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(rack.label, REPORT_MARGIN_MM, y + 3);
    doc.setFont("Inter", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text([rack.room, `${rack.heightU} HE`, `${usedU} HE belegt`].filter(Boolean).join("   ·   "), REPORT_MARGIN_MM, y + 7.5);
    y += 11;
    firstOnPage = false;

    for (const dev of rack.devices) {
      const rh = rowHeight(dev) + ROW_GAP;
      if (y + rh > bottomLimit) {
        newPage();
        // Repeat a light rack caption so the continuation is identifiable.
        doc.setFont("Inter", "bold");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${rack.label} (Forts.)`, REPORT_MARGIN_MM, y + 2);
        doc.setFont("Inter", "normal");
        y += 6;
      }
      drawDevice(doc, dev, REPORT_MARGIN_MM + GUTTER, y, faceW);
      y += rh;
    }
    y += 5;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawGridBlock(doc, layout, titleBlock, "footer", widthMm, p, totalPages);
  }

  doc.save(filename);
}
