import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSchematicStore, loadSpecLookup } from "../store";
import { resolveDeviceLabel } from "../displayName";
import { buildLegendLineRows, computeLineLoads, legendShowsLines } from "../speakerLines";
import {
  buildLegendRows,
  clampToSheet,
  drawingAreaMm,
  formatMetres,
  formatScale,
  layoutDrawingBlock,
  layoutNote,
  legendHeightMm,
  legendRowImage,
  legendDescriptionFor,
  legendInstallNoteFor,
  appendLegendNote,
  companyProfileLines,
  hasCompanyProfile,
  planSymbolFor,
  LEGEND_COMPANY_GAP_MM,
  LEGEND_COMPANY_LINE_MM,
  LEGEND_COMPANY_LOGO_MM,
  measureRealDistanceMm,
  rectFromDrag,
  MASK_MIN_SIZE_MM,
  coverageAnchorMm,
  defaultCoverage,
  paperMmToRealMm,
  COVERAGE_MAX_RANGE_M,
  COVERAGE_MIN_RANGE_M,
  sheetSizeMm,
  isGroupVisible,
  symbolLabelAnchor,
  LEGEND_NOTES_GAP_MM,
  LEGEND_NOTES_TITLE_MM,
  LEGEND_NOTE_LINE_MM,
  LEGEND_LINES_GAP_MM,
  LEGEND_LINES_TITLE_MM,
  LEGEND_LINE_ROW_MM,
  LEGEND_LINE_COLS,
  DEFAULT_LEGEND_LINES_TITLE,
  LEGEND_PAD_MM,
  LEGEND_ROW_MM,
  LEGEND_ROW_WITH_IMAGE_MM,
  type Vec2,
} from "../floorplan";
import { TITLE_BLOCK_HEIGHT_IN } from "../printConfig";
import { type TrackpadGesture, createTrackpadGesture, nextWheelViewport } from "../wheelViewport";
import TitleBlockSVG from "./TitleBlockSVG";
import FloorplanSymbolSvg from "./FloorplanSymbolSvg";
import FloorplanSymbolContextMenu from "./FloorplanSymbolContextMenu";
import FloorplanMaskContextMenu from "./FloorplanMaskContextMenu";
import FloorplanCoverageLayer from "./FloorplanCoverageLayer";
import FloorplanCoverageContextMenu from "./FloorplanCoverageContextMenu";
import FloorplanWallLayer from "./FloorplanWallLayer";
import FloorplanHeatmapLayer from "./FloorplanHeatmapLayer";
import FloorplanDrawingBlockView from "./FloorplanDrawingBlockView";
import { FLOORPLAN_DEVICE_MIME } from "./FloorplanSidebar";
import type { DeviceData, FloorplanCoverage, FloorplanNote, FloorplanPage, FloorplanSymbol, FloorplanSymbolGroup } from "../types";
import { DEFAULT_HEATMAP, DEFAULT_WALL_MATERIAL, DEFAULT_WALL_THICKNESS_MM } from "../types";
import { collectAccessPoints } from "../wifiCoverage";
import { getTemplateById } from "../templateApi";
import type { FloorplanTool } from "./FloorplanPage";
import { useT } from "../i18n";

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
  /** Amplifier line new symbols are numbered on; empty = none. */
  activeLine: string;
  /** What is selected on the sheet. Owned by FloorplanPage so the options panel on the
   *  right can show and edit whatever the click landed on. */
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
}

export type Selection =
  | { kind: "none" }
  | { kind: "symbols"; ids: string[] }
  | { kind: "underlay" }
  | { kind: "legend" }
  | { kind: "drawing" }
  | { kind: "note"; id: string }
  | { kind: "mask"; id: string }
  | { kind: "coverage"; id: string }
  | { kind: "wall"; id: string };

type DragState =
  | { kind: "symbols"; startClient: Vec2; starts: Record<string, Vec2> }
  | { kind: "underlay"; startClient: Vec2; start: Vec2 }
  | { kind: "underlay-resize"; startClient: Vec2; startSize: { w: number; h: number } }
  | { kind: "legend"; startClient: Vec2; start: Vec2 }
  | { kind: "legend-resize"; startClient: Vec2; startWidth: number }
  | { kind: "drawing"; startClient: Vec2; start: Vec2 }
  | { kind: "drawing-resize"; startClient: Vec2; startWidth: number }
  | { kind: "note"; noteId: string; startClient: Vec2; start: Vec2 }
  | { kind: "note-resize"; noteId: string; startClient: Vec2; startWidth: number }
  | { kind: "legend-height"; startClient: Vec2; startHeight: number }
  | { kind: "drawing-height"; startClient: Vec2; startHeight: number }
  | { kind: "mask-draw"; start: Vec2; current: Vec2 }
  | { kind: "mask"; maskId: string; startClient: Vec2; start: Vec2 }
  | { kind: "mask-resize"; maskId: string; startClient: Vec2; startSize: { w: number; h: number } }
  | { kind: "coverage"; coverageId: string; startClient: Vec2; start: Vec2 }
  /** Dragging an area's far edge: the pointer sets direction and reach at once. */
  | { kind: "coverage-aim"; coverageId: string }
  | { kind: "label"; symbolId: string; startClient: Vec2; start: Vec2 };

/** One symbol drawn on the sheet: the shape, an optional glyph inside, plus its number. */
function SymbolGlyph({ group, sizePx, rotationDeg, symbolSizeMm }: { group: Pick<FloorplanSymbolGroup, "shape" | "color" | "glyph" | "symbolImageSrc" | "outlineColor" | "outlineWidthMm">; sizePx: number; rotationDeg?: number; symbolSizeMm: number }) {
  return <FloorplanSymbolSvg group={group} sizePx={sizePx} rotationDeg={rotationDeg} symbolSizeMm={symbolSizeMm} />;
}

