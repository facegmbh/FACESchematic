/**
 * Odoo JSON-RPC client for one user, signed in with their e-mail and API key.
 *
 * Ported from face-odoo-mcp (server/core.js), including its guard against Fail2Ban:
 * Odoo.sh bans the source IP after a few failed logins in quick succession, and every
 * user of this backend shares one IP. So after a refused login the client keeps quiet
 * for five minutes, and parallel calls share one login attempt instead of each failing
 * on its own.
 */

const AUTH_BACKOFF_MS = 5 * 60 * 1000;
const CONN_BACKOFF_MS = 60 * 1000;

const CREDENTIALS_HINT =
  "Anmeldung an Odoo fehlgeschlagen — E-Mail oder API-Schlüssel stimmen nicht, oder der " +
  "Schlüssel wurde widerrufen. Den API-Schlüssel erstellt man in Odoo unter Avatar → Mein " +
  "Profil → Kontosicherheit → Neuer API-Schlüssel (nicht das Passwort). Um keine IP-Sperre " +
  "auszulösen, pausieren weitere Versuche 5 Minuten.";

export class OdooError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "credentials" | "access" | "odoo",
  ) {
    super(message);
  }
}

function restZeit(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s > 90 ? `${Math.ceil(s / 60)} Minuten` : `${s} Sekunden`;
}

/** One database per Odoo.sh instance, discovered once and shared by every client. */
const dbByUrl = new Map<string, string>();

export class OdooClient {
  private uid: number | null = null;
  private backoffUntil = 0;
  private backoffReason = "";
  private authInFlight: Promise<number> | null = null;

  constructor(
    readonly url: string,
    readonly login: string,
    private readonly apiKey: string,
  ) {}

  private checkBackoff(): void {
    const rest = this.backoffUntil - Date.now();
    if (rest > 0) throw new OdooError(`${this.backoffReason} (Schutzpause aktiv, noch ${restZeit(rest)}.)`, "credentials");
  }

  private startBackoff(ms: number, reason: string): void {
    this.backoffUntil = Math.max(this.backoffUntil, Date.now() + ms);
    this.backoffReason = reason;
  }

  private async post(path: string, params: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.url}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", params, id: Math.floor(Math.random() * 1e9) }),
      });
    } catch {
      throw new OdooError(
        "Odoo ist nicht erreichbar — Netzwerkproblem oder eine IP-Sperre nach fehlgeschlagenen Anmeldungen.",
        "network",
      );
    }
    if (!res.ok) throw new OdooError(`Odoo antwortet mit HTTP ${res.status}.`, res.status >= 500 ? "network" : "odoo");
    const data = (await res.json()) as { result?: unknown; error?: { message?: string; data?: { name?: string; message?: string } } };
    if (data.error) {
      const name = data.error.data?.name ?? "";
      const message = data.error.data?.message || data.error.message || "Odoo-Fehler";
      if (/AccessDenied/i.test(name)) throw new OdooError(CREDENTIALS_HINT, "credentials");
      if (/AccessError|MissingError/i.test(name)) throw new OdooError(message, "access");
      throw new OdooError(message, "odoo");
    }
    return data.result;
  }

  private async db(): Promise<string> {
    const known = dbByUrl.get(this.url);
    if (known) return known;
    const dbs = await this.post("/web/database/list", {});
    if (!Array.isArray(dbs) || dbs.length !== 1 || typeof dbs[0] !== "string") {
      throw new OdooError("Die Odoo-Datenbank ließ sich nicht ermitteln (ODOO_DB setzen).", "odoo");
    }
    dbByUrl.set(this.url, dbs[0]);
    return dbs[0];
  }

  /** Sign in (once) and return the Odoo user id. */
  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    this.checkBackoff();
    if (this.authInFlight) return this.authInFlight;
    this.authInFlight = (async () => {
      try {
        const uid = await this.post("/jsonrpc", {
          service: "common",
          method: "authenticate",
          args: [await this.db(), this.login, this.apiKey, {}],
        });
        if (typeof uid !== "number" || !uid) {
          this.startBackoff(AUTH_BACKOFF_MS, CREDENTIALS_HINT);
          throw new OdooError(CREDENTIALS_HINT, "credentials");
        }
        this.uid = uid;
        return uid;
      } catch (e) {
        if (e instanceof OdooError && e.kind === "network") this.startBackoff(CONN_BACKOFF_MS, e.message);
        if (e instanceof OdooError && e.kind === "credentials") this.startBackoff(AUTH_BACKOFF_MS, CREDENTIALS_HINT);
        throw e;
      } finally {
        this.authInFlight = null;
      }
    })();
    return this.authInFlight;
  }

  async call<T = unknown>(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<T> {
    const uid = await this.authenticate();
    try {
      return (await this.post("/jsonrpc", {
        service: "object",
        method: "execute_kw",
        args: [await this.db(), uid, this.apiKey, model, method, args, kwargs],
      })) as T;
    } catch (e) {
      // A revoked key fails every call as a failed login — that can trigger Fail2Ban too.
      if (e instanceof OdooError && e.kind === "credentials") {
        this.uid = null;
        this.startBackoff(AUTH_BACKOFF_MS, CREDENTIALS_HINT);
      }
      throw e;
    }
  }
}

/** Seed the database name when it is configured, so discovery is never needed. */
export function setOdooDb(url: string, db: string | undefined): void {
  if (db) dbByUrl.set(url, db);
}
