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
import { useSchematicStore, setTemplateSink, type TemplateChange } from "./store";
import type { CentralEntry } from "./centralLibraryMerge";
import type { DeviceTemplate } from "./types";
import { t } from "./i18n";

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

// --- writing ---------------------------------------------------------------------------------

interface UploadAnswer {
  added: CentralEntry[];
  same: CentralEntry[];
  skipped: { key: string; label: string; reason: "different" | "invalid"; error?: string }[];
}

const store = () => useSchematicStore.getState();
const keyOf = (tpl: DeviceTemplate) => tpl.id ?? tpl.deviceType;

/** Signed in, and Odoo has the library (or was reachable before): changes go there. */
function writesGoToOdoo(): boolean {
  const status = useCentralLibrary.getState().status;
  return Boolean(useFaceSession.getState().user) && (status === "ok" || status === "loading" || status === "error");
}

/** A sentence for the user: the backend's own, or one for a network that is not there. */
function reasonOf(err: unknown): string {
  if (err instanceof FaceApiError) return err.message;
  return t("Odoo is not reachable");
}

const queues = new Map<string, Promise<void>>();
const pending = new Set<Promise<void>>();

/** One template's writes go out one after another, so each is based on the version before.
 *  The returned promise settles when this job is done; it never rejects. */
function enqueue(key: string, job: () => Promise<void>): Promise<void> {
  const run = (queues.get(key) ?? Promise.resolve()).then(job).catch((err) => console.error("[central library]", err));
  queues.set(key, run);
  pending.add(run);
  void run.finally(() => {
    pending.delete(run);
    if (queues.get(key) === run) queues.delete(key);
  });
  return run;
}

/** Resolves once every write sent so far has been answered (tests, and before an upload). */
export async function flushCentralWrites(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}

function error(message: string): void {
  store().addToast(message, "error");
}

function writeTemplate(change: TemplateChange): void {
  if (!writesGoToOdoo()) return;
  switch (change.kind) {
    case "add": {
      const { template } = change;
      enqueue(keyOf(template), async () => {
        try {
          const entry = await faceApi<CentralEntry>("/face/api/library", { method: "POST", body: { template, origin: "editor" } });
          store().markCentral(entry);
        } catch (err) {
          // A new device is never thrown away: it stays here and can be uploaded later.
          error(t("“{label}” is only saved in this browser: {reason}", { label: template.label, reason: reasonOf(err) }));
        }
      });
      return;
    }
    case "update": {
      if (!isCentral(change.key)) return;
      const { key, template, undo } = change;
      enqueue(key, async () => {
        const baseVersion = store().libraryMeta[key]?.version;
        if (baseVersion === undefined) return;
        try {
          const entry = await faceApi<CentralEntry>(`/face/api/library/${encodeURIComponent(key)}`, {
            method: "PUT",
            body: { template, baseVersion },
          });
          store().markCentral(entry);
        } catch (err) {
          undo();
          error(t("“{label}” was not changed: {reason}", { label: template.label, reason: reasonOf(err) }));
          // Someone else changed it: show their version.
          if (err instanceof FaceApiError && err.status === 409) await loadCentralLibrary();
        }
      });
      return;
    }
    case "remove": {
      if (!isCentral(change.key)) return;
      const { key, template, undo } = change;
      enqueue(key, async () => {
        try {
          await faceApi<void>(`/face/api/library/${encodeURIComponent(key)}/archive`, { method: "POST" });
          store().unmarkCentral(key);
        } catch (err) {
          // Already gone from Odoo is what we wanted.
          if (err instanceof FaceApiError && err.status === 404) {
            store().unmarkCentral(key);
            return;
          }
          undo();
          error(t("“{label}” was not removed: {reason}", { label: template.label, reason: reasonOf(err) }));
        }
      });
      return;
    }
    case "import": {
      const { templates } = change;
      if (!templates.length) return;
      enqueue("\u0000import", async () => {
        try {
          const answer = await faceApi<UploadAnswer>("/face/api/library/upload", { method: "POST", body: { templates } });
          for (const entry of [...answer.added, ...answer.same]) store().markCentral(entry);
          const differing = answer.skipped.filter((s) => s.reason === "different").map((s) => s.label);
          const invalid = answer.skipped.filter((s) => s.reason === "invalid").map((s) => s.label);
          if (differing.length) {
            store().addToast(
              t("Odoo has a different version of {labels}; it applies from the next load.", { labels: differing.join(", ") }),
              "info",
              10_000,
            );
          }
          if (invalid.length) error(t("Only saved in this browser: {labels}", { labels: invalid.join(", ") }));
        } catch (err) {
          error(t("The imported devices are only saved in this browser: {reason}", { reason: reasonOf(err) }));
        }
      });
    }
  }
}

setTemplateSink(writeTemplate);

// --- uploading this browser's devices -------------------------------------------------------

/** Own devices the central library does not have — what „Nach Odoo hochladen“ offers. */
export function localOnlyTemplates(): DeviceTemplate[] {
  const { customTemplates, libraryMeta } = store();
  return customTemplates.filter((tpl) => !(keyOf(tpl) in libraryMeta));
}

