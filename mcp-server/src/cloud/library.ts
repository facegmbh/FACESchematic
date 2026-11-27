/**
 * The central device library: every custom device template, kept in Odoo as
 * `face.schematic.template` (Odoo module face_schematic_library, SPEC-odoo-device-library.md).
 * Every call runs with the signed-in user's own Odoo key, as for drawings.
 *
 * Odoo owns the version: it raises it whenever the template JSON changes and refuses a write
 * whose `expected_version` (context) is no longer current. The JSON stored there carries no
 * version of its own; this module puts Odoo's into every template it hands out, so the editor's
 * drift check (templateSync.ts) sees the same number.
 */
import express from "express";
import { OdooError, type OdooClient } from "./odoo.js";
import type { UserRecord } from "./store.js";
import { checkStoredTemplate } from "../templateValidation.generated.js";

const MODEL = "face.schematic.template";
const FIELDS = ["key", "data", "version", "product_id", "write_date", "write_uid"];
const ALL = { context: { active_test: false } };
const MAX_UPLOAD = 1000;

type Many2one = [number, string] | false;
type Template = Record<string, unknown>;

interface TemplateRow {
  id: number;
  key: string;
  data: string;
  version: number;
  product_id: Many2one;
  write_date: string;
  write_uid: Many2one;
}

export interface LibraryEntry {
  key: string;
  version: number;
  productId: number | null;
  productName: string | null;
  /** Odoo's write_date ("YYYY-MM-DD HH:MM:SS", UTC). */
  writeDate: string;
  writtenBy: string | null;
  template: Template;
}

export interface UploadResult {
  added: LibraryEntry[];
  /** Already in Odoo with the same content — the editor now treats them as central. */
  same: LibraryEntry[];
  skipped: { key: string; label: string; reason: "different" | "invalid"; error?: string }[];
}

export class LibraryBadRequest extends Error {}
export class LibraryNotFound extends Error {}
export class LibraryConflict extends Error {
  constructor(
    message: string,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

const NOT_FOUND = "Diese Vorlage gibt es nicht (mehr) in der zentralen Bibliothek.";

function toEntry(row: TemplateRow): LibraryEntry {
  const parsed = JSON.parse(row.data) as Template;
  return {
    key: row.key,
    version: row.version,
    productId: row.product_id ? row.product_id[0] : null,
    productName: row.product_id ? row.product_id[1] : null,
    writeDate: row.write_date,
    writtenBy: row.write_uid ? row.write_uid[1] : null,
    template: { ...parsed, version: row.version },
  };
}

/** The template as Odoo stores it: valid, and without a version of its own. */
function storable(template: unknown): { key: string; data: string; label: string } {
  const problem = checkStoredTemplate(template);
  if (problem) throw new LibraryBadRequest(problem);
  const { version: _version, ...rest } = template as Template;
  return { key: String(rest.id), data: JSON.stringify(rest), label: String(rest.label) };
}

/** Key-order-independent JSON, without the version — what "the same content" means on upload. */
function canonical(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as object)
          .filter((k) => (v as Template)[k] !== undefined)
          .sort()
          .map((k) => [k, walk((v as Template)[k])]),
      );
    }
    return v;
  };
  const { version: _version, ...rest } = (value ?? {}) as Template;
  return JSON.stringify(walk(rest));
}

function productParam(value: unknown): number | false | undefined {
  if (value === undefined) return undefined;
  if (value === null) return false;
  if (Number.isInteger(value) && (value as number) > 0) return value as number;
  throw new LibraryBadRequest("productId muss eine Artikel-ID oder null sein.");
}

async function rowsByKeys(odoo: OdooClient, keys: string[], archivedToo: boolean): Promise<TemplateRow[]> {
  return odoo.call<TemplateRow[]>(MODEL, "search_read", [[["key", "in", keys]]], { fields: FIELDS, ...(archivedToo ? ALL : {}) });
}

async function readRow(odoo: OdooClient, id: number): Promise<TemplateRow> {
  const rows = await odoo.call<TemplateRow[]>(MODEL, "read", [[id]], { fields: FIELDS });
  if (!rows.length) throw new LibraryNotFound(NOT_FOUND);
  return rows[0];
}

async function activeRow(odoo: OdooClient, key: string): Promise<TemplateRow> {
  const [row] = await rowsByKeys(odoo, [key], false);
  if (!row) throw new LibraryNotFound(NOT_FOUND);
  return row;
}

function staleConflict(row: TemplateRow): LibraryConflict {
  const writtenBy = row.write_uid ? row.write_uid[1] : null;
  return new LibraryConflict(
    `${writtenBy ?? "Jemand"} hat die Vorlage inzwischen geändert (Version ${row.version}).`,
    { reason: "stale", writtenBy, writeDate: row.write_date, version: row.version },
  );
}

