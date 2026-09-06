import { useMemo, useRef, useState } from "react";
import { useSchematicStore, loadSpecLookup } from "../store";
import { DEFAULT_LEGEND_LINES_TITLE, FLOORPLAN_GROUP_COLORS, FLOORPLAN_SYMBOL_SHAPE_LABELS, LABEL_POSITIONS, drawingAreaMm, effectiveLabelTemplate, formatPlanDate, labelPlacementFor, nextDrawingFieldId, nextRevisionIndex, type LabelPosition } from "../floorplan";
import { channelShortLabel, computeLineLoads, legendShowsLines, type LineLoadRow } from "../speakerLines";
import { LINE_MODE_LABELS, LOAD_LIMITER_LABELS, LOAD_STATUS_LABELS, defaultTapW, formatHeadroom, formatOhm, formatWatt, type LoadStatus } from "../speakerLoad";
import { FLOORPLAN_SYMBOL_SHAPES, SPEAKER_LINE_MODES } from "../types";
import type { DeviceData, FloorplanDrawingBlock, FloorplanPage, FloorplanRevision, FloorplanSymbolGroup, SpeakerLineMode } from "../types";
import { importLegendImage, importSymbolImage } from "../floorplanUnderlay";
import { getTemplateById } from "../templateApi";
import FloorplanSymbolSvg from "./FloorplanSymbolSvg";
import type { Selection } from "./FloorplanRenderer";
import { FLOORPLAN_TOKENS } from "../types";

interface Props {
  page: FloorplanPage;
  /** Amplifier line the next symbols are numbered on — a line card can make itself active. */
  activeLine: string;
  onActiveLineChange: (line: string) => void;
  /** Group new symbols are placed into. */
  activeGroupId: string | null;
  onActiveGroupChange: (groupId: string | null) => void;
  /** What is selected on the sheet — the panel edits it at the top. */
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
}

const STATUS_CLASS: Record<LoadStatus, string> = {
  ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
  nearing: "bg-amber-100 text-amber-800 border-amber-200",
  exceeds: "bg-red-100 text-red-800 border-red-200",
  unsupported: "bg-red-100 text-red-800 border-red-200",
  "no-data": "bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]",
  empty: "bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]",
};

function StatusBadge({ status, title }: { status: LoadStatus; title?: string }) {
  return (
    <span className={`shrink-0 px-1 rounded border ${STATUS_CLASS[status]}`} style={{ fontSize: 9 }} title={title}>
      {LOAD_STATUS_LABELS[status]}
    </span>
  );
}

/** Right panel of a floorplan page — everything about what a symbol is and how the sheet
 *  reads. Selecting a symbol (on the sheet or in the left list) opens its properties at the
 *  top: its number, which group it belongs to, how that group's symbol looks, which way it
 *  faces, where its label sits. Below that sit the symbol groups, the numbering, the
 *  amplifier lines, the legend box, the drawing block (Plankopf), erased areas and notes.
 *  Mirrors the schematic's view-options panel: theme surface, collapsible sections, folds
 *  to a rail. */
