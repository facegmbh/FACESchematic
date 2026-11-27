/**
 * SPEC-device-template.md, Task 47 — Claude reads, creates and changes device templates through
 * the bridge: get_device_template, create_device_template, update_device_template. Signed in,
 * they go to the central library in Odoo (mocked fetch); otherwise into this browser.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { DeviceTemplate } from "../types";
import type { CentralEntry } from "../centralLibraryMerge";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

let store: typeof import("../store").useSchematicStore;
let handlers: typeof import("../mcpBridge").handlers;
let runCommand: typeof import("../mcpBridge").runCommand;
let lib: typeof import("../centralLibrary");
let session: typeof import("../faceBackend").useFaceSession;
let bundled: DeviceTemplate[];
const fetchMock = vi.fn();

function respond(status: number, body?: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}
const callsOf = () => fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${url}`);
const bodyOf = (i: number) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);

/** What the backend answers to a POST/PUT: the template as stored, at `version`. */
const stored = (template: Record<string, unknown>, version: number, product?: [number, string]): CentralEntry => ({
  key: String(template.id),
  version,
  productId: product ? product[0] : null,
  productName: product ? product[1] : null,
  writeDate: "2026-11-27 12:00:00",
  writtenBy: "Jean-Luc Doijen",
  template: { ...template, version } as DeviceTemplate,
});

/** Answer the next POST /face/api/library by echoing the template it carries. */
function echoCreate(version = 1, product?: [number, string]) {
  fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => respond(201, stored(JSON.parse(init.body as string).template, version, product)));
}
function echoUpdate(version: number) {
  fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => respond(200, stored(JSON.parse(init.body as string).template, version)));
}

const ME = { uid: 8, name: "Jean-Luc Doijen", login: "jl@face-gmbh.com" };

const mfa = (extra: Record<string, unknown> = {}) => ({
  label: "Audac MFA208",
  deviceType: "amplifier",
  manufacturer: "Audac",
  modelNumber: "MFA208-TEST",
  ports: [
    { label: "Mic/Line 1", signalType: "analog-audio", direction: "input", connectorType: "combo-xlr-trs" },
    { label: "Speaker A", signalType: "speaker-level", direction: "output", connectorType: "phoenix" },
    { label: "RS-232", signalType: "serial", direction: "bidirectional", connectorType: "db9" },
  ],
  ...extra,
});

async function cmd(name: string, params: Record<string, unknown>) {
  const answer = await runCommand(name, params);
  if (!answer.ok) throw new Error(answer.error);
  return answer.result as any;
}
async function cmdError(name: string, params: Record<string, unknown>) {
  const answer = await runCommand(name, params);
  if (answer.ok) throw new Error(`expected ${name} to fail, got ${JSON.stringify(answer.result)}`);
  return answer.error;
}

beforeAll(async () => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  ({ useSchematicStore: store } = await import("../store"));
  ({ handlers, runCommand } = await import("../mcpBridge"));
  lib = await import("../centralLibrary");
  ({ useFaceSession: session } = await import("../faceBackend"));
  bundled = (await import("../templateApi")).getBundledTemplates();
  (await import("../i18n")).setLocale("de");
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  store.getState().newSchematic();
  store.getState().clearAllCustomTemplates();
  store.getState().applyCentralLibrary([]);
  session.setState({ user: ME, loaded: true, unreachable: false });
  lib.useCentralLibrary.setState({ status: "ok", loadedAt: Date.now(), error: null });
});

