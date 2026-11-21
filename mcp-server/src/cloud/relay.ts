/**
 * Relay between the Odoo connector and the user's open editor tab (SPEC-cloud-bridge.md).
 *
 * The tab is the one that runs the commands — against its live store, with undo and autosave —
 * so the backend only carries them: a tab says hello, then keeps one long poll open; a command
 * for its user goes out on that poll, the answer comes back on /respond.
 *
 * Long polling rather than a WebSocket, so nginx proxy manager and the app's nginx need no
 * change. One tab per Odoo user: the tab that said hello last has the connection. Held in
 * memory only, like Presence — after a restart a tab's poll gets "unbound" and it says hello again.
 */
import { randomUUID } from "node:crypto";
import express from "express";
import { PROTOCOL_VERSION } from "../protocol.generated.js";

/** How long a poll waits for a command — below nginx proxy manager's 60 s read timeout. */
export const POLL_WAIT_MS = 25 * 1000;
/** A tab that neither waits in a poll nor has polled for this long is gone. */
export const TAB_GONE_MS = 40 * 1000;

export type PollMessage =
  | { type: "command"; requestId: string; command: string; params: Record<string, unknown> }
  | { type: "superseded" }
  | { type: "unbound" }
  | { type: "idle" };

export type CallResult = { ok: true; result: unknown } | { ok: false; error: string };

/** No tab of this user is connected (never was, closed, or taken over meanwhile). */
export class NoTabError extends Error {}
/** The tab did not answer in time. */
export class CallTimeoutError extends Error {}

interface Command {
  requestId: string;
  command: string;
  params: Record<string, unknown>;
}

interface Pending {
  resolve: (r: CallResult) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

interface Binding {
  tabId: string;
  schematicName: string;
  since: number;
  lastSeen: number;
  queue: Command[];
  waiter: ((m: PollMessage) => void) | null;
  pending: Map<string, Pending>;
}

export interface TabStatus {
  tabId: string;
  schematicName: string;
  since: number;
}

export class Relay {
  private readonly bindings = new Map<number, Binding>();
  /** Tabs that lost the connection to a newer tab, per user — told so once on their next poll. */
  private readonly superseded = new Map<number, Set<string>>();
  private readonly pollWaitMs: number;

  constructor(
    private readonly now: () => number = Date.now,
    opts: { pollWaitMs?: number } = {},
  ) {
    this.pollWaitMs = opts.pollWaitMs ?? POLL_WAIT_MS;
  }

  private alive(b: Binding): boolean {
    return b.waiter !== null || this.now() - b.lastSeen <= TAB_GONE_MS;
  }

  /** The user's bound tab, if it is still there. */
  private binding(uid: number): Binding | undefined {
    const b = this.bindings.get(uid);
    if (!b) return undefined;
    if (this.alive(b)) return b;
    this.drop(uid, b);
    return undefined;
  }

  private drop(uid: number, b: Binding): void {
    this.bindings.delete(uid);
    for (const p of b.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new NoTabError("Der Tab ist nicht mehr verbunden."));
    }
    b.pending.clear();
  }

  hello(uid: number, tabId: string, schematicName: string): void {
    const current = this.bindings.get(uid);
    if (current?.tabId === tabId) {
      current.schematicName = schematicName;
      current.lastSeen = this.now();
      return;
    }
    if (current) {
      let set = this.superseded.get(uid);
      if (!set) this.superseded.set(uid, (set = new Set()));
      set.add(current.tabId);
      // Every page load is a new tab id; remember only the last few.
      if (set.size > 20) set.delete(set.values().next().value as string);
      const waiter = current.waiter;
      current.waiter = null;
      waiter?.({ type: "superseded" });
      this.drop(uid, current);
    }
    this.superseded.get(uid)?.delete(tabId);
    this.bindings.set(uid, {
      tabId,
      schematicName,
      since: this.now(),
      lastSeen: this.now(),
      queue: [],
      waiter: null,
      pending: new Map(),
    });
  }

  status(uid: number): TabStatus | null {
    const b = this.binding(uid);
    return b ? { tabId: b.tabId, schematicName: b.schematicName, since: b.since } : null;
  }

