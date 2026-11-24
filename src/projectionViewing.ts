/**
 * Viewing distances after AVIXA DISCAS (ANSI/AVIXA V202.01): from how far away a picture
 * of a given size can still be read, how close is too close, and how far to the side.
 *
 * Formulas and factors are those of AVIXA's own calculator ("Analytical and Basic Decision
 * Making Calculations" on avixa.org, read from its code on 2026-11-23). They are a
 * recommendation, not a limit of the equipment — nothing here is an error the way a
 * projector outside its throw range is.
 *
 * Pure functions only. A seat is described the way the picture sees it: `d` metres in
 * front of the picture plane, `x` metres to the side of the picture's centre.
 */

import type { ProjectionAudience, ProjectionViewing } from "./types";

/** Basic decision making (presentations, meetings) or analytical (detail work). */
export type ViewingTask = ProjectionViewing["task"];
export type ViewingSettings = ProjectionViewing;
export type AudienceRect = ProjectionAudience;

export const BDM_ACUITY = 200;
export const ADM_ACUITY = 3438;
/** 1 / tan 30° — the closest viewer looks up 30° to the picture's upper edge — and
 *  tan 60°, the sideways limit. AVIXA's calculator uses the rounded value. */
export const VIEWING_ANGLE_FACTOR = 1.732;
export const MAX_OFF_AXIS_DEG = 60;
export const DEFAULT_ELEMENT_PCT = 3;
export const DEFAULT_EYE_HEIGHT_M = 1.2;
/** Share of a limit from which a seat counts as marginal. Our own choice, not AVIXA's. */
export const MARGINAL_FROM = 0.8;

const EPS = 1e-6;

export interface ViewingLimits {
  /** Null when the task lacks its input (ADM without a pixel count). */
  farthestM: number | null;
  /** Null when it cannot be stated: no lower edge known, ADM, or a picture hung so low
   *  that the standard leaves the closest viewer undefined. */
  closestM: number | null;
  /** Farthest viewer ÷ picture height. */
  viewingRatio: number | null;
}

export function viewingLimits(input: {
  pictureHeightM: number;
  screenBottomM?: number;
  settings: ViewingSettings;
}): ViewingLimits {
  const { pictureHeightM: h, screenBottomM, settings } = input;
  let viewingRatio: number | null = null;
  if (settings.task === "bdm") {
    viewingRatio = (BDM_ACUITY * (settings.elementPct ?? DEFAULT_ELEMENT_PCT)) / 100;
  } else if (settings.pixelsV && settings.pixelsV > 0) {
    viewingRatio = ADM_ACUITY / settings.pixelsV;
  }
  if (viewingRatio !== null && !(viewingRatio > 0)) viewingRatio = null;

  let closestM: number | null = null;
  if (settings.task === "bdm" && screenBottomM !== undefined && h > 0) {
    // Picture's upper edge above the eyes.
    const factor = h + (screenBottomM - (settings.eyeHeightM ?? DEFAULT_EYE_HEIGHT_M));
    if (factor >= 0.5 * h) closestM = VIEWING_ANGLE_FACTOR * factor;
  }

  return {
    farthestM: viewingRatio !== null && h > 0 ? viewingRatio * h : null,
    closestM,
    viewingRatio,
  };
}

/**
 * How far a seat is from the picture. AVIXA's calculator knows one number and does not say
 * where a viewer off to the side measures to; the farther edge is the cautious reading —
 * that is the part of the picture they find hardest to read.
 */
export function farEdgeDistanceM(d: number, x: number, pictureWidthM: number): number {
  return Math.hypot(d, Math.abs(x) + pictureWidthM / 2);
}

/** Angle between the picture's perpendicular at its farther edge and the line to the seat. */
export function offAxisDeg(d: number, x: number, pictureWidthM: number): number {
  return (Math.atan2(Math.abs(x) + pictureWidthM / 2, d) * 180) / Math.PI;
}

