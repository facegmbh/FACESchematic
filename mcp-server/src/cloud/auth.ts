/**
 * Sign-in with the user's own Odoo account (SPEC-face-identity.md): Odoo e-mail plus a
 * personal API key, checked against Odoo, then a 30-day session cookie. The key is kept
 * (encrypted) so the backend can later act with exactly that user's Odoo rights.
 */
import express from "express";
import { rateLimit } from "express-rate-limit";
import type { Config } from "./config.js";
import { OdooClient, OdooError } from "./odoo.js";
import type { Store, UserRecord } from "./store.js";

const SESSION_COOKIE = "face_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
/** After a refused sign-in, that e-mail waits this long before Odoo is asked again. */
const LOGIN_PAUSE_MS = 5 * 60 * 1000;
/** Every user shares one IP towards Odoo, and Odoo.sh bans an IP after a few failed logins
 *  (Fail2Ban) — then nobody at FACE could sign in. So this many refusals within the window,
 *  from whichever e-mails, pause everybody. One colleague's expired key alone does not. */
const GLOBAL_PAUSE_AFTER = 3;
const GLOBAL_WINDOW_MS = 15 * 60 * 1000;

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

export interface AuthOptions {
  now?: () => number;
  /** Called with the uid when someone signs out (the relay forgets their tab). */
  onSignOut?: (uid: number) => void;
}

export interface SignedInUser {
  uid: number;
  name: string;
  login: string;
}

/** Every value sent under this name — a browser holding the cookie on two paths sends both. */
function readCookies(header: string | undefined, name: string): string[] {
  const values: string[] = [];
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k !== name) continue;
    try {
      values.push(decodeURIComponent(v.join("=")));
    } catch {
      /* not ours */
    }
  }
  return values;
}

