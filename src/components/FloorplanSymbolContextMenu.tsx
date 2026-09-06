import { useEffect } from "react";
import { useSchematicStore } from "../store";
import { useContextMenuPosition } from "../hooks/useContextMenuPosition";
import { defaultCoverageForDevice } from "../floorplan";
import { planningRadiusM } from "../wifiCoverage";
import { getTemplateById } from "../templateApi";
import { DEFAULT_HEATMAP } from "../types";
import type { DeviceData, FloorplanPage } from "../types";
import FloorplanSymbolSvg from "./FloorplanSymbolSvg";
import { useT } from "../i18n";

interface Props {
  page: FloorplanPage;
  /** Where the right-click landed, in client coordinates. */
  x: number;
  y: number;
  /** The symbols the menu acts on. */
  ids: string[];
  /** Open an existing coverage area for editing instead of stacking a new one on it. */
  onSelectCoverage?: (coverageId: string) => void;
  onClose: () => void;
}

/**
 * Right-click on a symbol. Everything here is reachable in the panel on the right too; this
 * is the short path for the things done while drawing: turning a symbol, moving it to
 * another group, switching a layer off, deleting it.
 *
 * A group is the layer: switching one off takes its symbols off the sheet, out of the export
 * and out of the legend, while they stay in the project. Switching one back on happens in
 * the panel — a hidden symbol has nothing left to right-click.
 */
