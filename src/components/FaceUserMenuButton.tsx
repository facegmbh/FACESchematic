import { useEffect, useRef, useState } from "react";
import { faceLogout, loadFaceSession, useFaceSession } from "../faceBackend";
import { useT } from "../i18n";
import FaceLoginDialog from "./FaceLoginDialog";

/** The account button in the FACE build: sign in with Odoo, show the name, sign out. */
export default function FaceUserMenuButton() {
  const t = useT();
  const user = useFaceSession((s) => s.user);
  const loaded = useFaceSession((s) => s.loaded);
  const [showLogin, setShowLogin] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadFaceSession();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!loaded) return null;

  const buttonClass =
    "px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-heading)] rounded transition-colors cursor-pointer";

  if (!user) {
    return (
      <>
        <button onClick={() => setShowLogin(true)} className={buttonClass}>
          {t("Log in")}
        </button>
        <FaceLoginDialog open={showLogin} onClose={() => setShowLogin(false)} />
      </>
    );
  }

  const signOut = async () => {
    try {
      await faceLogout();
      setOpen(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Sign-out failed."));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${buttonClass} flex items-center gap-1`}
      >
        {user.name}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-56 rounded-lg shadow-lg py-1 z-50"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              {t("Signed in with Odoo as {login}", { login: user.login })}
            </p>
          </div>
          <button
            role="menuitem"
            onClick={signOut}
            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
          >
            {t("Log out")}
          </button>
          {error && (
            <p role="alert" className="px-3 pb-2 text-xs text-red-500">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
