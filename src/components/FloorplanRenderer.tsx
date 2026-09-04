import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import { resolveDeviceLabel } from "../displayName";
import {
  buildLegendRows,
  clampToSheet,
  drawingAreaMm,
  formatMetres,
  formatScale,
  legendHeightMm,
  measureRealDistanceMm,
  sheetSizeMm,
  symbolLabelAnchor,
  symbolPolygon,
  LEGEND_NOTES_GAP_MM,
  LEGEND_NOTES_TITLE_MM,
  LEGEND_NOTE_LINE_MM,
  LEGEND_PAD_MM,
  LEGEND_ROW_MM,
  LEGEND_ROW_WITH_IMAGE_MM,
  type Vec2,
} from "../floorplan";
import { TITLE_BLOCK_HEIGHT_IN } from "../printConfig";
import TitleBlockSVG from "./TitleBlockSVG";
import { FLOORPLAN_DEVICE_MIME } from "./FloorplanSidebar";
import type { DeviceData, FloorplanPage, FloorplanSymbol, FloorplanSymbolGroup } from "../types";
import type { FloorplanTool } from "./FloorplanPage";

const IN_TO_MM = 25.4;
const SCREEN_PPI = 96;
/** Symbol positions snap to this grid on paper; hold Alt for free placement. */
const SNAP_MM = 0.5;

interface Props {
  page: FloorplanPage;
  tool: FloorplanTool;
  onToolChange: (tool: FloorplanTool) => void;
  activeGroupId: string | null;
  onActiveGroupChange: (groupId: string) => void;
}

type Selection =
  | { kind: "none" }
  | { kind: "symbols"; ids: string[] }
  | { kind: "underlay" }
  | { kind: "legend" };

type DragState =
  | { kind: "symbols"; startClient: Vec2; starts: Record<string, Vec2> }
  | { kind: "underlay"; startClient: Vec2; start: Vec2 }
  | { kind: "underlay-resize"; startClient: Vec2; startSize: { w: number; h: number } }
  | { kind: "legend"; startClient: Vec2; start: Vec2 }
  | { kind: "legend-resize"; startClient: Vec2; startWidth: number }
  | { kind: "label"; symbolId: string; startClient: Vec2; start: Vec2 };

/** One symbol drawn on the sheet: the shape plus its number. */
function SymbolGlyph({ group, sizePx }: { group: FloorplanSymbolGroup; sizePx: number }) {
  const half = sizePx / 2;
  const pts = symbolPolygon(group.shape, sizePx)
    .map((p) => `${p.x + half},${p.y + half}`)
    .join(" ");
  return (
    <svg width={sizePx} height={sizePx} style={{ display: "block", overflow: "visible" }}>
      {group.shape === "circle" ? (
        <circle cx={half} cy={half} r={half} fill={group.color} stroke="#00000066" strokeWidth={Math.max(0.5, sizePx * 0.04)} />
      ) : (
        <polygon points={pts} fill={group.color} stroke="#00000066" strokeWidth={Math.max(0.5, sizePx * 0.04)} />
      )}
    </svg>
  );
}

