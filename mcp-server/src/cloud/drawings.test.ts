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
