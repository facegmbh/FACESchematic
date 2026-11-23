/**
 * Projector planning: how far a projector has to stand from its picture, what zoom and
 * lens shift that position needs, and how bright the picture ends up.
 *
 * The picture is the fixed point. Everything here answers "the projector is HERE — does
 * that work, and with what settings?", which is the question a plan is drawn to settle.
 * Pure functions only; the store, the sheet and the PDF all read the same results.
 */
import type {
  FloorplanProjection,
  ProjectionFormat,
  ProjectionOptics,
  ProjectionShiftRange,
} from "./types";

const INCH_M = 0.0254;
/** A lens without shift still tolerates the projector being a hair off-centre. */
const NO_SHIFT_TOLERANCE_PCT = 0.5;
/** Rounding slack so a position exactly on a limit is not reported as beyond it. */
const EPS_M = 0.0005;

export const PROJECTION_ASPECTS = ["16:10", "16:9", "4:3", "21:9"];

/** "16:10" → 1.6. Anything unreadable counts as 16:10, the commonest projector panel. */
export function parseAspect(aspect: string): number {
  const m = /^\s*([\d.]+)\s*[:/x]\s*([\d.]+)\s*$/.exec(aspect ?? "");
  const r = m ? Number(m[1]) / Number(m[2]) : NaN;
  return Number.isFinite(r) && r > 0 ? r : 1.6;
}

export interface PictureSize {
  widthM: number;
  heightM: number;
  diagonalIn: number;
}

/** The largest picture of the given shape that fits a surface. */
export function pictureSize(surfaceWidthM: number, surfaceHeightM: number, aspect: string): PictureSize {
  const r = parseAspect(aspect);
  const w = Math.max(0, surfaceWidthM);
  const h = Math.max(0, surfaceHeightM);
  const widthM = Math.min(w, h * r);
  const heightM = widthM / r;
  return { widthM, heightM, diagonalIn: Math.hypot(widthM, heightM) / INCH_M };
}

function formatFor(optics: ProjectionOptics, aspect: string): { format: ProjectionFormat; exact: boolean } | null {
  const formats = optics.formats ?? [];
  if (formats.length === 0) return null;
  const want = parseAspect(aspect);
  const hit = formats.find((f) => Math.abs(parseAspect(f.ratio) - want) < 0.005);
  return hit ? { format: hit, exact: true } : { format: formats[0], exact: false };
}

export interface ThrowRange {
  /** Nearest position (zoom fully wide) and farthest (fully tele), metres. */
  minM: number;
  maxM: number;
  /** Diagonal limits of the lens for this shape, inches. Absent for a typed throw ratio. */
  sizeMinIn?: number;
  sizeMaxIn?: number;
}

/**
 * Where the projector may stand for this picture. With manufacturer data this is their
 * own fit; a ratio the lens does not list is computed through its first format at equal
 * picture width, which is what the distance physically depends on.
 */
export function throwRangeM(optics: ProjectionOptics, aspect: string, picture: PictureSize): ThrowRange | null {
  const f = formatFor(optics, aspect);
  if (f) {
    const { format, exact } = f;
    const r = parseAspect(format.ratio);
    const diagonalIn = exact ? picture.diagonalIn : (picture.widthM * Math.hypot(r, 1)) / r / INCH_M;
    const at = ([a, b]: [number, number]) => (a * diagonalIn + b) / 100;
    const near = at(format.wide);
    const far = at(format.tele);
    return {
      minM: Math.max(0, Math.min(near, far)),
      maxM: Math.max(near, far),
      sizeMinIn: exact ? format.sizeMin : undefined,
      sizeMaxIn: exact ? format.sizeMax : undefined,
    };
  }
  const lo = optics.throwMin ?? optics.throwMax;
  const hi = optics.throwMax ?? optics.throwMin;
  if (!lo || !hi || lo <= 0 || hi <= 0) return null;
  return { minM: Math.min(lo, hi) * picture.widthM, maxM: Math.max(lo, hi) * picture.widthM };
}

/** The lens's shift limits, or null when it has none. */
function usableShift(shift: ProjectionShiftRange | undefined): ProjectionShiftRange | null {
  if (!shift) return null;
  const any = shift.vMin || shift.vMax || shift.hMin || shift.hMax;
  return any ? shift : null;
}

