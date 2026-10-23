/**
 * Drawings on Odoo projects, as the editor sees them (SPEC-odoo-drawings.md).
 *
 * Which Odoo drawing the open content is lives in the app store (`odooDrawing`), saved with
 * the browser backup and reset by every other load — see the note there. What this tab is
 * doing with it lives here: editing (holding the lock) or only reading, who holds the lock,
 * who else is looking. A heartbeat every 30 s keeps that fresh; the backend lets go of a tab
 * 90 s after its last one.
 *
 * Every answer from the backend can arrive after the user has moved on — opened a file, another
 * drawing, New. An answer is only applied while the content is still the one it was asked for
 * (same `loadSeq`, same drawing); otherwise it would tie unrelated content to a drawing, and
 * the next Ctrl+S would overwrite that drawing with it.
 */
import { create } from "zustand";
import { faceApi, FaceApiError } from "./faceBackend";
import { useSchematicStore } from "./store";
import type { SchematicFile } from "./types";

const HEARTBEAT_MS = 30_000;

export interface ProjectSummary {
  id: number;
  name: string;
  customer: string | null;
}

export interface DrawingListItem {
  id: number;
  name: string;
  projectId: number;
  writeDate: string;
  writtenBy: string | null;
  sizeBytes: number;
  editedBy: string | null;
  editedSince: number | null;
}

interface DrawingSummary {
  id: number;
  name: string;
  projectId: number;
  projectName?: string;
  writeDate: string;
  writtenBy: string | null;
}

export interface Holder {
  name: string;
  since: number;
  sameUser: boolean;
}

interface PresenceState {
  /** editor: this tab holds the lock. viewer: someone (maybe me, in another tab) does. */
  role: "editor" | "viewer" | null;
  holder: Holder | null;
  viewers: string[];
}

export const useOdooPresence = create<PresenceState>(() => ({ role: null, holder: null, viewers: [] }));

/** Someone else saved since this content was opened or last saved. */
export class StaleError extends Error {
  readonly writtenBy: string | null;
  readonly writeDate: string;
  constructor(writtenBy: string | null, writeDate: string, message: string) {
    super(message);
    this.writtenBy = writtenBy;
    this.writeDate = writeDate;
  }
}

/** This tab does not (or no longer) hold the lock. */
export class LockedError extends Error {
  readonly holder: Holder | null;
  constructor(holder: Holder | null, message: string) {
    super(message);
    this.holder = holder;
  }
}

const store = () => useSchematicStore.getState();

/** Who this tab is to the backend's locks — per page load. Not kept in sessionStorage: a
 *  duplicated browser tab copies that, and two tabs would then share one lock. Leaving the
 *  page releases the lock (pagehide), so a reload simply takes it again. */
let tabId: string | null = null;
export function getTabId(): string {
  tabId ??= (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, "");
  return tabId;
}

/** The content as it is now — compared after an await to see whether the user moved on. */
const snapshot = () => ({ loadSeq: store().loadSeq, drawingId: store().odooDrawing?.drawingId });
type Snapshot = ReturnType<typeof snapshot>;
const unchanged = (s: Snapshot) => store().loadSeq === s.loadSeq && store().odooDrawing?.drawingId === s.drawingId;
const stillLinkedTo = (drawingId: number) => store().odooDrawing?.drawingId === drawingId;

// --- "changed since saved" ---------------------------------------------------------

/** FNV-1a over the exported JSON — cheap enough to run on demand, never on every edit. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

let savedFingerprint: string | null = null;
const fingerprintOf = (file: SchematicFile) => hash(JSON.stringify(file));

/** True when the open Odoo drawing differs from what is stored in Odoo — or when that is not
 *  known (after a reload), because asking once too often beats losing work. */
export function isChangedSinceOdooSave(): boolean {
  if (!store().odooDrawing) return false;
  return savedFingerprint === null || fingerprintOf(store().exportToJSON()) !== savedFingerprint;
}

// --- presence: lock, view, heartbeat, release ----------------------------------------

let heartbeat: ReturnType<typeof setInterval> | null = null;
let watching = false;
let leaving = false;
/** Set while this module itself re-links the content, so the watcher neither releases nor
 *  claims in between (opening a drawing first clears the link, then sets it again). */
