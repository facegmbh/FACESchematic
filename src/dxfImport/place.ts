/**
 * Where a DXF goes on the sheet — kept apart from the importer so the toolbar can use it
 * without pulling the parser and the renderer into its own bundle.
 */
import { FLOORPLAN_SCALES } from "../floorplan";

/** Building scales first, then the ones a site plan needs. */
const DXF_SCALES = [...FLOORPLAN_SCALES, 1000, 2000, 5000];

/** How much of the drawing area a plan may fill when the scale is chosen for it: the legend
 *  and the drawing block live in that area too. */
const COMFORTABLE_FILL = 0.9;

export interface DxfPlacement {
  scaleDenominator: number;
  positionMm: { x: number; y: number };
  sizeMm: { w: number; h: number };
  /** Whether the drawing fits the drawing area at that scale. */
  fits: boolean;
}

/**
 * Where a DXF goes on the sheet, and at what scale.
 *
 * The page's own scale wins whenever the drawing fits at it — the planner chose it. When it
 * does not, the first standard scale at which it fits with room to spare is taken. That
 * choice is only made on a page without devices: changing the scale under placed symbols
 * would move every device off the spot it belongs on, so there the scale stays and the
 * caller says the drawing is too large.
 */
export function placeDxfOnSheet(
  size: { widthPx: number; heightPx: number; mmPerPx: number },
  area: { x: number; y: number; w: number; h: number },
  currentScale: number,
  mayChangeScale: boolean,
): DxfPlacement {
  const paper = (scale: number) => ({
    w: (size.widthPx * size.mmPerPx) / scale,
    h: (size.heightPx * size.mmPerPx) / scale,
  });
  const fitsWithin = (scale: number, fraction: number) => {
    const p = paper(scale);
    return p.w <= area.w * fraction && p.h <= area.h * fraction;
  };

  let scale = currentScale;
  if (mayChangeScale && !fitsWithin(currentScale, 1)) {
    scale = DXF_SCALES.find((s) => s >= currentScale && fitsWithin(s, COMFORTABLE_FILL))
      ?? DXF_SCALES[DXF_SCALES.length - 1];
  }
  const sizeMm = paper(scale);
  return {
    scaleDenominator: scale,
    sizeMm,
    positionMm: { x: area.x + (area.w - sizeMm.w) / 2, y: area.y + (area.h - sizeMm.h) / 2 },
    fits: fitsWithin(scale, 1),
  };
}
