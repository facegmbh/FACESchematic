import { describe, it, expect, beforeEach, vi } from "vitest";
import { faceLogin, faceLogout, loadFaceSession, useFaceSession, FaceApiError } from "../faceBackend";

const USER = { uid: 8, name: "Jean-Luc Doijen", login: "jl@face-gmbh.com" };

function respond(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("FACE backend client (SPEC-face-identity)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    useFaceSession.setState({ user: null, loaded: false });
  });

  it("loads the signed-in user from /face/api/me", async () => {
    fetchMock.mockReturnValueOnce(respond(200, USER));
    await loadFaceSession();
    expect(fetchMock.mock.calls[0][0]).toBe("/face/api/me");
    expect(useFaceSession.getState()).toMatchObject({ user: USER, loaded: true });
  });

  it("treats 401 from /me as signed out, not as an error", async () => {
    fetchMock.mockReturnValueOnce(respond(401, { error: "Nicht angemeldet." }));
    await loadFaceSession();
    expect(useFaceSession.getState()).toMatchObject({ user: null, loaded: true });
  });

  it("treats an unreachable backend as signed out", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await loadFaceSession();
    expect(useFaceSession.getState()).toMatchObject({ user: null, loaded: true });
  });

  it("signs in with the CSRF header and stores the user", async () => {
    fetchMock.mockReturnValueOnce(respond(200, USER));
    await faceLogin(" jl@face-gmbh.com ", "good-key");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/face/api/login");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-FACE-Request"]).toBe("1");
    expect(JSON.parse(init.body as string)).toEqual({ login: "jl@face-gmbh.com", apiKey: "good-key" });
    expect(useFaceSession.getState().user).toEqual(USER);
  });

  it("surfaces the backend's German error message on a failed sign-in", async () => {
    fetchMock.mockReturnValueOnce(respond(401, { error: "Anmeldung an Odoo fehlgeschlagen" }));
    await expect(faceLogin("jl@face-gmbh.com", "wrong")).rejects.toThrow("Anmeldung an Odoo fehlgeschlagen");
    expect(useFaceSession.getState().user).toBeNull();
  });

  it("raises a FaceApiError carrying the HTTP status", async () => {
    fetchMock.mockReturnValueOnce(respond(429, { error: "Zu viele Anmeldeversuche" }));
    const err = await faceLogin("a@b.de", "x").catch((e) => e);
    expect(err).toBeInstanceOf(FaceApiError);
    expect(err.status).toBe(429);
  });

  it("signs out and forgets the user", async () => {
    useFaceSession.setState({ user: USER, loaded: true });
    fetchMock.mockReturnValueOnce(respond(204));
    await faceLogout();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/face/api/logout");
    expect(init.method).toBe("POST");
    expect(useFaceSession.getState().user).toBeNull();
  });
});
