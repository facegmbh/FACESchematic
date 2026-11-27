/**
 * Checks for device templates on their way into the central library in Odoo
 * (SPEC-odoo-device-library.md). Pure and free of app imports: it runs in the editor and,
 * copied by mcp-server/scripts/sync-protocol.mjs, in the backend.
 *
 * `checkStoredTemplate` is the loose check every stored template passes — anything the
 * device editor can make, slots and passthrough ports included. It guards the shape the app
 * relies on, the size, the value lists, and links: a template is now shared with every
 * colleague, so a `javascript:` link would run in their browser.
 */
import {
  SIGNAL_TYPES_WIRE,
  CONNECTOR_TYPES_WIRE,
  PORT_DIRECTIONS_WIRE,
  MAX_TEMPLATE_BYTES,
  MAX_TEMPLATE_PORTS,
  DEVICE_TYPES_WIRE,
  SPEAKER_PROFILES_WIRE,
} from "./protocol";

const SIGNALS: ReadonlySet<string> = new Set(SIGNAL_TYPES_WIRE);
const CONNECTORS: ReadonlySet<string> = new Set(CONNECTOR_TYPES_WIRE);
const DIRECTIONS: ReadonlySet<string> = new Set(PORT_DIRECTIONS_WIRE);

/** Per text field — generous, installation notes run long; the template size caps the rest. */
const MAX_TEXT = 10_000;
const TEXT_FIELDS = ["shortName", "manufacturer", "modelNumber", "category", "hostname", "voltage", "installCable", "installNotes", "color", "headerColor", "slotFamily"] as const;
const LINK_FIELDS = ["imageUrl", "referenceUrl"] as const;
const PORT_CONNECTOR_FIELDS = ["connectorType", "frontConnectorType", "rearConnectorType"] as const;

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isLink = (v: string) => /^https?:\/\//i.test(v.trim());

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function checkPort(port: unknown, n: number, seen: Set<string>): string | null {
  if (!isRecord(port)) return `Port ${n} ist kein Objekt.`;
  if (!filled(port.id)) return `Port ${n} hat keine id.`;
  if (typeof port.label !== "string") return `Port ${n} hat kein label.`;
  if (seen.has(port.id)) return `Die Port-id „${port.id}“ kommt doppelt vor.`;
  seen.add(port.id);
  if (typeof port.signalType !== "string" || !SIGNALS.has(port.signalType)) {
    return `Port ${n} („${port.label}“): signalType „${String(port.signalType)}“ ist unbekannt.`;
  }
  if (typeof port.direction !== "string" || !DIRECTIONS.has(port.direction)) {
    return `Port ${n} („${port.label}“): direction „${String(port.direction)}“ ist unbekannt (${PORT_DIRECTIONS_WIRE.join(", ")}).`;
  }
  for (const field of PORT_CONNECTOR_FIELDS) {
    const value = port[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || !CONNECTORS.has(value)) {
      return `Port ${n} („${port.label}“): ${field} „${String(value)}“ ist unbekannt.`;
    }
  }
  return null;
}

function problemOf(t: unknown): string | null {
  if (!isRecord(t)) return "Die Vorlage ist kein Objekt.";
  if (!filled(t.id)) return "Die Vorlage hat keine id.";
  if (!filled(t.label)) return "Die Vorlage hat kein label.";
  if (typeof t.deviceType !== "string") return "deviceType muss Text sein.";
  if (t.version !== undefined && !(Number.isInteger(t.version) && (t.version as number) >= 0)) {
    return "version muss eine ganze Zahl ab 0 sein.";
  }
  for (const field of TEXT_FIELDS) {
    const value = t[field];
    if (value !== undefined && (typeof value !== "string" || value.length > MAX_TEXT)) {
      return `${field} muss Text mit höchstens ${MAX_TEXT} Zeichen sein.`;
    }
  }
  for (const field of LINK_FIELDS) {
    const value = t[field];
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || !isLink(value)) return `${field} muss mit http:// oder https:// beginnen.`;
  }
  if (t.searchTerms !== undefined && !(Array.isArray(t.searchTerms) && t.searchTerms.every((s) => typeof s === "string"))) {
    return "searchTerms muss eine Liste aus Text sein.";
  }
  if (t.slots !== undefined && !Array.isArray(t.slots)) return "slots muss eine Liste sein.";
  if (!Array.isArray(t.ports)) return "ports muss eine Liste sein.";
  if (t.ports.length > MAX_TEMPLATE_PORTS) return `Mehr als ${MAX_TEMPLATE_PORTS} Ports.`;
  const seen = new Set<string>();
  for (let i = 0; i < t.ports.length; i++) {
    const problem = checkPort(t.ports[i], i + 1, seen);
    if (problem) return problem;
  }
  const bytes = byteLength(t);
  if (bytes > MAX_TEMPLATE_BYTES) {
    return `Die Vorlage ist zu groß (${Math.ceil(bytes / 1024)} KB, höchstens ${MAX_TEMPLATE_BYTES / 1024} KB).`;
  }
  return null;
}

