import { useEffect, useId } from "react";
import { create } from "zustand";
import { FaceApiError, useFaceSession } from "../faceBackend";
import { LockedError, StaleError, saveOdooDrawing, startOdooPresence, useOdooPresence } from "../faceDrawings";
import { useSchematicStore } from "../store";
import { t, useT } from "../i18n";
import FaceLoginDialog from "./FaceLoginDialog";
import OdooSaveDialog from "./OdooSaveDialog";
import OdooOpenDialog, { formatOdooDate } from "./OdooOpenDialog";

type OdooDialog = "save" | "open" | null;

interface Stale {
  writtenBy: string | null;
  writeDate: string;
}

/** Which Odoo dialog is open — asked for from the menu, from Ctrl+S, later from Claude. */
export const useOdooDialogs = create<{ open: OdooDialog; stale: Stale | null }>(() => ({ open: null, stale: null }));
export const showOdooDialog = (open: OdooDialog) => useOdooDialogs.setState({ open });

async function save(force: boolean): Promise<void> {
  const store = useSchematicStore.getState();
  try {
    await saveOdooDrawing({ force });
    store.addToast(t("Saved to Odoo"), "success", 1500);
  } catch (err) {
    if (err instanceof StaleError) {
      useOdooDialogs.setState({ stale: { writtenBy: err.writtenBy, writeDate: err.writeDate } });
      return;
    }
    if (err instanceof LockedError) showOdooDialog("save");
    else if (err instanceof FaceApiError && err.status === 401) useFaceSession.setState({ user: null });
    store.addToast(err instanceof Error ? err.message : t("Saving to Odoo failed."), "error");
  }
}

/**
 * Ctrl+S for content that is an Odoo drawing: back to its project. A reader — someone else
 * edits — gets "Save to Odoo as…" instead; a save over someone else's newer one asks first.
 * Returns false when the content is no Odoo drawing, so the caller saves the usual way.
 */
export async function saveToOdooIfLinked(): Promise<boolean> {
  if (!useSchematicStore.getState().odooDrawing) return false;
  if (!useFaceSession.getState().user || useOdooPresence.getState().role === "viewer") showOdooDialog("save");
  else await save(false);
  return true;
}

/** "Also open: Max (reading)" next to the project name, for the one editing. */
export function OdooViewers() {
  const t = useT();
  const role = useOdooPresence((s) => s.role);
  const viewers = useOdooPresence((s) => s.viewers);
  if (role !== "editor" || viewers.length === 0) return null;
  return (
    <span
      className="text-amber-600 truncate shrink-0 max-w-[50%]"
      role="status"
      title={t("Also open: {names} (reading)", { names: viewers.join(", ") })}
    >
      · {t("Also open: {names} (reading)", { names: viewers.join(", ") })}
    </span>
  );
}

/** Someone else saved since this content was opened: overwrite, keep both, or leave it. */
function StaleDialog({ stale, onClose }: { stale: Stale; onClose: () => void }) {
  const t = useT();
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const button = "px-3 py-1.5 text-xs rounded transition-colors cursor-pointer";
  const plain = { backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" };
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rounded-lg shadow-xl w-[420px] max-w-[90vw]"
        style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 id={titleId} className="text-sm font-semibold" style={{ color: "var(--color-text-heading)" }}>
            {t("Saved in the meantime")}
          </h2>
        </div>
        <p className="px-5 py-4 text-xs">
          {t("{name} saved this drawing at {when}, after you opened it. Overwrite their version, or keep both by saving yours under a new name?", {
            name: stale.writtenBy ?? t("Someone"),
            when: formatOdooDate(stale.writeDate),
          })}
        </p>
        <div className="px-5 py-3 flex justify-end gap-2 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button type="button" className={button} style={plain} onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className={button}
            style={plain}
            onClick={() => {
              onClose();
              showOdooDialog("save");
            }}
          >
            {t("Save to Odoo as…")}
          </button>
          <button
            type="button"
            autoFocus
            className={`${button} bg-blue-600 text-white hover:bg-blue-500`}
            onClick={() => {
              onClose();
              void save(true);
            }}
          >
            {t("Overwrite anyway")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mounted once (FACE build): the Odoo dialogs, behind the Odoo sign-in when needed. */
export default function OdooDialogs() {
  const open = useOdooDialogs((s) => s.open);
  const stale = useOdooDialogs((s) => s.stale);
  const user = useFaceSession((s) => s.user);
  const close = () => showOdooDialog(null);

  useEffect(() => {
    startOdooPresence();
  }, []);

  if (stale) return <StaleDialog stale={stale} onClose={() => useOdooDialogs.setState({ stale: null })} />;
  if (!open) return null;
  // A successful sign-in also "closes" the login dialog — then carry on to the dialog asked for.
  if (!user) return <FaceLoginDialog open onClose={() => !useFaceSession.getState().user && close()} />;
  return open === "open" ? <OdooOpenDialog onClose={close} /> : <OdooSaveDialog onClose={close} />;
}
