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
  ProjectionSection,
  ProjectionSectionUnderlay,
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
// Section
// ---------------------------------------------------------------------------

export const DEFAULT_PERSON_HEIGHT_M = 1.8;
export const SEATED_PERSON_HEIGHT_M = 1.3;

export type SectionIssue = "picture-above-ceiling" | "lens-above-ceiling";

export interface SectionSetup {
  distanceM: number;
  pictureHeightM: number;
  screenBottomM?: number;
  lensHeightM?: number;
  personHeightM: number;
  roomHeightM?: number;
}

export interface SectionResult {
  distanceM: number;
  screenBottomM: number;
  screenTopM: number;
  lensHeightM: number;
  personHeightM: number;
  roomHeightM?: number;
  /** Height of the beam's lower and upper edge, x metres in front of the picture. */
  lowerEdgeAt: (xM: number) => number;
  upperEdgeAt: (xM: number) => number;
  /** Where a person of that height reaches into the beam, as distances in front of the
   *  picture. Null = nowhere. */
  inPicture: { fromM: number; toM: number } | null;
  /** Lens above the person's head; negative when they would walk into the projector. */
  clearanceUnderLensM: number;
  /** Ceiling above the picture's upper edge. */
  ceilingGapM?: number;
  issues: SectionIssue[];
}

/**
 * The vertical section through lens and picture centre. The plan cannot show whether
 * someone standing in the room throws a shadow: that depends on how high the beam's lower
 * edge is where they stand. Under a ceiling-mounted projector that edge is lowest at the
 * picture — so it is the presenter who ends up in it — and it clears head height some way
 * out; a projector on a table reverses that.
 */
export function evaluateSection(setup: SectionSetup): SectionResult | null {
  const { distanceM: d, screenBottomM: bottom, lensHeightM: lens, personHeightM: person } = setup;
  if (bottom === undefined || lens === undefined || !(d > 0) || !(setup.pictureHeightM > 0)) return null;
  const top = bottom + setup.pictureHeightM;
  const lowerEdgeAt = (x: number) => bottom + ((lens - bottom) * x) / d;
  const upperEdgeAt = (x: number) => top + ((lens - top) * x) / d;

  // A person fills floor to head height, so they are in the beam wherever its lower edge
  // is below their head.
  let inPicture: SectionResult["inPicture"] = null;
  const atPicture = person > bottom + 1e-9;
  const atLens = person > lens + 1e-9;
  if (atPicture && atLens) inPicture = { fromM: 0, toM: d };
  else if (atPicture) inPicture = { fromM: 0, toM: ((person - bottom) * d) / (lens - bottom) };
  else if (atLens) inPicture = { fromM: ((bottom - person) * d) / (bottom - lens), toM: d };

  const issues: SectionIssue[] = [];
  if (setup.roomHeightM !== undefined) {
    if (top > setup.roomHeightM + 1e-9) issues.push("picture-above-ceiling");
    if (lens > setup.roomHeightM + 1e-9) issues.push("lens-above-ceiling");
  }

  return {
    distanceM: d,
    screenBottomM: bottom,
    screenTopM: top,
    lensHeightM: lens,
    personHeightM: person,
    roomHeightM: setup.roomHeightM,
    lowerEdgeAt,
    upperEdgeAt,
    inPicture,
    clearanceUnderLensM: lens - person,
    ceilingGapM: setup.roomHeightM !== undefined ? setup.roomHeightM - top : undefined,
    issues,
  };
}

export type SectionRole =
  | "floor"
  | "ceiling"
  | "beam"
  | "picture"
  | "projector"
  | "person"
  | "in-picture";

/** One stroke or filled outline of the section drawing, in mm from the box's top-left. */
export interface SectionItem {
  role: SectionRole;
  /** Two points = a line, more = a closed outline. */
  points: Pt[];
}

