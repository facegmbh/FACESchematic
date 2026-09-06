/**
 * Wi-Fi coverage: from an access point's radio and the building's walls to a signal level
 * on the plan.
 *
 * The model is the one indoor planning actually uses — a log-distance path loss with an
 * explicit wall term:
 *
 *     RSSI = txDbm + gainDbi − ( PL₀ + 10·n·log₁₀(d) + Σ wall losses )
 *     PL₀  = 20·log₁₀(f_MHz) − 27.55        (free space at 1 m)
 *
 * `n` is the path-loss exponent: 2.0 in free space, ~2.6 in a normal office, ~3.2 in a
 * subdivided or cluttered building. After the walls it is the biggest lever on the result,
 * which is why it is a page setting rather than a constant.
 *
 * Walls are crossed by ray casting: the straight line from the AP to the point is
 * intersected against every wall segment, and each crossing adds its material's loss.
 * A wall is a plane, not a volume — a ray at a shallow angle really does travel through
 * more material, but modelling that needs a wall footprint rather than a centre line, and
 * the honest simplification is one crossing, one loss.
 *
 * The numbers will not match Ubiquiti's Design Center exactly. That tool uses its own
 * calibrated model and the real antenna patterns of its access points; this one assumes
 * an omnidirectional radiator. It is a planning aid, not a clone — and the material table
 * is overridable per project precisely so it can be corrected by measurement.
 */

import {
  WALL_MATERIAL_DEFAULTS,
  WIFI_BAND_ATTENUATION_FACTOR,
  WIFI_BAND_MHZ,
  RSSI_STEPS,
  type FloorplanWall,
  type WallMaterial,
  type WallMaterialSpec,
  type WifiBand,
  type WifiRadioSpec,
} from "./types";
import { paperMmToRealMm, type Vec2 } from "./floorplan";

/** Free-space path loss at one metre, in dB. */
export function freeSpaceRefDb(band: WifiBand): number {
  return 20 * Math.log10(WIFI_BAND_MHZ[band]) - 27.55;
}

/** The attenuation table in force: the project's measured values where it has them,
 *  the calibrated defaults elsewhere. */
export function wallMaterialSpec(
  material: WallMaterial,
  overrides?: Partial<Record<WallMaterial, WallMaterialSpec>>,
): WallMaterialSpec {
  return overrides?.[material] ?? WALL_MATERIAL_DEFAULTS[material];
}

/**
 * What one wall costs, in dB: a fixed surface term plus a thickness term, scaled to the
 * band. Thickness is real millimetres — the number off the architect's plan.
 */
export function wallAttenuationDb(
  wall: Pick<FloorplanWall, "material" | "thicknessMm">,
  band: WifiBand,
  overrides?: Partial<Record<WallMaterial, WallMaterialSpec>>,
): number {
  const spec = wallMaterialSpec(wall.material, overrides);
  const cm = Math.max(0, wall.thicknessMm) / 10;
  const at5 = spec.baseDb + spec.perCmDb * cm;
  return Math.max(0, at5 * WIFI_BAND_ATTENUATION_FACTOR[band]);
}

/** Do segments p→q and a→b cross? Proper intersection only: a ray that merely touches a
 *  wall's endpoint is not counted twice, which matters where two wall runs meet. */