/** How far to the side of the centre the viewing area reaches, `d` metres in front of the
 *  picture. Negative close to the picture, where the two 60° lines have not yet crossed. */
export function sideLimitM(d: number, pictureWidthM: number): number {
  return VIEWING_ANGLE_FACTOR * d - pictureWidthM / 2;
}

export type SeatRating = "good" | "marginal" | "too-far" | "too-near" | "too-oblique" | "behind";

/** One seat against the recommendation. Where several things are wrong the nearest cause
 *  wins: a seat too close is not helped by also being told it is off to the side. */
export function rateSeat(d: number, x: number, pictureWidthM: number, limits: ViewingLimits): SeatRating {
  if (!(d > EPS)) return "behind";
  if (limits.closestM !== null && d < limits.closestM - EPS) return "too-near";
  const side = sideLimitM(d, pictureWidthM);
  if (Math.abs(x) > side + EPS) return "too-oblique";
  const far = limits.farthestM !== null ? farEdgeDistanceM(d, x, pictureWidthM) / limits.farthestM : 0;
  if (far > 1 + EPS) return "too-far";
  const angle = offAxisDeg(d, x, pictureWidthM) / MAX_OFF_AXIS_DEG;
  return Math.max(far, angle) > MARGINAL_FROM + EPS ? "marginal" : "good";
}

/**
 * The picture height at which a seat sits exactly on the farthest-viewer limit. The picture
 * grows in width as well, which moves its far edge away from the seat, so this is a
 * quadratic and not a division. Null when no size can satisfy the ratio.
 */
export function requiredPictureHeightM(d: number, x: number, aspect: number, viewingRatio: number): number | null {
  const a = viewingRatio * viewingRatio - (aspect * aspect) / 4;
  if (!(a > EPS)) return null;
  const b = aspect * Math.abs(x);
  const c = d * d + x * x;
  return (b + Math.sqrt(b * b + 4 * a * c)) / (2 * a);
}

export interface ScreenOnSheet {
  screenCenterMm: { x: number; y: number };
  screenRotationDeg: number;
}