export interface SectionDrawing {
  widthMm: number;
  heightMm: number;
  /** Clear margin kept around the drawing inside the box. */
  padMm: number;
  mmPerM: number;
  /** Strip under the floor line for the caption, and the caption's size. */
  labelBandMm: number;
  labelSizeMm: number;
  items: SectionItem[];
  /** Where the caption of the in-picture stretch goes (below the floor), if there is one. */
  inPictureLabelMm: Pt | null;
  /** The architect's drawing filling the box behind the items. */
  image?: { src: string };
}

/** Room either side of picture and projector, metres. */
const SECTION_SIDE_M = 0.5;

/** Beam, picture, projector, person and the in-picture stretch, placed by `at` — a
 *  function from (metres in front of the picture, metres above the floor) to the drawing. */
function sectionItems(s: SectionResult, at: (xM: number, hM: number) => Pt): { items: SectionItem[]; stretch: [Pt, Pt] | null } {
  const items: SectionItem[] = [];
  items.push({ role: "beam", points: [at(s.distanceM, s.lensHeightM), at(0, s.screenTopM), at(0, s.screenBottomM)] });
  items.push({ role: "picture", points: [at(0, s.screenBottomM), at(0, s.screenTopM)] });
  const body = 0.18;
  items.push({
    role: "projector",
    points: [
      at(s.distanceM, s.lensHeightM + body / 2),
      at(s.distanceM + 2 * body, s.lensHeightM + body / 2),
      at(s.distanceM + 2 * body, s.lensHeightM - body / 2),
      at(s.distanceM, s.lensHeightM - body / 2),
    ],
  });

  // The person stands where it matters: at the edge of the stretch, head touching the
  // beam — or in the middle of the room when they are never, or always, in it.
  let stretch: [Pt, Pt] | null = null;
  let personAt = s.distanceM / 2;
  if (s.inPicture) {
    const { fromM, toM } = s.inPicture;
    stretch = [at(fromM, 0), at(toM, 0)];
    items.push({ role: "in-picture", points: stretch });
    if (fromM > 0) personAt = fromM;
    else if (toM < s.distanceM) personAt = toM;
  }
  const head = Math.min(0.24, s.personHeightM / 4);
  const half = 0.2;
  items.push({
    role: "person",
    points: [
      at(personAt - half, 0),
      at(personAt - half, s.personHeightM - head),
      at(personAt - head / 2, s.personHeightM - head),
      at(personAt - head / 2, s.personHeightM),
      at(personAt + head / 2, s.personHeightM),
      at(personAt + head / 2, s.personHeightM - head),
      at(personAt + half, s.personHeightM - head),
      at(personAt + half, 0),
    ],
  });
  return { items, stretch };
}

/**
 * The section as plain geometry, so the panel, the box on the sheet and the PDF draw the
 * very same lines. Picture on the left, projector on the right, to scale within itself.
 */
export function sectionDrawing(s: SectionResult, widthMm: number): SectionDrawing {
  const padMm = Math.min(3, widthMm * 0.05);
  const spanM = s.distanceM + 2 * SECTION_SIDE_M;
  const mmPerM = (widthMm - 2 * padMm) / spanM;
  // Without a ceiling the drawing is as tall as whatever reaches highest.
  const topM = s.roomHeightM ?? Math.max(s.screenTopM, s.lensHeightM, s.personHeightM) + 0.3;
  const labelSizeMm = Math.max(2, widthMm * 0.04);
  const labelBandMm = labelSizeMm * 1.3;
  const heightMm = topM * mmPerM + 2 * padMm + labelBandMm;
  const left = padMm, right = widthMm - padMm;
  // Clamped to the frame: a lens above the ceiling is reported, not drawn off the box.
  const at = (xM: number, hM: number): Pt => ({
    x: Math.min(right, Math.max(left, padMm + (SECTION_SIDE_M + xM) * mmPerM)),
    y: padMm + (topM - Math.min(Math.max(hM, 0), topM)) * mmPerM,
  });

  const frame: SectionItem[] = [{ role: "floor", points: [{ x: left, y: at(0, 0).y }, { x: right, y: at(0, 0).y }] }];
  if (s.roomHeightM !== undefined) frame.push({ role: "ceiling", points: [{ x: left, y: at(0, topM).y }, { x: right, y: at(0, topM).y }] });
  const { items, stretch } = sectionItems(s, at);
  const inPictureLabelMm = stretch
    ? { x: Math.max(left + labelSizeMm * 2.5, (stretch[0].x + stretch[1].x) / 2), y: stretch[0].y + padMm * 0.4 + labelBandMm / 2 }
    : null;

  return { widthMm, heightMm, padMm, mmPerM, labelBandMm, labelSizeMm, items: [...frame, ...items], inPictureLabelMm };
}

