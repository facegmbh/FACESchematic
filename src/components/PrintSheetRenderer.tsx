import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import { type TrackpadGesture, createTrackpadGesture, nextWheelViewport } from "../wheelViewport";
import type { PrintSheetPage, PrintViewport, RackElevationPage, DeviceData, RackData } from "../types";
import { getPaperSize, PAGE_MARGIN_IN, TITLE_BLOCK_HEIGHT_IN } from "../printConfig";
import { PX_PER_MM } from "../rackUtils";
import { computeRackStats, formatStatsLine } from "../rackStats";
import { computeDragSnap, computeResizeSnap, type SheetGuide, type Rect } from "../printSheetSnap";
import RackFaceSVG from "./RackFaceSVG";
import TitleBlockSVG from "./TitleBlockSVG";

const IN_TO_MM = 25.4;
const SCREEN_PPI = 96;
const SNAP_THRESHOLD_MM = 3;


/** Natural aspect ratio of a rack face SVG (matches RackFaceSVG viewBox). width/height. */
function getNaturalAspect(rack: RackData, face: "front" | "rear" | "side"): number {
  const VB_H = rack.heightU * 24 + 24;
  if (face === "side") {
    const VB_W = Math.max(80, rack.depthMm * PX_PER_MM) + 16;
    return VB_W / VB_H;
  }
  return 296 / VB_H;
}

// ── Main renderer ───────────────────────────────────────────────────

interface Props {
  page: PrintSheetPage;
}