function unit(deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** The rectangle's four corners as seats: `d` in front of the picture, `x` beside its centre. */
export function audienceCornersM(
  rect: AudienceRect,
  screen: ScreenOnSheet,
  scaleDenominator: number,
): { d: number; x: number }[] {
  const mPerMm = scaleDenominator / 1000;
  const n = unit(screen.screenRotationDeg);
  const t = { x: -n.y, y: n.x };
  const rn = unit(rect.rotationDeg);
  const rt = { x: -rn.y, y: rn.x };
  const cx = (rect.centerMm.x - screen.screenCenterMm.x) * mPerMm;
  const cy = (rect.centerMm.y - screen.screenCenterMm.y) * mPerMm;
  const corners: { d: number; x: number }[] = [];
  for (const sw of [-1, 1]) {
    for (const sd of [-1, 1]) {
      const px = cx + (rt.x * sw * rect.widthM) / 2 + (rn.x * sd * rect.depthM) / 2;
      const py = cy + (rt.y * sw * rect.widthM) / 2 + (rn.y * sd * rect.depthM) / 2;
      corners.push({ d: px * n.x + py * n.y, x: px * t.x + py * t.y });
    }
  }
  return corners;
}

export type ViewingIssueKind = "too-far" | "too-near" | "too-oblique" | "behind";

export interface ViewingIssue {
  kind: ViewingIssueKind;
  /** too-far / too-near: metres beyond the recommendation. */
  byM?: number;
  /** too-oblique: the largest angle in the area, degrees. */
  deg?: number;
}

export interface ViewingResult {
  limits: ViewingLimits;
  /** What the audience area spans. Null without one. */
  zone: { nearestM: number; farthestM: number; maxAngleDeg: number } | null;
  issues: ViewingIssue[];
  /** Picture height that would bring the farthest seat inside the recommendation — only
   *  when it is outside and such a height exists. */
  requiredHeightM?: number;
}

/**
 * The audience area against the recommendation. Only the corners are tested: distance to
 * the far edge, distance to the picture plane and the off-axis angle all take their
 * extremes at a corner of a rectangle.
 */
export function evaluateViewing(
  input: {
    pictureWidthM: number;
    pictureHeightM: number;
    screenBottomM?: number;
    settings: ViewingSettings;
    audience?: AudienceRect;
    scaleDenominator: number;
  } & ScreenOnSheet,
): ViewingResult {
  const { pictureWidthM: w, pictureHeightM: h } = input;
  const limits = viewingLimits(input);
  if (!input.audience) return { limits, zone: null, issues: [] };

  const corners = audienceCornersM(input.audience, input, input.scaleDenominator);
  const nearestM = Math.min(...corners.map((c) => c.d));
  const farthestM = Math.max(...corners.map((c) => farEdgeDistanceM(c.d, c.x, w)));
  if (!(nearestM > EPS)) {
    // Part of the area is behind the picture. Angles and distances mean nothing there.
    return { limits, zone: { nearestM, farthestM, maxAngleDeg: 90 }, issues: [{ kind: "behind" }] };
  }
  const maxAngleDeg = Math.max(...corners.map((c) => offAxisDeg(c.d, c.x, w)));

  const issues: ViewingIssue[] = [];
  let requiredHeightM: number | undefined;
  if (limits.closestM !== null && nearestM < limits.closestM - EPS) {
    issues.push({ kind: "too-near", byM: limits.closestM - nearestM });
  }
  if (corners.some((c) => Math.abs(c.x) > sideLimitM(c.d, w) + EPS)) {
    issues.push({ kind: "too-oblique", deg: maxAngleDeg });
  }
  if (limits.farthestM !== null && limits.viewingRatio !== null && farthestM > limits.farthestM + EPS) {
    issues.push({ kind: "too-far", byM: farthestM - limits.farthestM });
    const ratio = limits.viewingRatio;
    const needed = corners.map((c) => requiredPictureHeightM(c.d, c.x, w / h, ratio));
    if (h > 0 && needed.every((v): v is number => v !== null)) requiredHeightM = Math.max(...needed);
  }

  return { limits, zone: { nearestM, farthestM, maxAngleDeg }, issues, requiredHeightM };
}

// ---- On the sheet ---------------------------------------------------------------------

type Pt = { x: number; y: number };

export const DEFAULT_VIEWING: ProjectionViewing = { task: "bdm" };
/** Smallest side an audience area can be dragged to, metres. */
export const AUDIENCE_MIN_SIDE_M = 0.5;

/** A seat (`d` in front of the picture, `x` beside its centre) as a point on the sheet. */
function seatToSheetMm(d: number, x: number, screen: ScreenOnSheet, scaleDenominator: number): Pt {
  const mmPerM = 1000 / scaleDenominator;
  const n = unit(screen.screenRotationDeg);
  return {
    x: screen.screenCenterMm.x + (n.x * d - n.y * x) * mmPerM,
    y: screen.screenCenterMm.y + (n.y * d + n.x * x) * mmPerM,
  };
}

/** The rectangle's corners in paper mm, going round. Corner `i` is opposite `(i + 2) % 4`;
 *  corners 2 and 3 are the far side. */
export function audienceOutlineMm(rect: AudienceRect, scaleDenominator: number): Pt[] {
  const mmPerM = 1000 / scaleDenominator;
  const rn = unit(rect.rotationDeg);
  const rt = { x: -rn.y, y: rn.x };
  const hw = (rect.widthM / 2) * mmPerM, hd = (rect.depthM / 2) * mmPerM;
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sw, sd]) => ({
    x: rect.centerMm.x + rt.x * sw * hw + rn.x * sd * hd,
    y: rect.centerMm.y + rt.y * sw * hw + rn.y * sd * hd,
  }));
}