export default function FloorplanRenderer({ page, tool, onToolChange, activeGroupId, onActiveGroupChange, activeLine, selection, onSelectionChange }: Props) {
  const t = useT();
  const nodes = useSchematicStore((s) => s.nodes);
  const edges = useSchematicStore((s) => s.edges);
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
  const updateFloorplanDrawingBlock = useSchematicStore((s) => s.updateFloorplanDrawingBlock);
  const addFloorplanNote = useSchematicStore((s) => s.addFloorplanNote);
  const updateFloorplanNote = useSchematicStore((s) => s.updateFloorplanNote);
  const removeFloorplanNote = useSchematicStore((s) => s.removeFloorplanNote);
  const addFloorplanMask = useSchematicStore((s) => s.addFloorplanMask);
  const updateFloorplanMask = useSchematicStore((s) => s.updateFloorplanMask);
  const removeFloorplanMask = useSchematicStore((s) => s.removeFloorplanMask);
  const addFloorplanCoverage = useSchematicStore((s) => s.addFloorplanCoverage);
  const updateFloorplanCoverage = useSchematicStore((s) => s.updateFloorplanCoverage);
  const removeFloorplanCoverage = useSchematicStore((s) => s.removeFloorplanCoverage);
  const addFloorplanWall = useSchematicStore((s) => s.addFloorplanWall);
  const removeFloorplanWall = useSchematicStore((s) => s.removeFloorplanWall);
  const wallMaterials = useSchematicStore((s) => s.wallMaterials);
  const customTemplates = useSchematicStore((s) => s.customTemplates);
  const companyProfile = useSchematicStore((s) => s.companyProfile);
  const schematicName = useSchematicStore((s) => s.schematicName);
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

  const trackpadRef = useRef<TrackpadGesture | null>(null);
  if (!trackpadRef.current) trackpadRef.current = createTrackpadGesture();
  useEffect(() => {
    const el = containerRef.current;
    const gesture = trackpadRef.current!;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-allow-scroll]")) return;
      e.preventDefault();
      const cfg = useSchematicStore.getState().scrollConfig;
      const { zoom: z, pan: p } = vpRef.current;
      const rect = el.getBoundingClientRect();
      gesture.saw(e, cfg.trackpadEnabled, ctrlHeldRef.current);
      const next = nextWheelViewport(e, { x: p.x, y: p.y, zoom: z }, cfg, {
        pointer: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        ctrlHeld: ctrlHeldRef.current,
        trackpadActive: gesture.isActive(),
        minZoom: 0.05,
        maxZoom: 6,
      });
      setViewport(next.zoom, { x: next.x, y: next.y });
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => { el.removeEventListener("wheel", handler, { capture: true }); gesture.dispose(); };
  }, [setViewport]);

  // ── Interaction state ────────────────────────────────────────────
  const setSelection = onSelectionChange;
  const selectionRef = useRef<Selection>(selection);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [hoverMaskId, setHoverMaskId] = useState<string | null>(null);
  const [symbolMenu, setSymbolMenu] = useState<{ x: number; y: number; ids: string[] } | null>(null);
  const [maskMenu, setMaskMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [coverageMenu, setCoverageMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  /** The wall run being drawn: vertices fixed so far, plus where the cursor is. */
  const [wallDraft, setWallDraft] = useState<{ pointsMm: Vec2[]; cursorMm: Vec2 } | null>(null);
  const [panning, setPanning] = useState<{ startClient: Vec2; startPan: Vec2 } | null>(null);
  const didMoveRef = useRef(false);
  // State mirror of didMoveRef, used only for cursor styling during render — the ref
  // still drives the synchronous handler logic.
  const [didMove, setDidMove] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

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
    // The library speaks for the model: manufacturer, model number, the fixed install
    // cable and the standing install note come from the template (device values win when
    // the planner overrode them), and the template's product shot becomes the row's picture.
    const template = data.templateId ? getTemplateById(data.templateId, customTemplates) : undefined;
    const source = {
      label: data.label,
      manufacturer: data.manufacturer ?? template?.manufacturer,
      modelNumber: data.modelNumber ?? template?.modelNumber,
      model: data.model,
      installCable: data.installCable ?? template?.installCable,
      installNotes: data.installNotes ?? template?.installNotes,
    };
    // The model's standing symbol (library) beats the palette rotation, so the same
    // speaker looks the same on every plan.
    const symbol = planSymbolFor({
      planSymbol: data.planSymbol ?? template?.planSymbol,
      deviceType: data.deviceType ?? template?.deviceType,
      templateId: data.templateId,
      modelNumber: source.modelNumber,
      label: data.label,
    });
    const id = addFloorplanGroup(page.id, {
      shape: symbol.shape,
      color: symbol.color,
      glyph: symbol.glyph,
      symbolImageSrc: symbol.imageSrc,
      label: data.model ?? data.label,
      description: legendDescriptionFor(source),
      templateId: data.templateId,
      imageUrl: template?.imageUrl || undefined,
      imageCaption: source.modelNumber ?? undefined,
    });
    const note = legendInstallNoteFor(source);
    if (note) updateFloorplanLegend(page.id, { notes: appendLegendNote(page.legend.notes, note) });
    onActiveGroupChange(id);
    return id;
  }, [page.groups, page.id, page.legend.notes, activeGroupId, addFloorplanGroup, updateFloorplanLegend, onActiveGroupChange, customTemplates]);

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
      lineNo: activeLine.trim() || undefined,
    });
    setSelection({ kind: "symbols", ids: [id] });
  }, [deviceDataMap, resolveGroupForDevice, clientToPaperMm, page, addFloorplanSymbol, activeLine]);

  // Which symbols are access points, for the band the heatmap shows. Recomputed when a
  // symbol moves or the band changes — a stale AP list would draw coverage from nowhere.
  const heatmapCfg = useMemo(() => ({ ...DEFAULT_HEATMAP, ...(page.heatmap ?? {}) }), [page.heatmap]);
  const accessPoints = useMemo(() => {
    if (!heatmapCfg.visible) return [];
    return collectAccessPoints(page, heatmapCfg.band, (nodeId) => {
      const data = deviceDataMap.get(nodeId);
      const templateId = data?.templateId;
      return templateId ? getTemplateById(templateId, customTemplates)?.wifi : undefined;
    });
  }, [heatmapCfg.visible, heatmapCfg.band, page, deviceDataMap, customTemplates]);

  const snapVec = useCallback((p: Vec2, free: boolean): Vec2 => ({ x: snap(p.x, free), y: snap(p.y, free) }), []);

  /** Commit a drawn run. Two vertices is the shortest wall worth keeping; one is a
   *  slipped click. The build-up starts at a stud partition and is changed in the panel. */
  const finishWall = useCallback((pointsMm: Vec2[]) => {
    if (pointsMm.length < 2) return;
    const id = addFloorplanWall(page.id, {
      pointsMm,
      material: DEFAULT_WALL_MATERIAL,
      thicknessMm: DEFAULT_WALL_THICKNESS_MM,
    });
    setSelection({ kind: "wall", id });
  }, [addFloorplanWall, page.id]);

  // ── Mouse handling on the sheet ──────────────────────────────────
  const handleSheetMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === "calibrate") return; // handled on click
    const willPan = e.button === 1 || spaceHeld || panMode === "pan-first";
    if (e.button === 1) e.preventDefault();
    didMoveRef.current = false;
    setDidMove(false);
    setPanning({ startClient: { x: e.clientX, y: e.clientY }, startPan: { ...vpRef.current.pan } });
    if (willPan) return;
    if (tool === "place" || tool === "note" || tool === "coverage" || tool === "wall") return; // handled on click
    if (tool === "erase") {
      // Drag out a white cover — the only way to "remove" something from a raster plan.
      setPanning(null);
      const start = clientToPaperMm(e.clientX, e.clientY);
      setDragging({ kind: "mask-draw", start, current: start });
      return;
    }
    setSelection({ kind: "none" });
  }, [tool, spaceHeld, panMode, clientToPaperMm]);

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
    if (tool === "wall") {
      // A run is built vertex by vertex. Clicking the last point again closes it, which
      // is how every CAD polyline behaves and saves reaching for a key.
      setWallDraft((cur) => {
        const next = snapVec(pos, e.altKey);
        if (!cur) return { pointsMm: [next], cursorMm: next };
        const last = cur.pointsMm[cur.pointsMm.length - 1];
        if (Math.hypot(next.x - last.x, next.y - last.y) < 1) {
          finishWall(cur.pointsMm);
          return null;
        }
        return { pointsMm: [...cur.pointsMm, next], cursorMm: next };
      });
      return;
    }
    if (tool === "coverage") {
      // Dropped where it was clicked and left selected, so the aim handle is right there
      // to point it — placing and aiming is one gesture.
      const id = addFloorplanCoverage(page.id, {
        ...defaultCoverage("sector"),
        positionMm: { x: snap(pos.x, e.altKey), y: snap(pos.y, e.altKey) },
        groupId: activeGroupId ?? undefined,
      });
      setSelection({ kind: "coverage", id });
      onToolChange("select");
      return;
    }
    if (tool === "place") {
      if (!activeGroupId) {
        addToast(t("Add a symbol group first — it defines the color and legend row."), "info");
        return;
      }
      const id = addFloorplanSymbol(page.id, {
        groupId: activeGroupId,
        positionMm: { x: snap(pos.x, e.altKey), y: snap(pos.y, e.altKey) },
        lineNo: activeLine.trim() || undefined,
      });
      setSelection({ kind: "symbols", ids: [id] });
      return;
    }
    if (tool === "note") {
      const id = addFloorplanNote(page.id, { positionMm: { x: snap(pos.x, e.altKey), y: snap(pos.y, e.altKey) }, text: t("Note") });
      setSelection({ kind: "note", id });
      setEditingNoteId(id);
      setNoteDraft(t("Note"));
      onToolChange("select");
    }
  }, [tool, page.underlay, page.id, page.scaleDenominator, activeGroupId, activeLine, calibPicks, clientToPaperMm, addFloorplanSymbol, addFloorplanNote, addFloorplanCoverage, finishWall, snapVec, addToast, onToolChange]);

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
    if (tool === "wall") {
      // Deliberately no `wallDraft` read here: the updater sees the live value, so the
      // rubber band cannot lag behind a captured one.
      setWallDraft((cur) => cur ? { ...cur, cursorMm: clientToPaperMm(e.clientX, e.clientY) } : cur);
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
      } else if (dragging.kind === "drawing") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanDrawingBlock(page.id, { positionMm: { x: snap(dragging.start.x + d.x, free), y: snap(dragging.start.y + d.y, free) } });
      } else if (dragging.kind === "drawing-resize") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, 0);
        updateFloorplanDrawingBlock(page.id, { widthMm: Math.max(50, snap(dragging.startWidth + d.x, free)) });
      } else if (dragging.kind === "note") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanNote(page.id, dragging.noteId, { positionMm: { x: snap(dragging.start.x + d.x, free), y: snap(dragging.start.y + d.y, free) } });
      } else if (dragging.kind === "note-resize") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, 0);
        updateFloorplanNote(page.id, dragging.noteId, { widthMm: Math.max(15, snap(dragging.startWidth + d.x, free)) });
      } else if (dragging.kind === "legend-height") {
        const d = clientDeltaToMm(0, e.clientY - dragging.startClient.y);
        updateFloorplanLegend(page.id, { minHeightMm: Math.max(0, snap(dragging.startHeight + d.y, free)) });
      } else if (dragging.kind === "drawing-height") {
        const d = clientDeltaToMm(0, e.clientY - dragging.startClient.y);
        updateFloorplanDrawingBlock(page.id, { minHeightMm: Math.max(0, snap(dragging.startHeight + d.y, free)) });
      } else if (dragging.kind === "mask-draw") {
        setDragging({ ...dragging, current: clientToPaperMm(e.clientX, e.clientY) });
      } else if (dragging.kind === "mask") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanMask(page.id, dragging.maskId, { positionMm: { x: snap(dragging.start.x + d.x, free), y: snap(dragging.start.y + d.y, free) } });
      } else if (dragging.kind === "mask-resize") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanMask(page.id, dragging.maskId, {
          sizeMm: { w: Math.max(MASK_MIN_SIZE_MM, snap(dragging.startSize.w + d.x, free)), h: Math.max(MASK_MIN_SIZE_MM, snap(dragging.startSize.h + d.y, free)) },
        });
      } else if (dragging.kind === "coverage") {
        const d = clientDeltaToMm(e.clientX - dragging.startClient.x, e.clientY - dragging.startClient.y);
        updateFloorplanCoverage(page.id, dragging.coverageId, { positionMm: { x: snap(dragging.start.x + d.x, free), y: snap(dragging.start.y + d.y, free) } });
      } else if (dragging.kind === "coverage-aim") {
        const coverage = (page.coverages ?? []).find((c) => c.id === dragging.coverageId);
        if (coverage) {
          const anchor = coverageAnchorMm(coverage, page.symbols);
          const at = clientToPaperMm(e.clientX, e.clientY);
          const dx = at.x - anchor.x, dy = at.y - anchor.y;
          // Reach comes out of the pointer distance measured in the building, not on paper.
          const rangeM = paperMmToRealMm(Math.hypot(dx, dy), page.scaleDenominator) / 1000;
          const patch: Partial<FloorplanCoverage> = {};
          // A camera's reach comes out of its lens, so dragging only aims it. Writing a
          // range here would be a number the optics immediately contradict.
          if (!coverage.optics) {
            patch.rangeM = Math.min(COVERAGE_MAX_RANGE_M, Math.max(COVERAGE_MIN_RANGE_M, free ? rangeM : Math.round(rangeM * 10) / 10));
          }
          // A ring has no direction to set; for everything else the pointer aims it. On an
          // anchored area rotationDeg is an offset, so the device's own aim comes back out.
          if (coverage.shape !== "circle" && Math.hypot(dx, dy) > 0.5) {
            const absolute = (Math.atan2(dy, dx) * 180) / Math.PI;
            const deviceAim = coverage.symbolId
              ? page.symbols.find((sym) => sym.id === coverage.symbolId)?.rotationDeg ?? 0
              : 0;
            const own = absolute - deviceAim;
            patch.rotationDeg = free ? own : Math.round(own / 5) * 5;
          }
          updateFloorplanCoverage(page.id, dragging.coverageId, patch);
        }
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
  }, [tool, calibPicks.length, dragging, panning, page, clientToPaperMm, clientDeltaToMm, updateFloorplanSymbol, updateFloorplanUnderlay, updateFloorplanLegend, updateFloorplanDrawingBlock, updateFloorplanNote, updateFloorplanMask, updateFloorplanCoverage, setViewport]);

  const handleMouseUp = useCallback(() => {
    if (dragging?.kind === "mask-draw") {
      const rect = rectFromDrag(dragging.start, dragging.current, page);
      if (rect.sizeMm.w >= MASK_MIN_SIZE_MM && rect.sizeMm.h >= MASK_MIN_SIZE_MM) {
        const id = addFloorplanMask(page.id, {
          positionMm: { x: snap(rect.positionMm.x, false), y: snap(rect.positionMm.y, false) },
          sizeMm: { w: snap(rect.sizeMm.w, false), h: snap(rect.sizeMm.h, false) },
        });
        setSelection({ kind: "mask", id });
        onToolChange("select");
      }
    }
    setDragging(null);
    setPanning(null);
    setDidMove(false);
  }, [dragging, page, addFloorplanMask, onToolChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // A half-drawn run is abandoned first — Escape should not also drop the tool and
      // the selection in one press.
      if (wallDraft) {
        setWallDraft(null);
        return;
      }
      if (tool !== "select") onToolChange("select");
      setSelection({ kind: "none" });
      setCalibPicks([]);
      return;
    }
    if (e.key === "Enter" && wallDraft) {
      e.preventDefault();
      finishWall(wallDraft.pointsMm);
      setWallDraft(null);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection.kind === "wall") {
      e.preventDefault();
      removeFloorplanWall(page.id, selection.id);
      setSelection({ kind: "none" });
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection.kind === "symbols") {
      e.preventDefault();
      for (const id of selection.ids) removeFloorplanSymbol(page.id, id);
      setSelection({ kind: "none" });
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection.kind === "note" && editingNoteId === null) {
      e.preventDefault();
      removeFloorplanNote(page.id, selection.id);
      setSelection({ kind: "none" });
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection.kind === "coverage") {
      e.preventDefault();
      removeFloorplanCoverage(page.id, selection.id);
      setSelection({ kind: "none" });
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection.kind === "mask") {
      e.preventDefault();
      removeFloorplanMask(page.id, selection.id);
      setSelection({ kind: "none" });
    }
  }, [tool, onToolChange, selection, page.id, removeFloorplanSymbol, removeFloorplanNote, removeFloorplanMask, removeFloorplanCoverage, removeFloorplanWall, wallDraft, finishWall, editingNoteId]);

  // ── Calibration dialog ───────────────────────────────────────────
  const calibDistanceMm = calibPicks.length === 2
    ? measureRealDistanceMm(calibPicks[0], calibPicks[1], page.scaleDenominator)
    : calibPicks.length === 1 && calibCursor
      ? measureRealDistanceMm(calibPicks[0], calibCursor, page.scaleDenominator)
      : 0;

  const applyCalibration = () => {
    const metres = Number(calibInput.replace(",", "."));
    if (!(metres > 0)) {
      addToast(t("Enter the real distance in metres."), "error");
      return;
    }
    const ok = calibrateFloorplan(page.id, calibPicks[0], calibPicks[1], metres * 1000);
    if (ok) {
      addToast(t("Plan calibrated at {scale}.", { scale: formatScale(page.scaleDenominator) }), "success", 4000);
      onToolChange("select");
    } else {
      addToast(t("Could not calibrate from those two points."), "error");
    }
    setCalibPicks([]);
  };

  // ── Legend ───────────────────────────────────────────────────────
  const legendRows = useMemo(() => buildLegendRows(page), [page]);
  const legendLineRows = useMemo(
    () => (legendShowsLines(page) ? buildLegendLineRows(computeLineLoads(page, nodes, edges, loadSpecLookup({ customTemplates }))) : []),
    [page, nodes, edges, customTemplates],
  );
  const legendNotes = (page.legend.notes ?? []).filter((n) => n.trim().length > 0);
  const showCompany = page.legend.showCompany !== false && hasCompanyProfile(companyProfile);
  const legendH = legendHeightMm(legendRows, page.legend, companyProfile, legendLineRows.length);

  const blockLogo = titleBlock.logo || companyProfile.logo || undefined;
  const drawingLayout = useMemo(
    () => layoutDrawingBlock(page.drawingBlock, { titleBlock, page, projectName: schematicName, company: companyProfile }, { hasLogo: Boolean(blockLogo) }),
    [page, titleBlock, schematicName, companyProfile, blockLogo],
  );

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
          cursor: tool === "calibrate" || tool === "erase" || tool === "coverage" || tool === "wall" ? "crosshair" : tool === "place" ? "copy" : tool === "note" ? "text" : isPanning ? "grabbing" : spaceHeld ? "grab" : "default",
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
                alt={underlay.sourceName ?? t("Floorplan underlay")}
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
                    title={t("Resize the underlay (aspect locked)")}
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

          {/* Covers over the underlay — white, so what is under them is gone from the print */}
          {page.masks.map((mask) => {
            const isSel = selection.kind === "mask" && selection.id === mask.id;
            return (
              <div
                key={mask.id}
                data-floorplan-mask
                className="absolute bg-white"
                onMouseEnter={() => setHoverMaskId(mask.id)}
                onMouseLeave={() => setHoverMaskId((cur) => (cur === mask.id ? null : cur))}
                style={{
                  left: mmToPx(mask.positionMm.x),
                  top: mmToPx(mask.positionMm.y),
                  width: mmToPx(mask.sizeMm.w),
                  height: mmToPx(mask.sizeMm.h),
                  opacity: mask.opacity ?? 1,
                  transform: mask.rotationDeg ? `rotate(${mask.rotationDeg}deg)` : undefined,
                  // A cover is a white patch over the architect's drawing — it has to look
                  // like nothing at all, or the plan cannot be judged as it will print. The
                  // dashed hint appears only under the pointer, or when it is selected.
                  outline: isSel ? "2px solid #3b82f6" : tool === "select" && hoverMaskId === mask.id ? "1px dashed #cbd5e1" : undefined,
                  outlineOffset: -1,
                  cursor: tool === "select" ? (mask.locked ? "default" : "move") : "inherit",
                  zIndex: isSel ? 6 : 5,
                }}
                onMouseDown={(e) => {
                  if (tool !== "select") return;
                  e.stopPropagation();
                  didMoveRef.current = false;
                  setSelection({ kind: "mask", id: mask.id });
                  // A locked cover can still be selected and edited — it just does not move.
                  if (mask.locked) return;
                  setDragging({ kind: "mask", maskId: mask.id, startClient: { x: e.clientX, y: e.clientY }, start: { ...mask.positionMm } });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelection({ kind: "mask", id: mask.id });
                  setMaskMenu({ x: e.clientX, y: e.clientY, id: mask.id });
                }}
                title={mask.locked
                  ? t("Cover (locked) — right-click to turn, fade or unlock it.")
                  : t("Cover — hides the underlay beneath it. Drag to move, corner to resize, Delete to remove. Right-click for turn, fade and lock.")}
              >
                {isSel && !mask.locked && (
                  <div
                    className="absolute bg-blue-500"
                    style={{ right: -5, bottom: -5, width: 10, height: 10, cursor: "nwse-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      didMoveRef.current = false;
                      setDragging({ kind: "mask-resize", maskId: mask.id, startClient: { x: e.clientX, y: e.clientY }, startSize: { ...mask.sizeMm } });
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Cover being drawn */}
          {dragging?.kind === "mask-draw" && (() => {
            const r = rectFromDrag(dragging.start, dragging.current, page);
            return (
              <div
                className="absolute bg-white/80 border border-dashed border-blue-500 pointer-events-none"
                style={{ left: mmToPx(r.positionMm.x), top: mmToPx(r.positionMm.y), width: mmToPx(r.sizeMm.w), height: mmToPx(r.sizeMm.h), zIndex: 45 }}
              />
            );
          })()}

          {/* Wi-Fi coverage, computed from the access points on the plan and attenuated
              through the walls. Under everything else — it is the ground, not an overlay. */}
          <FloorplanHeatmapLayer
            page={page}
            mmToPx={mmToPx}
            aps={accessPoints}
            materialOverrides={wallMaterials}
          />

          {/* The building's walls: their own geometry, and what the heatmap attenuates through. */}
          <FloorplanWallLayer
            page={page}
            mmToPx={mmToPx}
            sheetPx={{ w: pageWPx, h: pageHPx }}
            interactive={tool === "select"}
            selectedId={selection.kind === "wall" ? selection.id : null}
            drawing={tool === "wall" ? wallDraft : null}
            onSelect={(id) => setSelection({ kind: "wall", id })}
            onContextMenu={() => { /* the panel on the right edits walls */ }}
          />

          {/* What the cameras see and the detectors reach — under the symbols, so a device
              is never hidden behind its own area. */}
          <FloorplanCoverageLayer
            page={page}
            mmToPx={mmToPx}
            sheetPx={{ w: pageWPx, h: pageHPx }}
            interactive={tool === "select"}
            selectedId={selection.kind === "coverage" ? selection.id : null}
            aimingId={dragging?.kind === "coverage-aim" ? dragging.coverageId : null}
            onSelect={(id) => setSelection({ kind: "coverage", id })}
            onContextMenu={(e, id) => setCoverageMenu({ x: e.clientX, y: e.clientY, id })}
            onMoveStart={(e, coverage) => {
              didMoveRef.current = false;
              // An anchored area is moved by moving its device — dragging the wedge itself
              // would silently break the link the plan relies on.
              if (coverage.symbolId) return;
              setDragging({ kind: "coverage", coverageId: coverage.id, startClient: { x: e.clientX, y: e.clientY }, start: { ...coverage.positionMm } });
            }}
            onAimStart={(_e, coverage) => {
              didMoveRef.current = false;
              setSelection({ kind: "coverage", id: coverage.id });
              setDragging({ kind: "coverage-aim", coverageId: coverage.id });
            }}
          />

          {/* Symbols */}
          {page.symbols.map((symbol) => {
            const group = groupById.get(symbol.groupId);
            // A switched-off layer draws nothing; its symbols stay in the project.
            if (!group || !isGroupVisible(group)) return null;
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Right-clicking outside the current selection makes this the selection,
                    // so the menu always acts on what the user pointed at.
                    const ids = selectedSymbolIds.includes(symbol.id) ? selectedSymbolIds : [symbol.id];
                    if (!selectedSymbolIds.includes(symbol.id)) setSelection({ kind: "symbols", ids });
                    setSymbolMenu({ x: e.clientX, y: e.clientY, ids });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingLabelId(symbol.id);
                    setLabelDraft(symbol.label);
                  }}
                  title={[symbol.label, deviceLabel, symbol.notes].filter(Boolean).join(" · ")}
                >
                  <SymbolGlyph group={group} sizePx={sizePx} rotationDeg={symbol.rotationDeg} symbolSizeMm={page.symbolSizeMm} />
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
                      // Rotate about the anchor, after sliding the text so its start/middle/end
                      // sits on it — the same geometry the PDF export reproduces.
                      transformOrigin: "0 0",
                      transform: `rotate(${symbol.labelRotationDeg ?? 0}deg) translate(${symbol.labelAlign === "end" ? "-100%" : symbol.labelAlign === "middle" ? "-50%" : "0"}, -50%)`,
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
                    <SymbolGlyph group={row} sizePx={mmToPx(page.symbolSizeMm)} symbolSizeMm={page.symbolSizeMm} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: mmToPx(3.2), fontWeight: 700 }}>{row.label}</div>
                      {row.description && (
                        <div style={{ fontSize: mmToPx(2.6), color: "#333" }} className="truncate">{row.description}</div>
                      )}
                    </div>
                    {page.legend.showImages && legendRowImage(row) && (
                      <div className="flex items-center shrink-0" style={{ gap: mmToPx(1.5) }}>
                        <img
                          src={legendRowImage(row)}
                          alt=""
                          style={{ height: mmToPx(LEGEND_ROW_WITH_IMAGE_MM - 3), width: mmToPx(18), objectFit: "contain" }}
                        />
                        {row.imageCaption && <span style={{ fontSize: mmToPx(2.4), fontWeight: 600 }}>{row.imageCaption}</span>}
                      </div>
                    )}
                  </div>
                ))}
                {legendLineRows.length > 0 && (
                  <div style={{ marginTop: mmToPx(LEGEND_LINES_GAP_MM) }}>
                    <div style={{ fontSize: mmToPx(3), fontWeight: 700, height: mmToPx(LEGEND_LINES_TITLE_MM), borderTop: "0.5px solid #999", paddingTop: mmToPx(1.5) }}>
                      {page.legend.linesTitle ?? t(DEFAULT_LEGEND_LINES_TITLE)}
                    </div>
                    <div className="flex" style={{ fontSize: mmToPx(2.4), height: mmToPx(LEGEND_LINE_ROW_MM), fontWeight: 700, color: "#222", borderBottom: "0.3px solid #ccc" }}>
                      <span style={{ width: `${LEGEND_LINE_COLS[0] * 100}%` }}>{t("Line")}</span>
                      <span style={{ width: `${LEGEND_LINE_COLS[1] * 100}%` }}>{t("Amplifier · channel")}</span>
                      <span style={{ width: `${LEGEND_LINE_COLS[2] * 100}%`, textAlign: "right", paddingRight: mmToPx(1) }}>{t("Qty")}</span>
                      <span style={{ width: `${LEGEND_LINE_COLS[3] * 100}%` }}>{t("Load")}</span>
                    </div>
                    {legendLineRows.map((r) => (
                      <div key={r.lineNo} className="flex" style={{ fontSize: mmToPx(2.4), height: mmToPx(LEGEND_LINE_ROW_MM), color: "#222" }}>
                        <span className="truncate" style={{ width: `${LEGEND_LINE_COLS[0] * 100}%`, fontWeight: 700 }}>{r.lineNo}</span>
                        <span className="truncate" style={{ width: `${LEGEND_LINE_COLS[1] * 100}%` }}>{r.name ? `${r.feed} — ${r.name}` : r.feed}</span>
                        <span style={{ width: `${LEGEND_LINE_COLS[2] * 100}%`, textAlign: "right", paddingRight: mmToPx(1) }}>{r.count}</span>
                        <span className="truncate" style={{ width: `${LEGEND_LINE_COLS[3] * 100}%` }}>{r.load}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                {showCompany && (
                  <div className="flex items-center" style={{ marginTop: mmToPx(LEGEND_COMPANY_GAP_MM), gap: mmToPx(3), borderTop: "0.5px solid #999", paddingTop: mmToPx(1) }}>
                    {companyProfile.logo && (
                      <img src={companyProfile.logo} alt="" style={{ height: mmToPx(LEGEND_COMPANY_LOGO_MM), maxWidth: mmToPx(40), objectFit: "contain" }} />
                    )}
                    <div className="min-w-0">
                      {companyProfileLines(companyProfile).map((l, i) => (
                        <div key={i} className="truncate" style={{ fontSize: mmToPx(i === 0 ? 2.8 : 2.4), fontWeight: i === 0 ? 700 : 400, height: mmToPx(LEGEND_COMPANY_LINE_MM), color: "#222" }}>
                          {l}
                        </div>
                      ))}
                    </div>
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
                    title={t("Resize the legend box")}
                  />
                  <div
                    className="absolute bg-blue-500"
                    style={{ bottom: -5, left: "50%", width: 10, height: 10, marginLeft: -5, cursor: "ns-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      didMoveRef.current = false;
                      setDragging({ kind: "legend-height", startClient: { x: e.clientX, y: e.clientY }, startHeight: legendH });
                    }}
                    title={t("Stretch the legend box downwards (to cover what lies beneath)")}
                  />
                </>
              )}
            </div>
          )}

          {/* Free text notes */}
          {page.notes.map((note: FloorplanNote) => {
            const nl = layoutNote(note);
            const isSel = selection.kind === "note" && selection.id === note.id;
            const isEditing = editingNoteId === note.id;
            const pad = note.boxed ? mmToPx(1.5) : 0;
            return (
              <div
                key={note.id}
                className="absolute"
                style={{
                  left: mmToPx(note.positionMm.x),
                  top: mmToPx(note.positionMm.y),
                  width: mmToPx(note.widthMm),
                  minHeight: mmToPx(nl.heightMm),
                  background: note.boxed ? "white" : "transparent",
                  border: note.boxed ? "0.5px solid #333" : undefined,
                  padding: pad,
                  boxSizing: "border-box",
                  cursor: tool === "select" ? "move" : "inherit",
                  zIndex: isSel ? 24 : 18,
                }}
                onMouseDown={(e) => {
                  if (tool !== "select" || isEditing) return;
                  e.stopPropagation();
                  didMoveRef.current = false;
                  setSelection({ kind: "note", id: note.id });
                  setDragging({ kind: "note", noteId: note.id, startClient: { x: e.clientX, y: e.clientY }, start: { ...note.positionMm } });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setSelection({ kind: "note", id: note.id });
                  setEditingNoteId(note.id);
                  setNoteDraft(note.text);
                }}
              >
                {isEditing ? (
                  <textarea
                    autoFocus
                    className="w-full outline-none border border-blue-400 rounded-sm bg-white resize-none"
                    style={{ fontSize: mmToPx(note.fontSizeMm), lineHeight: 1.4, color: note.color ?? "#111", minHeight: mmToPx(nl.heightMm + 6), padding: 0 }}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onBlur={() => {
                      if (noteDraft.trim()) updateFloorplanNote(page.id, note.id, { text: noteDraft });
                      else removeFloorplanNote(page.id, note.id);
                      setEditingNoteId(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") { setNoteDraft(note.text); e.currentTarget.blur(); }
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.blur();
                    }}
                    data-allow-scroll
                  />
                ) : (
                  nl.lines.map((l, i) => (
                    <div key={i} style={{ fontSize: mmToPx(note.fontSizeMm), lineHeight: `${mmToPx(nl.lineHeightMm)}px`, color: note.color ?? "#111", whiteSpace: "pre", height: mmToPx(nl.lineHeightMm) }}>
                      {l || " "}
                    </div>
                  ))
                )}
                {isSel && !isEditing && (
                  <>
                    <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                    <div
                      className="absolute bg-blue-500"
                      style={{ right: -5, top: "50%", width: 10, height: 10, marginTop: -5, cursor: "ew-resize" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        didMoveRef.current = false;
                        setDragging({ kind: "note-resize", noteId: note.id, startClient: { x: e.clientX, y: e.clientY }, startWidth: note.widthMm });
                      }}
                      title={t("Change the note's wrap width")}
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* Drawing block (Plankopf) */}
          {page.drawingBlock.visible && (
            <div
              className="absolute"
              style={{
                left: mmToPx(page.drawingBlock.positionMm.x),
                top: mmToPx(page.drawingBlock.positionMm.y),
                width: mmToPx(page.drawingBlock.widthMm),
                zIndex: 25,
                cursor: tool === "select" ? "move" : "default",
              }}
              onMouseDown={(e) => {
                if (tool !== "select") return;
                e.stopPropagation();
                didMoveRef.current = false;
                setSelection({ kind: "drawing" });
                setDragging({ kind: "drawing", startClient: { x: e.clientX, y: e.clientY }, start: { ...page.drawingBlock.positionMm } });
              }}
            >
              <FloorplanDrawingBlockView block={page.drawingBlock} layout={drawingLayout} mmToPx={mmToPx} logoSrc={blockLogo} />
              {selection.kind === "drawing" && (
                <>
                  <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                  <div
                    className="absolute bg-blue-500"
                    style={{ right: -5, top: "50%", width: 10, height: 10, marginTop: -5, cursor: "ew-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      didMoveRef.current = false;
                      setDragging({ kind: "drawing-resize", startClient: { x: e.clientX, y: e.clientY }, startWidth: page.drawingBlock.widthMm });
                    }}
                    title={t("Resize the drawing block")}
                  />
                  <div
                    className="absolute bg-blue-500"
                    style={{ bottom: -5, left: "50%", width: 10, height: 10, marginLeft: -5, cursor: "ns-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      didMoveRef.current = false;
                      setDragging({ kind: "drawing-height", startClient: { x: e.clientX, y: e.clientY }, startHeight: drawingLayout.heightMm });
                    }}
                    title={t("Stretch the drawing block downwards (the title band grows)")}
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
          {!underlay && page.symbols.length === 0 && page.notes.length === 0 && page.masks.length === 0 && (page.coverages ?? []).length === 0 && (page.walls ?? []).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm pointer-events-none">
              {t("Import the architect's drawing from the toolbar, then drag devices onto it.")}
            </div>
          )}
        </div>
      </div>

      {/* Label placement for the selected symbols */}
      {/* Right-click on a symbol */}
      {symbolMenu && (
        <FloorplanSymbolContextMenu
          page={page}
          x={symbolMenu.x}
          y={symbolMenu.y}
          ids={symbolMenu.ids}
          onSelectCoverage={(id) => setSelection({ kind: "coverage", id })}
          onClose={() => setSymbolMenu(null)}
        />
      )}

      {/* Right-click on a cover */}
      {coverageMenu && (
        <FloorplanCoverageContextMenu
          page={page}
          x={coverageMenu.x}
          y={coverageMenu.y}
          coverageId={coverageMenu.id}
          onClose={() => setCoverageMenu(null)}
        />
      )}

      {maskMenu && (
        <FloorplanMaskContextMenu
          page={page}
          x={maskMenu.x}
          y={maskMenu.y}
          maskId={maskMenu.id}
          onClose={() => setMaskMenu(null)}
        />
      )}

      {/* Calibration prompt */}
      {tool === "calibrate" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white border border-amber-300 rounded shadow-lg px-3 py-2 text-xs flex items-center gap-2" data-print-hide>
          {calibPicks.length < 2 ? (
            <span className="text-amber-800">
              {calibPicks.length === 0
                ? t("Click the first end of a known dimension on the plan.")
                : t("Click the other end.")}
            </span>
          ) : (
            <>
              <span className="text-neutral-700">{t("That distance is")}</span>
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
                {t("Apply")}
              </button>
            </>
          )}
          <button
            className="px-2 py-0.5 text-neutral-500 hover:text-neutral-800"
            onClick={() => { setCalibPicks([]); onToolChange("select"); }}
          >
            {t("Cancel")}
          </button>
        </div>
      )}

      {/* Tool + zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 border border-neutral-300 rounded shadow px-2 py-1 text-xs select-none" data-print-hide>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "select" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => onToolChange("select")}
          title={t("Select and move (Esc)")}
        >
          ⬉ {t("Select")}
        </button>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "place" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => onToolChange(tool === "place" ? "select" : "place")}
          title={t("Click the plan to drop symbols of the active group")}
        >
          ✚ {t("Place")}
        </button>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "note" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => onToolChange(tool === "note" ? "select" : "note")}
          title={t("Click the plan to add a text note (installation hint, remark)")}
        >
          ✎ {t("Note")}
        </button>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "wall" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => { setWallDraft(null); onToolChange(tool === "wall" ? "select" : "wall"); }}
          title={t("Click the plan to trace a wall run — click the last point again or press Enter to finish, Esc to abandon. Set the build-up and thickness in the panel on the right.")}
        >
          ▨ {t("Wall")}
        </button>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "coverage" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => onToolChange(tool === "coverage" ? "select" : "coverage")}
          title={t("Click the plan to drop a detection area — what a camera sees, what a motion detector reaches. Drag its edge to aim it.")}
        >
          ◔ {t("Coverage")}
        </button>
        <button
          className={`px-2 py-0.5 rounded cursor-pointer ${tool === "erase" ? "bg-emerald-100 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"}`}
          onClick={() => onToolChange(tool === "erase" ? "select" : "erase")}
          title={t("Drag a white cover over part of the architect's plan to take it out (legend, notes, title block)")}
        >
          ▭ {t("Erase")}
        </button>
        <div className="border-l border-neutral-200 h-3" />
        <span className="text-neutral-500 px-1" title={t("Drawing scale")}>{formatScale(page.scaleDenominator)}</span>
        <div className="border-l border-neutral-200 h-3" />
        <button className="px-2 py-0.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer" onClick={fitView}>{t("Fit")}</button>
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
