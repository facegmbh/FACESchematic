import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "./server.js";
import { loadConfig } from "./config.js";

const SECRET = "x".repeat(40);
const dataDir = () => mkdtempSync(path.join(tmpdir(), "face-backend-"));

test("GET /face/health answers ok with the version", async () => {
  const config = loadConfig({ FACE_SECRET: SECRET, FACE_PUBLIC_URL: "http://localhost:5173", DATA_DIR: dataDir() });
  const server = createApp(config).listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/face/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; version: string };
    assert.equal(body.status, "ok");
    assert.match(body.version, /^\d+\.\d+\.\d+/);
  } finally {
    server.close();
  }
});

test("loadConfig refuses a missing or short FACE_SECRET", () => {
  assert.throws(() => loadConfig({ FACE_PUBLIC_URL: "https://schematic.face-gmbh.com" }), /FACE_SECRET/);
  assert.throws(() => loadConfig({ FACE_SECRET: "short", FACE_PUBLIC_URL: "https://schematic.face-gmbh.com" }), /FACE_SECRET/);
});

test("loadConfig refuses a public URL that is neither https nor loopback", () => {
  assert.throws(() => loadConfig({ FACE_SECRET: SECRET, FACE_PUBLIC_URL: "http://schematic.face-gmbh.com" }), /FACE_PUBLIC_URL/);
  assert.doesNotThrow(() => loadConfig({ FACE_SECRET: SECRET, FACE_PUBLIC_URL: "https://schematic.face-gmbh.com/" }));
});

test("loadConfig fills the defaults", () => {
  const c = loadConfig({ FACE_SECRET: SECRET, FACE_PUBLIC_URL: "https://schematic.face-gmbh.com/" });
  assert.equal(c.publicUrl, "https://schematic.face-gmbh.com");
  assert.equal(c.odooUrl, "https://facegmbh-odoo.odoo.com");
  assert.equal(c.dataDir, "/data");
  assert.equal(c.port, 8787);
});

test("the server process exits with a reason when FACE_SECRET is missing", () => {
  const entry = fileURLToPath(new URL("./server.js", import.meta.url));
  const run = spawnSync(process.execPath, [entry], {
    env: { PATH: process.env.PATH, FACE_PUBLIC_URL: "https://schematic.face-gmbh.com" },
    encoding: "utf8",
    // Generous: a busy machine can take a while to start node and load express.
    timeout: 60000,
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /FACE_SECRET/);
});
