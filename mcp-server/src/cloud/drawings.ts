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
import type { Presence } from "./presence.js";

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
export class BadRequestError extends Error {}

/** What a client may store: a schematic file — an object with a list of nodes. Anything else
 *  would land in Odoo and break every editor that opens it. */
function assertSchematic(data: unknown): void {
  const d = data as { nodes?: unknown } | null;
  if (!d || typeof d !== "object" || Array.isArray(d) || !Array.isArray(d.nodes)) {
    throw new BadRequestError("Das ist kein Schaltplan.");
  }
}

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

/** A file name Odoo and every download accept, from whatever the user typed. */
export function attachmentNameFor(displayName: string): string {
  const clean = displayName
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${clean || "Zeichnung"}${DRAWING_SUFFIX}`;
}

const encode = (data: unknown) => Buffer.from(JSON.stringify(data), "utf8").toString("base64");

/** A refusal the client acts on (409): the body says why. */
export class ConflictError extends Error {
  constructor(
    message: string,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function createDrawing(odoo: OdooClient, projectId: number, name: string, data: unknown) {
  assertSchematic(data);
  const project = await projectName(odoo, projectId);
  const fileName = attachmentNameFor(name);
  const taken = await odoo.call<number>("ir.attachment", "search_count", [
    [["res_model", "=", "project.project"], ["res_id", "=", projectId], ["name", "=", fileName]],
  ]);
  if (taken) {
    throw new ConflictError("Eine Zeichnung mit diesem Namen gibt es in diesem Projekt schon.", { reason: "exists" });
  }
  const id = await odoo.call<number>("ir.attachment", "create", [
    { name: fileName, res_model: "project.project", res_id: projectId, mimetype: "application/json", datas: encode(data) },
  ]);
  return { ...toSummary(await readDrawingRow(odoo, id, false)), projectName: project };
}

/** Overwrite — unless someone else saved since `baseWriteDate` and the caller did not insist. */
export async function saveDrawing(odoo: OdooClient, id: number, data: unknown, baseWriteDate: string, force: boolean) {
  assertSchematic(data);
  const current = await readDrawingRow(odoo, id, false);
  if (!force && current.write_date !== baseWriteDate) {
    const writtenBy = current.write_uid ? current.write_uid[1] : null;
    throw new ConflictError(`${writtenBy ?? "Jemand"} hat seitdem gespeichert.`, {
      reason: "stale",
      writtenBy,
      writeDate: current.write_date,
    });
  }
  await odoo.call("ir.attachment", "write", [[id], { datas: encode(data) }]);
  return toSummary(await readDrawingRow(odoo, id, false));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function idParam(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Routes under /face/api; the caller mounts requireUser before them. */
export function createDrawingsRouter(
  odooFor: (user: UserRecord) => OdooClient,
  presence: Presence,
): express.Router {
  const router = express.Router();
  const user = (res: express.Response) => res.locals.user as UserRecord;
  const odoo = (res: express.Response) => odooFor(user(res));

  const handle =
    (fn: (req: express.Request, res: express.Response) => Promise<unknown>, status = 200): express.RequestHandler =>
    async (req, res) => {
      try {
        const body = await fn(req, res);
        if (body === undefined) res.status(204).end();
        else res.status(status).json(body);
      } catch (err) {
        if (err instanceof ConflictError) res.status(409).json({ ...err.body, error: err.message });
        else if (err instanceof BadRequestError) res.status(400).json({ error: err.message });
        else if (err instanceof NotFoundError || (err instanceof OdooError && err.kind === "missing"))
          res.status(404).json({ error: "Diese Zeichnung gibt es nicht (mehr) an einem Odoo-Projekt." });
        // A key revoked in Odoo: the app asks the user to sign in again.
        else if (err instanceof OdooError && err.kind === "credentials") res.status(401).json({ error: err.message });
        else if (err instanceof OdooError && err.kind === "access")
          res.status(403).json({ error: `Keine Berechtigung in Odoo: ${err.message}` });
        else if (err instanceof OdooError && err.kind === "network") res.status(502).json({ error: err.message });
        else {
          // Anything else is a bug or an Odoo surprise: the details belong in the log, not the browser.
          console.error("[drawings]", req.method, req.originalUrl, err);
          res.status(502).json({ error: "Odoo hat die Anfrage nicht verarbeitet. Bitte erneut versuchen." });
        }
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

  /** Every tab names itself; without that, locks would have nobody to belong to. */
  const tabIdOf = (req: express.Request): string => {
    const tabId = String(req.body?.tabId ?? "");
    if (!/^[\w-]{1,64}$/.test(tabId)) throw new BadRequestError("Tab-Kennung fehlt.");
    return tabId;
  };

  /** Lock (or view) state as the client shows it. */
  const presenceOf = (drawingId: number, uid: number) => {
    const holder = presence.holder(drawingId);
    return {
      holder: holder && { name: holder.name, since: holder.since, sameUser: holder.uid === uid },
      viewers: presence.viewers(drawingId, uid),
    };
  };

  const bigJson = express.json({ limit: "64mb" });
  const smallJson = express.json({ limit: "4kb" });

  router.get(
    "/projects",
    handle((req, res) => listProjects(odoo(res), String(req.query.q ?? ""))),
  );

  router.get(
    "/projects/:id/drawings",
    withId,
    handle(async (req, res) =>
      (await listDrawings(odoo(res), Number(req.params.id))).map((d) => {
        const holder = presence.holder(d.id);
        return { ...d, editedBy: holder?.name ?? null, editedSince: holder?.since ?? null };
      }),
    ),
  );

  router.post(
    "/projects/:id/drawings",
    withId,
    bigJson,
    handle(async (req, res) => {
      const tabId = tabIdOf(req);
      const drawing = await createDrawing(odoo(res), Number(req.params.id), String(req.body?.name ?? ""), req.body?.data);
      presence.lock(drawing.id, user(res).uid, user(res).name, tabId);
      return drawing;
    }, 201),
  );

  router.get(
    "/drawings/:id",
    withId,
    handle((req, res) => loadDrawing(odoo(res), Number(req.params.id))),
  );

  router.put(
    "/drawings/:id",
    withId,
    bigJson,
    handle(async (req, res) => {
      const id = Number(req.params.id);
      if (!presence.holds(id, user(res).uid, tabIdOf(req))) {
        throw new ConflictError("Diese Zeichnung bearbeitet gerade jemand anderes.", {
          reason: "locked",
          ...presenceOf(id, user(res).uid),
        });
      }
      return saveDrawing(odoo(res), id, req.body?.data, String(req.body?.baseWriteDate ?? ""), req.body?.force === true);
    }),
  );

  router.post(
    "/drawings/:id/lock",
    withId,
    smallJson,
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const tabId = tabIdOf(req);
      // Only a drawing this user can see may be locked — checked once per tab, not on every heartbeat.
      if (!presence.knows(id, user(res).uid, tabId)) await readDrawingRow(odoo(res), id, false);
      const result = presence.lock(id, user(res).uid, user(res).name, tabId, req.body?.takeOver === true);
      if (!result.ok) {
        throw new ConflictError(`In Bearbeitung von ${result.holder.name}.`, { reason: "locked", ...presenceOf(id, user(res).uid) });
      }
      return { ok: true, viewers: presence.viewers(id, user(res).uid) };
    }),
  );

  router.post(
    "/drawings/:id/view",
    withId,
    smallJson,
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const tabId = tabIdOf(req);
      if (!presence.knows(id, user(res).uid, tabId)) await readDrawingRow(odoo(res), id, false);
      presence.view(id, user(res).uid, user(res).name, tabId);
      return presenceOf(id, user(res).uid);
    }),
  );

  router.post(
    "/drawings/:id/unlock",
    withId,
    smallJson,
    handle(async (req, res) => {
      presence.release(Number(req.params.id), user(res).uid, tabIdOf(req));
      return undefined;
    }),
  );

  return router;
}