/** Where the turn handle sits: a little beyond the middle of the far side. */
export function audienceTurnHandleMm(rect: AudienceRect, scaleDenominator: number, offsetMm: number): Pt {
  const rn = unit(rect.rotationDeg);
  const reach = (rect.depthM / 2) * (1000 / scaleDenominator) + offsetMm;
  return { x: rect.centerMm.x + rn.x * reach, y: rect.centerMm.y + rn.y * reach };
}

/** Drag corner `corner` to `toMm`; the opposite corner stays where it is. */
export function resizeAudienceFromCorner(
  rect: AudienceRect,
  corner: number,
  toMm: Pt,
  scaleDenominator: number,
): AudienceRect {
  const mmPerM = 1000 / scaleDenominator;
  const fixed = audienceOutlineMm(rect, scaleDenominator)[(corner + 2) % 4];
  const rn = unit(rect.rotationDeg);
  const rt = { x: -rn.y, y: rn.x };
  const dx = toMm.x - fixed.x, dy = toMm.y - fixed.y;
  // Keep the dragged corner on its own side of the fixed one, so the rectangle cannot
  // be pulled inside out.
  const sw = corner === 1 || corner === 2 ? 1 : -1;
  const sd = corner >= 2 ? 1 : -1;
  const minMm = AUDIENCE_MIN_SIDE_M * mmPerM;
  const wMm = Math.max(minMm, (dx * rt.x + dy * rt.y) * sw);
  const dMm = Math.max(minMm, (dx * rn.x + dy * rn.y) * sd);
  return {
    ...rect,
    widthM: wMm / mmPerM,
    depthM: dMm / mmPerM,
    centerMm: {
      x: fixed.x + (rt.x * sw * wMm) / 2 + (rn.x * sd * dMm) / 2,
      y: fixed.y + (rt.y * sw * wMm) / 2 + (rn.y * sd * dMm) / 2,
    },
  };
}

/**
 * A first audience area for a picture: parallel to it, centred, starting where sitting
 * begins to make sense and ending well inside the recommendation — so a new area is
 * right until the planner drags it to the real seats.
 */
export function defaultAudienceFor(
  input: { pictureWidthM: number; pictureHeightM: number } & ScreenOnSheet,
  limits: ViewingLimits,
  scaleDenominator: number,
): AudienceRect {
  const nearM = Math.max(limits.closestM ?? 0, 1.5 * input.pictureHeightM);
  const farM = limits.farthestM !== null ? Math.max(nearM + 1, 0.75 * limits.farthestM) : nearM + 4;
  const depthM = farM - nearM;
  return {
    centerMm: seatToSheetMm(nearM + depthM / 2, 0, input, scaleDenominator),
    widthM: Math.max(2, 1.5 * input.pictureWidthM),
    depthM,
    rotationDeg: input.screenRotationDeg,
  };
}

/**
 * The area the recommendation covers, as an outline on the sheet: a near line at the
 * closest viewer, the two 60° lines, and at the back the arc on which the picture's
 * farther edge is exactly the farthest-viewer distance away. Null without a farthest
 * viewer, or when nothing is left between near and far.
 */
export function viewingAreaOutlineMm(
  limits: ViewingLimits,
  pictureWidthM: number,
  screen: ScreenOnSheet,
  scaleDenominator: number,
): Pt[] | null {
  const far = limits.farthestM;
  const half = pictureWidthM / 2;
  if (far === null || !(far > half)) return null;
  // The 60° lines cross on the axis; in front of that point nobody sees both edges.
  const apexM = half / VIEWING_ANGLE_FACTOR;
  const nearM = Math.max(limits.closestM ?? 0, apexM);
  // Angles are measured at the farther edge, from the picture's perpendicular.
  const onAxis = Math.asin(half / far);
  const outer = Math.min(Math.atan(VIEWING_ANGLE_FACTOR), Math.acos(Math.min(1, nearM / far)));
  if (!(outer > onAxis + EPS)) return null;

  const seats: { d: number; x: number }[] = [];
  const nearX = Math.min(sideLimitM(nearM, pictureWidthM), far * Math.sin(outer) - half);
  if (nearX > EPS) seats.push({ d: nearM, x: -nearX }, { d: nearM, x: nearX });
  else seats.push({ d: nearM, x: 0 });
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = outer + ((onAxis - outer) * i) / steps;
    seats.push({ d: far * Math.cos(a), x: far * Math.sin(a) - half });
  }
  for (let i = 1; i <= steps; i++) {
    const a = onAxis + ((outer - onAxis) * i) / steps;
    seats.push({ d: far * Math.cos(a), x: half - far * Math.sin(a) });
  }
  return seats.map((s) => seatToSheetMm(s.d, s.x, screen, scaleDenominator));
}

