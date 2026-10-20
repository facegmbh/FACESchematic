import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server.js";
import { loadConfig } from "./config.js";
import { startMockOdoo, MOCK_USER, type MockOdoo } from "./mockOdoo.js";

let odoo: MockOdoo;
before(async () => {
  odoo = await startMockOdoo();
});
after(() => odoo.close());

interface Running {
  base: string;
  dataDir: string;
  clock: { now: number };
  close: () => void;
}

/** A fresh backend against the mock Odoo, with its own data dir and a clock the test moves. */
function start(): Running {
  const dataDir = mkdtempSync(path.join(tmpdir(), "face-auth-"));
  const config = loadConfig({
    FACE_SECRET: "s".repeat(40),
    FACE_PUBLIC_URL: "http://localhost:5173",
    ODOO_URL: odoo.url,
    DATA_DIR: dataDir,
  });
  const clock = { now: Date.now() };
  const server: Server = createApp(config, { now: () => clock.now }).listen(0);
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, dataDir, clock, close: () => server.close() };
}

const json = { "Content-Type": "application/json", "X-FACE-Request": "1" };

async function login(base: string, login: string, apiKey: string) {
  return fetch(`${base}/face/api/login`, { method: "POST", headers: json, body: JSON.stringify({ login, apiKey }) });
}

const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

test("valid Odoo credentials sign in, set the session cookie and /me knows the user", async () => {
  const app = start();
  try {
    const res = await login(app.base, MOCK_USER.login, MOCK_USER.apiKey);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { uid: MOCK_USER.uid, name: MOCK_USER.name, login: MOCK_USER.login });
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^face_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\/face/);

    const me = await fetch(`${app.base}/face/api/me`, { headers: { Cookie: cookieOf(res) } });
    assert.equal(me.status, 200);
    assert.equal(((await me.json()) as { name: string }).name, MOCK_USER.name);
  } finally {
    app.close();
  }
});

test("/me without a session is 401", async () => {
  const app = start();
  try {
    assert.equal((await fetch(`${app.base}/face/api/me`)).status, 401);
    assert.equal((await fetch(`${app.base}/face/api/me`, { headers: { Cookie: "face_session=forged" } })).status, 401);
  } finally {
    app.close();
  }
});

test("wrong credentials: 401 in German, no cookie, and Odoo is left alone for five minutes", async () => {
  const app = start();
  try {
    const before = odoo.authCalls.length;
    const res = await login(app.base, MOCK_USER.login, "wrong-key");
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("set-cookie"), null);
    assert.match(((await res.json()) as { error: string }).error, /API-Schlüssel/);

    // Even the right key waits out the pause — and never reaches Odoo meanwhile.
    const paused = await login(app.base, MOCK_USER.login, MOCK_USER.apiKey);
    assert.equal(paused.status, 429);
    assert.equal(odoo.authCalls.length, before + 1);

    app.clock.now += 5 * 60 * 1000 + 1;
    assert.equal((await login(app.base, MOCK_USER.login, MOCK_USER.apiKey)).status, 200);
  } finally {
    app.close();
  }
});

test("more than ten sign-in attempts in fifteen minutes from one address: 429", async () => {
  const app = start();
  try {
    for (let i = 0; i < 10; i++) assert.equal((await login(app.base, MOCK_USER.login, MOCK_USER.apiKey)).status, 200);
    assert.equal((await login(app.base, MOCK_USER.login, MOCK_USER.apiKey)).status, 429);
  } finally {
    app.close();
  }
});

test("a changing request without X-FACE-Request is refused (403)", async () => {
  const app = start();
  try {
    const res = await fetch(`${app.base}/face/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: MOCK_USER.login, apiKey: MOCK_USER.apiKey }),
    });
    assert.equal(res.status, 403);
  } finally {
    app.close();
  }
});

test("logout ends the session on the server, not just in the browser", async () => {
  const app = start();
  try {
    const cookie = cookieOf(await login(app.base, MOCK_USER.login, MOCK_USER.apiKey));
    const out = await fetch(`${app.base}/face/api/logout`, { method: "POST", headers: { ...json, Cookie: cookie } });
    assert.equal(out.status, 204);
    assert.match(out.headers.get("set-cookie") ?? "", /face_session=;/);
    assert.equal((await fetch(`${app.base}/face/api/me`, { headers: { Cookie: cookie } })).status, 401);
  } finally {
    app.close();
  }
});

test("the session survives a restart of the backend", async () => {
  const first = start();
  const cookie = cookieOf(await login(first.base, MOCK_USER.login, MOCK_USER.apiKey));
  first.close();
  // Same data dir, new process state.
  const config = loadConfig({ FACE_SECRET: "s".repeat(40), FACE_PUBLIC_URL: "http://localhost:5173", ODOO_URL: odoo.url, DATA_DIR: first.dataDir });
  const server = createApp(config).listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    assert.equal((await fetch(`http://127.0.0.1:${port}/face/api/me`, { headers: { Cookie: cookie } })).status, 200);
  } finally {
    server.close();
  }
});

test("store.json holds neither the API key nor the session id in clear text", async () => {
  const app = start();
  try {
    const res = await login(app.base, MOCK_USER.login, MOCK_USER.apiKey);
    const sessionId = cookieOf(res).split("=")[1];
    const raw = readFileSync(path.join(app.dataDir, "store.json"), "utf8");
    assert.ok(!raw.includes(MOCK_USER.apiKey), "API key in clear text");
    assert.ok(!raw.includes(sessionId), "session id in clear text");
    assert.ok(raw.includes(MOCK_USER.login));
  } finally {
    app.close();
  }
});
