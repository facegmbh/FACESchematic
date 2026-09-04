/**
 * Loudspeaker line load model — how much an amplifier channel is asked for and whether
 * it can deliver. Modeled on the Bose PowerShareX Design Tool (v1.0.3), brand-neutral:
 * the same arithmetic serves Audac, JBL, Voice-Acoustic or Tennax as long as the
 * datasheet numbers are on the template.
 *
 * Per channel (all in watts / volts / amperes / ohms):
 *   Lo-Z:  P = 2 × Σ(rmsPowerW_i × n_i) × 10^(offset/10)   Z = 1 / Σ(n_i / Z_i)
 *   Hi-Z:  P = Σ(tap_i × n_i) × 10^(offset/10)              Z = V_line² / P
 *   Zmin   = Lo-Z: 0.75 Z + 0.2   Hi-Z: 0.85 Z + 0.4   (impedance dip below nominal)
 *   Vpk    = √(2 P Z)       Ipk = √(2 P / Zmin)
 *   P_avg  = 2 P × 10^(−activePowerDb/10)   (activePowerDb = crest factor + average reduction)
 * Headroom (dB of power) against the amplifier:
 *   voltage    20·log10(Vmax / Vpk)
 *   current    20·log10(Imax / Ipk) + 10·log10(Zmin / Z)   — what the current limit lets through at Z
 *   channel    10·log10(maxBurstPerChannelW / P)           — Hi-Z: the 70 V / 100 V channel rating
 *   pool       10·log10(maxBurstTotalW / ΣP)               — shared supply across all channels
 *   Hi-Z pool  10·log10(totalRatedW / ΣP_hiZ)
 *   average    10·log10(maxAvgTotalW / ΣP_avg)             — only when it is a reduction
 * The channel's headroom is the smallest of those; "nearing" below +1 dB, "exceeds" below −2 dB.
 * Mains current and the multi-round PowerShare redistribution of the original tool are
 * left out — they refine the picture, they don't change the verdict.
 *
 * Pure functions, no React, no store.
 */
import type { AmplifierLoadSpec, SpeakerLineMode, SpeakerLoadProfile, SpeakerLoadSpec } from "./types";

// ── Constants ────────────────────────────────────────────────────────

/** Profile → active power in dB below peak (crest factor + average reduction), Bose table. */
export const PROFILE_ACTIVE_POWER_DB: Record<SpeakerLoadProfile, number> = {
  SW: 14,
  LF: 14 + 1.4,
  MF: 16 + 1.2,
  HF: 19 + 0.8,
  FR: 10 * Math.log10(40) + 0.8,
};

export const PROFILE_LABELS: Record<SpeakerLoadProfile, string> = {
  FR: "Full range",
  LF: "Low band",
  MF: "Mid band",
  HF: "High band",
  SW: "Subwoofer",
};

export const LINE_MODE_LABELS: Record<SpeakerLineMode, string> = { "lo-z": "Lo-Z", "70v": "70 V", "100v": "100 V" };

/** Headroom thresholds in dB (Bose: "Nearing" 1, "Exceeds" −2). */
export const HEADROOM_NEARING_DB = 1;
export const HEADROOM_EXCEEDS_DB = -2;

/** Default long-term average capacity as a share of the rated total (PSX4804D: 840 / 4800). */
export const DEFAULT_AVG_POWER_RATIO = 0.175;

// ── Amplifier limits ─────────────────────────────────────────────────

export interface AmpLimits {
  channels: number;
  ratedW: NonNullable<AmplifierLoadSpec["ratedW"]>;
  totalRatedW: number;
  maxBurstPerChannelW: number;
  maxBurstTotalW: number;
  maxAvgTotalW: number;
  peakVoltageV: number;
  peakCurrentA: number;
  minImpedanceOhm: number;
  supportsLoZ: boolean;
  supports70V: boolean;
  supports100V: boolean;
}

function hasNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** True when the spec carries at least one rating the model can work with. */
export function hasAmpLoadData(spec: AmplifierLoadSpec | undefined): spec is AmplifierLoadSpec {
  if (!spec) return false;
  const r = spec.ratedW ?? {};
  return [r.ohm2, r.ohm4, r.ohm8, r.v70, r.v100, spec.totalRatedW, spec.maxBurstPerChannelW].some(hasNumber);
}

