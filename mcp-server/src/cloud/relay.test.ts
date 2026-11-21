import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Relay, NoTabError, CallTimeoutError, TabLostError, TAB_GONE_MS } from "./relay.js";
import { createApp } from "./server.js";
import { loadConfig } from "./config.js";
import { startMockOdoo, MOCK_USER, MOCK_USER_2, type MockOdoo } from "./mockOdoo.js";
import { PROTOCOL_VERSION } from "../protocol.generated.js";

// --- The relay on its own (fake clock, short poll) ----------------------------------

function relayWithClock() {
  const clock = { now: 1_000_000 };
  const relay = new Relay(() => clock.now, { pollWaitMs: 30 });
  return { relay, clock };
}

test("a command for a user reaches that user's tab and its answer comes back", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "Pier 99");
  const answer = relay.call(8, "list_devices", { x: 1 }, 1000);
  const polled = await relay.poll(8, "tab-a");
  assert.equal(polled.type, "command");
  if (polled.type !== "command") return;
  assert.equal(polled.command, "list_devices");
  assert.deepEqual(polled.params, { x: 1 });
  assert.equal(relay.respond(8, "tab-a", polled.requestId, { ok: true, result: { devices: [] } }), true);
  assert.deepEqual(await answer, { ok: true, result: { devices: [] } });
});

test("a waiting poll gets a command the moment it arrives", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "Pier 99");
  const polling = relay.poll(8, "tab-a");
  void relay.call(8, "get_schematic", {}, 1000).catch(() => {});
  const polled = await polling;
  assert.equal(polled.type, "command");
});

test("a command for one user never reaches another user's tab", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  relay.hello(9, "tab-b", "B");
  void relay.call(8, "list_devices", {}, 1000).catch(() => {});
  assert.deepEqual(await relay.poll(9, "tab-b"), { type: "idle" });
  // Nor can the other user answer it.
  const polled = await relay.poll(8, "tab-a");
  assert.equal(polled.type, "command");
  if (polled.type !== "command") return;
  assert.equal(relay.respond(9, "tab-b", polled.requestId, { ok: true, result: "fremd" }), false);
});

test("no tab: the call fails at once with NoTabError", async () => {
  const { relay } = relayWithClock();
  await assert.rejects(relay.call(8, "list_devices", {}, 1000), NoTabError);
});

test("a tab that has not polled for 40 s counts as gone", async () => {
  const { relay, clock } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  clock.now += TAB_GONE_MS + 1;
  await assert.rejects(relay.call(8, "list_devices", {}, 1000), NoTabError);
  assert.equal(relay.status(8), null);
});

test("a tab waiting in a poll stays alive however long it waits", async () => {
  const { relay, clock } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const polling = relay.poll(8, "tab-a");
  clock.now += TAB_GONE_MS + 1;
  const answer = relay.call(8, "list_devices", {}, 1000);
  const polled = await polling;
  assert.equal(polled.type, "command");
  if (polled.type === "command") relay.respond(8, "tab-a", polled.requestId, { ok: true, result: 1 });
  assert.deepEqual(await answer, { ok: true, result: 1 });
});

test("a second tab of the same user takes over; the first is told so on its next poll", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const waiting = relay.poll(8, "tab-a");
  relay.hello(8, "tab-b", "B");
  assert.deepEqual(await waiting, { type: "superseded" });
  assert.deepEqual(await relay.poll(8, "tab-a"), { type: "superseded" });
  assert.equal(relay.status(8)?.schematicName, "B");
});

test("a command waiting for the old tab fails when another tab takes over", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const answer = relay.call(8, "list_devices", {}, 1000);
  relay.hello(8, "tab-b", "B");
  await assert.rejects(answer, NoTabError);
});

test("an unknown tab is told to say hello again (backend restarted)", async () => {
  const { relay } = relayWithClock();
  assert.deepEqual(await relay.poll(8, "tab-a"), { type: "unbound" });
});

test("no answer in time → CallTimeoutError, and a late answer is ignored", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const answer = relay.call(8, "list_devices", {}, 20);
  const polled = await relay.poll(8, "tab-a");
  await assert.rejects(answer, CallTimeoutError);
  if (polled.type === "command") {
    assert.equal(relay.respond(8, "tab-a", polled.requestId, { ok: true, result: 1 }), false);
  }
});