export function createAuth(config: Config, store: Store, opts: AuthOptions = {}) {
  const now = opts.now ?? Date.now;
  const secure = config.publicUrl.startsWith("https://");
  const flags = `HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  /** The cookie covers the whole site: nginx asks /face/api/me before it serves /symbols/
   *  (docker/nginx.conf), and the browser only sends the cookie along where its path reaches. */
  const cookieAttrs = `Path=/; ${flags}`;
  /** Until 23.11.2026 the cookie lived on /face. Dropped wherever a cookie is set, so an old
   *  one never sits next to the new one. Removable once those sessions have run out (30 days). */
  const dropOldCookie = `${SESSION_COOKIE}=; Path=/face; ${flags}; Max-Age=0`;
  let globalPausedUntil = 0;
  /** Lower-cased e-mail → paused until. */
  const pausedLogins = new Map<string, number>();
  let refusals: number[] = [];
  const clients = new Map<number, OdooClient>();

  /** The first cookie that is a live session — a stale one beside it must not sign anyone out. */
  function currentSession(req: express.Request) {
    for (const id of readCookies(req.headers.cookie, SESSION_COOKIE)) {
      const session = store.session(id);
      if (session) return { id, session };
    }
    return undefined;
  }

  function currentUser(req: express.Request): UserRecord | undefined {
    const found = currentSession(req);
    return found ? store.user(found.session.uid) : undefined;
  }

  /** The Odoo client acting as this user, with the key they signed in with last. */
  function odooFor(user: UserRecord): OdooClient {
    let client = clients.get(user.uid);
    if (!client || client.login !== user.login || client.signedInAt !== user.updatedAt) {
      client = new OdooClient(config.odooUrl, user.login, store.decrypt(user.apiKeyEnc), user.updatedAt);
      clients.set(user.uid, client);
    }
    return client;
  }

  /** For the routes behind sign-in: 401 unless signed in; the user is on res.locals.user. */
  const requireUser: express.RequestHandler = (req, res, next) => {
    const user = currentUser(req);
    if (!user) {
      res.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    res.locals.user = user;
    next();
  };

  /** Changing requests must carry X-FACE-Request — a header no other site can make a browser send. */
  const requireFaceHeader: express.RequestHandler = (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.get("X-FACE-Request") !== "1") {
      res.status(403).json({ error: "Anfrage abgelehnt." });
      return;
    }
    next();
  };

  const router = express.Router();
  router.use(requireFaceHeader);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Zu viele Anmeldeversuche — bitte in 15 Minuten erneut versuchen." },
  });

  router.post("/login", loginLimiter, express.json({ limit: "4kb" }), async (req, res) => {
    const login = String(req.body?.login ?? "").trim();
    const apiKey = String(req.body?.apiKey ?? "").trim();
    if (!login || !apiKey) {
      res.status(400).json({ error: "Odoo-E-Mail und API-Schlüssel eingeben." });
      return;
    }
    const key = login.toLowerCase();
    if (now() < globalPausedUntil) {
      res.status(429).json({
        error: `Nach mehreren Fehlversuchen kurz pausiert, damit Odoo uns nicht sperrt — bitte in ${minutes(globalPausedUntil - now())} Minuten erneut versuchen.`,
      });
      return;
    }
    const pausedUntil = pausedLogins.get(key) ?? 0;
    if (now() < pausedUntil) {
      res.status(429).json({
        error:
          `Für diese E-Mail nach einem Fehlversuch kurz pausiert — bitte in ${minutes(pausedUntil - now())} Minuten erneut versuchen. ` +
          "Ist der API-Schlüssel abgelaufen, in Odoo unter Mein Profil → Kontosicherheit einen neuen erzeugen.",
      });
      return;
    }
    const odoo = new OdooClient(config.odooUrl, login, apiKey);
    let uid: number;
    let name: string;
    try {
      uid = await odoo.authenticate();
      const [row] = await odoo.call<{ name: string }[]>("res.users", "read", [[uid]], { fields: ["name"] });
      name = row?.name ?? login;
    } catch (err) {
      if (err instanceof OdooError && err.kind === "credentials") {
        for (const [k, until] of pausedLogins) if (until <= now()) pausedLogins.delete(k);
        pausedLogins.set(key, now() + LOGIN_PAUSE_MS);
        refusals = [...refusals.filter((t) => now() - t < GLOBAL_WINDOW_MS), now()];
        if (refusals.length >= GLOBAL_PAUSE_AFTER) {
          globalPausedUntil = now() + LOGIN_PAUSE_MS;
          refusals = [];
        }
        res.status(401).json({ error: err.message });
      } else {
        res.status(502).json({ error: err instanceof Error ? err.message : "Odoo ist nicht erreichbar." });
      }
      return;
    }
    store.putUser(uid, login, name, apiKey);
    const sessionId = store.createSession(uid, SESSION_TTL_MS);
    res.setHeader("Set-Cookie", [
      `${SESSION_COOKIE}=${sessionId}; ${cookieAttrs}; Max-Age=${SESSION_TTL_MS / 1000}`,
      dropOldCookie,
    ]);
    const body: SignedInUser = { uid, name, login };
    res.json(body);
  });

  router.get("/me", (req, res) => {
    const found = currentSession(req);
    const user = found ? store.user(found.session.uid) : undefined;
    if (!found || !user) {
      res.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    // A session from before the cookie covered the whole site moves over here, with the
    // time it has left — the app asks /me on every start.
    const left = Math.max(1, Math.floor((found.session.expiresAt - Date.now()) / 1000));
    res.setHeader("Set-Cookie", [`${SESSION_COOKIE}=${found.id}; ${cookieAttrs}; Max-Age=${left}`, dropOldCookie]);
    const body: SignedInUser = { uid: user.uid, name: user.name, login: user.login };
    res.json(body);
  });

  router.post("/logout", (req, res) => {
    let uid: number | undefined;
    for (const id of readCookies(req.headers.cookie, SESSION_COOKIE)) {
      uid ??= store.session(id)?.uid;
      store.deleteSession(id);
    }
    if (uid !== undefined) opts.onSignOut?.(uid);
    res.setHeader("Set-Cookie", [`${SESSION_COOKIE}=; ${cookieAttrs}; Max-Age=0`, dropOldCookie]);
    res.status(204).end();
  });

  return { router, requireUser, requireFaceHeader, odooFor };
}