export function segmentsCross(p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean {
  const d1 = cross(q.x - p.x, q.y - p.y, a.x - p.x, a.y - p.y);
  const d2 = cross(q.x - p.x, q.y - p.y, b.x - p.x, b.y - p.y);
  const d3 = cross(b.x - a.x, b.y - a.y, p.x - a.x, p.y - a.y);
  const d4 = cross(b.x - a.x, b.y - a.y, q.x - a.x, q.y - a.y);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Total wall loss along the straight line from `from` to `to`, in dB. */
export function wallLossAlongDb(
  from: Vec2,
  to: Vec2,
  walls: readonly FloorplanWall[],
  band: WifiBand,
  overrides?: Partial<Record<WallMaterial, WallMaterialSpec>>,
): number {
  let total = 0;
  for (const wall of walls) {
    if (wall.hidden) continue;
    const pts = wall.pointsMm;
    for (let i = 1; i < pts.length; i++) {
      if (segmentsCross(from, to, pts[i - 1], pts[i])) {
        total += wallAttenuationDb(wall, band, overrides);
      }
    }
  }
  return total;
}

/** One placed access point, as the heatmap needs it. */
export interface AccessPointPlacement {
  /** Where it sits on the sheet, in paper mm. */
  positionMm: Vec2;
  /** Conducted power in dBm for the band being drawn. */
  txDbm: number;
  /** Antenna gain in dBi for that band. */
  gainDbi: number;
  /** For labelling the strongest-AP map. */
  id?: string;
}

/** Transmit power and gain for a band, from a model's radio spec. Falls back to a plain
 *  indoor AP so a template without a spec still plots something sane. */
export function radioForBand(
  spec: WifiRadioSpec | undefined,
  band: WifiBand,
): { txDbm: number; gainDbi: number; supported: boolean } {
  const supported = Boolean(spec?.bands.includes(band));
  return {
    txDbm: spec?.txDbm[band] ?? 20,
    gainDbi: spec?.gainDbi[band] ?? 3,
    supported,
  };
}

/**
 * Signal level in dBm at a point from one access point.
 *
 * Distances are measured in the building: paper mm are converted through the page's
 * drawing scale, so re-scaling a plan never changes its coverage.
 */
export function rssiAtDbm(
  ap: AccessPointPlacement,
  at: Vec2,
  opts: {
    band: WifiBand;
    scaleDenominator: number;
    pathLossExponent: number;
    walls?: readonly FloorplanWall[];
    materialOverrides?: Partial<Record<WallMaterial, WallMaterialSpec>>;
  },
): number {
  const paperDist = Math.hypot(at.x - ap.positionMm.x, at.y - ap.positionMm.y);
  const metres = paperMmToRealMm(paperDist, opts.scaleDenominator) / 1000;
  // Inside a metre of the antenna the far-field model stops meaning anything; clamping
  // there keeps the centre of the map from going to +∞ instead of producing a hot dot.
  const d = Math.max(1, metres);
  const loss =
    freeSpaceRefDb(opts.band) +
    10 * opts.pathLossExponent * Math.log10(d) +
    (opts.walls?.length
      ? wallLossAlongDb(ap.positionMm, at, opts.walls, opts.band, opts.materialOverrides)
      : 0);
  return ap.txDbm + ap.gainDbi - loss;
}

/** The best signal any of the access points delivers at a point — what a client actually
 *  associates with, and therefore what a coverage map has to show. */
export function bestRssiDbm(
  aps: readonly AccessPointPlacement[],
  at: Vec2,
  opts: Parameters<typeof rssiAtDbm>[2],
): number {
  let best = -Infinity;
  for (const ap of aps) {
    const v = rssiAtDbm(ap, at, opts);
    if (v > best) best = v;
  }
  return best;
}

/** The distance in metres at which this AP still delivers `targetDbm` with no walls in
 *  the way — the free-run radius, useful as a first sanity check on AP spacing. */
export function rangeForRssiM(
  ap: Pick<AccessPointPlacement, "txDbm" | "gainDbi">,
  targetDbm: number,
  band: WifiBand,
  pathLossExponent: number,
): number {
  const budget = ap.txDbm + ap.gainDbi - targetDbm - freeSpaceRefDb(band);
  if (pathLossExponent <= 0) return 0;
  return Math.pow(10, budget / (10 * pathLossExponent));
}

/**
 * The radius a coverage circle for this access point should start at: its free run to
 * −60 dBm, a good signal rather than the −67 dBm floor.
 *
 * Deliberately tied to the page's path-loss exponent, so the circle shrinks by itself
 * once someone tells the plan it is a cluttered building — a U7 Pro goes from ~24 m in an
 * open hall to ~13 m at n = 3.2. It ignores walls entirely; the heatmap is what accounts
 * for those, and this is only meant as the quick visual.
 */
export function planningRadiusM(
  spec: WifiRadioSpec | undefined,
  band: WifiBand,
  pathLossExponent: number,
): number {
  const radio = radioForBand(spec, band);
  return rangeForRssiM(radio, -60, band, pathLossExponent);
}

/** The colour a level is drawn in. */
export function rssiColor(dbm: number): string {
  for (const step of RSSI_STEPS) {
    if (dbm >= step.minDbm) return step.color;
  }
  return RSSI_STEPS[RSSI_STEPS.length - 1].color;
}

/**
 * The access points on a plan, ready for the heatmap.
 *
 * A symbol counts as an AP when the device it links to resolves to a model with a radio
 * spec — so dropping a U7 Pro on the plan is all it takes. Symbols on a switched-off
 * layer are left out: a hidden layer is not part of the picture, and its APs are not
 * part of the coverage either.
 */
export function collectAccessPoints(
  page: {
    symbols: readonly { id: string; groupId: string; positionMm: Vec2; deviceNodeId?: string }[];
    groups: readonly { id: string; hidden?: boolean }[];
  },
  band: WifiBand,
  resolveWifi: (deviceNodeId: string) => WifiRadioSpec | undefined,
): AccessPointPlacement[] {
  const out: AccessPointPlacement[] = [];
  for (const symbol of page.symbols) {
    if (!symbol.deviceNodeId) continue;
    const group = page.groups.find((g) => g.id === symbol.groupId);
    if (group?.hidden) continue;
    const spec = resolveWifi(symbol.deviceNodeId);
    // No radio for this band is not "weak" — the AP simply is not on the air there.
    if (!spec || !spec.bands.includes(band)) continue;
    const radio = radioForBand(spec, band);
    out.push({ id: symbol.id, positionMm: { ...symbol.positionMm }, txDbm: radio.txDbm, gainDbi: radio.gainDbi });
  }
  return out;
}

/** A computed heatmap: `dbm[y * cols + x]`, with the grid's origin and pitch in paper mm. */
export interface HeatmapGrid {
  cols: number;
  rows: number;
  /** Paper mm between samples. */
  pitchMm: number;
  originMm: Vec2;
  dbm: Float32Array;
}

/**
 * Sample the best signal over a rectangle of the sheet.
 *
 * Cost is cols × rows × APs × wall segments, so the pitch is the knob that decides
 * whether this is instant or sluggish; the caller owns it. An A1 sheet at 2.5 mm is about
 * 130k samples, which is a few hundred milliseconds with a handful of APs and walls.
 */
export function computeHeatmap(
  aps: readonly AccessPointPlacement[],
  area: { x: number; y: number; w: number; h: number },
  opts: Parameters<typeof rssiAtDbm>[2] & { pitchMm: number },
): HeatmapGrid {
  const pitch = Math.max(0.5, opts.pitchMm);
  const cols = Math.max(1, Math.ceil(area.w / pitch) + 1);
  const rows = Math.max(1, Math.ceil(area.h / pitch) + 1);
  const dbm = new Float32Array(cols * rows);
  const origin = { x: area.x, y: area.y };

  if (aps.length === 0) {
    dbm.fill(-Infinity);
    return { cols, rows, pitchMm: pitch, originMm: origin, dbm };
  }

  for (let r = 0; r < rows; r++) {
    const y = origin.y + r * pitch;
    for (let c = 0; c < cols; c++) {
      dbm[r * cols + c] = bestRssiDbm(aps, { x: origin.x + c * pitch, y }, opts);
    }
  }
  return { cols, rows, pitchMm: pitch, originMm: origin, dbm };
}

/** Share of samples at or above a level — the "how much of the floor is covered" number
 *  a report wants. Samples with no AP at all count as not covered. */
export function coveredFraction(grid: HeatmapGrid, minDbm: number): number {
  if (grid.dbm.length === 0) return 0;
  let hit = 0;
  for (let i = 0; i < grid.dbm.length; i++) {
    if (grid.dbm[i] >= minDbm) hit++;
  }
  return hit / grid.dbm.length;
}
