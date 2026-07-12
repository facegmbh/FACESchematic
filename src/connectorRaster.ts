import type { ReactElement } from "react";
import type { ConnectorType } from "./types";
import { getConnectorSpec } from "./components/connectorIcons";

/**
 * Rasterize a connector icon to a PNG data URL for embedding in the PDF rack
 * plan, so the printed ports show the exact same connector shapes as the
 * on-screen SVG. Browser-only (uses the DOM canvas). `react-dom/server` is
 * loaded lazily so it never weighs down the main bundle.
 *
 * Results are cached by connectorType + color + detail: a plan has only a
 * handful of distinct combinations even across hundreds of ports.
 */

export interface RasterizedConnector {
  dataUrl: string;
  /** Aspect ratio (width / height) of the connector's mm footprint. */
  aspect: number;
}

const cache = new Map<string, RasterizedConnector>();

/** Pixels per mm used when rasterizing — high enough to stay crisp when scaled in the PDF. */
const RASTER_PX_PER_MM = 12;

export async function rasterizeConnector(
  connectorType: ConnectorType | undefined,
  color: string,
  detail = 2,
): Promise<RasterizedConnector> {
  const key = `${connectorType ?? "none"}|${color}|${detail}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const spec = getConnectorSpec(connectorType);
  const padMm = 1;
  const wMm = spec.widthMm + padMm * 2;
  const hMm = spec.heightMm + padMm * 2;
  const wPx = Math.ceil(wMm * RASTER_PX_PER_MM);
  const hPx = Math.ceil(hMm * RASTER_PX_PER_MM);

  const { renderToStaticMarkup } = await import("react-dom/server");
  const inner = renderToStaticMarkup(
    spec.render({ color, detail, strokeWidth: 0.6 }) as ReactElement,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${hPx}" viewBox="${-wMm / 2} ${-hMm / 2} ${wMm} ${hMm}">${inner}</svg>`;

  const dataUrl = await svgToPng(svg, wPx, hPx);
  const result: RasterizedConnector = { dataUrl, aspect: spec.widthMm / spec.heightMm };
  cache.set(key, result);
  return result;
}

function svgToPng(svg: string, wPx: number, hPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = wPx;
      canvas.height = hPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2D canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, wPx, hPx);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Connector SVG rasterization failed"));
    img.src = url;
  });
}