export async function listTemplates(odoo: OdooClient): Promise<LibraryEntry[]> {
  const rows = await odoo.call<TemplateRow[]>(MODEL, "search_read", [[]], { fields: FIELDS, order: "id" });
  return rows.map(toEntry);
}

export async function createTemplate(
  odoo: OdooClient,
  template: unknown,
  origin: "editor" | "claude",
  productId?: number | false,
): Promise<LibraryEntry> {
  const { key, data } = storable(template);
  // Archived ones count: their key may still sit in drawings.
  if (await odoo.call<number>(MODEL, "search_count", [[["key", "=", key]]], ALL)) {
    throw new LibraryConflict("Diese Vorlage gibt es schon in der zentralen Bibliothek.", { reason: "exists", key });
  }
  const id = await odoo.call<number>(MODEL, "create", [{ key, data, origin, ...(productId ? { product_id: productId } : {}) }]);
  return toEntry(await readRow(odoo, id));
}

/**
 * Change the template, its product, or both. A template change needs the version it was
 * based on; a change of only the product does not, it never changes the template.
 */
export async function updateTemplate(
  odoo: OdooClient,
  key: string,
  template: unknown,
  baseVersion: unknown,
  productId: number | false | undefined,
): Promise<LibraryEntry> {
  const vals: Record<string, unknown> = {};
  if (template !== undefined) {
    const stored = storable(template);
    if (stored.key !== key) throw new LibraryBadRequest(`Die id der Vorlage (${stored.key}) passt nicht zu ${key}.`);
    if (!Number.isInteger(baseVersion)) throw new LibraryBadRequest("baseVersion fehlt — die Version, auf der die Änderung beruht.");
    vals.data = stored.data;
  }
  if (productId !== undefined) vals.product_id = productId;
  if (!Object.keys(vals).length) throw new LibraryBadRequest("Nichts zu ändern: template oder productId fehlt.");

  const row = await activeRow(odoo, key);
  if (vals.data !== undefined && row.version !== baseVersion) throw staleConflict(row);
  const kwargs = vals.data !== undefined ? { context: { expected_version: baseVersion } } : {};
  try {
    await odoo.call(MODEL, "write", [[row.id], vals], kwargs);
  } catch (err) {
    // Someone wrote between our read and our write: Odoo's own guard refused it.
    if (err instanceof OdooError && /UserError/.test(err.odooName)) throw staleConflict(await readRow(odoo, row.id));
    throw err;
  }
  return toEntry(await readRow(odoo, row.id));
}

export async function archiveTemplate(odoo: OdooClient, key: string): Promise<void> {
  const row = await activeRow(odoo, key);
  await odoo.call(MODEL, "write", [[row.id], { active: false }]);
}

/** The browser's own devices, once. Never overwrites: what differs is reported, not replaced. */
export async function uploadTemplates(odoo: OdooClient, templates: unknown): Promise<UploadResult> {
  if (!Array.isArray(templates)) throw new LibraryBadRequest("templates muss eine Liste sein.");
  if (templates.length > MAX_UPLOAD) throw new LibraryBadRequest(`Höchstens ${MAX_UPLOAD} Vorlagen auf einmal.`);
  const result: UploadResult = { added: [], same: [], skipped: [] };
  const labelOf = (t: unknown) => String((t as Template | null)?.label ?? "");
  const keyOf = (t: unknown) => String((t as Template | null)?.id ?? "");

  // Skipped ones are listed in the order they were sent, so the editor's list reads top-down.
  const skipped: (UploadResult["skipped"][number] & { at: number })[] = [];
  const valid: { key: string; data: string; template: unknown; at: number }[] = [];
  templates.forEach((t, at) => {
    try {
      valid.push({ ...storable(t), template: t, at });
    } catch (err) {
      if (!(err instanceof LibraryBadRequest)) throw err;
      skipped.push({ key: keyOf(t), label: labelOf(t), reason: "invalid", error: err.message, at });
    }
  });
  const done = () => {
    result.skipped = skipped.sort((a, b) => a.at - b.at).map(({ at: _at, ...s }) => s);
    return result;
  };
  if (!valid.length) return done();

  const existing = new Map((await rowsByKeys(odoo, valid.map((v) => v.key), true)).map((r) => [r.key, r]));
  const fresh: typeof valid = [];
  for (const v of valid) {
    const row = existing.get(v.key);
    if (!row) {
      if (!fresh.some((f) => f.key === v.key)) fresh.push(v);
    } else if (canonical(JSON.parse(row.data)) === canonical(v.template)) result.same.push(toEntry(row));
    else skipped.push({ key: v.key, label: labelOf(v.template), reason: "different", at: v.at });
  }
  if (fresh.length) {
    const ids = await odoo.call<number[]>(MODEL, "create", [fresh.map(({ key, data }) => ({ key, data, origin: "upload" }))]);
    const rows = await odoo.call<TemplateRow[]>(MODEL, "read", [ids], { fields: FIELDS });
    result.added.push(...rows.map(toEntry));
  }
  return done();
}

