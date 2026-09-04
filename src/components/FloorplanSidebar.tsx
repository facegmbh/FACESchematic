import { useMemo, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import { resolveDeviceLabel } from "../displayName";
import { FLOORPLAN_GROUP_COLORS } from "../floorplan";
import { importLegendImage } from "../floorplanUnderlay";
import { FLOORPLAN_SYMBOL_SHAPES } from "../types";
import type { DeviceData, FloorplanPage, FloorplanSymbolGroup } from "../types";

/** MIME type carrying a device node id from this sidebar to the sheet. */
export const FLOORPLAN_DEVICE_MIME = "application/x-floorplan-device-id";

interface Props {
  page: FloorplanPage;
  activeGroupId: string | null;
  onActiveGroupChange: (groupId: string | null) => void;
}

/** Miniature of a group's symbol, used in the group list and the device list. */
function SymbolChip({ group, size = 14 }: { group: Pick<FloorplanSymbolGroup, "color" | "shape">; size?: number }) {
  const common = { fill: group.color, stroke: "#00000055", strokeWidth: 0.5 };
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {group.shape === "circle" && <circle cx={r} cy={r} r={r - 1} {...common} />}
      {group.shape === "square" && <rect x={1} y={1} width={size - 2} height={size - 2} {...common} />}
      {group.shape === "diamond" && <polygon points={`${r},1 ${size - 1},${r} ${r},${size - 1} 1,${r}`} {...common} />}
      {group.shape === "triangle" && <polygon points={`${r},1 ${size - 1},${size - 1} 1,${size - 1}`} {...common} />}
    </svg>
  );
}