/** True when the speaker has what its operating mode needs. */
export function hasSpeakerLoadData(spec: SpeakerLoadSpec | undefined, mode: SpeakerLineMode): spec is SpeakerLoadSpec {
  if (!spec) return false;
  if (mode === "lo-z") return hasNumber(spec.impedanceOhm) && hasNumber(spec.rmsPowerW);
  return Array.isArray(spec.tapsW) && spec.tapsW.some(hasNumber);
}

/** Fill the gaps of a template's amplifier spec from what is known, so a template with
 *  just "4 × 300 W at 4/8 Ω" already yields a verdict. `portChannels` is the count of
 *  speaker-level output ports, used when the spec does not state the channel count. */
export function resolveAmpLimits(spec: AmplifierLoadSpec, portChannels = 1): AmpLimits {
  const r = spec.ratedW ?? {};
  const rated = [r.ohm2, r.ohm4, r.ohm8, r.v70, r.v100].filter(hasNumber);
  const highestRated = rated.length ? Math.max(...rated) : 0;
  const channels = hasNumber(spec.channels) ? Math.round(spec.channels) : Math.max(1, portChannels);
  const totalRatedW = hasNumber(spec.totalRatedW) ? spec.totalRatedW : highestRated * channels;
  const maxBurstPerChannelW = hasNumber(spec.maxBurstPerChannelW) ? spec.maxBurstPerChannelW : (highestRated || totalRatedW / channels);
  const maxBurstTotalW = hasNumber(spec.maxBurstTotalW) ? spec.maxBurstTotalW : totalRatedW;
  const maxAvgTotalW = hasNumber(spec.maxAvgTotalW) ? spec.maxAvgTotalW : totalRatedW * DEFAULT_AVG_POWER_RATIO;

  // Peak voltage: what a sine at the rated power swings, or the 70/100 V line peak.
  const vCandidates: number[] = [];
  if (hasNumber(r.ohm8)) vCandidates.push(Math.sqrt(2 * r.ohm8 * 8));
  if (hasNumber(r.ohm4)) vCandidates.push(Math.sqrt(2 * r.ohm4 * 4));
  if (hasNumber(r.ohm2)) vCandidates.push(Math.sqrt(2 * r.ohm2 * 2));
  if (hasNumber(r.v70)) vCandidates.push(Math.SQRT2 * 70);
  if (hasNumber(r.v100)) vCandidates.push(Math.SQRT2 * 100);
  const peakVoltageV = hasNumber(spec.peakVoltageV) ? spec.peakVoltageV : (vCandidates.length ? Math.max(...vCandidates) : Math.sqrt(2 * maxBurstPerChannelW * 8));

  // Peak current: what the lowest rated impedance draws at its rating.
  const iCandidates: number[] = [];
  if (hasNumber(r.ohm2)) iCandidates.push(Math.sqrt((2 * r.ohm2) / 2));
  if (hasNumber(r.ohm4)) iCandidates.push(Math.sqrt((2 * r.ohm4) / 4));
  if (hasNumber(r.ohm8)) iCandidates.push(Math.sqrt((2 * r.ohm8) / 8));
  const peakCurrentA = hasNumber(spec.peakCurrentA) ? spec.peakCurrentA : (iCandidates.length ? Math.max(...iCandidates) : Math.sqrt((2 * maxBurstPerChannelW) / 8));

  const minImpedanceOhm = hasNumber(spec.minImpedanceOhm)
    ? spec.minImpedanceOhm
    : hasNumber(r.ohm2) ? 2 : hasNumber(r.ohm4) ? 4 : hasNumber(r.ohm8) ? 8 : 4;

  return {
    channels,
    ratedW: r,
    totalRatedW,
    maxBurstPerChannelW,
    maxBurstTotalW,
    maxAvgTotalW,
    peakVoltageV,
    peakCurrentA,
    minImpedanceOhm,
    supportsLoZ: hasNumber(r.ohm2) || hasNumber(r.ohm4) || hasNumber(r.ohm8) || (!hasNumber(r.v70) && !hasNumber(r.v100)),
    supports70V: hasNumber(r.v70),
    supports100V: hasNumber(r.v100),
  };
}

/** The mode a line defaults to on this amplifier: Lo-Z unless the amp is Hi-Z only. */
export function defaultLineMode(spec: AmplifierLoadSpec | undefined): SpeakerLineMode {
  if (!spec) return "lo-z";
  const l = resolveAmpLimits(spec);
  if (!l.supportsLoZ && l.supports100V) return "100v";
  if (!l.supportsLoZ && l.supports70V) return "70v";
  return "lo-z";
}

