import { useMemo, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import { resolveDeviceLabel } from "../displayName";
import { FLOORPLAN_GROUP_COLORS, drawingAreaMm, formatPlanDate, glyphColorOn, nextDrawingFieldId, nextRevisionIndex } from "../floorplan";
import { importLegendImage } from "../floorplanUnderlay";
import { getTemplateById } from "../templateApi";
import { FLOORPLAN_SYMBOL_SHAPES } from "../types";
import type { DeviceData, FloorplanDrawingBlock, FloorplanPage, FloorplanRevision, FloorplanSymbolGroup } from "../types";
import { FLOORPLAN_TOKENS } from "../types";

/** MIME type carrying a device node id from this sidebar to the sheet. */
export const FLOORPLAN_DEVICE_MIME = "application/x-floorplan-device-id";

interface Props {
  page: FloorplanPage;
  activeGroupId: string | null;
  onActiveGroupChange: (groupId: string | null) => void;
}

/** Miniature of a group's symbol, used in the group list and the device list. */
function SymbolChip({ group, size = 14 }: { group: Pick<FloorplanSymbolGroup, "color" | "shape" | "glyph">; size?: number }) {
  const common = { fill: group.color, stroke: "#00000055", strokeWidth: 0.5 };
  const r = size / 2;
  const glyph = group.glyph?.trim().slice(0, 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {group.shape === "circle" && <circle cx={r} cy={r} r={r - 1} {...common} />}
      {group.shape === "square" && <rect x={1} y={1} width={size - 2} height={size - 2} {...common} />}
      {group.shape === "diamond" && <polygon points={`${r},1 ${size - 1},${r} ${r},${size - 1} 1,${r}`} {...common} />}
      {group.shape === "triangle" && <polygon points={`${r},1 ${size - 1},${size - 1} 1,${size - 1}`} {...common} />}
      {glyph && <text x={r} y={r + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={size * (glyph.length > 1 ? 0.42 : 0.55)} fontWeight={700} fill={glyphColorOn(group.color)}>{glyph}</text>}
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
  const updateFloorplanDrawingBlock = useSchematicStore((s) => s.updateFloorplanDrawingBlock);
  const addFloorplanNote = useSchematicStore((s) => s.addFloorplanNote);
  const updateFloorplanNote = useSchematicStore((s) => s.updateFloorplanNote);
  const removeFloorplanNote = useSchematicStore((s) => s.removeFloorplanNote);
  const removeFloorplanMask = useSchematicStore((s) => s.removeFloorplanMask);
  const customTemplates = useSchematicStore((s) => s.customTemplates);
  const addToast = useSchematicStore((s) => s.addToast);

  const block = page.drawingBlock;
  const patchBlock = (patch: Partial<FloorplanDrawingBlock>) => updateFloorplanDrawingBlock(page.id, patch);
  const patchRevision = (i: number, patch: Partial<FloorplanRevision>) =>
    patchBlock({ revisions: block.revisions.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

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
                      className="w-10 border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 text-center"
                      value={group.glyph ?? ""}
                      maxLength={2}
                      placeholder="S"
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { glyph: e.target.value.trim() || undefined })}
                      title="Up to two characters drawn inside the symbol"
                    />
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
                  {(() => {
                    const shown = group.imageSrc || group.imageUrl;
                    const templateImage = group.templateId ? getTemplateById(group.templateId, customTemplates)?.imageUrl : undefined;
                    return (
                      <>
                        <div className="flex items-center gap-1.5">
                          {shown && (
                            <img src={shown} alt="" className="w-8 h-8 object-contain border border-neutral-200 rounded bg-white" />
                          )}
                          <button
                            className="px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-600 hover:border-emerald-400 hover:text-emerald-700"
                            onClick={() => { imageTargetGroupRef.current = group.id; imageInputRef.current?.click(); }}
                            title="Upload a product shot (stored in the project, always printed)"
                          >
                            {group.imageSrc ? "Replace image" : "Upload image…"}
                          </button>
                          {templateImage && !group.imageSrc && group.imageUrl !== templateImage && (
                            <button
                              className="px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-600 hover:border-emerald-400 hover:text-emerald-700"
                              onClick={() => updateFloorplanGroup(page.id, group.id, { imageUrl: templateImage })}
                              title="Use the device template's image"
                            >
                              Template image
                            </button>
                          )}
                          {shown && (
                            <button
                              className="px-1 py-0.5 text-neutral-400 hover:text-red-600"
                              onClick={() => updateFloorplanGroup(page.id, group.id, { imageSrc: undefined, imageUrl: undefined, imageCaption: undefined })}
                              title="Remove image"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <input
                          className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
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
        <label className="flex items-center gap-1 text-neutral-600 cursor-pointer" title="Logo, name, address and contact from Preferences → Company">
          <input
            type="checkbox"
            checked={page.legend.showCompany !== false}
            onChange={(e) => updateFloorplanLegend(page.id, { showCompany: e.target.checked })}
          />
          Company block (logo, address)
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

      {/* ── Drawing block (Plankopf) ──────────────────────────────── */}
      <details className="border-t border-neutral-200" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Drawing Block
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={block.visible} onChange={(e) => patchBlock({ visible: e.target.checked })} />
            Show drawing block on the sheet
          </label>
          <input
            className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400 font-semibold"
            value={block.title}
            placeholder="Drawing title, e.g. Ground floor"
            onChange={(e) => patchBlock({ title: e.target.value })}
            title="Tokens: {{pageLabel}}, {{showName}}, {{scale}} …"
          />
          <input
            className="w-full border border-neutral-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
            value={block.subtitle ?? ""}
            placeholder="Subtitle, e.g. Loudspeaker layout"
            onChange={(e) => patchBlock({ subtitle: e.target.value })}
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-neutral-500 uppercase tracking-wider" style={{ fontSize: 9 }}>Fields</span>
            <button
              className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
              onClick={() => patchBlock({ fields: [...block.fields, { id: nextDrawingFieldId(), label: "Field", value: "" }] })}
            >
              + Field
            </button>
          </div>
          {block.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1">
              <input
                className="w-[38%] border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 uppercase"
                style={{ fontSize: 10 }}
                value={f.label}
                placeholder="Label"
                onChange={(e) => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <textarea
                className="flex-1 min-w-0 border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 resize-none leading-tight"
                rows={Math.max(1, Math.min(4, f.value.split("\n").length))}
                value={f.value}
                placeholder="Value or {{token}}"
                title="Multi-line values (addresses) wrap onto several lines in the block"
                onChange={(e) => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                data-allow-scroll
              />
              <button
                className={`px-1 rounded border ${f.wide ? "border-emerald-400 text-emerald-700 bg-emerald-50" : "border-neutral-200 text-neutral-400"}`}
                title="Span both columns"
                onClick={() => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, wide: !x.wide } : x)) })}
              >
                ⟷
              </button>
              <button
                className="px-1 text-neutral-400 hover:text-red-600"
                title="Remove field"
                onClick={() => patchBlock({ fields: block.fields.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <p className="text-neutral-400 leading-snug" style={{ fontSize: 10 }}>
            Tokens: {FLOORPLAN_TOKENS.map((t) => `{{${t}}}`).join(" ")} — resolved from the project title block and the page.
          </p>

          <div className="flex items-center justify-between pt-1">
            <span className="text-neutral-500 uppercase tracking-wider" style={{ fontSize: 9 }}>Revisions</span>
            <button
              className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
              onClick={() => patchBlock({
                revisions: [...block.revisions, { index: nextRevisionIndex(block.revisions), date: formatPlanDate(), description: "", author: "", checkedBy: "" }],
              })}
            >
              + Revision
            </button>
          </div>
          <div className="flex gap-1 text-neutral-400 uppercase" style={{ fontSize: 9 }}>
            {block.revisionHeaders.map((h, i) => (
              <input
                key={i}
                className="border border-transparent hover:border-neutral-200 rounded px-1 outline-none focus:border-emerald-400 bg-transparent min-w-0"
                style={{ width: i === 2 ? "38%" : "15%", fontSize: 9 }}
                value={h}
                onChange={(e) => {
                  const headers = [...block.revisionHeaders] as FloorplanDrawingBlock["revisionHeaders"];
                  headers[i] = e.target.value;
                  patchBlock({ revisionHeaders: headers });
                }}
                title="Column header"
              />
            ))}
          </div>
          {block.revisions.map((r, i) => (
            <div key={i} className="flex gap-1 items-center">
              <input className="border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 min-w-0" style={{ width: "15%" }} value={r.index} onChange={(e) => patchRevision(i, { index: e.target.value })} title="Index" />
              <input className="border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 min-w-0" style={{ width: "15%" }} value={r.date} onChange={(e) => patchRevision(i, { date: e.target.value })} title="Date" />
              <input className="border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 min-w-0 flex-1" value={r.description} placeholder="Change" onChange={(e) => patchRevision(i, { description: e.target.value })} title="Change" />
              <input className="border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 min-w-0" style={{ width: "11%" }} value={r.author ?? ""} placeholder="By" onChange={(e) => patchRevision(i, { author: e.target.value })} title="Drawn by" />
              <input className="border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400 min-w-0" style={{ width: "11%" }} value={r.checkedBy ?? ""} placeholder="Chk" onChange={(e) => patchRevision(i, { checkedBy: e.target.value })} title="Checked by" />
              <button className="px-1 text-neutral-400 hover:text-red-600" title="Remove revision" onClick={() => patchBlock({ revisions: block.revisions.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}

          <textarea
            className="w-full border border-neutral-200 rounded px-1.5 py-1 outline-none focus:border-emerald-400 resize-y mt-1"
            rows={3}
            value={block.disclaimer ?? ""}
            placeholder="Small print above the title, e.g. “All dimensions to be verified on site …”"
            onChange={(e) => patchBlock({ disclaimer: e.target.value })}
            data-allow-scroll
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-neutral-600 cursor-pointer">
              <input type="checkbox" checked={block.showLogo} onChange={(e) => patchBlock({ showLogo: e.target.checked })} />
              Logo
            </label>
            <label className="flex items-center gap-1 text-neutral-600 cursor-pointer">
              <input type="checkbox" checked={block.showNorthArrow} onChange={(e) => patchBlock({ showNorthArrow: e.target.checked })} />
              North arrow
            </label>
            {block.showNorthArrow && (
              <label className="flex items-center gap-1 text-neutral-600" title="North arrow rotation (° clockwise)">
                <input
                  type="number"
                  className="w-14 border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400"
                  value={block.northRotationDeg}
                  step={5}
                  onChange={(e) => patchBlock({ northRotationDeg: Number(e.target.value) || 0 })}
                />
                °
              </label>
            )}
          </div>
        </div>
      </details>

      {/* ── Covers (erased parts of the underlay) ─────────────────── */}
      <details className="border-t border-neutral-200">
        <summary className="px-2 pt-2 pb-1 font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Erased areas ({page.masks.length})
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1">
          <p className="text-neutral-400 leading-snug">
            White covers over the architect&apos;s plan — use <strong>▭ Erase</strong> on the sheet to drag one out over a
            legend, a note or a title block you want gone. Drag to move, corner to resize, <kbd>Delete</kbd> to remove.
          </p>
          {page.masks.map((m, i) => (
            <div key={m.id} className="flex items-center justify-between text-neutral-600 border border-neutral-200 rounded px-1.5 py-0.5">
              <span>Cover {i + 1} · {Math.round(m.sizeMm.w)} × {Math.round(m.sizeMm.h)} mm</span>
              <button className="px-1 text-neutral-400 hover:text-red-600" onClick={() => removeFloorplanMask(page.id, m.id)} title="Remove cover">✕</button>
            </div>
          ))}
        </div>
      </details>

      {/* ── Notes on the plan ─────────────────────────────────────── */}
      <details className="border-t border-neutral-200" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Notes on the plan ({page.notes.length})
        </summary>
        <div className="px-2 pb-4 flex flex-col gap-1.5">
          <button
            className="self-start px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
            onClick={() => {
              const area = drawingAreaMm(page);
              addFloorplanNote(page.id, { positionMm: { x: area.x + area.w / 2 - 30, y: area.y + area.h / 2 }, text: "Note", boxed: true });
            }}
            title="Adds a note at the sheet center — or use the ✎ Note tool to click it into place"
          >
            + Note
          </button>
          {page.notes.map((n) => (
            <div key={n.id} className="border border-neutral-200 rounded p-1.5 flex flex-col gap-1">
              <textarea
                className="w-full border border-neutral-200 rounded px-1.5 py-1 outline-none focus:border-emerald-400 resize-y"
                rows={2}
                value={n.text}
                onChange={(e) => updateFloorplanNote(page.id, n.id, { text: e.target.value })}
                data-allow-scroll
              />
              <div className="flex items-center gap-2 text-neutral-600">
                <label className="flex items-center gap-1" title="Font size (mm)">
                  <input type="number" className="w-12 border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-emerald-400" min={1} max={20} step={0.2} value={n.fontSizeMm} onChange={(e) => updateFloorplanNote(page.id, n.id, { fontSizeMm: Number(e.target.value) || 2.8 })} />
                  mm
                </label>
                <input type="color" className="w-6 h-5 border border-neutral-200 rounded cursor-pointer" value={n.color ?? "#111111"} onChange={(e) => updateFloorplanNote(page.id, n.id, { color: e.target.value })} title="Text color" />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={Boolean(n.boxed)} onChange={(e) => updateFloorplanNote(page.id, n.id, { boxed: e.target.checked })} />
                  Box
                </label>
                <div className="flex-1" />
                <button className="px-1 text-neutral-400 hover:text-red-600" onClick={() => removeFloorplanNote(page.id, n.id)} title="Delete note">✕</button>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