/** How much vertical shift is left with the picture `shiftH` percent to the side. */
export function maxVerticalShift(shift: ProjectionShiftRange, shiftH: number): { min: number; max: number } {
  const hLimit = shiftH < 0 ? Math.abs(shift.hMin) : Math.abs(shift.hMax);
  const t = hLimit > 0 ? Math.min(1, Math.abs(shiftH) / hLimit) : 0;
  // A lens with no separate figure for the corner keeps its full vertical range.
  const hvMin = shift.hvMin || shift.hvMax ? shift.hvMin : shift.vMin;
  const hvMax = shift.hvMin || shift.hvMax ? shift.hvMax : shift.vMax;
  return {
    min: shift.vMin + (hvMin - shift.vMin) * t,
    max: shift.vMax + (hvMax - shift.vMax) * t,
  };
}

export type ProjectionIssueKind =
  | "behind"
  | "too-near"
  | "too-far"
  | "too-small"
  | "too-large"
  | "shift-h"
  | "shift-v";

export interface ProjectionIssue {
  kind: ProjectionIssueKind;
  /** too-near / too-far: metres beyond the limit. */
  byM?: number;
  /** shift-*: the value needed and the limit it breaks, percent. too-small / too-large:
   *  the diagonal and its limit, inches. */
  value?: number;
  limit?: number;
}

export interface ProjectionSetup {
  optics: ProjectionOptics;
  aspect: string;
  widthM: number;
  heightM: number;
  /** Lens to picture plane, metres. */
  distanceM: number;
  /** Lens sideways of the picture's centre line, metres. */
  lateralM: number;
  screenBottomM?: number;
  lensHeightM?: number;
  screenGain?: number;
}

export interface ProjectionResult {
  picture: PictureSize;
  range: ThrowRange | null;
  /** 0 = fully wide, 1 = fully tele. Clamped; undefined without a range. */
  zoom?: number;
  /** Horizontal shift needed, percent of picture width. */
  shiftH: number;
  /** Vertical shift needed, percent of picture height — only when both heights are known. */
  shiftV?: number;
  /** Lens heights the vertical shift allows for this picture, metres above the floor. */
  lensHeightRangeM?: { min: number; max: number };
  areaM2: number;
  /** Illuminance on the picture: lumens × gain ÷ area. */
  lux?: number;
  issues: ProjectionIssue[];
}

export function evaluateProjection(setup: ProjectionSetup): ProjectionResult {
  const picture = pictureSize(setup.widthM, setup.heightM, setup.aspect);
  const range = throwRangeM(setup.optics, setup.aspect, picture);
  const issues: ProjectionIssue[] = [];
  const areaM2 = picture.widthM * picture.heightM;

  let zoom: number | undefined;
  if (setup.distanceM <= 0) {
    issues.push({ kind: "behind" });
  } else if (range) {
    const span = range.maxM - range.minM;
    zoom = span > 0 ? Math.min(1, Math.max(0, (setup.distanceM - range.minM) / span)) : 0;
    if (setup.distanceM < range.minM - EPS_M) issues.push({ kind: "too-near", byM: range.minM - setup.distanceM });
    else if (setup.distanceM > range.maxM + EPS_M) issues.push({ kind: "too-far", byM: setup.distanceM - range.maxM });
  }
  if (range?.sizeMinIn !== undefined && picture.diagonalIn < range.sizeMinIn - 0.05) {
    issues.push({ kind: "too-small", value: picture.diagonalIn, limit: range.sizeMinIn });
  }
  if (range?.sizeMaxIn !== undefined && picture.diagonalIn > range.sizeMaxIn + 0.05) {
    issues.push({ kind: "too-large", value: picture.diagonalIn, limit: range.sizeMaxIn });
  }

  const shift = usableShift(setup.optics.shift);
  const shiftH = picture.widthM > 0 ? (setup.lateralM / picture.widthM) * 100 : 0;
  const hLimit = shift ? (shiftH < 0 ? Math.abs(shift.hMin) : Math.abs(shift.hMax)) : 0;
  if (Math.abs(shiftH) > Math.max(hLimit, NO_SHIFT_TOLERANCE_PCT) + 0.05) {
    issues.push({ kind: "shift-h", value: shiftH, limit: hLimit });
  }

  let shiftV: number | undefined;
  let lensHeightRangeM: { min: number; max: number } | undefined;
  if (setup.screenBottomM !== undefined && picture.heightM > 0) {
    const centre = setup.screenBottomM + picture.heightM / 2;
    if (shift) {
      const v = maxVerticalShift(shift, Math.max(-hLimit, Math.min(hLimit, shiftH)));
      lensHeightRangeM = {
        min: centre - (v.max / 100) * picture.heightM,
        max: centre - (v.min / 100) * picture.heightM,
      };
    }
    if (setup.lensHeightM !== undefined) {
      shiftV = ((centre - setup.lensHeightM) / picture.heightM) * 100;
      // Without shift data the built-in offset of the lens is unknown, so nothing is
      // claimed about the mounting height.
      if (shift) {
        const v = maxVerticalShift(shift, Math.max(-hLimit, Math.min(hLimit, shiftH)));
        if (shiftV > v.max + 0.05) issues.push({ kind: "shift-v", value: shiftV, limit: v.max });
        else if (shiftV < v.min - 0.05) issues.push({ kind: "shift-v", value: shiftV, limit: Math.abs(v.min) });
      }
    }
  }

  const lumens = setup.optics.lumens;
  const lux = lumens && areaM2 > 0 ? (lumens * (setup.screenGain ?? 1)) / areaM2 : undefined;

  return { picture, range, zoom, shiftH, shiftV, lensHeightRangeM, areaM2, lux, issues };
}