// ── Channel load ─────────────────────────────────────────────────────

export interface ChannelSpeakerInput {
  /** Load data of the model; undefined counts as "unknown" and is reported, not guessed. */
  spec?: SpeakerLoadSpec;
  /** Speakers of this model on the channel. */
  count: number;
  /** Hi-Z tap for these speakers; undefined = the model's highest tap. */
  tapW?: number;
}

export interface ChannelLoadInput {
  mode: SpeakerLineMode;
  speakers: ChannelSpeakerInput[];
  /** Hi-Z tap applied to every speaker on the channel unless the speaker entry has its own. */
  tapW?: number;
  /** User output offset in dB (Bose "User Output Offset"), default 0. */
  gainOffsetDb?: number;
}

export type LoadStatus = "ok" | "nearing" | "exceeds" | "empty" | "no-data" | "unsupported";

export type LoadLimiter = "voltage" | "current" | "channel-power" | "pool-burst" | "pool-hiz" | "pool-average" | "impedance" | "mode";

export interface ChannelLoadResult {
  mode: SpeakerLineMode;
  speakerCount: number;
  /** Speakers without the load data their mode needs — the result is a lower bound then. */
  speakersWithoutData: number;
  /** Requested burst (sine) power in W — 2× the continuous rating for Lo-Z, the tap sum for Hi-Z. */
  requestedW: number;
  /** Instantaneous peak power, 2 × requestedW. */
  peakW: number;
  /** Long-term average power after the profile's crest factor. */
  averageW: number;
  /** Channel load impedance (nominal) and its expected minimum. */
  impedanceOhm?: number;
  minImpedanceOhm?: number;
  peakVoltageV?: number;
  peakCurrentA?: number;
  /** Per-limit headroom in dB; undefined when the amplifier has no data or the limit doesn't apply. */
  headroom: Partial<Record<LoadLimiter, number>>;
  /** Smallest headroom, after the amplifier-wide pools were applied. */
  headroomDb?: number;
  limitedBy?: LoadLimiter;
  status: LoadStatus;
}

export interface AmplifierLoadResult {
  hasSpec: boolean;
  limits?: AmpLimits;
  channels: ChannelLoadResult[];
  totalRequestedW: number;
  totalAverageW: number;
  /** Pool headroom, dB (burst supply shared by all channels). */
  poolBurstHeadroomDb?: number;
  poolAverageHeadroomDb?: number;
  poolHiZHeadroomDb?: number;
  /** Worst channel status. */
  status: LoadStatus;
}

const dB10 = (ratio: number) => 10 * Math.log10(ratio);
const dB20 = (ratio: number) => 20 * Math.log10(ratio);

function lineVoltage(mode: SpeakerLineMode): number {
  return mode === "70v" ? 70 : 100;
}

/** Highest tap of a speaker, the default Hi-Z setting. */
export function defaultTapW(spec: SpeakerLoadSpec | undefined): number | undefined {
  const taps = (spec?.tapsW ?? []).filter(hasNumber);
  return taps.length ? Math.max(...taps) : undefined;
}

/** Nearest available tap at or below the requested one; the requested value when the
 *  model lists no taps (a custom transformer). */
export function pickTapW(spec: SpeakerLoadSpec | undefined, wantedW: number | undefined): number | undefined {
  if (!hasNumber(wantedW)) return defaultTapW(spec);
  const taps = (spec?.tapsW ?? []).filter(hasNumber);
  if (!taps.length) return wantedW;
  const atOrBelow = taps.filter((t) => t <= wantedW + 1e-9);
  return atOrBelow.length ? Math.max(...atOrBelow) : Math.min(...taps);
}

