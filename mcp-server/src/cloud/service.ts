/**
 * Service access for the Odoo connector (SPEC-cloud-bridge.md): run a command in a user's
 * open tab, and read the command catalog. Server to server only — Odoo sends the shared
 * FACE_SERVICE_TOKEN and the uid of the Odoo user it is acting for. The token is what makes
 * that uid believable, so it never reaches a browser and is compared in constant time.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { CallTimeoutError, NoTabError, TabLostError, type Relay } from "./relay.js";
import { TOOLS } from "../tools.js";
import { PROMPTS, SERVER_INSTRUCTIONS, getPrompt } from "../prompts.js";

/** Below nginx proxy manager's 60 s read timeout, so Odoo gets our sentence and not the proxy's
 *  HTML 504; Odoo itself waits a little longer than that. */
export const SERVICE_CALL_TIMEOUT_MS = 50 * 1000;

export interface ServiceOptions {
  token?: string;
  relay: Relay;
  publicUrl: string;
  callTimeoutMs?: number;
  log: (msg: string) => void;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

function noTabMessage(publicUrl: string): string {
  const host = publicUrl.replace(/^https?:\/\//, "");
  return (
    `Kein Schaltplan verbunden. Öffne ${host}, melde dich oben rechts mit Odoo an und schalte unter ` +
    `Einstellungen → KI „Über den Odoo-Connector“ ein. Der Tab muss dabei offen bleiben.`
  );
}

export function createServiceRouter(opts: ServiceOptions): express.Router {
  const router = express.Router();
  const known = new Set(TOOLS.map((t) => t.name));
  const expected = opts.token ? digest(opts.token) : null;

  // Only a wrong token counts: Odoo itself calls often from one address, and "no tab" (409),
  // timeouts or bad parameters are answers to a valid caller — they must never lock Odoo out.
  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      skipSuccessfulRequests: true,
      requestWasSuccessful: (_req, res) => res.statusCode !== 401,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Zu viele Fehlversuche." },
    }),
  );

  router.use((req, res, next) => {
    if (!expected) {
      res.status(503).json({ error: "Dienst-Zugang ist nicht eingerichtet." });
      return;
    }
    const header = req.get("Authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!given || !timingSafeEqual(digest(given), expected)) {
      opts.log(`[service] Token abgelehnt (${req.ip ?? "?"} ${req.method} ${req.path})`);
      res.status(401).json({ error: "Nicht berechtigt." });
      return;
    }
    next();
  });

  router.get("/catalog", (_req, res) => {
    res.json({
      instructions: SERVER_INSTRUCTIONS,
      tools: TOOLS,
      playbooks: PROMPTS.map((p) => {
        const content = getPrompt(p.name).messages[0]?.content;
        return { name: p.name, description: p.description ?? "", text: content?.type === "text" ? content.text : "" };
      }),
    });
  });

  router.post("/call", express.json({ limit: "8mb" }), async (req, res) => {
    const { uid, command, params } = req.body ?? {};
    if (!Number.isInteger(uid) || uid <= 0) {
      res.status(400).json({ error: "uid fehlt oder ist ungültig." });
      return;
    }
    if (typeof command !== "string" || !known.has(command)) {
      res.status(400).json({ error: `Unbekannter Befehl: ${String(command).slice(0, 60)}` });
      return;
    }
    if (params !== undefined && (typeof params !== "object" || params === null || Array.isArray(params))) {
      res.status(400).json({ error: "params muss ein Objekt sein." });
      return;
    }
    try {
      const result = await opts.relay.call(uid, command, params ?? {}, opts.callTimeoutMs ?? SERVICE_CALL_TIMEOUT_MS);
      opts.log(`[service] uid ${uid} ${command} → ${result.ok ? "ok" : "Fehler im Tab"}`);
      res.json(result);
    } catch (err) {
      if (err instanceof NoTabError) {
        opts.log(`[service] uid ${uid} ${command} → kein Tab`);
        res.status(409).json({ reason: "no-tab", message: noTabMessage(opts.publicUrl) });
      } else if (err instanceof TabLostError) {
        opts.log(`[service] uid ${uid} ${command} → Tab während des Befehls getrennt`);
        res.status(409).json({
          reason: "tab-lost",
          message:
            "Der Schaltplan-Tab wurde während des Befehls getrennt — ob er ausgeführt wurde, ist unklar. " +
            "Erst den Status prüfen, bevor er wiederholt wird.",
        });
      } else if (err instanceof CallTimeoutError) {
        opts.log(`[service] uid ${uid} ${command} → Zeitüberschreitung`);
        res.status(504).json({
          reason: "timeout",
          message: "Der Schaltplan hat nicht rechtzeitig geantwortet. Ist der Tab noch offen und die Verbindung da?",
        });
      } else {
        opts.log(`[service] uid ${uid} ${command} → ${err instanceof Error ? err.message : String(err)}`);
        res.status(500).json({ error: "Interner Fehler." });
      }
    }
  });

  return router;
}