export interface UploadSummary {
  added: string[];
  /** Odoo already had them with the same content; they are central now. */
  same: string[];
  /** Odoo has another version under the same id; the browser's copy stays local. */
  different: string[];
  /** Sentences saying why a device was refused. */
  invalid: string[];
}

/**
 * Send every device only this browser has to the central library, once. Never overwrites
 * Odoo. Null when there is nowhere to upload to (signed out, no Odoo module); throws the
 * backend's error when the upload itself fails, and then nothing has changed.
 */
export async function uploadLocalDevices(): Promise<UploadSummary | null> {
  if (!useFaceSession.getState().user || useCentralLibrary.getState().status === "unavailable" || useCentralLibrary.getState().status === "off") {
    return null;
  }
  await flushCentralWrites();
  const templates = localOnlyTemplates();
  const summary: UploadSummary = { added: [], same: [], different: [], invalid: [] };
  if (!templates.length) return summary;
  const answer = await faceApi<UploadAnswer>("/face/api/library/upload", { method: "POST", body: { templates } });
  for (const entry of [...answer.added, ...answer.same]) store().markCentral(entry);
  summary.added = answer.added.map((e) => e.template.label);
  summary.same = answer.same.map((e) => e.template.label);
  for (const s of answer.skipped) {
    if (s.reason === "different") summary.different.push(s.label);
    else summary.invalid.push(s.error ?? s.label);
  }
  return summary;
}

// --- Odoo product on a central template -----------------------------------------------------

export interface ProductHit {
  id: number;
  name: string;
  code: string | null;
}

/** Odoo products whose name or internal reference matches (at most 20). */
export function searchProducts(query: string): Promise<ProductHit[]> {
  return faceApi<ProductHit[]>(`/face/api/library/products?q=${encodeURIComponent(query)}`);
}

/**
 * Link a central template to an Odoo product, or unlink it with null. It belongs to the
 * model, not to one device, and never changes the template or its version. Queued with the
 * template's other writes; rejects with the backend's sentence when Odoo refuses.
 */
export function setTemplateProduct(key: string, productId: number | null): Promise<void> {
  if (!isCentral(key)) {
    return Promise.reject(new Error(t("Only devices in the central library can be linked to an Odoo product.")));
  }
  let failure: unknown = null;
  return enqueue(key, async () => {
    try {
      const entry = await faceApi<CentralEntry>(`/face/api/library/${encodeURIComponent(key)}`, { method: "PUT", body: { productId } });
      store().markCentral(entry);
    } catch (err) {
      failure = err;
    }
  }).then(() => {
    if (failure) throw failure;
  });
}

// --- for Claude's commands (SPEC-device-template.md) -----------------------------------------

/** Where a template Claude created or changed ended up. */
export type StoredIn = "odoo" | "browser";

/** Odoo is where Claude's templates go: signed in and the library module is there. */
export function claudeWritesToOdoo(): boolean {
  return writesGoToOdoo();
}

/** Run one write for `key` in the template's queue and hand its result (or error) back. */
function queued<T>(key: string, write: () => Promise<T>): Promise<T> {
  let result: T | undefined;
  let failure: unknown = null;
  return enqueue(key, async () => {
    try {
      result = await write();
    } catch (err) {
      failure = err;
    }
  }).then(() => {
    if (failure) throw failure;
    return result as T;
  });
}

/**
 * A new template from Claude: into the central library when Claude may write there (origin
 * claude), else into this browser like a device made in the editor. Throws the backend's
 * sentence when Odoo refuses — then nothing was stored.
 */
export async function createTemplateForClaude(
  template: DeviceTemplate,
  productId: number | undefined,
): Promise<{ stored: StoredIn; entry: CentralEntry | null }> {
  if (!writesGoToOdoo()) {
    store().addCustomTemplate(template);
    return { stored: "browser", entry: null };
  }
  const entry = await queued(keyOf(template), () =>
    faceApi<CentralEntry>("/face/api/library", {
      method: "POST",
      body: { template, origin: "claude", ...(productId ? { productId } : {}) },
    }),
  );
  store().upsertCentralTemplate(entry);
  return { stored: "odoo", entry };
}

/**
 * Claude's change to an own template. Central ones go to Odoo with the version Claude read
 * (Odoo refuses when someone changed it since); local ones change in this browser.
 * `template` undefined changes only the product.
 */
export async function updateTemplateForClaude(
  key: string,
  template: DeviceTemplate | undefined,
  baseVersion: number | undefined,
  productId: number | null | undefined,
): Promise<{ stored: StoredIn; entry: CentralEntry | null }> {
  if (!isCentral(key)) {
    if (template) store().updateCustomTemplate(key, template);
    return { stored: "browser", entry: null };
  }
  if (!writesGoToOdoo()) {
    throw new Error(t("This template lives in the central library in Odoo, which this tab cannot reach right now."));
  }
  const entry = await queued(key, () =>
    faceApi<CentralEntry>(`/face/api/library/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: { ...(template ? { template, baseVersion } : {}), ...(productId !== undefined ? { productId } : {}) },
    }),
  );
  store().upsertCentralTemplate(entry);
  return { stored: "odoo", entry };
}