/**
 * Why `template` may not go into the central library, as a German sentence naming the
 * template and the field — or null when it may. Loose on purpose: anything the device
 * editor makes passes (free deviceType, slots, passthrough, load and coverage data).
 */
export function checkStoredTemplate(template: unknown): string | null {
  const problem = problemOf(template);
  if (!problem) return null;
  const label = isRecord(template) && filled(template.label) ? template.label.trim() : null;
  return label ? `Vorlage „${label}“: ${problem}` : problem;
}

// =============================================================================================
// What Claude may send (SPEC-device-template.md) — strict: every field is checked against its
// limits, unknown ones are refused rather than dropped, and blocks with consequences elsewhere
// (slots, Wi-Fi, plan symbol, passthrough ports) can only come from a base template.
// =============================================================================================

const DEVICE_TYPES: ReadonlySet<string> = new Set(DEVICE_TYPES_WIRE);
const INPUT_DIRECTIONS = ["input", "output", "bidirectional"] as const;
const MAX_INPUT_PORTS = 256;

/** Fields that belong to the command, not the template. */
const CONTROL_KEYS = {
  create: new Set(["baseTemplateId", "productId", "allowDuplicate"]),
  update: new Set(["templateId", "baseVersion", "productId"]),
};
const SHORT_TEXT = ["manufacturer", "modelNumber", "shortName"] as const;
const LONG_TEXT = ["voltage", "installCable", "installNotes"] as const;
const NUMBERS = ["powerDrawW", "poeBudgetW", "poeDrawW", "unitCost", "heightMm", "widthMm", "depthMm", "weightKg"] as const;
const LINKS = ["referenceUrl", "imageUrl"] as const;
const BLOCKS = ["speakerLoad", "ampLoad", "detection", "micCoverage"] as const;
const FROM_BASE_ONLY = new Set(["slots", "wifi", "planSymbol", "auxiliaryData", "slotFamily", "category", "color", "headerColor", "id", "version"]);
const PORT_FIELDS = new Set(["id", "label", "signalType", "direction", "connectorType", "section", "multiConnect", "poeDrawW", "notes"]);

class InputError extends Error {}

const fail = (message: string): never => {
  throw new InputError(message);
};

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") fail(`${field} muss Text sein.`);
  const v = (value as string).trim();
  if (v.length > max) fail(`${field} darf höchstens ${max} Zeichen haben.`);
  return v;
}

function num(value: unknown, field: string, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    fail(`${field} muss ${integer ? "eine ganze Zahl" : "eine Zahl"} von ${min} bis ${max} sein.`);
  }
  return value as number;
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(`${field} muss true oder false sein.`);
  return value as boolean;
}

/** An object with only the named keys, each checked by its function. */
function block(value: unknown, field: string, checks: Record<string, (v: unknown, f: string) => unknown>): Rec {
  if (!isRecord(value)) fail(`${field} muss ein Objekt sein.`);
  const out: Rec = {};
  for (const [key, v] of Object.entries(value as Rec)) {
    const check = checks[key];
    if (!check) fail(`${field}: Unbekanntes Feld „${key}“ (erlaubt: ${Object.keys(checks).join(", ")}).`);
    if (v !== undefined) out[key] = check(v, `${field}.${key}`);
  }
  return out;
}

const size = (v: unknown, f: string) => block(v, f, { w: (x, g) => num(x, g, 0.5, 30), d: (x, g) => num(x, g, 0.5, 30) });

