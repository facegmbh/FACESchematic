import { useMemo, useState } from "react";
import { useSchematicStore } from "../store";
import { resolveDeviceLabel } from "../displayName";
import type { DeviceData, FloorplanPage } from "../types";
import FloorplanSymbolSvg from "./FloorplanSymbolSvg";
import type { Selection } from "./FloorplanRenderer";
import { useT } from "../i18n";

/** MIME type carrying a device node id from this sidebar to the sheet. */
export const FLOORPLAN_DEVICE_MIME = "application/x-floorplan-device-id";

interface Props {
  page: FloorplanPage;
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
}

/** Left panel of a floorplan page — the library: what is already on the plan, and the
 *  schematic's devices still to place. Clicking a row selects that symbol on the sheet,
 *  which is what the options panel on the right then edits. Everything about how the plan
 *  reads (groups, numbering, legend, drawing block) lives on the right.
 *
 *  Same frame as the schematic's device library: theme surface, header with a collapse
 *  button, search on top, folding to a narrow rail. */
export default function FloorplanSidebar({ page, selection, onSelectionChange }: Props) {
  const t = useT();
  const nodes = useSchematicStore((s) => s.nodes);
  const useShortNames = useSchematicStore((s) => s.useShortNames);

  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const groupById = useMemo(() => new Map(page.groups.map((g) => [g.id, g])), [page.groups]);
  const deviceLabelFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) {
      if (n.type !== "device") continue;
      m.set(n.id, resolveDeviceLabel(n.data as DeviceData, { useShortNames, wrapDeviceLabels: false }).text);
    }
    return m;
  }, [nodes, useShortNames]);

  const placedByNodeId = useMemo(() => {
    const m = new Map<string, string>(); // device node id → symbol label
    for (const sym of page.symbols) if (sym.deviceNodeId) m.set(sym.deviceNodeId, sym.label);
    return m;
  }, [page.symbols]);

  const query = search.trim().toLowerCase();

  // What is already on this plan, newest last — the plan's own contents.
  const placed = useMemo(() => {
    return page.symbols.filter((sym) => {
      if (!query) return true;
      const device = sym.deviceNodeId ? deviceLabelFor.get(sym.deviceNodeId) ?? "" : "";
      const group = groupById.get(sym.groupId)?.label ?? "";
      return sym.label.toLowerCase().includes(query)
        || device.toLowerCase().includes(query)
        || group.toLowerCase().includes(query)
        || (sym.lineNo ?? "").toLowerCase().includes(query);
    });
  }, [page.symbols, query, deviceLabelFor, groupById]);

  // Schematic devices still to place. A device already on the plan stays listed — dragging
  // it again places a second symbol for the same device.
  const devices = useMemo(() => {
    return nodes
      .filter((n) => n.type === "device" && (n.data as DeviceData).deviceType !== "adapter")
      .filter((n) => {
        if (!query) return true;
        const d = n.data as DeviceData;
        return d.label.toLowerCase().includes(query)
          || (d.manufacturer?.toLowerCase().includes(query) ?? false)
          || (d.modelNumber?.toLowerCase().includes(query) ?? false)
          || d.deviceType.toLowerCase().includes(query);
      });
  }, [nodes, query]);

  const selectedIds = selection.kind === "symbols" ? selection.ids : [];

  if (collapsed) {
    return (
      <div className="w-8 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col items-center h-full" data-print-hide>
        <button
          onClick={() => setCollapsed(false)}
          className="py-3 cursor-pointer hover:bg-[var(--color-surface-hover)] w-full flex justify-center transition-colors"
          title={t("Show what is on the plan and the devices to place")}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
        <div
          className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mt-2 select-none"
          style={{ writingMode: "vertical-rl" }}
        >
          {t("Plan")}
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col h-full overflow-hidden text-xs" data-print-hide>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider">
          {t("Plan")}
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="cursor-pointer hover:bg-[var(--color-surface-hover)] rounded p-0.5 transition-colors"
          title={t("Collapse")}
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 3l-5 5 5 5" />
          </svg>
        </button>
      </div>

      {/* Search — filters both lists below */}
      <div className="px-2 pt-2 pb-1.5">
        <div className="relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="w-full pl-7 pr-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
            placeholder={t("Search plan and devices…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" data-allow-scroll>
        {/* ── On the plan ────────────────────────────────────────────── */}
        <div className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>
          {t("On the plan ({n})", { n: page.symbols.length })}
        </div>
        <div className="px-1 pb-2">
          {page.symbols.length === 0 ? (
            <p className="px-1 text-[var(--color-text-muted)] leading-snug">
              {t("Nothing placed yet. Drag a device from the list below onto the sheet, or use the Place tool.")}
            </p>
          ) : placed.length === 0 ? (
            <p className="px-1 text-[var(--color-text-muted)]">{t("No symbol matches the search.")}</p>
          ) : placed.map((sym) => {
            const group = groupById.get(sym.groupId);
            const device = sym.deviceNodeId ? deviceLabelFor.get(sym.deviceNodeId) : undefined;
            const isSelected = selectedIds.includes(sym.id);
            return (
              <button
                key={sym.id}
                className={`w-full flex items-center gap-1.5 px-1.5 py-1 mb-0.5 rounded border text-left ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-transparent hover:bg-[var(--color-surface-hover)]"
                }`}
                onClick={(e) => {
                  // Shift or ⌘/Ctrl extends the selection, exactly like on the sheet.
                  const extend = e.shiftKey || e.metaKey || e.ctrlKey;
                  const next = extend
                    ? (isSelected ? selectedIds.filter((id) => id !== sym.id) : [...selectedIds, sym.id])
                    : [sym.id];
                  onSelectionChange(next.length > 0 ? { kind: "symbols", ids: next } : { kind: "none" });
                }}
                title={[sym.label, device, group?.hidden ? t("group switched off") : undefined].filter(Boolean).join(" · ")}
              >
                {group && <FloorplanSymbolSvg group={group} sizePx={12} paddingPx={1} className={group.hidden ? "shrink-0 opacity-40" : "shrink-0"} rotationDeg={sym.rotationDeg} symbolSizeMm={page.symbolSizeMm} />}
                <span className={`shrink-0 font-semibold ${group?.hidden ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]"}`}>{sym.label}</span>
                <span className="truncate text-[var(--color-text-muted)]">{device ?? group?.label ?? ""}</span>
                {group?.hidden && <span className="ml-auto shrink-0 text-[var(--color-text-muted)]" style={{ fontSize: 9 }} title={t("Its group is switched off — not on the sheet, not in the export")}>{t("hidden")}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Devices to place ───────────────────────────────────────── */}
        <div className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider border-t border-[var(--color-border)]" style={{ fontSize: 9 }}>
          {t("Devices — drag onto the plan")}
        </div>
        <div className="px-1 pb-4">
          {devices.length === 0 ? (
            <p className="px-1 text-[var(--color-text-muted)]">{t("No devices on the schematic yet.")}</p>
          ) : devices.map((node) => {
            const data = node.data as DeviceData;
            const resolved = resolveDeviceLabel(data, { useShortNames, wrapDeviceLabels: false });
            const placedLabel = placedByNodeId.get(node.id);
            return (
              <div
                key={node.id}
                className={`flex items-center justify-between gap-1 px-2 py-1 mb-0.5 rounded border cursor-grab ${
                  placedLabel
                    ? "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:border-emerald-400"
                }`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(FLOORPLAN_DEVICE_MIME, node.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                title={placedLabel ? t("Already on this plan as {label} — drag to place a second symbol", { label: placedLabel }) : data.label}
              >
                <span className="truncate">{resolved.text}</span>
                {placedLabel && <span className="shrink-0 text-emerald-600" style={{ fontSize: 10 }}>{placedLabel}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