type Sized = Pick<FloorplanProjection, "aspect" | "widthM" | "heightM" | "lockWidth" | "lockHeight">;

/**
 * Apply one edit to the surface the way the size fields behave: an unpinned side follows
 * the aspect ratio, a pinned one stays. With both pinned the surface is settled and a new
 * aspect ratio only changes how the picture sits in it.
 */
export function resizeSurface<T extends Sized>(
  p: T,
  edit: { widthM?: number; heightM?: number; diagonalIn?: number; aspect?: string },
): T {
  const aspect = edit.aspect ?? p.aspect;
  const r = parseAspect(aspect);
  let { widthM, heightM } = p;
  if (edit.diagonalIn !== undefined) {
    heightM = (edit.diagonalIn * INCH_M) / Math.hypot(r, 1);
    widthM = heightM * r;
  } else if (edit.widthM !== undefined) {
    widthM = edit.widthM;
    if (!p.lockHeight) heightM = widthM / r;
  } else if (edit.heightM !== undefined) {
    heightM = edit.heightM;
    if (!p.lockWidth) widthM = heightM * r;
  } else if (edit.aspect !== undefined) {
    if (p.lockWidth && p.lockHeight) {
      // settled
    } else if (p.lockHeight) widthM = heightM * r;
    else heightM = widthM / r;
  }
  return { ...p, aspect, widthM, heightM };
}

// ---------------------------------------------------------------------------
// On the sheet
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

