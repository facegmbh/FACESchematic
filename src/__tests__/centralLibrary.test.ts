// SPEC-odoo-device-library.md, Task 42 — the editor loads the central device library from Odoo
// and merges it into its own devices ("Eigene Geräte").
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { DeviceTemplate } from "../types";
import { mergeCentralLibrary, type CentralEntry } from "../centralLibraryMerge";

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

const tpl = (id: string, label = id, version?: number): DeviceTemplate =>
  ({
    id,
    label,
    deviceType: "amplifier",
    ports: [{ id: "tpl-0", label: "In", signalType: "analog-audio", direction: "input" }],
    ...(version === undefined ? {} : { version }),
  }) as DeviceTemplate;

const entry = (id: string, version: number, label = id, product?: [number, string]): CentralEntry => ({
  key: id,
  version,
  productId: product ? product[0] : null,
  productName: product ? product[1] : null,
  writeDate: "2026-11-27 10:00:00",
  writtenBy: "Jean-Luc Doijen",
  template: tpl(id, label, version),
});

describe("mergeCentralLibrary", () => {
  it("adds central templates the browser does not have, at the end of the order", () => {
    const r = mergeCentralLibrary([tpl("custom-local")], ["custom-local"], {}, [entry("custom-a", 1)]);
    expect(r.templates.map((t) => t.id)).toEqual(["custom-local", "custom-a"]);
    expect(r.order).toEqual(["custom-local", "custom-a"]);
    expect(r.meta).toEqual({ "custom-a": { version: 1, productId: null, productName: null } });
    expect([r.added, r.updated, r.removed]).toEqual([1, 0, 0]);
  });

  it("replaces an older local copy in place and keeps its position", () => {
    const local = [tpl("custom-a", "Alt", 1), tpl("custom-b")];
    const r = mergeCentralLibrary(local, ["custom-a", "custom-b"], { "custom-a": { version: 1, productId: null, productName: null } }, [
      entry("custom-a", 2, "Neu"),
    ]);
    expect(r.templates.map((t) => [t.id, t.label, t.version])).toEqual([
      ["custom-a", "Neu", 2],
      ["custom-b", "custom-b", undefined],
    ]);
    expect(r.order).toEqual(["custom-a", "custom-b"]);
    expect(r.updated).toBe(1);
  });

  it("takes the central copy over a local one with the same key and no version (the same device brought in by a drawing)", () => {
    const r = mergeCentralLibrary([tpl("custom-a", "Aus Zeichnung")], ["custom-a"], {}, [entry("custom-a", 3, "Zentral")]);
    expect(r.templates[0].label).toBe("Zentral");
    expect(r.meta["custom-a"].version).toBe(3);
  });

  it("leaves an unchanged copy alone", () => {
    const local = [tpl("custom-a", "A", 2)];
    const r = mergeCentralLibrary(local, ["custom-a"], { "custom-a": { version: 2, productId: null, productName: null } }, [entry("custom-a", 2, "A")]);
    expect(r.templates[0]).toBe(local[0]);
    expect([r.added, r.updated, r.removed]).toEqual([0, 0, 0]);
  });

  it("drops what was central and is gone from Odoo (archived by a colleague), keeps what only this browser has", () => {
    const local = [tpl("custom-gone", "Weg", 1), tpl("custom-local")];
    const r = mergeCentralLibrary(local, ["custom-gone", "custom-local"], { "custom-gone": { version: 1, productId: null, productName: null } }, []);
    expect(r.templates.map((t) => t.id)).toEqual(["custom-local"]);
    expect(r.order).toEqual(["custom-local"]);
    expect(r.removed).toBe(1);
    expect(r.removedKeys).toEqual(["custom-gone"]);
  });

  it("carries product links into the meta", () => {
    const r = mergeCentralLibrary([], [], {}, [entry("custom-a", 1, "A", [9001, "[MFA208] Audac MFA208"])]);
    expect(r.meta["custom-a"]).toEqual({ version: 1, productId: 9001, productName: "[MFA208] Audac MFA208" });
  });
});

// --- loading through the store ---------------------------------------------------------------

let store: typeof import("../store").useSchematicStore;
let lib: typeof import("../centralLibrary");
let session: typeof import("../faceBackend").useFaceSession;
const fetchMock = vi.fn();

