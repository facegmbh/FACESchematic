/**
 * A DXF as a floorplan underlay: parsed, drawn, and placed on the sheet at its real size.
 *
 * What makes this worth having next to the PDF import is the scale. A plotted PDF knows its
 * paper but not the building, so it has to be calibrated against a known dimension. A DXF
 * states its unit, and with one drawing unit drawn as one pixel, a unit's worth in mm *is*
 * the underlay's mm per pixel — the plan arrives calibrated.
 */
import type { DxfUnit, PdfLayerChoice } from "../types";
import { MM_PER_DXF_UNIT, parseDxf } from "./parse";
import { renderDxfToSvg } from "./render";

/** Above this the drawing is rasterized rather than embedded as an SVG. A project lives in
 *  the browser's storage, which is a few megabytes for everything — one large site plan
 *  embedded as vectors would take all of it. */
export const MAX_INLINE_SVG_BYTES = 8_000_000;

export interface DxfRasterized {
  src: string;
  widthPx: number;
  heightPx: number;
}

export interface DxfImportOptions {
  /** Layer name → drawn or not. Layers left out keep the state the drawing gives them. */
  layers?: Record<string, boolean>;
  /** Overrides the drawing's own unit — for the drawing that does not state one. */
  unit?: DxfUnit;
  maxInlineSvgBytes?: number;
  /** Turns the SVG into pixels when it is too large to embed. Needs a canvas, so the app
   *  hands in its own; tests hand in a stand-in. */
  rasterizeSvg?: (src: string, width: number, height: number) => Promise<DxfRasterized>;
}

export interface DxfImportResult {
  src: string;
  widthPx: number;
  heightPx: number;
  /** Real-world mm per pixel of `src`. */
  mmPerPx: number;
  approxBytes: number;
  layers: PdfLayerChoice[];
  unit: DxfUnit;
  unitAssumed: boolean;
  rasterized: boolean;
  /** Entities not drawn, by type. */
  skipped: Record<string, number>;
}

/** A UTF-8 string as a base64 data URL. Chunked, because spreading a few megabytes into
 *  one String.fromCharCode call overflows the argument limit. */
function svgDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

export async function importDxf(text: string, options: DxfImportOptions = {}): Promise<DxfImportResult> {
  const drawing = await parseDxf(text);
  const unit = options.unit ?? drawing.unit;
  const unitAssumed = options.unit === undefined && drawing.unitAssumed;
  const mmPerUnit = MM_PER_DXF_UNIT[unit];

  const layers: PdfLayerChoice[] = drawing.layers.map((l) => ({
    id: l.name,
    name: l.name,
    visible: options.layers?.[l.name] ?? l.visible,
  }));
  const hiddenLayers = new Set(layers.filter((l) => !l.visible).map((l) => l.id));

  const rendered = renderDxfToSvg(drawing, { hiddenLayers });
  const src = svgDataUrl(rendered.svg);
  const bytes = rendered.svg.length;

  const base = {
    layers,
    unit,
    unitAssumed,
    skipped: rendered.skipped,
  };

  if (bytes > (options.maxInlineSvgBytes ?? MAX_INLINE_SVG_BYTES) && options.rasterizeSvg) {
    const raster = await options.rasterizeSvg(src, rendered.width, rendered.height);
    return {
      ...base,
      src: raster.src,
      widthPx: raster.widthPx,
      heightPx: raster.heightPx,
      // Fewer pixels than units: each pixel now covers that many units.
      mmPerPx: mmPerUnit * (rendered.width / raster.widthPx),
      approxBytes: Math.round((raster.src.length - raster.src.indexOf(",") - 1) * 0.75),
      rasterized: true,
    };
  }

  return {
    ...base,
    src,
    widthPx: rendered.width,
    heightPx: rendered.height,
    mmPerPx: mmPerUnit,
    approxBytes: bytes,
    rasterized: false,
  };
}

export { placeDxfOnSheet, type DxfPlacement } from "./place";