  /** Wait up to the poll time for a command for this tab. */
  poll(uid: number, tabId: string, signal?: AbortSignal): Promise<PollMessage> {
    if (this.superseded.get(uid)?.has(tabId)) return Promise.resolve({ type: "superseded" });
    const b = this.binding(uid);
    if (!b || b.tabId !== tabId) return Promise.resolve({ type: "unbound" });
    b.lastSeen = this.now();
    const next = b.queue.shift();
    if (next) return Promise.resolve({ type: "command", ...next });

    // A second poll of the same tab replaces the first (the first gets "idle").
    b.waiter?.({ type: "idle" });
    return new Promise((resolve) => {
      const finish = (m: PollMessage) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (b.waiter === finish) {
          b.waiter = null;
          b.lastSeen = this.now();
        }
        resolve(m);
      };
      const onAbort = () => finish({ type: "idle" });
      const timer = setTimeout(() => finish({ type: "idle" }), this.pollWaitMs);
      signal?.addEventListener("abort", onAbort, { once: true });
      b.waiter = finish;
      if (signal?.aborted) onAbort();
    });
  }

  /** The tab's answer to a command. False when the request is unknown to this user's tab
   *  (answered already, timed out, or someone else's). */
  respond(uid: number, tabId: string, requestId: string, result: CallResult): boolean {
    const b = this.bindings.get(uid);
    if (!b || b.tabId !== tabId) return false;
    const p = b.pending.get(requestId);
    if (!p) return false;
    b.pending.delete(requestId);
    b.lastSeen = this.now();
    clearTimeout(p.timer);
    p.resolve(result);
    return true;
  }

  /** Run a command in the user's tab. Rejects with NoTabError or CallTimeoutError. */
  call(uid: number, command: string, params: Record<string, unknown>, timeoutMs: number): Promise<CallResult> {
    const b = this.binding(uid);
    if (!b) return Promise.reject(new NoTabError("Kein Tab verbunden."));
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        b.pending.delete(requestId);
        b.queue = b.queue.filter((c) => c.requestId !== requestId);
        reject(new CallTimeoutError(`Der Tab hat nicht rechtzeitig auf „${command}“ geantwortet.`));
      }, timeoutMs);
      b.pending.set(requestId, { resolve, reject, timer });
      const msg = { requestId, command, params };
      const waiter = b.waiter;
      if (waiter) waiter({ type: "command", ...msg });
      else b.queue.push(msg);
    });
  }
}

const TAB_ID = /^[\w-]{1,64}$/;

/** The tab's side: /face/bridge/hello, /poll, /respond — behind sign-in and the FACE header. */
export function createBridgeRouter(relay: Relay): express.Router {
  const router = express.Router();
  const uidOf = (res: express.Response): number => (res.locals.user as { uid: number }).uid;

  router.post("/hello", express.json({ limit: "4kb" }), (req, res) => {
    const { tabId, schematicName, protocolVersion } = req.body ?? {};
    if (typeof tabId !== "string" || !TAB_ID.test(tabId)) {
      res.status(400).json({ error: "Tab-Kennung fehlt." });
      return;
    }
    if (protocolVersion !== PROTOCOL_VERSION) {
      res.status(409).json({ reason: "protocol", error: "Bitte die Seite neu laden — die App passt nicht zum Server." });
      return;
    }
    relay.hello(uidOf(res), tabId, typeof schematicName === "string" ? schematicName.slice(0, 200) : "");
    res.status(204).end();
  });

  router.get("/poll", async (req, res) => {
    const tabId = String(req.query.tabId ?? "");
    if (!TAB_ID.test(tabId)) {
      res.status(400).json({ error: "Tab-Kennung fehlt." });
      return;
    }
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const msg = await relay.poll(uidOf(res), tabId, abort.signal);
    if (res.writableEnded || abort.signal.aborted) return;
    if (msg.type === "idle") res.status(204).end();
    else if (msg.type === "unbound") res.status(409).json({ reason: "unbound" });
    else res.json(msg);
  });

  router.post("/respond", express.json({ limit: "64mb" }), (req, res) => {
    const { tabId, requestId, ok, result, error } = req.body ?? {};
    if (typeof tabId !== "string" || typeof requestId !== "string") {
      res.status(400).json({ error: "Antwort unvollständig." });
      return;
    }
    const answer: CallResult = ok === true ? { ok: true, result } : { ok: false, error: String(error ?? "Befehl fehlgeschlagen.") };
    if (!relay.respond(uidOf(res), tabId, requestId, answer)) {
      res.status(404).json({ reason: "unknown-request" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
