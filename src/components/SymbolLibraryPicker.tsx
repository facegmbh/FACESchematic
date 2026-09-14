import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchSymbolLibrary,
  symbolLibraryCategories,
  symbolLibraryInstalled,
  symbolLibraryUrl,
  type SymbolLibraryHit,
} from "../symbolLibrary";
import { useT } from "../i18n";

interface Props {
  /** The symbol currently in use, so the dialog opens on it. */
  selectedId?: string;
  onPick: (id: string | undefined) => void;
  onClose: () => void;
}

/**
 * Pick a BHE symbol.
 *
 * The CD is 287 drawings across a dozen chapters, so neither a flat list nor a plain grid
 * is usable: the chapters are how an installer thinks about them ("Einbruchmeldetechnik",
 * "Signalgeber"), and the search is how anyone who knows the name finds it in one go.
 *
 * Where the library is not installed the dialog says so instead of showing an empty grid —
 * the artwork is member material and does not travel in the repository.
 */
export default function SymbolLibraryPicker({ selectedId, onPick, onClose }: Props) {
  const t = useT();
  const categories = symbolLibraryCategories();
  const installed = symbolLibraryInstalled();
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.symbols.some((s) => s.id === selectedId)),
    [categories, selectedId],
  );
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(selectedCategory?.id ?? categories[0]?.id ?? "");

  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 10);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const shown: SymbolLibraryHit[] = useMemo(() => {
    if (query.trim()) return searchSymbolLibrary(query, categories);
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.symbols.map((s) => ({ ...s, category })) : [];
  }, [query, categoryId, categories]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-2xl w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <span className="text-sm font-semibold text-[var(--color-text-heading)]">{t("BHE symbol")}</span>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg leading-none cursor-pointer">×</button>
        </div>

        {!installed ? (
          <div className="px-5 py-8 text-xs text-[var(--color-text-muted)] leading-relaxed">
            <p className="mb-2 text-[var(--color-text)]">{t("The BHE symbol library is not installed on this build.")}</p>
            <p>{t("The drawings are BHE member material and are not part of the source. Generate them with tools/bheSymbols.mjs and the symbol CD at hand.")}</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-2 border-b border-[var(--color-border)]">
              <input
                ref={searchRef}
                className="w-full border border-[var(--color-border)] rounded px-2 py-1 text-xs bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                placeholder={t("Search all {n} symbols…", { n: categories.reduce((sum, c) => sum + c.symbols.length, 0) })}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="w-[220px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] py-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer ${
                      !query.trim() && c.id === categoryId
                        ? "bg-emerald-500/10 text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                    }`}
                    onClick={() => { setQuery(""); setCategoryId(c.id); }}
                  >
                    <span className="text-[var(--color-text-muted)] mr-1.5">{c.no}</span>
                    {c.label}
                    <span className="float-right text-[var(--color-text-muted)]">{c.symbols.length}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {shown.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] px-1 py-4">{t("Nothing matches that.")}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {shown.map((hit) => (
                      <button
                        key={hit.id}
                        className={`flex flex-col items-center gap-1 rounded border p-2 cursor-pointer ${
                          hit.id === selectedId
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                        }`}
                        onClick={() => { onPick(hit.id); onClose(); }}
                        title={`${hit.category.no} ${hit.category.label} · ${hit.name}`}
                      >
                        {/* White behind the drawing: BHE symbols are black line art, and on a
                            dark theme they would otherwise disappear. */}
                        <span className="flex h-12 w-12 items-center justify-center rounded bg-white">
                          <img src={symbolLibraryUrl(hit.id)} alt="" className="h-10 w-10 object-contain" />
                        </span>
                        <span className="text-[10px] leading-tight text-center text-[var(--color-text)] line-clamp-2">{hit.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
          <button
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
            onClick={() => { onPick(undefined); onClose(); }}
          >
            {t("No library symbol — use the drawn shape")}
          </button>
          <button
            className="text-xs px-3 py-1 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
            onClick={onClose}
          >
            {t("Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
