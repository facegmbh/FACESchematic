import { useEffect, useState, type ReactNode } from "react";
import { isEmbedded } from "../embed";
import { FACE_BACKEND, faceGate, loadFaceSession, useFaceSession, wasSignedInHere } from "../faceBackend";
import { startCentralLibrary } from "../centralLibrary";
import { useT } from "../i18n";
import { loadSymbolLibrary } from "../symbolLibrary";
import FaceLoginDialog from "./FaceLoginDialog";

const noop = () => {};

/**
 * Nobody gets to the app in the FACE build without signing in with Odoo first
 * (SPEC-face-identity.md, „Pflichtanmeldung“). The rules are in faceGate.
 *
 * This keeps colleagues' work behind their Odoo account; it is not access control for the
 * static files, which nginx serves to anyone who can reach the host.
 */
export default function FaceLoginGate({ children }: { children: ReactNode }) {
  const t = useT();
  const user = useFaceSession((s) => s.user);
  const loaded = useFaceSession((s) => s.loaded);
  const unreachable = useFaceSession((s) => s.unreachable);
  const [embedded] = useState(isEmbedded);
  const [retrying, setRetrying] = useState(false);
  const gated = FACE_BACKEND && !embedded;
  /** Once the app is up it stays mounted: a session that ends mid-work (sign-out, key
   *  revoked) puts the form on top instead of tearing the editor down. */
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (gated) void loadFaceSession();
  }, [gated]);

  // The own devices come from the central library in Odoo once somebody is signed in
  // (SPEC-odoo-device-library.md); it reloads at every sign-in and on focus.
  useEffect(() => {
    if (gated) startCentralLibrary();
  }, [gated]);

  // The server only hands the BHE symbols to a signed-in browser, so the catalogue asked
  // for at startup came back empty on a new device. Ask again once somebody is in.
  const uid = user?.uid;
  useEffect(() => {
    if (uid !== undefined) void loadSymbolLibrary();
  }, [uid]);

  const gate = faceGate({
    faceBackend: FACE_BACKEND,
    embedded,
    loaded,
    user,
    unreachable,
    remembered: wasSignedInHere(),
  });
  if (gate === "app" && !entered) setEntered(true);

  if (gate === "app") return <>{children}</>;
  if (gate === "loading") return null;

  if (gate === "unreachable" && !entered) {
    const retry = async () => {
      setRetrying(true);
      await loadFaceSession();
      setRetrying(false);
    };
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      >
        <div
          role="alert"
          className="rounded-lg shadow-xl w-[380px] max-w-[90vw] px-5 py-4 space-y-3"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <h1 className="text-sm font-semibold" style={{ color: "var(--color-text-heading)" }}>
            {t("Sign-in is not reachable")}
          </h1>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {t("FACESchematic cannot reach the sign-in service right now. Check your network connection and try again.")}
          </p>
          <div className="flex justify-end">
            <button
              onClick={retry}
              disabled={retrying}
              className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {t("Retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {entered && children}
      <FaceLoginDialog open required onClose={noop} />
    </>
  );
}
