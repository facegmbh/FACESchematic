import { useEffect, useId, useState } from "react";
import { faceLogin } from "../faceBackend";
import { useT } from "../i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

const fieldStyle = {
  backgroundColor: "var(--color-bg)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
};

/** Sign-in with the user's Odoo account (SPEC-face-identity.md). Same frame as LoginDialog. */
export default function FaceLoginDialog({ open, onClose }: Props) {
  const t = useT();
  const titleId = useId();
  const loginId = useId();
  const keyId = useId();
  const [login, setLogin] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const close = () => {
    setApiKey("");
    setError("");
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !apiKey.trim()) {
      setError(t("Enter your Odoo e-mail and API key."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await faceLogin(login, apiKey);
      setApiKey("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Sign-in failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={close}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="rounded-lg shadow-xl w-[380px] max-w-[90vw]"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 id={titleId} className="text-sm font-semibold" style={{ color: "var(--color-text-heading)" }}>
            {t("Sign in with Odoo")}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {t("Your drawings are stored on Odoo projects, with your Odoo rights.")}
          </p>
          <div>
            <label htmlFor={loginId} className="block text-xs font-medium mb-1">
              {t("Odoo e-mail")}
            </label>
            <input
              id={loginId}
              type="email"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="vorname.nachname@face-gmbh.com"
              className="w-full px-3 py-2 text-xs rounded"
              style={fieldStyle}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor={keyId} className="block text-xs font-medium mb-1">
              {t("Odoo API key")}
            </label>
            <input
              id={keyId}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded"
              style={fieldStyle}
              aria-describedby={`${keyId}-hint`}
            />
            <p id={`${keyId}-hint`} className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
              {t("Not your password: create one in Odoo under your avatar → My Profile → Account Security → New API Key.")}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-500">
              {error}
            </p>
          )}
        </div>
        <div className="px-5 py-3 flex justify-end gap-2 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            type="button"
            onClick={close}
            className="px-3 py-1.5 text-xs rounded transition-colors cursor-pointer"
            style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy ? t("Signing in…") : t("Sign in")}
          </button>
        </div>
      </form>
    </div>
  );
}
