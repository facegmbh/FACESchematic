/**
 * A stand-in for Odoo's JSON-RPC endpoint, for tests only. It knows two users, a few
 * projects and their attachments, and answers just the calls the backend makes; anything
 * else is an error, so a test notices when the backend starts asking Odoo for something new.
 */
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

export const MOCK_USER = { uid: 8, login: "jl@face-gmbh.com", apiKey: "good-key", name: "Jean-Luc Doijen" };
export const MOCK_USER_2 = { uid: 9, login: "max@face-gmbh.com", apiKey: "max-key", name: "Max Mustermann" };
const USERS = [MOCK_USER, MOCK_USER_2];

type Many2one = [number, string] | false;

export interface MockProject {
  id: number;
  name: string;
  partner_id: Many2one;
  write_date: string;
}

export interface MockAttachment {
  id: number;
  name: string;
  res_model: string | false;
  res_id: number;
  mimetype: string;
  datas: string;
  write_date: string;
  write_uid: Many2one;
  file_size: number;
}

/** A row of face.schematic.template (Odoo module face_schematic_library). */
export interface MockTemplate {
  id: number;
  key: string;
  data: string;
  version: number;
  product_id: Many2one;
  origin: "editor" | "claude" | "upload";
  active: boolean;
  write_date: string;
  write_uid: Many2one;
}

export interface MockProduct {
  id: number;
  display_name: string;
  name: string;
  default_code: string | false;
}

export interface MockOdoo {
  url: string;
  /** Every authenticate call, in order — to prove the backend held back after a failure. */
  authCalls: { login: string; key: string }[];
  projects: MockProject[];
  attachments: MockAttachment[];
  templates: MockTemplate[];
  products: MockProduct[];
  close: () => Promise<void>;
}

/** Thrown by a handler to answer the way Odoo answers a raised exception. */
export class MockOdooError extends Error {
  constructor(readonly odooName: string, message: string) {
    super(message);
  }
}

export function seedProducts(): MockProduct[] {
  return [
    { id: 9001, name: "Audac MFA208 Mischverstärker", display_name: "[MFA208] Audac MFA208 Mischverstärker", default_code: "MFA208" },
    { id: 9002, name: "Bose DesignMax DM6SE", display_name: "[DM6SE] Bose DesignMax DM6SE", default_code: "DM6SE" },
  ];
}

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");

/** Seconds-precision UTC timestamp in Odoo's format; the clock moves on every write. */
let tick = Date.parse("2026-10-22T10:00:00Z");
const odooNow = () => new Date((tick += 1000)).toISOString().replace("T", " ").slice(0, 19);

export function seedProjects(): MockProject[] {
  return [
    { id: 101, name: "SOCCERBEAT GmbH - FACE/26/10/560", partner_id: [15812, "SOCCERBEAT GmbH"], write_date: "2026-10-20 09:00:00" },
    { id: 102, name: "Pier 99", partner_id: [16039, "S.I.R. Betriebsgesellschaft mbH"], write_date: "2026-10-21 09:00:00" },
  ];
}

export function seedAttachments(): MockAttachment[] {
  const att = (id: number, name: string, res_model: string, res_id: number, data: unknown): MockAttachment => ({
    id, name, res_model, res_id, mimetype: "application/json", datas: b64(data),
    write_date: "2026-10-21 16:40:00", write_uid: [MOCK_USER.uid, MOCK_USER.name], file_size: 20,
  });
  return [
    att(501, "Beschallung EG.faceschematic.json", "project.project", 101, { version: 49, schematicName: "Beschallung EG", nodes: [], edges: [] }),
    att(502, "Angebot.pdf", "project.project", 101, "pdf"),
    att(503, "Fremd.faceschematic.json", "project.task", 101, { version: 49 }),
  ];
}

// --- the little domain language the backend uses ------------------------------

type Leaf = [string, string, unknown];
type Domain = (Leaf | "|" | "&")[];

function fieldValue(record: Record<string, unknown>, path: string): unknown {
  const [head, tail] = path.split(".");
  const v = record[head];
  if (tail === "name" && Array.isArray(v)) return v[1];
  if (Array.isArray(v)) return v[0];
  return v;
}

