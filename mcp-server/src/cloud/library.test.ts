// SPEC-odoo-device-library.md, Task 41 — the central device library under /face/api/library,
// against a mock Odoo that behaves like the face_schematic_library module.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server.js";
import { loadConfig } from "./config.js";
import { startMockOdoo, MOCK_USER, MOCK_USER_2, type MockOdoo } from "./mockOdoo.js";

let odoo: MockOdoo;
let server: Server;
let base: string;

async function start(errors: Record<string, [string, string]> = {}) {
  odoo = await startMockOdoo({}, errors);
  const config = loadConfig({
    FACE_SECRET: "s".repeat(40),
    FACE_PUBLIC_URL: "http://localhost:5173",
    ODOO_URL: odoo.url,
    DATA_DIR: mkdtempSync(path.join(tmpdir(), "face-library-")),
  });
  server = createApp(config).listen(0);
  base = `http://[::1]:${(server.address() as AddressInfo).port}`;
}

beforeEach(() => start());

afterEach(async () => {
  server.close();
  await odoo.close();
});

async function restartWith(errors: Record<string, [string, string]>) {
  server.close();
  await odoo.close();
  await start(errors);
}

const json = { "Content-Type": "application/json", "X-FACE-Request": "1" };

async function signIn(user: { login: string; apiKey: string }): Promise<string> {
  const res = await fetch(`${base}/face/api/login`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ login: user.login, apiKey: user.apiKey }),
  });
  assert.equal(res.status, 200);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function call(cookie: string, method: string, p: string, body?: unknown) {
  const res = await fetch(`${base}/face/api${p}`, {
    method,
    headers: { ...json, Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

const tpl = (id = "custom-1764230000000", label = "Audac MFA208", extra: Record<string, unknown> = {}) => ({
  id,
  label,
  deviceType: "amplifier",
  manufacturer: "Audac",
  modelNumber: "MFA208",
  ports: [
    { id: "tpl-0", label: "Mic 1", signalType: "analog-audio", direction: "input", connectorType: "combo-xlr-trs" },
    { id: "tpl-1", label: "Speaker A", signalType: "speaker-level", direction: "output", connectorType: "phoenix" },
  ],
  ...extra,
});

// --- reading and creating ------------------------------------------------------------

test("every library route needs a session", async () => {
  for (const [method, p] of [["GET", "/library"], ["POST", "/library"], ["PUT", "/library/custom-1"], ["POST", "/library/custom-1/archive"], ["POST", "/library/upload"], ["GET", "/library/products?q=a"]]) {
    const res = await fetch(`${base}/face/api${p}`, { method, headers: json });
    assert.equal(res.status, 401, `${method} ${p}`);
  }
});

test("a created template is listed for every user, with version, author and the version inside the template", async () => {
  const jl = await signIn(MOCK_USER);
  assert.deepEqual((await call(jl, "GET", "/library")).body, []);

  const created = await call(jl, "POST", "/library", { template: tpl() });
  assert.equal(created.status, 201);
  assert.equal(created.body.key, "custom-1764230000000");
  assert.equal(created.body.version, 1);
  assert.equal(created.body.writtenBy, MOCK_USER.name);
  assert.equal(created.body.productId, null);
  assert.equal(created.body.template.version, 1);
  assert.equal(created.body.template.label, "Audac MFA208");
  assert.equal(odoo.templates[0].origin, "editor");

  const max = await signIn(MOCK_USER_2);
  const list = await call(max, "GET", "/library");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.deepEqual(list.body[0].template.ports, tpl().ports);
});

test("the stored JSON carries no version of its own — Odoo counts", async () => {
  const jl = await signIn(MOCK_USER);
  await call(jl, "POST", "/library", { template: tpl("custom-1", "A", { version: 7 }) });
  assert.equal(JSON.parse(odoo.templates[0].data).version, undefined);
  assert.equal((await call(jl, "GET", "/library")).body[0].version, 1);
});

test("creating refuses an invalid template with the check's sentence, and a key that exists", async () => {
  const jl = await signIn(MOCK_USER);
  const bad = await call(jl, "POST", "/library", { template: tpl("custom-2", "Kaputt", { referenceUrl: "javascript:alert(1)" }) });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Kaputt.*referenceUrl/);
  assert.equal((await call(jl, "POST", "/library", {})).status, 400);

  assert.equal((await call(jl, "POST", "/library", { template: tpl() })).status, 201);
  const again = await call(jl, "POST", "/library", { template: tpl() });
  assert.equal(again.status, 409);
  assert.equal(again.body.reason, "exists");
});

test("origin is editor or claude; upload has its own route", async () => {
  const jl = await signIn(MOCK_USER);
  assert.equal((await call(jl, "POST", "/library", { template: tpl("custom-3"), origin: "claude" })).status, 201);
  assert.equal(odoo.templates[0].origin, "claude");
  assert.equal((await call(jl, "POST", "/library", { template: tpl("custom-4"), origin: "upload" })).status, 400);
});

// --- changing ------------------------------------------------------------------------

test("a change with the current version raises it; an older version is refused with who changed it", async () => {
  const jl = await signIn(MOCK_USER);
  const max = await signIn(MOCK_USER_2);
  await call(jl, "POST", "/library", { template: tpl() });

  const changed = await call(max, "PUT", "/library/custom-1764230000000", { template: tpl(undefined, "Audac MFA208 neu"), baseVersion: 1 });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.version, 2);
  assert.equal(changed.body.template.label, "Audac MFA208 neu");
  assert.equal(changed.body.writtenBy, MOCK_USER_2.name);

  const stale = await call(jl, "PUT", "/library/custom-1764230000000", { template: tpl(undefined, "Mein Stand"), baseVersion: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.reason, "stale");
  assert.equal(stale.body.writtenBy, MOCK_USER_2.name);
  assert.equal(stale.body.version, 2);
  assert.match(stale.body.error, /Max Mustermann/);
});

test("Odoo's own version guard (a write in between) also ends as a stale conflict", async () => {
  await restartWith({ "face.schematic.template.write": ["odoo.exceptions.UserError", "Die Vorlage wurde inzwischen geändert."] });
  const jl = await signIn(MOCK_USER);
  await call(jl, "POST", "/library", { template: tpl() });
  const res = await call(jl, "PUT", "/library/custom-1764230000000", { template: tpl(undefined, "B"), baseVersion: 1 });
  assert.equal(res.status, 409);
  assert.equal(res.body.reason, "stale");
});

test("changing refuses a mismatched id, an unknown key and a missing baseVersion", async () => {
  const jl = await signIn(MOCK_USER);
  await call(jl, "POST", "/library", { template: tpl() });
  assert.equal((await call(jl, "PUT", "/library/custom-1764230000000", { template: tpl("custom-other"), baseVersion: 1 })).status, 400);
  assert.equal((await call(jl, "PUT", "/library/custom-1764230000000", { template: tpl() })).status, 400);
  assert.equal((await call(jl, "PUT", "/library/custom-unknown", { template: tpl("custom-unknown"), baseVersion: 1 })).status, 404);
});

test("the Odoo product is set, shown and cleared without touching the version", async () => {
  const jl = await signIn(MOCK_USER);
  const created = await call(jl, "POST", "/library", { template: tpl(), productId: 9001 });
  assert.equal(created.body.productId, 9001);
  assert.equal(created.body.productName, "[MFA208] Audac MFA208 Mischverstärker");

  const cleared = await call(jl, "PUT", "/library/custom-1764230000000", { productId: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.productId, null);
  assert.equal(cleared.body.version, 1);

  const set = await call(jl, "PUT", "/library/custom-1764230000000", { productId: 9002 });
  assert.equal(set.body.productName, "[DM6SE] Bose DesignMax DM6SE");
  assert.equal((await call(jl, "PUT", "/library/custom-1764230000000", {})).status, 400, "nothing to change");
});

test("archiving takes a template out of the list; an archived one cannot be changed", async () => {
  const jl = await signIn(MOCK_USER);
  await call(jl, "POST", "/library", { template: tpl() });
  assert.equal((await call(jl, "POST", "/library/custom-1764230000000/archive")).status, 204);
  assert.deepEqual((await call(jl, "GET", "/library")).body, []);
  assert.equal((await call(jl, "PUT", "/library/custom-1764230000000", { template: tpl(), baseVersion: 1 })).status, 404);
  assert.equal((await call(jl, "POST", "/library", { template: tpl() })).status, 409, "the key stays taken");
});

// --- upload ------------------------------------------------------------------------------

test("upload adds what is new, recognises what is the same, and reports what differs or is invalid", async () => {
  const jl = await signIn(MOCK_USER);
  await call(jl, "POST", "/library", { template: tpl("custom-same", "Gleich") });
  await call(jl, "POST", "/library", { template: tpl("custom-diff", "Anders") });

  // Same content in another key order and with a stale version counts as the same.
  const same = tpl("custom-same", "Gleich");
  const reordered = { version: 4, ports: same.ports, label: same.label, id: same.id, manufacturer: same.manufacturer, modelNumber: same.modelNumber, deviceType: same.deviceType };
  const res = await call(jl, "POST", "/library/upload", {
    templates: [tpl("custom-new", "Neu"), reordered, tpl("custom-diff", "Anders, aber lokal geändert"), tpl("custom-bad", "Kaputt", { ports: "x" })],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.added.map((e: { key: string }) => e.key), ["custom-new"]);
  assert.deepEqual(res.body.same.map((e: { key: string }) => e.key), ["custom-same"]);
  assert.deepEqual(res.body.skipped.map((s: { key: string; reason: string }) => [s.key, s.reason]), [
    ["custom-diff", "different"],
    ["custom-bad", "invalid"],
  ]);
  assert.match(res.body.skipped[1].error, /ports/);
  assert.equal(odoo.templates.find((t) => t.key === "custom-new")?.origin, "upload");

  const again = await call(jl, "POST", "/library/upload", { templates: [tpl("custom-new", "Neu")] });
  assert.deepEqual(again.body.added, []);
  assert.equal(again.body.same.length, 1);
  assert.equal(odoo.templates.length, 3);
});

test("upload refuses what is not a list", async () => {
  const jl = await signIn(MOCK_USER);
  assert.equal((await call(jl, "POST", "/library/upload", { templates: {} })).status, 400);
});

// --- products ------------------------------------------------------------------------

test("product search matches name and internal reference", async () => {
  const jl = await signIn(MOCK_USER);
  const byName = await call(jl, "GET", "/library/products?q=designmax");
  assert.deepEqual(byName.body, [{ id: 9002, name: "[DM6SE] Bose DesignMax DM6SE", code: "DM6SE" }]);
  const byCode = await call(jl, "GET", "/library/products?q=MFA2");
  assert.deepEqual(byCode.body.map((p: { id: number }) => p.id), [9001]);
  assert.deepEqual((await call(jl, "GET", "/library/products?q=")).body, []);
});

// --- Odoo errors ---------------------------------------------------------------------------

test("without the Odoo module the library says so (503), so the editor stays local", async () => {
  await restartWith({ "face.schematic.template.search_read": ["builtins.KeyError", "'face.schematic.template'"] });
  const jl = await signIn(MOCK_USER);
  const res = await call(jl, "GET", "/library");
  assert.equal(res.status, 503);
  assert.match(res.body.error, /face_schematic_library/);
});

test("missing rights in Odoo end as 403 with Odoo's sentence", async () => {
  await restartWith({ "face.schematic.template.search_read": ["odoo.exceptions.AccessError", "Kein Zugriff auf Gerätevorlagen."] });
  const jl = await signIn(MOCK_USER);
  const res = await call(jl, "GET", "/library");
  assert.equal(res.status, 403);
  assert.match(res.body.error, /Kein Zugriff/);
});
