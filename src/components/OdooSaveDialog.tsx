import { useEffect, useId, useState } from "react";
import { createOdooDrawing, type ProjectSummary } from "../faceDrawings";
import { useSchematicStore } from "../store";
import { useT } from "../i18n";
import OdooProjectPicker from "./OdooProjectPicker";

interface Props {
  onClose: () => void;
}

/** "Save to Odoo as…": pick a project, name the drawing, store it there (SPEC-odoo-drawings). */
export default function OdooSaveDialog({ onClose }: Props) {
  const t = useT();
  const titleId = useId();
  const nameId = useId();
  const current = useSchematicStore((s) => s.odooDrawing);
  const schematicName = useSchematicStore((s) => s.schematicName);
  const [project, setProject] = useState<ProjectSummary | null>(
    current ? { id: current.projectId, name: current.projectName, customer: null } : null,
  );
  // The placeholder name of a fresh schematic is no name for a drawing on a project.
  const [name, setName] = useState(schematicName === "Untitled Schematic" ? "" : schematicName);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) {
      setError(t("Choose a project."));
      return;
    }
    if (!name.trim()) {
      setError(t("Enter a name for the drawing."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createOdooDrawing(project.id, name);
      useSchematicStore.getState().addToast(t("Saved to Odoo: {project}", { project: project.name }), "success", 2500);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Saving to Odoo failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="rounded-lg shadow-xl w-[440px] max-w-[90vw]"
        style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 id={titleId} className="text-sm font-semibold" style={{ color: "var(--color-text-heading)" }}>
            {t("Save to Odoo as…")}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <OdooProjectPicker selectedId={project?.id ?? null} onSelect={setProject} />
          {project && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {t("Project: {project}", { project: project.name })}
            </p>
          )}
          <div>
            <label htmlFor={nameId} className="block text-xs font-medium mb-1">
              {t("Drawing name")}
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded"
              style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
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
            onClick={onClose}
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
            {busy ? t("Saving...") : t("Save")}
          </button>
        </div>
      </form>
    </div>
  );
}
