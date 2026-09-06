import { useMemo, useRef, useState } from "react";
import { useSchematicStore, loadSpecLookup } from "../store";
import { resolveDeviceLabel } from "../displayName";
import { FLOORPLAN_GROUP_COLORS, FLOORPLAN_SYMBOL_SHAPE_LABELS, effectiveLabelTemplate } from "../floorplan";
import { computeLineLoads } from "../speakerLines";
import { importLegendImage, importSymbolImage } from "../floorplanUnderlay";
import { getTemplateById } from "../templateApi";
import { FLOORPLAN_SYMBOL_SHAPES } from "../types";
import type { DeviceData, FloorplanPage, FloorplanSymbolGroup } from "../types";
import FloorplanSymbolSvg from "./FloorplanSymbolSvg";

/** MIME type carrying a device node id from this sidebar to the sheet. */
export const FLOORPLAN_DEVICE_MIME = "application/x-floorplan-device-id";

interface Props {
  page: FloorplanPage;
  activeGroupId: string | null;
  onActiveGroupChange: (groupId: string | null) => void;
  /** Amplifier line the next symbols are numbered on ("4" → 4.1, 4.2 …). */
  activeLine: string;
  onActiveLineChange: (line: string) => void;
}

/** Left panel of a floorplan page — what you place: the symbol groups (legend rows), the
 *  numbering the next symbols take, and the schematic's devices to drag onto the sheet.
 *  Same frame as the schematic's device library: theme surface, header with a collapse
 *  button, search on top, collapsing to a narrow rail. Plan settings (lines, legend,
 *  drawing block, notes) live in the FloorplanOptionsPanel on the right. */