/**
 * The same section laid over the architect's drawing. The two floor points give origin,
 * direction and scale at once; "up" is the perpendicular that points up the image, so a
 * drawing with the projector on the left works as well as one with it on the right.
 */
export function sectionOverDrawing(s: SectionResult, underlay: ProjectionSectionUnderlay, widthMm: number): SectionDrawing {
  const mmPerPx = widthMm / Math.max(1, underlay.widthPx);
  const heightMm = underlay.heightPx * mmPerPx;
  const labelSizeMm = Math.max(2, widthMm * 0.04);
  const base = { widthMm, heightMm, padMm: 0, labelBandMm: 0, labelSizeMm, image: { src: underlay.src } };
  const a = underlay.floorAtPicturePx, b = underlay.floorAtProjectorPx;
  const lenPx = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  if (!a || !b || lenPx < 1) return { ...base, mmPerM: 0, items: [], inPictureLabelMm: null };

  const pxPerM = lenPx / s.distanceM;
  const ux = (b.x - a.x) / lenPx, uy = (b.y - a.y) / lenPx;
  let vx = uy, vy = -ux;
  if (vy > 0) { vx = -vx; vy = -vy; }
  const at = (xM: number, hM: number): Pt => ({
    x: (a.x + (ux * xM + vx * hM) * pxPerM) * mmPerPx,
    y: (a.y + (uy * xM + vy * hM) * pxPerM) * mmPerPx,
  });
  const { items, stretch } = sectionItems(s, at);
  const inPictureLabelMm = stretch
    ? { x: (stretch[0].x + stretch[1].x) / 2 - vx * labelSizeMm, y: (stretch[0].y + stretch[1].y) / 2 - vy * labelSizeMm }
    : null;
  return { ...base, mmPerM: pxPerM * mmPerPx, items, inPictureLabelMm };
}

/** The section a projection shows: over the attached drawing if there is one, else generated. */
export function sectionDrawingFor(s: SectionResult, settings: ProjectionSection | undefined, widthMm: number): SectionDrawing {
  return settings?.underlay ? sectionOverDrawing(s, settings.underlay, widthMm) : sectionDrawing(s, widthMm);
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
  /** The section through lens and picture, once both heights are known. */
  section: SectionResult | null;
  /** The part of the cone in which the tested person stands in the picture — the
   *  section's answer, drawn in plan. Four corners, picture side first. */
  inPictureMm: Pt[] | null;
  result: ProjectionResult;
}

/**
 * A display's picture is not placed, it hangs on its symbol: the middle of the picture is
 * the symbol, and it faces the way the symbol is turned. An unturned display symbol is a
 * bar across the sheet, so its picture faces down the sheet — a quarter turn from the
 * symbol's own angle. A projector's projection is returned as it is.
 *
 * Everything that draws or measures a projection goes through this first, so a display
 * can never be left behind by its symbol.
 */
export function resolveProjection(
  p: FloorplanProjection,
  symbol: { positionMm: Pt; rotationDeg?: number },
): FloorplanProjection {
  if (p.kind !== "display") return p;
  return {
    ...p,
    screenCenterMm: { ...symbol.positionMm },
    screenRotationDeg: ((((symbol.rotationDeg ?? 0) + 90) % 360) + 360) % 360,
  };
}