export default function FloorplanSidebar({ page, activeGroupId, onActiveGroupChange }: Props) {
  const nodes = useSchematicStore((s) => s.nodes);
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const addFloorplanGroup = useSchematicStore((s) => s.addFloorplanGroup);
  const updateFloorplanGroup = useSchematicStore((s) => s.updateFloorplanGroup);
  const removeFloorplanGroup = useSchematicStore((s) => s.removeFloorplanGroup);
  const renumberFloorplanGroup = useSchematicStore((s) => s.renumberFloorplanGroup);
  const updateFloorplanLegend = useSchematicStore((s) => s.updateFloorplanLegend);
  const addToast = useSchematicStore((s) => s.addToast);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetGroupRef = useRef<string | null>(null);

  const placedByNodeId = useMemo(() => {
    const m = new Map<string, string>(); // device node id → symbol label
    for (const sym of page.symbols) if (sym.deviceNodeId) m.set(sym.deviceNodeId, sym.label);
    return m;
  }, [page.symbols]);

  const symbolCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const sym of page.symbols) m.set(sym.groupId, (m.get(sym.groupId) ?? 0) + 1);
    return m;
  }, [page.symbols]);

  const devices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes
      .filter((n) => n.type === "device" && (n.data as DeviceData).deviceType !== "adapter")
      .filter((n) => {
        if (!q) return true;
        const d = n.data as DeviceData;
        return d.label.toLowerCase().includes(q)
          || (d.manufacturer?.toLowerCase().includes(q) ?? false)
          || (d.modelNumber?.toLowerCase().includes(q) ?? false)
          || d.deviceType.toLowerCase().includes(q);
      });
  }, [nodes, search]);

  const handleAddGroup = () => {
    const id = addFloorplanGroup(page.id, {});
    onActiveGroupChange(id);
    setExpandedGroupId(id);
  };

  const handleImagePicked = async (file: File | undefined) => {
    const groupId = imageTargetGroupRef.current;
    if (!file || !groupId) return;
    try {
      const src = await importLegendImage(file);
      updateFloorplanGroup(page.id, groupId, { imageSrc: src });
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Could not load that image.", "error");
    }
  };

  const notesText = (page.legend.notes ?? []).join("\n");

  return (
    <div className="w-64 bg-white border-r border-neutral-300 flex flex-col text-xs overflow-y-auto" data-print-hide data-allow-scroll>
      {/* ── Symbol groups ─────────────────────────────────────────── */}
      <div className="px-2 pt-2 pb-1 flex items-center justify-between">
        <span className="font-semibold text-neutral-500 uppercase tracking-wider" style={{ fontSize: 9 }}>
          Symbol Groups
        </span>
        <button
          className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
          onClick={handleAddGroup}
          title="Add a symbol group"
        >
          + Add
        </button>
      </div>

      {page.groups.length === 0 && (
        <p className="px-2 pb-2 text-neutral-400 leading-relaxed">
          A group is one legend row — a color, a shape and the model it stands for. Add one,
          then drag devices onto the plan.
        </p>
      )}

      <div className="px-1">
        {page.groups.map((group) => {
          const isActive = group.id === activeGroupId;
          const isExpanded = group.id === expandedGroupId;
          return (
            <div
              key={group.id}
              className={`mb-1 rounded border ${isActive ? "border-emerald-400 bg-emerald-50" : "border-neutral-200 bg-white"}`}
            >
              <div className="flex items-center gap-1.5 px-1.5 py-1">
                <button
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  onClick={() => onActiveGroupChange(group.id)}
                  title="Make this the active group for placing symbols"
                >
                  <SymbolChip group={group} />
                  <span className="truncate text-neutral-700">{group.label}</span>
                </button>
                <span className="text-neutral-400 shrink-0" title="Symbols on this plan">
                  {symbolCounts.get(group.id) ?? 0}
                </span>
                <button
                  className="text-neutral-400 hover:text-neutral-700 px-1"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  title="Edit group"
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              </div>

              {isExpanded && (
                <div className="px-1.5 pb-2 flex flex-col gap-1.5 border-t border-neutral-100 pt-1.5">
                  <input
                    className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
                    value={group.label}
                    placeholder="Legend title, e.g. Ceiling speakers"
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { label: e.target.value })}
                  />
                  <input
                    className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
                    value={group.description ?? ""}
                    placeholder="Model | cable spec"
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { description: e.target.value })}
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={group.color}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { color: e.target.value })}
                      className="w-7 h-6 border border-neutral-200 rounded cursor-pointer"
                      title="Symbol color"
                    />
                    <select
                      className="border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400"
                      value={group.shape}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { shape: e.target.value as FloorplanSymbolGroup["shape"] })}
                      title="Symbol shape"
                    >
                      {FLOORPLAN_SYMBOL_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                      className="flex-1 min-w-0 border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
                      value={group.labelPrefix ?? ""}
                      placeholder="No. prefix"
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { labelPrefix: e.target.value || undefined })}
                      title="Seed for auto-numbering, e.g. “SB.” or “4.1”"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FLOORPLAN_GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`w-4 h-4 rounded-sm border ${group.color.toLowerCase() === c ? "border-neutral-700" : "border-neutral-300"}`}
                        style={{ background: c }}
                        onClick={() => updateFloorplanGroup(page.id, group.id, { color: c })}
                        title={c}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {group.imageSrc && (
                      <img src={group.imageSrc} alt="" className="w-8 h-8 object-contain border border-neutral-200 rounded bg-white" />
                    )}
                    <button
                      className="px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-600 hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => { imageTargetGroupRef.current = group.id; imageInputRef.current?.click(); }}
                    >
                      {group.imageSrc ? "Replace image" : "Product image…"}
                    </button>
                    {group.imageSrc && (
                      <button
                        className="px-1 py-0.5 text-neutral-400 hover:text-red-600"
                        onClick={() => updateFloorplanGroup(page.id, group.id, { imageSrc: undefined, imageCaption: undefined })}
                        title="Remove image"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {group.imageSrc && (
                    <input
                      className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
                      value={group.imageCaption ?? ""}
                      placeholder="Image caption, e.g. DM6SE"
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { imageCaption: e.target.value })}
                    />
                  )}
                  <label className="flex items-center gap-1 text-neutral-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!group.hiddenInLegend}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { hiddenInLegend: e.target.checked ? undefined : true })}
                    />
                    Show in legend
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-600 hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => {
                        const start = prompt("Renumber this group starting at:", group.labelPrefix ?? "1.1");
                        if (start?.trim()) renumberFloorplanGroup(page.id, group.id, start.trim());
                      }}
                      title="Renumber every symbol of this group in placement order"
                    >
                      Renumber
                    </button>
                    <div className="flex-1" />
                    <button
                      className="px-1.5 py-0.5 rounded text-red-500 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        const count = symbolCounts.get(group.id) ?? 0;
                        if (count > 0 && !confirm(`Delete “${group.label}” and its ${count} symbol${count > 1 ? "s" : ""} on this plan?`)) return;
                        removeFloorplanGroup(page.id, group.id);
                        setExpandedGroupId(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { void handleImagePicked(e.target.files?.[0]); e.target.value = ""; }}
      />

      {/* ── Devices ───────────────────────────────────────────────── */}
      <div className="px-2 pt-3 pb-1 font-semibold text-neutral-500 uppercase tracking-wider" style={{ fontSize: 9 }}>
        Devices — drag onto the plan
      </div>
      <div className="px-2 pb-1">
        <input
          className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
          placeholder="Search devices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {activeGroupId === null && page.groups.length > 0 && (
        <p className="px-2 pb-1 text-amber-600">Pick a group first.</p>
      )}
      <div className="px-1 pb-2">
        {devices.length === 0 ? (
          <p className="px-1 text-neutral-400">No devices on the schematic yet.</p>
        ) : devices.map((node) => {
          const data = node.data as DeviceData;
          const resolved = resolveDeviceLabel(data, { useShortNames, wrapDeviceLabels: false });
          const placedLabel = placedByNodeId.get(node.id);
          return (
            <div
              key={node.id}
              className={`flex items-center justify-between gap-1 px-2 py-1 mb-0.5 rounded border cursor-grab ${
                placedLabel
                  ? "bg-neutral-50 border-neutral-200 text-neutral-400"
                  : "bg-white border-neutral-200 text-neutral-700 hover:bg-emerald-50 hover:border-emerald-300"
              }`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(FLOORPLAN_DEVICE_MIME, node.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              title={placedLabel ? `Already on this plan as ${placedLabel} — drag to place a second symbol` : data.label}
            >
              <span className="truncate">{resolved.text}</span>
              {placedLabel && <span className="shrink-0 text-emerald-600" style={{ fontSize: 10 }}>{placedLabel}</span>}
            </div>
          );
        })}
      </div>

      {/* ── Legend box ────────────────────────────────────────────── */}
      <div className="px-2 pt-2 pb-1 font-semibold text-neutral-500 uppercase tracking-wider border-t border-neutral-200" style={{ fontSize: 9 }}>
        Legend Box
      </div>
      <div className="px-2 pb-4 flex flex-col gap-1.5">
        <label className="flex items-center gap-1 text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.visible}
            onChange={(e) => updateFloorplanLegend(page.id, { visible: e.target.checked })}
          />
          Show legend on the sheet
        </label>
        <input
          className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
          value={page.legend.title}
          placeholder="Legend title"
          onChange={(e) => updateFloorplanLegend(page.id, { title: e.target.value })}
        />
        <label className="flex items-center gap-1 text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.showImages}
            onChange={(e) => updateFloorplanLegend(page.id, { showImages: e.target.checked })}
          />
          Product images
        </label>
        <label className="flex items-center gap-1 text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.onlyUsedGroups}
            onChange={(e) => updateFloorplanLegend(page.id, { onlyUsedGroups: e.target.checked })}
          />
          Only groups used on this plan
        </label>
        <input
          className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
          value={page.legend.notesTitle ?? ""}
          placeholder="Notes heading"
          onChange={(e) => updateFloorplanLegend(page.id, { notesTitle: e.target.value })}
        />
        <textarea
          className="w-full border border-neutral-200 rounded px-1.5 py-1 outline-none focus:border-emerald-400 resize-y"
          rows={5}
          value={notesText}
          placeholder="One installation note per line"
          onChange={(e) => updateFloorplanLegend(page.id, { notes: e.target.value.split("\n") })}
          data-allow-scroll
        />
      </div>
    </div>
  );
}
