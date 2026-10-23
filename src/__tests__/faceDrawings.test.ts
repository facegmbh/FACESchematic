import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

// The store autosaves to localStorage and the tab id lives in sessionStorage; vitest runs in
// node, so both get a minimal in-memory stand-in before the store is imported.
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
  const { CURRENT_SCHEMA_VERSION } = await import("../migrations");
  localStorage.setItem("easyschematic-autosave", JSON.stringify({ version: CURRENT_SCHEMA_VERSION, name: "x", nodes: [], edges: [] }));
  ({ useSchematicStore: store } = await import("../store"));
  store.getState().loadFromLocalStorage();
  fd = await import("../faceDrawings");
  store.getState().newSchematic();
  store.getState().setSchematicName("Beschallung EG");
  fileFixture = store.getState().exportToJSON();
});

beforeEach(() => {
  // Leaving the previous test's drawing sends its unlock — let that happen before the
  // call log is cleared, so each test sees only its own calls.
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReturnValue(respond(204));
  store.getState().newSchematic();
  fd.stopOdooPresence();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

async function openAsEditor() {
  fetchMock
    .mockReturnValueOnce(respond(200, { ...DRAWING, data: fileFixture }))
    .mockReturnValueOnce(respond(200, { ok: true, viewers: [] }));
  await fd.openOdooDrawing(501);
}

describe("Odoo drawings in the editor (SPEC-odoo-drawings)", () => {
  it("opening loads the content, remembers the Odoo drawing and takes the lock", async () => {
    await openAsEditor();
    expect(calls()).toEqual(["GET /face/api/drawings/501", "POST /face/api/drawings/501/lock"]);
    expect(bodyOf(1).tabId).toMatch(/^[\w-]+$/);
    expect(store.getState().schematicName).toBe("Beschallung EG");
    expect(store.getState().odooDrawing).toEqual({
      drawingId: 501,
      projectId: 101,
      projectName: DRAWING.projectName,
      name: "Beschallung EG",
      baseWriteDate: DRAWING.writeDate,
    });
    expect(fd.useOdooPresence.getState()).toMatchObject({ role: "editor", holder: null, viewers: [] });
  });

  it("someone else editing makes this tab a reader that still reports in", async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { ...DRAWING, data: fileFixture }))
      .mockReturnValueOnce(respond(409, { reason: "locked", holder: { name: "Max Mustermann", since: 1, sameUser: false }, viewers: [], error: "x" }))
      .mockReturnValueOnce(respond(200, { holder: { name: "Max Mustermann", since: 1, sameUser: false }, viewers: [] }));
    await fd.openOdooDrawing(501);
    expect(calls()[2]).toBe("POST /face/api/drawings/501/view");
    expect(fd.useOdooPresence.getState()).toMatchObject({ role: "viewer", holder: { name: "Max Mustermann", sameUser: false } });
  });

  it("New, opening a file or importing ends the link — and frees the lock", async () => {
    await openAsEditor();
    fetchMock.mockReturnValue(respond(204));
    store.getState().newSchematic();
    expect(store.getState().odooDrawing).toBeNull();
    expect(fd.useOdooPresence.getState().role).toBeNull();
    expect(calls()).toContain("POST /face/api/drawings/501/unlock");

    await openAsEditor();
    fetchMock.mockReturnValue(respond(204));
    store.getState().importFromJSON(fileFixture as never);
    expect(store.getState().odooDrawing).toBeNull();
  });

  it("the link travels with the browser backup and comes back on reload", async () => {
    await openAsEditor();
    store.getState().saveToLocalStorage();
    fetchMock.mockReturnValue(respond(204));
    store.setState({ odooDrawing: null });
    store.getState().loadFromLocalStorage();
    expect(store.getState().odooDrawing?.drawingId).toBe(501);
  });

  it("saving overwrites with the base write date and moves it forward", async () => {
    await openAsEditor();
    fetchMock.mockReturnValueOnce(respond(200, { ...DRAWING, writeDate: "2026-10-23 09:00:00" }));
    await fd.saveOdooDrawing();
    const [url, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(`${init.method} ${url}`).toBe("PUT /face/api/drawings/501");
    const body = JSON.parse(init.body as string);
    expect(body.baseWriteDate).toBe(DRAWING.writeDate);
    expect(body.force).toBe(false);
    expect(body.data.name).toBe("Beschallung EG");
    expect(store.getState().odooDrawing?.baseWriteDate).toBe("2026-10-23 09:00:00");
  });

  it("a save over someone else's newer save raises StaleError with who and when", async () => {
    await openAsEditor();
    fetchMock.mockReturnValueOnce(
      respond(409, { reason: "stale", writtenBy: "Max Mustermann", writeDate: "2026-10-22 15:10:00", error: "x" }),
    );
    const err = await fd.saveOdooDrawing().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(fd.StaleError);
    expect(err).toMatchObject({ writtenBy: "Max Mustermann", writeDate: "2026-10-22 15:10:00" });

    fetchMock.mockReturnValueOnce(respond(200, { ...DRAWING, writeDate: "2026-10-23 09:01:00" }));
    await fd.saveOdooDrawing({ force: true });
    expect(bodyOf(3).force).toBe(true);
  });

  it("knows whether the drawing changed since it was opened or saved", async () => {
    await openAsEditor();
    expect(fd.isChangedSinceOdooSave()).toBe(false);
    store.getState().addNote({ x: 0, y: 0 });
    expect(fd.isChangedSinceOdooSave()).toBe(true);
    fetchMock.mockReturnValueOnce(respond(200, { ...DRAWING, writeDate: "2026-10-23 09:00:00" }));
    await fd.saveOdooDrawing();
    expect(fd.isChangedSinceOdooSave()).toBe(false);
  });

  it("creating stores the current schematic on the project and links it", async () => {
    store.getState().setSchematicName("Neu");
    fetchMock.mockReturnValueOnce(respond(201, { ...DRAWING, id: 777, name: "Beschallung OG", projectId: 102, projectName: "Pier 99" }));
    await fd.createOdooDrawing(102, "Beschallung OG");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(`${init.method} ${url}`).toBe("POST /face/api/projects/102/drawings");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Beschallung OG");
    // Named before it is stored, so the file in Odoo carries the drawing's name too.
    expect(body.data.name).toBe("Beschallung OG");
    expect(store.getState().odooDrawing).toMatchObject({ drawingId: 777, projectName: "Pier 99", name: "Beschallung OG" });
    expect(store.getState().schematicName).toBe("Beschallung OG");
    expect(fd.useOdooPresence.getState().role).toBe("editor");
  });

  it("keeps the lock alive with a heartbeat every 30 s", async () => {
    vi.useFakeTimers();
    await openAsEditor();
    fetchMock.mockReturnValue(respond(200, { ok: true, viewers: ["Max Mustermann"] }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls().filter((c) => c === "POST /face/api/drawings/501/lock")).toHaveLength(2);
    expect(fd.useOdooPresence.getState().viewers).toEqual(["Max Mustermann"]);
  });
});

/** A response the test releases by hand — to change the content while a request is in flight. */
function deferred(status: number, body?: unknown) {
  let release!: () => void;
  const promise = new Promise<Response>((resolve) => {
    release = () => resolve(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  });
  return { promise, release };
}

describe("review findings (Task 12)", () => {
  it("a create that answers after another file was opened links nothing — and frees the new drawing", async () => {
    const answer = deferred(201, { ...DRAWING, id: 777, name: "Neu", projectId: 102, projectName: "Pier 99" });
    fetchMock.mockReturnValueOnce(answer.promise).mockReturnValue(respond(204));
    const pending = fd.createOdooDrawing(102, "Neu");
    store.getState().importFromJSON(fileFixture as never); // the user opens a local file meanwhile
    answer.release();
    await pending.catch(() => undefined);
    expect(store.getState().odooDrawing).toBeNull();
    expect(fd.useOdooPresence.getState().role).toBeNull();
    expect(calls()).toContain("POST /face/api/drawings/777/unlock");
  });

  it("a save that answers after another drawing was opened leaves the new link alone", async () => {
    await openAsEditor();
    const answer = deferred(200, { ...DRAWING, writeDate: "2026-10-23 09:00:00" });
    fetchMock.mockReturnValueOnce(answer.promise);
    const pending = fd.saveOdooDrawing();
    // Meanwhile drawing 502 is opened.
    fetchMock
      .mockReturnValueOnce(respond(200, { ...DRAWING, id: 502, name: "Andere", writeDate: "2026-10-01 08:00:00", data: fileFixture }))
      .mockReturnValue(respond(200, { ok: true, viewers: [] }));
    await fd.openOdooDrawing(502);
    answer.release();
    await pending.catch(() => undefined);
    expect(store.getState().odooDrawing).toMatchObject({ drawingId: 502, baseWriteDate: "2026-10-01 08:00:00" });
  });

  it("a link restored from the backup after start-up still takes the lock (production effect order)", async () => {
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    await openAsEditor();
    store.getState().saveToLocalStorage();
    fetchMock.mockReturnValue(respond(204));
    store.setState({ odooDrawing: null });
    fd.stopOdooPresence();
    fetchMock.mockReset();
    fetchMock.mockReturnValue(respond(200, { ok: true, viewers: [] }));
    fd.startOdooPresence(); // runs before the canvas restores the backup
    store.getState().loadFromLocalStorage();
    await vi.waitFor(() => expect(fd.useOdooPresence.getState().role).toBe("editor"));
    expect(calls()).toContain("POST /face/api/drawings/501/lock");
  });

  it("opening from Odoo clears undo — the previous document cannot come back into the drawing", async () => {
    store.getState().addNote({ x: 0, y: 0 });
    expect(store.getState().undoSize).toBeGreaterThan(0);
    await openAsEditor();
    expect(store.getState().undoSize).toBe(0);
    expect(store.getState().redoSize).toBe(0);
  });

  it("the tab id is per page load, never copied into a duplicated tab via sessionStorage", () => {
    const id = fd.getTabId();
    expect(fd.getTabId()).toBe(id);
    expect(sessionStorage.getItem("face-tab-id")).toBeNull();
  });

  it("a reader may start editing once nobody holds the lock", async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { ...DRAWING, data: fileFixture }))
      .mockReturnValueOnce(respond(409, { reason: "locked", holder: { name: "Max Mustermann", since: 1, sameUser: false }, viewers: [], error: "x" }))
      .mockReturnValueOnce(respond(200, { holder: null, viewers: [] }));
    await fd.openOdooDrawing(501);
    expect(fd.useOdooPresence.getState()).toMatchObject({ role: "viewer", holder: null });
    fetchMock.mockReturnValueOnce(respond(200, { ok: true, viewers: [] }));
    await fd.editOdooDrawing();
    expect(fd.useOdooPresence.getState().role).toBe("editor");
  });

  it("a save refused for a lapsed lock that nobody else holds takes the lock and tries once more", async () => {
    await openAsEditor();
    fetchMock
      .mockReturnValueOnce(respond(409, { reason: "locked", holder: null, viewers: [], error: "x" }))
      .mockReturnValueOnce(respond(200, { ok: true, viewers: [] }))
      .mockReturnValueOnce(respond(200, { ...DRAWING, writeDate: "2026-10-23 09:00:00" }));
    await fd.saveOdooDrawing();
    expect(calls().slice(2)).toEqual(["PUT /face/api/drawings/501", "POST /face/api/drawings/501/lock", "PUT /face/api/drawings/501"]);
    expect(store.getState().odooDrawing?.baseWriteDate).toBe("2026-10-23 09:00:00");
  });

  it("re-opening the same drawing does not let go of its lock in between", async () => {
    await openAsEditor();
    await openAsEditor();
    expect(calls()).not.toContain("POST /face/api/drawings/501/unlock");
  });

  it("a second Ctrl+S while one is running waits for it instead of sending again", async () => {
    await openAsEditor();
    const answer = deferred(200, { ...DRAWING, writeDate: "2026-10-23 09:00:00" });
    fetchMock.mockReturnValueOnce(answer.promise);
    const first = fd.saveOdooDrawing();
    const second = fd.saveOdooDrawing();
    answer.release();
    await Promise.all([first, second]);
    expect(calls().filter((c) => c === "PUT /face/api/drawings/501")).toHaveLength(1);
  });
});
