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

const { version: VERSION } = createRequire(import.meta.url)("../../package.json") as { version: string };

export function createApp(config: Config, opts: AuthOptions = {}): express.Express {
  setOdooDb(config.odooUrl, config.odooDb);
  const store = new Store(config.dataDir, config.secret);
  const auth = createAuth(config, store, opts);

  const app = express();
  app.disable("x-powered-by");
  // Behind nginx proxy manager and the app's nginx, both on private networks.
  app.set("trust proxy", "loopback, linklocal, uniquelocal");

  app.get("/face/health", (_req, res) => {
    res.json({ status: "ok", version: VERSION });
  });

  app.use("/face/api", auth.router);

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