export default function FloorplanSidebar({ page, activeGroupId, onActiveGroupChange, activeLine, onActiveLineChange }: Props) {
  const nodes = useSchematicStore((s) => s.nodes);
  const edges = useSchematicStore((s) => s.edges);
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const addFloorplanGroup = useSchematicStore((s) => s.addFloorplanGroup);
  const updateFloorplanGroup = useSchematicStore((s) => s.updateFloorplanGroup);
  const removeFloorplanGroup = useSchematicStore((s) => s.removeFloorplanGroup);
  const renumberFloorplanGroup = useSchematicStore((s) => s.renumberFloorplanGroup);
  const updateFloorplanPage = useSchematicStore((s) => s.updateFloorplanPage);
  const isLoudspeaker = page.kind === "loudspeaker";
  const customTemplates = useSchematicStore((s) => s.customTemplates);
  const addToast = useSchematicStore((s) => s.addToast);
  const lines = useMemo(() => computeLineLoads(page, nodes, edges, loadSpecLookup({ customTemplates })).rows, [page, nodes, edges, customTemplates]);

  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetGroupRef = useRef<string | null>(null);
  const symbolImageInputRef = useRef<HTMLInputElement>(null);
  const symbolImageTargetRef = useRef<string | null>(null);

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

  const handleSymbolImagePicked = async (file: File | undefined) => {
    const groupId = symbolImageTargetRef.current;
    if (!file || !groupId) return;
    try {
      updateFloorplanGroup(page.id, groupId, { symbolImageSrc: await importSymbolImage(file) });
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Could not load that symbol image.", "error");
    }
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

  if (collapsed) {
    return (
      <div className="w-8 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col items-center h-full" data-print-hide>
        <button
          onClick={() => setCollapsed(false)}
          className="py-3 cursor-pointer hover:bg-[var(--color-surface-hover)] w-full flex justify-center transition-colors"
          title="Show symbol groups and devices"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
        <div
          className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mt-2 select-none"
          style={{ writingMode: "vertical-rl" }}
        >
          Plan
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col h-full overflow-hidden text-xs" data-print-hide>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider">
          Plan
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="cursor-pointer hover:bg-[var(--color-surface-hover)] rounded p-0.5 transition-colors"
          title="Collapse"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 3l-5 5 5 5" />
          </svg>
        </button>
      </div>

      {/* Search — filters the device list below, like the library search */}
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
            placeholder="Search devices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" data-allow-scroll>
      {/* ── Symbol groups ─────────────────────────────────────────── */}
      <div className="px-2 pt-2 pb-1 flex items-center justify-between">
        <span className="font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>
          Symbol Groups
        </span>
        <button
          className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
          onClick={handleAddGroup}
          title="Add a symbol group"
        >
          + Add
        </button>
      </div>

      {page.groups.length === 0 && (
        <p className="px-2 pb-2 text-[var(--color-text-muted)] leading-relaxed">
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
              className={`mb-1 rounded border ${isActive ? "border-emerald-400 bg-emerald-500/10" : "border-[var(--color-border)] bg-[var(--color-bg)]"}`}
            >
              <div className="flex items-center gap-1.5 px-1.5 py-1">
                <button
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  onClick={() => onActiveGroupChange(group.id)}
                  title="Make this the active group for placing symbols"
                >
                  <FloorplanSymbolSvg group={group} sizePx={12} paddingPx={1} className="shrink-0" />
                  <span className="truncate text-[var(--color-text)]">{group.label}</span>
                </button>
                <span className="text-[var(--color-text-muted)] shrink-0" title="Symbols on this plan">
                  {symbolCounts.get(group.id) ?? 0}
                </span>
                <button
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] px-1"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  title="Edit group"
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              </div>

              {isExpanded && (
                <div className="px-1.5 pb-2 flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-1.5">
                  <input
                    className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={group.label}
                    placeholder="Legend title, e.g. Ceiling speakers"
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { label: e.target.value })}
                  />
                  <input
                    className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={group.description ?? ""}
                    placeholder="Model | cable spec"
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { description: e.target.value })}
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={group.color}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { color: e.target.value })}
                      className="w-7 h-6 shrink-0 border border-[var(--color-border)] rounded cursor-pointer"
                      title="Symbol color"
                    />
                    <select
                      className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                      value={group.shape}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { shape: e.target.value as FloorplanSymbolGroup["shape"] })}
                      title="Symbol shape — abstract or a top-view pictogram"
                    >
                      {FLOORPLAN_SYMBOL_SHAPES.map((s) => <option key={s} value={s}>{FLOORPLAN_SYMBOL_SHAPE_LABELS[s]}</option>)}
                    </select>
                    <input
                      className="w-10 shrink-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 text-center"
                      value={group.glyph ?? ""}
                      maxLength={2}
                      placeholder="S"
                      disabled={Boolean(group.symbolImageSrc)}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { glyph: e.target.value.trim() || undefined })}
                      title={group.symbolImageSrc ? "An uploaded symbol carries no glyph — the picture is the symbol" : "Up to two characters drawn inside the symbol"}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => { symbolImageTargetRef.current = group.id; symbolImageInputRef.current?.click(); }}
                      title="Upload your own symbol (PNG, JPG, WebP or SVG). It replaces the shape, the color and the glyph, and prints on the plan and in the legend."
                    >
                      {group.symbolImageSrc ? "Replace symbol…" : "Upload symbol…"}
                    </button>
                    {group.symbolImageSrc && (
                      <button
                        className="px-1 py-0.5 text-[var(--color-text-muted)] hover:text-red-600"
                        onClick={() => updateFloorplanGroup(page.id, group.id, { symbolImageSrc: undefined })}
                        title="Back to the drawn shape"
                      >
                        ✕
                      </button>
                    )}
                    <div className="flex-1" />
                    <label className="flex items-center gap-1 text-[var(--color-text-muted)]" title="Direction new symbols of this group start at, in degrees clockwise. Turn a placed symbol with the Symbol control on the sheet.">
                      <span style={{ fontSize: 10 }}>Turn</span>
                      <input
                        type="number"
                        step={15}
                        className="w-14 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                        value={group.rotationDeg ?? 0}
                        onChange={(e) => updateFloorplanGroup(page.id, group.id, { rotationDeg: Number(e.target.value) || undefined })}
                      />
                      °
                    </label>
                  </div>
                  <input
                    className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={group.labelPrefix ?? ""}
                    placeholder="No. prefix"
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { labelPrefix: e.target.value || undefined })}
                    title="Seed for auto-numbering, e.g. “SB.” or “4.1”"
                  />
                  <div className="flex flex-wrap gap-1">
                    {FLOORPLAN_GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`w-4 h-4 rounded-sm border ${group.color.toLowerCase() === c ? "border-[var(--color-text)]" : "border-[var(--color-border)]"}`}
                        style={{ background: c }}
                        onClick={() => updateFloorplanGroup(page.id, group.id, { color: c })}
                        title={c}
                      />
                    ))}
                  </div>
                  {(() => {
                    const shown = group.imageSrc || group.imageUrl;
                    const templateImage = group.templateId ? getTemplateById(group.templateId, customTemplates)?.imageUrl : undefined;
                    return (
                      <>
                        <div className="flex items-center gap-1.5">
                          {shown && (
                            <img src={shown} alt="" className="w-8 h-8 object-contain border border-[var(--color-border)] rounded bg-[var(--color-surface)]__KEEP" />
                          )}
                          <button
                            className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                            onClick={() => { imageTargetGroupRef.current = group.id; imageInputRef.current?.click(); }}
                            title="Upload a product shot (stored in the project, always printed)"
                          >
                            {group.imageSrc ? "Replace image" : "Upload image…"}
                          </button>
                          {templateImage && !group.imageSrc && group.imageUrl !== templateImage && (
                            <button
                              className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                              onClick={() => updateFloorplanGroup(page.id, group.id, { imageUrl: templateImage })}
                              title="Use the device template's image"
                            >
                              Template image
                            </button>
                          )}
                          {shown && (
                            <button
                              className="px-1 py-0.5 text-[var(--color-text-muted)] hover:text-red-600"
                              onClick={() => updateFloorplanGroup(page.id, group.id, { imageSrc: undefined, imageUrl: undefined, imageCaption: undefined })}
                              title="Remove image"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <input
                          className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                          value={group.imageUrl ?? ""}
                          placeholder="Image URL (template today, Odoo product later)"
                          onChange={(e) => updateFloorplanGroup(page.id, group.id, { imageUrl: e.target.value || undefined })}
                          title="A remote image reference. Shown on screen; the PDF embeds it when the host allows — an uploaded image always wins."
                        />
                      </>
                    );
                  })()}
                  {(group.imageSrc || group.imageUrl) && (
                    <input
                      className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                      value={group.imageCaption ?? ""}
                      placeholder="Image caption, e.g. DM6SE"
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { imageCaption: e.target.value })}
                    />
                  )}
                  <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!group.hiddenInLegend}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { hiddenInLegend: e.target.checked ? undefined : true })}
                    />
                    Show in legend
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
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
                      className="px-1.5 py-0.5 rounded text-red-500 hover:bg-red-500/10 hover:text-red-700"
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
      <input
        ref={symbolImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { void handleSymbolImagePicked(e.target.files?.[0]); e.target.value = ""; }}
      />

      {/* ── Numbering (line.speaker) ─────────────────────────────── */}
      <div className="px-2 pt-3 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>
        Numbering
      </div>
      <div className="px-2 pb-2 flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-[var(--color-text)]" title="Amplifier line / circuit the next symbols hang on. Speakers are numbered per line: 4.1, 4.2 …">
          <span className="shrink-0">Line</span>
          <input
            className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
            value={activeLine}
            placeholder={isLoudspeaker ? "e.g. 4 or SB" : "optional"}
            onChange={(e) => onActiveLineChange(e.target.value)}
            list="floorplan-lines"
          />
          <datalist id="floorplan-lines">
            {lines.map((l) => <option key={l.line.lineNo} value={l.line.lineNo} />)}
          </datalist>
        </label>
        <label className="flex items-center gap-2 text-[var(--color-text)]" title="How labels are composed: {{line}}, {{n}}, {{group}}, {{device}}">
          <span className="shrink-0">Label</span>
          <input
            className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 font-mono"
            value={page.labelTemplate ?? ""}
            placeholder={effectiveLabelTemplate(page)}
            onChange={(e) => updateFloorplanPage(page.id, { labelTemplate: e.target.value || undefined })}
          />
        </label>
        {!isLoudspeaker && !activeLine && (
          <p className="text-[var(--color-text-muted)] leading-snug">Leave the line empty to continue each group's own numbering (1.1 → 1.2). Set a line to number per amplifier line instead.</p>
        )}
      </div>

      {/* ── Devices ───────────────────────────────────────────────── */}
      <div className="px-2 pt-3 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider border-t border-[var(--color-border)]" style={{ fontSize: 9 }}>
        Devices — drag onto the plan
      </div>
      {activeGroupId === null && page.groups.length > 0 && (
        <p className="px-2 pb-1 text-amber-600">Pick a group first.</p>
      )}
      <div className="px-1 pb-2">
        {devices.length === 0 ? (
          <p className="px-1 text-[var(--color-text-muted)]">No devices on the schematic yet.</p>
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
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-emerald-500/100/10 hover:border-emerald-300"
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

      </div>
    </div>
  );
}
