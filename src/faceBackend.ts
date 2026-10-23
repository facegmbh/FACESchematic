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

/** Same-origin call; changing requests carry the header the backend's CSRF check wants. */
export async function faceApi<T>(
  path: string,
  init: { method?: string; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-FACE-Request"] = "1";
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    keepalive: init.keepalive,
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
}

export const useFaceSession = create<FaceSessionState>(() => ({ user: null, loaded: false }));

export async function loadFaceSession(): Promise<void> {
  try {
    const user = await faceApi<FaceUser>("/face/api/me");
    useFaceSession.setState({ user, loaded: true });
  } catch {
    // 401 is simply "signed out"; an unreachable backend leaves the user signed out too.
    useFaceSession.setState({ user: null, loaded: true });
  }
}

export async function faceLogin(login: string, apiKey: string): Promise<FaceUser> {
  const user = await faceApi<FaceUser>("/face/api/login", {
    method: "POST",
    body: { login: login.trim(), apiKey: apiKey.trim() },
  });
  useFaceSession.setState({ user, loaded: true });
  return user;
}

export async function faceLogout(): Promise<void> {
  await faceApi<void>("/face/api/logout", { method: "POST" });
  useFaceSession.setState({ user: null, loaded: true });
}
