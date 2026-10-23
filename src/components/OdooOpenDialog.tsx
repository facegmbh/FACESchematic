import { useEffect, useId, useState } from "react";
import {
  isChangedSinceOdooSave,
  listOdooDrawings,
  openOdooDrawing,
  type DrawingListItem,
  type ProjectSummary,
} from "../faceDrawings";
import { useSchematicStore } from "../store";
import { getLocale, useT } from "../i18n";
import ConfirmDialog from "./ConfirmDialog";
import OdooProjectPicker from "./OdooProjectPicker";

interface Props {
  onClose: () => void;
}

/** In the app's language, not the browser's — the rest of the sheet speaks it too. */
const dateLocale = () => (getLocale() === "de" ? "de-DE" : "en-GB");

/** Odoo stores "YYYY-MM-DD HH:MM:SS" in UTC. */
export const formatOdooDate = (writeDate: string) =>
  new Date(`${writeDate.replace(" ", "T")}Z`).toLocaleString(dateLocale(), { dateStyle: "short", timeStyle: "short" });

export const formatTime = (epochMs: number) => new Date(epochMs).toLocaleTimeString(dateLocale(), { timeStyle: "short" });

/** "Open from Odoo…": project → its drawings → open (SPEC-odoo-drawings). */
export default function OdooOpenDialog({ onClose }: Props) {
  const t = useT();
  const titleId = useId();
  const current = useSchematicStore((s) => s.odooDrawing);
  const [project, setProject] = useState<ProjectSummary | null>(
    current ? { id: current.projectId, name: current.projectName, customer: null } : null,
  );
  const [drawings, setDrawings] = useState<DrawingListItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<DrawingListItem | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, confirming]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setDrawings(null);
    listOdooDrawings(project.id)
      .then((list) => !cancelled && (setDrawings(list), setError("")))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : t("Drawings could not be loaded.")));
    return () => {
      cancelled = true;
    };
  }, [project, t]);

  const open = async (d: DrawingListItem) => {
    setBusy(true);
    setError("");
    try {
      await openOdooDrawing(d.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Opening failed."));
    } finally {
      setBusy(false);
    }
  };

  const choose = (d: DrawingListItem) => {
    if (isChangedSinceOdooSave()) setConfirming(d);
    else void open(d);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      // Only a click on this backdrop itself closes — not one on the nested confirmation's.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rounded-lg shadow-xl w-[480px] max-w-[90vw]"
        style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 id={titleId} className="text-sm font-semibold" style={{ color: "var(--color-text-heading)" }}>
            {t("Open from Odoo…")}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <OdooProjectPicker selectedId={project?.id ?? null} onSelect={setProject} />
          {project && (
            <div>
              <p className="text-xs font-medium mb-1">{t("Drawings on {project}", { project: project.name })}</p>
              <div className="max-h-56 overflow-y-auto rounded" style={{ border: "1px solid var(--color-border)" }} aria-busy={drawings === null}>
                {drawings === null && !error ? (
                  <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {t("Loading drawings…")}
                  </p>
                ) : drawings?.length === 0 ? (
                  <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {t("No drawings yet — save one here with “Save to Odoo as…”.")}
                  </p>
                ) : (
                  <ul>
                    {(drawings ?? []).map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => choose(d)}
                          className="w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                        >
                          <span className="block truncate font-medium">{d.name}</span>
                          <span className="block truncate text-[var(--color-text-muted)]">
                            {d.writtenBy
                              ? t("Last saved by {name}, {when}", { name: d.writtenBy, when: formatOdooDate(d.writeDate) })
                              : t("Last saved {when}", { when: formatOdooDate(d.writeDate) })}
                          </span>
                          {d.editedBy && (
                            <span className="block truncate text-amber-600">
                              {t("Being edited by {name} since {time}", { name: d.editedBy, time: formatTime(d.editedSince ?? Date.now()) })}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-500">
              {error}
            </p>
          )}
        </div>
        <div className="px-5 py-3 flex justify-end border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded transition-colors cursor-pointer"
            style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
          >
            {t("Cancel")}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t("Unsaved changes")}
          message={t("“{name}” has changes that are not saved to Odoo yet. Open “{other}” anyway and discard them?", {
            name: current?.name ?? "",
            other: confirming.name,
          })}
          confirmLabel={t("Discard and open")}
          onConfirm={() => {
            const d = confirming;
            setConfirming(null);
            void open(d);
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