function respond(status: number, body?: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

const ME = { uid: 8, name: "Jean-Luc Doijen", login: "jl@face-gmbh.com" };

beforeAll(async () => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  ({ useSchematicStore: store } = await import("../store"));
  lib = await import("../centralLibrary");
  ({ useFaceSession: session } = await import("../faceBackend"));
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  store.getState().clearAllCustomTemplates();
  store.getState().applyCentralLibrary([]);
  lib.useCentralLibrary.setState({ status: "off", loadedAt: 0, error: null });
  session.setState({ user: ME, loaded: true, unreachable: false });
});

describe("loadCentralLibrary", () => {
  it("puts the central templates into the own devices and remembers which ones are central", async () => {
    store.getState().addCustomTemplate(tpl("custom-local", "Nur hier"));
    fetchMock.mockReturnValueOnce(respond(200, [entry("custom-a", 2, "Audac MFA208", [9001, "[MFA208] Audac MFA208"])]));

    await lib.loadCentralLibrary();

    expect(fetchMock.mock.calls[0][0]).toBe("/face/api/library");
    const s = store.getState();
    expect(s.customTemplates.map((t) => t.id)).toEqual(["custom-local", "custom-a"]);
    expect(s.libraryMeta).toEqual({ "custom-a": { version: 2, productId: 9001, productName: "[MFA208] Audac MFA208" } });
    expect(lib.isCentral("custom-a")).toBe(true);
    expect(lib.isCentral("custom-local")).toBe(false);
    expect(lib.useCentralLibrary.getState().status).toBe("ok");
  });

  it("keeps the library in the browser, so it is there after a reload without network", async () => {
    fetchMock.mockReturnValueOnce(respond(200, [entry("custom-a", 1, "A")]));
    await lib.loadCentralLibrary();
    expect(JSON.parse(localStorage.getItem("easyschematic-custom-templates")!).map((t: DeviceTemplate) => t.id)).toContain("custom-a");
    expect(JSON.parse(localStorage.getItem("face-central-library-meta")!)).toHaveProperty("custom-a");
  });

  it("without the Odoo module (503) it stays with the browser's devices and says the library is unavailable", async () => {
    store.getState().addCustomTemplate(tpl("custom-local"));
    fetchMock.mockReturnValueOnce(respond(503, { error: "Die zentrale Gerätebibliothek ist in Odoo noch nicht installiert (Modul face_schematic_library)." }));
    await lib.loadCentralLibrary();
    expect(store.getState().customTemplates.map((t) => t.id)).toEqual(["custom-local"]);
    expect(lib.useCentralLibrary.getState().status).toBe("unavailable");
  });

  it("a network failure keeps the last known library and records the error", async () => {
    fetchMock.mockReturnValueOnce(respond(200, [entry("custom-a", 1)]));
    await lib.loadCentralLibrary();
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError("Failed to fetch")));
    await lib.loadCentralLibrary();
    expect(store.getState().customTemplates.map((t) => t.id)).toEqual(["custom-a"]);
    expect(store.getState().libraryMeta).toHaveProperty("custom-a");
    expect(lib.useCentralLibrary.getState().status).toBe("error");
  });

  it("never starts without the FACE backend (public build, dev server without VITE_FACE_BACKEND)", async () => {
    const { FACE_BACKEND } = await import("../faceBackend");
    expect(FACE_BACKEND).toBe(false);
    lib.startCentralLibrary();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing while signed out", async () => {
    session.setState({ user: null, loaded: true, unreachable: false });
    await lib.loadCentralLibrary();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lib.useCentralLibrary.getState().status).toBe("off");
  });

  it("reloads on focus only after five minutes", async () => {
    let now = 1_000_000;
    fetchMock.mockImplementation(() => respond(200, []));
    await lib.loadCentralLibrary(() => now);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 4 * 60_000;
    await lib.refreshIfStale(() => now);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 2 * 60_000;
    await lib.refreshIfStale(() => now);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a device a colleague archived leaves this browser's library on the next load", async () => {
    fetchMock.mockReturnValueOnce(respond(200, [entry("custom-a", 1), entry("custom-b", 1)]));
    await lib.loadCentralLibrary();
    store.getState().moveCustomTemplateToGroup?.("custom-b", null);
    fetchMock.mockReturnValueOnce(respond(200, [entry("custom-a", 1)]));
    await lib.loadCentralLibrary();
    expect(store.getState().customTemplates.map((t) => t.id)).toEqual(["custom-a"]);
    expect(store.getState().libraryMeta).not.toHaveProperty("custom-b");
  });
});