describe("create_device_template", () => {
  it("stores a new template in the central library and hands back what add_device needs", async () => {
    echoCreate();
    const r = await cmd("create_device_template", mfa());

    expect(callsOf()).toEqual(["POST /face/api/library"]);
    const body = bodyOf(0);
    expect(body.origin).toBe("claude");
    expect(body.template.id).toMatch(/^custom-\d+/);
    expect(r).toMatchObject({ templateId: body.template.id, version: 1, stored: "odoo", label: "Audac MFA208", deviceType: "amplifier" });
    expect(r.ports).toEqual([
      { id: "p1", label: "Mic/Line 1", signalType: "analog-audio", direction: "input" },
      { id: "p2", label: "Speaker A", signalType: "speaker-level", direction: "output" },
      { id: "p3", label: "RS-232", signalType: "serial", direction: "bidirectional" },
    ]);
    expect(lib.isCentral(r.templateId)).toBe(true);

    const found = await cmd("search_templates", { query: "MFA208-TEST" });
    expect(found.map((f: { templateId: string }) => f.templateId)).toContain(r.templateId);
    const placed = await cmd("add_device", { templateId: r.templateId });
    const device = await cmd("get_device", { nodeId: placed.nodeId });
    expect(device.ports.map((p: { label: string }) => p.label)).toEqual(["Mic/Line 1", "Speaker A", "RS-232"]);
  });

  it("passes a product on and reports its name", async () => {
    echoCreate(1, [9001, "[MFA208] Audac MFA208"]);
    const r = await cmd("create_device_template", mfa({ productId: 9001 }));
    expect(bodyOf(0).productId).toBe(9001);
    expect(r.productName).toBe("[MFA208] Audac MFA208");
  });

  it("without sign-in, it goes into this browser like a device made in the editor", async () => {
    session.setState({ user: null, loaded: true, unreachable: false });
    const r = await cmd("create_device_template", mfa());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.stored).toBe("browser");
    expect(store.getState().customTemplates.map((t) => t.id)).toContain(r.templateId);
    expect(await cmdError("create_device_template", mfa({ modelNumber: "OTHER", productId: 9001 }))).toMatch(/productId/);
  });

  it("refuses a second template with the same maker and model and names the first", async () => {
    echoCreate();
    const first = await cmd("create_device_template", mfa());
    const error = await cmdError("create_device_template", mfa({ label: "Nochmal", manufacturer: " audac ", modelNumber: "mfa208-test" }));
    expect(error).toContain(first.templateId);
    expect(callsOf()).toHaveLength(1);

    echoCreate();
    const again = await cmd("create_device_template", mfa({ label: "Nochmal", allowDuplicate: true }));
    expect(again.templateId).not.toBe(first.templateId);
  });

  it("also knows the bundled library's models", async () => {
    const blaze = bundled.find((t) => t.manufacturer === "Blaze Audio" && t.ampLoad)!;
    const error = await cmdError("create_device_template", mfa({ manufacturer: blaze.manufacturer, modelNumber: blaze.modelNumber }));
    expect(error).toContain(blaze.id!);
  });

  it("passes on the check's sentence for bad input", async () => {
    expect(await cmdError("create_device_template", mfa({ deviceType: "amplifer" }))).toMatch(/amplifier/);
    expect(await cmdError("create_device_template", { ...mfa(), ports: [{ label: "X", signalType: "telepathy", direction: "input" }] })).toMatch(/telepathy/);
    expect(await cmdError("create_device_template", mfa({ baseTemplateId: "does-not-exist" }))).toMatch(/does-not-exist/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a template Odoo refuses is not stored anywhere", async () => {
    fetchMock.mockReturnValueOnce(respond(502, { error: "Odoo hat die Anfrage nicht verarbeitet." }));
    expect(await cmdError("create_device_template", mfa())).toMatch(/Odoo hat/);
    expect(store.getState().customTemplates).toEqual([]);
  });

  it("a derived amplifier keeps the base's load data and gets the same verdict in speaker_load_report", async () => {
    const base = bundled.find((t) => t.manufacturer === "Blaze Audio" && t.ampLoad && t.ports.some((p) => p.signalType === "speaker-level"))!;
    const speaker = bundled.find((t) => t.speakerLoad?.impedanceOhm && t.ports.some((p) => p.signalType === "speaker-level" && p.direction === "input"))!;
    echoCreate();
    const derived = await cmd("create_device_template", { baseTemplateId: base.id, label: `${base.label} (Test)`, modelNumber: "DERIVED-1" });
    expect(bodyOf(0).template.ampLoad).toEqual(base.ampLoad);

    const verdictFor = async (templateId: string) => {
      store.getState().newSchematic();
      const amp = await cmd("add_device", { templateId, x: 0, y: 0 });
      const spk = await cmd("add_device", { templateId: speaker.id, x: 400, y: 0 });
      const ampDevice = await cmd("get_device", { nodeId: amp.nodeId });
      const spkDevice = await cmd("get_device", { nodeId: spk.nodeId });
      const out = ampDevice.ports.find((p: { signalType: string; direction: string }) => p.signalType === "speaker-level" && p.direction === "output");
      const inn = spkDevice.ports.find((p: { signalType: string; direction: string }) => p.signalType === "speaker-level" && p.direction === "input");
      await cmd("connect_devices", { sourceNodeId: amp.nodeId, sourcePortId: out.id, targetNodeId: spk.nodeId, targetPortId: inn.id });
      const report = await cmd("speaker_load_report", {});
      // Compare the figures, not the names and ids.
      return JSON.parse(JSON.stringify(report.amplifiers, (key, value) => (/(^id$|Ids?$|label|name|model)/i.test(key) ? undefined : value)));
    };
    expect(await verdictFor(derived.templateId)).toEqual(await verdictFor(base.id!));
  });
});

describe("get_device_template", () => {
  it("returns the whole template with where it lives, version and product", async () => {
    echoCreate(1, [9001, "[MFA208] Audac MFA208"]);
    const created = await cmd("create_device_template", mfa({ productId: 9001 }));
    const r = await cmd("get_device_template", { templateId: created.templateId });
    expect(r).toMatchObject({ templateId: created.templateId, stored: "odoo", version: 1, productId: 9001, productName: "[MFA208] Audac MFA208" });
    expect(r.template.ports).toHaveLength(3);
  });

  it("says library for bundled templates and browser for local ones", async () => {
    const blaze = bundled.find((t) => t.ampLoad)!;
    expect((await cmd("get_device_template", { templateId: blaze.id })).stored).toBe("library");
    session.setState({ user: null, loaded: true, unreachable: false });
    const local = await cmd("create_device_template", mfa());
    expect((await cmd("get_device_template", { templateId: local.templateId })).stored).toBe("browser");
    expect(await cmdError("get_device_template", { templateId: "custom-nowhere" })).toMatch(/custom-nowhere/);
  });
});

