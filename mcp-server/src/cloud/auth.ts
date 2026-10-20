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
/** After a refused sign-in nobody signs in for this long: every user shares one IP towards
 *  Odoo, and Odoo.sh bans an IP after a few failed logins (Fail2Ban). */
const LOGIN_PAUSE_MS = 5 * 60 * 1000;

export interface AuthOptions {
  now?: () => number;
}

export interface SignedInUser {
  uid: number;
  name: string;
  login: string;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function createAuth(config: Config, store: Store, opts: AuthOptions = {}) {
  const now = opts.now ?? Date.now;
  const secure = config.publicUrl.startsWith("https://");
  const cookieAttrs = `Path=/face; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  let loginPausedUntil = 0;

  function currentUser(req: express.Request): UserRecord | undefined {
    const session = store.session(readCookie(req.headers.cookie, SESSION_COOKIE));
    return session ? store.user(session.uid) : undefined;
  }

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
    if (now() < loginPausedUntil) {
      res.status(429).json({ error: "Nach einer fehlgeschlagenen Anmeldung kurz pausiert — bitte in ein paar Minuten erneut versuchen." });
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
        loginPausedUntil = now() + LOGIN_PAUSE_MS;
        res.status(401).json({ error: err.message });
      } else {
        res.status(502).json({ error: err instanceof Error ? err.message : "Odoo ist nicht erreichbar." });
      }
      return;
    }
    loginPausedUntil = 0;
    store.putUser(uid, login, name, apiKey);
    const sessionId = store.createSession(uid, SESSION_TTL_MS);
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${sessionId}; ${cookieAttrs}; Max-Age=${SESSION_TTL_MS / 1000}`);
    const body: SignedInUser = { uid, name, login };
    res.json(body);
  });

  router.get("/me", (req, res) => {
    const user = currentUser(req);
    if (!user) {
      res.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    const body: SignedInUser = { uid: user.uid, name: user.name, login: user.login };
    res.json(body);
  });

  router.post("/logout", (req, res) => {
    const id = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (id) store.deleteSession(id);
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; ${cookieAttrs}; Max-Age=0`);
    res.status(204).end();
  });

  return { router };
}