export default function FloorplanOptionsPanel({ page, activeLine, onActiveLineChange, activeGroupId, onActiveGroupChange, selection, onSelectionChange }: Props) {
  const nodes = useSchematicStore((s) => s.nodes);
  const edges = useSchematicStore((s) => s.edges);
  const syncFloorplanLines = useSchematicStore((s) => s.syncFloorplanLines);
  const updateFloorplanLine = useSchematicStore((s) => s.updateFloorplanLine);
  const removeFloorplanLine = useSchematicStore((s) => s.removeFloorplanLine);
  const renumberFloorplanLine = useSchematicStore((s) => s.renumberFloorplanLine);
  const updateFloorplanLegend = useSchematicStore((s) => s.updateFloorplanLegend);
  const updateFloorplanDrawingBlock = useSchematicStore((s) => s.updateFloorplanDrawingBlock);
  const addFloorplanNote = useSchematicStore((s) => s.addFloorplanNote);
  const updateFloorplanNote = useSchematicStore((s) => s.updateFloorplanNote);
  const removeFloorplanNote = useSchematicStore((s) => s.removeFloorplanNote);
  const removeFloorplanMask = useSchematicStore((s) => s.removeFloorplanMask);
  const addFloorplanGroup = useSchematicStore((s) => s.addFloorplanGroup);
  const updateFloorplanGroup = useSchematicStore((s) => s.updateFloorplanGroup);
  const removeFloorplanGroup = useSchematicStore((s) => s.removeFloorplanGroup);
  const renumberFloorplanGroup = useSchematicStore((s) => s.renumberFloorplanGroup);
  const updateFloorplanPage = useSchematicStore((s) => s.updateFloorplanPage);
  const updateFloorplanSymbol = useSchematicStore((s) => s.updateFloorplanSymbol);
  const updateFloorplanSymbols = useSchematicStore((s) => s.updateFloorplanSymbols);
  const removeFloorplanSymbol = useSchematicStore((s) => s.removeFloorplanSymbol);
  const customTemplates = useSchematicStore((s) => s.customTemplates);
  const addToast = useSchematicStore((s) => s.addToast);
  const lineReport = useMemo(() => computeLineLoads(page, nodes, edges, loadSpecLookup({ customTemplates })), [page, nodes, edges, customTemplates]);
  const lines = lineReport.rows;
  const channelOptions = useMemo(
    () => lineReport.schematicAmps.flatMap((amp) => amp.channels.map((ch) => ({ key: `${ch.ampNodeId}::${ch.portId}`, ch, label: `${amp.label} · ${channelShortLabel(ch)} (${ch.speakerNodeIds.length})` }))),
    [lineReport.schematicAmps],
  );
  const specLookup = useMemo(() => loadSpecLookup({ customTemplates }), [customTemplates]);
  const handleSyncLines = () => {
    const res = syncFloorplanLines(page.id);
    if (lineReport.schematicAmps.length === 0) addToast("No amplifier with speaker-level outputs on the schematic.", "info");
    else if (res.addedLineNos.length === 0 && res.relabeledCount === 0) addToast("Lines already match the schematic.", "info");
    else addToast(`${res.addedLineNos.length} line${res.addedLineNos.length === 1 ? "" : "s"} added, ${res.relabeledCount} symbol${res.relabeledCount === 1 ? "" : "s"} renumbered.`, "success");
  };

  const block = page.drawingBlock;
  const patchBlock = (patch: Partial<FloorplanDrawingBlock>) => updateFloorplanDrawingBlock(page.id, patch);
  const patchRevision = (i: number, patch: Partial<FloorplanRevision>) =>
    patchBlock({ revisions: block.revisions.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const notesText = (page.legend.notes ?? []).join("\n");

  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetGroupRef = useRef<string | null>(null);
  const symbolImageInputRef = useRef<HTMLInputElement>(null);
  const symbolImageTargetRef = useRef<string | null>(null);
  const isLoudspeaker = page.kind === "loudspeaker";

  const symbolCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const sym of page.symbols) m.set(sym.groupId, (m.get(sym.groupId) ?? 0) + 1);
    return m;
  }, [page.symbols]);

  const handleAddGroup = () => {
    const id = addFloorplanGroup(page.id, {});
    onActiveGroupChange(id);
    setExpandedGroupId(id);
  };

  const handleImagePicked = async (file: File | undefined) => {
    const groupId = imageTargetGroupRef.current;
    if (!file || !groupId) return;
    try {
      updateFloorplanGroup(page.id, groupId, { imageSrc: await importLegendImage(file) });
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Could not load that image.", "error");
    }
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

  // The selected symbols, in the order they sit on the plan.
  const selectedSymbols = useMemo(
    () => (selection.kind === "symbols" ? page.symbols.filter((sym) => selection.ids.includes(sym.id)) : []),
    [selection, page.symbols],
  );

  if (collapsed) {
    return (
      <div className="w-8 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col items-center h-full" data-print-hide>
        <button
          onClick={() => setCollapsed(false)}
          className="py-3 cursor-pointer hover:bg-[var(--color-surface-hover)] w-full flex justify-center transition-colors"
          title="Plan options — lines, legend, drawing block, notes"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 3l-5 5 5 5" />
          </svg>
        </button>
        <div
          className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mt-2 select-none"
          style={{ writingMode: "vertical-rl" }}
        >
          Plan options
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col h-full overflow-hidden text-xs" data-print-hide>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider">
          Plan options
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="cursor-pointer hover:bg-[var(--color-surface-hover)] rounded p-0.5 transition-colors"
          title="Collapse"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" data-allow-scroll>
      {/* ── Selected symbol ───────────────────────────────────────── */}
      {selectedSymbols.length > 0 && (() => {
        const first = selectedSymbols[0];
        const ids = selectedSymbols.map((sym) => sym.id);
        const group = page.groups.find((g) => g.id === first.groupId);
        const many = selectedSymbols.length > 1;
        const lineIds = first.lineNo ? page.symbols.filter((s) => (s.lineNo ?? "") === (first.lineNo ?? "")).map((s) => s.id) : [];
        const groupIds = page.symbols.filter((s) => s.groupId === first.groupId).map((s) => s.id);
        const device = first.deviceNodeId ? nodes.find((n) => n.id === first.deviceNodeId) : undefined;
        const patchAll = (patch: Parameters<typeof updateFloorplanSymbols>[2]) => updateFloorplanSymbols(page.id, ids, patch);
        const turn = first.rotationDeg ?? 0;
        const labelTurn = first.labelRotationDeg ?? 0;
        const arrows: Record<LabelPosition, string> = { nw: "\u2196", n: "\u2191", ne: "\u2197", w: "\u2190", e: "\u2192", sw: "\u2199", s: "\u2193", se: "\u2198" };
        return (
          <details className="border-b-2 border-emerald-400/60 bg-emerald-500/5" open>
            <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
              {many ? `${selectedSymbols.length} symbols selected` : "Selected symbol"}
            </summary>
            <div className="px-2 pb-3 flex flex-col gap-1.5">
              {/* What it is */}
              <div className="flex items-center gap-2">
                {group && <FloorplanSymbolSvg group={group} sizePx={24} paddingPx={2} rotationDeg={first.rotationDeg} className="shrink-0" />}
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--color-text)] truncate">{many ? `${first.label} \u2026` : first.label}</div>
                  <div className="text-[var(--color-text-muted)] truncate" style={{ fontSize: 10 }}>
                    {device ? (device.data as DeviceData).label : "no device linked"}
                  </div>
                </div>
              </div>

              {!many && (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <span className="shrink-0 w-12">Number</span>
                  <input
                    className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={first.label}
                    onChange={(e) => updateFloorplanSymbol(page.id, first.id, { label: e.target.value })}
                    title="The number printed next to the symbol"
                  />
                </label>
              )}

              {/* Which group it belongs to — this is what changes the symbol */}
              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title="The group decides how the symbol is drawn and which legend row it belongs to. Moving it here changes the symbol.">
                <span className="shrink-0 w-12">Group</span>
                <select
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={many && new Set(selectedSymbols.map((s) => s.groupId)).size > 1 ? "" : first.groupId}
                  onChange={(e) => { if (e.target.value) patchAll({ groupId: e.target.value }); }}
                >
                  {many && new Set(selectedSymbols.map((s) => s.groupId)).size > 1 && <option value="">— mixed —</option>}
                  {page.groups.map((g) => <option key={g.id} value={g.id}>{g.label || "(unnamed)"}</option>)}
                </select>
              </label>

              {isLoudspeaker && (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title="Amplifier line this speaker hangs on. Renumbering happens from the Lines section.">
                  <span className="shrink-0 w-12">Line</span>
                  <input
                    className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={first.lineNo ?? ""}
                    placeholder="e.g. 4"
                    onChange={(e) => patchAll({ lineNo: e.target.value || undefined })}
                  />
                </label>
              )}

              {/* Which way it faces */}
              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title="Turn the symbol; the number beside it stays upright.">
                <span className="shrink-0 w-12">Turn</span>
                <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700" onClick={() => patchAll({ rotationDeg: turn - 45 })} title="Turn 45° counter-clockwise">⟲</button>
                <input
                  type="number"
                  step={15}
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={turn}
                  onChange={(e) => patchAll({ rotationDeg: Number(e.target.value) || 0 })}
                />
                <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700" onClick={() => patchAll({ rotationDeg: turn + 45 })} title="Turn 45° clockwise">⟳</button>
              </label>

              {/* Where the number sits */}
              <div className="flex items-start gap-2 text-[var(--color-text-muted)]">
                <span className="shrink-0 w-12 pt-1">Label</span>
                <div className="grid grid-cols-3 gap-0.5">
                  {LABEL_POSITIONS.map((pos, i) => (
                    <button
                      key={pos}
                      className="w-6 h-5 rounded text-[var(--color-text)] hover:bg-emerald-500/20 hover:text-emerald-700 cursor-pointer"
                      style={i === 4 ? { gridColumnStart: 3 } : undefined}
                      onClick={() => patchAll(labelPlacementFor(pos, page.symbolSizeMm, page.labelSizeMm))}
                      title={`Put the number ${pos.toUpperCase()} of the symbol`}
                    >
                      {arrows[pos]}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step={5}
                    className="w-14 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={labelTurn}
                    onChange={(e) => patchAll({ labelRotationDeg: Number(e.target.value) || 0 })}
                    title="Number rotation in degrees (clockwise)"
                  />
                  <button
                    className="px-1 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                    onClick={() => patchAll({ labelRotationDeg: 0, rotationDeg: 0, labelOffsetMm: undefined, labelAlign: undefined })}
                    title="Reset the turn and the number placement"
                  >
                    ↺
                  </button>
                </div>
              </div>

              {(lineIds.length > 1 || groupIds.length > 1) && (
                <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                  <span className="shrink-0">Apply to</span>
                  {lineIds.length > 1 && (
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => updateFloorplanSymbols(page.id, lineIds, { labelOffsetMm: first.labelOffsetMm, labelAlign: first.labelAlign, labelRotationDeg: first.labelRotationDeg, rotationDeg: first.rotationDeg })}
                      title={`Copy this turn and number placement to every symbol on line ${first.lineNo}`}
                    >
                      line {first.lineNo}
                    </button>
                  )}
                  {groupIds.length > 1 && (
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => updateFloorplanSymbols(page.id, groupIds, { labelOffsetMm: first.labelOffsetMm, labelAlign: first.labelAlign, labelRotationDeg: first.labelRotationDeg, rotationDeg: first.rotationDeg })}
                      title="Copy this turn and number placement to every symbol of the group"
                    >
                      group
                    </button>
                  )}
                </div>
              )}

              {!many && (
                <textarea
                  className="w-full border border-[var(--color-border)] rounded px-1.5 py-1 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-y"
                  rows={2}
                  value={first.notes ?? ""}
                  placeholder="Note for this symbol (appears in the plan schedule)"
                  onChange={(e) => updateFloorplanSymbol(page.id, first.id, { notes: e.target.value || undefined })}
                  data-allow-scroll
                />
              )}

              <div className="flex items-center gap-1">
                {group && (
                  <button
                    className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                    onClick={() => { onActiveGroupChange(group.id); setExpandedGroupId(group.id); }}
                    title="Open this group below to change the shape, the color or the uploaded picture — that applies to every symbol of the group"
                  >
                    Edit symbol…
                  </button>
                )}
                <div className="flex-1" />
                <button
                  className="px-1.5 py-0.5 rounded text-red-500 hover:bg-red-500/10 hover:text-red-700"
                  onClick={() => {
                    for (const id of ids) removeFloorplanSymbol(page.id, id);
                    onSelectionChange({ kind: "none" });
                  }}
                  title="Remove from the plan"
                >
                  Delete
                </button>
              </div>
            </div>
          </details>
        );
      })()}

      {/* ── Symbol groups ─────────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 flex items-center justify-between font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
        <span>Symbol Groups</span>
        <button
          className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
          onClick={(e) => { e.preventDefault(); handleAddGroup(); }}
          title="Add a symbol group"
        >
          + Add
        </button>
        </summary>

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
      </details>

      {/* ── Numbering (line.speaker) ─────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Numbering
        </summary>
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
      </details>

      {/* ── Lines ↔ amplifier channels ────────────────────────────── */}
      <details open>
        <summary className="px-2 pt-2 pb-1 flex items-center justify-between font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
        <span>Lines &amp; load</span>
        <button
          className="normal-case tracking-normal font-normal px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
          onClick={(e) => { e.preventDefault(); handleSyncLines(); }}
          title="Read the amplifier channels off the schematic: one line per channel with speakers, placed symbols moved onto their channel's line"
        >
          Sync from schematic
        </button>
        </summary>
      <div className="px-2 pb-2 flex flex-col gap-1.5">
        {lines.length === 0 && (
          <p className="text-[var(--color-text-muted)] leading-snug">
            No lines yet. Drop speakers that are wired to an amplifier on the schematic — they take their channel's line automatically on a loudspeaker plan — or press Sync.
          </p>
        )}
        {lines.map((row) => (
          <LineCard
            key={row.line.lineNo}
            row={row}
            channelOptions={channelOptions}
            active={activeLine.trim() === row.line.lineNo}
            onActivate={() => onActiveLineChange(row.line.lineNo)}
            onRenumber={() => renumberFloorplanLine(page.id, row.line.lineNo)}
            onChange={(patch) => updateFloorplanLine(page.id, row.line.lineNo, patch)}
            onForget={() => removeFloorplanLine(page.id, row.line.lineNo)}
            speakerTaps={row.channel ? row.channel.speakerNodeIds.map((id) => { const n = nodes.find((x) => x.id === id); return n ? defaultTapW(specLookup.speakerSpecFor(n)) : undefined; }) : []}
          />
        ))}
        {[...lineReport.amps.values()].filter((a) => a.result.channels.some((c) => c.speakerCount > 0)).map(({ amplifier, result }) => (
          <div key={amplifier.nodeId} className="flex items-center justify-between gap-1 text-[var(--color-text)] border border-dashed border-[var(--color-border)] rounded px-1.5 py-0.5" title={result.hasSpec ? `Burst pool ${formatWatt(result.totalRequestedW)} of ${formatWatt(result.limits?.maxBurstTotalW)} · average ${formatWatt(result.totalAverageW)} of ${formatWatt(result.limits?.maxAvgTotalW)}` : "No amplifier load data on the template — open the device and fill in its ratings"}>
            <span className="truncate"><strong>{amplifier.label}</strong> · Σ {formatWatt(result.totalRequestedW)}{result.hasSpec ? ` / ${formatWatt(result.limits?.maxBurstTotalW)} · ${formatHeadroom(result.poolBurstHeadroomDb)}` : ""}</span>
            <StatusBadge status={result.hasSpec ? result.status : "no-data"} />
          </div>
        ))}
      </div>
      </details>

      {/* ── Legend box ────────────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Legend Box
        </summary>
      <div className="px-2 pb-4 flex flex-col gap-1.5">
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.visible}
            onChange={(e) => updateFloorplanLegend(page.id, { visible: e.target.checked })}
          />
          Show legend on the sheet
        </label>
        <input
          className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
          value={page.legend.title}
          placeholder="Legend title"
          onChange={(e) => updateFloorplanLegend(page.id, { title: e.target.value })}
        />
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.showImages}
            onChange={(e) => updateFloorplanLegend(page.id, { showImages: e.target.checked })}
          />
          Product images
        </label>
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.onlyUsedGroups}
            onChange={(e) => updateFloorplanLegend(page.id, { onlyUsedGroups: e.target.checked })}
          />
          Only groups used on this plan
        </label>
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer" title="Logo, name, address and contact from Preferences → Company">
          <input
            type="checkbox"
            checked={page.legend.showCompany !== false}
            onChange={(e) => updateFloorplanLegend(page.id, { showCompany: e.target.checked })}
          />
          Company block (logo, address)
        </label>
        <label className="flex items-center gap-2 text-[var(--color-text)]" title="Print the line table (line → amplifier channel, quantity, load) under the legend rows">
          <input type="checkbox" checked={legendShowsLines(page)} onChange={(e) => updateFloorplanLegend(page.id, { showLines: e.target.checked })} />
          Show line table
        </label>
        {legendShowsLines(page) && (
          <input
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
            value={page.legend.linesTitle ?? ""}
            placeholder={DEFAULT_LEGEND_LINES_TITLE}
            onChange={(e) => updateFloorplanLegend(page.id, { linesTitle: e.target.value || undefined })}
            title="Heading of the line table"
          />
        )}
        <input
          className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
          value={page.legend.notesTitle ?? ""}
          placeholder="Notes heading"
          onChange={(e) => updateFloorplanLegend(page.id, { notesTitle: e.target.value })}
        />
        <textarea
          className="w-full border border-[var(--color-border)] rounded px-1.5 py-1 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-y"
          rows={5}
          value={notesText}
          placeholder="One installation note per line"
          onChange={(e) => updateFloorplanLegend(page.id, { notes: e.target.value.split("\n") })}
          data-allow-scroll
        />
      </div>
      </details>

      {/* ── Drawing block (Plankopf) ──────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Drawing Block
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
            <input type="checkbox" checked={block.visible} onChange={(e) => patchBlock({ visible: e.target.checked })} />
            Show drawing block on the sheet
          </label>
          <input
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 font-semibold"
            value={block.title}
            placeholder="Drawing title, e.g. Ground floor"
            onChange={(e) => patchBlock({ title: e.target.value })}
            title="Tokens: {{pageLabel}}, {{showName}}, {{scale}} …"
          />
          <input
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
            value={block.subtitle ?? ""}
            placeholder="Subtitle, e.g. Loudspeaker layout"
            onChange={(e) => patchBlock({ subtitle: e.target.value })}
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>Fields</span>
            <button
              className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
              onClick={() => patchBlock({ fields: [...block.fields, { id: nextDrawingFieldId(), label: "Field", value: "" }] })}
            >
              + Field
            </button>
          </div>
          {block.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1">
              <input
                className="w-[38%] border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 uppercase"
                style={{ fontSize: 10 }}
                value={f.label}
                placeholder="Label"
                onChange={(e) => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <textarea
                className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-none leading-tight"
                rows={Math.max(1, Math.min(4, f.value.split("\n").length))}
                value={f.value}
                placeholder="Value or {{token}}"
                title="Multi-line values (addresses) wrap onto several lines in the block"
                onChange={(e) => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                data-allow-scroll
              />
              <button
                className={`px-1 rounded border ${f.wide ? "border-emerald-400 text-emerald-700 bg-emerald-500/10" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
                title="Span both columns"
                onClick={() => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, wide: !x.wide } : x)) })}
              >
                ⟷
              </button>
              <button
                className="px-1 text-[var(--color-text-muted)] hover:text-red-600"
                title="Remove field"
                onClick={() => patchBlock({ fields: block.fields.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <p className="text-[var(--color-text-muted)] leading-snug" style={{ fontSize: 10 }}>
            Tokens: {FLOORPLAN_TOKENS.map((t) => `{{${t}}}`).join(" ")} — resolved from the project title block and the page.
          </p>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>Revisions</span>
            <button
              className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
              onClick={() => patchBlock({
                revisions: [...block.revisions, { index: nextRevisionIndex(block.revisions), date: formatPlanDate(), description: "", author: "", checkedBy: "" }],
              })}
            >
              + Revision
            </button>
          </div>
          <div className="flex gap-1 text-[var(--color-text-muted)] uppercase" style={{ fontSize: 9 }}>
            {block.revisionHeaders.map((h, i) => (
              <input
                key={i}
                className="border border-transparent hover:border-[var(--color-border)] rounded px-1 text-[var(--color-text)] outline-none focus:border-emerald-400 bg-transparent min-w-0"
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
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "15%" }} value={r.index} onChange={(e) => patchRevision(i, { index: e.target.value })} title="Index" />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "15%" }} value={r.date} onChange={(e) => patchRevision(i, { date: e.target.value })} title="Date" />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0 flex-1" value={r.description} placeholder="Change" onChange={(e) => patchRevision(i, { description: e.target.value })} title="Change" />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "11%" }} value={r.author ?? ""} placeholder="By" onChange={(e) => patchRevision(i, { author: e.target.value })} title="Drawn by" />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "11%" }} value={r.checkedBy ?? ""} placeholder="Chk" onChange={(e) => patchRevision(i, { checkedBy: e.target.value })} title="Checked by" />
              <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" title="Remove revision" onClick={() => patchBlock({ revisions: block.revisions.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}

          <textarea
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-1 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-y mt-1"
            rows={3}
            value={block.disclaimer ?? ""}
            placeholder="Small print above the title, e.g. “All dimensions to be verified on site …”"
            onChange={(e) => patchBlock({ disclaimer: e.target.value })}
            data-allow-scroll
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
              <input type="checkbox" checked={block.showLogo} onChange={(e) => patchBlock({ showLogo: e.target.checked })} />
              Logo
            </label>
            <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
              <input type="checkbox" checked={block.showNorthArrow} onChange={(e) => patchBlock({ showNorthArrow: e.target.checked })} />
              North arrow
            </label>
            {block.showNorthArrow && (
              <label className="flex items-center gap-1 text-[var(--color-text)]" title="North arrow rotation (° clockwise)">
                <input
                  type="number"
                  className="w-14 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
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
      <details className="border-t border-[var(--color-border)]">
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Erased areas ({page.masks.length})
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1">
          <p className="text-[var(--color-text-muted)] leading-snug">
            White covers over the architect&apos;s plan — use <strong>▭ Erase</strong> on the sheet to drag one out over a
            legend, a note or a title block you want gone. Drag to move, corner to resize, <kbd>Delete</kbd> to remove.
          </p>
          {page.masks.map((m, i) => (
            <div key={m.id} className="flex items-center justify-between text-[var(--color-text)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
              <span>Cover {i + 1} · {Math.round(m.sizeMm.w)} × {Math.round(m.sizeMm.h)} mm</span>
              <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" onClick={() => removeFloorplanMask(page.id, m.id)} title="Remove cover">✕</button>
            </div>
          ))}
        </div>
      </details>

      {/* ── Notes on the plan ─────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          Notes on the plan ({page.notes.length})
        </summary>
        <div className="px-2 pb-4 flex flex-col gap-1.5">
          <button
            className="self-start px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
            onClick={() => {
              const area = drawingAreaMm(page);
              addFloorplanNote(page.id, { positionMm: { x: area.x + area.w / 2 - 30, y: area.y + area.h / 2 }, text: "Note", boxed: true });
            }}
            title="Adds a note at the sheet center — or use the ✎ Note tool to click it into place"
          >
            + Note
          </button>
          {page.notes.map((n) => (
            <div key={n.id} className="border border-[var(--color-border)] rounded p-1.5 flex flex-col gap-1">
              <textarea
                className="w-full border border-[var(--color-border)] rounded px-1.5 py-1 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-y"
                rows={2}
                value={n.text}
                onChange={(e) => updateFloorplanNote(page.id, n.id, { text: e.target.value })}
                data-allow-scroll
              />
              <div className="flex items-center gap-2 text-[var(--color-text)]">
                <label className="flex items-center gap-1" title="Font size (mm)">
                  <input type="number" className="w-12 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400" min={1} max={20} step={0.2} value={n.fontSizeMm} onChange={(e) => updateFloorplanNote(page.id, n.id, { fontSizeMm: Number(e.target.value) || 2.8 })} />
                  mm
                </label>
                <input type="color" className="w-6 h-5 border border-[var(--color-border)] rounded cursor-pointer" value={n.color ?? "#111111"} onChange={(e) => updateFloorplanNote(page.id, n.id, { color: e.target.value })} title="Text color" />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={Boolean(n.boxed)} onChange={(e) => updateFloorplanNote(page.id, n.id, { boxed: e.target.checked })} />
                  Box
                </label>
                <div className="flex-1" />
                <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" onClick={() => removeFloorplanNote(page.id, n.id)} title="Delete note">✕</button>
              </div>
            </div>
          ))}
        </div>
      </details>
      </div>
    </div>
  );
}


interface LineCardProps {
  row: LineLoadRow;
  channelOptions: { key: string; label: string; ch: NonNullable<LineLoadRow["channel"]> }[];
  active: boolean;
  onActivate: () => void;
  onRenumber: () => void;
  onChange: (patch: { ampNodeId?: string; ampPortId?: string; mode?: SpeakerLineMode; tapW?: number; name?: string; newLineNo?: string }) => void;
  onForget: () => void;
  /** Default taps of the speakers on the line, for the tap picker. */
  speakerTaps: (number | undefined)[];
}

/** One amplifier line: number, channel binding, mode / tap and the load verdict. */
function LineCard({ row, channelOptions, active, onActivate, onRenumber, onChange, onForget, speakerTaps }: LineCardProps) {
  const [open, setOpen] = useState(false);
  const [lineNoDraft, setLineNoDraft] = useState<string | null>(null);
  const { line, channel, load, amp } = row;
  const mode: SpeakerLineMode = line.mode ?? load?.mode ?? "lo-z";
  const limits = amp?.limits;
  const modeSupported = (m: SpeakerLineMode) => !limits || (m === "lo-z" ? limits.supportsLoZ : m === "70v" ? limits.supports70V : limits.supports100V);
  const status: LoadStatus = load ? load.status : channel ? "no-data" : "empty";
  const tapChoices = [...new Set(speakerTaps.filter((t): t is number => typeof t === "number"))].sort((a, b) => b - a);
  const detail = load && load.speakerCount > 0
    ? [
        load.impedanceOhm !== undefined ? `Z ${formatOhm(load.impedanceOhm)}` : null,
        `P ${formatWatt(load.requestedW)}`,
        load.peakVoltageV !== undefined ? `Vpk ${Math.round(load.peakVoltageV)} V` : null,
        load.peakCurrentA !== undefined ? `Ipk ${Math.round(load.peakCurrentA * 10) / 10} A` : null,
        load.headroomDb !== undefined ? `${formatHeadroom(load.headroomDb)}${load.limitedBy ? ` (${LOAD_LIMITER_LABELS[load.limitedBy]})` : ""}` : null,
        load.speakersWithoutData > 0 ? `${load.speakersWithoutData} without load data` : null,
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <div className={`border rounded ${active ? "border-emerald-400 bg-emerald-500/100/10" : "border-[var(--color-border)]"}`}>
      <div className="flex items-center gap-1 px-1.5 py-0.5 text-[var(--color-text)]">
        <button className="text-left flex-1 min-w-0 hover:text-emerald-700" onClick={onActivate} title="Make this the active line for the next symbols">
          Line <strong>{line.lineNo}</strong>
          {line.name ? <span className="text-[var(--color-text-muted)]"> · {line.name}</span> : null}
          <span className="text-[var(--color-text-muted)]"> · {row.placedCount} placed{channel ? ` / ${row.wiredCount} wired` : ""}</span>
        </button>
        <StatusBadge status={status} title={detail ?? undefined} />
        <button className="px-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400 hover:text-emerald-700" onClick={() => setOpen((v) => !v)} title={open ? "Collapse" : "Wiring, mode and load"}>
          {open ? "▾" : "▸"}
        </button>
      </div>
      <div className="px-1.5 pb-1 text-[var(--color-text)] truncate" style={{ fontSize: 10 }} title={detail ?? undefined}>
        {channel ? `${channel.ampLabel} · ${channelShortLabel(channel)} · ${LINE_MODE_LABELS[mode]}` : "not wired to an amplifier channel"}
        {detail ? ` — ${detail}` : ""}
      </div>
      {open && (
        <div className="px-1.5 pb-1.5 flex flex-col gap-1 border-t border-[var(--color-border)] pt-1">
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">Number</span>
            <input
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
              value={lineNoDraft ?? line.lineNo}
              onChange={(e) => setLineNoDraft(e.target.value)}
              onBlur={() => { if (lineNoDraft !== null && lineNoDraft.trim() && lineNoDraft.trim() !== line.lineNo) onChange({ newLineNo: lineNoDraft.trim() }); setLineNoDraft(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              title="Renaming the line relabels its symbols"
            />
          </label>
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">Channel</span>
            <select
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 bg-[var(--color-surface)]"
              value={line.ampNodeId && line.ampPortId ? `${line.ampNodeId}::${line.ampPortId}` : ""}
              onChange={(e) => {
                const opt = channelOptions.find((o) => o.key === e.target.value);
                onChange(opt ? { ampNodeId: opt.ch.ampNodeId, ampPortId: opt.ch.portId } : { ampNodeId: undefined, ampPortId: undefined });
              }}
              title="Amplifier channel feeding this line (speaker-level output on the schematic)"
            >
              <option value="">— not wired —</option>
              {channelOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">Mode</span>
            <select
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 bg-[var(--color-surface)]"
              value={mode}
              onChange={(e) => onChange({ mode: e.target.value as SpeakerLineMode })}
              title="Low impedance or 70 V / 100 V constant-voltage line"
            >
              {SPEAKER_LINE_MODES.map((m) => (
                <option key={m} value={m} disabled={!modeSupported(m)}>{LINE_MODE_LABELS[m]}{modeSupported(m) ? "" : " (amp: n/a)"}</option>
              ))}
            </select>
          </label>
          {mode !== "lo-z" && (
            <label className="flex items-center gap-2 text-[var(--color-text)]">
              <span className="shrink-0 w-14">Tap</span>
              <input
                type="number"
                min={0}
                step="any"
                className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                value={line.tapW ?? ""}
                placeholder={tapChoices.length ? `max (${tapChoices[0]} W)` : "W per speaker"}
                list={`taps-${line.lineNo}`}
                onChange={(e) => onChange({ tapW: e.target.value === "" ? undefined : Number(e.target.value) })}
                title="Transformer tap per speaker in watts; empty = each speaker's highest tap"
              />
              <datalist id={`taps-${line.lineNo}`}>
                {tapChoices.map((t) => <option key={t} value={t} />)}
              </datalist>
            </label>
          )}
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">Name</span>
            <input
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
              value={line.name ?? ""}
              placeholder="e.g. Terrasse"
              onChange={(e) => onChange({ name: e.target.value || undefined })}
              title="Printed in the legend's line table"
            />
          </label>
          {limits && (
            <p className="text-[var(--color-text-muted)] leading-snug" style={{ fontSize: 10 }}>
              Amp limits: {formatWatt(limits.maxBurstPerChannelW)}/ch · Σ {formatWatt(limits.maxBurstTotalW)} burst · {Math.round(limits.peakVoltageV)} V / {Math.round(limits.peakCurrentA)} A peak · min {formatOhm(limits.minImpedanceOhm)}
            </p>
          )}
          {channel && !amp?.hasSpec && (
            <p className="text-amber-600 leading-snug" style={{ fontSize: 10 }}>The amplifier has no load data — fill in its ratings on the device (Load section) to get a verdict.</p>
          )}
          <div className="flex items-center gap-1">
            <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700" onClick={onRenumber} title="Renumber this line 1…n in placement order">
              Renumber
            </button>
            {(line.ampNodeId || line.mode || line.name || line.tapW !== undefined) && (
              <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-red-400 hover:text-red-700" onClick={onForget} title="Drop the wiring / mode of this line; its symbols keep their numbers">
                Forget wiring
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
