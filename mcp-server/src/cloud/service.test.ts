import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Relay } from "./relay.js";
import { createApp } from "./server.js";
import { loadConfig } from "./config.js";
import { startMockOdoo, type MockOdoo } from "./mockOdoo.js";
import { TOOLS } from "../tools.js";
import { PROMPTS } from "../prompts.js";

const TOKEN = "t".repeat(64);

let odoo: MockOdoo;
let server: Server;
let base: string;
let relay: Relay;
let logged: string[];

async function start(env: Record<string, string> = { FACE_SERVICE_TOKEN: TOKEN }) {
  odoo = await startMockOdoo();
  const config = loadConfig({
    FACE_SECRET: "s".repeat(40),
    FACE_PUBLIC_URL: "http://localhost:5173",
    ODOO_URL: odoo.url,
    DATA_DIR: mkdtempSync(path.join(tmpdir(), "face-service-")),
    ...env,
  });
  relay = new Relay(Date.now, { pollWaitMs: 50 });
  logged = [];
  server = createApp(config, { relay, serviceCallTimeoutMs: 100, log: (m) => logged.push(m) }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(() => start());

afterEach(async () => {
  server.closeAllConnections();
  server.close();
  await odoo.close();
});

function call(body: unknown, token: string | null = TOKEN) {
  return fetch(`${base}/face/service/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

/** Play the tab: answer the next command for this user with the given result. */
async function answerNext(uid: number, tabId: string, result: unknown) {
  const msg = await relay.poll(uid, tabId);
  assert.equal(msg.type, "command");
  if (msg.type === "command") relay.respond(uid, tabId, msg.requestId, { ok: true, result: { echo: msg.command, ...((result as object) ?? {}) } });
}

test("without a token, or with a wrong one → 401", async () => {
  assert.equal((await call({ uid: 8, command: "list_devices" }, null)).status, 401);
  assert.equal((await call({ uid: 8, command: "list_devices" }, "falsch")).status, 401);
  assert.equal((await call({ uid: 8, command: "list_devices" }, TOKEN.slice(1) + "x")).status, 401);
  const catalog = await fetch(`${base}/face/service/catalog`);
  assert.equal(catalog.status, 401);
});

test("no token configured → the service is off (503), even with a header", async () => {
  server.closeAllConnections();
  server.close();
  await odoo.close();
  await start({});
  const res = await call({ uid: 8, command: "list_devices" }, "irgendwas");
  assert.equal(res.status, 503);
});

test("a token shorter than 32 characters stops the server from starting", () => {
  assert.throws(
    () => loadConfig({ FACE_SECRET: "s".repeat(40), FACE_PUBLIC_URL: "http://localhost:5173", FACE_SERVICE_TOKEN: "kurz" }),
    /FACE_SERVICE_TOKEN/,
  );
});

test("with the token and a connected tab, the tab's answer comes back", async () => {
  relay.hello(8, "tab-a", "Pier 99");
  const [res] = await Promise.all([call({ uid: 8, command: "list_devices", params: {} }), answerNext(8, "tab-a", { n: 2 })]);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: { echo: "list_devices", n: 2 } });
});

test("a call for one user never runs in another user's tab", async () => {
  relay.hello(9, "tab-b", "Fremd");
  const res = await call({ uid: 8, command: "list_devices" });
  assert.equal(res.status, 409);
  assert.deepEqual(await relay.poll(9, "tab-b"), { type: "idle" });
});

test("no tab → 409 with a German explanation of what to switch on", async () => {
  const res = await call({ uid: 8, command: "list_devices" });
  assert.equal(res.status, 409);
  const body = (await res.json()) as { reason: string; message: string };
  assert.equal(body.reason, "no-tab");
  assert.match(body.message, /localhost:5173/); // the configured FACE_PUBLIC_URL
  assert.match(body.message, /Einstellungen/);
});

test("the tab does not answer in time → 504", async () => {
  relay.hello(8, "tab-a", "Pier 99");
  const res = await call({ uid: 8, command: "list_devices" });
  assert.equal(res.status, 504);
  assert.equal(((await res.json()) as { reason: string }).reason, "timeout");
});

test("a failing command is an answer, not a server error", async () => {
  relay.hello(8, "tab-a", "Pier 99");
  const tab = (async () => {
    const msg = await relay.poll(8, "tab-a");
    if (msg.type === "command") relay.respond(8, "tab-a", msg.requestId, { ok: false, error: "Gerät nicht gefunden." });
  })();
  const [res] = await Promise.all([call({ uid: 8, command: "get_device", params: { nodeId: "x" } }), tab]);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: false, error: "Gerät nicht gefunden." });
});

test("bad input → 400: uid, unknown command, params not an object", async () => {
  for (const body of [
    { uid: "8", command: "list_devices" },
    { uid: 0, command: "list_devices" },
    { uid: 1.5, command: "list_devices" },
    { uid: 8, command: "rm_rf" },
    { uid: 8, command: "list_devices", params: [1] },
  ]) {
    assert.equal((await call(body)).status, 400, JSON.stringify(body));
  }
});

test("the catalog lists every tool, the instructions and the playbooks with their text", async () => {
  const res = await fetch(`${base}/face/service/catalog`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    instructions: string;
    tools: { name: string; description: string; inputSchema: object }[];
    playbooks: { name: string; description: string; text: string }[];
  };
  assert.deepEqual(body.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  assert.ok(body.tools.every((t) => t.description && t.inputSchema));
  assert.match(body.instructions, /search_templates/);
  assert.deepEqual(body.playbooks.map((p) => p.name), PROMPTS.map((p) => p.name));
  assert.match(body.playbooks.find((p) => p.name === "build-schematic")!.text, /get_schematic/);
});

test("the token never appears in the log", async () => {
  await call({ uid: 8, command: "list_devices" }, "falsch");
  await call({ uid: 8, command: "list_devices" });
  assert.ok(logged.length > 0, "calls are logged");
  assert.ok(logged.every((m) => !m.includes(TOKEN) && !m.includes("falsch")));
});
