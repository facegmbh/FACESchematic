/**
 * Drawings live in Odoo, as attachments on the project (`project.project`) they belong to
 * (SPEC-odoo-drawings.md). Every call runs with the signed-in user's own Odoo key, so Odoo's
 * access rules decide who sees which project — this backend adds none of its own.
 *
 * A drawing is an `ir.attachment` named "<name>.faceschematic.json". The suffix is how this
 * API tells its own files from the project's other attachments; it never reads or
 * overwrites anything else.
 */
import express from "express";
import { OdooError, type OdooClient } from "./odoo.js";
import type { UserRecord } from "./store.js";

export const DRAWING_SUFFIX = ".faceschematic.json";

export interface ProjectSummary {
  id: number;
  name: string;
  customer: string | null;
}

export interface DrawingSummary {
  id: number;
  name: string;
  projectId: number;
  /** Odoo's write_date of the attachment ("YYYY-MM-DD HH:MM:SS", UTC). */
  writeDate: string;
  writtenBy: string | null;
  sizeBytes: number;
}

type Many2one = [number, string] | false;

interface AttachmentRow {
  id: number;
  name: string;
  res_model: string | false;
  res_id: number;
  write_date: string;
  write_uid: Many2one;
  file_size: number;
  datas?: string | false;
}

const ATTACHMENT_FIELDS = ["name", "res_model", "res_id", "write_date", "write_uid", "file_size"];

export const drawingDisplayName = (attachmentName: string) =>
  attachmentName.endsWith(DRAWING_SUFFIX) ? attachmentName.slice(0, -DRAWING_SUFFIX.length) : attachmentName;

function toSummary(row: AttachmentRow): DrawingSummary {
  return {
    id: row.id,
    name: drawingDisplayName(row.name),
    projectId: row.res_id,
    writeDate: row.write_date,
    writtenBy: row.write_uid ? row.write_uid[1] : null,
    sizeBytes: row.file_size,
  };
}

export class NotFoundError extends Error {}

export async function listProjects(odoo: OdooClient, query = "", limit = 50): Promise<ProjectSummary[]> {
  const q = query.trim();
  const domain = q ? ["|", ["name", "ilike", q], ["partner_id.name", "ilike", q]] : [];
  const rows = await odoo.call<{ id: number; name: string; partner_id: Many2one }[]>(
    "project.project",
    "search_read",
    [domain],
    { fields: ["name", "partner_id"], limit, order: "write_date desc" },
  );
  return rows.map((r) => ({ id: r.id, name: r.name, customer: r.partner_id ? r.partner_id[1] : null }));
}

async function projectName(odoo: OdooClient, projectId: number): Promise<string> {
  const rows = await odoo.call<{ id: number; name: string }[]>("project.project", "read", [[projectId]], { fields: ["name"] });
  if (!rows.length) throw new NotFoundError(`Projekt ${projectId} gibt es nicht oder es ist nicht sichtbar.`);
  return rows[0].name;
}

export async function listDrawings(odoo: OdooClient, projectId: number): Promise<DrawingSummary[]> {
  const rows = await odoo.call<AttachmentRow[]>(
    "ir.attachment",
    "search_read",
    [[["res_model", "=", "project.project"], ["res_id", "=", projectId], ["name", "=like", `%${DRAWING_SUFFIX}`]]],
    { fields: ATTACHMENT_FIELDS, order: "write_date desc" },
  );
  return rows.map(toSummary);
}

/** A drawing attachment, or NotFoundError for anything else — another model, another file. */
async function readDrawingRow(odoo: OdooClient, id: number, withData: boolean): Promise<AttachmentRow> {
  const rows = await odoo.call<AttachmentRow[]>("ir.attachment", "read", [[id]], {
    fields: withData ? [...ATTACHMENT_FIELDS, "datas"] : ATTACHMENT_FIELDS,
  });
  const row = rows[0];
  if (!row || row.res_model !== "project.project" || !row.name.endsWith(DRAWING_SUFFIX)) {
    throw new NotFoundError("Diese Zeichnung gibt es nicht (mehr) an einem Odoo-Projekt.");
  }
  return row;
}

export async function loadDrawing(odoo: OdooClient, id: number) {
  const row = await readDrawingRow(odoo, id, true);
  const json = row.datas ? Buffer.from(row.datas, "base64").toString("utf8") : "null";
  return { ...toSummary(row), projectName: await projectName(odoo, row.res_id), data: JSON.parse(json) as unknown };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function idParam(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Routes under /face/api; the caller mounts requireUser before them. */
export function createDrawingsRouter(odooFor: (user: UserRecord) => OdooClient): express.Router {
  const router = express.Router();
  const odoo = (res: express.Response) => odooFor(res.locals.user as UserRecord);

  const handle =
    (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
    async (req, res) => {
      try {
        res.json(await fn(req, res));
      } catch (err) {
        if (err instanceof NotFoundError) res.status(404).json({ error: err.message });
        // A key revoked in Odoo: the app asks the user to sign in again.
        else if (err instanceof OdooError && err.kind === "credentials") res.status(401).json({ error: err.message });
        else res.status(502).json({ error: err instanceof Error ? err.message : "Odoo-Fehler." });
      }
    };

  /** Rejects a non-numeric id before anything reaches Odoo. */
  const withId: express.RequestHandler = (req, res, next) => {
    if (idParam(String(req.params.id)) === null) {
      res.status(400).json({ error: "Ungültige ID." });
      return;
    }
    next();
  };

  router.get(
    "/projects",
    handle((req, res) => listProjects(odoo(res), String(req.query.q ?? ""))),
  );

  router.get(
    "/projects/:id/drawings",
    withId,
    handle(async (req, res) =>
      (await listDrawings(odoo(res), Number(req.params.id))).map((d) => ({ ...d, editedBy: null, editedSince: null })),
    ),
  );

  router.get(
    "/drawings/:id",
    withId,
    handle((req, res) => loadDrawing(odoo(res), Number(req.params.id))),
  );

  return router;
}