describe("update_device_template", () => {
  async function central() {
    echoCreate(1);
    return cmd("create_device_template", mfa());
  }

  it("changes a central template with the version it read and reports what changed", async () => {
    const t = await central();
    echoUpdate(2);
    const r = await cmd("update_device_template", {
      templateId: t.templateId,
      baseVersion: 1,
      installNotes: "Lüfter frei halten",
      ports: [{ id: "p1" }, { id: "p2", label: "Lautsprecher A" }, { label: "Speaker B", signalType: "speaker-level", direction: "output", connectorType: "phoenix" }],
    });
    expect(callsOf()[1]).toBe(`PUT /face/api/library/${t.templateId}`);
    expect(bodyOf(1).baseVersion).toBe(1);
    expect(bodyOf(1).template.installNotes).toBe("Lüfter frei halten");
    expect(r).toMatchObject({ templateId: t.templateId, version: 2, stored: "odoo", removedPorts: ["p3"], addedPorts: ["p4"], connectedInOpenDrawing: false });
    expect(r.changed.sort()).toEqual(["installNotes", "ports"]);
    expect(store.getState().customTemplates.find((x) => x.id === t.templateId)?.installNotes).toBe("Lüfter frei halten");
  });

  it("needs baseVersion for a central template", async () => {
    const t = await central();
    expect(await cmdError("update_device_template", { templateId: t.templateId, label: "Neu" })).toMatch(/baseVersion.*get_device_template/);
  });

  it("passes on Odoo's conflict when someone changed it since", async () => {
    const t = await central();
    fetchMock.mockReturnValueOnce(respond(409, { reason: "stale", writtenBy: "Max Mustermann", version: 2, error: "Max Mustermann hat die Vorlage inzwischen geändert (Version 2)." }));
    expect(await cmdError("update_device_template", { templateId: t.templateId, baseVersion: 1, label: "Neu" })).toMatch(/Max Mustermann/);
  });

  it("says when a removed port is wired in the open drawing — and leaves the drawing alone", async () => {
    const t = await central();
    const amp = await cmd("add_device", { templateId: t.templateId, x: 0, y: 0 });
    const other = await cmd("add_device", { templateId: t.templateId, x: 400, y: 0 });
    const ampPorts = (await cmd("get_device", { nodeId: amp.nodeId })).ports;
    const otherPorts = (await cmd("get_device", { nodeId: other.nodeId })).ports;
    const serial = (ports: { id: string; label: string }[]) => ports.find((p) => p.label === "RS-232")!.id;
    await cmd("connect_devices", { sourceNodeId: amp.nodeId, sourcePortId: serial(ampPorts), sourceFace: "out", targetNodeId: other.nodeId, targetPortId: serial(otherPorts), targetFace: "in" });
    echoUpdate(2);
    const r = await cmd("update_device_template", { templateId: t.templateId, baseVersion: 1, ports: [{ id: "p1" }, { id: "p2" }] });
    expect(r.removedPorts).toEqual(["p3"]);
    expect(r.connectedInOpenDrawing).toBe(true);
    expect((await cmd("get_device", { nodeId: amp.nodeId })).ports.map((p: { label: string }) => p.label)).toContain("RS-232");
  });

  it("changes only the product without a version", async () => {
    const t = await central();
    fetchMock.mockReturnValueOnce(respond(200, stored({ ...bodyOf(0).template }, 1, [9001, "[MFA208] Audac MFA208"])));
    const r = await cmd("update_device_template", { templateId: t.templateId, productId: 9001 });
    expect(bodyOf(1)).toEqual({ productId: 9001 });
    expect(r).toMatchObject({ version: 1, changed: ["productId"], productName: "[MFA208] Audac MFA208" });
  });

  it("refuses bundled and community templates and suggests deriving", async () => {
    const blaze = bundled.find((t) => t.ampLoad)!;
    expect(await cmdError("update_device_template", { templateId: blaze.id, label: "X" })).toMatch(/create_device_template.*baseTemplateId/);
    expect(await cmdError("update_device_template", { templateId: "custom-nowhere", label: "X" })).toMatch(/custom-nowhere/);
  });

  it("refuses when there is nothing to change", async () => {
    const t = await central();
    expect(await cmdError("update_device_template", { templateId: t.templateId, baseVersion: 1 })).toMatch(/[Nn]othing to change/);
  });

  it("changes a template only this browser has, without Odoo", async () => {
    session.setState({ user: null, loaded: true, unreachable: false });
    const t = await cmd("create_device_template", mfa());
    session.setState({ user: ME, loaded: true, unreachable: false });
    const r = await cmd("update_device_template", { templateId: t.templateId, label: "Lokal geändert" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ stored: "browser", changed: ["label"] });
    expect(store.getState().customTemplates.find((x) => x.id === t.templateId)?.label).toBe("Lokal geändert");
  });
});

describe("the commands are known", () => {
  it("are in the bridge's handler map", () => {
    for (const name of ["get_device_template", "create_device_template", "update_device_template"]) {
      expect(typeof (handlers as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