/** Frame of an audience area that is inside the recommendation, and of one that is not.
 *  Amber, not the cone's red: this is advice, not a limit of the projector. */
export const VIEWING_OK_COLOR = "#475569";
export const VIEWING_HINT_COLOR = "#b45309";

/** What of a projection the viewing distances read. */
export interface ViewedPicture {
  screenBottomM?: number;
  audience?: AudienceRect;
  viewing?: ProjectionViewing;
  /** The projector's own panel, for its native pixel count. */
  optics?: { pixelsV?: number };
}

/**
 * The settings the viewing distances are worked out with. The pixel count is the one the
 * planner typed, else the projector's native one — the device knows its resolution, and
 * nobody should have to copy it off a datasheet.
 */
export function viewingSettingsOf(projection: Pick<ViewedPicture, "viewing" | "optics">): ProjectionViewing {
  const viewing = projection.viewing ?? DEFAULT_VIEWING;
  return { ...viewing, pixelsV: viewing.pixelsV ?? projection.optics?.pixelsV };
}

/** Detail work without a pixel count: the farthest seat cannot be stated, so nothing is
 *  judged — and nothing may be drawn that looks like a judgement. */
export function viewingLacksResolution(projection: Pick<ViewedPicture, "viewing" | "optics">): boolean {
  const s = viewingSettingsOf(projection);
  return s.task === "adm" && !(s.pixelsV && s.pixelsV > 0);
}

export interface ViewingOnSheet {
  result: ViewingResult;
  /** The audience area's corners, paper mm. Null without one. */
  audienceMm: Pt[] | null;
  /** The area the recommendation covers, paper mm. */
  recommendedMm: Pt[] | null;
  /** Is the audience area drawn with its heatmap (`viewingHeatmap`)? */
  heatmapOn: boolean;
}

/** Everything the sheet, the panel and the PDF need about one projection's viewing. */
export function viewingOnSheet(
  projection: ScreenOnSheet & ViewedPicture,
  picture: { widthM: number; heightM: number },
  scaleDenominator: number,
): ViewingOnSheet {
  const result = evaluateViewing({
    pictureWidthM: picture.widthM,
    pictureHeightM: picture.heightM,
    screenBottomM: projection.screenBottomM,
    settings: viewingSettingsOf(projection),
    audience: projection.audience,
    screenCenterMm: projection.screenCenterMm,
    screenRotationDeg: projection.screenRotationDeg,
    scaleDenominator,
  });
  return {
    result,
    audienceMm: projection.audience ? audienceOutlineMm(projection.audience, scaleDenominator) : null,
    recommendedMm: projection.viewing?.outline === false
      ? null
      : viewingAreaOutlineMm(result.limits, picture.widthM, projection, scaleDenominator),
    heatmapOn: Boolean(projection.audience) && projection.viewing?.heatmap !== false && !viewingLacksResolution(projection),
  };
}

// ---- Heatmap of the audience area -------------------------------------------------------

/**
 * How close a seat is to the recommendation's limits, as one number: 0 is ideal, 1 is
 * exactly on a limit, above 1 is outside. It is the worst of three ratios — distance to
 * the farthest viewer, angle to the 60° line, and the closest viewer over the seat's own
 * distance — so whichever limit a seat is nearest decides its colour. Null behind the
 * picture, where there is nothing to see.
 */
