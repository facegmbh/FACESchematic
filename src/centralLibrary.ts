/**
 * The central device library in Odoo, as the editor sees it (SPEC-odoo-device-library.md).
 * Not to be confused with the FACE house library bundled in src/devices/face-library.ts.
 *
 * Signed in, the own devices ("Eigene Geräte") are the central library plus whatever only this
 * browser has. The library is loaded at sign-in and again on focus when it is older than five
 * minutes; the browser keeps the last copy, so a technician without network still has it.
 * Without the Odoo module (503) or without network, everything stays as it was.
 */
import { create } from "zustand";
import { faceApi, FaceApiError, FACE_BACKEND, useFaceSession } from "./faceBackend";
import { useSchematicStore } from "./store";
import type { CentralEntry } from "./centralLibraryMerge";

const STALE_AFTER_MS = 5 * 60_000;

export type CentralLibraryStatus = "off" | "loading" | "ok" | "unavailable" | "error";

interface CentralLibraryState {
  /** off: signed out or no backend. unavailable: Odoo has no face_schematic_library. */
  status: CentralLibraryStatus;
  /** When the last load succeeded (ms), 0 if never. */
  loadedAt: number;
  error: string | null;
}

export const useCentralLibrary = create<CentralLibraryState>(() => ({ status: "off", loadedAt: 0, error: null }));

/** True when this own device lives in the central library. */
export function isCentral(key: string): boolean {
  return key in useSchematicStore.getState().libraryMeta;
}

let inFlight: Promise<void> | null = null;

/** Fetch the library and fold it into the own devices. Never throws. */
export function loadCentralLibrary(now: () => number = Date.now): Promise<void> {
  if (!useFaceSession.getState().user) {
    useCentralLibrary.setState({ status: "off", error: null });
    return Promise.resolve();
  }
  inFlight ??= (async () => {
    if (useCentralLibrary.getState().status !== "ok") useCentralLibrary.setState({ status: "loading" });
    try {
      const entries = await faceApi<CentralEntry[]>("/face/api/library");
      useSchematicStore.getState().applyCentralLibrary(entries);
      useCentralLibrary.setState({ status: "ok", loadedAt: now(), error: null });
    } catch (err) {
      const unavailable = err instanceof FaceApiError && err.status === 503;
      const message = err instanceof Error ? err.message : String(err);
      useCentralLibrary.setState({ status: unavailable ? "unavailable" : "error", error: message });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Load again when the last successful load is older than five minutes (window focus). */
export function refreshIfStale(now: () => number = Date.now): Promise<void> {
  const { loadedAt } = useCentralLibrary.getState();
  if (loadedAt && now() - loadedAt < STALE_AFTER_MS) return Promise.resolve();
  return loadCentralLibrary(now);
}

let started = false;

/** Called once by the FACE login gate: load at every sign-in, refresh on focus. */
export function startCentralLibrary(): void {
  if (started || !FACE_BACKEND) return;
  started = true;
  let uid = useFaceSession.getState().user?.uid;
  if (uid !== undefined) void loadCentralLibrary();
  useFaceSession.subscribe((s) => {
    if (s.user?.uid === uid) return;
    uid = s.user?.uid;
    if (uid === undefined) useCentralLibrary.setState({ status: "off", loadedAt: 0, error: null });
    else void loadCentralLibrary();
  });
  if (typeof window !== "undefined") window.addEventListener("focus", () => void refreshIfStale());
}
