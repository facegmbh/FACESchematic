/**
 * The four Odoo-drawing commands Claude gets through the bridge (SPEC-cloud-bridge.md, Task 18):
 * get_editor_status, open_odoo_drawing, save_odoo_drawing, new_odoo_drawing. They are careful on
 * purpose — Claude acts while the user may not be watching: nothing unsaved is thrown away and no
 * newer stand is overwritten unless the user said so (discardChanges / force).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

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
let fd: typeof import("../faceDrawings");
let session: typeof import("../faceBackend").useFaceSession;
let run: typeof import("../mcpBridge").runCommand;

const fetchMock = vi.fn();
const calls = () => fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${url}`);
const bodyOf = (i: number) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);

function respond(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

const DRAWING = {
  id: 501,
  name: "Beschallung EG",
  projectId: 101,
  projectName: "SOCCERBEAT GmbH - FACE/26/10/560",
  writeDate: "2026-10-21 16:40:00",
  writtenBy: "Jean-Luc Doijen",
  sizeBytes: 20,
};
let fileFixture: unknown;

beforeAll(async () => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  ({ useSchematicStore: store } = await import("../store"));
  fd = await import("../faceDrawings");
  ({ useFaceSession: session } = await import("../faceBackend"));
  ({ runCommand: run } = await import("../mcpBridge"));
  store.getState().newSchematic();
  store.getState().setSchematicName("Beschallung EG");
  fileFixture = store.getState().exportToJSON();
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReturnValue(respond(204));
  store.getState().newSchematic();
  fd.stopOdooPresence();
  fetchMock.mockReset();
  fetchMock.mockReturnValue(respond(204));
  session.setState({ user: { uid: 8, name: "Jean-Luc Doijen", login: "jl@face-gmbh.com" }, loaded: true });
});

/** Some unsaved local content: one device on the canvas. */
function addLocalDevice() {
  store.setState({
    nodes: [{ id: "d1", type: "device", position: { x: 0, y: 0 }, data: { label: "Endstufe", deviceType: "amp", ports: [] } } as never],
  });
}

async function openAsEditor() {
  fetchMock
    .mockReturnValueOnce(respond(200, { ...DRAWING, data: fileFixture }))
    .mockReturnValueOnce(respond(200, { ok: true, viewers: [] }));
  const r = await run("open_odoo_drawing", { drawingId: 501, discardChanges: true });
  expect(r.ok).toBe(true);
  fetchMock.mockReset();
  fetchMock.mockReturnValue(respond(204));
}

describe("get_editor_status", () => {
  it("says who is signed in and that nothing from Odoo is open", async () => {
    const r = await run("get_editor_status", {});
    expect(r).toMatchObject({ ok: true, result: { signedInAs: "Jean-Luc Doijen", schematicName: expect.any(String), odooDrawing: null } });
  });

  it("names the open Odoo drawing, whether I edit it, and unsaved changes", async () => {
    await openAsEditor();
    let r = await run("get_editor_status", {});
    expect(r).toMatchObject({
      ok: true,
      result: {
        odooDrawing: { drawingId: 501, name: "Beschallung EG", projectId: 101, projectName: DRAWING.projectName, access: "edit", unsavedChanges: false },
      },
    });
    addLocalDevice();
    r = await run("get_editor_status", {});
    expect(r).toMatchObject({ ok: true, result: { odooDrawing: { unsavedChanges: true } } });
  });

  it("someone else editing → access read with their name", async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { ...DRAWING, data: fileFixture }))
      .mockReturnValueOnce(respond(409, { reason: "locked", holder: { name: "Max Mustermann", since: 1, sameUser: false }, viewers: [], error: "x" }))
      .mockReturnValueOnce(respond(200, { holder: { name: "Max Mustermann", since: 1, sameUser: false }, viewers: [] }));
    await run("open_odoo_drawing", { drawingId: 501 });
    const r = await run("get_editor_status", {});
    expect(r).toMatchObject({ ok: true, result: { odooDrawing: { access: "read", editedBy: "Max Mustermann" } } });
  });
});

describe("open_odoo_drawing", () => {
  it("opens and takes the lock when nothing unsaved is in the way", async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { ...DRAWING, data: fileFixture }))
      .mockReturnValueOnce(respond(200, { ok: true, viewers: [] }));
    const r = await run("open_odoo_drawing", { drawingId: 501 });
    expect(r).toMatchObject({ ok: true, result: { odooDrawing: { drawingId: 501, access: "edit" } } });
    expect(calls()).toEqual(["GET /face/api/drawings/501", "POST /face/api/drawings/501/lock"]);
  });

  it("refuses to throw away local content that is not in Odoo — unless discardChanges", async () => {
    addLocalDevice();
    const refused = await run("open_odoo_drawing", { drawingId: 501 });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/nicht in Odoo gespeichert.*discardChanges/s);
    expect(calls()).toEqual([]);

    fetchMock
      .mockReturnValueOnce(respond(200, { ...DRAWING, data: fileFixture }))
      .mockReturnValueOnce(respond(200, { ok: true, viewers: [] }));
    expect((await run("open_odoo_drawing", { drawingId: 501, discardChanges: true })).ok).toBe(true);
  });

  it("refuses to drop unsaved changes of the open Odoo drawing", async () => {
    await openAsEditor();
    addLocalDevice();
    const refused = await run("open_odoo_drawing", { drawingId: 502 });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/ungespeicherte Änderungen/);
    expect(calls()).toEqual([]);
  });

  it("re-opening the same drawing does not drop its unsaved changes either", async () => {
    await openAsEditor();
    addLocalDevice();
    const refused = await run("open_odoo_drawing", { drawingId: 501 });
    expect(refused.ok).toBe(false);
    expect(calls()).toEqual([]);
  });

  it("needs a numeric drawingId", async () => {
    const r = await run("open_odoo_drawing", { drawingId: "501" });
    expect(r.ok).toBe(false);
  });
});