export async function searchProducts(odoo: OdooClient, query: string): Promise<{ id: number; name: string; code: string | null }[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await odoo.call<{ id: number; display_name: string; default_code: string | false }[]>(
    "product.product",
    "search_read",
    [["|", ["name", "ilike", q], ["default_code", "ilike", q]]],
    { fields: ["display_name", "default_code"], limit: 20 },
  );
  return rows.map((r) => ({ id: r.id, name: r.display_name, code: r.default_code || null }));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/** Template ids from the editor: custom-…, import-…; nothing that could bend a URL. */
const KEY_PATTERN = /^[\w.:-]{1,200}$/;

/** Routes under /face/api/library; the caller mounts requireUser before them. */
export function createLibraryRouter(odooFor: (user: UserRecord) => OdooClient): express.Router {
  const router = express.Router();
  const odoo = (res: express.Response) => odooFor(res.locals.user as UserRecord);

  const handle =
    (fn: (req: express.Request, res: express.Response) => Promise<unknown>, status = 200): express.RequestHandler =>
    async (req, res) => {
      try {
        const body = await fn(req, res);
        if (body === undefined) res.status(204).end();
        else res.status(status).json(body);
      } catch (err) {
        if (err instanceof LibraryConflict) res.status(409).json({ ...err.body, error: err.message });
        else if (err instanceof LibraryBadRequest) res.status(400).json({ error: err.message });
        else if (err instanceof LibraryNotFound || (err instanceof OdooError && err.kind === "missing"))
          res.status(404).json({ error: NOT_FOUND });
        else if (err instanceof OdooError && err.kind === "credentials") res.status(401).json({ error: err.message });
        else if (err instanceof OdooError && err.kind === "access")
          res.status(403).json({ error: `Keine Berechtigung in Odoo: ${err.message}` });
        else if (err instanceof OdooError && err.kind === "network") res.status(502).json({ error: err.message });
        // Before face_schematic_library is installed, Odoo does not know the model. The editor
        // then simply stays with the browser's own devices.
        else if (err instanceof OdooError && err.message.includes(MODEL))
          res.status(503).json({ error: "Die zentrale Gerätebibliothek ist in Odoo noch nicht installiert (Modul face_schematic_library)." });
        else if (err instanceof OdooError && /ValidationError/.test(err.odooName)) res.status(400).json({ error: err.message });
        else {
          console.error("[library]", req.method, req.originalUrl, err);
          res.status(502).json({ error: "Odoo hat die Anfrage nicht verarbeitet. Bitte erneut versuchen." });
        }
      }
    };

  const keyOf = (req: express.Request): string => {
    const key = String(req.params.key);
    if (!KEY_PATTERN.test(key)) throw new LibraryBadRequest("Ungültige Vorlagen-ID.");
    return key;
  };

  const oneJson = express.json({ limit: "1mb" });

  router.get("/library", handle((_req, res) => listTemplates(odoo(res))));

  router.get("/library/products", handle((req, res) => searchProducts(odoo(res), String(req.query.q ?? ""))));

  router.post(
    "/library",
    oneJson,
    handle(async (req, res) => {
      const origin = req.body?.origin ?? "editor";
      if (origin !== "editor" && origin !== "claude") throw new LibraryBadRequest("origin muss editor oder claude sein.");
      if (req.body?.template === undefined) throw new LibraryBadRequest("template fehlt.");
      return createTemplate(odoo(res), req.body.template, origin, productParam(req.body?.productId));
    }, 201),
  );

  router.put(
    "/library/:key",
    oneJson,
    handle((req, res) =>
      updateTemplate(odoo(res), keyOf(req), req.body?.template, req.body?.baseVersion, productParam(req.body?.productId)),
    ),
  );

  router.post(
    "/library/:key/archive",
    handle(async (req, res) => {
      await archiveTemplate(odoo(res), keyOf(req));
      return undefined;
    }),
  );

  router.post("/library/upload", express.json({ limit: "64mb" }), handle((req, res) => uploadTemplates(odoo(res), req.body?.templates)));

  return router;
}
