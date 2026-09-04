import type { DeviceTemplate, Port } from "../types";
import { DEVICE_TYPE_TO_CATEGORY } from "../deviceTypeCategories";
import { validateTemplate } from "./validate";
import { generatePortId, generateTemplateId, type ParseResult, type ParsedTemplate } from "./types";

/** Parse a JSON string into one or more device templates.
 * Accepts either a single object or an array. Unknown fields are stripped. */
const PLAN_SHAPES = new Set(["circle", "square", "triangle", "diamond"]);
function isPlanSymbol(v: unknown): v is { shape: "circle" | "square" | "triangle" | "diamond"; color?: unknown; glyph?: unknown } {
  return !!v && typeof v === "object" && PLAN_SHAPES.has(String((v as { shape?: unknown }).shape));
}

export function parseJsonImport(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return {
      templates: [],
      fatalErrors: [`Not valid JSON: ${(e as Error).message}`],
    };
  }

  const items: unknown[] = Array.isArray(json) ? json : [json];
  const templates: ParsedTemplate[] = [];
  const fatalErrors: string[] = [];

  items.forEach((item, idx) => {
    if (!item || typeof item !== "object") {
      fatalErrors.push(`Item ${idx}: not an object`);
      return;
    }
    const normalized = normalizeTemplate(item as Record<string, unknown>);
    const validation = validateTemplate(normalized);
    templates.push({
      template: normalized as DeviceTemplate,
      validation,
      source: items.length > 1 ? `entry ${idx + 1}` : undefined,
    });
  });

  return { templates, fatalErrors };
}

function normalizeTemplate(raw: Record<string, unknown>): Partial<DeviceTemplate> {
  const ports = Array.isArray(raw.ports)
    ? raw.ports
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p, i) => normalizePort(p, i))
    : [];

  // Derive category from deviceType if not provided (or if user gave a freeform value)
  const deviceType = typeof raw.deviceType === "string" ? raw.deviceType : "";
  const derivedCategory = DEVICE_TYPE_TO_CATEGORY[deviceType];
  const category = typeof raw.category === "string" && raw.category.trim()
    ? raw.category
    : derivedCategory ?? "Uncategorized";

  return {
    id: typeof raw.id === "string" ? raw.id : generateTemplateId(),
    label: str(raw.label),
    deviceType,
    category,
    manufacturer: str(raw.manufacturer),
    modelNumber: str(raw.modelNumber),
    referenceUrl: str(raw.referenceUrl),
    installCable: str(raw.installCable),
    installNotes: str(raw.installNotes),
    planSymbol: isPlanSymbol(raw.planSymbol) ? { shape: raw.planSymbol.shape, color: str(raw.planSymbol.color), glyph: str(raw.planSymbol.glyph) } : undefined,
    speakerLoad: speakerLoad(raw.speakerLoad),
    ampLoad: ampLoad(raw.ampLoad),
    color: str(raw.color),
    headerColor: str(raw.headerColor),
    imageUrl: str(raw.imageUrl),
    searchTerms: Array.isArray(raw.searchTerms)
      ? raw.searchTerms.filter((s): s is string => typeof s === "string")
      : undefined,
    powerDrawW: num(raw.powerDrawW),
    powerCapacityW: num(raw.powerCapacityW),
    voltage: str(raw.voltage),
    thermalBtuh: num(raw.thermalBtuh),
    poeBudgetW: num(raw.poeBudgetW),
    unitCost: num(raw.unitCost),
    heightMm: num(raw.heightMm),
    widthMm: num(raw.widthMm),
    depthMm: num(raw.depthMm),
    weightKg: num(raw.weightKg),
    isVenueProvided: typeof raw.isVenueProvided === "boolean" ? raw.isVenueProvided : undefined,
    ports: ports as Port[],
  };
}

function normalizePort(raw: Record<string, unknown>, index: number): Partial<Port> {
  return {
    id: typeof raw.id === "string" ? raw.id : generatePortId(index),
    label: str(raw.label) ?? "",
    signalType: (typeof raw.signalType === "string" ? raw.signalType : "") as Port["signalType"],
    direction: (typeof raw.direction === "string" ? raw.direction : "input") as Port["direction"],
    connectorType: typeof raw.connectorType === "string" ? raw.connectorType as Port["connectorType"] : undefined,
    section: str(raw.section),
  };
}

const LOAD_PROFILES = new Set(["FR", "LF", "MF", "HF", "SW"]);

/** Loudspeaker load data; only well-formed numbers survive. */
function speakerLoad(v: unknown): DeviceTemplate["speakerLoad"] {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const taps = Array.isArray(o.tapsW) ? o.tapsW.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t > 0) : undefined;
  const out = {
    impedanceOhm: num(o.impedanceOhm),
    rmsPowerW: num(o.rmsPowerW),
    tapsW: taps && taps.length ? taps : undefined,
    profile: typeof o.profile === "string" && LOAD_PROFILES.has(o.profile) ? (o.profile as NonNullable<DeviceTemplate["speakerLoad"]>["profile"]) : undefined,
  };
  return Object.values(out).some((x) => x !== undefined) ? out : undefined;
}

/** Amplifier output capability. */
function ampLoad(v: unknown): DeviceTemplate["ampLoad"] {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const r = o.ratedW && typeof o.ratedW === "object" ? (o.ratedW as Record<string, unknown>) : {};
  const ratedW = { ohm2: num(r.ohm2), ohm4: num(r.ohm4), ohm8: num(r.ohm8), v70: num(r.v70), v100: num(r.v100) };
  const out = {
    channels: num(o.channels),
    ratedW: Object.values(ratedW).some((x) => x !== undefined) ? ratedW : undefined,
    totalRatedW: num(o.totalRatedW),
    maxBurstPerChannelW: num(o.maxBurstPerChannelW),
    maxBurstTotalW: num(o.maxBurstTotalW),
    maxAvgTotalW: num(o.maxAvgTotalW),
    peakVoltageV: num(o.peakVoltageV),
    peakCurrentA: num(o.peakCurrentA),
    minImpedanceOhm: num(o.minImpedanceOhm),
  };
  return Object.values(out).some((x) => x !== undefined) ? out : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (isFinite(n)) return n;
  }
  return undefined;
}
