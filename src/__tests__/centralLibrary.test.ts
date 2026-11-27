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
