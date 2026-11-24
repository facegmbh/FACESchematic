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