test("a poll whose connection closed does not swallow the next command", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const abort = new AbortController();
  const dropped = relay.poll(8, "tab-a", abort.signal);
  abort.abort();
  assert.deepEqual(await dropped, { type: "idle" });
  void relay.call(8, "list_devices", {}, 1000).catch(() => {});
  const polled = await relay.poll(8, "tab-a");
  assert.equal(polled.type, "command");
});

test("the tab may report a failed command; the caller gets the error text", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const answer = relay.call(8, "get_device", {}, 1000);
  const polled = await relay.poll(8, "tab-a");
  if (polled.type === "command") relay.respond(8, "tab-a", polled.requestId, { ok: false, error: "Gerät nicht gefunden." });
  assert.deepEqual(await answer, { ok: false, error: "Gerät nicht gefunden." });
});

// --- The tab routes (/face/bridge) --------------------------------------------------

let odoo: MockOdoo;
let server: Server;
let base: string;
let relay: Relay;

beforeEach(async () => {
  odoo = await startMockOdoo();
  const config = loadConfig({
    FACE_SECRET: "s".repeat(40),
    FACE_PUBLIC_URL: "http://localhost:5173",
    ODOO_URL: odoo.url,
    DATA_DIR: mkdtempSync(path.join(tmpdir(), "face-relay-")),
  });
  relay = new Relay(Date.now, { pollWaitMs: 50 });
  server = createApp(config, { relay }).listen(0);
  base = `http://[::1]:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
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

function hello(cookie: string, tabId: string, protocolVersion = PROTOCOL_VERSION, takeOver = true) {
  return fetch(`${base}/face/bridge/hello`, {
    method: "POST",
    headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ tabId, schematicName: "Pier 99", protocolVersion, takeOver }),
  });
}

function poll(cookie: string, tabId: string) {
  return fetch(`${base}/face/bridge/poll?tabId=${tabId}`, { headers: { Cookie: cookie, "X-FACE-Request": "1" } });
}

test("bridge routes need a session, and every one of them the FACE header", async () => {
  assert.equal((await fetch(`${base}/face/bridge/poll?tabId=t1`, { headers: { "X-FACE-Request": "1" } })).status, 401);
  const cookie = await signIn(MOCK_USER);
  await hello(cookie, "t1");
  // A poll hands out commands — it changes state, so it needs the header like the POSTs.
  assert.equal((await fetch(`${base}/face/bridge/poll?tabId=t1`, { headers: { Cookie: cookie } })).status, 403);
  const noHeader = await fetch(`${base}/face/bridge/hello`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ tabId: "t1", schematicName: "x", protocolVersion: PROTOCOL_VERSION }),
  });
  assert.equal(noHeader.status, 403);
});

test("hello binds the tab to the signed-in user; a command arrives over poll and the answer comes back", async () => {
  const cookie = await signIn(MOCK_USER);
  assert.equal((await hello(cookie, "t1")).status, 204);
  assert.equal(relay.status(MOCK_USER.uid)?.schematicName, "Pier 99");

  const answer = relay.call(MOCK_USER.uid, "list_devices", {}, 2000);
  const res = await poll(cookie, "t1");
  assert.equal(res.status, 200);
  const msg = (await res.json()) as { type: string; requestId: string; command: string };
  assert.equal(msg.type, "command");
  assert.equal(msg.command, "list_devices");

  const respond = await fetch(`${base}/face/bridge/respond`, {
    method: "POST",
    headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ tabId: "t1", requestId: msg.requestId, ok: true, result: { n: 3 } }),
  });
  assert.equal(respond.status, 204);
  assert.deepEqual(await answer, { ok: true, result: { n: 3 } });
});

test("another user's poll never gets the command, and cannot answer it", async () => {
  const jl = await signIn(MOCK_USER);
  const max = await signIn(MOCK_USER_2);
  await hello(jl, "t1");
  await hello(max, "t1"); // same tab id under another user: still another binding
  const answer = relay.call(MOCK_USER.uid, "list_devices", {}, 2000);
  assert.equal((await poll(max, "t1")).status, 204);
  const msg = (await (await poll(jl, "t1")).json()) as { requestId: string };
  const foreign = await fetch(`${base}/face/bridge/respond`, {
    method: "POST",
    headers: { ...json, Cookie: max },
    body: JSON.stringify({ tabId: "t1", requestId: msg.requestId, ok: true, result: "fremd" }),
  });
  assert.equal(foreign.status, 404);
  relay.respond(MOCK_USER.uid, "t1", msg.requestId, { ok: true, result: "eigen" });
  assert.deepEqual(await answer, { ok: true, result: "eigen" });
});

test("poll without hello → 409 unbound; superseded tab → superseded", async () => {
  const cookie = await signIn(MOCK_USER);
  const unbound = await poll(cookie, "t1");
  assert.equal(unbound.status, 409);
  assert.equal(((await unbound.json()) as { reason: string }).reason, "unbound");

  await hello(cookie, "t1");
  await hello(cookie, "t2");
  const res = await poll(cookie, "t1");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { type: "superseded" });
});

test("a tab with another protocol version is asked to reload", async () => {
  const cookie = await signIn(MOCK_USER);
  const res = await hello(cookie, "t1", PROTOCOL_VERSION + 1);
  assert.equal(res.status, 409);
  const body = (await res.json()) as { reason: string; error: string };
  assert.equal(body.reason, "protocol");
  assert.match(body.error, /neu laden/);
});

test("a malformed tab id is refused", async () => {
  const cookie = await signIn(MOCK_USER);
  assert.equal((await hello(cookie, "../x")).status, 400);
  assert.equal((await poll(cookie, "")).status, 400);
});

// --- Leaving: the tab says bye, or its user signs out --------------------------------

test("bye: a call right after fails at once with NoTabError instead of waiting for the timeout", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const waiting = relay.call(8, "list_devices", {}, 5000);
  relay.bye(8, "tab-a");
  await assert.rejects(waiting, NoTabError);
  await assert.rejects(relay.call(8, "list_devices", {}, 5000), NoTabError);
});

test("bye from a tab that no longer has the connection changes nothing", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  relay.hello(8, "tab-b", "B");
  relay.bye(8, "tab-a");
  assert.equal(relay.status(8)?.tabId, "tab-b");
});

test("POST /face/bridge/bye unbinds the tab", async () => {
  const cookie = await signIn(MOCK_USER);
  await hello(cookie, "t1");
  const res = await fetch(`${base}/face/bridge/bye`, {
    method: "POST",
    headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ tabId: "t1" }),
  });
  assert.equal(res.status, 204);
  assert.equal(relay.status(MOCK_USER.uid), null);
});

test("signing out forgets the user's tab", async () => {
  const cookie = await signIn(MOCK_USER);
  await hello(cookie, "t1");
  const res = await fetch(`${base}/face/api/logout`, { method: "POST", headers: { ...json, Cookie: cookie } });
  assert.equal(res.status, 204);
  assert.equal(relay.status(MOCK_USER.uid), null);
});

// --- Review findings (21.11.) -------------------------------------------------------

test("a tab that vanished without bye: the queued command fails as 'no tab', not as a timeout", async () => {
  const { relay, clock } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const answer = relay.call(8, "list_devices", {}, 20);
  clock.now += TAB_GONE_MS + 1;
  await assert.rejects(answer, NoTabError);
});

test("a command the tab already received and then lost → TabLostError (it may have run)", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  const answer = relay.call(8, "save_odoo_drawing", {}, 1000);
  const polled = await relay.poll(8, "tab-a");
  assert.equal(polled.type, "command");
  relay.hello(8, "tab-b", "B");
  await assert.rejects(answer, TabLostError);
});

test("hello without takeOver does not push out a live tab of the same user", async () => {
  const { relay } = relayWithClock();
  relay.hello(8, "tab-a", "A");
  assert.equal(relay.hello(8, "tab-b", "B", false), false);
  assert.equal(relay.status(8)?.tabId, "tab-a");
  // …the same tab saying hello again is fine, and with no live tab a plain hello binds.
  assert.equal(relay.hello(8, "tab-a", "A2", false), true);
  relay.bye(8, "tab-a");
  assert.equal(relay.hello(8, "tab-b", "B", false), true);
});

test("hello route: a reload (takeOver false) gets 409 bound-elsewhere while another tab is connected", async () => {
  const cookie = await signIn(MOCK_USER);
  await hello(cookie, "t1");
  const res = await hello(cookie, "t2", PROTOCOL_VERSION, false);
  assert.equal(res.status, 409);
  const body = (await res.json()) as { reason: string };
  assert.equal(body.reason, "bound-elsewhere");
  assert.equal(relay.status(MOCK_USER.uid)?.tabId, "t1");
});