function unit(deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

export interface ProjectionGeometry {
  /** Lens to picture plane and lens off the centre line, metres on site. */
  distanceM: number;
  lateralM: number;
  /** The lens — the symbol's position. */
  lensMm: Pt;
  /** Ends of the whole surface and of the picture on it. */
  surfaceMm: [Pt, Pt];
  pictureMm: [Pt, Pt];
  /** Nearest and farthest allowed lens position on the lens's own line, or null without
   *  a throw range. */
  bandMm: [Pt, Pt] | null;
  result: ProjectionResult;
}

/** Everything the sheet and the PDF draw for one projection, in paper mm. */
export function projectionGeometry(p: FloorplanProjection, symbolMm: Pt, scaleDenominator: number): ProjectionGeometry {
  const mmPerM = 1000 / scaleDenominator;
  const n = unit(p.screenRotationDeg);
  const t = { x: -n.y, y: n.x };
  const dx = symbolMm.x - p.screenCenterMm.x;
  const dy = symbolMm.y - p.screenCenterMm.y;
  const distanceM = (dx * n.x + dy * n.y) / mmPerM;
  const lateralM = (dx * t.x + dy * t.y) / mmPerM;

  const result = evaluateProjection({
    optics: p.optics,
    aspect: p.aspect,
    widthM: p.widthM,
    heightM: p.heightM,
    distanceM,
    lateralM,
    screenBottomM: p.screenBottomM,
    lensHeightM: p.lensHeightM,
    screenGain: p.screenGain,
  });

  const along = (halfM: number): [Pt, Pt] => {
    const h = halfM * mmPerM;
    return [
      { x: p.screenCenterMm.x - t.x * h, y: p.screenCenterMm.y - t.y * h },
      { x: p.screenCenterMm.x + t.x * h, y: p.screenCenterMm.y + t.y * h },
    ];
  };
  const onLine = (dM: number): Pt => ({
    x: p.screenCenterMm.x + t.x * lateralM * mmPerM + n.x * dM * mmPerM,
    y: p.screenCenterMm.y + t.y * lateralM * mmPerM + n.y * dM * mmPerM,
  });

  return {
    distanceM,
    lateralM,
    lensMm: symbolMm,
    surfaceMm: along(p.widthM / 2),
    pictureMm: along(result.picture.widthM / 2),
    bandMm: result.range ? [onLine(result.range.minM), onLine(result.range.maxM)] : null,
    result,
  };
}

/** Where the symbol goes for a given throw distance, keeping its sideways offset — what
 *  the distance slider does. */
export function symbolPositionForDistance(
  p: FloorplanProjection,
  symbolMm: Pt,
  distanceM: number,
  scaleDenominator: number,
): Pt {
  const mmPerM = 1000 / scaleDenominator;
  const n = unit(p.screenRotationDeg);
  const t = { x: -n.y, y: n.x };
  const lateral = (symbolMm.x - p.screenCenterMm.x) * t.x + (symbolMm.y - p.screenCenterMm.y) * t.y;
  return {
    x: p.screenCenterMm.x + t.x * lateral + n.x * distanceM * mmPerM,
    y: p.screenCenterMm.y + t.y * lateral + n.y * distanceM * mmPerM,
  };
}

/** Direction a projector symbol has to face to look at a surface. */
export function symbolRotationFacing(screenRotationDeg: number): number {
  return (((screenRotationDeg + 180) % 360) + 360) % 360;
}

/**
 * A first projection for a projector symbol: a 100" picture straight ahead of it, in the
 * middle of what the lens can throw, so the cone appears where the symbol is already
 * looking and only needs pulling to its wall.
 */
export function defaultProjectionFor(
  symbol: { id: string; positionMm: Pt; rotationDeg?: number; groupId?: string },
  optics: ProjectionOptics,
  scaleDenominator: number,
): Omit<FloorplanProjection, "id"> {
  const aspect = optics.formats?.[0]?.ratio ?? "16:10";
  const sized = resizeSurface({ aspect, widthM: 0, heightM: 0 }, { diagonalIn: 100 });
  const range = throwRangeM(optics, aspect, pictureSize(sized.widthM, sized.heightM, aspect));
  const distanceM = range ? (range.minM + range.maxM) / 2 : 3;
  const facing = symbol.rotationDeg ?? 0;
  const dir = unit(facing);
  const mm = (distanceM * 1000) / scaleDenominator;
  return {
    symbolId: symbol.id,
    groupId: symbol.groupId,
    optics,
    aspect,
    widthM: sized.widthM,
    heightM: sized.heightM,
    screenCenterMm: { x: symbol.positionMm.x + dir.x * mm, y: symbol.positionMm.y + dir.y * mm },
    screenRotationDeg: symbolRotationFacing(facing),
  };
}

export interface ProjectionOnSheet {
  projection: FloorplanProjection;
  geometry: ProjectionGeometry;
}

/** The projections a sheet shows: not hidden, their layer switched on, their projector
 *  still on the plan. */
export function visibleProjections(page: {
  projections?: FloorplanProjection[];
  symbols: { id: string; positionMm: Pt; groupId: string }[];
  groups: { id: string; hidden?: boolean }[];
  scaleDenominator: number;
}): ProjectionOnSheet[] {
  const out: ProjectionOnSheet[] = [];
  for (const projection of page.projections ?? []) {
    if (projection.hidden) continue;
    const symbol = page.symbols.find((s) => s.id === projection.symbolId);
    if (!symbol) continue;
    const group = page.groups.find((g) => g.id === (projection.groupId ?? symbol.groupId));
    if (group?.hidden) continue;
    out.push({ projection, geometry: projectionGeometry(projection, symbol.positionMm, page.scaleDenominator) });
  }
  return out;
}

/** One line for the plan: model · diagonal · distance. */
export function projectionCaption(p: FloorplanProjection, g: ProjectionGeometry): string {
  const parts = [
    p.model,
    `${Math.round(g.result.picture.diagonalIn)}″`,
    g.distanceM > 0 ? `${g.distanceM.toFixed(2)} m` : undefined,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Where the caption goes: just behind the surface, away from the projector. */
export function projectionCaptionAnchorMm(p: FloorplanProjection, offsetMm: number): Pt {
  const n = unit(p.screenRotationDeg);
  return { x: p.screenCenterMm.x - n.x * offsetMm, y: p.screenCenterMm.y - n.y * offsetMm };
}

export const PROJECTION_OK_COLOR = "#0e7490";
export const PROJECTION_WARN_COLOR = "#dc2626";
