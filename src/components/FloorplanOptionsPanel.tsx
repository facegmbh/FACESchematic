import { useMemo, useRef, useState } from "react";
import { useSchematicStore, loadSpecLookup } from "../store";
import { COVERAGE_ASPECT_PRESETS, COVERAGE_MAX_RANGE_M, COVERAGE_MIN_RANGE_M, COVERAGE_MP_PRESETS, DEFAULT_COVERAGE_ASPECT_RATIO, DEFAULT_COVERAGE_OPACITY, coverageApertureDeg, coverageColor, coveragePixelDensityAt, defaultCameraOptics, defaultCoverageForDevice, effectiveRangeM, formatCoverageSpec, DEFAULT_LEGEND_LINES_TITLE, DEFAULT_SYMBOL_OUTLINE, DEFAULT_SYMBOL_OUTLINE_RATIO, FLOORPLAN_GROUP_COLORS, FLOORPLAN_SYMBOL_SHAPE_LABELS, LABEL_POSITIONS, drawingAreaMm, effectiveLabelTemplate, formatPlanDate, labelPlacementFor, nextDrawingFieldId, nextRevisionIndex, type LabelPosition } from "../floorplan";
import { channelShortLabel, computeLineLoads, legendShowsLines, type LineLoadRow } from "../speakerLines";
import { LINE_MODE_LABELS, LOAD_LIMITER_LABELS, LOAD_STATUS_LABELS, defaultTapW, formatHeadroom, formatOhm, formatWatt, type LoadStatus } from "../speakerLoad";
import { COVERAGE_SHAPES, DORI_LEVELS, DORI_PX_PER_M, FLOORPLAN_SYMBOL_SHAPES, SPEAKER_LINE_MODES,
  DEFAULT_HEATMAP, RSSI_STEPS, WALL_MATERIALS, WALL_MATERIAL_COLORS, WALL_MATERIAL_DEFAULTS,
  WALL_MATERIAL_LABELS, WALL_THICKNESS_PRESETS_MM, WIFI_BANDS, WIFI_BAND_LABELS } from "../types";