// --- Task 43: writing --------------------------------------------------------------------------

describe("writing own devices to the central library", () => {
  const callsOf = () => fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${url}`);
  const bodyOf = (i: number) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);
  const toasts = () => store.getState().toasts.map((t) => `${t.type}: ${t.message}`);
  const labelOf = (key: string) => store.getState().customTemplates.find((t) => t.id === key)?.label;

  async function withCentral(...entries: CentralEntry[]) {
    fetchMock.mockReturnValueOnce(respond(200, entries));
    await lib.loadCentralLibrary();
    fetchMock.mockReset();
  }

  beforeAll(async () => {
    (await import("../i18n")).setLocale("de");
  });

  beforeEach(() => {
    store.setState({ toasts: [] });
    lib.useCentralLibrary.setState({ status: "ok", loadedAt: Date.now(), error: null });
  });

  it("a new device goes to Odoo and is central with version 1", async () => {
    fetchMock.mockReturnValueOnce(respond(201, entry("custom-new", 1, "Neu")));
    store.getState().addCustomTemplate(tpl("custom-new", "Neu"));
    await lib.flushCentralWrites();
    expect(callsOf()).toEqual(["POST /face/api/library"]);
    expect(bodyOf(0)).toEqual({ template: tpl("custom-new", "Neu"), origin: "editor" });
    expect(store.getState().libraryMeta["custom-new"].version).toBe(1);
    expect(store.getState().customTemplates.find((t) => t.id === "custom-new")?.version).toBe(1);
  });

  it("a new device that cannot reach Odoo stays in this browser, with a hint", async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError("Failed to fetch")));
    store.getState().addCustomTemplate(tpl("custom-new", "Neu"));
    await lib.flushCentralWrites();
    expect(labelOf("custom-new")).toBe("Neu");
    expect(lib.isCentral("custom-new")).toBe(false);
    expect(toasts().join()).toMatch(/error: .*Neu.*nur in diesem Browser/);
  });

  it("a change to a central device is written with the version it was based on, and raises it", async () => {
    await withCentral(entry("custom-a", 3, "A"));
    fetchMock.mockReturnValueOnce(respond(200, entry("custom-a", 4, "A geändert")));
    store.getState().updateCustomTemplate("custom-a", tpl("custom-a", "A geändert"));
    await lib.flushCentralWrites();
    expect(callsOf()).toEqual(["PUT /face/api/library/custom-a"]);
    expect(bodyOf(0)).toEqual({ template: tpl("custom-a", "A geändert"), baseVersion: 3 });
    expect(store.getState().libraryMeta["custom-a"].version).toBe(4);
    expect(store.getState().customTemplates.find((t) => t.id === "custom-a")?.version).toBe(4);
  });

  it("a change someone else beat is taken back, names them, and reloads the library", async () => {
    await withCentral(entry("custom-a", 3, "A"));
    fetchMock
      .mockReturnValueOnce(respond(409, { reason: "stale", writtenBy: "Max Mustermann", version: 4, error: "Max Mustermann hat die Vorlage inzwischen geändert (Version 4)." }))
      .mockReturnValueOnce(respond(200, [entry("custom-a", 4, "A von Max")]));
    store.getState().updateCustomTemplate("custom-a", tpl("custom-a", "Mein Stand"));
    expect(labelOf("custom-a")).toBe("Mein Stand");
    await lib.flushCentralWrites();
    expect(callsOf()).toEqual(["PUT /face/api/library/custom-a", "GET /face/api/library"]);
    expect(labelOf("custom-a")).toBe("A von Max");
    expect(toasts().join()).toMatch(/error: .*Max Mustermann/);
  });

  it("a failed change goes back to exactly the previous device and leaves other edits alone", async () => {
    await withCentral(entry("custom-a", 3, "A"));
    fetchMock.mockReturnValueOnce(respond(502, { error: "Odoo hat die Anfrage nicht verarbeitet." }));
    store.getState().updateCustomTemplate("custom-a", tpl("custom-a", "Kaputt"));
    store.getState().addCustomTemplate(tpl("custom-other", "Anderes"));
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError("offline")));
    await lib.flushCentralWrites();
    expect(labelOf("custom-a")).toBe("A");
    expect(labelOf("custom-other")).toBe("Anderes");
  });

  it("changes to one device go out one after another, each on the version before", async () => {
    await withCentral(entry("custom-a", 1, "A"));
    fetchMock.mockReturnValueOnce(respond(200, entry("custom-a", 2, "B"))).mockReturnValueOnce(respond(200, entry("custom-a", 3, "C")));
    store.getState().updateCustomTemplate("custom-a", tpl("custom-a", "B"));
    store.getState().updateCustomTemplate("custom-a", tpl("custom-a", "C"));
    await lib.flushCentralWrites();
    expect(bodyOf(0).baseVersion).toBe(1);
    expect(bodyOf(1).baseVersion).toBe(2);
    expect(store.getState().libraryMeta["custom-a"].version).toBe(3);
  });

  it("removing a central device archives it in Odoo", async () => {
    await withCentral(entry("custom-a", 1, "A"));
    fetchMock.mockReturnValueOnce(respond(204));
    store.getState().removeCustomTemplate("custom-a");
    await lib.flushCentralWrites();
    expect(callsOf()).toEqual(["POST /face/api/library/custom-a/archive"]);
    expect(labelOf("custom-a")).toBeUndefined();
    expect(lib.isCentral("custom-a")).toBe(false);
  });

  it("a removal Odoo refuses puts the device back where it was", async () => {
    await withCentral(entry("custom-a", 1, "A"), entry("custom-b", 1, "B"));
    fetchMock.mockReturnValueOnce(respond(403, { error: "Keine Berechtigung in Odoo: Archivieren nicht erlaubt." }));
    store.getState().removeCustomTemplate("custom-a");
    await lib.flushCentralWrites();
    expect(store.getState().customTemplates.map((t) => t.id)).toEqual(["custom-a", "custom-b"]);
    expect(store.getState().customTemplateOrder).toEqual(["custom-a", "custom-b"]);
    expect(lib.isCentral("custom-a")).toBe(true);
    expect(toasts().join()).toMatch(/error: .*Keine Berechtigung/);
  });

  it("devices only this browser has stay local when changed or removed", async () => {
    // Made while Odoo had no library: it stays a device of this browser only.
    lib.useCentralLibrary.setState({ status: "unavailable" });
    store.getState().addCustomTemplate(tpl("custom-local", "Lokal"));
    await lib.flushCentralWrites();
    lib.useCentralLibrary.setState({ status: "ok" });
    store.getState().updateCustomTemplate("custom-local", tpl("custom-local", "Lokal 2"));
    store.getState().removeCustomTemplate("custom-local");
    await lib.flushCentralWrites();
    expect(callsOf()).toEqual([]);
  });

  it("without the Odoo module or signed out, nothing is sent", async () => {
    lib.useCentralLibrary.setState({ status: "unavailable" });
    store.getState().addCustomTemplate(tpl("custom-x"));
    lib.useCentralLibrary.setState({ status: "ok" });
    session.setState({ user: null, loaded: true, unreachable: false });
    store.getState().addCustomTemplate(tpl("custom-y"));
    await lib.flushCentralWrites();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("imported devices are uploaded; what differs from Odoo is reported", async () => {
    fetchMock.mockReturnValueOnce(
      respond(200, { added: [entry("custom-i1", 1, "I1")], same: [entry("custom-i2", 5, "I2")], skipped: [{ key: "custom-i3", label: "I3", reason: "different" }] }),
    );
    store.getState().importCustomTemplates([tpl("custom-i1", "I1"), tpl("custom-i2", "I2"), tpl("custom-i3", "I3")]);
    await lib.flushCentralWrites();
    expect(callsOf()).toEqual(["POST /face/api/library/upload"]);
    expect(bodyOf(0).templates.map((t: DeviceTemplate) => t.id)).toEqual(["custom-i1", "custom-i2", "custom-i3"]);
    expect(lib.isCentral("custom-i1")).toBe(true);
    expect(store.getState().libraryMeta["custom-i2"].version).toBe(5);
    expect(lib.isCentral("custom-i3")).toBe(false);
    expect(toasts().join()).toMatch(/I3/);
  });

  it("after a change, a drawing on the old version sees drift", async () => {
    const { getTemplateDrift } = await import("../templateSync");
    await withCentral(entry("custom-a", 1, "A"));
    fetchMock.mockReturnValueOnce(respond(200, entry("custom-a", 2, "A2")));
    store.getState().updateCustomTemplate("custom-a", tpl("custom-a", "A2"));
    await lib.flushCentralWrites();
    const drift = getTemplateDrift({ templateId: "custom-a", templateVersion: 1 } as never, store.getState().customTemplates);
    expect(drift?.currentVersion).toBe(2);
  });
});

// --- Task 44: upload and drawings ------------------------------------------------------------

describe("uploading this browser's devices and opening drawings", () => {
  const callsOf = () => fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${url}`);
  const bodyOf = (i: number) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);

  async function withCentral(...entries: CentralEntry[]) {
    fetchMock.mockReturnValueOnce(respond(200, entries));
    await lib.loadCentralLibrary();
    fetchMock.mockReset();
  }

  /** Devices made while Odoo had no library — they live only in this browser. */
  async function localDevices(...templates: DeviceTemplate[]) {
    lib.useCentralLibrary.setState({ status: "unavailable" });
    for (const t of templates) store.getState().addCustomTemplate(t);
    await lib.flushCentralWrites();
    lib.useCentralLibrary.setState({ status: "ok" });
  }

  beforeAll(async () => {
    (await import("../i18n")).setLocale("de");
  });

  beforeEach(() => {
    store.setState({ toasts: [] });
    lib.useCentralLibrary.setState({ status: "ok", loadedAt: Date.now(), error: null });
  });

  it("lists exactly the devices only this browser has", async () => {
    await withCentral(entry("custom-central", 1));
    await localDevices(tpl("custom-l1"), tpl("custom-l2"));
    expect(lib.localOnlyTemplates().map((t) => t.id)).toEqual(["custom-l1", "custom-l2"]);
  });

  it("uploads only those, marks what Odoo took or already had, and reports the rest", async () => {
    await withCentral(entry("custom-central", 1));
    await localDevices(tpl("custom-l1", "Eins"), tpl("custom-l2", "Zwei"), tpl("custom-l3", "Drei"));
    fetchMock.mockReturnValueOnce(
      respond(200, {
        added: [entry("custom-l1", 1, "Eins")],
        same: [entry("custom-l2", 4, "Zwei")],
        skipped: [{ key: "custom-l3", label: "Drei", reason: "different" }],
      }),
    );

    const result = await lib.uploadLocalDevices();

    expect(callsOf()).toEqual(["POST /face/api/library/upload"]);
    expect(bodyOf(0).templates.map((t: DeviceTemplate) => t.id)).toEqual(["custom-l1", "custom-l2", "custom-l3"]);
    expect(lib.isCentral("custom-l1")).toBe(true);
    expect(store.getState().libraryMeta["custom-l2"].version).toBe(4);
    expect(lib.isCentral("custom-l3")).toBe(false);
    expect(lib.localOnlyTemplates().map((t) => t.id)).toEqual(["custom-l3"]);
    expect(result).toEqual({ added: ["Eins"], same: ["Zwei"], different: ["Drei"], invalid: [] });
  });

  it("names invalid devices with the reason", async () => {
    await localDevices(tpl("custom-bad", "Kaputt"));
    fetchMock.mockReturnValueOnce(
      respond(200, { added: [], same: [], skipped: [{ key: "custom-bad", label: "Kaputt", reason: "invalid", error: "Vorlage „Kaputt“: referenceUrl muss mit http:// oder https:// beginnen." }] }),
    );
    const result = await lib.uploadLocalDevices();
    expect(result?.invalid).toEqual(["Vorlage „Kaputt“: referenceUrl muss mit http:// oder https:// beginnen."]);
  });

  it("does not upload while signed out, without the Odoo module, or with nothing to upload", async () => {
    expect(await lib.uploadLocalDevices()).toEqual({ added: [], same: [], different: [], invalid: [] });
    await localDevices(tpl("custom-l1"));
    lib.useCentralLibrary.setState({ status: "unavailable" });
    expect(await lib.uploadLocalDevices()).toBeNull();
    lib.useCentralLibrary.setState({ status: "ok" });
    session.setState({ user: null, loaded: true, unreachable: false });
    expect(await lib.uploadLocalDevices()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failed upload changes nothing and says why", async () => {
    await localDevices(tpl("custom-l1", "Eins"));
    fetchMock.mockReturnValueOnce(respond(502, { error: "Odoo hat die Anfrage nicht verarbeitet." }));
    await expect(lib.uploadLocalDevices()).rejects.toThrow(/Odoo hat/);
    expect(lib.isCentral("custom-l1")).toBe(false);
  });

  it("a drawing with an older copy of a central device keeps the central one, and its devices show drift", async () => {
    const { getTemplateDrift } = await import("../templateSync");
    // The drawing was saved while the device was at version 1.
    store.getState().newSchematic();
    store.getState().addDevice(tpl("custom-a", "Alt", 1), { x: 0, y: 0 });
    const drawing = { ...store.getState().exportToJSON(), customTemplates: [tpl("custom-a", "Alt", 1)] };

    await withCentral(entry("custom-a", 2, "Neu"));
    store.getState().importFromJSON(drawing);

    expect(store.getState().customTemplates.find((t) => t.id === "custom-a")).toMatchObject({ label: "Neu", version: 2 });
    const device = store.getState().nodes.find((n) => n.type === "device")!;
    expect(getTemplateDrift(device.data as never, store.getState().customTemplates)?.currentVersion).toBe(2);
  });

  it("a central device the browser had lost comes back from Odoo even if a drawing brought an older copy first", async () => {
    await withCentral(entry("custom-a", 2, "Neu"));
    store.getState().clearAllCustomTemplates();
    store.getState().importFromJSON({ ...store.getState().exportToJSON(), customTemplates: [tpl("custom-a", "Alt", 1)] });
    expect(store.getState().customTemplates.find((t) => t.id === "custom-a")?.label).toBe("Alt");
    fetchMock.mockReturnValueOnce(respond(200, [entry("custom-a", 2, "Neu")]));
    await lib.loadCentralLibrary();
    expect(store.getState().customTemplates.find((t) => t.id === "custom-a")?.label).toBe("Neu");
  });

  it("an unknown device a drawing brings stays in this browser and can be uploaded", async () => {
    await withCentral(entry("custom-central", 1));
    store.getState().importFromJSON({ ...store.getState().exportToJSON(), customTemplates: [tpl("custom-from-drawing", "Mitgebracht")] });
    expect(lib.localOnlyTemplates().map((t) => t.id)).toEqual(["custom-from-drawing"]);
  });
});

