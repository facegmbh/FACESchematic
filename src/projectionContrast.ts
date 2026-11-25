/**
 * Contrast of a picture in a lit room, after AVIXA's Image System Contrast Ratio (ISCR,
 * formerly PISCR, ANSI/AVIXA 3M-2011): how many times brighter white is than black where
 * the viewer sits, with the room light on. Brightness alone says little — a bright
 * picture in a bright room is still grey where it should be black.
 *
 * The standard is a measurement on site (a 16-zone checkerboard). What is worked out here
 * is the estimate a planner can make beforehand, from three things: how much light the
 * picture itself puts out, how much room light falls on it, and how black the device can
 * be within one picture. Pure functions; every input that is an assumption is a parameter.
 */

/** The four viewing tasks of the standard and the least contrast each needs. */
export const CONTRAST_LEVELS = [
  { id: "passive", ratio: 7 },
  { id: "bdm", ratio: 15 },
  { id: "adm", ratio: 50 },
  { id: "motion", ratio: 80 },
] as const;
export type ContrastLevel = (typeof CONTRAST_LEVELS)[number]["id"];

/** Contrast a device reaches within one picture (checkerboard), where nothing better is
 *  known. Datasheets quote full-on/full-off or dynamic figures in the hundred-thousands;
 *  those do not describe a picture with bright and dark parts side by side. Assumptions. */
export const DEFAULT_PROJECTOR_CONTRAST = 300;
export const DEFAULT_DISPLAY_CONTRAST = 1000;
/** Share of the room light a display's front throws back, percent. Assumption: a matt
 *  LCD panel. */
export const DEFAULT_DISPLAY_REFLECTANCE_PCT = 5;

/** The least contrast a task needs. */
export function requiredContrast(level: ContrastLevel): number {
  return CONTRAST_LEVELS.find((l) => l.id === level)!.ratio;
}

/** The most demanding task a contrast ratio still serves, or null below passive viewing. */
export function contrastLevelReached(ratio: number): ContrastLevel | null {
  let reached: ContrastLevel | null = null;
  for (const l of CONTRAST_LEVELS) if (ratio >= l.ratio - 1e-9) reached = l.id;
  return reached;
}

/**
 * White over black, each with the room light added. `white` and `ambient` are in the same
 * unit — lux on a projection screen, cd/m² on a display — and `native` is the device's
 * own contrast within a picture.
 */
function ratioWithAmbient(white: number, ambient: number, native: number): number {
  return (white + ambient) / (white / native + ambient);
}

/** The most ambient (same unit as `white`) at which `required` is still reached; 0 when
 *  the device cannot reach it even in the dark. */
function maxAmbientFor(white: number, native: number, required: number): number {
  if (!(required > 1) || native <= required) return 0;
  return (white * (1 - required / native)) / (required - 1);
}

export interface ContrastResult {
  /** White ÷ black with the room light on. */
  ratio: number;
  required: number;
  ok: boolean;
  /** The most demanding task this contrast still serves. */
  reached: ContrastLevel | null;
  /** Room light on the picture, in lux, at which the required contrast is just reached.
   *  0: not reachable with this device at any light. */
  maxAmbientLux: number;
}

function result(ratio: number, level: ContrastLevel, maxAmbientLux: number): ContrastResult {
  const required = requiredContrast(level);
  return { ratio, required, ok: ratio >= required - 1e-9, reached: contrastLevelReached(ratio), maxAmbientLux };
}

/**
 * A projected picture. `screenLux` is the projector's light on the screen (lumens × gain
 * ÷ area); the room light is taken to be thrown back by the screen like the projector's
 * own — true of a matt white screen, pessimistic for one that rejects ambient light.
 */
export function projectedContrast(input: {
  screenLux: number;
  ambientLux: number;
  level: ContrastLevel;
  nativeContrast?: number;
}): ContrastResult | null {
  const native = input.nativeContrast ?? DEFAULT_PROJECTOR_CONTRAST;
  if (!(input.screenLux > 0) || !(input.ambientLux >= 0) || !(native > 1)) return null;
  return result(
    ratioWithAmbient(input.screenLux, input.ambientLux, native),
    input.level,
    maxAmbientFor(input.screenLux, native, requiredContrast(input.level)),
  );
}

/**
 * A display. `nits` is its luminance in cd/m²; the room light comes back off its front as
 * lux × reflectance ÷ π.
 */
export function displayContrast(input: {
  nits: number;
  ambientLux: number;
  level: ContrastLevel;
  nativeContrast?: number;
  reflectancePct?: number;
}): ContrastResult | null {
  const native = input.nativeContrast ?? DEFAULT_DISPLAY_CONTRAST;
  const reflectance = (input.reflectancePct ?? DEFAULT_DISPLAY_REFLECTANCE_PCT) / 100;
  if (!(input.nits > 0) || !(input.ambientLux >= 0) || !(native > 1) || !(reflectance > 0)) return null;
  const perLux = reflectance / Math.PI;
  return result(
    ratioWithAmbient(input.nits, input.ambientLux * perLux, native),
    input.level,
    maxAmbientFor(input.nits, native, requiredContrast(input.level)) / perLux,
  );
}