/** Requested power, impedance and the derived peaks of one channel — independent of the amplifier. */
export function computeChannelDemand(input: ChannelLoadInput): Omit<ChannelLoadResult, "headroom" | "headroomDb" | "limitedBy" | "status"> {
  const offset = Math.pow(10, (input.gainOffsetDb ?? 0) / 10);
  let requestedW = 0;
  let averageW = 0;
  let admittance = 0; // Σ n_i / Z_i for Lo-Z
  let speakerCount = 0;
  let speakersWithoutData = 0;

  for (const s of input.speakers) {
    const n = Math.max(0, Math.round(s.count));
    if (n === 0) continue;
    speakerCount += n;
    if (!hasSpeakerLoadData(s.spec, input.mode)) {
      speakersWithoutData += n;
      continue;
    }
    const profile = s.spec.profile ?? "FR";
    let p: number;
    if (input.mode === "lo-z") {
      p = 2 * s.spec.rmsPowerW! * n * offset;
      admittance += n / s.spec.impedanceOhm!;
    } else {
      const tap = pickTapW(s.spec, s.tapW ?? input.tapW) ?? 0;
      p = tap * n * offset;
    }
    requestedW += p;
    averageW += p * 2 * Math.pow(10, -PROFILE_ACTIVE_POWER_DB[profile] / 10);
  }

  let impedanceOhm: number | undefined;
  if (requestedW > 0) {
    impedanceOhm = input.mode === "lo-z"
      ? (admittance > 0 ? 1 / admittance : undefined)
      : Math.pow(lineVoltage(input.mode), 2) / requestedW;
  }
  const minImpedanceOhm = impedanceOhm === undefined
    ? undefined
    : input.mode === "lo-z" ? impedanceOhm * 0.75 + 0.2 : impedanceOhm * 0.85 + 0.4;

  return {
    mode: input.mode,
    speakerCount,
    speakersWithoutData,
    requestedW,
    peakW: requestedW * 2,
    averageW,
    impedanceOhm,
    minImpedanceOhm,
    peakVoltageV: impedanceOhm !== undefined ? Math.sqrt(requestedW * 2 * impedanceOhm) : undefined,
    peakCurrentA: minImpedanceOhm !== undefined ? Math.sqrt((requestedW * 2) / minImpedanceOhm) : undefined,
  };
}

/** Status for a headroom figure. */
export function statusForHeadroom(headroomDb: number | undefined): LoadStatus {
  if (headroomDb === undefined) return "no-data";
  if (headroomDb <= HEADROOM_EXCEEDS_DB) return "exceeds";
  if (headroomDb <= HEADROOM_NEARING_DB) return "nearing";
  return "ok";
}

const STATUS_RANK: Record<LoadStatus, number> = { ok: 0, empty: 0, "no-data": 1, nearing: 2, unsupported: 3, exceeds: 3 };

function worstStatus(statuses: LoadStatus[]): LoadStatus {
  return statuses.reduce<LoadStatus>((acc, s) => (STATUS_RANK[s] > STATUS_RANK[acc] ? s : acc), "ok");
}

/** Check every channel of one amplifier at once — the pooled supply (PowerShare and its
 *  relatives) means a channel's verdict depends on what the others draw. Channels the
 *  plan doesn't use are passed as empty inputs so the pool math sees all of them. */
