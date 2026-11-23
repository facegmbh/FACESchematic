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

export interface ViewingOnSheet {
  result: ViewingResult;
  /** The audience area's corners, paper mm. Null without one. */
  audienceMm: Pt[] | null;
  /** The area the recommendation covers, paper mm. */
  recommendedMm: Pt[] | null;
  /** The audience area's heatmap; empty when there is no area or it is switched off. */
  patches: ViewingPatch[];
}

/** Everything the sheet, the panel and the PDF need about one projection's viewing. */
export function viewingOnSheet(
  projection: ScreenOnSheet & { screenBottomM?: number; audience?: AudienceRect; viewing?: ProjectionViewing },
  picture: { widthM: number; heightM: number },
  scaleDenominator: number,
): ViewingOnSheet {
  const result = evaluateViewing({
    pictureWidthM: picture.widthM,
    pictureHeightM: picture.heightM,
    screenBottomM: projection.screenBottomM,
    settings: projection.viewing ?? DEFAULT_VIEWING,
    audience: projection.audience,
    screenCenterMm: projection.screenCenterMm,
    screenRotationDeg: projection.screenRotationDeg,
    scaleDenominator,
  });
  return {
    result,
    audienceMm: projection.audience ? audienceOutlineMm(projection.audience, scaleDenominator) : null,
    recommendedMm: viewingAreaOutlineMm(result.limits, picture.widthM, projection, scaleDenominator),
    patches: projection.audience && projection.viewing?.heatmap !== false
      ? viewingPatchesMm(projection.audience, picture.widthM, result.limits, projection, scaleDenominator)
      : [],
  };
}

// ---- Heatmap of the audience area -------------------------------------------------------

/** One colour per rating. Stepped on purpose: the recommendation is a set of limits, and
 *  a smooth gradient would suggest a precision the standard does not have. */
export const SEAT_RATING_COLORS: Record<SeatRating, string> = {
  good: "#16a34a",
  marginal: "#eab308",
  "too-far": "#ea580c",
  "too-near": "#9333ea",
  "too-oblique": "#2563eb",
  behind: "#94a3b8",
};
/** Order of the colour key. */
export const SEAT_RATINGS: SeatRating[] = ["good", "marginal", "too-far", "too-near", "too-oblique", "behind"];
export const VIEWING_HEATMAP_OPACITY = 0.45;
/** Sample pitch on site, and the most samples along one side — a hall-sized area gets a
 *  coarser pitch instead of tens of thousands of cells. */
const HEATMAP_PITCH_M = 0.1;
const HEATMAP_MAX_CELLS = 160;

/** A part of the audience area with one rating: four corners in paper mm, going round. */
export interface ViewingPatch {
  rating: SeatRating;
  mm: Pt[];
}

/**
 * The audience area cut into patches of equal rating. Sampled on a grid in the rectangle's
 * own axes, then neighbouring cells of the same rating are joined — along a row, and rows
 * above each other — so the screen and the PDF draw a few hundred quads, not a raster. That
 * keeps a turned rectangle crisp and needs no image in the export.
 */
export function viewingPatchesMm(
  rect: AudienceRect,
  pictureWidthM: number,
  limits: ViewingLimits,
  screen: ScreenOnSheet,
  scaleDenominator: number,
): ViewingPatch[] {
  if (!(rect.widthM > 0) || !(rect.depthM > 0)) return [];
  const mmPerM = 1000 / scaleDenominator;
  const cols = Math.min(HEATMAP_MAX_CELLS, Math.max(1, Math.ceil(rect.widthM / HEATMAP_PITCH_M)));
  const rows = Math.min(HEATMAP_MAX_CELLS, Math.max(1, Math.ceil(rect.depthM / HEATMAP_PITCH_M)));
  const rn = unit(rect.rotationDeg);
  const rt = { x: -rn.y, y: rn.x };
  const n = unit(screen.screenRotationDeg);
  const t = { x: -n.y, y: n.x };
  const wMm = rect.widthM * mmPerM, dMm = rect.depthM * mmPerM;
  /** A point of the rectangle, `u` across and `v` along it, both 0…1. */
  const at = (u: number, v: number): Pt => ({
    x: rect.centerMm.x + rt.x * (u - 0.5) * wMm + rn.x * (v - 0.5) * dMm,
    y: rect.centerMm.y + rt.y * (u - 0.5) * wMm + rn.y * (v - 0.5) * dMm,
  });
  const rate = (i: number, j: number): SeatRating => {
    const p = at((i + 0.5) / cols, (j + 0.5) / rows);
    const px = (p.x - screen.screenCenterMm.x) / mmPerM, py = (p.y - screen.screenCenterMm.y) / mmPerM;
    return rateSeat(px * n.x + py * n.y, px * t.x + py * t.y, pictureWidthM, limits);
  };

  type Open = { rating: SeatRating; c0: number; c1: number; r0: number };
  const patches: ViewingPatch[] = [];
  const close = (o: Open, r1: number) => {
    patches.push({
      rating: o.rating,
      mm: [at(o.c0 / cols, o.r0 / rows), at(o.c1 / cols, o.r0 / rows), at(o.c1 / cols, r1 / rows), at(o.c0 / cols, r1 / rows)],
    });
  };
  let open = new Map<string, Open>();
  for (let j = 0; j < rows; j++) {
    const next = new Map<string, Open>();
    let c0 = 0;
    let rating = rate(0, j);
    for (let i = 1; i <= cols; i++) {
      const here = i < cols ? rate(i, j) : null;
      if (here === rating) continue;
      const key = `${c0}:${i}:${rating}`;
      next.set(key, open.get(key) ?? { rating, c0, c1: i, r0: j });
      open.delete(key);
      if (here !== null) { c0 = i; rating = here; }
    }
    // Whatever did not continue into this row ends above it.
    for (const o of open.values()) close(o, j);
    open = next;
  }
  for (const o of open.values()) close(o, rows);
  return patches;
}