describe("save_odoo_drawing", () => {
  it("saves the open Odoo drawing back", async () => {
    await openAsEditor();
    addLocalDevice();
    fetchMock.mockReturnValueOnce(respond(200, { ...DRAWING, writeDate: "2026-11-21 12:00:00" }));
    const r = await run("save_odoo_drawing", {});
    expect(r).toMatchObject({ ok: true, result: { saved: true, name: "Beschallung EG", projectName: DRAWING.projectName } });
    expect(calls()).toEqual(["PUT /face/api/drawings/501"]);
    expect(bodyOf(0).force).toBe(false);
  });

  it("not linked to Odoo → says how to store it instead", async () => {
    const r = await run("save_odoo_drawing", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/new_odoo_drawing.*keepContent/s);
  });

  it("someone saved in between → refuses, names them, and saves only with force", async () => {
    await openAsEditor();
    fetchMock.mockReturnValueOnce(respond(409, { reason: "stale", writtenBy: "Max Mustermann", writeDate: "2026-11-21 11:00:00", error: "x" }));
    const r = await run("save_odoo_drawing", {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Max Mustermann/);
      expect(r.error).toMatch(/force/);
    }
    fetchMock.mockReturnValueOnce(respond(200, { ...DRAWING, writeDate: "2026-11-21 12:00:00" }));
    expect((await run("save_odoo_drawing", { force: true })).ok).toBe(true);
    expect(bodyOf(1).force).toBe(true);
  });

  it("someone else holds the lock → refuses with their name", async () => {
    await openAsEditor();
    fetchMock.mockReturnValueOnce(
      respond(409, { reason: "locked", holder: { name: "Max Mustermann", since: 1, sameUser: false }, viewers: [], error: "x" }),
    );
    const r = await run("save_odoo_drawing", { force: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Max Mustermann bearbeitet/);
  });
});

describe("new_odoo_drawing", () => {
  it("creates an empty drawing on the project and links it", async () => {
    fetchMock.mockReturnValueOnce(respond(201, { ...DRAWING, id: 777, name: "Licht OG" }));
    const r = await run("new_odoo_drawing", { projectId: 101, name: "Licht OG" });
    expect(r).toMatchObject({ ok: true, result: { odooDrawing: { drawingId: 777, name: "Licht OG", access: "edit" } } });
    expect(calls()).toEqual(["POST /face/api/projects/101/drawings"]);
    expect(bodyOf(0)).toMatchObject({ name: "Licht OG" });
    expect(bodyOf(0).data.nodes).toEqual([]);
  });

  it("would drop local content → refuses unless discardChanges", async () => {
    addLocalDevice();
    const r = await run("new_odoo_drawing", { projectId: 101, name: "Licht OG" });
    expect(r.ok).toBe(false);
    expect(calls()).toEqual([]);
  });

  it("keepContent stores what is on the canvas as the new drawing — nothing is lost", async () => {
    addLocalDevice();
    fetchMock.mockReturnValueOnce(respond(201, { ...DRAWING, id: 778, name: "Beschallung OG" }));
    const r = await run("new_odoo_drawing", { projectId: 101, name: "Beschallung OG", keepContent: true });
    expect(r.ok).toBe(true);
    expect(bodyOf(0).data.nodes.map((n: { id: string }) => n.id)).toEqual(["d1"]);
  });

  it("needs a project id and a name", async () => {
    expect((await run("new_odoo_drawing", { projectId: 101, name: "  " })).ok).toBe(false);
    expect((await run("new_odoo_drawing", { name: "x" })).ok).toBe(false);
    expect(calls()).toEqual([]);
  });
});

describe("signed out", () => {
  it("every Odoo command says to sign in first", async () => {
    session.setState({ user: null, loaded: true });
    for (const command of ["open_odoo_drawing", "save_odoo_drawing", "new_odoo_drawing"]) {
      const r = await run(command, { drawingId: 501, projectId: 101, name: "x" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/anmelden/i);
    }
    const status = await run("get_editor_status", {});
    expect(status).toMatchObject({ ok: true, result: { signedInAs: null } });
    expect(calls()).toEqual([]);
  });
});
