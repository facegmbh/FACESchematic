/** Grid size in px — must match snapGrid in App.tsx and Background gap.
 *  Lives in its own module so utility files (snapUtils, etc.) can import it
 *  without pulling in the full store, which would create a circular import
 *  the moment the store wants to call back into those utilities.
 *
 *  16 since schema v41 (was 20). Port row pitch, header-band rounding, and the
 *  routing CELL_SIZE all derive from this; saved files from the 20px era are
 *  rescaled x0.8 on load (exact: every 20-multiple maps onto a 16-multiple).
 *  16 is the floor — cable-ID badges are ~13px tall and stack at port pitch. */
export const GRID_SIZE = 16;

/** Default rendered width of a device node, in px. Must stay a multiple of
 *  GRID_SIZE so the right-edge handle column lands on the routing grid (same
 *  reason the value is grid-aligned since v41). React Flow measures the real
 *  DOM width on render, so this is the single source of truth for the device
 *  body width — every `?? DEVICE_NODE_WIDTH` elsewhere is only a
 *  pre-measurement / headless fallback.
 *  11×16 = 176 (was 9×16 = 144) — widened for label legibility. */
export const DEVICE_NODE_WIDTH = 11 * GRID_SIZE;