export function seatQuality(d: number, x: number, pictureWidthM: number, limits: ViewingLimits): number | null {
  if (!(d > EPS)) return null;
  const far = limits.farthestM !== null ? farEdgeDistanceM(d, x, pictureWidthM) / limits.farthestM : 0;
  const angle = offAxisDeg(d, x, pictureWidthM) / MAX_OFF_AXIS_DEG;
  const near = limits.closestM !== null ? limits.closestM / d : 0;
  return Math.max(far, angle, near);
}

type Rgb = [number, number, number];

/** The heatmap's colours along the quality scale: green while a seat is comfortably
 *  inside, through yellow towards orange on the limit itself, and on to red outside. */
export const VIEWING_RAMP: { q: number; rgb: Rgb }[] = [
  { q: 0, rgb: [22, 163, 74] },
  { q: 0.6, rgb: [22, 163, 74] },
  { q: 0.85, rgb: [234, 179, 8] },
  { q: 1, rgb: [234, 88, 12] },
  { q: 1.3, rgb: [220, 38, 38] },
];
/** Behind the picture. */
export const VIEWING_BEHIND_RGB: Rgb = [148, 163, 184];
export const VIEWING_HEATMAP_OPACITY = 0.5;
/** The stretch of the scale a colour key shows, and where the limit sits on it. */
export const VIEWING_KEY_RANGE = { from: 0.5, to: 1.3 };

/** The colour of a quality value, blended between the ramp's stops. */
export function qualityRgb(q: number | null): Rgb {
  if (q === null) return VIEWING_BEHIND_RGB;
  const ramp = VIEWING_RAMP;
  if (q <= ramp[0].q) return ramp[0].rgb;
  for (let i = 1; i < ramp.length; i++) {
    if (q <= ramp[i].q) {
      const a = ramp[i - 1], b = ramp[i];
      const k = (q - a.q) / (b.q - a.q);
      return [0, 1, 2].map((c) => Math.round(a.rgb[c] + (b.rgb[c] - a.rgb[c]) * k)) as Rgb;
    }
  }
  return ramp[ramp.length - 1].rgb;
}