export default function PrintSheetRenderer({ page }: Props) {
  const nodes = useSchematicStore((s) => s.nodes);
  const allPages = useSchematicStore((s) => s.pages);
  const addViewport = useSchematicStore((s) => s.addViewport);
  const updateViewport = useSchematicStore((s) => s.updateViewport);
  const removeViewport = useSchematicStore((s) => s.removeViewport);
  const setPendingUndoSnapshot = useSchematicStore((s) => s.setPendingUndoSnapshot);
  const flushPendingSnapshot = useSchematicStore((s) => s.flushPendingSnapshot);
  const clearPendingUndoSnapshot = useSchematicStore((s) => s.clearPendingUndoSnapshot);
  const pushSnapshot = useSchematicStore((s) => s.pushSnapshot);
  const titleBlock = useSchematicStore((s) => s.titleBlock);
  const titleBlockLayout = useSchematicStore((s) => s.titleBlockLayout);
  const panMode = useSchematicStore((s) => s.panMode);
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const wrapDeviceLabels = useSchematicStore((s) => s.wrapDeviceLabels);

  const deviceDataMap = useMemo(() => {
    const m = new Map<string, DeviceData>();
    for (const n of nodes) if (n.type === "device") m.set(n.id, n.data as DeviceData);
    return m;
  }, [nodes]);

  const elevationPages = allPages.filter((p): p is RackElevationPage => p.type === "rack-elevation");

  const paper = getPaperSize(page.paperId, page.customWidthIn, page.customHeightIn);
  const pageWIn = page.orientation === "landscape" ? paper.heightIn : paper.widthIn;
  const pageHIn = page.orientation === "landscape" ? paper.widthIn : paper.heightIn;
  const pageWPx = pageWIn * SCREEN_PPI;
  const pageHPx = pageHIn * SCREEN_PPI;
  const mmToPagePx = (mm: number) => (mm / IN_TO_MM) * SCREEN_PPI;

  // Title block geometry (matches pdfExport.ts drawTitleBlock)
  const marginPx = PAGE_MARGIN_IN * SCREEN_PPI;
  const tbHeightPx = (titleBlockLayout?.heightIn ?? TITLE_BLOCK_HEIGHT_IN) * SCREEN_PPI;
  const tbWidthPx = Math.min((titleBlockLayout?.widthIn ?? 3) * SCREEN_PPI, pageWPx - 2 * marginPx);
  const tbLeftPx = pageWPx - marginPx - tbWidthPx;
  const tbTopPx = pageHPx - marginPx - tbHeightPx;

  // Page number for title block
  const printSheetPages = allPages.filter((p) => p.type === "print-sheet");
  const pageNum = printSheetPages.findIndex((p) => p.id === page.id) + 1;
  const totalPages = printSheetPages.length;

  // ── Zoom / pan (mirrors main canvas controls) ───────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const vpRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const setViewport = useCallback((z: number, p: { x: number; y: number }) => {
    vpRef.current = { zoom: z, pan: p };
    setZoom(z);
    setPan(p);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const ctrlHeldRef = useRef(false);
  const spaceHeldRef = useRef(false);

  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const padding = 48;
    const z = Math.min((el.clientWidth - padding * 2) / pageWPx, (el.clientHeight - padding * 2) / pageHPx, 2);
    const p = { x: (el.clientWidth - pageWPx * z) / 2, y: (el.clientHeight - pageHPx * z) / 2 };
    setViewport(z, p);
  }, [pageWPx, pageHPx, setViewport]);

  useEffect(() => { fitView(); }, [page.id, page.paperId, page.orientation, fitView]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") ctrlHeldRef.current = true;
      if (e.key === " ") {
        if (document.activeElement && (document.activeElement as HTMLElement).tagName === "INPUT") return;
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
        minZoom: 0.1,
        maxZoom: 4,
      });
      setViewport(next.zoom, { x: next.x, y: next.y });
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => { el.removeEventListener("wheel", handler, { capture: true }); gesture.dispose(); };
  }, [setViewport]);

  // ── Viewport interaction ─────────────────────────────────────────
  const [selectedVpIds, setSelectedVpIds] = useState<string[]>([]);
  const selectedVpIdsRef = useRef<string[]>([]);
  useEffect(() => { selectedVpIdsRef.current = selectedVpIds; }, [selectedVpIds]);

  type DragState = {
    startClientX: number;
    startClientY: number;
    starts: Record<string, { x: number; y: number }>; // viewport id → start position
  };
  type SingleResizeState = {
    kind: "single";
    vpId: string;
    startClientX: number;
    startClientY: number;
    startPos: { x: number; y: number };
    startSize: { w: number; h: number };
    aspect: number; // natural aspect (width/height) of rack face
  };
  type GroupResizeState = {
    kind: "group";
    startClientX: number;
    startClientY: number;
    groupStart: Rect;
    starts: Record<string, Rect>; // viewport id → starting rect
  };

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<SingleResizeState | GroupResizeState | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; startPan: { x: number; y: number } } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SheetGuide[]>([]);
  const didMoveRef = useRef(false);
  // State mirror of didMoveRef — used during render for cursor styling. The
  // ref still drives synchronous handler logic; the state just rerenders so
  // the cursor flips to "grabbing" when the user actually starts panning.
  const [didMove, setDidMove] = useState(false);

  // Pixel→mm helpers (zoom-aware)
  const clientPxToMm = useCallback((dxClient: number, dyClient: number) => {
    const { zoom: z } = vpRef.current;
    return {
      dxMm: (dxClient / z / pageWPx) * pageWIn * IN_TO_MM,
      dyMm: (dyClient / z / pageHPx) * pageHIn * IN_TO_MM,
    };
  }, [pageWPx, pageHPx, pageWIn, pageHIn]);

  const vpRect = useCallback((vp: PrintViewport): Rect => ({
    x: vp.positionMm.x, y: vp.positionMm.y, w: vp.sizeMm.w, h: vp.sizeMm.h,
  }), []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const willPan = e.button === 1 || spaceHeld || panMode === "pan-first";
    if (e.button === 1) e.preventDefault();
    didMoveRef.current = false;
    setDidMove(false);
    setPanning({ startX: e.clientX, startY: e.clientY, startPan: { ...vpRef.current.pan } });
    if (!willPan) return;
  }, [spaceHeld, panMode]);

  const handleVpMouseDown = useCallback((e: React.MouseEvent, vp: PrintViewport) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const wasSelected = selectedVpIdsRef.current.includes(vp.id);

    let nextSelection: string[];
    if (additive) {
      nextSelection = wasSelected
        ? selectedVpIdsRef.current.filter((id) => id !== vp.id)
        : [...selectedVpIdsRef.current, vp.id];
    } else if (!wasSelected) {
      nextSelection = [vp.id];
    } else {
      nextSelection = selectedVpIdsRef.current; // keep current multi-selection if dragging an already-selected one
    }
    setSelectedVpIds(nextSelection);
    selectedVpIdsRef.current = nextSelection;

    // Build drag state with starting positions for every selected viewport.
    const starts: Record<string, { x: number; y: number }> = {};
    for (const id of nextSelection) {
      const v = page.viewports.find((vv) => vv.id === id);
      if (v) starts[id] = { ...v.positionMm };
    }
    didMoveRef.current = false;
    setDidMove(false);
    setPendingUndoSnapshot();
    setDragging({ startClientX: e.clientX, startClientY: e.clientY, starts });
  }, [page.viewports, setPendingUndoSnapshot]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, vp: PrintViewport) => {
    e.stopPropagation();
    const elevPage = elevationPages.find((p) => p.id === vp.rackRefPageId);
    const rack = elevPage?.racks.find((r) => r.id === vp.rackRefId);
    const face: "front" | "rear" | "side" = vp.kind === "rack-rear" ? "rear" : vp.kind === "rack-side" ? "side" : "front";
    const aspect = rack ? getNaturalAspect(rack, face) : vp.sizeMm.w / vp.sizeMm.h;
    setSelectedVpIds([vp.id]);
    selectedVpIdsRef.current = [vp.id];
    didMoveRef.current = false;
    setDidMove(false);
    setPendingUndoSnapshot();
    setResizing({
      kind: "single",
      vpId: vp.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos: { ...vp.positionMm },
      startSize: { ...vp.sizeMm },
      aspect,
    });
  }, [elevationPages, setPendingUndoSnapshot]);

  const handleGroupResizeMouseDown = useCallback((e: React.MouseEvent, groupRect: Rect) => {
    e.stopPropagation();
    const starts: Record<string, Rect> = {};
    for (const id of selectedVpIdsRef.current) {
      const v = page.viewports.find((vv) => vv.id === id);
      if (v) starts[id] = vpRect(v);
    }
    didMoveRef.current = false;
    setDidMove(false);
    setPendingUndoSnapshot();
    setResizing({
      kind: "group",
      startClientX: e.clientX,
      startClientY: e.clientY,
      groupStart: { ...groupRect },
      starts,
    });
  }, [page.viewports, vpRect, setPendingUndoSnapshot]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const { dxMm, dyMm } = clientPxToMm(e.clientX - dragging.startClientX, e.clientY - dragging.startClientY);
      const ids = Object.keys(dragging.starts);
      if (Math.abs(e.clientX - dragging.startClientX) > 2 || Math.abs(e.clientY - dragging.startClientY) > 2) {
        if (!didMoveRef.current) setDidMove(true);
        didMoveRef.current = true;
      }

      // Snap: compute against viewports outside the selection. Use the bounding rect of
      // the dragged group as the moving rect — snaps the group as a whole.
      let groupMinX = Infinity, groupMinY = Infinity, groupMaxX = -Infinity, groupMaxY = -Infinity;
      for (const id of ids) {
        const v = page.viewports.find((vv) => vv.id === id);
        if (!v) continue;
        const sx = dragging.starts[id].x + dxMm;
        const sy = dragging.starts[id].y + dyMm;
        groupMinX = Math.min(groupMinX, sx);
        groupMinY = Math.min(groupMinY, sy);
        groupMaxX = Math.max(groupMaxX, sx + v.sizeMm.w);
        groupMaxY = Math.max(groupMaxY, sy + v.sizeMm.h);
      }
      const movingGroup: Rect = { x: groupMinX, y: groupMinY, w: groupMaxX - groupMinX, h: groupMaxY - groupMinY };
      const others: Rect[] = page.viewports.filter((vv) => !ids.includes(vv.id)).map(vpRect);
      const marginMm = PAGE_MARGIN_IN * IN_TO_MM;
      const pageWMm = pageWIn * IN_TO_MM;
      const pageHMm = pageHIn * IN_TO_MM;
      const snap = e.altKey ? { snappedX: movingGroup.x, snappedY: movingGroup.y, guides: [] } : computeDragSnap(movingGroup, others, pageWMm, pageHMm, marginMm, SNAP_THRESHOLD_MM);
      const snapDx = snap.snappedX - movingGroup.x;
      const snapDy = snap.snappedY - movingGroup.y;
      setSnapGuides(snap.guides);

      for (const id of ids) {
        const start = dragging.starts[id];
        updateViewport(page.id, id, { positionMm: { x: start.x + dxMm + snapDx, y: start.y + dyMm + snapDy } });
      }
    } else if (resizing) {
      const { dxMm, dyMm } = clientPxToMm(e.clientX - resizing.startClientX, e.clientY - resizing.startClientY);
      if (Math.abs(dxMm) > 0.1 || Math.abs(dyMm) > 0.1) {
        if (!didMoveRef.current) setDidMove(true);
        didMoveRef.current = true;
      }
      const marginMm = PAGE_MARGIN_IN * IN_TO_MM;
      const pageWMm = pageWIn * IN_TO_MM;
      const pageHMm = pageHIn * IN_TO_MM;

      if (resizing.kind === "single") {
        const r = resizing;
        const aspectLock = !e.shiftKey;
        let newW = Math.max(20, r.startSize.w + dxMm);
        let newH = Math.max(20, r.startSize.h + dyMm);
        if (aspectLock && r.aspect > 0) {
          // Drive by the dimension whose proportional delta is larger.
          const dW_rel = Math.abs(dxMm) / r.startSize.w;
          const dH_rel = Math.abs(dyMm) / r.startSize.h;
          if (dW_rel >= dH_rel) {
            newH = newW / r.aspect;
          } else {
            newW = newH * r.aspect;
          }
        }

        // Snap edges to other viewports / page margins.
        const others: Rect[] = page.viewports.filter((vv) => vv.id !== r.vpId).map(vpRect);
        const moving: Rect = { x: r.startPos.x, y: r.startPos.y, w: newW, h: newH };
        const snap = e.altKey ? { snappedW: newW, snappedH: newH, guides: [] } : computeResizeSnap(moving, others, pageWMm, pageHMm, marginMm, SNAP_THRESHOLD_MM);
        let finalW = snap.snappedW;
        let finalH = snap.snappedH;
        if (aspectLock && r.aspect > 0) {
          // Re-apply aspect after snap — drive again by largest delta from start.
          const dW_rel = Math.abs(finalW - r.startSize.w) / r.startSize.w;
          const dH_rel = Math.abs(finalH - r.startSize.h) / r.startSize.h;
          if (dW_rel >= dH_rel) finalH = finalW / r.aspect;
          else finalW = finalH * r.aspect;
        }
        setSnapGuides(snap.guides);
        updateViewport(page.id, r.vpId, { sizeMm: { w: finalW, h: finalH } });
      } else {
        // Group resize — uniform scale based on max relative delta of right/bottom edge.
        const r = resizing;
        const newRight = r.groupStart.x + r.groupStart.w + dxMm;
        const newBottom = r.groupStart.y + r.groupStart.h + dyMm;
        const newW = Math.max(20, newRight - r.groupStart.x);
        const newH = Math.max(20, newBottom - r.groupStart.y);
        // Pick scale: largest of width/height ratios so corner drag scales group uniformly.
        const sx = newW / r.groupStart.w;
        const sy = newH / r.groupStart.h;
        const scale = e.shiftKey ? Math.max(sx, sy) : Math.max(0.1, Math.max(sx, sy)); // shift = same; could differ later
        const finalGroupW = r.groupStart.w * scale;
        const finalGroupH = r.groupStart.h * scale;
        for (const id of Object.keys(r.starts)) {
          const start = r.starts[id];
          const relX = (start.x - r.groupStart.x) / r.groupStart.w;
          const relY = (start.y - r.groupStart.y) / r.groupStart.h;
          updateViewport(page.id, id, {
            positionMm: { x: r.groupStart.x + relX * finalGroupW, y: r.groupStart.y + relY * finalGroupH },
            sizeMm: { w: start.w * scale, h: start.h * scale },
          });
        }
        setSnapGuides([]);
      }
    } else if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        if (!didMoveRef.current) setDidMove(true);
        didMoveRef.current = true;
      }
      setViewport(vpRef.current.zoom, { x: panning.startPan.x + dx, y: panning.startPan.y + dy });
    }
  }, [dragging, resizing, panning, page.id, page.viewports, pageWIn, pageHIn, updateViewport, setViewport, clientPxToMm, vpRect]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (panning && !didMoveRef.current && e.button === 0 && panMode !== "pan-first" && !spaceHeldRef.current) {
      setSelectedVpIds([]);
      selectedVpIdsRef.current = [];
    }
    if (dragging || resizing) {
      if (didMoveRef.current) flushPendingSnapshot();
      else clearPendingUndoSnapshot();
    }
    setDragging(null);
    setResizing(null);
    setPanning(null);
    setSnapGuides([]);
  }, [panning, panMode, dragging, resizing, flushPendingSnapshot, clearPendingUndoSnapshot]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-print-viewport");
    if (!raw) return;
    const { pageId, rackId, kind } = JSON.parse(raw) as { pageId: string; rackId: string; kind: PrintViewport["kind"] };
    const rect = containerRef.current!.getBoundingClientRect();
    const { zoom: z, pan: p } = vpRef.current;
    const paperX = (e.clientX - rect.left - p.x) / z;
    const paperY = (e.clientY - rect.top - p.y) / z;
    const dropXMm = (paperX / pageWPx) * pageWIn * IN_TO_MM;
    const dropYMm = (paperY / pageHPx) * pageHIn * IN_TO_MM;
    const defaultW = (pageWIn / 3) * IN_TO_MM;
    const defaultH = (pageHIn / 2) * IN_TO_MM;
    addViewport(page.id, { kind, rackRefPageId: pageId, rackRefId: rackId, positionMm: { x: dropXMm - defaultW / 2, y: dropYMm - defaultH / 2 }, sizeMm: { w: defaultW, h: defaultH }, showLabel: true });
  }, [page.id, pageWIn, pageHIn, pageWPx, pageHPx, addViewport]);

  const resetSelectionSize = useCallback(() => {
    if (selectedVpIdsRef.current.length === 0) return;
    pushSnapshot();
    for (const id of selectedVpIdsRef.current) {
      const v = page.viewports.find((vv) => vv.id === id);
      if (!v) continue;
      const elevPage = elevationPages.find((p) => p.id === v.rackRefPageId);
      const rack = elevPage?.racks.find((r) => r.id === v.rackRefId);
      if (!rack) continue;
      const face: "front" | "rear" | "side" = v.kind === "rack-rear" ? "rear" : v.kind === "rack-side" ? "side" : "front";
      const aspect = getNaturalAspect(rack, face);
      // Keep height, snap width to natural aspect.
      updateViewport(page.id, id, { sizeMm: { w: v.sizeMm.h * aspect, h: v.sizeMm.h } });
    }
  }, [page.viewports, page.id, elevationPages, updateViewport, pushSnapshot]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedVpIdsRef.current.length > 0) {
      e.preventDefault();
      for (const id of selectedVpIdsRef.current) removeViewport(page.id, id);
      setSelectedVpIds([]);
      selectedVpIdsRef.current = [];
    } else if ((e.key === "r" || e.key === "R") && selectedVpIdsRef.current.length > 0) {
      // Don't trigger when typing in an input field.
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      resetSelectionSize();
    } else if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const all = page.viewports.map((v) => v.id);
      setSelectedVpIds(all);
      selectedVpIdsRef.current = all;
    } else if (e.key === "Escape") {
      setSelectedVpIds([]);
      selectedVpIdsRef.current = [];
    }
  }, [page.id, page.viewports, removeViewport, resetSelectionSize]);

  const isPanning = panning !== null && (didMove || spaceHeld || panMode === "pan-first");

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 bg-neutral-300 outline-none"
        tabIndex={0}
        style={{ cursor: isPanning ? "grabbing" : spaceHeld ? "grab" : "default", userSelect: "none" }}
        onKeyDown={handleKeyDown}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Paper */}
        <div
          className="bg-white shadow-xl absolute"
          style={{ width: pageWPx, height: pageHPx, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {/* Content border (matches pdfExport.ts drawContentBorder) */}
          <div
            className="absolute pointer-events-none"
            style={{ left: marginPx, top: marginPx, right: marginPx, bottom: marginPx, border: "0.72px solid #000" }}
          />

          {/* Viewports */}
          {page.viewports.map((vp) => {
            const xPx = mmToPagePx(vp.positionMm.x);
            const yPx = mmToPagePx(vp.positionMm.y);
            const wPx = mmToPagePx(vp.sizeMm.w);
            const hPx = mmToPagePx(vp.sizeMm.h);
            const elevPage = elevationPages.find((p) => p.id === vp.rackRefPageId);
            const rack = elevPage?.racks.find((r) => r.id === vp.rackRefId);
            const isSelected = selectedVpIds.includes(vp.id);
            const isOnlySelected = isSelected && selectedVpIds.length === 1;
            const kindLabel = vp.kind === "rack-front" ? "Front" : vp.kind === "rack-rear" ? "Rear" : "Side";
            const face = vp.kind === "rack-rear" ? "rear" : vp.kind === "rack-side" ? "side" : "front";

            const rackPlacements = rack && elevPage ? elevPage.placements.filter((p) => p.rackId === rack.id) : [];
            const rackAccessories = rack && elevPage ? elevPage.accessories.filter((a) => a.rackId === rack.id) : [];
            const stats = rack && vp.showStats !== false
              ? computeRackStats(rack, rackPlacements, rackAccessories, deviceDataMap)
              : null;
            const statsLine = stats ? formatStatsLine(stats) : null;
            const caveatLine = stats && (stats.unknownDepthCount > 0 || stats.unknownWeightCount > 0 || stats.unknownPowerCount > 0)
              ? [
                  stats.unknownDepthCount > 0 ? `${stats.unknownDepthCount} unknown depth` : null,
                  stats.unknownWeightCount > 0 ? `${stats.unknownWeightCount} unknown weight` : null,
                  stats.unknownPowerCount > 0 ? `${stats.unknownPowerCount} unknown power` : null,
                ].filter(Boolean).join(" · ")
              : null;

            return (
              <Fragment key={vp.id}>
                <div
                  className={`absolute ${isSelected ? "z-10" : ""}`}
                  style={{ left: xPx, top: yPx, width: wPx, height: hPx, cursor: "move" }}
                  onMouseDown={(e) => handleVpMouseDown(e, vp)}
                >
                  {rack ? (
                    <RackFaceSVG
                      rack={rack}
                      placements={rackPlacements}
                      accessories={rackAccessories}
                      deviceDataMap={deviceDataMap}
                      face={face}
                      widthPx={wPx}
                      heightPx={hPx}
                      schematicDefaults={{ useShortNames, wrapDeviceLabels }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-100 border border-neutral-300 text-neutral-400 text-xs">
                      Rack not found
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                  )}
                  {isOnlySelected && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
                      onMouseDown={(e) => { e.stopPropagation(); handleResizeMouseDown(e, vp); }}
                    />
                  )}
                  {isOnlySelected && (
                    <button
                      className="absolute bottom-0 left-0 w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center rounded-tr text-[11px] leading-none"
                      style={{ zIndex: 11, paddingTop: 1 }}
                      title="Reset size to natural rack aspect (shortcut: R)"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); resetSelectionSize(); }}
                    >
                      ⟲
                    </button>
                  )}
                </div>
                {/* Chrome below viewport — matches live rack page typography */}
                {vp.showLabel !== false && (
                  <div
                    className="absolute pointer-events-none"
                    style={{ left: xPx, top: yPx + hPx + 2, width: wPx,
                             fontSize: 9, fontStyle: "italic", color: "#999", textAlign: "center" }}
                  >
                    {kindLabel}
                  </div>
                )}
                {statsLine && (
                  <div
                    className="absolute pointer-events-none"
                    style={{ left: xPx, top: yPx + hPx + 14, width: wPx,
                             fontSize: 9, color: "#444", textAlign: "center" }}
                  >
                    {statsLine}
                  </div>
                )}
                {caveatLine && (
                  <div
                    className="absolute pointer-events-none"
                    style={{ left: xPx, top: yPx + hPx + 26, width: wPx,
                             fontSize: 7, color: "#999", textAlign: "center" }}
                  >
                    {caveatLine}
                  </div>
                )}
              </Fragment>
            );
          })}

          {/* Group bounding box + group resize handle (when 2+ selected) */}
          {(() => {
            if (selectedVpIds.length < 2) return null;
            const sel = page.viewports.filter((v) => selectedVpIds.includes(v.id));
            if (sel.length < 2) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const v of sel) {
              minX = Math.min(minX, v.positionMm.x);
              minY = Math.min(minY, v.positionMm.y);
              maxX = Math.max(maxX, v.positionMm.x + v.sizeMm.w);
              maxY = Math.max(maxY, v.positionMm.y + v.sizeMm.h);
            }
            const groupRect: Rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
            const left = mmToPagePx(groupRect.x);
            const top = mmToPagePx(groupRect.y);
            const width = mmToPagePx(groupRect.w);
            const height = mmToPagePx(groupRect.h);
            return (
              <>
                <div
                  className="absolute pointer-events-none border-2 border-dashed border-blue-400"
                  style={{ left, top, width, height, zIndex: 9 }}
                />
                <div
                  className="absolute bg-blue-500 cursor-se-resize"
                  style={{ left: left + width - 6, top: top + height - 6, width: 12, height: 12, zIndex: 11 }}
                  onMouseDown={(e) => handleGroupResizeMouseDown(e, groupRect)}
                />
              </>
            );
          })()}

          {/* Snap guide lines (during drag/resize) */}
          {snapGuides.map((g, i) => {
            if (g.orientation === "v") {
              const left = mmToPagePx(g.posMm);
              const top = mmToPagePx(g.fromMm);
              const height = mmToPagePx(g.toMm - g.fromMm);
              return (
                <div
                  key={`g-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    left, top, width: 1, height,
                    borderLeft: "1px dashed #3b82f6",
                    zIndex: 50,
                  }}
                />
              );
            }
            const top = mmToPagePx(g.posMm);
            const left = mmToPagePx(g.fromMm);
            const width = mmToPagePx(g.toMm - g.fromMm);
            return (
              <div
                key={`g-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left, top, width, height: 1,
                  borderTop: "1px dashed #3b82f6",
                  zIndex: 50,
                }}
              />
            );
          })}

          {/* Title block (matches pdfExport.ts layout) */}
          {page.showTitleBlock && titleBlockLayout && (
            <div className="absolute pointer-events-none" style={{ left: tbLeftPx, top: tbTopPx, width: tbWidthPx, height: tbHeightPx }}>
              <TitleBlockSVG
                tb={titleBlock}
                layout={titleBlockLayout}
                pageNum={pageNum}
                totalPages={totalPages}
                widthPx={tbWidthPx}
                heightPx={tbHeightPx}
              />
            </div>
          )}

          {/* Empty state */}
          {page.viewports.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm pointer-events-none">
              Drag a rack view from the sidebar, or use Auto-Fill in the toolbar
            </div>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 border border-neutral-300 rounded shadow px-2 py-1 text-xs select-none" data-print-hide>
        <button className="px-2 py-0.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer" onClick={fitView}>Fit</button>
        <div className="border-l border-neutral-200 h-3" />
        <button className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer" onClick={() => { const z = Math.max(0.1, vpRef.current.zoom / 1.25); setViewport(z, vpRef.current.pan); }}>−</button>
        <span className="w-10 text-center text-neutral-600">{Math.round(zoom * 100)}%</span>
        <button className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer" onClick={() => { const z = Math.min(4, vpRef.current.zoom * 1.25); setViewport(z, vpRef.current.pan); }}>+</button>
      </div>
    </div>
  );
}
