import { jsPDF } from "jspdf";
import type { TitleBlock } from "./types";
import type { ReportLayout } from "./reportLayout";
import { getPageDimensions, REPORT_MARGIN_MM } from "./reportLayout";
import { loadInterFont, drawGridBlock } from "./reportPdf";
import { rasterizeConnector, type RasterizedConnector } from "./connectorRaster";
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
const NUM_H = 2.6;
const HOUSING_H = 5.5;
const CHIP_H = 0.9;
const FACE_PAD = 2;
const LABEL_LANE = 32;
const ROW_GAP = 2;
const DEVICE_HEAD = 3.5;

/** Icon colors (mirror RackPlan.tsx): light "metal" when connected, muted when free. */
const ICON_CONNECTED = "#e5e7eb";
const ICON_FREE = "#64748b";

const FACE_BG: [number, number, number] = [17, 24, 39];
const EAR_BG: [number, number, number] = [55, 65, 81];
const HOUSING_BG: [number, number, number] = [11, 18, 32];
const HOUSING_STROKE: [number, number, number] = [51, 65, 85];

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
  if (dev.ports.length > 0) return Math.max(NUM_H + HOUSING_H + CHIP_H + 1.5, dev.heightU * 5);
  return Math.max(6, dev.heightU * 5);
}

/** Cache key for a rasterized connector (mirrors icon color choice in drawDevice). */
function rasterKey(connectorType: string | undefined, connected: boolean): string {
  return `${connectorType ?? "none"}|${connected ? ICON_CONNECTED : ICON_FREE}`;
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

function drawDevice(
  doc: jsPDF,
  dev: RackPlanDevice,
  xLeft: number,
  yTop: number,
  faceW: number,
  rasters: Map<string, RasterizedConnector>,
) {
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
  const housingY = y + NUM_H;
  const housingW = JACK_W - 1.2;
  dev.ports.forEach((p, i) => {
    const jx = portsX + i * JACK_W;
    const jcx = jx + JACK_W / 2;

    // Port number on the faceplate
    doc.setFontSize(5);
    doc.setTextColor(203, 213, 225);
    doc.text(trunc(p.position, 4), jcx, y + NUM_H / 2 + 1, { align: "center" });

    // Jack cutout
    doc.setFillColor(...HOUSING_BG);
    doc.setDrawColor(...HOUSING_STROKE);
    doc.setLineWidth(0.2);
    doc.roundedRect(jx + 0.6, housingY, housingW, HOUSING_H, 0.5, 0.5, "FD");

    // Real connector icon (rasterized), fit inside the cutout preserving aspect
    const raster = rasters.get(rasterKey(p.connectorType, p.connected));
    if (raster) {
      const availW = housingW - 1.2;
      const availH = HOUSING_H - 1.2;
      let iw = availW;
      let ih = iw / raster.aspect;
      if (ih > availH) {
        ih = availH;
        iw = ih * raster.aspect;
      }
      doc.addImage(raster.dataUrl, "PNG", jcx - iw / 2, housingY + (HOUSING_H - ih) / 2, iw, ih);
    }

    // Signal-color label strip under the jack
    if (p.connected) {
      const [r, g, b] = hexToRgb(p.color);
      doc.setFillColor(r, g, b);
    } else {
      doc.setFillColor(51, 65, 85);
    }
    doc.rect(jx + 0.6, housingY + HOUSING_H + 0.4, housingW, CHIP_H, "F");

    // Vertical destination + cable-ID label
    if (p.connected) {
      const label = [p.cableId, [p.remoteRoom, p.remoteDevice].filter(Boolean).join(" · "), p.remotePort]
        .filter(Boolean)
        .join("  ");
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);
      doc.text(trunc(label, Math.floor(LABEL_LANE / 1.7)), jcx + 1.8, labelTop, { angle: -90 });
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

  // Pre-rasterize every distinct connector shape once (a plan has only a few).
  const rasters = new Map<string, RasterizedConnector>();
  const wanted = new Map<string, { connectorType: RackPlanRack["devices"][number]["ports"][number]["connectorType"]; connected: boolean }>();
  for (const rack of racks) {
    for (const dev of rack.devices) {
      for (const p of dev.ports) {
        const key = rasterKey(p.connectorType, p.connected);
        if (!wanted.has(key)) wanted.set(key, { connectorType: p.connectorType, connected: p.connected });
      }
    }
  }
  await Promise.all(
    Array.from(wanted.entries()).map(async ([key, { connectorType, connected }]) => {
      try {
        rasters.set(key, await rasterizeConnector(connectorType, connected ? ICON_CONNECTED : ICON_FREE, 2));
      } catch {
        /* fall back to an empty jack if rasterization is unavailable */
      }
    }),
  );

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
      drawDevice(doc, dev, REPORT_MARGIN_MM + GUTTER, y, faceW, rasters);
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
