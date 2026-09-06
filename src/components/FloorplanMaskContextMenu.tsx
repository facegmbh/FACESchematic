import { useEffect } from "react";
import { useSchematicStore } from "../store";
import { useContextMenuPosition } from "../hooks/useContextMenuPosition";
import { useT } from "../i18n";
import type { FloorplanPage } from "../types";

interface Props {
  page: FloorplanPage;
  /** Where the right-click landed, in client coordinates. */
  x: number;
  y: number;
  maskId: string;
  onClose: () => void;
}

/**
 * Right-click on a cover — the white patch that takes the architect's own legend or title
 * block off the sheet. A cover is invisible by design, so the panel on the right is a poor
 * place to reach the one you mean; this menu acts on the one under the pointer.
 *
 * Locking matters here: once a cover sits right over the block underneath, symbols get
 * placed on top of it, and every one of those clicks would otherwise risk nudging it.
 */
export default function FloorplanMaskContextMenu({ page, x, y, maskId, onClose }: Props) {
  const t = useT();
  const { ref: menuRef, pos } = useContextMenuPosition(x, y);
  const updateFloorplanMask = useSchematicStore((s) => s.updateFloorplanMask);
  const removeFloorplanMask = useSchematicStore((s) => s.removeFloorplanMask);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const timer = setTimeout(() => {
      document.addEventListener("click", onClose);
      document.addEventListener("contextmenu", onClose);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", onClose);
      document.removeEventListener("contextmenu", onClose);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const mask = page.masks.find((m) => m.id === maskId);
  if (!mask) return null;

  const index = page.masks.findIndex((m) => m.id === maskId) + 1;
  const turnBy = mask.rotationDeg ?? 0;
  const fade = Math.round((mask.opacity ?? 1) * 100);

  const act = (run: () => void) => { run(); onClose(); };
  const patch = (p: Parameters<typeof updateFloorplanMask>[2]) => act(() => updateFloorplanMask(page.id, maskId, p));

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-lg py-1 min-w-[200px] text-xs"
      style={{
        left: pos.x,
        top: pos.y,
        maxHeight: pos.maxHeight,
        overflowY: pos.maxHeight ? "auto" : undefined,
        visibility: pos.ready ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
      data-allow-scroll
      data-floorplan-mask-menu
    >
      <div className="px-3 py-1 text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-1 truncate">
        {t("Cover")} {index} · {Math.round(mask.sizeMm.w)} × {Math.round(mask.sizeMm.h)} mm
        {turnBy ? ` · ${turnBy}°` : ""}
        {fade < 100 ? ` · ${fade}%` : ""}
      </div>

      <Section>{t("Turn")}</Section>
      <Item label={t("15° clockwise")} onClick={() => patch({ rotationDeg: turnBy + 15 })} />
      <Item label={t("15° counter-clockwise")} onClick={() => patch({ rotationDeg: turnBy - 15 })} />
      <Item label={t("90° clockwise")} onClick={() => patch({ rotationDeg: turnBy + 90 })} />
      {turnBy !== 0 && <Item label={t("Square to the sheet again")} onClick={() => patch({ rotationDeg: 0 })} />}

      <Divider />
      <Section>{t("Fade")}</Section>
      {[100, 75, 50, 25].map((percent) => (
        <Item
          key={percent}
          label={percent === 100 ? t("Opaque — erases what is under it") : `${percent}%`}
          onClick={() => patch({ opacity: percent === 100 ? undefined : percent / 100 })}
          selected={fade === percent}
        />
      ))}

      <Divider />
      <Item
        label={mask.locked ? t("Unlock") : t("Lock in place")}
        onClick={() => patch({ locked: mask.locked ? undefined : true })}
        title={mask.locked
          ? t("Let it be dragged and resized again.")
          : t("Pin it, so placing symbols on top of it cannot nudge it. It stays editable from here.")}
      />
      <Item label={t("Remove cover")} danger onClick={() => act(() => removeFloorplanMask(page.id, maskId))} />
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-0.5 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--color-border)] my-1" />;
}

function Item({ label, onClick, danger, title, selected }: { label: string; onClick: () => void; danger?: boolean; title?: string; selected?: boolean }) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 cursor-pointer flex items-center gap-1.5 ${
        danger
          ? "text-red-600 hover:bg-red-500/10 hover:text-red-700"
          : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
      onClick={onClick}
      title={title}
    >
      <span className="w-3 shrink-0 text-emerald-600">{selected ? "✓" : ""}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