let relinking = false;

async function view(drawingId: number): Promise<void> {
  const r = await faceApi<{ holder: Holder | null; viewers: string[] }>(`/face/api/drawings/${drawingId}/view`, {
    method: "POST",
    body: { tabId: getTabId() },
  });
  if (stillLinkedTo(drawingId)) useOdooPresence.setState({ role: "viewer", holder: r.holder, viewers: r.viewers });
}

/** Take the lock if it is free (or, with takeOver, from my own other tab); otherwise read. */
async function claim(takeOver = false): Promise<void> {
  const drawingId = store().odooDrawing?.drawingId;
  if (drawingId === undefined) return;
  try {
    const r = await faceApi<{ ok: true; viewers: string[] }>(`/face/api/drawings/${drawingId}/lock`, {
      method: "POST",
      body: { tabId: getTabId(), takeOver },
    });
    if (!stillLinkedTo(drawingId)) {
      release(drawingId);
      return;
    }
    useOdooPresence.setState({ role: "editor", holder: null, viewers: r.viewers });
  } catch (err) {
    if (!(err instanceof FaceApiError && err.status === 409)) throw err;
    await view(drawingId);
  }
  if (stillLinkedTo(drawingId)) startHeartbeat();
}

async function beat(): Promise<void> {
  const ref = store().odooDrawing;
  if (!ref) return;
  try {
    if (useOdooPresence.getState().role === "editor") await claim();
    else await view(ref.drawingId);
  } catch {
    // Offline for a moment: the next beat tries again; the lock lapses after 90 s.
  }
}

function startHeartbeat(): void {
  if (heartbeat === null) heartbeat = setInterval(() => void beat(), HEARTBEAT_MS);
}

function release(drawingId: number): void {
  // keepalive: also sent while the page is going away.
  void faceApi(`/face/api/drawings/${drawingId}/unlock`, { method: "POST", body: { tabId: getTabId() }, keepalive: true }).catch(
    () => undefined,
  );
}

/** Stop heartbeat and forget this tab's role — the link itself stays in the store. */
export function stopOdooPresence(): void {
  if (heartbeat !== null) clearInterval(heartbeat);
  heartbeat = null;
  savedFingerprint = null;
  useOdooPresence.setState({ role: null, holder: null, viewers: [] });
}

/**
 * The link decides: when the content stops being an Odoo drawing (New, open a file, import…),
 * let go of it; when a link appears that this module did not set — the backup restored after a
 * reload — take the lock for it. Independent of which component's effect runs first.
 */
function watchLink(): void {
  if (watching) return;
  watching = true;
  useSchematicStore.subscribe((state, prev) => {
    const before = prev.odooDrawing?.drawingId;
    const after = state.odooDrawing?.drawingId;
    if (before === after || relinking) return;
    if (before !== undefined) {
      release(before);
      stopOdooPresence();
    }
    if (after !== undefined) void claim().catch(() => undefined);
  });
}

/** On start-up: watch the link, pick up one the backup already restored, free the lock on leaving. */
export function startOdooPresence(): void {
  watchLink();
  if (!leaving) {
    leaving = true;
    window.addEventListener("pagehide", () => {
      const ref = store().odooDrawing;
      if (ref) release(ref.drawingId);
    });
  }
  if (store().odooDrawing && useOdooPresence.getState().role === null) void claim().catch(() => undefined);
}

/** Another tab of mine edits it — take over editing here. */
export const takeOverOdooDrawing = () => claim(true);

/** Nobody edits it any more — start editing here (a reader's way back, keeping its changes). */
export const editOdooDrawing = () => claim(false);

// --- open, create, save ------------------------------------------------------------

export const searchOdooProjects = (query: string) =>
  faceApi<ProjectSummary[]>(`/face/api/projects?q=${encodeURIComponent(query)}`);

export const listOdooDrawings = (projectId: number) =>
  faceApi<DrawingListItem[]>(`/face/api/projects/${projectId}/drawings`);

/** Set the link without the watcher reacting — the caller handles the lock itself. */
function link(d: DrawingSummary, projectName: string): void {
  relinking = true;
  try {
    store().setOdooDrawing({ drawingId: d.id, projectId: d.projectId, projectName, name: d.name, baseWriteDate: d.writeDate });
  } finally {
    relinking = false;
  }
}

