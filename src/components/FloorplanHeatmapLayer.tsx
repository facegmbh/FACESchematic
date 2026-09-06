import { useEffect, useMemo, useRef } from "react";
import { computeHeatmap, rssiColor, type AccessPointPlacement } from "../wifiCoverage";
import { drawingAreaMm } from "../floorplan";
import {
  DEFAULT_HEATMAP,
  type FloorplanPage,
  type WallMaterial,
  type WallMaterialSpec,
} from "../types";

/** Under the walls and the symbols — the heatmap is the ground the plan sits on, not
 *  something laid over the equipment. */
const HEATMAP_Z = 6;

interface Props {
  page: FloorplanPage;
  mmToPx: (mm: number) => number;
  aps: readonly AccessPointPlacement[];
  materialOverrides?: Partial<Record<WallMaterial, WallMaterialSpec>>;
}

/**
 * The Wi-Fi heatmap.
 *
 * A canvas rather than SVG: this is a raster by nature — tens of thousands of samples,
 * each a coloured cell — and an SVG rect per sample would be a document, not a picture.
 * The grid is computed at the page's pitch and then drawn one image-smoothed step up, so
 * the result reads as a gradient instead of as tiles.
 *
 * The whole thing is recomputed whenever an access point moves, a wall changes or the
 * band is switched. That is deliberate: a cached heatmap that lags the plan is worse than
 * no heatmap, because it invites a decision on a picture that is no longer true.
 */
export default function FloorplanHeatmapLayer({ page, mmToPx, aps, materialOverrides }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cfg = { ...DEFAULT_HEATMAP, ...(page.heatmap ?? {}) };

  // The drawing area inside the sheet margins — the heatmap has no business over the
  // border, the legend or the title block.
  const area = useMemo(() => drawingAreaMm(page), [page]);

  const grid = useMemo(() => {
    if (!cfg.visible || aps.length === 0) return null;
    return computeHeatmap(aps, area, {
      band: cfg.band,
      scaleDenominator: page.scaleDenominator,
      pathLossExponent: cfg.pathLossExponent,
      walls: page.walls ?? [],
      materialOverrides,
      pitchMm: cfg.gridMm,
    });
  }, [
    cfg.visible, cfg.band, cfg.pathLossExponent, cfg.gridMm,
    aps, area, page.scaleDenominator, page.walls, materialOverrides,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!grid) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Paint one pixel per sample into an offscreen bitmap, then let the browser scale it
    // up smoothly. Drawing at grid resolution and stretching is both faster and better
    // looking than filling one rect per sample at final size.
    canvas.width = grid.cols;
    canvas.height = grid.rows;
    const img = ctx.createImageData(grid.cols, grid.rows);
    for (let i = 0; i < grid.dbm.length; i++) {
      const dbm = grid.dbm[i];
      const o = i * 4;
      if (!Number.isFinite(dbm)) {
        img.data[o + 3] = 0; // no access point reaches here at all
        continue;
      }
      const [r, g, b] = hexToRgb(rssiColor(dbm));
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [grid]);

  if (!cfg.visible || !grid) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute"
      style={{
        left: mmToPx(grid.originMm.x),
        top: mmToPx(grid.originMm.y),
        width: mmToPx((grid.cols - 1) * grid.pitchMm),
        height: mmToPx((grid.rows - 1) * grid.pitchMm),
        opacity: cfg.opacity,
        zIndex: HEATMAP_Z,
        pointerEvents: "none",
        // Let the browser interpolate: the samples are a measurement grid, not pixels
        // that mean anything on their own.
        imageRendering: "auto",
      }}
    />
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