function speakerLoad(value: unknown): Rec {
  return block(value, "speakerLoad", {
    impedanceOhm: (v, f) => num(v, f, 2, 64),
    rmsPowerW: (v, f) => num(v, f, 0, 5000),
    tapsW: (v, f) => {
      if (!Array.isArray(v) || v.length > 12) fail(`${f} muss eine Liste mit höchstens 12 Werten sein.`);
      const taps = (v as unknown[]).map((x, i) => num(x, `${f}[${i}]`, 0.1, 5000));
      for (let i = 1; i < taps.length; i++) if (taps[i] >= taps[i - 1]) fail(`${f} muss absteigend sein, z. B. [30, 15, 7.5].`);
      return taps;
    },
    profile: (v, f) => {
      if (!(SPEAKER_PROFILES_WIRE as readonly unknown[]).includes(v)) fail(`${f} muss einer von ${SPEAKER_PROFILES_WIRE.join(", ")} sein.`);
      return v;
    },
  });
}

function ampLoad(value: unknown): Rec {
  const watts = (v: unknown, f: string) => num(v, f, 0, 100_000);
  return block(value, "ampLoad", {
    channels: (v, f) => num(v, f, 1, 64, true),
    ratedW: (v, f) =>
      block(v, f, { ohm2: watts, ohm4: watts, ohm8: watts, v70: watts, v100: watts }),
    totalRatedW: watts,
    maxBurstPerChannelW: watts,
    maxBurstTotalW: watts,
    maxAvgTotalW: watts,
    peakVoltageV: (v, f) => num(v, f, 0, 1000),
    peakCurrentA: (v, f) => num(v, f, 0, 200),
    minImpedanceOhm: (v, f) => num(v, f, 1, 64),
    hiZBridgesPairs: bool,
  });
}

function detection(value: unknown): Rec {
  const d = block(value, "detection", {
    shape: (v, f) => {
      if (v !== "sector" && v !== "circle" && v !== "rect") fail(`${f} muss sector, circle oder rect sein.`);
      return v;
    },
    rangeM: (v, f) => num(v, f, 0.5, 200),
    apertureDeg: (v, f) => num(v, f, 1, 360),
    widthM: (v, f) => num(v, f, 0.1, 100),
  });
  if (d.shape === undefined || d.rangeM === undefined) fail("detection braucht shape und rangeM.");
  if (d.shape === "sector" && d.apertureDeg === undefined) fail("detection mit shape sector braucht apertureDeg (Öffnungswinkel in Grad).");
  if (d.shape === "rect" && d.widthM === undefined) fail("detection mit shape rect braucht widthM (Breite des Korridors in Metern).");
  return d;
}

function micCoverage(value: unknown): Rec {
  const m = block(value, "micCoverage", {
    areaM: size,
    minSideM: (v, f) => num(v, f, 0.5, 30),
    fixed: bool,
    maxAreas: (v, f) => num(v, f, 1, 16, true),
    dedicatedAreaM: size,
    maxTalkerDistanceM: (v, f) => num(v, f, 0.5, 30),
    maxMountHeightM: (v, f) => num(v, f, 1, 30),
  });
  if (m.areaM === undefined) fail("micCoverage braucht areaM ({ w, d } in Metern).");
  return m;
}

const BLOCK_CHECKS: Record<(typeof BLOCKS)[number], (v: unknown) => Rec> = { speakerLoad, ampLoad, detection, micCoverage };

