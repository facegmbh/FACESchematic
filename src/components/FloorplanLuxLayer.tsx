import { useEffect, useMemo, useRef } from "react";
import { computeLuxGrid, luxColor, type LuminairePlacement } from "../lightSim";
import { drawingAreaMm } from "../floorplan";
import { DEFAULT_LIGHT_CALC, type FloorplanPage } from "../types";

/** Unter den Wänden und den Symbolen — das Lux-Raster ist der Boden, auf dem der Plan
 *  liegt, nicht etwas, das über die Technik gelegt wird. Dieselbe Ebene wie die
 *  WLAN-Heatmap: beide sind nie gleichzeitig an, weil ein Plan einen Typ hat. */
const LUX_Z = 6;

interface Props {
  page: FloorplanPage;
  mmToPx: (mm: number) => number;
  luminaires: readonly LuminairePlacement[];
}

/**
 * Das Lux-Raster als Falschfarbenbild.
 *
 * Canvas statt SVG, aus demselben Grund wie bei der WLAN-Heatmap: das ist von Natur aus
 * ein Raster — Zehntausende Stützstellen, jede eine farbige Zelle — und ein SVG-Rechteck
 * je Stützstelle wäre ein Dokument, kein Bild. Gerechnet wird auf der Schrittweite der
 * Seite und eine Stufe größer gezeichnet, damit das Ergebnis als Verlauf liest.
 *
 * Neu gerechnet wird, sobald sich eine Leuchte bewegt, die Nutzebene sich ändert oder
 * jemand dimmt. Das ist Absicht: ein zwischengespeichertes Bild, das dem Plan hinterher
 * hinkt, ist schlechter als gar keines — es lädt dazu ein, auf ein Bild hin zu
 * entscheiden, das nicht mehr stimmt.
 */
export default function FloorplanLuxLayer({ page, mmToPx, luminaires }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cfg = { ...DEFAULT_LIGHT_CALC, ...(page.light ?? {}) };

  // Der Zeichenbereich innerhalb der Blattränder — das Raster hat über dem Rahmen, der
  // Legende und dem Plankopf nichts verloren.
  const area = useMemo(() => drawingAreaMm(page), [page]);

  const grid = useMemo(() => {
    if (!cfg.visible || luminaires.length === 0) return null;
    return computeLuxGrid(luminaires, area, {
      scaleDenominator: page.scaleDenominator,
      workPlaneMm: cfg.workPlaneMm,
      maintenanceFactor: cfg.maintenanceFactor,
      pitchMm: cfg.gridMm,
    });
  }, [
    cfg.visible, cfg.workPlaneMm, cfg.maintenanceFactor, cfg.gridMm,
    luminaires, area, page.scaleDenominator,
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

    // Ein Pixel je Stützstelle in eine Bitmap malen und den Browser glatt hochskalieren
    // lassen: schneller und schöner, als je Stützstelle ein Rechteck in Endgröße zu füllen.
    canvas.width = grid.cols;
    canvas.height = grid.rows;
    const img = ctx.createImageData(grid.cols, grid.rows);
    for (let i = 0; i < grid.lux.length; i++) {
      const lux = grid.lux[i];
      const o = i * 4;
      // Unter einem Lux ist nichts mehr zu sehen und nichts mehr zu entscheiden — dort
      // bleibt die Zeichnung des Architekten frei statt unter einem dunklen Schleier.
      if (!Number.isFinite(lux) || lux < 1) {
        img.data[o + 3] = 0;
        continue;
      }
      const [r, g, b] = hexToRgb(luxColor(lux));
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
        zIndex: LUX_Z,
        pointerEvents: "none",
        // Interpolieren lassen: die Stützstellen sind ein Messraster, keine Pixel, die
        // für sich etwas bedeuten.
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
