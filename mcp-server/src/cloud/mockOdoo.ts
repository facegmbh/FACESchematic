/**
 * A stand-in for Odoo's JSON-RPC endpoint, for tests only. It knows one user and answers
 * just the calls the backend makes; anything else is an error, so a test notices when the
 * backend starts asking Odoo for something new.
 */
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

export const MOCK_USER = { uid: 8, login: "jl@face-gmbh.com", apiKey: "good-key", name: "Jean-Luc Doijen" };

export interface MockOdoo {
  url: string;
  /** Every authenticate call, in order — to prove the backend held back after a failure. */
  authCalls: { login: string; key: string }[];
  close: () => Promise<void>;
}

type Handler = (args: unknown[], kwargs: Record<string, unknown>) => unknown;

export async function startMockOdoo(extra: Record<string, Handler> = {}): Promise<MockOdoo> {
  const authCalls: { login: string; key: string }[] = [];
  const app = express();
  app.use(express.json({ limit: "64mb" }));
  const reply = (res: express.Response, result: unknown) => res.json({ jsonrpc: "2.0", id: 1, result });
  const fail = (res: express.Response, name: string, message: string) =>
    res.json({ jsonrpc: "2.0", id: 1, error: { message: "Odoo Server Error", data: { name, message } } });

  app.post("/web/database/list", (_req, res) => reply(res, ["facedb"]));

  app.post("/jsonrpc", (req, res) => {
    const { service, method, args } = req.body.params as { service: string; method: string; args: unknown[] };
    if (service === "common" && method === "authenticate") {
      const [, login, key] = args as [string, string, string];
      authCalls.push({ login, key });
      return reply(res, login === MOCK_USER.login && key === MOCK_USER.apiKey ? MOCK_USER.uid : false);
    }
    if (service === "object" && method === "execute_kw") {
      const [, uid, key, model, fn, fnArgs, kwargs] = args as [string, number, string, string, string, unknown[], Record<string, unknown>];
      if (uid !== MOCK_USER.uid || key !== MOCK_USER.apiKey) return fail(res, "odoo.exceptions.AccessDenied", "Access Denied");
      if (model === "res.users" && fn === "read") return reply(res, [{ id: MOCK_USER.uid, name: MOCK_USER.name }]);
      const handler = extra[`${model}.${fn}`];
      if (handler) return reply(res, handler(fnArgs, kwargs ?? {}));
      return fail(res, "builtins.NotImplementedError", `mock: ${model}.${fn} not handled`);
    }
    return fail(res, "builtins.NotImplementedError", `mock: ${service}.${method} not handled`);
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    authCalls,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
