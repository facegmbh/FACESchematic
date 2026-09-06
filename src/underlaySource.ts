/**
 * The source file behind a floorplan underlay, kept so the plan can be redrawn later.
 *
 * The sheet itself only ever shows the rasterized copy stored in the project. But three
 * things need the original PDF back: switching to another page of the set, changing which
 * of the PDF's own layers are drawn, and changing the raster resolution. Until now the file
 * lived in a module-level Map that a page reload emptied, so all three answered "re-import
 * the PDF" the moment the tab was refreshed.
 *
 * The bytes go to IndexedDB, deliberately not into the project's localStorage autosave:
 * that has a budget of roughly 5 MB for the whole document, and an architect's PDF can be
 * many times that on its own. The underlay carries only a `sourceKey` pointing here.
 *
 * Not yet included: the bytes do not travel inside an exported project file, so moving a
 * project to another machine still needs a re-import to redraw it.
 */

const DB_NAME = "easyschematic-underlay-sources";
const DB_VERSION = 1;
const STORE = "sources";

/** Above this the source is not kept. A plan carrying aerial photography can run to tens of
 *  megabytes, and filling the browser's storage quota would break the autosave of every
 *  project, not just this one. */
export const MAX_STORED_SOURCE_BYTES = 25_000_000;

interface StoredSource {
  name: string;
  type: string;
  bytes: ArrayBuffer;
  savedAt: number;
}

/** Files handed to us this session, so a re-render right after an import needs no round
 *  trip. Also the fallback when IndexedDB is unavailable (private windows, blocked site
 *  data) — the session then behaves exactly as it did before. */
const memory = new Map<string, File>();

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** A key for a freshly imported source. */
export function nextUnderlaySourceKey(): string {
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Keep `file` under `key`. Best-effort: a file over the size limit, or a browser that
 * refuses to store it, leaves the session-only copy behind and reports false, so the caller
 * can say that later changes will need a re-import.
 */
export async function putUnderlaySource(key: string, file: File): Promise<boolean> {
  memory.set(key, file);
  if (file.size > MAX_STORED_SOURCE_BYTES) return false;
  try {
    const bytes = await file.arrayBuffer();
    const db = await openDb();
    const value: StoredSource = { name: file.name, type: file.type, bytes, savedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

/** The source behind `key`, from this session or from storage. Undefined when it is gone. */
export async function getUnderlaySource(key: string | undefined): Promise<File | undefined> {
  if (!key) return undefined;
  const held = memory.get(key);
  if (held) return held;
  try {
    const db = await openDb();
    const stored = await new Promise<StoredSource | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as StoredSource | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!stored) return undefined;
    const file = new File([stored.bytes], stored.name, { type: stored.type });
    memory.set(key, file);
    return file;
  } catch {
    return undefined;
  }
}

/** Drop one source — its underlay was replaced or removed. */
export async function removeUnderlaySource(key: string | undefined): Promise<void> {
  if (!key) return;
  memory.delete(key);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Nothing to do — a source we cannot delete is a few megabytes, not a broken project.
  }
}

/**
 * Delete every stored source that `keep` does not name. Called after a project loads: the
 * plans of a project the user has moved on from would otherwise sit in storage forever.
 */
export async function pruneUnderlaySources(keep: Iterable<string>): Promise<void> {
  const wanted = new Set(keep);
  try {
    const db = await openDb();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const stale = keys.map(String).filter((k) => !wanted.has(k));
    if (stale.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const k of stale) store.delete(k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    for (const k of stale) memory.delete(k);
  } catch {
    // Storage that will not open needs no pruning.
  }
}