/** Depth of a display as drawn in plan, on site — and the least the bar is ever drawn
 *  with on paper, so it does not vanish on a 1:500 site plan. */
export const DISPLAY_DEPTH_M = 0.08;
export const DISPLAY_BAR_MIN_DEPTH_MM = 0.8;

/** A display in plan: a bar of its true picture width, centred on its symbol. Four
 *  corners in paper mm, going round. Pass a resolved projection. */
export function displayBarMm(p: FloorplanProjection, scaleDenominator: number): Pt[] {
  const mmPerM = 1000 / scaleDenominator;
  const n = unit(p.screenRotationDeg);
  const t = { x: -n.y, y: n.x };
  const picture = pictureSize(p.widthM, p.heightM, p.aspect);
  const hw = (picture.widthM / 2) * mmPerM;
  const hd = Math.max(DISPLAY_BAR_MIN_DEPTH_MM, DISPLAY_DEPTH_M * mmPerM) / 2;
  const c = p.screenCenterMm;
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([st, sn]) => ({
    x: c.x + t.x * st * hw + n.x * sn * hd,
    y: c.y + t.y * st * hw + n.y * sn * hd,
  }));
}

/** The display planned on a symbol, resolved to where the symbol is now. Undefined for a
 *  symbol that is no display or has no size yet. */
export function displayOnSymbol(
  page: { projections?: FloorplanProjection[] },
  symbol: { id: string; positionMm: Pt; rotationDeg?: number },
): FloorplanProjection | undefined {
  const found = (page.projections ?? []).find((p) => p.kind === "display" && p.symbolId === symbol.id && !p.hidden);
  return found ? resolveProjection(found, symbol) : undefined;
}

/** A first display for a display symbol: the given diagonal in 16:9. */
export function defaultDisplayFor(
  symbol: { id: string; positionMm: Pt; rotationDeg?: number; groupId?: string },
  diagonalIn = 65,
): Omit<FloorplanProjection, "id"> {
  const aspect = "16:9";
  const sized = resizeSurface({ aspect, widthM: 0, heightM: 0 }, { diagonalIn });
  // Centre and direction are stored as they are now, though a display reads them off its
  // symbol every time: a file opened by an older version then still shows it in place.
  const facing = resolveProjection({ kind: "display", screenCenterMm: symbol.positionMm, screenRotationDeg: 0 } as FloorplanProjection, symbol);
  return {
    symbolId: symbol.id,
    groupId: symbol.groupId,
    kind: "display",
    optics: {},
    aspect,
    widthM: sized.widthM,
    heightM: sized.heightM,
    screenCenterMm: facing.screenCenterMm,
    screenRotationDeg: facing.screenRotationDeg,
  };
}

