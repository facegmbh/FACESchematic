import { useState } from "react";
import { isChangedSinceOdooSave, openOdooDrawing, takeOverOdooDrawing, useOdooPresence } from "../faceDrawings";
import { useSchematicStore } from "../store";
import { useT } from "../i18n";
import ConfirmDialog from "./ConfirmDialog";
import { showOdooDialog } from "./OdooDialogs";
import { formatTime } from "./OdooOpenDialog";

/**
 * Shown while this tab only reads an Odoo drawing (SPEC-odoo-drawings): who edits it, and the
 * one thing this tab can do about it. Same strip as the demo banner.
 */
export default function OdooLockBanner() {
  const t = useT();
  const ref = useSchematicStore((s) => s.odooDrawing);
  const role = useOdooPresence((s) => s.role);
  const holder = useOdooPresence((s) => s.holder);
  const [error, setError] = useState("");
  const [confirmReload, setConfirmReload] = useState(false);

  if (!ref || role !== "viewer") return null;

  const run = (action: () => Promise<void>) => {
    setError("");
    action().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };
  const reload = () => run(() => openOdooDrawing(ref.drawingId));

  let text: string;
  let label: string;
  let onClick: () => void;
  if (holder && !holder.sameUser) {
    text = t("Being edited by {name} since {time} — read only. Saving stores a new drawing.", {
      name: holder.name,
      time: formatTime(holder.since),
    });
    label = t("Save to Odoo as…");
    onClick = () => showOdooDialog("save");
  } else if (holder) {
    text = t("You are editing this drawing in another tab.");
    label = t("Edit here");
    onClick = () => run(takeOverOdooDrawing);
  } else {
    text = t("Nobody is editing this drawing any more.");
    label = t("Reload and edit");
    onClick = () => (isChangedSinceOdooSave() ? setConfirmReload(true) : reload());
  }

  return (
    <div role="status" className="bg-slate-700 text-slate-200 text-sm px-4 py-2 flex items-center justify-between gap-4" data-print-hide>
      <span>
        <span aria-hidden="true">🔒 </span>
        {text}
        {error && <span className="ml-2 text-red-300">{error}</span>}
      </span>
      <button
        onClick={onClick}
        className="shrink-0 px-2.5 py-1 text-xs rounded border border-slate-400 text-white hover:bg-slate-600 cursor-pointer"
      >
        {label}
      </button>
      {confirmReload && (
        <ConfirmDialog
          title={t("Unsaved changes")}
          message={t("Reloading discards the changes made here while reading. Reload anyway?")}
          confirmLabel={t("Reload and edit")}
          onConfirm={() => {
            setConfirmReload(false);
            reload();
          }}
          onCancel={() => setConfirmReload(false)}
        />
      )}
    </div>
  );
}