// --- Task 45: Odoo product on a central template ----------------------------------------------

describe("linking a central template to an Odoo product", () => {
  const callsOf = () => fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${url}`);
  const bodyOf = (i: number) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);

  async function withCentral(...entries: CentralEntry[]) {
    fetchMock.mockReturnValueOnce(respond(200, entries));
    await lib.loadCentralLibrary();
    fetchMock.mockReset();
  }

  beforeEach(() => {
    lib.useCentralLibrary.setState({ status: "ok", loadedAt: Date.now(), error: null });
  });

  it("searches Odoo products by what was typed", async () => {
    fetchMock.mockReturnValueOnce(respond(200, [{ id: 9001, name: "[MFA208] Audac MFA208", code: "MFA208" }]));
    const found = await lib.searchProducts("MFA 208");
    expect(callsOf()).toEqual(["GET /face/api/library/products?q=MFA%20208"]);
    expect(found).toEqual([{ id: 9001, name: "[MFA208] Audac MFA208", code: "MFA208" }]);
  });

  it("sets and clears the product without touching the template", async () => {
    await withCentral(entry("custom-a", 3, "A"));
    fetchMock.mockReturnValueOnce(respond(200, entry("custom-a", 3, "A", [9001, "[MFA208] Audac MFA208"])));
    await lib.setTemplateProduct("custom-a", 9001);
    expect(callsOf()).toEqual(["PUT /face/api/library/custom-a"]);
    expect(bodyOf(0)).toEqual({ productId: 9001 });
    expect(store.getState().libraryMeta["custom-a"]).toEqual({ version: 3, productId: 9001, productName: "[MFA208] Audac MFA208" });

    fetchMock.mockReturnValueOnce(respond(200, entry("custom-a", 3, "A")));
    await lib.setTemplateProduct("custom-a", null);
    expect(bodyOf(1)).toEqual({ productId: null });
    expect(store.getState().libraryMeta["custom-a"].productId).toBeNull();
  });

  it("a refused link changes nothing and says why", async () => {
    await withCentral(entry("custom-a", 3, "A"));
    fetchMock.mockReturnValueOnce(respond(400, { error: "Artikel 77 gibt es nicht." }));
    await expect(lib.setTemplateProduct("custom-a", 77)).rejects.toThrow(/Artikel 77/);
    expect(store.getState().libraryMeta["custom-a"].productId).toBeNull();
  });

  it("only central templates can be linked", async () => {
    await expect(lib.setTemplateProduct("custom-nowhere", 9001)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
