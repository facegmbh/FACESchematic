#!/usr/bin/env node
/**
 * FACESchematic backend — runs next to the app on face-docker1 and is reached only through
 * the app's nginx, under /face/ on the app's own address (see SPEC-backend-deploy.md).
 *
 * Start: FACE_SECRET=… FACE_PUBLIC_URL=https://schematic.face-gmbh.com node dist/cloud/server.js
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import express from "express";
import { loadConfig, type Config } from "./config.js";
import { createAuth, type AuthOptions } from "./auth.js";
import { setOdooDb } from "./odoo.js";
import { Store } from "./store.js";
import { createDrawingsRouter } from "./drawings.js";
import { createLibraryRouter } from "./library.js";
import { Presence } from "./presence.js";
import { Relay, createBridgeRouter } from "./relay.js";
import { createServiceRouter } from "./service.js";

const { version: VERSION } = createRequire(import.meta.url)("../../package.json") as { version: string };

export interface AppOptions extends AuthOptions {
  /** Injected by tests to reach the relay directly and shorten the poll. */
  relay?: Relay;
  serviceCallTimeoutMs?: number;
  log?: (msg: string) => void;
}

export function createApp(config: Config, opts: AppOptions = {}): express.Express {
  setOdooDb(config.odooUrl, config.odooDb);
  const store = new Store(config.dataDir, config.secret);
  const relay = opts.relay ?? new Relay(opts.now);
  const auth = createAuth(config, store, { ...opts, onSignOut: (uid) => relay.forget(uid) });

  const app = express();
  app.disable("x-powered-by");
  // Behind nginx proxy manager and the app's nginx, both on private networks.
  app.set("trust proxy", "loopback, linklocal, uniquelocal");

  app.get("/face/health", (_req, res) => {
    res.json({ status: "ok", version: VERSION });
  });

  app.use("/face/api", auth.router);
  app.use("/face/api", auth.requireUser, createDrawingsRouter(auth.odooFor, new Presence(opts.now)));
  app.use("/face/api", auth.requireUser, createLibraryRouter(auth.odooFor));

  app.use("/face/bridge", auth.requireFaceHeader, auth.requireUser, createBridgeRouter(relay));
  app.use(
    "/face/service",
    createServiceRouter({
      token: config.serviceToken,
      relay,
      publicUrl: config.publicUrl,
      callTimeoutMs: opts.serviceCallTimeoutMs,
      log: opts.log ?? ((m) => process.stderr.write(`${m}\n`)),
    }),
  );

  return app;
}

function main(): void {
  let config: Config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(`[faceschematic-backend] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
  createApp(config).listen(config.port, () => {
    process.stdout.write(`[faceschematic-backend] v${VERSION} auf Port ${config.port} — ${config.publicUrl}/face/\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