/** Everything the sheet and the PDF draw for one projection, in paper mm. */
export function projectionGeometry(p: FloorplanProjection, symbolMm: Pt, scaleDenominator: number): ProjectionGeometry {
  const mmPerM = 1000 / scaleDenominator;
  const n = unit(p.screenRotationDeg);
  const t = { x: -n.y, y: n.x };
  if (p.kind === "display") {
    // No lens, so nothing to throw, shift or stand in: only the picture itself.
    const picture = pictureSize(p.widthM, p.heightM, p.aspect);
    const ends = (halfM: number): [Pt, Pt] => {
      const h = halfM * mmPerM;
      return [
        { x: p.screenCenterMm.x - t.x * h, y: p.screenCenterMm.y - t.y * h },
        { x: p.screenCenterMm.x + t.x * h, y: p.screenCenterMm.y + t.y * h },
      ];
    };
    return {
      distanceM: 0,
      lateralM: 0,
      lensMm: { ...symbolMm },
      surfaceMm: ends(picture.widthM / 2),
      pictureMm: ends(picture.widthM / 2),
      bandMm: null,
      section: null,
      inPictureMm: null,
      result: { picture, range: null, shiftH: 0, areaM2: picture.widthM * picture.heightM, issues: [] },
    };
  }
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

  const pictureMm = along(result.picture.widthM / 2);
  const section = evaluateSection({
    distanceM,
    pictureHeightM: result.picture.heightM,
    screenBottomM: p.screenBottomM,
    lensHeightM: p.lensHeightM,
    personHeightM: p.section?.personHeightM ?? DEFAULT_PERSON_HEIGHT_M,
    roomHeightM: p.section?.roomHeightM,
  });
  let inPictureMm: Pt[] | null = null;
  if (section?.inPicture && distanceM > 0) {
    // The cone narrows linearly from the picture's ends to the lens.
    const at = (end: Pt, xM: number): Pt => {
      const k = xM / distanceM;
      return { x: end.x + (symbolMm.x - end.x) * k, y: end.y + (symbolMm.y - end.y) * k };
    };
    const { fromM, toM } = section.inPicture;
    inPictureMm = [at(pictureMm[0], fromM), at(pictureMm[1], fromM), at(pictureMm[1], toM), at(pictureMm[0], toM)];
  }

  return {
    distanceM,
    lateralM,
    lensMm: symbolMm,
    surfaceMm: along(p.widthM / 2),
    pictureMm,
    bandMm: result.range ? [onLine(result.range.minM), onLine(result.range.maxM)] : null,
    section,
    inPictureMm,
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
  symbols: { id: string; positionMm: Pt; groupId: string; rotationDeg?: number }[];
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
    // A display's picture is wherever its symbol is now.
    const resolved = resolveProjection(projection, symbol);
    out.push({ projection: resolved, geometry: projectionGeometry(resolved, symbol.positionMm, page.scaleDenominator) });
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

/** Where the caption goes: just behind the surface, away from the projector, and running
 *  away from it — upright text centred on that spot would be struck through by the
 *  surface line whenever the surface stands upright on the sheet. */
export function projectionCaptionAnchorMm(
  p: FloorplanProjection,
  offsetMm: number,
): Pt & { align: "start" | "middle" | "end" } {
  const n = unit(p.screenRotationDeg);
  const sideways = Math.abs(n.x) > 0.5;
  const reach = sideways ? offsetMm * 0.6 : offsetMm;
  return {
    x: p.screenCenterMm.x - n.x * reach,
    y: p.screenCenterMm.y - n.y * reach,
    align: !sideways ? "middle" : n.x < 0 ? "start" : "end",
  };
}

/** The stretch in which someone stands in the picture, as it is written on the drawing:
 *  "1.78 m" from the picture, or "0.67–4.00 m" when it starts further out. */
export function inPictureLabel(s: SectionResult): string | undefined {
  if (!s.inPicture) return undefined;
  const { fromM, toM } = s.inPicture;
  return fromM > 0.005 ? `${fromM.toFixed(2)}\u2013${toM.toFixed(2)} m` : `${toM.toFixed(2)} m`;
}

export const SECTION_BOX_DEFAULT_WIDTH_MM = 70;
export const SECTION_BOX_MIN_WIDTH_MM = 30;

/** The section as a box on the sheet: where it sits and what is drawn in it. Null while
 *  it is switched off or the heights it needs are missing. */
export function sectionBoxMm(
  p: FloorplanProjection,
  g: ProjectionGeometry,
): { x: number; y: number; drawing: SectionDrawing } | null {
  if (!p.section?.show || !g.section) return null;
  const widthMm = Math.max(SECTION_BOX_MIN_WIDTH_MM, p.section.widthMm ?? SECTION_BOX_DEFAULT_WIDTH_MM);
  const at = p.section.positionMm ?? { x: p.screenCenterMm.x + 10, y: p.screenCenterMm.y + 10 };
  return { x: at.x, y: at.y, drawing: sectionDrawingFor(g.section, p.section, widthMm) };
}

export const PROJECTION_IN_PICTURE_COLOR = "#d97706";
export const PROJECTION_OK_COLOR = "#0e7490";
export const PROJECTION_WARN_COLOR = "#dc2626";
