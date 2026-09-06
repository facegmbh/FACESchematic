import { useCallback, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import type { FloorplanKind, FloorplanPage, FloorplanUnderlay } from "../types";
import { PAPER_SIZES } from "../printConfig";
import { createDefaultLegend, drawingAreaMm, fillSheetPlacement, fitRectInArea, layoutDrawingBlock, matchPaperToSize, sheetSizeMm, FLOORPLAN_SCALES, formatScale } from "../floorplan";
import { UNDERLAY_ACCEPT, UNDERLAY_SIZE_WARN_BYTES, importUnderlayFile } from "../floorplanUnderlay";
import { runFloorplanExport } from "../floorplanExport";
import type { FloorplanTool } from "./FloorplanPage";

/** Source files kept per page for the session, so a PDF's page can be switched without
 *  asking the user to pick the file again. Not persisted — a reloaded project keeps the
 *  rasterized underlay but forgets the source file. */
const sourceFiles = new Map<string, File>();

interface Props {
  page: FloorplanPage;
  tool: FloorplanTool;
  onToolChange: (tool: FloorplanTool) => void;
}

export default function FloorplanToolbar({ page, tool, onToolChange }: Props) {
  const setFloorplanPaper = useSchematicStore((s) => s.setFloorplanPaper);
  const setFloorplanScale = useSchematicStore((s) => s.setFloorplanScale);
  const setFloorplanUnderlay = useSchematicStore((s) => s.setFloorplanUnderlay);
  const updateFloorplanUnderlay = useSchematicStore((s) => s.updateFloorplanUnderlay);
  const updateFloorplanPage = useSchematicStore((s) => s.updateFloorplanPage);
  const setFloorplanKind = useSchematicStore((s) => s.setFloorplanKind);
  const updateFloorplanLegend = useSchematicStore((s) => s.updateFloorplanLegend);
  const updateFloorplanDrawingBlock = useSchematicStore((s) => s.updateFloorplanDrawingBlock);
  const addToast = useSchematicStore((s) => s.addToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const underlay = page.underlay;
  const isCustomPaper = page.paperId === "custom";

  const applyImport = useCallback(async (file: File, pageNumber: number) => {
    setImporting(true);
    try {
      const imported = await importUnderlayFile(file, { pageNumber });
      // Keep an existing underlay's placement when only the PDF page changes — the user
      // has usually calibrated it already and every sheet of a set shares one scale.
      const keepPlacement = underlay && underlay.sourceName === imported.sourceName;

      // The architect's sheet IS the plan format: a PDF page carries its physical size, so
      // the sheet adopts it and the drawing covers the sheet edge to edge. Our legend and
      // drawing block then sit over the architect's own — instead of the plan being parked
      // on a differently shaped sheet next to a second set of boxes. Images have no
      // physical size and are fitted into the existing sheet.
      let sheetPage = page;
      if (!keepPlacement && imported.naturalSizeMm) {
        const choice = matchPaperToSize(imported.naturalSizeMm.w, imported.naturalSizeMm.h);
        setFloorplanPaper(page.id, choice.paperId, choice.orientation, choice.customWidthIn, choice.customHeightIn);
        sheetPage = { ...page, ...choice };
        // Boxes parked for the old format may now hang off the sheet (A1 landscape → A1
        // portrait loses 247 mm of width). Re-park only those — a box the user already
        // placed inside the new sheet stays where it is.
        const sheet = sheetSizeMm(sheetPage);
        const offSheet = (pos: { x: number; y: number }, w: number) => pos.x + w > sheet.w || pos.y > sheet.h;
        if (offSheet(page.legend.positionMm, page.legend.widthMm)) {
          updateFloorplanLegend(page.id, { positionMm: createDefaultLegend(sheetPage).positionMm });
        }
        if (offSheet(page.drawingBlock.positionMm, page.drawingBlock.widthMm)) {
          // Flush to the bottom-right of the border, measured with the real content — that is
          // where the architect's own title block sits, and ours should cover it.
          const { titleBlock, schematicName } = useSchematicStore.getState();
          const h = layoutDrawingBlock(page.drawingBlock, { titleBlock, page: sheetPage, projectName: schematicName }, { hasLogo: Boolean(titleBlock.logo) }).heightMm;
          const area = drawingAreaMm(sheetPage);
          updateFloorplanDrawingBlock(page.id, {
            positionMm: { x: area.x + area.w - page.drawingBlock.widthMm, y: Math.max(area.y, area.y + area.h - h) },
          });
        }
      }
      const fitted = imported.naturalSizeMm
        ? fillSheetPlacement(sheetPage, imported)
        : fitRectInArea(imported.naturalWidthPx, imported.naturalHeightPx, drawingAreaMm(sheetPage));
      const next: FloorplanUnderlay = {
        src: imported.src,
        kind: imported.kind,
        sourceName: imported.sourceName,
        pageNumber: imported.pageNumber,
        pageCount: imported.pageCount,
        naturalWidthPx: imported.naturalWidthPx,
        naturalHeightPx: imported.naturalHeightPx,
        positionMm: keepPlacement ? underlay.positionMm : fitted.positionMm,
        sizeMm: keepPlacement ? underlay.sizeMm : fitted.sizeMm,
        opacity: underlay?.opacity ?? 1,
        locked: underlay?.locked ?? false,
      };
      setFloorplanUnderlay(page.id, next);
      sourceFiles.set(page.id, file);
      if (imported.approxBytes > UNDERLAY_SIZE_WARN_BYTES) {
        addToast(
          `The plan is ${(imported.approxBytes / 1_000_000).toFixed(1)} MB — autosave to browser storage may fail. Save the project to a file.`,
          "info",
          6000,
        );
      } else if (!keepPlacement) {
        addToast(
          imported.naturalSizeMm
            ? "Plan imported — the sheet now has the plan's format. Calibrate it against a known dimension next."
            : "Plan imported — calibrate it against a known dimension next.",
          "success",
          4500,
        );
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Could not import that file.", "error", 6000);
    } finally {
      setImporting(false);
    }
  }, [page, underlay, setFloorplanUnderlay, setFloorplanPaper, updateFloorplanLegend, updateFloorplanDrawingBlock, addToast]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    void applyImport(file, 1);
  };

  const handlePdfPageChange = (pageNumber: number) => {
    const file = sourceFiles.get(page.id);
    if (!file) {
      addToast("Re-import the PDF to switch pages — the source file isn't in memory any more.", "info", 5000);
      return;
    }
    void applyImport(file, pageNumber);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-xs flex-wrap text-[var(--color-text)]" data-print-hide>
      {/* Plan type */}
      <label className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>Type</label>
      <select
        className="bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
        value={page.kind ?? "generic"}
        onChange={(e) => {
          const kind = e.target.value as FloorplanKind;
          if (kind === (page.kind ?? "generic")) return;
          if (confirm(`Switch to a ${kind === "loudspeaker" ? "loudspeaker" : "generic"} plan? Legend title, notes heading, revision headers and drawing block field labels are reset to that type's preset.`)) {
            setFloorplanKind(page.id, kind);
          }
        }}
        title="Loudspeaker plans number symbols per amplifier line (4.1, 4.2 …) and carry the Beschallungsplan presets"
      >
        <option value="generic">Generic plan</option>
        <option value="loudspeaker">Loudspeaker plan</option>
      </select>

      <div className="border-l border-[var(--color-border)] h-4" />

      {/* Paper size */}
      <label className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>Paper</label>
      <select
        className="bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
        value={page.paperId}
        onChange={(e) => setFloorplanPaper(page.id, e.target.value, page.orientation, page.customWidthIn, page.customHeightIn)}
      >
        {PAPER_SIZES.map((ps) => <option key={ps.id} value={ps.id}>{ps.label}</option>)}
        <option value="custom">Custom</option>
      </select>

      {isCustomPaper && (
        <>
          <input
            type="number"
            min={1}
            max={200}
            step={0.01}
            value={page.customWidthIn ?? 24}
            onChange={(e) => setFloorplanPaper(page.id, "custom", page.orientation, Number(e.target.value), page.customHeightIn ?? 36)}
            className="w-16 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
            title="Width (in)"
          />
          <span className="text-[var(--color-text-muted)]">×</span>
          <input
            type="number"
            min={1}
            max={200}
            step={0.01}
            value={page.customHeightIn ?? 36}
            onChange={(e) => setFloorplanPaper(page.id, "custom", page.orientation, page.customWidthIn ?? 24, Number(e.target.value))}
            className="w-16 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
            title="Height (in)"
          />
          <span className="text-[var(--color-text-muted)]" style={{ fontSize: 9 }}>in</span>
        </>
      )}

      <button
        className={`px-2 py-0.5 rounded border text-xs transition-colors ${page.orientation === "landscape" ? "bg-emerald-500/10 border-emerald-400 text-emerald-700" : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-border)]"}`}
        onClick={() => setFloorplanPaper(page.id, page.paperId, page.orientation === "landscape" ? "portrait" : "landscape", page.customWidthIn, page.customHeightIn)}
      >
        {page.orientation === "landscape" ? "↔ Landscape" : "↕ Portrait"}
      </button>

      <div className="border-l border-[var(--color-border)] h-4" />

      {/* Drawing scale */}
      <label className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>Scale</label>
      <select
        className="bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
        value={FLOORPLAN_SCALES.includes(page.scaleDenominator) ? String(page.scaleDenominator) : "custom"}
        onChange={(e) => {
          if (e.target.value === "custom") return;
          setFloorplanScale(page.id, Number(e.target.value));
        }}
        title="Drawing scale — 1:50 means 1 mm on paper is 50 mm on site"
      >
        {FLOORPLAN_SCALES.map((s) => <option key={s} value={s}>{formatScale(s)}</option>)}
        {!FLOORPLAN_SCALES.includes(page.scaleDenominator) && (
          <option value="custom">{formatScale(page.scaleDenominator)}</option>
        )}
      </select>
      <input
        type="number"
        min={1}
        max={5000}
        step={1}
        value={page.scaleDenominator}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v > 0) setFloorplanScale(page.id, v);
        }}
        className="w-16 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
        title="Custom scale denominator"
      />

      <div className="border-l border-[var(--color-border)] h-4" />

      {/* Underlay */}
      <input
        ref={fileInputRef}
        type="file"
        accept={UNDERLAY_ACCEPT}
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
      />
      <button
        className="px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700 transition-colors disabled:opacity-50"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
        title="Import an architect's drawing (PDF or image) as the underlay"
      >
        {importing ? "Importing…" : underlay ? "Replace Plan…" : "Import Plan…"}
      </button>

      {underlay && (
        <>
          <span className="text-[var(--color-text-muted)] truncate max-w-[160px]" title={underlay.sourceName}>
            {underlay.sourceName}
          </span>
          {underlay.kind === "pdf" && (underlay.pageCount ?? 1) > 1 && (
            <label className="flex items-center gap-1 text-[var(--color-text)]">
              Page
              <input
                type="number"
                min={1}
                max={underlay.pageCount}
                value={underlay.pageNumber ?? 1}
                onChange={(e) => handlePdfPageChange(Number(e.target.value))}
                className="w-12 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-1 py-0.5 text-xs outline-none focus:border-emerald-400"
              />
              <span className="text-[var(--color-text-muted)]">/ {underlay.pageCount}</span>
            </label>
          )}
          <label className="flex items-center gap-1 text-[var(--color-text)]" title="Underlay opacity">
            <span style={{ fontSize: 9 }}>OPACITY</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={underlay.opacity ?? 1}
              onChange={(e) => updateFloorplanUnderlay(page.id, { opacity: Number(e.target.value) })}
              className="w-20"
            />
          </label>
          <button
            className={`px-2 py-0.5 rounded border text-xs transition-colors ${underlay.locked ? "bg-emerald-500/10 border-emerald-400 text-emerald-700" : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-border)]"}`}
            onClick={() => updateFloorplanUnderlay(page.id, { locked: !underlay.locked })}
            title={underlay.locked ? "Underlay is locked — click to unlock" : "Lock the underlay so it can't be dragged while placing symbols"}
          >
            {underlay.locked ? "🔒 Locked" : "🔓 Unlocked"}
          </button>
          <button
            className="px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700 transition-colors"
            onClick={() => updateFloorplanUnderlay(page.id, fillSheetPlacement(page, underlay))}
            title="Lay the plan over the whole sheet again (edge to edge, aspect kept)"
          >
            ⤢ Fill Sheet
          </button>
          <button
            className={`px-2 py-0.5 rounded border text-xs transition-colors ${tool === "calibrate" ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-amber-400"}`}
            onClick={() => onToolChange(tool === "calibrate" ? "select" : "calibrate")}
            title="Click two points a known distance apart, then enter that distance"
          >
            📏 Calibrate
          </button>
          <span className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }} title="Real-world size of one pixel of the imported drawing">
            {underlay.mmPerPx ? `${underlay.mmPerPx.toFixed(1)} mm/px` : "not calibrated"}
          </span>
          <button
            className="px-2 py-0.5 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded border border-transparent hover:border-red-200 transition-colors"
            onClick={() => {
              if (confirm("Remove the underlay? Symbols stay where they are.")) {
                setFloorplanUnderlay(page.id, undefined);
                sourceFiles.delete(page.id);
              }
            }}
          >
            Remove
          </button>
        </>
      )}

      <div className="flex-1" />

      {/* Symbol size */}
      <label className="flex items-center gap-1 text-[var(--color-text)]" title="Symbol diameter on paper (mm)">
        <span style={{ fontSize: 9 }}>SYMBOL</span>
        <input
          type="number"
          min={1}
          max={30}
          step={0.5}
          value={page.symbolSizeMm}
          onChange={(e) => updateFloorplanPage(page.id, { symbolSizeMm: Number(e.target.value) })}
          className="w-14 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-1 py-0.5 text-xs outline-none focus:border-emerald-400"
        />
        <span style={{ fontSize: 9 }}>MM</span>
      </label>

      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="checkbox"
          checked={page.showTitleBlock}
          onChange={(e) => updateFloorplanPage(page.id, { showTitleBlock: e.target.checked })}
        />
        <span className="text-[var(--color-text)]">Title Block</span>
      </label>

      <button
        className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
        onClick={() => { void runFloorplanExport(); }}
      >
        Export PDF
      </button>
    </div>
  );
}
