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
