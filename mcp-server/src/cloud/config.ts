/** Backend configuration, read once from the environment (see SPEC-backend-deploy.md). */

export interface Config {
  /** Encrypts the stored Odoo API keys — changing it signs everybody out. */
  secret: string;
  /** Where users reach the app, e.g. https://schematic.face-gmbh.com (no trailing slash). */
  publicUrl: string;
  odooUrl: string;
  /** Set when /web/database/list is switched off on the Odoo instance. */
  odooDb?: string;
  dataDir: string;
  port: number;
}

const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const secret = env.FACE_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("FACE_SECRET fehlt oder ist kürzer als 32 Zeichen — der Server startet nicht.");
  }
  const publicUrl = (env.FACE_PUBLIC_URL ?? "").replace(/\/+$/, "");
  // https is required — except on loopback, which the OAuth spec exempts and local dev uses.
  if (!/^https:\/\//.test(publicUrl) && !LOOPBACK.test(publicUrl)) {
    throw new Error("FACE_PUBLIC_URL fehlt oder ist keine https-Adresse — der Server startet nicht.");
  }
  return {
    secret,
    publicUrl,
    odooUrl: (env.ODOO_URL || "https://facegmbh-odoo.odoo.com").replace(/\/+$/, ""),
    odooDb: env.ODOO_DB || undefined,
    dataDir: env.DATA_DIR || "/data",
    port: Number(env.PORT) || 8787,
  };
}
