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
const clock = { now: Date.now() };

beforeEach(async () => {
  odoo = await startMockOdoo();
  const config = loadConfig({
    FACE_SECRET: "s".repeat(40),
    FACE_PUBLIC_URL: "http://localhost:5173",
    ODOO_URL: odoo.url,
    DATA_DIR: mkdtempSync(path.join(tmpdir(), "face-drawings-")),
  });
  clock.now = Date.now();
  server = createApp(config, { now: () => clock.now }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.close();
  await odoo.close();
});

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

async function get(cookie: string, p: string) {
  const res = await fetch(`${base}/face/api${p}`, { headers: { Cookie: cookie } });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

// --- Task 6: reading ---------------------------------------------------------------

test("projects, drawings and loading all need a session", async () => {
  for (const p of ["/projects", "/projects/101/drawings", "/drawings/501"]) {
    assert.equal((await fetch(`${base}/face/api${p}`)).status, 401, p);
  }
});

test("project search matches project and customer name, newest first", async () => {
  const cookie = await signIn(MOCK_USER);
  const all = await get(cookie, "/projects");
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.map((p: { id: number }) => p.id), [102, 101]);
  assert.deepEqual(all.body[0], { id: 102, name: "Pier 99", customer: "S.I.R. Betriebsgesellschaft mbH" });

  const byNumber = await get(cookie, "/projects?q=FACE/26/10/560");
  assert.deepEqual(byNumber.body.map((p: { id: number }) => p.id), [101]);
  const byCustomer = await get(cookie, "/projects?q=betriebs");
  assert.deepEqual(byCustomer.body.map((p: { id: number }) => p.id), [102]);
});

test("a project's drawing list holds only its FACESchematic attachments, with who saved last", async () => {
  const cookie = await signIn(MOCK_USER);
  const list = await get(cookie, "/projects/101/drawings");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.deepEqual(list.body[0], {
    id: 501,
    name: "Beschallung EG",
    projectId: 101,
    writeDate: "2026-10-21 16:40:00",
    writtenBy: MOCK_USER.name,
    sizeBytes: 20,
    editedBy: null,
    editedSince: null,
  });
  assert.deepEqual((await get(cookie, "/projects/102/drawings")).body, []);
});

test("loading returns the content with the project's name", async () => {
  const cookie = await signIn(MOCK_USER_2);
  const d = await get(cookie, "/drawings/501");
  assert.equal(d.status, 200);
  assert.equal(d.body.projectName, "SOCCERBEAT GmbH - FACE/26/10/560");
  assert.equal(d.body.name, "Beschallung EG");
  assert.deepEqual(d.body.data, { version: 49, schematicName: "Beschallung EG", nodes: [], edges: [] });
});

test("anything that is not a FACESchematic drawing on a project is not loaded", async () => {
  const cookie = await signIn(MOCK_USER);
  assert.equal((await get(cookie, "/drawings/502")).status, 404, "other file on the project");
  assert.equal((await get(cookie, "/drawings/503")).status, 404, "drawing name on another model");
  assert.equal((await get(cookie, "/drawings/999")).status, 404, "missing");
  assert.equal((await get(cookie, "/drawings/abc")).status, 400, "not an id");
});

// --- Task 7: writing, locks, viewers, stale saves ------------------------------------

async function post(cookie: string, p: string, body: unknown) {
  const res = await fetch(`${base}/face/api${p}`, { method: "POST", headers: { ...json, Cookie: cookie }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function put(cookie: string, p: string, body: unknown) {
  const res = await fetch(`${base}/face/api${p}`, { method: "PUT", headers: { ...json, Cookie: cookie }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

const DATA = { version: 49, schematicName: "Neu", nodes: [], edges: [] };
const secs = (n: number) => (clock.now += n * 1000);

test("creating a drawing stores it on the project and gives the creating tab the lock", async () => {
  const jl = await signIn(MOCK_USER);
  const created = await post(jl, "/projects/102/drawings", { name: "Beschallung / OG", data: DATA, tabId: "jl-A" });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Beschallung OG");
  assert.equal(created.body.projectName, "Pier 99");
  const att = odoo.attachments.find((a) => a.id === created.body.id)!;
  assert.equal(att.name, "Beschallung OG.faceschematic.json");
  assert.equal(att.res_model, "project.project");
  assert.equal(att.res_id, 102);
  assert.deepEqual(JSON.parse(Buffer.from(att.datas, "base64").toString("utf8")), DATA);

  const list = await get(jl, "/projects/102/drawings");
  assert.equal(list.body[0].editedBy, MOCK_USER.name);
  assert.equal(typeof list.body[0].editedSince, "number");
});

test("a second drawing with the same name on the same project is refused", async () => {
  const jl = await signIn(MOCK_USER);
  const again = await post(jl, "/projects/101/drawings", { name: "Beschallung EG", data: DATA, tabId: "jl-A" });
  assert.equal(again.status, 409);
  assert.match(again.body.error, /gibt es in diesem Projekt schon/);
});

test("someone else gets the holder's name, cannot take the lock and cannot save", async () => {
  const jl = await signIn(MOCK_USER);
  const max = await signIn(MOCK_USER_2);
  assert.equal((await post(jl, "/drawings/501/lock", { tabId: "jl-A" })).status, 200);

  const refused = await post(max, "/drawings/501/lock", { tabId: "max-A", takeOver: true });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.holder.name, MOCK_USER.name);
  assert.equal(refused.body.holder.sameUser, false);

  const save = await put(max, "/drawings/501", { data: DATA, tabId: "max-A", baseWriteDate: "2026-10-21 16:40:00" });
  assert.equal(save.status, 409);
  assert.equal(save.body.reason, "locked");
});

test("my own second tab is told so, and may take the lock over", async () => {
  const jl = await signIn(MOCK_USER);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  const other = await post(jl, "/drawings/501/lock", { tabId: "jl-B" });
  assert.equal(other.status, 409);
  assert.equal(other.body.holder.sameUser, true);
  assert.equal((await post(jl, "/drawings/501/lock", { tabId: "jl-B", takeOver: true })).status, 200);
  const oldTab = await put(jl, "/drawings/501", { data: DATA, tabId: "jl-A", baseWriteDate: "2026-10-21 16:40:00" });
  assert.equal(oldTab.status, 409);
});

test("a lock lives on heartbeats and lapses 90 s after the last one", async () => {
  const jl = await signIn(MOCK_USER);
  const max = await signIn(MOCK_USER_2);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  secs(60);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  secs(60);
  assert.equal((await post(max, "/drawings/501/lock", { tabId: "max-A" })).status, 409, "kept alive by the heartbeat");
  secs(31);
  assert.equal((await post(max, "/drawings/501/lock", { tabId: "max-A" })).status, 200, "lapsed");
});

test("unlocking frees the drawing at once", async () => {
  const jl = await signIn(MOCK_USER);
  const max = await signIn(MOCK_USER_2);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  const res = await fetch(`${base}/face/api/drawings/501/unlock`, {
    method: "POST", headers: { ...json, Cookie: jl }, body: JSON.stringify({ tabId: "jl-A" }),
  });
  assert.equal(res.status, 204);
  assert.equal((await post(max, "/drawings/501/lock", { tabId: "max-A" })).status, 200);
});

test("the editor sees who else has the drawing open, until their heartbeats stop", async () => {
  const jl = await signIn(MOCK_USER);
  const max = await signIn(MOCK_USER_2);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  const view = await post(max, "/drawings/501/view", { tabId: "max-A" });
  assert.equal(view.status, 200);
  assert.equal(view.body.holder.name, MOCK_USER.name);

  assert.deepEqual((await post(jl, "/drawings/501/lock", { tabId: "jl-A" })).body.viewers, [MOCK_USER_2.name]);
  secs(60);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  secs(31);
  assert.deepEqual((await post(jl, "/drawings/501/lock", { tabId: "jl-A" })).body.viewers, []);
});

test("saving overwrites, and returns the new write date", async () => {
  const jl = await signIn(MOCK_USER);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  const saved = await put(jl, "/drawings/501", { data: DATA, tabId: "jl-A", baseWriteDate: "2026-10-21 16:40:00" });
  assert.equal(saved.status, 200);
  assert.notEqual(saved.body.writeDate, "2026-10-21 16:40:00");
  const att = odoo.attachments.find((a) => a.id === 501)!;
  assert.deepEqual(JSON.parse(Buffer.from(att.datas, "base64").toString("utf8")), DATA);
});

test("a save over someone else's newer save asks first (stale), and goes through with force", async () => {
  const jl = await signIn(MOCK_USER);
  await post(jl, "/drawings/501/lock", { tabId: "jl-A" });
  // Max saved while Jean-Luc's lock had lapsed (e.g. a dropped connection).
  Object.assign(odoo.attachments.find((a) => a.id === 501)!, {
    write_date: "2026-10-22 15:10:00",
    write_uid: [MOCK_USER_2.uid, MOCK_USER_2.name],
  });
  const stale = await put(jl, "/drawings/501", { data: DATA, tabId: "jl-A", baseWriteDate: "2026-10-21 16:40:00" });
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.body, { reason: "stale", writtenBy: MOCK_USER_2.name, writeDate: "2026-10-22 15:10:00", error: stale.body.error });
  const forced = await put(jl, "/drawings/501", { data: DATA, tabId: "jl-A", baseWriteDate: "2026-10-21 16:40:00", force: true });
  assert.equal(forced.status, 200);
});

test("locking or viewing something that is not a drawing is 404", async () => {
  const jl = await signIn(MOCK_USER);
  assert.equal((await post(jl, "/drawings/502/lock", { tabId: "jl-A" })).status, 404);
  assert.equal((await post(jl, "/drawings/503/view", { tabId: "jl-A" })).status, 404);
});

test("missing write rights in Odoo come back as 403 with Odoo's reason", async () => {
  server.close();
  await odoo.close();
  odoo = await startMockOdoo({}, { "ir.attachment.write": ["odoo.exceptions.AccessError", "Sie dürfen Anhänge dieses Projekts nicht ändern."] });
  const config = loadConfig({ FACE_SECRET: "s".repeat(40), FACE_PUBLIC_URL: "http://localhost:5173", ODOO_URL: odoo.url, DATA_DIR: mkdtempSync(path.join(tmpdir(), "face-drawings-")) });
  server = createApp(config, { now: () => clock.now }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const max = await signIn(MOCK_USER_2);
  await post(max, "/drawings/501/lock", { tabId: "max-A" });
  const res = await put(max, "/drawings/501", { data: DATA, tabId: "max-A", baseWriteDate: "2026-10-21 16:40:00" });
  assert.equal(res.status, 403);
  assert.match(res.body.error, /Keine Berechtigung in Odoo: Sie dürfen Anhänge/);
});