/** Port fields as given; `full` demands label, signalType and direction (a new port). */
function portFields(port: Rec, n: number, full: boolean): Rec {
  const where = `Port ${n}${typeof port.label === "string" ? ` („${port.label}“)` : ""}`;
  for (const key of Object.keys(port)) {
    if (!PORT_FIELDS.has(key)) fail(`${where}: Unbekanntes Feld „${key}“ (erlaubt: ${[...PORT_FIELDS].join(", ")}).`);
  }
  if (full) for (const key of ["label", "signalType", "direction"]) if (port[key] === undefined) fail(`${where}: ${key} fehlt.`);
  const out: Rec = {};
  if (port.label !== undefined) {
    out.label = text(port.label, `${where}: label`, 120);
    if (!out.label) fail(`${where}: label ist leer.`);
  }
  if (port.signalType !== undefined) {
    if (typeof port.signalType !== "string" || !SIGNALS.has(port.signalType)) fail(`${where}: signalType „${String(port.signalType)}“ ist unbekannt.`);
    out.signalType = port.signalType;
  }
  if (port.direction !== undefined) {
    if (port.direction === "passthrough") fail(`${where}: passthrough-Ports lassen sich nur über baseTemplateId übernehmen.`);
    if (!(INPUT_DIRECTIONS as readonly unknown[]).includes(port.direction)) fail(`${where}: direction muss input, output oder bidirectional sein.`);
    out.direction = port.direction;
  }
  if (port.connectorType !== undefined) {
    if (typeof port.connectorType !== "string" || !CONNECTORS.has(port.connectorType)) fail(`${where}: connectorType „${String(port.connectorType)}“ ist unbekannt.`);
    out.connectorType = port.connectorType;
  }
  if (port.section !== undefined) out.section = text(port.section, `${where}: section`, 60);
  if (port.notes !== undefined) out.notes = text(port.notes, `${where}: notes`, 500);
  if (port.multiConnect !== undefined) out.multiConnect = bool(port.multiConnect, `${where}: multiConnect`);
  if (port.poeDrawW !== undefined) out.poeDrawW = num(port.poeDrawW, `${where}: poeDrawW`, 0, 100);
  return out;
}

/**
 * The port list after this input. Creating: every entry is a full new port. Changing: an entry
 * with the id of an existing port changes only what it names, one without an id is new, and
 * existing ports that are not listed are removed.
 */
function buildPorts(input: unknown, existing: Rec[] | null): { ports: Rec[]; added: string[]; removed: string[] } {
  if (!Array.isArray(input) || input.length === 0) fail("ports muss eine Liste mit mindestens einem Port sein.");
  const list = input as unknown[];
  if (list.length > MAX_INPUT_PORTS) fail(`Höchstens ${MAX_INPUT_PORTS} Ports.`);
  const byId = new Map((existing ?? []).map((p) => [String(p.id), p]));
  const used = new Set<string>();
  const drafts: { id?: string; port: Rec; isNew: boolean }[] = [];
  list.forEach((raw, i) => {
    if (!isRecord(raw)) fail(`Port ${i + 1} ist kein Objekt.`);
    const entry = raw as Rec;
    const id = entry.id === undefined ? undefined : text(entry.id, `Port ${i + 1}: id`, 60);
    if (id !== undefined) {
      if (!id) fail(`Port ${i + 1}: id ist leer.`);
      if (used.has(id)) fail(`Die Port-id „${id}“ kommt doppelt vor.`);
      used.add(id);
    }
    const old = id !== undefined && existing ? byId.get(id) : undefined;
    if (existing && id !== undefined && !old) {
      fail(`Port-id „${id}“ gibt es in dieser Vorlage nicht. Neue Ports ohne id angeben.`);
    }
    const fields = portFields(entry, i + 1, !old);
    drafts.push({ id, port: old ? { ...old, ...fields } : fields, isNew: !old });
  });
  let next = 1;
  const freshId = () => {
    while (used.has(`p${next}`) || byId.has(`p${next}`)) next++;
    used.add(`p${next}`);
    return `p${next}`;
  };
  const ports = drafts.map((d) => ({ id: d.id ?? freshId(), ...d.port }));
  const added = drafts.map((d, i) => (d.isNew ? String(ports[i].id) : null)).filter((x): x is string => x !== null);
  const kept = new Set(ports.map((p) => String(p.id)));
  const removed = existing ? existing.map((p) => String(p.id)).filter((id) => !kept.has(id)) : [];
  return { ports, added: existing ? added : [], removed };
}

/** Device types close to what was typed, for the error sentence. */
function closeDeviceTypes(typed: string): string[] {
  const t = typed.toLowerCase();
  const distance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cur = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
    }
    return row[b.length];
  };
  return [...DEVICE_TYPES]
    .map((d) => ({ d, score: d.includes(t) || t.includes(d) ? 0 : distance(t, d) }))
    .filter((x) => x.score <= 3)
    .sort((a, b) => a.score - b.score || a.d.localeCompare(b.d))
    .slice(0, 5)
    .map((x) => x.d);
}

export type TemplateInputResult =
  | { template: Rec; addedPorts: string[]; removedPorts: string[] }
  | { error: string };

