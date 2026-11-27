import { useEffect, useState } from "react";
import { useSchematicStore } from "../store";
import { useCentralLibrary, searchProducts, setTemplateProduct, type ProductHit } from "../centralLibrary";
import { useT } from "../i18n";

const inputClass =
  "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-heading)] outline-none focus:border-blue-500";

/**
 * The Odoo product of a device's template in the central library (SPEC-odoo-device-library).
 * It belongs to the model, not to this one device, so it is saved at once and not with the
 * form. Shown only for templates that are central, while the library is reachable.
 */
export default function TemplateProductField({ templateKey }: { templateKey: string | undefined }) {
  const t = useT();
  const meta = useSchematicStore((s) => (templateKey ? s.libraryMeta[templateKey] : undefined));
  const libraryOk = useCentralLibrary((s) => s.status === "ok");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      searchProducts(q)
        .then((found) => current && setHits(found))
        .catch((err) => current && setError(err instanceof Error ? err.message : String(err)));
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (!templateKey || !meta || !libraryOk) return null;

  const link = async (productId: number | null) => {
    setBusy(true);
    setError(null);
    try {
      await setTemplateProduct(templateKey, productId);
      setQuery("");
      setHits([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
        {t("Odoo product (template)")}
      </label>
      {meta.productId ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-heading)]">
          <span className="truncate flex-1" title={meta.productName ?? undefined}>{meta.productName}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void link(null)}
            className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 cursor-pointer"
          >
            {t("Unlink")}
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className={inputClass}
            value={query}
            disabled={busy}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            placeholder={t("Search product name or reference")}
            aria-label={t("Odoo product (template)")}
          />
          {hits.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-20 left-0 right-0 mt-0.5 max-h-48 overflow-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
            >
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => void link(hit.id)}
                    className="w-full text-left px-2 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                  >
                    {hit.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
        {error ? <span className="text-red-500">{error}</span> : t("Applies to the template in the central library, saved at once.")}
      </p>
    </div>
  );
}
