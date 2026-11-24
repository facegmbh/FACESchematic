import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  faceGate,
  faceLogin,
  faceLogout,
  loadFaceSession,
  useFaceSession,
  wasSignedInHere,
} from "../faceBackend";

const USER = { uid: 8, name: "Jean-Luc Doijen", login: "jl@face-gmbh.com" };

function respond(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const base = { faceBackend: true, embedded: false, loaded: true, user: null, unreachable: false, remembered: false };

describe("sign-in is required (SPEC-face-identity, Pflichtanmeldung)", () => {
  it("asks for sign-in when nobody is signed in", () => {
    expect(faceGate(base)).toBe("login");
  });

  it("lets a signed-in user through", () => {
    expect(faceGate({ ...base, user: USER })).toBe("app");
  });

  it("waits for the first /me answer instead of flashing the form", () => {
    expect(faceGate({ ...base, loaded: false })).toBe("loading");
  });

  it("does not gate a build without the FACE backend", () => {
    expect(faceGate({ ...base, faceBackend: false, loaded: false })).toBe("app");
  });

  it("does not gate the viewer Odoo embeds", () => {
    expect(faceGate({ ...base, embedded: true, loaded: false })).toBe("app");
  });

  it("keeps working offline for someone who signed in on this device", () => {
    expect(faceGate({ ...base, unreachable: true, remembered: true })).toBe("app");
  });

  it("blocks an unknown device while the backend is unreachable", () => {
    expect(faceGate({ ...base, unreachable: true })).toBe("unreachable");
  });

  it("asks again once the backend says the session is gone, remembered or not", () => {
    expect(faceGate({ ...base, remembered: true })).toBe("login");
  });
});

describe("session state behind the gate", () => {
  const fetchMock = vi.fn();
  let storage: Map<string, string>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    });
    useFaceSession.setState({ user: null, loaded: false, unreachable: false });
  });

  it("remembers the device after a sign-in and forgets it on sign-out", async () => {
    fetchMock.mockReturnValueOnce(respond(200, USER));
    await faceLogin("jl@face-gmbh.com", "good-key");
    expect(wasSignedInHere()).toBe(true);
    fetchMock.mockReturnValueOnce(respond(204));
    await faceLogout();
    expect(wasSignedInHere()).toBe(false);
  });

  it("stores nothing about the account itself", async () => {
    fetchMock.mockReturnValueOnce(respond(200, USER));
    await faceLogin("jl@face-gmbh.com", "good-key");
    const kept = [...storage.entries()].flat().join(" ");
    expect(kept).not.toContain("good-key");
    expect(kept).not.toContain("jl@face-gmbh.com");
  });

  it("a 401 from /me is signed out and forgets the device", async () => {
    storage.set("face-signed-in", "1");
    fetchMock.mockReturnValueOnce(respond(401, { error: "Nicht angemeldet." }));
    await loadFaceSession();
    expect(useFaceSession.getState()).toMatchObject({ user: null, loaded: true, unreachable: false });
    expect(wasSignedInHere()).toBe(false);
  });

  it("a network failure is unreachable, not signed out", async () => {
    storage.set("face-signed-in", "1");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await loadFaceSession();
    expect(useFaceSession.getState()).toMatchObject({ user: null, loaded: true, unreachable: true });
    expect(wasSignedInHere()).toBe(true);
  });

  it("a 502 from the proxy (backend container down) is unreachable too", async () => {
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response("<html>Bad Gateway</html>", { status: 502 })));
    await loadFaceSession();
    expect(useFaceSession.getState()).toMatchObject({ user: null, unreachable: true });
  });

  it("a successful /me clears unreachable and remembers the device", async () => {
    useFaceSession.setState({ unreachable: true });
    fetchMock.mockReturnValueOnce(respond(200, USER));
    await loadFaceSession();
    expect(useFaceSession.getState()).toMatchObject({ user: USER, unreachable: false });
    expect(wasSignedInHere()).toBe(true);
  });
});