export default function FloorplanSymbolContextMenu({ page, x, y, ids, onSelectCoverage, onClose }: Props) {
  const t = useT();
  const { ref: menuRef, pos } = useContextMenuPosition(x, y);
  const updateFloorplanSymbols = useSchematicStore((s) => s.updateFloorplanSymbols);
  const updateFloorplanGroup = useSchematicStore((s) => s.updateFloorplanGroup);
  const removeFloorplanSymbol = useSchematicStore((s) => s.removeFloorplanSymbol);
  const addFloorplanCoverage = useSchematicStore((s) => s.addFloorplanCoverage);
  const nodes = useSchematicStore((s) => s.nodes);
  const customTemplates = useSchematicStore((s) => s.customTemplates);

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

  const symbols = page.symbols.filter((s) => ids.includes(s.id));
  if (symbols.length === 0) return null;
  const first = symbols[0];
  const group = page.groups.find((g) => g.id === first.groupId);
  const many = symbols.length > 1;
  const hiddenGroups = page.groups.filter((g) => g.hidden);
  const ownCoverage = many ? undefined : (page.coverages ?? []).find((c) => c.symbolId === first.id);

  const act = (run: () => void) => { run(); onClose(); };
  const turn = (by: number) => act(() => updateFloorplanSymbols(page.id, ids, { rotationDeg: (first.rotationDeg ?? 0) + by }));

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
      data-floorplan-symbol-menu
    >
      <div className="px-3 py-1 flex items-center gap-1.5 text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-1">
        {group && <FloorplanSymbolSvg group={group} sizePx={12} paddingPx={1} symbolSizeMm={page.symbolSizeMm} rotationDeg={first.rotationDeg} className="shrink-0" />}
        <span className="truncate">{many ? t("{n} symbols", { n: symbols.length }) : first.label}</span>
      </div>

      <Section>{t("Turn")}</Section>
      <Item label={t("90° clockwise")} onClick={() => turn(90)} />
      <Item label={t("90° counter-clockwise")} onClick={() => turn(-90)} />
      <Item label={t("Upright again")} onClick={() => act(() => updateFloorplanSymbols(page.id, ids, { rotationDeg: 0 }))} />

      <Divider />
      {/* Editing the area it already has comes first: pressing "add" twice used to stack a
          second wedge on the device, and the one underneath keeps its own angle — which
          reads exactly like a rotation that did not take. */}
      {!many && ownCoverage && onSelectCoverage && (
        <Item
          label={t("Edit its coverage area")}
          onClick={() => act(() => onSelectCoverage(ownCoverage.id))}
          title={t("Opens the area this device already has, in the panel on the right.")}
        />
      )}
      <Item
        label={many
          ? t("Add a coverage area to each")
          : ownCoverage ? t("Add another coverage area") : t("Add a coverage area")}
        onClick={() => act(() => {
          // Anchored and filed under the device's own group, so aiming the camera aims what
          // it sees and the area switches off with that layer.
          const cfgHm = { ...DEFAULT_HEATMAP, ...(page.heatmap ?? {}) };
          for (const sym of symbols) {
            const dev = sym.deviceNodeId ? nodes.find((n) => n.id === sym.deviceNodeId) : undefined;
            const devData = dev?.data as DeviceData | undefined;
            const tpl = devData?.templateId ? getTemplateById(devData.templateId, customTemplates) : undefined;
            addFloorplanCoverage(page.id, {
              ...defaultCoverageForDevice(devData?.deviceType, {
                rangeM: tpl?.wifi ? planningRadiusM(tpl.wifi, cfgHm.band, cfgHm.pathLossExponent) : undefined,
                mount: tpl?.wifi?.mount,
              }),
              symbolId: sym.id,
              groupId: sym.groupId,
              positionMm: { ...sym.positionMm },
              label: sym.label,
            });
          }
        })}
        title={ownCoverage
          ? t("A second area on the same device — a corridor lens beside a wide one, say.")
          : t("Draw what the device covers — a camera's field of view, a detector's reach. Adjust the reach and the angle in the panel on the right.")}
      />

      {page.groups.length > 1 && (
        <>
          <Divider />
          <Section>{t("Move to group")}</Section>
          {page.groups.filter((g) => g.id !== first.groupId).map((g) => (
            <button
              key={g.id}
              className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
              onClick={() => act(() => updateFloorplanSymbols(page.id, ids, { groupId: g.id }))}
            >
              <FloorplanSymbolSvg group={g} sizePx={12} paddingPx={1} symbolSizeMm={page.symbolSizeMm} className="shrink-0" />
              <span className="truncate">{g.label || t("(unnamed)")}</span>
              {g.hidden && <span className="ml-auto shrink-0 text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>{t("hidden")}</span>}
            </button>
          ))}
        </>
      )}

      <Divider />
      <Section>{t("Layers")}</Section>
      {group && (
        <Item
          label={t("Hide “{group}”", { group: group.label || t("this group") })}
          onClick={() => act(() => updateFloorplanGroup(page.id, group.id, { hidden: true }))}
          title={t("Takes this group off the sheet, the export and the legend. It stays in the project — switch it back on in the panel on the right.")}
        />
      )}
      <Item
        label={t("Hide every other group")}
        onClick={() => act(() => {
          for (const g of page.groups) {
            if (g.id !== first.groupId && !g.hidden) updateFloorplanGroup(page.id, g.id, { hidden: true });
          }
        })}
        title={t("Leaves only this group on the sheet — one export per trade from the same drawing.")}
      />
      {hiddenGroups.length > 0 && (
        <Item
          label={
            hiddenGroups.length === 1
              ? t("Show the 1 hidden group")
              : t("Show all {n} hidden groups", { n: hiddenGroups.length })
          }
          onClick={() => act(() => {
            for (const g of hiddenGroups) updateFloorplanGroup(page.id, g.id, { hidden: undefined });
          })}
        />
      )}

      <Divider />
      <Item
        label={many ? t("Remove {n} symbols from the plan", { n: symbols.length }) : t("Remove from the plan")}
        danger
        onClick={() => act(() => { for (const id of ids) removeFloorplanSymbol(page.id, id); })}
      />
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

function Item({ label, onClick, danger, title }: { label: string; onClick: () => void; danger?: boolean; title?: string }) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 cursor-pointer ${
        danger
          ? "text-red-600 hover:bg-red-500/10 hover:text-red-700"
          : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );
}