export function computeAmplifierLoad(spec: AmplifierLoadSpec | undefined, inputs: ChannelLoadInput[], portChannels = inputs.length): AmplifierLoadResult {
  const demands = inputs.map(computeChannelDemand);
  const totalRequestedW = demands.reduce((a, d) => a + d.requestedW, 0);
  const totalAverageW = demands.reduce((a, d) => a + d.averageW, 0);
  const hiZRequestedW = demands.filter((d) => d.mode !== "lo-z").reduce((a, d) => a + d.requestedW, 0);

  if (!hasAmpLoadData(spec)) {
    const channels = demands.map<ChannelLoadResult>((d) => ({
      ...d,
      headroom: {},
      status: d.speakerCount === 0 ? "empty" : "no-data",
    }));
    return { hasSpec: false, channels, totalRequestedW, totalAverageW, status: worstStatus(channels.map((c) => c.status)) };
  }

  const limits = resolveAmpLimits(spec, portChannels);
  const poolBurstHeadroomDb = totalRequestedW > 0 ? dB10(limits.maxBurstTotalW / totalRequestedW) : undefined;
  const poolAverageHeadroomDb = totalAverageW > 0 ? dB10(limits.maxAvgTotalW / totalAverageW) : undefined;
  const poolHiZHeadroomDb = hiZRequestedW > 0 ? dB10(limits.totalRatedW / hiZRequestedW) : undefined;

  const channels = demands.map<ChannelLoadResult>((d) => {
    if (d.speakerCount === 0) return { ...d, headroom: {}, status: "empty" };
    if (d.requestedW <= 0) return { ...d, headroom: {}, status: "no-data" };

    const modeOk = d.mode === "lo-z" ? limits.supportsLoZ : d.mode === "70v" ? limits.supports70V : limits.supports100V;
    if (!modeOk) return { ...d, headroom: {}, limitedBy: "mode", status: "unsupported" };

    const headroom: Partial<Record<LoadLimiter, number>> = {};
    if (d.mode === "lo-z") {
      headroom.voltage = dB20(limits.peakVoltageV / d.peakVoltageV!);
      headroom.current = dB20(limits.peakCurrentA / d.peakCurrentA!) + dB10(d.minImpedanceOhm! / d.impedanceOhm!);
      headroom["channel-power"] = dB10(limits.maxBurstPerChannelW / d.requestedW);
      if (d.impedanceOhm! < limits.minImpedanceOhm - 1e-9) {
        // Below the amplifier's minimum load: report how far, as a power ratio.
        headroom.impedance = dB10(d.impedanceOhm! / limits.minImpedanceOhm);
      }
    } else {
      const rating = d.mode === "70v" ? limits.ratedW.v70! : limits.ratedW.v100!;
      headroom["channel-power"] = dB10(rating / d.requestedW);
      headroom.current = dB20(limits.peakCurrentA / d.peakCurrentA!) + dB10(d.minImpedanceOhm! / d.impedanceOhm!);
      if (poolHiZHeadroomDb !== undefined) headroom["pool-hiz"] = poolHiZHeadroomDb;
    }
    if (poolBurstHeadroomDb !== undefined) headroom["pool-burst"] = poolBurstHeadroomDb;
    if (poolAverageHeadroomDb !== undefined && poolAverageHeadroomDb < 0) headroom["pool-average"] = poolAverageHeadroomDb;

    let headroomDb = Infinity;
    let limitedBy: LoadLimiter | undefined;
    for (const [k, v] of Object.entries(headroom) as [LoadLimiter, number][]) {
      if (v < headroomDb) { headroomDb = v; limitedBy = k; }
    }
    // Below the minimum load the amplifier protects itself whatever the numbers say — that
    // is the thing to fix first, so it names the verdict.
    if (headroom.impedance !== undefined) limitedBy = "impedance";
    const status: LoadStatus = limitedBy === "impedance" ? "exceeds" : statusForHeadroom(headroomDb);
    return { ...d, headroom, headroomDb: Number.isFinite(headroomDb) ? headroomDb : undefined, limitedBy, status };
  });

  return {
    hasSpec: true,
    limits,
    channels,
    totalRequestedW,
    totalAverageW,
    poolBurstHeadroomDb,
    poolAverageHeadroomDb,
    poolHiZHeadroomDb,
    status: worstStatus(channels.map((c) => c.status)),
  };
}

// ── Formatting ───────────────────────────────────────────────────────

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  ok: "OK",
  nearing: "Nearing limit",
  exceeds: "Exceeds",
  empty: "No speakers",
  "no-data": "No load data",
  unsupported: "Mode not supported",
};

export const LOAD_LIMITER_LABELS: Record<LoadLimiter, string> = {
  voltage: "peak voltage",
  current: "peak current",
  "channel-power": "channel power",
  "pool-burst": "shared power",
  "pool-hiz": "70/100 V total",
  "pool-average": "average power",
  impedance: "minimum impedance",
  mode: "operating mode",
};

export function formatOhm(z: number | undefined): string {
  if (z === undefined || !Number.isFinite(z)) return "–";
  return `${z >= 10 ? Math.round(z) : Math.round(z * 10) / 10} Ω`;
}

export function formatWatt(w: number | undefined): string {
  if (w === undefined || !Number.isFinite(w)) return "–";
  return `${w >= 100 ? Math.round(w) : Math.round(w * 10) / 10} W`;
}

export function formatHeadroom(db: number | undefined): string {
  if (db === undefined || !Number.isFinite(db)) return "–";
  const r = Math.round(db * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toFixed(1)} dB`;
}

/** "4 Ω · 800 W" — the compact load figure for a legend cell. */
export function formatChannelLoad(c: Pick<ChannelLoadResult, "mode" | "impedanceOhm" | "requestedW" | "speakerCount">): string {
  if (c.speakerCount === 0) return "–";
  if (c.requestedW <= 0) return "?";
  if (c.mode === "lo-z") return `${formatOhm(c.impedanceOhm)} · ${formatWatt(c.requestedW)}`;
  return `${LINE_MODE_LABELS[c.mode]} · ${formatWatt(c.requestedW)}`;
}