import { collectAccessPoints, coveredFraction, computeHeatmap, planningRadiusM, rangeForRssiM, wallAttenuationDb } from "../wifiCoverage";
import { getTemplateById as lookupTemplate } from "../templateApi";
import type { CoverageShape, DoriLevel, DeviceData, WallMaterial, FloorplanDrawingBlock, FloorplanPage, FloorplanRevision, FloorplanSymbolGroup, SpeakerLineMode } from "../types";
import { importLegendImage, importSymbolImage } from "../floorplanUnderlay";
import { getTemplateById } from "../templateApi";
import FloorplanSymbolSvg from "./FloorplanSymbolSvg";
import type { Selection } from "./FloorplanRenderer";
import { FLOORPLAN_TOKENS } from "../types";
import { useT } from "../i18n";

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
  const t = useT();
  return (
    <span className={`shrink-0 px-1 rounded border ${STATUS_CLASS[status]}`} style={{ fontSize: 9 }} title={title}>
      {t(LOAD_STATUS_LABELS[status])}
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
  const t = useT();
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
  const updateFloorplanMask = useSchematicStore((s) => s.updateFloorplanMask);
  const addFloorplanCoverage = useSchematicStore((s) => s.addFloorplanCoverage);
  const updateFloorplanCoverage = useSchematicStore((s) => s.updateFloorplanCoverage);
  const removeFloorplanCoverage = useSchematicStore((s) => s.removeFloorplanCoverage);
  const addFloorplanWall = useSchematicStore((s) => s.addFloorplanWall);
  const updateFloorplanWall = useSchematicStore((s) => s.updateFloorplanWall);
  const removeFloorplanWall = useSchematicStore((s) => s.removeFloorplanWall);
  const updateFloorplanHeatmap = useSchematicStore((s) => s.updateFloorplanHeatmap);
  const wallMaterials = useSchematicStore((s) => s.wallMaterials);
  const setWallMaterial = useSchematicStore((s) => s.setWallMaterial);
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
    if (lineReport.schematicAmps.length === 0) addToast(t("No amplifier with speaker-level outputs on the schematic."), "info");
    else if (res.addedLineNos.length === 0 && res.relabeledCount === 0) addToast(t("Lines already match the schematic."), "info");
    else {
      const added = res.addedLineNos.length === 1 ? t("1 line added") : t("{n} lines added", { n: res.addedLineNos.length });
      const renumbered = res.relabeledCount === 1 ? t("1 symbol renumbered") : t("{n} symbols renumbered", { n: res.relabeledCount });
      addToast(`${added}, ${renumbered}.`, "success");
    }
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
      addToast(e instanceof Error ? e.message : t("Could not load that image."), "error");
    }
  };

  const handleSymbolImagePicked = async (file: File | undefined) => {
    const groupId = symbolImageTargetRef.current;
    if (!file || !groupId) return;
    try {
      updateFloorplanGroup(page.id, groupId, { symbolImageSrc: await importSymbolImage(file) });
    } catch (e) {
      addToast(e instanceof Error ? e.message : t("Could not load that symbol image."), "error");
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
          title={t("Plan options — lines, legend, drawing block, notes")}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 3l-5 5 5 5" />
          </svg>
        </button>
        <div
          className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mt-2 select-none"
          style={{ writingMode: "vertical-rl" }}
        >
          {t("Plan options")}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col h-full overflow-hidden text-xs" data-print-hide>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider">
          {t("Plan options")}
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="cursor-pointer hover:bg-[var(--color-surface-hover)] rounded p-0.5 transition-colors"
          title={t("Collapse")}
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
              {many ? t("{n} symbols selected", { n: selectedSymbols.length }) : t("Selected symbol")}
            </summary>
            <div className="px-2 pb-3 flex flex-col gap-1.5">
              {/* What it is */}
              <div className="flex items-center gap-2">
                {group && <FloorplanSymbolSvg group={group} sizePx={24} paddingPx={2} rotationDeg={first.rotationDeg} symbolSizeMm={page.symbolSizeMm} className="shrink-0" />}
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--color-text)] truncate">{many ? `${first.label} \u2026` : first.label}</div>
                  <div className="text-[var(--color-text-muted)] truncate" style={{ fontSize: 10 }}>
                    {device ? (device.data as DeviceData).label : t("no device linked")}
                  </div>
                </div>
              </div>

              {!many && (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <span className="shrink-0 w-12">{t("Number")}</span>
                  <input
                    className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={first.label}
                    onChange={(e) => updateFloorplanSymbol(page.id, first.id, { label: e.target.value })}
                    title={t("The number printed next to the symbol")}
                  />
                </label>
              )}

              {/* Which group it belongs to — this is what changes the symbol */}
              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("The group decides how the symbol is drawn and which legend row it belongs to. Moving it here changes the symbol.")}>
                <span className="shrink-0 w-12">{t("Group")}</span>
                <select
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={many && new Set(selectedSymbols.map((s) => s.groupId)).size > 1 ? "" : first.groupId}
                  onChange={(e) => { if (e.target.value) patchAll({ groupId: e.target.value }); }}
                >
                  {many && new Set(selectedSymbols.map((s) => s.groupId)).size > 1 && <option value="">{t("— mixed —")}</option>}
                  {page.groups.map((g) => <option key={g.id} value={g.id}>{g.label || t("(unnamed)")}</option>)}
                </select>
              </label>

              {isLoudspeaker && (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Amplifier line this speaker hangs on. Renumbering happens from the Lines section.")}>
                  <span className="shrink-0 w-12">{t("Line")}</span>
                  <input
                    className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={first.lineNo ?? ""}
                    placeholder={t("e.g. 4")}
                    onChange={(e) => patchAll({ lineNo: e.target.value || undefined })}
                  />
                </label>
              )}

              {/* Which way it faces */}
              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Turn the symbol; the number beside it stays upright.")}>
                <span className="shrink-0 w-12">{t("Turn")}</span>
                <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700" onClick={() => patchAll({ rotationDeg: turn - 45 })} title={t("Turn 45° counter-clockwise")}>⟲</button>
                <input
                  type="number"
                  step={15}
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={turn}
                  onChange={(e) => patchAll({ rotationDeg: Number(e.target.value) || 0 })}
                  title={t("Symbol rotation in degrees clockwise")}
                />
                <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700" onClick={() => patchAll({ rotationDeg: turn + 45 })} title={t("Turn 45° clockwise")}>⟳</button>
              </label>

              {/* Where the number sits */}
              <div className="flex items-start gap-2 text-[var(--color-text-muted)]">
                <span className="shrink-0 w-12 pt-1">{t("Label")}</span>
                <div className="grid grid-cols-3 gap-0.5">
                  {LABEL_POSITIONS.map((pos, i) => (
                    <button
                      key={pos}
                      className="w-6 h-5 rounded text-[var(--color-text)] hover:bg-emerald-500/20 hover:text-emerald-700 cursor-pointer"
                      style={i === 4 ? { gridColumnStart: 3 } : undefined}
                      onClick={() => patchAll(labelPlacementFor(pos, page.symbolSizeMm, page.labelSizeMm))}
                      title={t("Put the number {dir} of the symbol", { dir: pos.toUpperCase() })}
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
                    title={t("Number rotation in degrees (clockwise)")}
                  />
                  <button
                    className="px-1 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                    onClick={() => patchAll({ labelRotationDeg: 0, rotationDeg: 0, labelOffsetMm: undefined, labelAlign: undefined })}
                    title={t("Reset the turn and the number placement")}
                  >
                    ↺
                  </button>
                </div>
              </div>

              {(lineIds.length > 1 || groupIds.length > 1) && (
                <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                  <span className="shrink-0">{t("Apply to")}</span>
                  {lineIds.length > 1 && (
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => updateFloorplanSymbols(page.id, lineIds, { labelOffsetMm: first.labelOffsetMm, labelAlign: first.labelAlign, labelRotationDeg: first.labelRotationDeg, rotationDeg: first.rotationDeg })}
                      title={t("Copy this turn and number placement to every symbol on line {line}", { line: first.lineNo ?? "" })}
                    >
                      {t("line")} {first.lineNo}
                    </button>
                  )}
                  {groupIds.length > 1 && (
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => updateFloorplanSymbols(page.id, groupIds, { labelOffsetMm: first.labelOffsetMm, labelAlign: first.labelAlign, labelRotationDeg: first.labelRotationDeg, rotationDeg: first.rotationDeg })}
                      title={t("Copy this turn and number placement to every symbol of the group")}
                    >
                      {t("group")}
                    </button>
                  )}
                </div>
              )}

              {!many && (
                <textarea
                  className="w-full border border-[var(--color-border)] rounded px-1.5 py-1 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-y"
                  rows={2}
                  value={first.notes ?? ""}
                  placeholder={t("Note for this symbol (appears in the plan schedule)")}
                  onChange={(e) => updateFloorplanSymbol(page.id, first.id, { notes: e.target.value || undefined })}
                  data-allow-scroll
                />
              )}

              {group?.hidden && (
                <div className="flex items-center gap-1.5 rounded border border-amber-400 bg-amber-500/10 px-1.5 py-1 text-amber-700">
                  <span className="flex-1">{t("Its layer is switched off.")}</span>
                  <button
                    className="px-1 rounded border border-amber-400 hover:bg-amber-500/20"
                    onClick={() => updateFloorplanGroup(page.id, group.id, { hidden: undefined })}
                    title={t("Draw this group again")}
                  >
                    {t("Show")}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1">
                {group && (
                  <button
                    className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                    onClick={() => { onActiveGroupChange(group.id); setExpandedGroupId(group.id); }}
                    title={t("Open this group below to change the shape, the color or the uploaded picture — that applies to every symbol of the group")}
                  >
                    {t("Edit symbol…")}
                  </button>
                )}
                {(() => {
                  // Pressing this a second time has to open the area that is already there,
                  // not stack another one on top of it — two wedges on one device look like
                  // a rotation that did not take, because the one underneath keeps its own
                  // angle. Adding a second area stays possible from the right-click menu.
                  const existing = selectedSymbols
                    .map((sym) => (page.coverages ?? []).find((c) => c.symbolId === sym.id))
                    .filter((c): c is NonNullable<typeof c> => Boolean(c));
                  const allCovered = existing.length === selectedSymbols.length;
                  return (
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-sky-400 hover:text-sky-700"
                      onClick={() => {
                        if (allCovered) {
                          onSelectionChange({ kind: "coverage", id: existing[0].id });
                          return;
                        }
                        // One area per device that has none yet, anchored to it and filed
                        // under its own group so it switches with that layer. Aimed by the
                        // device from the start — the offset is 0.
                        let last: string | null = null;
                        for (const sym of selectedSymbols) {
                          if ((page.coverages ?? []).some((c) => c.symbolId === sym.id)) continue;
                          // A camera arrives with a lens that computes its own reach, an
                          // access point with a circle at its own radio's reach, and a
                          // detector with metres to type.
                          const dev = sym.deviceNodeId ? nodes.find((n) => n.id === sym.deviceNodeId) : undefined;
                          const devData = dev?.data as DeviceData | undefined;
                          const tpl = devData?.templateId ? lookupTemplate(devData.templateId, customTemplates) : undefined;
                          const cfgHm = { ...DEFAULT_HEATMAP, ...(page.heatmap ?? {}) };
                          last = addFloorplanCoverage(page.id, {
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
                        if (last && !many) onSelectionChange({ kind: "coverage", id: last });
                      }}
                      title={allCovered
                        ? t("Open the area this device already has. To give it a second one, right-click the symbol.")
                        : t("Draw what this device covers — a camera's field of view, a detector's reach. It follows the device and turns with it.")}
                    >
                      ◔ {allCovered ? t("Edit coverage") : t("Coverage")}
                    </button>
                  );
                })()}
                <div className="flex-1" />
                <button
                  className="px-1.5 py-0.5 rounded text-red-500 hover:bg-red-500/10 hover:text-red-700"
                  onClick={() => {
                    for (const id of ids) removeFloorplanSymbol(page.id, id);
                    onSelectionChange({ kind: "none" });
                  }}
                  title={t("Remove from the plan")}
                >
                  {t("Delete")}
                </button>
              </div>
            </div>
          </details>
        );
      })()}

      {/* ── Selected coverage area ────────────────────────────────── */}
      {selection.kind === "coverage" && (() => {
        const coverage = (page.coverages ?? []).find((c) => c.id === selection.id);
        if (!coverage) return null;
        const patch = (p: Parameters<typeof updateFloorplanCoverage>[2]) => updateFloorplanCoverage(page.id, coverage.id, p);
        const anchoredTo = coverage.symbolId ? page.symbols.find((sym) => sym.id === coverage.symbolId) : undefined;
        const shapeLabels: Record<CoverageShape, string> = {
          sector: t("Sector"),
          circle: t("Circle"),
          rect: t("Corridor"),
        };
        return (
          <details className="border-b-2 border-sky-400/60 bg-sky-500/5" open>
            <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
              {t("Selected coverage")}
            </summary>
            <div className="px-2 pb-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 rounded-sm border border-[var(--color-border)]"
                  style={{ width: 18, height: 18, background: coverageColor(coverage, page.groups), opacity: coverage.opacity ?? DEFAULT_COVERAGE_OPACITY }}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--color-text)] truncate">{coverage.label || t("Coverage")}</div>
                  <div className="text-[var(--color-text-muted)] truncate" style={{ fontSize: 10 }}>
                    {formatCoverageSpec(coverage)}
                    {anchoredTo ? ` · ${t("follows")} ${anchoredTo.label}` : ` · ${t("free-standing")}`}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <span className="shrink-0 w-12">{t("Caption")}</span>
                <input
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={coverage.label ?? ""}
                  placeholder={t("e.g. BM 1")}
                  onChange={(e) => patch({ label: e.target.value || undefined })}
                  title={t("Printed just past the area's far edge. Leave empty for an unlabelled area.")}
                />
              </label>

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <span className="shrink-0 w-12">{t("Shape")}</span>
                <select
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={coverage.shape}
                  onChange={(e) => {
                    const shape = e.target.value as CoverageShape;
                    // A shape needs its own field filled, or it would draw nothing.
                    patch({
                      shape,
                      apertureDeg: shape === "sector" ? coverageApertureDeg(coverage) : coverage.apertureDeg,
                      widthM: shape === "rect" ? (coverage.widthM ?? 2) : coverage.widthM,
                    });
                  }}
                >
                  {COVERAGE_SHAPES.map((sh) => <option key={sh} value={sh}>{shapeLabels[sh]}</option>)}
                </select>
              </label>

              {/* A camera is set by its lens; everything else by a measured reach. */}
              <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" title={t("A camera has no range of its own — it has pixels spread over an angle. Switch this on and the reach is computed from the megapixels, the opening angle and the DORI level you need.")}>
                <input
                  type="checkbox"
                  checked={Boolean(coverage.optics)}
                  onChange={(e) => patch({ optics: e.target.checked ? defaultCameraOptics() : undefined })}
                />
                <span>{t("Camera — compute the reach from the lens")}</span>
              </label>

              {coverage.optics ? (() => {
                const optics = coverage.optics;
                const hfov = coverageApertureDeg(coverage);
                const reach = effectiveRangeM(coverage);
                const doriLabels: Record<DoriLevel, string> = {
                  detect: t("Detect"),
                  observe: t("Observe"),
                  recognise: t("Recognise"),
                  identify: t("Identify"),
                };
                return (
                  <>
                    <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Sensor resolution as the datasheet states it. More megapixels spread over the same angle reach further.")}>
                      <span className="shrink-0 w-12">{t("Sensor")}</span>
                      <input
                        type="number"
                        step={1}
                        min={0.3}
                        max={64}
                        className="w-14 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                        value={optics.megapixels}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v > 0) patch({ optics: { ...optics, megapixels: v } });
                        }}
                      />
                      <span style={{ fontSize: 10 }}>MP</span>
                      <select
                        className="min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                        value={optics.aspectRatio ?? DEFAULT_COVERAGE_ASPECT_RATIO}
                        onChange={(e) => patch({ optics: { ...optics, aspectRatio: Number(e.target.value) } })}
                        title={t("Sensor aspect ratio — it decides how the megapixels split into width and height.")}
                      >
                        {COVERAGE_ASPECT_PRESETS.map((a) => <option key={a.label} value={a.value}>{a.label}</option>)}
                      </select>
                    </label>

                    <div className="flex items-center gap-1 pl-14">
                      {COVERAGE_MP_PRESETS.map((mp) => (
                        <button
                          key={mp}
                          className={`px-1.5 py-0.5 rounded border ${Math.abs(optics.megapixels - mp) < 0.05 ? "border-sky-400 text-sky-700 bg-sky-500/10" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-sky-300"}`}
                          onClick={() => patch({ optics: { ...optics, megapixels: mp } })}
                          style={{ fontSize: 10 }}
                        >
                          {mp}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("How much of the picture a person has to fill. Identify needs four times the pixel density of Observe, so it reaches half as far.")}>
                      <span className="shrink-0 w-12">{t("Purpose")}</span>
                      <select
                        className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                        value={optics.dori}
                        onChange={(e) => patch({ optics: { ...optics, dori: e.target.value as DoriLevel } })}
                      >
                        {DORI_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>{doriLabels[lvl]} — {DORI_PX_PER_M[lvl]} px/m</option>
                        ))}
                      </select>
                    </label>

                    {/* The computed reach, read-only on purpose: it is a result, not a field. */}
                    <div className="rounded border border-sky-300 bg-sky-500/5 px-1.5 py-1 text-[var(--color-text)]">
                      <div className="flex items-baseline gap-1">
                        <span className="font-semibold tabular-nums" style={{ fontSize: 13 }}>{reach.toFixed(1)} m</span>
                        <span className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
                          {t("at")} {Math.round(hfov)}° · {doriLabels[optics.dori]}
                        </span>
                      </div>
                      <div className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
                        {t("{n} px/m at 5 m", { n: Math.round(coveragePixelDensityAt(optics, hfov, 5)) })}
                        {" · "}
                        {t("{n} px/m at 10 m", { n: Math.round(coveragePixelDensityAt(optics, hfov, 10)) })}
                      </div>
                    </div>
                  </>
                );
              })() : (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Reach on site, in metres — the number off the datasheet. It is converted through the drawing scale, so it stays true when the plan is re-scaled.")}>
                  <span className="shrink-0 w-12">{t("Range")}</span>
                  <input
                    type="number"
                    step={0.5}
                    min={COVERAGE_MIN_RANGE_M}
                    max={COVERAGE_MAX_RANGE_M}
                    className="w-16 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={coverage.rangeM}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) patch({ rangeM: Math.min(COVERAGE_MAX_RANGE_M, Math.max(COVERAGE_MIN_RANGE_M, v)) });
                    }}
                  />
                  <span style={{ fontSize: 10 }}>m</span>
                </label>
              )}

              {coverage.shape === "sector" && (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Opening angle — a wide-angle PIR's 90°, a lens's horizontal field of view. 360° covers the full circle.")}>
                  <span className="shrink-0 w-12">{coverage.optics ? t("Lens") : t("Angle")}</span>
                  <input
                    type="range"
                    min={5}
                    max={360}
                    step={5}
                    value={coverageApertureDeg(coverage)}
                    onChange={(e) => patch({ apertureDeg: Number(e.target.value) })}
                    className="flex-1 min-w-0"
                  />
                  <span className="shrink-0 tabular-nums" style={{ fontSize: 10 }}>{Math.round(coverageApertureDeg(coverage))}°</span>
                </label>
              )}

              {coverage.shape === "rect" && (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("How wide the corridor is, in metres on site.")}>
                  <span className="shrink-0 w-12">{t("Width")}</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0.1}
                    className="w-16 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={coverage.widthM ?? 2}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v > 0) patch({ widthM: v });
                    }}
                  />
                  <span style={{ fontSize: 10 }}>m</span>
                </label>
              )}

              {coverage.shape !== "circle" && (
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={anchoredTo
                  ? t("Offset on top of the device's own rotation — 0° means the area faces exactly where the device faces.")
                  : t("Direction the area faces, in degrees clockwise. 0° points to the right of the sheet.")}>
                  <span className="shrink-0 w-12">{anchoredTo ? t("Offset") : t("Facing")}</span>
                  <input
                    type="number"
                    step={5}
                    className="w-16 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={Math.round(coverage.rotationDeg ?? 0)}
                    onChange={(e) => patch({ rotationDeg: Number(e.target.value) || 0 })}
                  />
                  <span style={{ fontSize: 10 }}>°</span>
                </label>
              )}

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Areas overlap constantly — two detectors on one room is normal. A light fill keeps the overlap readable.")}>
                <span className="shrink-0 w-12">{t("Opacity")}</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={coverage.opacity ?? DEFAULT_COVERAGE_OPACITY}
                  onChange={(e) => patch({ opacity: Number(e.target.value) })}
                  className="flex-1 min-w-0"
                />
                <span className="shrink-0 tabular-nums" style={{ fontSize: 10 }}>{Math.round((coverage.opacity ?? DEFAULT_COVERAGE_OPACITY) * 100)}%</span>
              </label>

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Its own color, or the group's when left on automatic — that keeps the detector plan and the camera plan telling themselves apart.")}>
                <span className="shrink-0 w-12">{t("Color")}</span>
                <input
                  type="color"
                  className="w-8 h-6 bg-transparent border border-[var(--color-border)] rounded cursor-pointer"
                  value={coverageColor(coverage, page.groups)}
                  onChange={(e) => patch({ color: e.target.value })}
                />
                {coverage.color && (
                  <button
                    className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                    onClick={() => patch({ color: undefined })}
                    title={t("Back to the group's color")}
                  >
                    {t("Auto")}
                  </button>
                )}
              </label>

              <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <input
                  type="checkbox"
                  checked={coverage.showOutline !== false}
                  onChange={(e) => patch({ showOutline: e.target.checked ? undefined : false })}
                />
                <span>{t("Draw the boundary line")}</span>
              </label>

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Filing the area under a group makes it switch off with that group's layer, so one drawing yields a detector sheet and a camera sheet.")}>
                <span className="shrink-0 w-12">{t("Layer")}</span>
                <select
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={coverage.groupId ?? ""}
                  onChange={(e) => patch({ groupId: e.target.value || undefined })}
                >
                  <option value="">{t("— always shown —")}</option>
                  {page.groups.map((g) => <option key={g.id} value={g.id}>{g.label || t("(unnamed)")}</option>)}
                </select>
              </label>

              <div className="flex items-center gap-1 pt-0.5">
                <button
                  className={`px-1.5 py-0.5 rounded border ${coverage.locked ? "border-emerald-300 text-emerald-700" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400"}`}
                  onClick={() => patch({ locked: coverage.locked ? undefined : true })}
                  title={coverage.locked ? t("Locked — click to let it be dragged and aimed again") : t("Lock it so placing symbols inside it cannot nudge it")}
                >
                  {coverage.locked ? "🔒" : "🔓"}
                </button>
                {anchoredTo && (
                  <button
                    className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400 hover:text-emerald-700"
                    onClick={() => patch({ symbolId: undefined, positionMm: { ...anchoredTo.positionMm } })}
                    title={t("The area stays where it is but stops following the device.")}
                  >
                    {t("Detach")}
                  </button>
                )}
                <button
                  className="ml-auto px-1.5 py-0.5 rounded border border-transparent text-red-600 hover:bg-red-500/10 hover:border-red-200"
                  onClick={() => {
                    removeFloorplanCoverage(page.id, coverage.id);
                    onSelectionChange({ kind: "none" });
                  }}
                  title={t("Remove coverage")}
                >
                  {t("Delete")}
                </button>
              </div>
            </div>
          </details>
        );
      })()}

      {/* ── Symbol groups ─────────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 flex items-center justify-between font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
        <span>{t("Symbol Groups")}</span>
        <button
          className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
          onClick={(e) => { e.preventDefault(); handleAddGroup(); }}
          title={t("Add a symbol group")}
        >
          + {t("Add")}
        </button>
        </summary>

      {page.groups.length === 0 && (
        <p className="px-2 pb-2 text-[var(--color-text-muted)] leading-relaxed">
          {t("A group is one legend row — a color, a shape and the model it stands for. Add one, then drag devices onto the plan.")}
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
                  title={t("Make this the active group for placing symbols")}
                >
                  <FloorplanSymbolSvg group={group} sizePx={12} paddingPx={1} symbolSizeMm={page.symbolSizeMm} className={group.hidden ? "shrink-0 opacity-40" : "shrink-0"} />
                  <span className={`truncate ${group.hidden ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]"}`}>{group.label}</span>
                </button>
                <span className="text-[var(--color-text-muted)] shrink-0" title={t("Symbols on this plan")}>
                  {symbolCounts.get(group.id) ?? 0}
                </span>
                {/* The group is the layer: switching it off takes its symbols off the sheet,
                    out of the export and out of the legend, without deleting anything. */}
                <button
                  className={`px-1 shrink-0 ${group.hidden ? "text-[var(--color-text-muted)]" : "text-emerald-600 hover:text-emerald-700"}`}
                  onClick={() => updateFloorplanGroup(page.id, group.id, { hidden: group.hidden ? undefined : true })}
                  title={group.hidden ? t("Switched off — click to draw it again") : t("On the sheet — click to switch this layer off")}
                >
                  {group.hidden ? "🚫" : "👁"}
                </button>
                <button
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] px-1"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  title={t("Edit group")}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              </div>

              {isExpanded && (
                <div className="px-1.5 pb-2 flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-1.5">
                  <input
                    className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={group.label}
                    placeholder={t("Legend title, e.g. Ceiling speakers")}
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { label: e.target.value })}
                  />
                  <input
                    className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={group.description ?? ""}
                    placeholder={t("Model | cable spec")}
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { description: e.target.value })}
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={group.color}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { color: e.target.value })}
                      className="w-7 h-6 shrink-0 border border-[var(--color-border)] rounded cursor-pointer"
                      title={t("Symbol color")}
                    />
                    <select
                      className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                      value={group.shape}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { shape: e.target.value as FloorplanSymbolGroup["shape"] })}
                      title={t("Symbol shape — abstract or a top-view pictogram")}
                    >
                      {FLOORPLAN_SYMBOL_SHAPES.map((s) => <option key={s} value={s}>{t(FLOORPLAN_SYMBOL_SHAPE_LABELS[s])}</option>)}
                    </select>
                    <input
                      className="w-10 shrink-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 text-center"
                      value={group.glyph ?? ""}
                      maxLength={2}
                      placeholder="S"
                      disabled={Boolean(group.symbolImageSrc)}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { glyph: e.target.value.trim() || undefined })}
                      title={group.symbolImageSrc ? t("An uploaded symbol carries no glyph — the picture is the symbol") : t("Up to two characters drawn inside the symbol")}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <span className="shrink-0" style={{ fontSize: 10 }}>{t("Outline")}</span>
                    <input
                      type="color"
                      value={group.outlineColor || DEFAULT_SYMBOL_OUTLINE}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { outlineColor: e.target.value })}
                      className="w-7 h-6 shrink-0 border border-[var(--color-border)] rounded cursor-pointer disabled:opacity-40"
                      disabled={(group.outlineWidthMm ?? 1) <= 0}
                      title={t("Outline color around the symbol body")}
                    />
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      className="w-16 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                      value={group.outlineWidthMm ?? Math.round(page.symbolSizeMm * DEFAULT_SYMBOL_OUTLINE_RATIO * 100) / 100}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { outlineWidthMm: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                      title={t("Outline thickness on paper in mm. 0 draws no outline.")}
                    />
                    <span style={{ fontSize: 10 }}>mm</span>
                    {(group.outlineColor !== undefined || group.outlineWidthMm !== undefined) && (
                      <button
                        className="px-1 py-0.5 text-[var(--color-text-muted)] hover:text-emerald-700"
                        onClick={() => updateFloorplanGroup(page.id, group.id, { outlineColor: undefined, outlineWidthMm: undefined })}
                        title={t("Back to the default outline")}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => { symbolImageTargetRef.current = group.id; symbolImageInputRef.current?.click(); }}
                      title={t("Upload your own symbol (PNG, JPG, WebP or SVG). It replaces the shape, the color and the glyph, and prints on the plan and in the legend.")}
                    >
                      {group.symbolImageSrc ? t("Replace symbol…") : t("Upload symbol…")}
                    </button>
                    {group.symbolImageSrc && (
                      <button
                        className="px-1 py-0.5 text-[var(--color-text-muted)] hover:text-red-600"
                        onClick={() => updateFloorplanGroup(page.id, group.id, { symbolImageSrc: undefined })}
                        title={t("Back to the drawn shape")}
                      >
                        ✕
                      </button>
                    )}
                    <div className="flex-1" />
                    <label className="flex items-center gap-1 text-[var(--color-text-muted)]" title={t("Direction new symbols of this group start at, in degrees clockwise. Turn a placed symbol with the Symbol control on the sheet.")}>
                      <span style={{ fontSize: 10 }}>{t("Turn")}</span>
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
                    placeholder={t("No. prefix")}
                    onChange={(e) => updateFloorplanGroup(page.id, group.id, { labelPrefix: e.target.value || undefined })}
                    title={t("Seed for auto-numbering, e.g. “SB.” or “4.1”")}
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
                            title={t("Upload a product shot (stored in the project, always printed)")}
                          >
                            {group.imageSrc ? t("Replace image") : t("Upload image…")}
                          </button>
                          {templateImage && !group.imageSrc && group.imageUrl !== templateImage && (
                            <button
                              className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                              onClick={() => updateFloorplanGroup(page.id, group.id, { imageUrl: templateImage })}
                              title={t("Use the device template's image")}
                            >
                              {t("Template image")}
                            </button>
                          )}
                          {shown && (
                            <button
                              className="px-1 py-0.5 text-[var(--color-text-muted)] hover:text-red-600"
                              onClick={() => updateFloorplanGroup(page.id, group.id, { imageSrc: undefined, imageUrl: undefined, imageCaption: undefined })}
                              title={t("Remove image")}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <input
                          className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                          value={group.imageUrl ?? ""}
                          placeholder={t("Image URL (template today, Odoo product later)")}
                          onChange={(e) => updateFloorplanGroup(page.id, group.id, { imageUrl: e.target.value || undefined })}
                          title={t("A remote image reference. Shown on screen; the PDF embeds it when the host allows — an uploaded image always wins.")}
                        />
                      </>
                    );
                  })()}
                  {(group.imageSrc || group.imageUrl) && (
                    <input
                      className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                      value={group.imageCaption ?? ""}
                      placeholder={t("Image caption, e.g. DM6SE")}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { imageCaption: e.target.value })}
                    />
                  )}
                  <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!group.hiddenInLegend}
                      onChange={(e) => updateFloorplanGroup(page.id, group.id, { hiddenInLegend: e.target.checked ? undefined : true })}
                    />
                    {t("Show in legend")}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
                      onClick={() => {
                        const start = prompt(t("Renumber this group starting at:"), group.labelPrefix ?? "1.1");
                        if (start?.trim()) renumberFloorplanGroup(page.id, group.id, start.trim());
                      }}
                      title={t("Renumber every symbol of this group in placement order")}
                    >
                      {t("Renumber")}
                    </button>
                    <div className="flex-1" />
                    <button
                      className="px-1.5 py-0.5 rounded text-red-500 hover:bg-red-500/10 hover:text-red-700"
                      onClick={() => {
                        const count = symbolCounts.get(group.id) ?? 0;
                        const question = count === 1
                          ? t("Delete “{group}” and its 1 symbol on this plan?", { group: group.label })
                          : t("Delete “{group}” and its {n} symbols on this plan?", { group: group.label, n: count });
                        if (count > 0 && !confirm(question)) return;
                        removeFloorplanGroup(page.id, group.id);
                        setExpandedGroupId(null);
                      }}
                    >
                      {t("Delete")}
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
          {t("Numbering")}
        </summary>
      <div className="px-2 pb-2 flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-[var(--color-text)]" title={t("Amplifier line / circuit the next symbols hang on. Speakers are numbered per line: 4.1, 4.2 …")}>
          <span className="shrink-0">{t("Line")}</span>
          <input
            className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
            value={activeLine}
            placeholder={isLoudspeaker ? t("e.g. 4 or SB") : t("optional")}
            onChange={(e) => onActiveLineChange(e.target.value)}
            list="floorplan-lines"
          />
          <datalist id="floorplan-lines">
            {lines.map((l) => <option key={l.line.lineNo} value={l.line.lineNo} />)}
          </datalist>
        </label>
        <label className="flex items-center gap-2 text-[var(--color-text)]" title={t("How labels are composed: {{line}}, {{n}}, {{group}}, {{device}}")}>
          <span className="shrink-0">{t("Label")}</span>
          <input
            className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 font-mono"
            value={page.labelTemplate ?? ""}
            placeholder={effectiveLabelTemplate(page)}
            onChange={(e) => updateFloorplanPage(page.id, { labelTemplate: e.target.value || undefined })}
          />
        </label>
        {!isLoudspeaker && !activeLine && (
          <p className="text-[var(--color-text-muted)] leading-snug">{t("Leave the line empty to continue each group's own numbering (1.1 → 1.2). Set a line to number per amplifier line instead.")}</p>
        )}
      </div>
      </details>

      {/* ── Lines ↔ amplifier channels ────────────────────────────── */}
      <details open>
        <summary className="px-2 pt-2 pb-1 flex items-center justify-between font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
        <span>{t("Lines & load")}</span>
        <button
          className="normal-case tracking-normal font-normal px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700"
          onClick={(e) => { e.preventDefault(); handleSyncLines(); }}
          title={t("Read the amplifier channels off the schematic: one line per channel with speakers, placed symbols moved onto their channel's line")}
        >
          {t("Sync from schematic")}
        </button>
        </summary>
      <div className="px-2 pb-2 flex flex-col gap-1.5">
        {lines.length === 0 && (
          <p className="text-[var(--color-text-muted)] leading-snug">
            {t("No lines yet. Drop speakers that are wired to an amplifier on the schematic — they take their channel's line automatically on a loudspeaker plan — or press Sync.")}
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
          <div key={amplifier.nodeId} className="flex items-center justify-between gap-1 text-[var(--color-text)] border border-dashed border-[var(--color-border)] rounded px-1.5 py-0.5" title={result.hasSpec ? t("Burst pool {burst} of {maxBurst} · average {avg} of {maxAvg}", { burst: formatWatt(result.totalRequestedW), maxBurst: formatWatt(result.limits?.maxBurstTotalW), avg: formatWatt(result.totalAverageW), maxAvg: formatWatt(result.limits?.maxAvgTotalW) }) : t("No amplifier load data on the template — open the device and fill in its ratings")}>
            <span className="truncate"><strong>{amplifier.label}</strong> · Σ {formatWatt(result.totalRequestedW)}{result.hasSpec ? ` / ${formatWatt(result.limits?.maxBurstTotalW)} · ${formatHeadroom(result.poolBurstHeadroomDb)}` : ""}</span>
            <StatusBadge status={result.hasSpec ? result.status : "no-data"} />
          </div>
        ))}
      </div>
      </details>

      {/* ── Legend box ────────────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          {t("Legend Box")}
        </summary>
      <div className="px-2 pb-4 flex flex-col gap-1.5">
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.visible}
            onChange={(e) => updateFloorplanLegend(page.id, { visible: e.target.checked })}
          />
          {t("Show legend on the sheet")}
        </label>
        <input
          className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
          value={page.legend.title}
          placeholder={t("Legend title")}
          onChange={(e) => updateFloorplanLegend(page.id, { title: e.target.value })}
        />
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.showImages}
            onChange={(e) => updateFloorplanLegend(page.id, { showImages: e.target.checked })}
          />
          {t("Product images")}
        </label>
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={page.legend.onlyUsedGroups}
            onChange={(e) => updateFloorplanLegend(page.id, { onlyUsedGroups: e.target.checked })}
          />
          {t("Only groups used on this plan")}
        </label>
        <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer" title={t("Logo, name, address and contact from Preferences → Company")}>
          <input
            type="checkbox"
            checked={page.legend.showCompany !== false}
            onChange={(e) => updateFloorplanLegend(page.id, { showCompany: e.target.checked })}
          />
          {t("Company block (logo, address)")}
        </label>
        <label className="flex items-center gap-2 text-[var(--color-text)]" title={t("Print the line table (line → amplifier channel, quantity, load) under the legend rows")}>
          <input type="checkbox" checked={legendShowsLines(page)} onChange={(e) => updateFloorplanLegend(page.id, { showLines: e.target.checked })} />
          {t("Show line table")}
        </label>
        {legendShowsLines(page) && (
          <input
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
            value={page.legend.linesTitle ?? ""}
            placeholder={t(DEFAULT_LEGEND_LINES_TITLE)}
            onChange={(e) => updateFloorplanLegend(page.id, { linesTitle: e.target.value || undefined })}
            title={t("Heading of the line table")}
          />
        )}
        <input
          className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
          value={page.legend.notesTitle ?? ""}
          placeholder={t("Notes heading")}
          onChange={(e) => updateFloorplanLegend(page.id, { notesTitle: e.target.value })}
        />
        <textarea
          className="w-full border border-[var(--color-border)] rounded px-1.5 py-1 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-y"
          rows={5}
          value={notesText}
          placeholder={t("One installation note per line")}
          onChange={(e) => updateFloorplanLegend(page.id, { notes: e.target.value.split("\n") })}
          data-allow-scroll
        />
      </div>
      </details>

      {/* ── Drawing block (Plankopf) ──────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          {t("Drawing Block")}
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
            <input type="checkbox" checked={block.visible} onChange={(e) => patchBlock({ visible: e.target.checked })} />
            {t("Show drawing block on the sheet")}
          </label>
          <input
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 font-semibold"
            value={block.title}
            placeholder={t("Drawing title, e.g. Ground floor")}
            onChange={(e) => patchBlock({ title: e.target.value })}
            title={t("Tokens: {{pageLabel}}, {{showName}}, {{scale}} …")}
          />
          <input
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
            value={block.subtitle ?? ""}
            placeholder={t("Subtitle, e.g. Loudspeaker layout")}
            onChange={(e) => patchBlock({ subtitle: e.target.value })}
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>{t("Fields")}</span>
            <button
              className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
              onClick={() => patchBlock({ fields: [...block.fields, { id: nextDrawingFieldId(), label: t("Field"), value: "" }] })}
            >
              + {t("Field")}
            </button>
          </div>
          {block.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1">
              <input
                className="w-[38%] border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 uppercase"
                style={{ fontSize: 10 }}
                value={f.label}
                placeholder={t("Label")}
                onChange={(e) => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <textarea
                className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-none leading-tight"
                rows={Math.max(1, Math.min(4, f.value.split("\n").length))}
                value={f.value}
                placeholder={t("Value or {{token}}")}
                title={t("Multi-line values (addresses) wrap onto several lines in the block")}
                onChange={(e) => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                data-allow-scroll
              />
              <button
                className={`px-1 rounded border ${f.wide ? "border-emerald-400 text-emerald-700 bg-emerald-500/10" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
                title={t("Span both columns")}
                onClick={() => patchBlock({ fields: block.fields.map((x, j) => (j === i ? { ...x, wide: !x.wide } : x)) })}
              >
                ⟷
              </button>
              <button
                className="px-1 text-[var(--color-text-muted)] hover:text-red-600"
                title={t("Remove field")}
                onClick={() => patchBlock({ fields: block.fields.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <p className="text-[var(--color-text-muted)] leading-snug" style={{ fontSize: 10 }}>
            {t("Tokens: {tokens} — resolved from the project title block and the page.", { tokens: FLOORPLAN_TOKENS.map((tok) => `{{${tok}}}`).join(" ") })}
          </p>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>{t("Revisions")}</span>
            <button
              className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
              onClick={() => patchBlock({
                revisions: [...block.revisions, { index: nextRevisionIndex(block.revisions), date: formatPlanDate(), description: "", author: "", checkedBy: "" }],
              })}
            >
              + {t("Revision")}
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
                title={t("Column header")}
              />
            ))}
          </div>
          {block.revisions.map((r, i) => (
            <div key={i} className="flex gap-1 items-center">
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "15%" }} value={r.index} onChange={(e) => patchRevision(i, { index: e.target.value })} title={t("Index")} />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "15%" }} value={r.date} onChange={(e) => patchRevision(i, { date: e.target.value })} title={t("Date")} />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0 flex-1" value={r.description} placeholder={t("Change")} onChange={(e) => patchRevision(i, { description: e.target.value })} title={t("Change")} />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "11%" }} value={r.author ?? ""} placeholder={t("By")} onChange={(e) => patchRevision(i, { author: e.target.value })} title={t("Drawn by")} />
              <input className="border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 min-w-0" style={{ width: "11%" }} value={r.checkedBy ?? ""} placeholder={t("Chk")} onChange={(e) => patchRevision(i, { checkedBy: e.target.value })} title={t("Checked by")} />
              <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" title={t("Remove revision")} onClick={() => patchBlock({ revisions: block.revisions.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}

          <textarea
            className="w-full border border-[var(--color-border)] rounded px-1.5 py-1 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 resize-y mt-1"
            rows={3}
            value={block.disclaimer ?? ""}
            placeholder={t("Small print above the title, e.g. “All dimensions to be verified on site …”")}
            onChange={(e) => patchBlock({ disclaimer: e.target.value })}
            data-allow-scroll
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
              <input type="checkbox" checked={block.showLogo} onChange={(e) => patchBlock({ showLogo: e.target.checked })} />
              {t("Logo")}
            </label>
            <label className="flex items-center gap-1 text-[var(--color-text)] cursor-pointer">
              <input type="checkbox" checked={block.showNorthArrow} onChange={(e) => patchBlock({ showNorthArrow: e.target.checked })} />
              {t("North arrow")}
            </label>
            {block.showNorthArrow && (
              <label className="flex items-center gap-1 text-[var(--color-text)]" title={t("North arrow rotation (° clockwise)")}>
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
      <details className="border-t border-[var(--color-border)]" open={page.masks.length > 0}>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          {t("Erased areas ({n})", { n: page.masks.length })}
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1">
          <p className="text-[var(--color-text-muted)] leading-snug">
            {t("White covers over the architect's plan — use")} <strong>▭ {t("Erase")}</strong>{" "}
            {t("on the sheet to drag one out over a legend, a note or a title block you want gone. Drag to move, corner to resize,")}{" "}
            <kbd>{t("Delete::key")}</kbd>{" "}
            {t("to remove. Turn one when the block underneath is not square to the sheet, and fade it to quiet the linework instead of erasing it.")}
          </p>
          {page.masks.map((m, i) => (
            <div key={m.id} className="border border-[var(--color-border)] rounded px-1.5 py-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[var(--color-text)]">
                <span>{t("Cover {n}", { n: i + 1 })} · {Math.round(m.sizeMm.w)} × {Math.round(m.sizeMm.h)} mm</span>
                <button
                  className={`px-1 shrink-0 ${m.locked ? "text-emerald-600" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                  onClick={() => updateFloorplanMask(page.id, m.id, { locked: m.locked ? undefined : true })}
                  title={m.locked ? t("Locked — click to let it be dragged again") : t("Lock it so placing symbols cannot nudge it")}
                >
                  {m.locked ? "🔒" : "🔓"}
                </button>
                <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" onClick={() => removeFloorplanMask(page.id, m.id)} title={t("Remove cover")}>✕</button>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <span className="shrink-0" style={{ fontSize: 10 }}>{t("Turn")}</span>
                <button
                  className="px-1 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                  onClick={() => updateFloorplanMask(page.id, m.id, { rotationDeg: (m.rotationDeg ?? 0) - 15 })}
                  title={t("Turn 15° counter-clockwise")}
                >
                  ⟲
                </button>
                <input
                  type="number"
                  step={5}
                  className="w-14 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={m.rotationDeg ?? 0}
                  onChange={(e) => updateFloorplanMask(page.id, m.id, { rotationDeg: Number(e.target.value) || 0 })}
                  title={t("Rotation in degrees clockwise — an architect's title block is not always square to the sheet. Resize the cover before turning it: the corner handle measures in the cover's unturned frame.")}
                />
                <button
                  className="px-1 rounded border border-[var(--color-border)] hover:border-emerald-400 hover:text-emerald-700"
                  onClick={() => updateFloorplanMask(page.id, m.id, { rotationDeg: (m.rotationDeg ?? 0) + 15 })}
                  title={t("Turn 15° clockwise")}
                >
                  ⟳
                </button>
                <span style={{ fontSize: 10 }}>°</span>
              </div>
              <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" title={t("Below 1 the cover fades what is underneath instead of erasing it — a way to quiet the architect's linework without losing it.")}>
                <span className="shrink-0" style={{ fontSize: 10 }}>{t("Opacity")}</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={m.opacity ?? 1}
                  onChange={(e) => updateFloorplanMask(page.id, m.id, { opacity: Number(e.target.value) })}
                  className="flex-1 min-w-0"
                />
                <span className="shrink-0 tabular-nums" style={{ fontSize: 10 }}>{Math.round((m.opacity ?? 1) * 100)}%</span>
              </label>
            </div>
          ))}
        </div>
      </details>

      {/* ── Walls ─────────────────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open={(page.walls ?? []).length > 0}>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          {t("Walls ({n})", { n: (page.walls ?? []).length })}
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1">
          <p className="text-[var(--color-text-muted)] leading-snug">
            {t("Trace the building with")} <strong>▨ {t("Wall")}</strong>{" "}
            {t("on the sheet: click along a run, click the last point again or press Enter to finish. Thickness is real millimetres — it is what the Wi-Fi heatmap attenuates through.")}
          </p>
          {(page.walls ?? []).map((w, i) => {
            const isSel = selection.kind === "wall" && selection.id === w.id;
            const band = (page.heatmap ?? DEFAULT_HEATMAP).band;
            return (
              <div
                key={w.id}
                className={`border rounded px-1.5 py-1 flex flex-col gap-1 cursor-pointer ${isSel ? "border-sky-400 bg-sky-500/10" : "border-[var(--color-border)] hover:border-sky-300"}`}
                onClick={() => onSelectionChange({ kind: "wall", id: w.id })}
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 rounded-sm" style={{ width: 12, height: 12, background: WALL_MATERIAL_COLORS[w.material] }} />
                  <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">
                    {w.label || t("Wall {n}", { n: i + 1 })}
                    <span className="text-[var(--color-text-muted)]">
                      {" · "}{w.thicknessMm} mm · {wallAttenuationDb(w, band, wallMaterials).toFixed(1)} dB
                    </span>
                  </span>
                  <button
                    className={`px-1 shrink-0 ${w.hidden ? "text-amber-600" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                    onClick={(e) => { e.stopPropagation(); updateFloorplanWall(page.id, w.id, { hidden: w.hidden ? undefined : true }); }}
                    title={w.hidden ? t("Hidden — and not counted in the heatmap") : t("Hide it, and take it out of the heatmap")}
                  >
                    {w.hidden ? "🚫" : "👁"}
                  </button>
                  <button
                    className="px-1 shrink-0 text-[var(--color-text-muted)] hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); removeFloorplanWall(page.id, w.id); if (isSel) onSelectionChange({ kind: "none" }); }}
                    title={t("Remove wall")}
                  >
                    ✕
                  </button>
                </div>
                {isSel && (
                  <>
                    <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" onClick={(e) => e.stopPropagation()}>
                      <span className="shrink-0 w-12">{t("Build-up")}</span>
                      <select
                        className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                        value={w.material}
                        onChange={(e) => updateFloorplanWall(page.id, w.id, { material: e.target.value as WallMaterial })}
                      >
                        {WALL_MATERIALS.map((m) => <option key={m} value={m}>{t(WALL_MATERIAL_LABELS[m])}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" onClick={(e) => e.stopPropagation()}>
                      <span className="shrink-0 w-12">{t("Thickness")}</span>
                      <input
                        type="number"
                        step={5}
                        min={5}
                        max={1000}
                        className="w-16 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                        value={w.thicknessMm}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v > 0) updateFloorplanWall(page.id, w.id, { thicknessMm: v });
                        }}
                      />
                      <span style={{ fontSize: 10 }}>mm</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {WALL_THICKNESS_PRESETS_MM.map((mm) => (
                        <button
                          key={mm}
                          className={`px-1.5 py-0.5 rounded border ${w.thicknessMm === mm ? "border-sky-400 text-sky-700 bg-sky-500/10" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-sky-300"}`}
                          onClick={() => updateFloorplanWall(page.id, w.id, { thicknessMm: mm })}
                          style={{ fontSize: 10 }}
                        >
                          {mm}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" onClick={(e) => e.stopPropagation()}>
                      <span className="shrink-0 w-12">{t("Label")}</span>
                      <input
                        className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                        value={w.label ?? ""}
                        placeholder={t("e.g. Brandwand")}
                        onChange={(e) => updateFloorplanWall(page.id, w.id, { label: e.target.value || undefined })}
                      />
                    </label>
                    <button
                      className="self-start px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-sky-400 hover:text-sky-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Same run, offset a little, so a parallel wall is two clicks
                        // rather than a re-trace.
                        const id = addFloorplanWall(page.id, {
                          ...w,
                          pointsMm: w.pointsMm.map((pt) => ({ x: pt.x + 5, y: pt.y + 5 })),
                          label: undefined,
                        });
                        onSelectionChange({ kind: "wall", id });
                      }}
                      title={t("Copy this run, offset slightly — for the parallel wall of a corridor.")}
                    >
                      {t("Duplicate")}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </details>

      {/* ── Wi-Fi heatmap ─────────────────────────────────────────── */}
      {(() => {
        const cfg = { ...DEFAULT_HEATMAP, ...(page.heatmap ?? {}) };
        const patchMap = (p: Parameters<typeof updateFloorplanHeatmap>[1]) => updateFloorplanHeatmap(page.id, p);
        const aps = collectAccessPoints(page, cfg.band, (nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          const templateId = (node?.data as DeviceData | undefined)?.templateId;
          return templateId ? lookupTemplate(templateId, customTemplates)?.wifi : undefined;
        });
        // The covered share is the number a hand-over is argued with, so it is computed
        // on a coarse grid here rather than reusing the drawn one — it has to be cheap
        // enough to sit in a panel that re-renders on every edit.
        const share = cfg.visible && aps.length > 0
          ? coveredFraction(
              computeHeatmap(aps, drawingAreaMm(page), {
                band: cfg.band,
                scaleDenominator: page.scaleDenominator,
                pathLossExponent: cfg.pathLossExponent,
                walls: page.walls ?? [],
                materialOverrides: wallMaterials,
                pitchMm: Math.max(6, cfg.gridMm * 3),
              }),
              -67,
            )
          : null;
        return (
          <details className="border-t border-[var(--color-border)]" open={cfg.visible}>
            <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
              {t("Wi-Fi heatmap")}
            </summary>
            <div className="px-2 pb-3 flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <input type="checkbox" checked={cfg.visible} onChange={(e) => patchMap({ visible: e.target.checked })} />
                <span>{t("Show the heatmap")}</span>
              </label>

              {aps.length === 0 ? (
                <p className="text-[var(--color-text-muted)] leading-snug">
                  {t("No access points on this plan yet. Drop a UniFi AP from the device library onto the sheet — a symbol linked to a model with a radio counts as one.")}
                </p>
              ) : (
                <p className="text-[var(--color-text-muted)] leading-snug">
                  {t("{n} access point(s) on this band", { n: aps.length })}
                  {share !== null && <> · <strong>{Math.round(share * 100)}%</strong> {t("at -67 dBm or better")}</>}
                </p>
              )}

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <span className="shrink-0 w-12">{t("Band")}</span>
                <select
                  className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                  value={cfg.band}
                  onChange={(e) => patchMap({ band: e.target.value as typeof cfg.band })}
                >
                  {WIFI_BANDS.map((b) => <option key={b} value={b}>{WIFI_BAND_LABELS[b]}</option>)}
                </select>
              </label>

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("2.0 is free space, 2.6 a normal office, 3.2 a subdivided or cluttered building. After the walls this is the biggest lever on the result.")}>
                <span className="shrink-0 w-12">{t("Building")}</span>
                <input
                  type="range"
                  min={2}
                  max={4}
                  step={0.1}
                  value={cfg.pathLossExponent}
                  onChange={(e) => patchMap({ pathLossExponent: Number(e.target.value) })}
                  className="flex-1 min-w-0"
                />
                <span className="shrink-0 tabular-nums" style={{ fontSize: 10 }}>n = {cfg.pathLossExponent.toFixed(1)}</span>
              </label>

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <span className="shrink-0 w-12">{t("Opacity")}</span>
                <input
                  type="range"
                  min={0.15}
                  max={0.9}
                  step={0.05}
                  value={cfg.opacity}
                  onChange={(e) => patchMap({ opacity: Number(e.target.value) })}
                  className="flex-1 min-w-0"
                />
                <span className="shrink-0 tabular-nums" style={{ fontSize: 10 }}>{Math.round(cfg.opacity * 100)}%</span>
              </label>

              <label className="flex items-center gap-2 text-[var(--color-text-muted)]" title={t("Sample spacing on paper. Finer is smoother and slower — the cost is samples × access points × walls.")}>
                <span className="shrink-0 w-12">{t("Detail")}</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={cfg.gridMm}
                  onChange={(e) => patchMap({ gridMm: Number(e.target.value) })}
                  className="flex-1 min-w-0"
                />
                <span className="shrink-0 tabular-nums" style={{ fontSize: 10 }}>{cfg.gridMm} mm</span>
              </label>

              {/* Legend: the -67 dBm step is the one installations are signed off against. */}
              <div className="flex flex-col gap-0.5 pt-0.5">
                {RSSI_STEPS.map((step) => (
                  <div key={step.label} className="flex items-center gap-1.5 text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
                    <span className="shrink-0 rounded-sm" style={{ width: 14, height: 10, background: step.color }} />
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>

              {aps.length > 0 && (
                <p className="text-[var(--color-text-muted)] leading-snug" style={{ fontSize: 10 }}>
                  {t("Free-run reach to -67 dBm, no walls:")}{" "}
                  {rangeForRssiM(aps[0], -67, cfg.band, cfg.pathLossExponent).toFixed(0)} m
                </p>
              )}
            </div>
          </details>
        );
      })()}

      {/* ── Measured wall attenuation ─────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]">
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          {t("Calibrate materials")}
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1">
          <p className="text-[var(--color-text-muted)] leading-snug">
            {t("The starting values are calibrated to typical measurements. Once you have measured on site, correct them here — a wall costs a fixed amount plus a share per centimetre, and the figures travel in the project file.")}
          </p>
          {WALL_MATERIALS.map((m) => {
            const spec = wallMaterials?.[m] ?? WALL_MATERIAL_DEFAULTS[m];
            const overridden = Boolean(wallMaterials?.[m]);
            return (
              <div key={m} className={`border rounded px-1.5 py-1 flex flex-col gap-1 ${overridden ? "border-sky-400 bg-sky-500/5" : "border-[var(--color-border)]"}`}>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 rounded-sm" style={{ width: 10, height: 10, background: WALL_MATERIAL_COLORS[m] }} />
                  <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">{t(WALL_MATERIAL_LABELS[m])}</span>
                  {overridden && (
                    <button
                      className="px-1 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      onClick={() => setWallMaterial(m, undefined)}
                      title={t("Back to the calibrated default")}
                      style={{ fontSize: 10 }}
                    >
                      {t("Reset")}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
                  <span className="shrink-0">{t("fixed")}</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    className="w-14 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={spec.baseDb}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) setWallMaterial(m, { ...spec, baseDb: v });
                    }}
                  />
                  <span className="shrink-0">dB +</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    className="w-14 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                    value={spec.perCmDb}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) setWallMaterial(m, { ...spec, perCmDb: v });
                    }}
                  />
                  <span className="shrink-0">{t("dB/cm")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* ── Coverage areas ────────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open={(page.coverages ?? []).length > 0}>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          {t("Coverage areas ({n})", { n: (page.coverages ?? []).length })}
        </summary>
        <div className="px-2 pb-3 flex flex-col gap-1">
          <p className="text-[var(--color-text-muted)] leading-snug">
            {t("What the cameras see and the detectors reach. Select a device above and hit")} <strong>◔ {t("Coverage")}</strong>{" "}
            {t("to give it an area that follows and turns with it, or use")} <strong>◔ {t("Coverage")}</strong>{" "}
            {t("on the sheet for a free-standing one. Drag the dot on its far edge to aim it and set the reach; ranges are metres on site.")}
          </p>
          {(page.coverages ?? []).map((c) => {
            const anchoredTo = c.symbolId ? page.symbols.find((sym) => sym.id === c.symbolId) : undefined;
            const isSel = selection.kind === "coverage" && selection.id === c.id;
            return (
              <div
                key={c.id}
                className={`border rounded px-1.5 py-1 flex items-center gap-1.5 cursor-pointer ${isSel ? "border-sky-400 bg-sky-500/10" : "border-[var(--color-border)] hover:border-sky-300"}`}
                onClick={() => onSelectionChange({ kind: "coverage", id: c.id })}
              >
                <span
                  className="shrink-0 rounded-sm border border-[var(--color-border)]"
                  style={{ width: 12, height: 12, background: coverageColor(c, page.groups), opacity: c.opacity ?? DEFAULT_COVERAGE_OPACITY }}
                />
                <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">
                  {c.label || t("Coverage")}
                  <span className="text-[var(--color-text-muted)]"> · {formatCoverageSpec(c)}</span>
                  {anchoredTo && <span className="text-[var(--color-text-muted)]"> · {anchoredTo.label}</span>}
                </span>
                <button
                  className={`px-1 shrink-0 ${c.hidden ? "text-amber-600" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                  onClick={(e) => { e.stopPropagation(); updateFloorplanCoverage(page.id, c.id, { hidden: c.hidden ? undefined : true }); }}
                  title={c.hidden ? t("Hidden — click to draw it again") : t("Hide it on this sheet")}
                >
                  {c.hidden ? "🚫" : "👁"}
                </button>
                <button
                  className="px-1 shrink-0 text-[var(--color-text-muted)] hover:text-red-600"
                  onClick={(e) => { e.stopPropagation(); removeFloorplanCoverage(page.id, c.id); if (isSel) onSelectionChange({ kind: "none" }); }}
                  title={t("Remove coverage")}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </details>

      {/* ── Notes on the plan ─────────────────────────────────────── */}
      <details className="border-t border-[var(--color-border)]" open>
        <summary className="px-2 pt-2 pb-1 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer select-none" style={{ fontSize: 9 }}>
          {t("Notes on the plan ({n})", { n: page.notes.length })}
        </summary>
        <div className="px-2 pb-4 flex flex-col gap-1.5">
          <button
            className="self-start px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-500/100/10 border border-transparent hover:border-emerald-200"
            onClick={() => {
              const area = drawingAreaMm(page);
              addFloorplanNote(page.id, { positionMm: { x: area.x + area.w / 2 - 30, y: area.y + area.h / 2 }, text: t("Note"), boxed: true });
            }}
            title={t("Adds a note at the sheet center — or use the ✎ Note tool to click it into place")}
          >
            + {t("Note")}
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
                <label className="flex items-center gap-1" title={t("Font size (mm)")}>
                  <input type="number" className="w-12 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400" min={1} max={20} step={0.2} value={n.fontSizeMm} onChange={(e) => updateFloorplanNote(page.id, n.id, { fontSizeMm: Number(e.target.value) || 2.8 })} />
                  mm
                </label>
                <input type="color" className="w-6 h-5 border border-[var(--color-border)] rounded cursor-pointer" value={n.color ?? "#111111"} onChange={(e) => updateFloorplanNote(page.id, n.id, { color: e.target.value })} title={t("Text color")} />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={Boolean(n.boxed)} onChange={(e) => updateFloorplanNote(page.id, n.id, { boxed: e.target.checked })} />
                  {t("Box")}
                </label>
                <div className="flex-1" />
                <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" onClick={() => removeFloorplanNote(page.id, n.id)} title={t("Delete note")}>✕</button>
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
  const t = useT();
  const [open, setOpen] = useState(false);
  const [lineNoDraft, setLineNoDraft] = useState<string | null>(null);
  const { line, channel, load, amp } = row;
  const mode: SpeakerLineMode = line.mode ?? load?.mode ?? "lo-z";
  const limits = amp?.limits;
  const modeSupported = (m: SpeakerLineMode) => !limits || (m === "lo-z" ? limits.supportsLoZ : m === "70v" ? limits.supports70V : limits.supports100V);
  const status: LoadStatus = load ? load.status : channel ? "no-data" : "empty";
  const tapChoices = [...new Set(speakerTaps.filter((w): w is number => typeof w === "number"))].sort((a, b) => b - a);
  const detail = load && load.speakerCount > 0
    ? [
        load.impedanceOhm !== undefined ? `Z ${formatOhm(load.impedanceOhm)}` : null,
        `P ${formatWatt(load.requestedW)}`,
        load.peakVoltageV !== undefined ? `Vpk ${Math.round(load.peakVoltageV)} V` : null,
        load.peakCurrentA !== undefined ? `Ipk ${Math.round(load.peakCurrentA * 10) / 10} A` : null,
        load.headroomDb !== undefined ? `${formatHeadroom(load.headroomDb)}${load.limitedBy ? ` (${t(LOAD_LIMITER_LABELS[load.limitedBy])})` : ""}` : null,
        load.speakersWithoutData > 0 ? t("{n} without load data", { n: load.speakersWithoutData }) : null,
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <div className={`border rounded ${active ? "border-emerald-400 bg-emerald-500/100/10" : "border-[var(--color-border)]"}`}>
      <div className="flex items-center gap-1 px-1.5 py-0.5 text-[var(--color-text)]">
        <button className="text-left flex-1 min-w-0 hover:text-emerald-700" onClick={onActivate} title={t("Make this the active line for the next symbols")}>
          {t("Line")} <strong>{line.lineNo}</strong>
          {line.name ? <span className="text-[var(--color-text-muted)]"> · {line.name}</span> : null}
          <span className="text-[var(--color-text-muted)]"> · {t("{n} placed", { n: row.placedCount })}{channel ? ` / ${t("{n} wired", { n: row.wiredCount })}` : ""}</span>
        </button>
        <StatusBadge status={status} title={detail ?? undefined} />
        <button className="px-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400 hover:text-emerald-700" onClick={() => setOpen((v) => !v)} title={open ? t("Collapse") : t("Wiring, mode and load")}>
          {open ? "▾" : "▸"}
        </button>
      </div>
      <div className="px-1.5 pb-1 text-[var(--color-text)] truncate" style={{ fontSize: 10 }} title={detail ?? undefined}>
        {channel ? `${channel.ampLabel} · ${channelShortLabel(channel)} · ${LINE_MODE_LABELS[mode]}` : t("not wired to an amplifier channel")}
        {detail ? ` — ${detail}` : ""}
      </div>
      {open && (
        <div className="px-1.5 pb-1.5 flex flex-col gap-1 border-t border-[var(--color-border)] pt-1">
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">{t("Number")}</span>
            <input
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
              value={lineNoDraft ?? line.lineNo}
              onChange={(e) => setLineNoDraft(e.target.value)}
              onBlur={() => { if (lineNoDraft !== null && lineNoDraft.trim() && lineNoDraft.trim() !== line.lineNo) onChange({ newLineNo: lineNoDraft.trim() }); setLineNoDraft(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              title={t("Renaming the line relabels its symbols")}
            />
          </label>
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">{t("Channel")}</span>
            <select
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 bg-[var(--color-surface)]"
              value={line.ampNodeId && line.ampPortId ? `${line.ampNodeId}::${line.ampPortId}` : ""}
              onChange={(e) => {
                const opt = channelOptions.find((o) => o.key === e.target.value);
                onChange(opt ? { ampNodeId: opt.ch.ampNodeId, ampPortId: opt.ch.portId } : { ampNodeId: undefined, ampPortId: undefined });
              }}
              title={t("Amplifier channel feeding this line (speaker-level output on the schematic)")}
            >
              <option value="">{t("— not wired —")}</option>
              {channelOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">{t("Mode")}</span>
            <select
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400 bg-[var(--color-surface)]"
              value={mode}
              onChange={(e) => onChange({ mode: e.target.value as SpeakerLineMode })}
              title={t("Low impedance or 70 V / 100 V constant-voltage line")}
            >
              {SPEAKER_LINE_MODES.map((m) => (
                <option key={m} value={m} disabled={!modeSupported(m)}>{LINE_MODE_LABELS[m]}{modeSupported(m) ? "" : ` ${t("(amp: n/a)")}`}</option>
              ))}
            </select>
          </label>
          {mode !== "lo-z" && (
            <label className="flex items-center gap-2 text-[var(--color-text)]">
              <span className="shrink-0 w-14">{t("Tap")}</span>
              <input
                type="number"
                min={0}
                step="any"
                className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
                value={line.tapW ?? ""}
                placeholder={tapChoices.length ? t("max ({w} W)", { w: tapChoices[0] }) : t("W per speaker")}
                list={`taps-${line.lineNo}`}
                onChange={(e) => onChange({ tapW: e.target.value === "" ? undefined : Number(e.target.value) })}
                title={t("Transformer tap per speaker in watts; empty = each speaker's highest tap")}
              />
              <datalist id={`taps-${line.lineNo}`}>
                {tapChoices.map((w) => <option key={w} value={w} />)}
              </datalist>
            </label>
          )}
          <label className="flex items-center gap-2 text-[var(--color-text)]">
            <span className="shrink-0 w-14">{t("Name")}</span>
            <input
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400"
              value={line.name ?? ""}
              placeholder={t("e.g. Terrasse")}
              onChange={(e) => onChange({ name: e.target.value || undefined })}
              title={t("Printed in the legend's line table")}
            />
          </label>
          {limits && (
            <p className="text-[var(--color-text-muted)] leading-snug" style={{ fontSize: 10 }}>
              {t("Amp limits: {perCh}/ch · Σ {total} burst · {v} V / {a} A peak · min {z}", { perCh: formatWatt(limits.maxBurstPerChannelW), total: formatWatt(limits.maxBurstTotalW), v: Math.round(limits.peakVoltageV), a: Math.round(limits.peakCurrentA), z: formatOhm(limits.minImpedanceOhm) })}
            </p>
          )}
          {channel && !amp?.hasSpec && (
            <p className="text-amber-600 leading-snug" style={{ fontSize: 10 }}>{t("The amplifier has no load data — fill in its ratings on the device (Load section) to get a verdict.")}</p>
          )}
          <div className="flex items-center gap-1">
            <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700" onClick={onRenumber} title={t("Renumber this line 1…n in placement order")}>
              {t("Renumber")}
            </button>
            {(line.ampNodeId || line.mode || line.name || line.tapW !== undefined) && (
              <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-red-400 hover:text-red-700" onClick={onForget} title={t("Drop the wiring / mode of this line; its symbols keep their numbers")}>
                {t("Forget wiring")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
