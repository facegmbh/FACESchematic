/**
 * Client for FACE's own backend under /face/ (mcp-server/src/cloud, SPEC-face-identity.md).
 *
 * Only the FACE image is built with VITE_FACE_BACKEND=1 (see Dockerfile); everywhere else
 * — the public build, `npm run dev` without the flag — the app has no backend to talk to
 * and keeps the upstream account button.
 */
import { create } from "zustand";

export const FACE_BACKEND = import.meta.env.VITE_FACE_BACKEND === "1";

export interface FaceUser {
  uid: number;
  name: string;
  login: string;
}

export class FaceApiError extends Error {
  readonly status: number;
  /** The backend's JSON answer — a 409 says why (e.g. `reason: "stale"`). */
  readonly body: Record<string, unknown>;
  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Same-origin call carrying the header the backend's CSRF check wants — on GETs too, since
 *  the bridge's poll hands out commands. */
export async function faceApi<T>(
  path: string,
  init: { method?: string; body?: unknown; keepalive?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {};
  headers["X-FACE-Request"] = "1";
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    keepalive: init.keepalive,
    signal: init.signal,
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new FaceApiError(data.error || `Fehler ${res.status}`, res.status, data);
  return data as T;
}

interface FaceSessionState {
  user: FaceUser | null;
  /** False until the first /me answer, so the button doesn't flash "Anmelden" for a signed-in user. */
  loaded: boolean;
  /** The last /me got no answer from the backend at all (offline, container down) — which
   *  says nothing about whether the session is still good. */
  unreachable: boolean;
}

export const useFaceSession = create<FaceSessionState>(() => ({ user: null, loaded: false, unreachable: false }));

/** A bare marker that somebody signed in on this device — no name, no key. It only decides
 *  whether the app may open while the backend cannot be asked (see faceGate). */
const SIGNED_IN_KEY = "face-signed-in";

function rememberSignedIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, "1");
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* private mode / storage disabled */
  }
}

export function wasSignedInHere(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export type FaceGate = "app" | "loading" | "login" | "unreachable";

/**
 * Sign-in is required in the FACE build (SPEC-face-identity.md, „Pflichtanmeldung“): what to
 * show instead of the app. The viewer Odoo embeds stays open — it only renders the file its
 * embedder hands it, and the session cookie would not reach a third-party frame anyway. With
 * the backend out of reach, a device somebody signed in on keeps working (a technician on
 * site without network); the Odoo features fail on their own until it is back.
 */
export function faceGate(s: {
  faceBackend: boolean;
  embedded: boolean;
  loaded: boolean;
  user: FaceUser | null;
  unreachable: boolean;
  remembered: boolean;
}): FaceGate {
  if (!s.faceBackend || s.embedded) return "app";
  if (!s.loaded) return "loading";
  if (s.user) return "app";
  if (!s.unreachable) return "login";
  return s.remembered ? "app" : "unreachable";
}

export async function loadFaceSession(): Promise<void> {
  try {
    const user = await faceApi<FaceUser>("/face/api/me");
    rememberSignedIn(true);
    useFaceSession.setState({ user, loaded: true, unreachable: false });
  } catch (err) {
    // Only the backend's own 401 means "signed out". Anything else — no network, the proxy's
    // 502 — leaves the question open.
    const signedOut = err instanceof FaceApiError && err.status === 401;
    if (signedOut) rememberSignedIn(false);
    useFaceSession.setState({ user: null, loaded: true, unreachable: !signedOut });
  }
}

export async function faceLogin(login: string, apiKey: string): Promise<FaceUser> {
  const user = await faceApi<FaceUser>("/face/api/login", {
    method: "POST",
    body: { login: login.trim(), apiKey: apiKey.trim() },
  });
  rememberSignedIn(true);
  useFaceSession.setState({ user, loaded: true, unreachable: false });
  return user;
}

export async function faceLogout(): Promise<void> {
  await faceApi<void>("/face/api/logout", { method: "POST" });
  rememberSignedIn(false);
  useFaceSession.setState({ user: null, loaded: true, unreachable: false });
}
