import { useEffect, useId, useState } from "react";
import { searchOdooProjects, type ProjectSummary } from "../faceDrawings";
import { useT } from "../i18n";

interface Props {
  selectedId: number | null;
  onSelect: (project: ProjectSummary) => void;
}

const SEARCH_DELAY_MS = 250;

/** Search box plus result list of Odoo projects (name or customer). Newest first when empty. */
export default function OdooProjectPicker({ selectedId, onSelect }: Props) {
  const t = useT();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      searchOdooProjects(query)
        .then((list) => {
          if (cancelled) return;
          setProjects(list);
          setError("");
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : t("Projects could not be loaded."));
        });
    }, query ? SEARCH_DELAY_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, t]);

  return (
    <div>
      <label htmlFor={inputId} className="block text-xs font-medium mb-1">
        {t("Project")}
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("Project or customer, e.g. FACE/26/10/560")}
        className="w-full px-3 py-2 text-xs rounded"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
        autoFocus
      />
      <div
        className="mt-2 max-h-48 overflow-y-auto rounded"
        style={{ border: "1px solid var(--color-border)" }}
        aria-busy={projects === null}
      >
        {error ? (
          <p role="alert" className="px-3 py-2 text-xs text-red-500">
            {error}
          </p>
        ) : projects === null ? (
          <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {t("Loading projects…")}
          </p>
        ) : projects.length === 0 ? (
          <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {t("No project found.")}
          </p>
        ) : (
          <ul>
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={p.id === selectedId}
                  onClick={() => onSelect(p)}
                  className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors border-l-2 ${
                    p.id === selectedId
                      ? "bg-[var(--color-surface-hover)] border-blue-600"
                      : "border-transparent hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  <span className={`block truncate ${p.id === selectedId ? "font-semibold" : "font-medium"}`}>{p.name}</span>
                  {p.customer && <span className="block truncate text-[var(--color-text-muted)]">{p.customer}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