/**
 * The rating scale of Epson's Throw Distance Simulator ("Brightness & Contrast guide"),
 * read from its code on 25.11.2026: five bands of contrast per kind of room, and the room
 * light Epson assumes for each. A cinema wants far more contrast than a classroom, so the
 * same picture rates differently by what the room is for.
 *
 * Epson works out its contrast as screen light ÷ room light + 1, without a device
 * contrast; the estimate above comes out a little lower in a dark room and the same in a
 * lit one.
 */
export const CONTRAST_APPLICATIONS = [
  { id: "meeting", ambientLux: 140, bands: [20, 15, 8, 3] },
  { id: "classroom", ambientLux: 210, bands: [15, 10, 7, 5] },
  { id: "hall", ambientLux: 140, bands: [15, 7, 5, 3] },
  { id: "living", ambientLux: 70, bands: [10, 5, 4, 3] },
  { id: "theatre", ambientLux: 14, bands: [80, 50, 30, 20] },
] as const;
export type ContrastApplication = (typeof CONTRAST_APPLICATIONS)[number]["id"];
export const DEFAULT_CONTRAST_APPLICATION: ContrastApplication = "meeting";

/** The five bands, best first. */
export const CONTRAST_BANDS = ["best", "recommended", "enough", "limit", "too-low"] as const;
export type ContrastBand = (typeof CONTRAST_BANDS)[number];
/** One colour per band, best first — the run of the viewing heatmap, so green means the
 *  same thing all over the plan. */
export const CONTRAST_BAND_COLORS = ["#16a34a", "#84cc16", "#eab308", "#ea580c", "#dc2626"] as const;
/** Where the scale ends: Epson shows anything above as "greater than 200:1". */
export const CONTRAST_SCALE_TOP = 200;

export function contrastApplication(id: ContrastApplication | undefined) {
  return CONTRAST_APPLICATIONS.find((a) => a.id === id) ?? CONTRAST_APPLICATIONS[0];
}

export interface ContrastRating {
  band: ContrastBand;
  /** Index of the band, 0 = best. */
  index: number;
  /** Where the contrast sits on a scale of five equal bands: 0 = top of "best",
   *  1 = bottom of "too low". Within a band it runs linearly, as in Epson's guide. */
  at: number;
}

/** Rate a contrast ratio for a kind of room. */
export function rateContrast(ratio: number, application?: ContrastApplication): ContrastRating | null {
  if (!(ratio >= 0)) return null;
  const { bands } = contrastApplication(application);
  const edges = [CONTRAST_SCALE_TOP, ...bands, 0];
  if (ratio >= CONTRAST_SCALE_TOP) return { band: "best", index: 0, at: 0 };
  for (let i = 0; i < CONTRAST_BANDS.length; i++) {
    const max = edges[i], min = edges[i + 1];
    if (ratio >= min) return { band: CONTRAST_BANDS[i], index: i, at: (i + (max - ratio) / (max - min)) / CONTRAST_BANDS.length };
  }
  return { band: "too-low", index: 4, at: 1 };
}

/** What a picture's contrast is worked out from — the fields of a projection that matter. */
export interface ContrastPicture {
  kind?: "display";
  viewing?: { task: "bdm" | "adm" };
  light?: {
    ambientLux?: number;
    nativeContrast?: number;
    nits?: number;
    reflectancePct?: number;
    application?: ContrastApplication;
  };
}

/**
 * Contrast of one picture on the plan, or null while something it needs is missing: the
 * room light, a display's luminance, a projector's light on its screen (`screenLux`).
 */
export function pictureContrast(picture: ContrastPicture, screenLux: number | undefined): ContrastResult | null {
  const light = picture.light ?? {};
  const level: ContrastLevel = picture.viewing?.task ?? "bdm";
  if (light.ambientLux === undefined) return null;
  if (picture.kind === "display") {
    return light.nits
      ? displayContrast({ nits: light.nits, ambientLux: light.ambientLux, level, nativeContrast: light.nativeContrast, reflectancePct: light.reflectancePct })
      : null;
  }
  return screenLux
    ? projectedContrast({ screenLux, ambientLux: light.ambientLux, level, nativeContrast: light.nativeContrast })
    : null;
}

/** Contrast as it is printed: one decimal below 100, whole numbers above, capped like
 *  Epson's guide. */
export function formatContrast(ratio: number, decimal = "."): string {
  if (ratio >= CONTRAST_SCALE_TOP) return `> ${CONTRAST_SCALE_TOP}:1`;
  return `${(ratio >= 100 ? String(Math.round(ratio)) : ratio.toFixed(1)).replace(".", decimal)}:1`;
}