/**
 * A template from what Claude sent: a new one (`create`, optionally derived from `base`) or the
 * changed `base` (`update`). The result always passes `checkStoredTemplate` once it has an id.
 * Errors are German sentences naming the field, meant to be passed on as they are.
 */
export function parseTemplateInput(params: unknown, opts: { mode: "create" | "update"; base?: Rec }): TemplateInputResult {
  try {
    if (!isRecord(params)) fail("Die Angaben müssen ein Objekt sein.");
    const input = params as Rec;
    const { mode, base } = opts;
    if (mode === "update" && !base) fail("Zum Ändern fehlt die bestehende Vorlage.");
    const control = CONTROL_KEYS[mode];
    const allowed = new Set<string>(["label", "deviceType", "ports", "searchTerms", ...SHORT_TEXT, ...LONG_TEXT, ...NUMBERS, ...LINKS, ...BLOCKS]);
    for (const key of Object.keys(input)) {
      if (control.has(key) || allowed.has(key)) continue;
      if (FROM_BASE_ONLY.has(key)) fail(`„${key}“ lässt sich nicht angeben – nur über baseTemplateId von einer bestehenden Vorlage übernehmen.`);
      fail(`Unbekanntes Feld „${key}“.`);
    }

    const template: Rec = base ? structuredClone(base) : {};
    if (mode === "create") {
      delete template.id;
      delete template.version;
    }
    const set = (key: string, value: unknown) => {
      if (value === undefined) delete template[key];
      else template[key] = value;
    };

    if (input.label !== undefined || mode === "create") {
      if (input.label === undefined) fail("label fehlt – der Name der neuen Vorlage.");
      const label = text(input.label, "label", 120);
      if (!label) fail("label ist leer.");
      template.label = label;
    }

    if (input.deviceType !== undefined) {
      const type = text(input.deviceType, "deviceType", 60);
      if (!DEVICE_TYPES.has(type)) {
        const close = closeDeviceTypes(type);
        fail(`deviceType „${type}“ ist unbekannt.${close.length ? ` Gemeint vielleicht: ${close.join(", ")}?` : ""}`);
      }
      template.deviceType = type;
    } else if (template.deviceType === undefined) {
      fail("deviceType fehlt.");
    }

    for (const key of SHORT_TEXT) if (input[key] !== undefined) set(key, input[key] === null ? undefined : text(input[key], key, 120) || undefined);
    for (const key of LONG_TEXT) if (input[key] !== undefined) set(key, input[key] === null ? undefined : text(input[key], key, 2000) || undefined);
    for (const key of NUMBERS) if (input[key] !== undefined) set(key, input[key] === null ? undefined : num(input[key], key, 0, 1_000_000));
    for (const key of LINKS) {
      if (input[key] === undefined) continue;
      const v = input[key] === null ? "" : text(input[key], key, 2000);
      if (v && !/^https:\/\//i.test(v)) fail(`${key} muss mit https:// beginnen.`);
      set(key, v || undefined);
    }
    if (input.searchTerms !== undefined) {
      if (input.searchTerms === null) set("searchTerms", undefined);
      else {
        if (!Array.isArray(input.searchTerms) || input.searchTerms.length > 20) fail("searchTerms muss eine Liste mit höchstens 20 Begriffen sein.");
        set("searchTerms", (input.searchTerms as unknown[]).map((v, i) => text(v, `searchTerms[${i}]`, 60)).filter(Boolean));
      }
    }
    for (const key of BLOCKS) {
      if (input[key] === undefined) continue;
      set(key, input[key] === null ? undefined : BLOCK_CHECKS[key](input[key]));
    }

    let addedPorts: string[] = [];
    let removedPorts: string[] = [];
    if (input.ports !== undefined) {
      const existing = mode === "update" && Array.isArray(template.ports) ? (template.ports as Rec[]) : null;
      const built = buildPorts(input.ports, existing);
      template.ports = built.ports;
      addedPorts = built.added;
      removedPorts = built.removed;
    } else if (!Array.isArray(template.ports)) {
      fail("ports fehlt – die Anschlüsse der Vorlage.");
    }

    const problem = checkStoredTemplate({ ...template, id: template.id ?? "custom-check" });
    if (problem) fail(problem);
    return { template, addedPorts, removedPorts };
  } catch (err) {
    if (err instanceof InputError) return { error: err.message };
    throw err;
  }
}