export default function FloorplanRenderer({ page, tool, onToolChange, activeGroupId, onActiveGroupChange }: Props) {
  const nodes = useSchematicStore((s) => s.nodes);
  const allPages = useSchematicStore((s) => s.pages);
  const titleBlock = useSchematicStore((s) => s.titleBlock);
  const titleBlockLayout = useSchematicStore((s) => s.titleBlockLayout);
  const panMode = useSchematicStore((s) => s.panMode);
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const addFloorplanSymbol = useSchematicStore((s) => s.addFloorplanSymbol);
  const updateFloorplanSymbol = useSchematicStore((s) => s.updateFloorplanSymbol);
  const removeFloorplanSymbol = useSchematicStore((s) => s.removeFloorplanSymbol);
  const addFloorplanGroup = useSchematicStore((s) => s.addFloorplanGroup);
  const updateFloorplanUnderlay = useSchematicStore((s) => s.updateFloorplanUnderlay);
  const updateFloorplanLegend = useSchematicStore((s) => s.updateFloorplanLegend);
  const calibrateFloorplan = useSchematicStore((s) => s.calibrateFloorplan);
  const addToast = useSchematicStore((s) => s.addToast);

  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const sheet = sheetSizeMm(page);
  const pageWPx = (sheet.w / IN_TO_MM) * SCREEN_PPI;
  const pageHPx = (sheet.h / IN_TO_MM) * SCREEN_PPI;
  const mmToPx = useCallback((mm: number) => (mm / IN_TO_MM) * SCREEN_PPI, []);

  const area = drawingAreaMm(page);
  const marginPx = mmToPx(area.x);

  // Title block geometry — same placement as print sheets.
  const tbHeightPx = (titleBlockLayout?.heightIn ?? TITLE_BLOCK_HEIGHT_IN) * SCREEN_PPI;
  const tbWidthPx = Math.min((titleBlockLayout?.widthIn ?? 3) * SCREEN_PPI, pageWPx - 2 * marginPx);
  const tbLeftPx = pageWPx - marginPx - tbWidthPx;
  const tbTopPx = pageHPx - marginPx - tbHeightPx;
  const floorplanPages = allPages.filter((p) => p.type === "floorplan");
  const pageNum = floorplanPages.findIndex((p) => p.id === page.id) + 1;

  const groupById = useMemo(() => new Map(page.groups.map((g) => [g.id, g])), [page.groups]);
  const deviceDataMap = useMemo(() => {
    const m = new Map<string, DeviceData>();
    for (const n of nodes) if (n.type === "device") m.set(n.id, n.data as DeviceData);
    return m;
  }, [nodes]);

  // ── Zoom / pan ───────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const vpRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const setViewport = useCallback((z: number, p: Vec2) => {
    vpRef.current = { zoom: z, pan: p };
    setZoom(z);
    setPan(p);
  }, []);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const ctrlHeldRef = useRef(false);

  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const padding = 40;
    const z = Math.min((el.clientWidth - padding * 2) / pageWPx, (el.clientHeight - padding * 2) / pageHPx, 2);
    setViewport(z, { x: (el.clientWidth - pageWPx * z) / 2, y: (el.clientHeight - pageHPx * z) / 2 });
  }, [pageWPx, pageHPx, setViewport]);

  useEffect(() => { fitView(); }, [page.id, page.paperId, page.orientation, fitView]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") ctrlHeldRef.current = true;
      if (e.key === " ") {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
        e.preventDefault();
        spaceHeldRef.current = true;
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") ctrlHeldRef.current = false;
      if (e.key === " ") { spaceHeldRef.current = false; setSpaceHeld(false); }
    };
    const onBlur = () => { ctrlHeldRef.current = false; spaceHeldRef.current = false; setSpaceHeld(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-allow-scroll]")) return;
      e.preventDefault();
      const cfg = useSchematicStore.getState().scrollConfig;
      const { zoom: z, pan: p } = vpRef.current;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const action = e.ctrlKey ? cfg.ctrlScroll : e.shiftKey ? cfg.shiftScroll : cfg.scroll;
      if (action === "zoom" || (cfg.trackpadEnabled && e.ctrlKey && !ctrlHeldRef.current)) {
        const factor = 1 - e.deltaY * 0.001 * cfg.zoomSpeed;
        const newZ = Math.min(6, Math.max(0.05, z * factor));
        const ratio = newZ / z;
        setViewport(newZ, { x: mx * (1 - ratio) + p.x * ratio, y: my * (1 - ratio) + p.y * ratio });
      } else if (action === "pan-x") {
        setViewport(z, { x: p.x - e.deltaY * cfg.panSpeed, y: p.y });
      } else {
        setViewport(z, { x: p.x - e.deltaX * cfg.panSpeed, y: p.y - e.deltaY * cfg.panSpeed });
      }
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, [setViewport]);

  // ── Interaction state ────────────────────────────────────────────
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const selectionRef = useRef<Selection>(selection);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<{ startClient: Vec2; startPan: Vec2 } | null>(null);
  const didMoveRef = useRef(false);
  // State mirror of didMoveRef, used only for cursor styling during render — the ref
  // still drives the synchronous handler logic.
  const [didMove, setDidMove] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  // Calibration picks, in paper mm.
  const [calibPicks, setCalibPicks] = useState<Vec2[]>([]);
  const [calibCursor, setCalibCursor] = useState<Vec2 | null>(null);
  const [calibInput, setCalibInput] = useState("");

  // Switching tools drops any half-finished calibration. Adjusting state during render
  // (React's "derive state from props" pattern) keeps this off the effect path, so the
  // stale picks never get a frame to render in.
  const [toolAtLastRender, setToolAtLastRender] = useState<FloorplanTool>(tool);
  if (toolAtLastRender !== tool) {
    setToolAtLastRender(tool);
    if (calibPicks.length > 0) setCalibPicks([]);
    if (calibCursor) setCalibCursor(null);
  }

  /** Client coordinates → paper mm on the sheet. */
  const clientToPaperMm = useCallback((clientX: number, clientY: number): Vec2 => {
    const el = paperRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const { zoom: z } = vpRef.current;
    return {
      x: ((clientX - rect.left) / z / SCREEN_PPI) * IN_TO_MM,
      y: ((clientY - rect.top) / z / SCREEN_PPI) * IN_TO_MM,
    };
  }, []);

  /** Client pixel delta → paper mm delta. */
  const clientDeltaToMm = useCallback((dx: number, dy: number): Vec2 => {
    const { zoom: z } = vpRef.current;
    return { x: (dx / z / SCREEN_PPI) * IN_TO_MM, y: (dy / z / SCREEN_PPI) * IN_TO_MM };
  }, []);

  const snap = (v: number, free: boolean) => (free ? v : Math.round(v / SNAP_MM) * SNAP_MM);

  // ── Placing symbols ──────────────────────────────────────────────

  /** Group a dropped device belongs in: the one bound to its template, else the active
   *  group, else a new group seeded from the device itself. */
  const resolveGroupForDevice = useCallback((data: DeviceData | undefined): string | null => {
    if (data?.templateId) {
      const byTemplate = page.groups.find((g) => g.templateId === data.templateId);
      if (byTemplate) return byTemplate.id;
    }
    if (activeGroupId) return activeGroupId;
    if (!data) return null;
    const modelLine = [data.manufacturer, data.modelNumber ?? data.model].filter(Boolean).join(" ");
    const id = addFloorplanGroup(page.id, {
      label: data.model ?? data.label,
      description: modelLine || undefined,
      templateId: data.templateId,
    });
    onActiveGroupChange(id);
    return id;
  }, [page.groups, page.id, activeGroupId, addFloorplanGroup, onActiveGroupChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const nodeId = e.dataTransfer.getData(FLOORPLAN_DEVICE_MIME);
    if (!nodeId) return;
    e.preventDefault();
    const data = deviceDataMap.get(nodeId);
    const groupId = resolveGroupForDevice(data);
    if (!groupId) return;
    const pos = clampToSheet(clientToPaperMm(e.clientX, e.clientY), page);
    const id = addFloorplanSymbol(page.id, {
      groupId,
      deviceNodeId: nodeId,
      positionMm: { x: snap(pos.x, e.altKey), y: snap(pos.y, e.altKey) },
    });
    setSelection({ kind: "symbols", ids: [id] });
  }, [deviceDataMap, resolveGroupForDevice, clientToPaperMm, page, addFloorplanSymbol]);

  // ── Mouse handling on the sheet ──────────────────────────────────
  const handleSheetMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === "calibrate") return; // handled on click
    const willPan = e.button === 1 || spaceHeld || panMode === "pan-first";
    if (e.button === 1) e.preventDefault();
    didMoveRef.current = false;
    setDidMove(false);
    setPanning({ startClient: { x: e.clientX, y: e.clientY }, startPan: { ...vpRef.current.pan } });
    if (willPan) return;
    if (tool === "place") return; // handled on click
    setSelection({ kind: "none" });
  }, [tool, spaceHeld, panMode]);

  const handleSheetClick = useCallback((e: React.MouseEvent) => {
    if (didMoveRef.current) return;
    const pos = clientToPaperMm(e.clientX, e.clientY);

    if (tool === "calibrate") {
      if (!page.underlay) return;
      const picks = calibPicks.length >= 2 ? [pos] : [...calibPicks, pos];
      setCalibPicks(picks);
      // Seed the input with what the plan currently claims, so accepting it is a no-op
      // and correcting it is one edit.
      if (picks.length === 2) {
        setCalibInput((measureRealDistanceMm(picks[0], picks[1], page.scaleDenominator) / 1000).toFixed(2));
      }
      return;
    }
    if (tool === "place") {
      if (!activeGroupId) {
        addToast("Add a symbol group first — it defines the color and legend row.", "info");
        return;
      }
      const id = addFloorplanSymbol(page.id, {
        groupId: activeGroupId,
        positionMm: { x: snap(pos.x, e.altKey), y: snap(pos.y, e.altKey) },
      });
      setSelection({ kind: "symbols", ids: [id] });
    }
  }, [tool, page.underlay, page.id, page.scaleDenominator, activeGroupId, calibPicks, clientToPaperMm, addFloorplanSymbol, addToast]);

  const handleSymbolMouseDown = useCallback((e: React.MouseEvent, symbol: FloorplanSymbol) => {
    if (tool === "calibrate") return;
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const current = selectionRef.current;
    const currentIds = current.kind === "symbols" ? current.ids : [];
    let ids: string[];
    if (additive) {
      ids = currentIds.includes(symbol.id) ? currentIds.filter((id) => id !== symbol.id) : [...currentIds, symbol.id];
    } else if (currentIds.includes(symbol.id)) {
      ids = currentIds;
    } else {
      ids = [symbol.id];
    }
    const next: Selection = ids.length > 0 ? { kind: "symbols", ids } : { kind: "none" };
    setSelection(next);
    selectionRef.current = next;

    const starts: Record<string, Vec2> = {};
    for (const id of ids) {
      const s = page.symbols.find((sym) => sym.id === id);
      if (s) starts[id] = { ...s.positionMm };
    }
    didMoveRef.current = false;
    setDragging({ kind: "symbols", startClient: { x: e.clientX, y: e.clientY }, starts });
  }, [tool, page.symbols]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tool === "calibrate" && calibPicks.length === 1) {
      setCalibCursor(clientToPaperMm(e.clientX, e.clientY));
    }

    if (dragging) {
      didMoveRef.current = true;
      const free = e.altKey;
      if (dragging.kind === "symbols") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        for (const [id, start] of Object.entries(dragging.starts)) {
          const next = clampToSheet({ x: snap(start.x + d.x, free), y: snap(start.y + d.y, free) }, page);
          updateFloorplanSymbol(page.id, id, { positionMm: next });
        }
      } else if (dragging.kind === "label") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanSymbol(page.id, dragging.symbolId, {
          labelOffsetMm: { x: snap(dragging.start.x + d.x, free), y: snap(dragging.start.y + d.y, free) },
        });
      } else if (dragging.kind === "underlay") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanUnderlay(page.id, { positionMm: { x: snap(dragging.start.x + d.x, free), y: snap(dragging.start.y + d.y, free) } });
      } else if (dragging.kind === "underlay-resize") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        // Uniform scale — a distorted architect's drawing would silently corrupt every
        // distance measured off it, so only the aspect-preserving diagonal is honored.
        const factor = Math.max(0.05, 1 + (d.x / dragging.startSize.w + d.y / dragging.startSize.h) / 2);
        updateFloorplanUnderlay(page.id, { sizeMm: { w: dragging.startSize.w * factor, h: dragging.startSize.h * factor } });
      } else if (dragging.kind === "legend") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanLegend(page.id, { positionMm: { x: snap(dragging.start.x + d.x, free), y: snap(dragging.start.y + d.y, free) } });
      } else if (dragging.kind === "legend-resize") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, 0);
        updateFloorplanLegend(page.id, { widthMm: Math.max(40, snap(dragging.startWidth + d.x, free)) });
      }
      return;
    }

    if (panning) {
      const dx = e.clientX - panning.startClient.x;
      const dy = e.clientY - panning.startClient.y;
      if ((Math.abs(dx) > 2 || Math.abs(dy) > 2) && !didMoveRef.current) {
        didMoveRef.current = true;
        setDidMove(true);
      }
      if (didMoveRef.current) {
        setViewport(vpRef.current.zoom, { x: panning.startPan.x + dx, y: panning.startPan.y + dy });
      }
    }
  }, [tool, calibPicks.length, dragging, panning, page, clientToPaperMm, clientDeltaToMm, updateFloorplanSymbol, updateFloorplanUnderlay, updateFloorplanLegend, setViewport]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(null);
    setDidMove(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (tool !== "select") onToolChange("select");
      setSelection({ kind: "none" });
      setCalibPicks([]);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection.kind === "symbols") {
      e.preventDefault();
      for (const id of selection.ids) removeFloorplanSymbol(page.id, id);
      setSelection({ kind: "none" });
    }
  }, [tool, onToolChange, selection, page.id, removeFloorplanSymbol]);

  // ── Calibration dialog ───────────────────────────────────────────
  const calibDistanceMm = calibPicks.length === 2
    ? measureRealDistanceMm(calibPicks[0], calibPicks[1], page.scaleDenominator)
    : calibPicks.length === 1 && calibCursor
      ? measureRealDistanceMm(calibPicks[0], calibCursor, page.scaleDenominator)
      : 0;

  const applyCalibration = () => {
    const metres = Number(calibInput.replace(",", "."));
    if (!(metres > 0)) {
      addToast("Enter the real distance in metres.", "error");
      return;
    }
    const ok = calibrateFloorplan(page.id, calibPicks[0], calibPicks[1], metres * 1000);
    if (ok) {
      addToast(`Plan calibrated at ${formatScale(page.scaleDenominator)}.`, "success", 4000);
      onToolChange("select");
    } else {
      addToast("Could not calibrate from those two points.", "error");
    }
    setCalibPicks([]);
  };

  // ── Legend ───────────────────────────────────────────────────────
  const legendRows = useMemo(() => buildLegendRows(page), [page]);
  const legendNotes = (page.legend.notes ?? []).filter((n) => n.trim().length > 0);
  const legendH = legendHeightMm(legendRows, page.legend);

  const selectedSymbolIds = selection.kind === "symbols" ? selection.ids : [];
  const isPanning = panning !== null && didMove;
  const underlay = page.underlay;

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 bg-neutral-300 outline-none"
        tabIndex={0}
        style={{
          cursor: tool === "calibrate" ? "crosshair" : tool === "place" ? "copy" : isPanning ? "grabbing" : spaceHeld ? "grab" : "default",
          userSelect: "none",
        }}
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(FLOORPLAN_DEVICE_MIME)) e.preventDefault(); }}
        onDrop={handleDrop}
      >
        {/* Paper */}
        <div
          ref={paperRef}
          className="bg-white shadow-xl absolute"
          style={{ width: pageWPx, height: pageHPx, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          onMouseDown={handleSheetMouseDown}
          onClick={handleSheetClick}
        >
          {/* Underlay */}
          {underlay && (
            <div
              className="absolute"
              style={{
                left: mmToPx(underlay.positionMm.x),
                top: mmToPx(underlay.positionMm.y),
                width: mmToPx(underlay.sizeMm.w),
                height: mmToPx(underlay.sizeMm.h),
                opacity: underlay.opacity ?? 1,
                cursor: underlay.locked || tool !== "select" ? "default" : "move",
                pointerEvents: underlay.locked || tool !== "select" ? "none" : "auto",
              }}
              onMouseDown={(e) => {
                if (underlay.locked || tool !== "select") return;
                e.stopPropagation();
                didMoveRef.current = false;
                setSelection({ kind: "underlay" });
                setDragging({ kind: "underlay", startClient: { x: e.clientX, y: e.clientY }, start: { ...underlay.positionMm } });
              }}
            >
              <img
                src={underlay.src}
                alt={underlay.sourceName ?? "Floorplan underlay"}
                draggable={false}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
              {selection.kind === "underlay" && (
                <>
                  <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                  <div
                    className="absolute bg-blue-500"
                    style={{ right: -5, bottom: -5, width: 10, height: 10, cursor: "nwse-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      didMoveRef.current = false;
                      setDragging({ kind: "underlay-resize", startClient: { x: e.clientX, y: e.clientY }, startSize: { ...underlay.sizeMm } });
                    }}
                    title="Resize the underlay (aspect locked)"
                  />
                </>
              )}
            </div>
          )}

          {/* Content border */}
          <div
            className="absolute pointer-events-none"
            style={{ left: marginPx, top: marginPx, right: marginPx, bottom: marginPx, border: "0.72px solid #000" }}
          />

          {/* Symbols */}
          {page.symbols.map((symbol) => {
            const group = groupById.get(symbol.groupId);
            if (!group) return null;
            const sizePx = mmToPx(page.symbolSizeMm);
            const cx = mmToPx(symbol.positionMm.x);
            const cy = mmToPx(symbol.positionMm.y);
            const anchor = symbolLabelAnchor(symbol, page.symbolSizeMm);
            const isSelected = selectedSymbolIds.includes(symbol.id);
            const device = symbol.deviceNodeId ? deviceDataMap.get(symbol.deviceNodeId) : undefined;
            const deviceLabel = device ? resolveDeviceLabel(device, { useShortNames, wrapDeviceLabels: false }).text : undefined;
            return (
              <div key={symbol.id}>
                <div
                  className="absolute"
                  style={{
                    left: cx - sizePx / 2,
                    top: cy - sizePx / 2,
                    width: sizePx,
                    height: sizePx,
                    cursor: tool === "select" ? "move" : "inherit",
                    zIndex: isSelected ? 20 : 10,
                  }}
                  onMouseDown={(e) => handleSymbolMouseDown(e, symbol)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingLabelId(symbol.id);
                    setLabelDraft(symbol.label);
                  }}
                  title={[symbol.label, deviceLabel, symbol.notes].filter(Boolean).join(" · ")}
                >
                  <SymbolGlyph group={group} sizePx={sizePx} />
                  {isSelected && (
                    <div
                      className="absolute pointer-events-none border-2 border-blue-500 rounded-sm"
                      style={{ left: -3, top: -3, right: -3, bottom: -3 }}
                    />
                  )}
                </div>

                {/* Number */}
                {editingLabelId === symbol.id ? (
                  <input
                    autoFocus
                    className="absolute border border-blue-400 rounded px-0.5 outline-none bg-white"
                    style={{
                      left: mmToPx(anchor.x),
                      top: mmToPx(anchor.y) - mmToPx(page.labelSizeMm),
                      width: mmToPx(page.labelSizeMm) * 5,
                      fontSize: mmToPx(page.labelSizeMm),
                      zIndex: 30,
                    }}
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onBlur={() => {
                      if (labelDraft.trim()) updateFloorplanSymbol(page.id, symbol.id, { label: labelDraft.trim() });
                      setEditingLabelId(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditingLabelId(null);
                    }}
                  />
                ) : (
                  <div
                    className="absolute whitespace-nowrap"
                    style={{
                      left: mmToPx(anchor.x),
                      top: mmToPx(anchor.y),
                      transform: "translateY(-50%)",
                      fontSize: mmToPx(page.labelSizeMm),
                      fontWeight: 600,
                      color: "#111",
                      cursor: tool === "select" ? "move" : "inherit",
                      zIndex: 15,
                    }}
                    onMouseDown={(e) => {
                      if (tool !== "select") return;
                      e.stopPropagation();
                      didMoveRef.current = false;
                      setSelection({ kind: "symbols", ids: [symbol.id] });
                      setDragging({
                        kind: "label",
                        symbolId: symbol.id,
                        startClient: { x: e.clientX, y: e.clientY },
                        start: symbol.labelOffsetMm ?? { x: page.symbolSizeMm * 0.75 + 1.5, y: 0 },
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingLabelId(symbol.id);
                      setLabelDraft(symbol.label);
                    }}
                  >
                    {symbol.label}
                  </div>
                )}
              </div>
            );
          })}

          {/* Calibration overlay */}
          {tool === "calibrate" && calibPicks.length > 0 && (() => {
            const a = calibPicks[0];
            const b = calibPicks[1] ?? calibCursor;
            if (!b) return null;
            return (
              <svg className="absolute inset-0 pointer-events-none" width={pageWPx} height={pageHPx} style={{ zIndex: 40 }}>
                <line
                  x1={mmToPx(a.x)} y1={mmToPx(a.y)} x2={mmToPx(b.x)} y2={mmToPx(b.y)}
                  stroke="#d97706" strokeWidth={2} strokeDasharray="6 4"
                />
                <circle cx={mmToPx(a.x)} cy={mmToPx(a.y)} r={4} fill="#d97706" />
                <circle cx={mmToPx(b.x)} cy={mmToPx(b.y)} r={4} fill="#d97706" />
                <text
                  x={mmToPx((a.x + b.x) / 2)} y={mmToPx((a.y + b.y) / 2) - 8}
                  textAnchor="middle" fontSize={13} fill="#92400e" fontWeight={600}
                >
                  {formatMetres(calibDistanceMm)}
                </text>
              </svg>
            );
          })()}

          {/* Legend box */}
          {page.legend.visible && (legendRows.length > 0 || legendNotes.length > 0) && (
            <div
              className="absolute bg-white"
              style={{
                left: mmToPx(page.legend.positionMm.x),
                top: mmToPx(page.legend.positionMm.y),
                width: mmToPx(page.legend.widthMm),
                height: mmToPx(legendH),
                border: "0.72px solid #444",
                zIndex: 25,
                cursor: tool === "select" ? "move" : "default",
              }}
              onMouseDown={(e) => {
                if (tool !== "select") return;
                e.stopPropagation();
                didMoveRef.current = false;
                setSelection({ kind: "legend" });
                setDragging({ kind: "legend", startClient: { x: e.clientX, y: e.clientY }, start: { ...page.legend.positionMm } });
              }}
            >
              <div style={{ padding: mmToPx(LEGEND_PAD_MM) }}>
                <div
                  style={{
                    fontSize: mmToPx(4.5),
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    borderBottom: "1.5px solid #c00",
                    paddingBottom: mmToPx(1.5),
                    marginBottom: mmToPx(2),
                  }}
                >
                  {page.legend.title}
                </div>
                {legendRows.map((row) => (
                  <div
                    key={row.groupId}
                    className="flex items-center"
                    style={{ height: mmToPx(page.legend.showImages ? LEGEND_ROW_WITH_IMAGE_MM : LEGEND_ROW_MM), gap: mmToPx(2) }}
                  >
                    <SymbolGlyph group={{ ...row, id: row.groupId, label: row.label }} sizePx={mmToPx(page.symbolSizeMm)} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: mmToPx(3.2), fontWeight: 700 }}>{row.label}</div>
                      {row.description && (
                        <div style={{ fontSize: mmToPx(2.6), color: "#333" }} className="truncate">{row.description}</div>
                      )}
                    </div>
                    {page.legend.showImages && row.imageSrc && (
                      <div className="flex items-center shrink-0" style={{ gap: mmToPx(1.5) }}>
                        <img
                          src={row.imageSrc}
                          alt=""
                          style={{ height: mmToPx(LEGEND_ROW_WITH_IMAGE_MM - 3), width: mmToPx(18), objectFit: "contain" }}
                        />
                        {row.imageCaption && <span style={{ fontSize: mmToPx(2.4), fontWeight: 600 }}>{row.imageCaption}</span>}
                      </div>
                    )}
                  </div>
                ))}
                {legendNotes.length > 0 && (
                  <div style={{ marginTop: mmToPx(LEGEND_NOTES_GAP_MM) }}>
                    <div style={{ fontSize: mmToPx(3), fontWeight: 700, height: mmToPx(LEGEND_NOTES_TITLE_MM), borderTop: "0.5px solid #999", paddingTop: mmToPx(1.5) }}>
                      {page.legend.notesTitle}
                    </div>
                    {legendNotes.map((note, i) => (
                      <div key={i} style={{ fontSize: mmToPx(2.6), height: mmToPx(LEGEND_NOTE_LINE_MM), color: "#222" }} className="truncate">
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selection.kind === "legend" && (
                <>
                  <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                  <div
                    className="absolute bg-blue-500"
                    style={{ right: -5, top: "50%", width: 10, height: 10, marginTop: -5, cursor: "ew-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      didMoveRef.current = false;
                      setDragging({ kind: "legend-resize", startClient: { x: e.clientX, y: e.clientY }, startWidth: page.legend.widthMm });
                    }}
                    title="Resize the legend box"
                  />
                </>
              )}
            </div>
          )}

          {/* Title block */}
          {page.showTitleBlock && titleBlockLayout && (
            <div className="absolute pointer-events-none" style={{ left: tbLeftPx, top: tbTopPx, width: tbWidthPx, height: tbHeightPx, zIndex: 26 }}>
              <TitleBlockSVG
                tb={titleBlock}
                layout={titleBlockLayout}
                pageNum={pageNum}
                totalPages={floorplanPages.length}
                widthPx={tbWidthPx}
                heightPx={tbHeightPx}
              />
            </div>
          )}

          {/* Empty state */}
          {!underlay && page.symbols.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm pointer-events-none">
              Import the architect's drawing from the toolbar, then drag devices onto it.
            </div>
          )}
        </div>
      </div>

      {/* Calibration prompt */}
      {tool === "calibrate" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white border border-amber-300 rounded shadow-lg px-3 py-2 text-xs flex items-center gap-2" data-print-hide>
          {calibPicks.length < 2 ? (
            <span className="text-amber-800">
              {calibPicks.length === 0
                ? "Click the first end of a known dimension on the plan."
                : "Click the other end."}
            </span>
          ) : (
            <>
              <span className="text-neutral-700">That distance is</span>
              <input
                autoFocus
                className="w-20 border border-neutral-300 rounded px-1.5 py-0.5 outline-none focus:border-amber-400"
                value={calibInput}
                onChange={(e) => setCalibInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyCalibration(); }}
              />
              <span className="text-neutral-700">m</span>
              <button
                className="px-2 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700"
                onClick={applyCalibration}
              >
                Apply
              </button>
            </>
          )}
          <button
            className="px-2 py-0.5 text-neutral-500 hover:text-neutral-800"
            onClick={() => { setCalibPicks([]); onToolChange("select"); }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tool + zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 border border-neutral-300 rounded shadow px-2 py-1 text-xs select-none" data-print-hide>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "select" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => onToolChange("select")}
          title="Select and move (Esc)"
        >
          ⬉ Select
        </button>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "place" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => onToolChange(tool === "place" ? "select" : "place")}
          title="Click the plan to drop symbols of the active group"
        >
          ✚ Place
        </button>
        <div className="border-l border-neutral-200 h-3" />
        <span className="text-neutral-500 px-1" title="Drawing scale">{formatScale(page.scaleDenominator)}</span>
        <div className="border-l border-neutral-200 h-3" />
        <button className="px-2 py-0.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer" onClick={fitView}>Fit</button>
        <button
          className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
          onClick={() => setViewport(Math.max(0.05, vpRef.current.zoom / 1.25), vpRef.current.pan)}
        >
          −
        </button>
        <span className="w-10 text-center text-neutral-600">{Math.round(zoom * 100)}%</span>
        <button
          className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
          onClick={() => setViewport(Math.min(6, vpRef.current.zoom * 1.25), vpRef.current.pan)}
        >
          +
        </button>
      </div>
    </div>
  );
}