function matchLeaf(record: Record<string, unknown>, [field, op, value]: Leaf): boolean {
  const v = fieldValue(record, field);
  switch (op) {
    case "=":
      return v === value;
    case "ilike":
      return String(v ?? "").toLowerCase().includes(String(value).toLowerCase());
    case "=like": {
      const re = new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`);
      return re.test(String(v ?? ""));
    }
    case "in":
      return (value as unknown[]).includes(v);
    default:
      throw new Error(`mock: operator ${op} not handled`);
  }
}

/** Polish-notation domains: implicit AND, "|" and "&" take the next two terms. */
export function matchDomain(record: Record<string, unknown>, domain: Domain): boolean {
  let i = 0;
  const term = (): boolean => {
    const t = domain[i++];
    if (t === "|") { const a = term(); const b = term(); return a || b; }
    if (t === "&") { const a = term(); const b = term(); return a && b; }
    return matchLeaf(record, t as Leaf);
  };
  let all = true;
  while (i < domain.length) all = term() && all;
  return all;
}

function pick<T extends object>(row: T, fields: string[] | undefined): Partial<T> & { id: number } {
  const r = row as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { id: r.id };
  for (const f of fields ?? Object.keys(r)) out[f] = r[f];
  return out as Partial<T> & { id: number };
}

type Handler = (args: unknown[], kwargs: Record<string, unknown>, uid: number) => unknown;

/**
 * `extra` adds or replaces handlers; `errors` makes a call fail the way Odoo does, as
 * `"model.method": [exception name, message]` — e.g. an AccessError for missing rights.
 */
export async function startMockOdoo(
  extra: Record<string, Handler> = {},
  errors: Record<string, [string, string]> = {},
): Promise<MockOdoo> {
  const authCalls: { login: string; key: string }[] = [];
  const projects = seedProjects();
  const attachments = seedAttachments();
  const templates: MockTemplate[] = [];
  const products = seedProducts();

  const userOf = (uid: number): Many2one => {
    const user = USERS.find((u) => u.uid === uid)!;
    return [user.uid, user.name];
  };
  /** Odoo hides archived rows unless the context says active_test: false. */
  const visibleTemplates = (kw: Record<string, unknown>) => {
    const ctx = (kw.context ?? {}) as Record<string, unknown>;
    return ctx.active_test === false ? templates : templates.filter((t) => t.active);
  };
  const productRef = (id: unknown): Many2one => {
    if (!id) return false;
    const p = products.find((x) => x.id === id);
    if (!p) throw new MockOdooError("odoo.exceptions.ValidationError", `Artikel ${String(id)} gibt es nicht.`);
    return [p.id, p.display_name];
  };
  /** The module's constraint: valid JSON object whose id is the key. */
  const checkData = (key: string, data: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { throw new MockOdooError("odoo.exceptions.ValidationError", "Kein gültiges JSON."); }
    if (!parsed || typeof parsed !== "object" || (parsed as { id?: unknown }).id !== key) {
      throw new MockOdooError("odoo.exceptions.ValidationError", "Die id im JSON passt nicht zur Vorlagen-ID.");
    }
  };

  const builtin: Record<string, Handler> = {
    "res.users.read": (args) => {
      const ids = args[0] as number[];
      return USERS.filter((u) => ids.includes(u.uid)).map((u) => ({ id: u.uid, name: u.name }));
    },
    "project.project.search_read": (args, kw) =>
      projects
        .filter((p) => matchDomain(p as unknown as Record<string, unknown>, (args[0] ?? []) as Domain))
        .sort((a, b) => b.write_date.localeCompare(a.write_date))
        .slice(0, Number(kw.limit ?? 80))
        .map((p) => pick(p, kw.fields as string[])),
    "project.project.read": (args, kw) => {
      const ids = args[0] as number[];
      return projects.filter((p) => ids.includes(p.id)).map((p) => pick(p, kw.fields as string[]));
    },
    "ir.attachment.search_read": (args, kw) =>
      attachments
        .filter((a) => matchDomain(a as unknown as Record<string, unknown>, (args[0] ?? []) as Domain))
        .sort((a, b) => b.write_date.localeCompare(a.write_date))
        .map((a) => pick(a, kw.fields as string[])),
    "ir.attachment.search_count": (args) =>
      attachments.filter((a) => matchDomain(a as unknown as Record<string, unknown>, (args[0] ?? []) as Domain)).length,
    "ir.attachment.read": (args, kw) => {
      const ids = args[0] as number[];
      return attachments.filter((a) => ids.includes(a.id)).map((a) => pick(a, kw.fields as string[]));
    },
    "ir.attachment.create": (args, _kw, uid) => {
      const v = args[0] as Partial<MockAttachment>;
      const user = USERS.find((u) => u.uid === uid)!;
      const id = Math.max(0, ...attachments.map((a) => a.id)) + 1;
      attachments.push({
        id, name: String(v.name), res_model: v.res_model ?? false, res_id: Number(v.res_id ?? 0),
        mimetype: String(v.mimetype ?? ""), datas: String(v.datas ?? ""), write_date: odooNow(),
        write_uid: [user.uid, user.name], file_size: Buffer.from(String(v.datas ?? ""), "base64").length,
      });
      return id;
    },
    "face.schematic.template.search_read": (args, kw) =>
      visibleTemplates(kw)
        .filter((t) => matchDomain(t as unknown as Record<string, unknown>, (args[0] ?? []) as Domain))
        .map((t) => pick(t, kw.fields as string[])),
    "face.schematic.template.search_count": (args, kw) =>
      visibleTemplates(kw).filter((t) => matchDomain(t as unknown as Record<string, unknown>, (args[0] ?? []) as Domain)).length,
    "face.schematic.template.read": (args, kw) => {
      const ids = args[0] as number[];
      return templates.filter((t) => ids.includes(t.id)).map((t) => pick(t, kw.fields as string[]));
    },
    "face.schematic.template.create": (args, _kw, uid) => {
      const list = (Array.isArray(args[0]) ? args[0] : [args[0]]) as Record<string, unknown>[];
      const ids = list.map((v) => {
        const key = String(v.key);
        // Odoo turns the UNIQUE(key) violation into a ValidationError for RPC callers.
        if (templates.some((t) => t.key === key)) throw new MockOdooError("odoo.exceptions.ValidationError", "Diese Vorlagen-ID gibt es schon.");
        checkData(key, String(v.data));
        const id = Math.max(0, ...templates.map((t) => t.id)) + 1;
        templates.push({
          id, key, data: String(v.data), version: 1, product_id: productRef(v.product_id),
          origin: (v.origin as MockTemplate["origin"]) ?? "editor", active: true, write_date: odooNow(), write_uid: userOf(uid),
        });
        return id;
      });
      return Array.isArray(args[0]) ? ids : ids[0];
    },
    "face.schematic.template.write": (args, kw, uid) => {
      const [ids, v] = args as [number[], Record<string, unknown>];
      const expected = ((kw.context ?? {}) as Record<string, unknown>).expected_version;
      const rows = templates.filter((t) => ids.includes(t.id));
      for (const t of rows) {
        if (expected !== undefined && t.version !== expected) {
          throw new MockOdooError("odoo.exceptions.UserError", `Die Vorlage wurde inzwischen geändert (Version ${t.version}).`);
        }
      }
      for (const t of rows) {
        if (typeof v.data === "string") {
          checkData(t.key, v.data);
          if (v.data !== t.data) t.version += 1;
          t.data = v.data;
        }
        if ("product_id" in v) t.product_id = productRef(v.product_id);
        if ("active" in v) t.active = Boolean(v.active);
        t.write_date = odooNow();
        t.write_uid = userOf(uid);
      }
      return true;
    },
    "product.product.search_read": (args, kw) =>
      products
        .filter((p) => matchDomain(p as unknown as Record<string, unknown>, (args[0] ?? []) as Domain))
        .slice(0, Number(kw.limit ?? 80))
        .map((p) => pick(p, kw.fields as string[])),
    "ir.attachment.write": (args, _kw, uid) => {
      const [ids, v] = args as [number[], Partial<MockAttachment>];
      const user = USERS.find((u) => u.uid === uid)!;
      for (const a of attachments.filter((x) => ids.includes(x.id))) {
        Object.assign(a, v, { write_date: odooNow(), write_uid: [user.uid, user.name] });
        if (v.datas) a.file_size = Buffer.from(v.datas, "base64").length;
      }
      return true;
    },
  };

  const app = express();
  app.use(express.json({ limit: "64mb" }));
  const reply = (res: express.Response, result: unknown) => res.json({ jsonrpc: "2.0", id: 1, result });
  const fail = (res: express.Response, name: string, message: string) =>
    res.json({ jsonrpc: "2.0", id: 1, error: { message: "Odoo Server Error", data: { name, message } } });

  app.post("/web/database/list", (_req, res) => reply(res, ["facedb"]));

  app.post("/jsonrpc", (req, res) => {
    const { service, method, args } = req.body.params as { service: string; method: string; args: unknown[] };
    if (service === "common" && method === "authenticate") {
      const [, login, key] = args as [string, string, string];
      authCalls.push({ login, key });
      const user = USERS.find((u) => u.login === login && u.apiKey === key);
      return reply(res, user ? user.uid : false);
    }
    if (service === "object" && method === "execute_kw") {
      const [, uid, key, model, fn, fnArgs, kwargs] = args as [string, number, string, string, string, unknown[], Record<string, unknown>];
      if (!USERS.some((u) => u.uid === uid && u.apiKey === key)) return fail(res, "odoo.exceptions.AccessDenied", "Access Denied");
      const err = errors[`${model}.${fn}`];
      if (err) return fail(res, err[0], err[1]);
      const handler = extra[`${model}.${fn}`] ?? builtin[`${model}.${fn}`];
      if (handler) {
        try {
          return reply(res, handler(fnArgs, kwargs ?? {}, uid));
        } catch (e) {
          if (e instanceof MockOdooError) return fail(res, e.odooName, e.message);
          throw e;
        }
      }
      return fail(res, "builtins.NotImplementedError", `mock: ${model}.${fn} not handled`);
    }
    return fail(res, "builtins.NotImplementedError", `mock: ${service}.${method} not handled`);
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://[::1]:${port}`,
    authCalls,
    projects,
    attachments,
    templates,
    products,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