export async function openOdooDrawing(drawingId: number): Promise<void> {
  watchLink();
  const asked = snapshot();
  const d = await faceApi<DrawingSummary & { projectName: string; data: SchematicFile }>(`/face/api/drawings/${drawingId}`);
  if (!unchanged(asked)) return; // the user opened something else meanwhile
  const previous = store().odooDrawing?.drawingId;
  relinking = true;
  try {
    store().importFromJSON(d.data);
    // Undo must not reach back into the document this one replaces — Ctrl+S would store it.
    store().clearUndoHistory();
    store().setSchematicName(d.name);
  } finally {
    relinking = false;
  }
  if (previous !== undefined && previous !== d.id) {
    release(previous);
    stopOdooPresence();
  }
  link(d, d.projectName);
  savedFingerprint = fingerprintOf(store().exportToJSON());
  await claim();
}

/** "Save to Odoo as…": store the current content as a new drawing on the project. */
export async function createOdooDrawing(projectId: number, name: string): Promise<void> {
  watchLink();
  const previousName = store().schematicName;
  store().setSchematicName(name.trim() || previousName);
  const asked = snapshot();
  const data = store().exportToJSON();
  let d: DrawingSummary & { projectName: string };
  try {
    d = await faceApi(`/face/api/projects/${projectId}/drawings`, {
      method: "POST",
      body: { name: name.trim(), data, tabId: getTabId() },
    });
  } catch (err) {
    if (unchanged(asked)) store().setSchematicName(previousName);
    throw err;
  }
  if (!unchanged(asked)) {
    // Stored, but the editor shows something else now: don't tie that to the new drawing.
    release(d.id);
    throw new Error("Gespeichert, aber inzwischen ist ein anderer Inhalt geöffnet — er wurde nicht verknüpft.");
  }
  const previous = asked.drawingId;
  if (previous !== undefined) {
    release(previous);
    stopOdooPresence();
  }
  store().setSchematicName(d.name);
  link(d, d.projectName ?? "");
  savedFingerprint = fingerprintOf(store().exportToJSON());
  useOdooPresence.setState({ role: "editor", holder: null, viewers: [] });
  startHeartbeat();
}

let saving: Promise<void> | null = null;

/** Save back to Odoo. A second call while one runs waits for that one instead of sending again
 *  (it would carry the old base date and come back "stale", naming the user themself). */
export function saveOdooDrawing(opts: { force?: boolean } = {}): Promise<void> {
  saving ??= putDrawing(opts.force ?? false, true).finally(() => {
    saving = null;
  });
  return saving;
}

async function putDrawing(force: boolean, mayReclaim: boolean): Promise<void> {
  const ref = store().odooDrawing;
  if (!ref) throw new Error("Diese Zeichnung ist nicht mit Odoo verbunden.");
  const asked = snapshot();
  const data = store().exportToJSON();
  try {
    const d = await faceApi<DrawingSummary>(`/face/api/drawings/${ref.drawingId}`, {
      method: "PUT",
      body: { data, tabId: getTabId(), baseWriteDate: ref.baseWriteDate, force },
    });
    if (!unchanged(asked)) return; // saved; the editor has moved on to something else
    store().setOdooDrawing({ ...ref, baseWriteDate: d.writeDate });
    savedFingerprint = fingerprintOf(data);
  } catch (err) {
    if (!(err instanceof FaceApiError && err.status === 409)) throw err;
    if (err.body.reason === "stale") {
      throw new StaleError((err.body.writtenBy as string | null) ?? null, String(err.body.writeDate ?? ""), err.message);
    }
    const holder = (err.body.holder as Holder | null) ?? null;
    // The lock lapsed (offline, restart) and nobody took it: take it back and try once more.
    if (!holder && mayReclaim && unchanged(asked)) {
      await claim();
      if (useOdooPresence.getState().role === "editor") return putDrawing(force, false);
    }
    if (unchanged(asked)) useOdooPresence.setState({ role: "viewer", holder, viewers: (err.body.viewers as string[]) ?? [] });
    throw new LockedError(holder, err.message);
  }
}
