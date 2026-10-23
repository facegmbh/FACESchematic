/**
 * Drawings on Odoo projects, as the editor sees them (SPEC-odoo-drawings.md).
 *
 * Which Odoo drawing the open content is lives in the app store (`odooDrawing`), saved with
 * the browser backup and reset by every other load — see the note there. What this tab is
 * doing with it lives here: editing (holding the lock) or only reading, who holds the lock,
 * who else is looking. A heartbeat every 30 s keeps that fresh; the backend lets go of a tab
 * 90 s after its last one.
 */
import { create } from "zustand";
import { faceApi, FaceApiError } from "./faceBackend";
import { useSchematicStore, type OdooDrawingRef } from "./store";
import type { SchematicFile } from "./types";

const HEARTBEAT_MS = 30_000;
const TAB_ID_KEY = "face-tab-id";

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

/** Who this tab is to the backend's locks. Survives a reload of the tab, not a new tab. */
export function getTabId(): string {
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, "");
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

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

async function view(drawingId: number): Promise<void> {
  const r = await faceApi<{ holder: Holder | null; viewers: string[] }>(`/face/api/drawings/${drawingId}/view`, {
    method: "POST",
    body: { tabId: getTabId() },
  });
  useOdooPresence.setState({ role: "viewer", holder: r.holder, viewers: r.viewers });
}

/** Take the lock if it is free (or, with takeOver, from my own other tab); otherwise read. */
async function claim(takeOver = false): Promise<void> {
  const ref = store().odooDrawing;
  if (!ref) return;
  try {
    const r = await faceApi<{ ok: true; viewers: string[] }>(`/face/api/drawings/${ref.drawingId}/lock`, {
      method: "POST",
      body: { tabId: getTabId(), takeOver },
    });
    useOdooPresence.setState({ role: "editor", holder: null, viewers: r.viewers });
  } catch (err) {
    if (!(err instanceof FaceApiError && err.status === 409)) throw err;
    await view(ref.drawingId);
  }
  startHeartbeat();
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

/** When the content stops being an Odoo drawing (New, open a file, import…), let go of it. */
function watchLink(): void {
  if (watching) return;
  watching = true;
  useSchematicStore.subscribe((state, prev) => {
    const before = prev.odooDrawing?.drawingId;
    if (before !== undefined && before !== state.odooDrawing?.drawingId) {
      release(before);
      stopOdooPresence();
    }
  });
}

/** On start-up: pick up a drawing the backup still links to, and free the lock on leaving. */
export function startOdooPresence(): void {
  watchLink();
  window.addEventListener("pagehide", () => {
    const ref = store().odooDrawing;
    if (ref) release(ref.drawingId);
  });
  if (store().odooDrawing) void claim().catch(() => undefined);
}

/** Another tab of mine edits it — take over editing here. */
export const takeOverOdooDrawing = () => claim(true);

// --- open, create, save ------------------------------------------------------------

export const searchOdooProjects = (query: string) =>
  faceApi<ProjectSummary[]>(`/face/api/projects?q=${encodeURIComponent(query)}`);

export const listOdooDrawings = (projectId: number) =>
  faceApi<DrawingListItem[]>(`/face/api/projects/${projectId}/drawings`);

function link(d: DrawingSummary, projectName: string): OdooDrawingRef {
  const ref: OdooDrawingRef = { drawingId: d.id, projectId: d.projectId, projectName, name: d.name, baseWriteDate: d.writeDate };
  store().setOdooDrawing(ref);
  return ref;
}

export async function openOdooDrawing(drawingId: number): Promise<void> {
  watchLink();
  const d = await faceApi<DrawingSummary & { projectName: string; data: SchematicFile }>(`/face/api/drawings/${drawingId}`);
  store().importFromJSON(d.data);
  store().setSchematicName(d.name);
  link(d, d.projectName);
  savedFingerprint = fingerprintOf(store().exportToJSON());
  await claim();
}

/** "Save to Odoo as…": store the current content as a new drawing on the project. */
export async function createOdooDrawing(projectId: number, name: string): Promise<void> {
  watchLink();
  const previousName = store().schematicName;
  store().setSchematicName(name.trim() || previousName);
  const data = store().exportToJSON();
  let d: DrawingSummary & { projectName: string };
  try {
    d = await faceApi(`/face/api/projects/${projectId}/drawings`, {
      method: "POST",
      body: { name: name.trim(), data, tabId: getTabId() },
    });
  } catch (err) {
    store().setSchematicName(previousName);
    throw err;
  }
  store().setSchematicName(d.name);
  link(d, d.projectName ?? "");
  savedFingerprint = fingerprintOf(store().exportToJSON());
  useOdooPresence.setState({ role: "editor", holder: null, viewers: [] });
  startHeartbeat();
}

export async function saveOdooDrawing({ force = false }: { force?: boolean } = {}): Promise<void> {
  const ref = store().odooDrawing;
  if (!ref) throw new Error("Diese Zeichnung ist nicht mit Odoo verbunden.");
  const data = store().exportToJSON();
  try {
    const d = await faceApi<DrawingSummary>(`/face/api/drawings/${ref.drawingId}`, {
      method: "PUT",
      body: { data, tabId: getTabId(), baseWriteDate: ref.baseWriteDate, force },
    });
    store().setOdooDrawing({ ...ref, baseWriteDate: d.writeDate });
    savedFingerprint = fingerprintOf(data);
  } catch (err) {
    if (err instanceof FaceApiError && err.status === 409 && err.body.reason === "stale") {
      throw new StaleError((err.body.writtenBy as string | null) ?? null, String(err.body.writeDate ?? ""), err.message);
    }
    if (err instanceof FaceApiError && err.status === 409 && err.body.reason === "locked") {
      const holder = (err.body.holder as Holder | null) ?? null;
      useOdooPresence.setState({ role: "viewer", holder, viewers: (err.body.viewers as string[]) ?? [] });
      throw new LockedError(holder, err.message);
    }
    throw err;
  }
}