/** `count` colours evenly along the key's stretch of the scale, as #rrggbb. */
export function viewingKeyColors(count: number): string[] {
  const { from, to } = VIEWING_KEY_RANGE;
  return Array.from({ length: count }, (_, i) => {
    const q = from + ((to - from) * i) / Math.max(1, count - 1);
    return `#${qualityRgb(q).map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  });
}

/** Where "on the limit" sits on the key, 0…1 from its left end. */
export const VIEWING_KEY_LIMIT_AT = (1 - VIEWING_KEY_RANGE.from) / (VIEWING_KEY_RANGE.to - VIEWING_KEY_RANGE.from);

/** Sample pitch on site, and the most samples along one side — a hall-sized area gets a
 *  coarser pitch instead of an ever larger picture. */
const HEATMAP_PITCH_M = 0.04;
const HEATMAP_MAX_PX = 256;

/**
 * The audience area's heatmap as a picture: upright on the sheet, covering the area's
 * bounding box, transparent wherever the box is outside the (possibly turned) rectangle.
 * One upright picture is what both the screen and the PDF can place without knowing about
 * rotation, and a raster is what makes the colours run into each other instead of
 * stepping.
 */
export interface ViewingRaster {
  /** Top-left corner and size on the sheet, paper mm. */
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  cols: number;
  rows: number;
  /** RGBA, row by row from the top. Alpha is 255 inside the area, 0 outside. */
  rgba: Uint8ClampedArray;
}

export function viewingRaster(
  rect: AudienceRect,
  pictureWidthM: number,
  limits: ViewingLimits,
  screen: ScreenOnSheet,
  scaleDenominator: number,
): ViewingRaster | null {
  if (!(rect.widthM > 0) || !(rect.depthM > 0)) return null;
  const mmPerM = 1000 / scaleDenominator;
  const corners = audienceOutlineMm(rect, scaleDenominator);
  const xMm = Math.min(...corners.map((c) => c.x)), yMm = Math.min(...corners.map((c) => c.y));
  const wMm = Math.max(...corners.map((c) => c.x)) - xMm, hMm = Math.max(...corners.map((c) => c.y)) - yMm;
  const longestM = Math.max(wMm, hMm) / mmPerM;
  const longestPx = Math.min(HEATMAP_MAX_PX, Math.max(2, Math.ceil(longestM / HEATMAP_PITCH_M)));
  const pxMm = Math.max(wMm, hMm) / longestPx;
  const cols = Math.max(1, Math.round(wMm / pxMm)), rows = Math.max(1, Math.round(hMm / pxMm));

  const rn = unit(rect.rotationDeg);
  const rt = { x: -rn.y, y: rn.x };
  const n = unit(screen.screenRotationDeg);
  const t = { x: -n.y, y: n.x };
  const halfW = (rect.widthM / 2) * mmPerM, halfD = (rect.depthM / 2) * mmPerM;
  const rgba = new Uint8ClampedArray(cols * rows * 4);
  for (let j = 0; j < rows; j++) {
    const py = yMm + ((j + 0.5) * hMm) / rows;
    for (let i = 0; i < cols; i++) {
      const px = xMm + ((i + 0.5) * wMm) / cols;
      // Inside the rectangle? Measured in its own axes.
      const rx = px - rect.centerMm.x, ry = py - rect.centerMm.y;
      if (Math.abs(rx * rt.x + ry * rt.y) > halfW || Math.abs(rx * rn.x + ry * rn.y) > halfD) continue;
      const sx = (px - screen.screenCenterMm.x) / mmPerM, sy = (py - screen.screenCenterMm.y) / mmPerM;
      const [r, g, b] = qualityRgb(seatQuality(sx * n.x + sy * n.y, sx * t.x + sy * t.y, pictureWidthM, limits));
      const o = (j * cols + i) * 4;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  }
  return { xMm, yMm, wMm, hMm, cols, rows, rgba };
}

/** The raster as a PNG data URL. Browser only — returns undefined where there is no
 *  canvas, and a heatmap that will not encode is left out rather than taking the sheet down. */
export function viewingRasterPng(raster: ViewingRaster): string | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = raster.cols;
  canvas.height = raster.rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const img = ctx.createImageData(raster.cols, raster.rows);
  img.data.set(raster.rgba);
  ctx.putImageData(img, 0, 0);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

/** The heatmap of a projection's audience area, or null when it has no area or the
 *  heatmap is switched off. */
export function viewingHeatmap(
  projection: ScreenOnSheet & ViewedPicture,
  picture: { widthM: number; heightM: number },
  scaleDenominator: number,
): ViewingRaster | null {
  // Without a farthest seat every seat would come out green: a picture of "all good"
  // where in truth nothing is known.
  if (!projection.audience || projection.viewing?.heatmap === false || viewingLacksResolution(projection)) return null;
  const limits = viewingLimits({
    pictureHeightM: picture.heightM,
    screenBottomM: projection.screenBottomM,
    settings: viewingSettingsOf(projection),
  });
  return viewingRaster(projection.audience, picture.widthM, limits, projection, scaleDenominator);
}

/** An audience area given the way a planner says it: starting `nearM` in front of the
 *  picture, `depthM` deep and `widthM` wide, parallel to the picture and `offsetM` to the
 *  side of its centre line. */
export function audienceInFront(
  screen: ScreenOnSheet,
  spec: { nearM: number; depthM: number; widthM: number; offsetM?: number },
  scaleDenominator: number,
): AudienceRect {
  return {
    centerMm: seatToSheetMm(spec.nearM + spec.depthM / 2, spec.offsetM ?? 0, screen, scaleDenominator),
    widthM: spec.widthM,
    depthM: spec.depthM,
    rotationDeg: screen.screenRotationDeg,
  };
}
