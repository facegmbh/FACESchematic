import { useCallback, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import type { FloorplanKind, FloorplanPage, FloorplanUnderlay } from "../types";
import { PAPER_SIZES } from "../printConfig";
import { createDefaultLegend, drawingAreaMm, fillSheetPlacement, fitRectInArea, layoutDrawingBlock, matchPaperToSize, sheetSizeMm, FLOORPLAN_SCALES, formatScale } from "../floorplan";
import { UNDERLAY_ACCEPT, UNDERLAY_DPI_CHOICES, UNDERLAY_SIZE_WARN_BYTES, importUnderlayFile, readPdfLayers } from "../floorplanUnderlay";
import { MAX_STORED_SOURCE_BYTES, getUnderlaySource, nextUnderlaySourceKey, putUnderlaySource } from "../underlaySource";
import { runFloorplanExport } from "../floorplanExport";
import { useT } from "../i18n";
import type { FloorplanTool } from "./FloorplanPage";

/** Source files kept per page for the session, so a PDF's page can be switched without
 *  asking the user to pick the file again. Not persisted — a reloaded project keeps the
 *  rasterized underlay but forgets the source file. */

interface Props {
  page: FloorplanPage;
  tool: FloorplanTool;
  onToolChange: (tool: FloorplanTool) => void;
}

export default function FloorplanToolbar({ page, tool, onToolChange }: Props) {
  const t = useT();
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
  const [layerPanel, setLayerPanel] = useState(false);

  const underlay = page.underlay;
  const isCustomPaper = page.paperId === "custom";

  const applyImport = useCallback(async (file: File, pageNumber: number, layers?: Record<string, boolean>, dpi?: number) => {
    setImporting(true);
    try {
      const imported = await importUnderlayFile(file, { pageNumber, layers, dpi });
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
        pdfLayers: imported.layers,
        dpi: imported.dpi,
        // Re-rendering the same source — another page of the set, or a different layer
        // choice — must not throw away a calibration the user already did. The raster keeps
        // its resolution, so mm-per-pixel still holds.
        ...(keepPlacement && underlay?.mmPerPx !== undefined ? { mmPerPx: underlay.mmPerPx } : {}),
      };
      // Keep the source so the plan can be redrawn later — another page, other layers, a
      // different resolution — including after a reload. A re-render of the same source
      // reuses its key; a different file gets a new one and the old bytes are dropped.
      const sameSource = keepPlacement && underlay?.sourceKey;
      const sourceKey = sameSource || nextUnderlaySourceKey();
      const kept = await putUnderlaySource(sourceKey, file);
      setFloorplanUnderlay(page.id, { ...next, sourceKey: kept ? sourceKey : undefined });
      if (!kept) {
        addToast(
          t("The plan is too large to keep in the browser (over {mb} MB). Changing its page, layers or resolution will need a re-import after a reload.", { mb: Math.round(MAX_STORED_SOURCE_BYTES / 1_000_000) }),
          "info",
          7000,
        );
      }
      if (dpi !== undefined && imported.dpi !== undefined && imported.dpi < dpi * 0.9) {
        addToast(
          t("Rasterized at {actual} dpi — {wanted} dpi would need a bigger image than the browser can build for this sheet size.", { actual: imported.dpi, wanted: dpi }),
          "info",
          6000,
        );
      }
      if (imported.approxBytes > UNDERLAY_SIZE_WARN_BYTES) {
        addToast(
          t("The plan is {mb} MB — autosave to browser storage may fail. Save the project to a file.", { mb: (imported.approxBytes / 1_000_000).toFixed(1) }),
          "info",
          6000,
        );
      } else if (!keepPlacement) {
        addToast(
          imported.naturalSizeMm
            ? t("Plan imported — the sheet now has the plan's format. Calibrate it against a known dimension next.")
            : t("Plan imported — calibrate it against a known dimension next."),
          "success",
          4500,
        );
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : t("Could not import that file."), "error", 6000);
    } finally {
      setImporting(false);
    }
  }, [page, underlay, setFloorplanUnderlay, setFloorplanPaper, updateFloorplanLegend, updateFloorplanDrawingBlock, addToast]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    void (async () => {
      // A layered plan is worth asking about before it is baked into a raster: an architect
      // ships furniture, electrical and dimensions as layers, and a loudspeaker sheet wants
      // a quieter background than a cable sheet.
      const layers = await readPdfLayers(file).catch(() => []);
      await applyImport(file, 1);
      if (layers.length > 0) setLayerPanel(true);
    })();
  };

  const handleLayerToggle = (id: string, visible: boolean) => {
    const current = underlay?.pdfLayers;
    if (!current) return;
    const choice: Record<string, boolean> = {};
    for (const l of current) choice[l.id] = l.id === id ? visible : l.visible;
    void withSource((file) => { void applyImport(file, underlay?.pageNumber ?? 1, choice, underlay?.dpi); });
  };

  const layerChoiceOf = (u: typeof underlay) =>
    u?.pdfLayers ? Object.fromEntries(u.pdfLayers.map((l) => [l.id, l.visible])) : undefined;

  const handleDpiChange = (dpi: number) => {
    void withSource((file) => { void applyImport(file, underlay?.pageNumber ?? 1, layerChoiceOf(underlay), dpi); });
  };

  /** The source PDF, or a note saying why the plan cannot be redrawn. */
  const withSource = async (run: (file: File) => void) => {
    const file = await getUnderlaySource(underlay?.sourceKey);
    if (!file) {
      addToast(t("Re-import the PDF to change this — its source file isn't available any more."), "info", 5000);
      return;
    }
    run(file);
  };

  const handlePdfPageChange = (pageNumber: number) => {
    void withSource((file) => { void applyImport(file, pageNumber, layerChoiceOf(underlay), underlay?.dpi); });
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-xs flex-wrap text-[var(--color-text)]" data-print-hide>
      {/* Plan type */}
      <label className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>{t("Type")}</label>
      <select
        className="bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
        value={page.kind ?? "generic"}
        onChange={(e) => {
          const kind = e.target.value as FloorplanKind;
          if (kind === (page.kind ?? "generic")) return;
          const message = kind === "loudspeaker"
            ? t("Switch to a loudspeaker plan? Legend title, notes heading, revision headers and drawing block field labels are reset to that type's preset.")
            : kind === "wifi"
            ? t("Switch to a Wi-Fi coverage plan? Legend title, notes heading, revision headers and drawing block field labels are reset to that type's preset, symbols are numbered AP1, AP2 … and the heatmap is switched on.")
            : t("Switch to a generic plan? Legend title, notes heading, revision headers and drawing block field labels are reset to that type's preset.");
          if (confirm(message)) {
            setFloorplanKind(page.id, kind);
          }
        }}
        title={t("Loudspeaker plans number symbols per amplifier line (4.1, 4.2 …) and carry the Beschallungsplan presets. A Wi-Fi coverage plan numbers access points AP1, AP2 …, switches the heatmap on and prints the signal colour key in the legend.")}
      >
        <option value="generic">{t("Generic plan")}</option>
        <option value="loudspeaker">{t("Loudspeaker plan")}</option>
        <option value="wifi">{t("Wi-Fi coverage plan")}</option>
      </select>

      <div className="border-l border-[var(--color-border)] h-4" />

      {/* Paper size */}
      <label className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>{t("Paper")}</label>
      <select
        className="bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
        value={page.paperId}
        onChange={(e) => setFloorplanPaper(page.id, e.target.value, page.orientation, page.customWidthIn, page.customHeightIn)}
      >
        {PAPER_SIZES.map((ps) => <option key={ps.id} value={ps.id}>{ps.label}</option>)}
        <option value="custom">{t("Custom")}</option>
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
            title={t("Width (in)")}
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
            title={t("Height (in)")}
          />
          <span className="text-[var(--color-text-muted)]" style={{ fontSize: 9 }}>in</span>
        </>
      )}

      <button
        className={`px-2 py-0.5 rounded border text-xs transition-colors ${page.orientation === "landscape" ? "bg-emerald-500/10 border-emerald-400 text-emerald-700" : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-border)]"}`}
        onClick={() => setFloorplanPaper(page.id, page.paperId, page.orientation === "landscape" ? "portrait" : "landscape", page.customWidthIn, page.customHeightIn)}
      >
        {page.orientation === "landscape" ? `↔ ${t("Landscape")}` : `↕ ${t("Portrait")}`}
      </button>

      <div className="border-l border-[var(--color-border)] h-4" />

      {/* Drawing scale */}
      <label className="text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>{t("Scale")}</label>
      <select
        className="bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-emerald-400"
        value={FLOORPLAN_SCALES.includes(page.scaleDenominator) ? String(page.scaleDenominator) : "custom"}
        onChange={(e) => {
          if (e.target.value === "custom") return;
          setFloorplanScale(page.id, Number(e.target.value));
        }}
        title={t("Drawing scale — 1:50 means 1 mm on paper is 50 mm on site")}
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
        title={t("Custom scale denominator")}
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
        title={t("Import an architect's drawing (PDF or image) as the underlay")}
      >
        {importing ? t("Importing…") : underlay ? t("Replace Plan…") : t("Import Plan…")}
      </button>

      {underlay && (
        <>
          <span className="text-[var(--color-text-muted)] truncate max-w-[160px]" title={underlay.sourceName}>
            {underlay.sourceName}
          </span>
          {underlay.kind === "pdf" && (underlay.pageCount ?? 1) > 1 && (
            <label className="flex items-center gap-1 text-[var(--color-text)]">
              {t("Page")}
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
          {underlay.kind === "pdf" && (
            <label className="flex items-center gap-1 text-[var(--color-text)]" title={t("How finely the PDF is rasterized, in dots per inch of the real sheet. Higher keeps room labels and dimension text readable when zoomed, at the cost of project size. Above roughly 300 dpi an A1 plan outgrows the browser autosave, so save the project to a file. The value shown is what was actually achieved — a big sheet caps it.")}>
              <span style={{ fontSize: 9 }}>{t("QUALITY")}</span>
              <select
                className="bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-1 py-0.5 text-xs outline-none focus:border-emerald-400"
                value={underlay.dpi ?? ""}
                disabled={importing}
                onChange={(e) => { if (e.target.value) handleDpiChange(Number(e.target.value)); }}
              >
                {/* A plan imported before the resolution was recorded has no dpi to show. */}
                {underlay.dpi === undefined && <option value="">—</option>}
                {underlay.dpi !== undefined && !UNDERLAY_DPI_CHOICES.includes(underlay.dpi as (typeof UNDERLAY_DPI_CHOICES)[number]) && (
                  <option value={underlay.dpi}>{underlay.dpi} dpi</option>
                )}
                {UNDERLAY_DPI_CHOICES.map((d) => <option key={d} value={d}>{d} dpi</option>)}
              </select>
            </label>
          )}
          {(underlay.pdfLayers?.length ?? 0) > 0 && (
            <div className="relative">
              <button
                className={`px-2 py-0.5 rounded border text-xs transition-colors ${layerPanel ? "bg-emerald-500/10 border-emerald-400 text-emerald-700" : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-emerald-400"}`}
                onClick={() => setLayerPanel((v) => !v)}
                title={t("Layers of the source PDF — pick what gets drawn into the plan")}
              >
                ▤ {t("Layers")} ({underlay.pdfLayers!.filter((l) => l.visible).length}/{underlay.pdfLayers!.length})
              </button>
              {layerPanel && (
                <div className="absolute z-40 mt-1 left-0 w-64 max-h-80 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg p-2 flex flex-col gap-1" data-allow-scroll>
                  <div className="flex items-center justify-between pb-1 border-b border-[var(--color-border)]">
                    <span className="font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>
                      {t("PDF layers")}
                    </span>
                    <button className="px-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" onClick={() => setLayerPanel(false)} title={t("Close")}>✕</button>
                  </div>
                  {underlay.pdfLayers!.map((layer) => (
                    <label key={layer.id} className="flex items-center gap-1.5 text-[var(--color-text)] cursor-pointer hover:bg-[var(--color-surface-hover)] rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        disabled={importing}
                        onChange={(e) => handleLayerToggle(layer.id, e.target.checked)}
                      />
                      <span className="truncate" title={layer.name}>{layer.name}</span>
                    </label>
                  ))}
                  <p className="text-[var(--color-text-muted)] leading-snug pt-1" style={{ fontSize: 10 }}>
                    {t("Ticking redraws the plan from the PDF, so the source file has to still be open in this session. The placement and the calibration stay as they are.")}
                  </p>
                </div>
              )}
            </div>
          )}
          <label className="flex items-center gap-1 text-[var(--color-text)]" title={t("Underlay opacity")}>
            <span style={{ fontSize: 9 }}>{t("OPACITY")}</span>
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
            title={underlay.locked ? t("Underlay is locked — click to unlock") : t("Lock the underlay so it can't be dragged while placing symbols")}
          >
            {underlay.locked ? `🔒 ${t("Locked")}` : `🔓 ${t("Unlocked")}`}
          </button>
          <button
            className="px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-emerald-400 hover:text-emerald-700 transition-colors"
            onClick={() => updateFloorplanUnderlay(page.id, fillSheetPlacement(page, underlay))}
            title={t("Lay the plan over the whole sheet again (edge to edge, aspect kept)")}
          >
            ⤢ {t("Fill Sheet")}
          </button>
          <button
            className={`px-2 py-0.5 rounded border text-xs transition-colors ${tool === "calibrate" ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-amber-400"}`}
            onClick={() => onToolChange(tool === "calibrate" ? "select" : "calibrate")}
            title={t("Click two points a known distance apart, then enter that distance")}
          >
            📏 {t("Calibrate")}
          </button>
          <span className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }} title={t("Real-world size of one pixel of the imported drawing")}>
            {underlay.mmPerPx ? `${underlay.mmPerPx.toFixed(1)} mm/px` : t("not calibrated")}
          </span>
          <button
            className="px-2 py-0.5 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded border border-transparent hover:border-red-200 transition-colors"
            onClick={() => {
              if (confirm(t("Remove the underlay? Symbols stay where they are."))) {
                setFloorplanUnderlay(page.id, undefined);

              }
            }}
          >
            {t("Remove")}
          </button>
        </>
      )}

      <div className="flex-1" />

      {/* Symbol size */}
      <label className="flex items-center gap-1 text-[var(--color-text)]" title={t("Symbol diameter on paper (mm)")}>
        <span style={{ fontSize: 9 }}>{t("SYMBOL")}</span>
        <input
          type="number"
          min={1}
          max={30}
          step={0.5}
          value={page.symbolSizeMm}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next) || next <= 0) return;
            // The number beside a symbol grows with it: a 20 mm symbol labelled at 3.5 mm
            // reads as a mistake on a plan. It stays adjustable on its own below.
            const ratio = page.symbolSizeMm > 0 ? next / page.symbolSizeMm : 1;
            updateFloorplanPage(page.id, {
              symbolSizeMm: next,
              labelSizeMm: Math.round(page.labelSizeMm * ratio * 100) / 100,
            });
          }}
          className="w-14 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-1 py-0.5 text-xs outline-none focus:border-emerald-400"
        />
        <span style={{ fontSize: 9 }}>MM</span>
      </label>

      {/* Label size — follows the symbol, and can be set on its own afterwards */}
      <label className="flex items-center gap-1 text-[var(--color-text)]" title={t("Height of the number next to a symbol on paper (mm)")}>
        <span style={{ fontSize: 9 }}>{t("LABEL")}</span>
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.5}
          value={page.labelSizeMm}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next) && next > 0) updateFloorplanPage(page.id, { labelSizeMm: next });
          }}
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
        <span className="text-[var(--color-text)]">{t("Title Block")}</span>
      </label>

      <button
        className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
        onClick={() => { void runFloorplanExport(); }}
      >
        {t("Export PDF")}
      </button>
    </div>
  );
}
