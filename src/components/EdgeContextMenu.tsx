import { useEffect, useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useSchematicStore } from "../store";
import { resolvePort } from "../packList";
import { LINE_STYLE_LABELS, LINE_STYLE_DASHARRAY, type DeviceData, type LineStyle } from "../types";
import { useContextMenuPosition } from "../hooks/useContextMenuPosition";
import MenuSubmenu from "./MenuSubmenu";
import { useT } from "../i18n";

export default function EdgeContextMenu() {
  const t = useT();
  const menu = useSchematicStore((s) => s.edgeContextMenu);
  const { setCenter, getZoom, getInternalNode } = useReactFlow();

  // Close on click anywhere or Escape
  useEffect(() => {
    if (!menu) return;
    const close = () => useSchematicStore.setState({ edgeContextMenu: null });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", close);
      document.addEventListener("contextmenu", close);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
      document.removeEventListener("contextmenu", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const addHandle = useCallback(() => {
    if (!menu) return;
    useSchematicStore.getState().addRoutingHandleAt(menu.edgeId, menu.flowX, menu.flowY);
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const removeHandle = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    if (!edge) return;

    // For stubbed edges, find closest waypoint across both stubs
    if (edge.data?.stubbed) {
      const srcWps = edge.data.stubSourceWaypoints ?? [];
      const tgtWps = edge.data.stubTargetWaypoints ?? [];
      let bestField: "stubSourceWaypoints" | "stubTargetWaypoints" | null = null;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < srcWps.length; i++) {
        const d = Math.abs(srcWps[i].x - menu.flowX) + Math.abs(srcWps[i].y - menu.flowY);
        if (d < bestDist) { bestDist = d; bestIdx = i; bestField = "stubSourceWaypoints"; }
      }
      for (let i = 0; i < tgtWps.length; i++) {
        const d = Math.abs(tgtWps[i].x - menu.flowX) + Math.abs(tgtWps[i].y - menu.flowY);
        if (d < bestDist) { bestDist = d; bestIdx = i; bestField = "stubTargetWaypoints"; }
      }
      if (!bestField || bestDist > 60) {
        useSchematicStore.setState({ edgeContextMenu: null });
        return;
      }
      store.pushSnapshot();
      const existing = bestField === "stubSourceWaypoints" ? srcWps : tgtWps;
      const newWps = existing.filter((_, i) => i !== bestIdx);
      store.patchEdgeData(menu.edgeId, { [bestField]: newWps.length > 0 ? newWps : undefined });
      useSchematicStore.setState({ edgeContextMenu: null });
      return;
    }

    if (!edge.data?.manualWaypoints?.length) return;

    const wps = edge.data.manualWaypoints;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < wps.length; i++) {
      const d = Math.abs(wps[i].x - menu.flowX) + Math.abs(wps[i].y - menu.flowY);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestDist > 60) {
      useSchematicStore.setState({ edgeContextMenu: null });
      return;
    }

    store.pushSnapshot();
    const newWps = wps.filter((_, i) => i !== bestIdx);
    if (newWps.length === 0) {
      store.clearManualWaypoints(menu.edgeId);
    } else {
      store.setManualWaypoints(menu.edgeId, newWps);
    }
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const resetRoute = useCallback(() => {
    if (!menu) return;
    useSchematicStore.getState().clearManualWaypoints(menu.edgeId);
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const editSelectedProperties = useCallback(() => {
    useSchematicStore.setState({
      edgeContextMenu: null,
      bulkConnectionEditOpen: true,
      bulkDeviceEditOpen: false,
    });
  }, []);

  const [editingLabel, setEditingLabel] = useState<false | "label" | "multicable" | "source" | "target" | "length">(false);
  const [labelValue, setLabelValue] = useState("");

  // When opened directly into length-edit mode (double-click on the length label,
  // #100), prime the editor with the current override; otherwise a fresh open of
  // the menu shows the normal item list.
  useEffect(() => {
    if (!menu) return;
    if (menu.initialEdit === "length") {
      const edge = useSchematicStore.getState().edges.find((e) => e.id === menu.edgeId);
      setLabelValue((edge?.data?.cableLength as string) ?? "");
      setEditingLabel("length");
    } else {
      setEditingLabel(false);
    }
  }, [menu]);

  const setEdgeColor = useCallback((hex: string) => {
    if (!menu) return;
    useSchematicStore.getState().patchEdgeData(menu.edgeId, { color: hex });
  }, [menu]);

  const clearEdgeColor = useCallback(() => {
    if (!menu) return;
    useSchematicStore.getState().patchEdgeData(menu.edgeId, { color: undefined });
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const { ref: menuRef, pos: menuPos } = useContextMenuPosition(
    menu?.screenX ?? 0,
    menu?.screenY ?? 0,
    [editingLabel],
  );

  const setConnectionLabel = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    setLabelValue((edge?.data?.label as string) ?? "");
    setEditingLabel("label");
  }, [menu]);

  const setCableLabel = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    setLabelValue((edge?.data?.multicableLabel as string) ?? "");
    setEditingLabel("multicable");
  }, [menu]);

  const setCableLength = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    setLabelValue((edge?.data?.cableLength as string) ?? "");
    setEditingLabel("length");
  }, [menu]);

  const setSourceEndLabel = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    setLabelValue((edge?.data?.sourceLabel as string) ?? "");
    setEditingLabel("source");
  }, [menu]);

  const setTargetEndLabel = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    setLabelValue((edge?.data?.targetLabel as string) ?? "");
    setEditingLabel("target");
  }, [menu]);

  const commitLabel = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const field =
      editingLabel === "multicable" ? "multicableLabel"
      : editingLabel === "source" ? "sourceLabel"
      : editingLabel === "target" ? "targetLabel"
      : editingLabel === "length" ? "cableLength"
      : "label";
    store.patchEdgeData(menu.edgeId, { [field]: labelValue.trim() || undefined });
    useSchematicStore.setState({ edgeContextMenu: null });
    setEditingLabel(false);
  }, [menu, labelValue, editingLabel]);

  const toggleAllowIncompatible = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    const current = edge?.data?.allowIncompatible === true;
    store.patchEdgeData(menu.edgeId, { allowIncompatible: current ? undefined : true });
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const toggleStubbed = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    if (edge?.data?.linkedConnectionId) {
      store.collapseStubsForEdge(menu.edgeId);
    } else {
      store.convertEdgeToStubs(menu.edgeId);
    }
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const toggleHideCableId = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    const current = edge?.data?.hideCableId === true;
    store.patchEdgeData(menu.edgeId, { hideCableId: current ? undefined : true });
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const toggleEdgeCableIdMode = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    const current = (edge?.data?.cableIdLabelMode as string) ?? store.cableIdLabelMode;
    const next = current === "endpoint" ? "midpoint" : "endpoint";
    store.patchEdgeData(menu.edgeId, { cableIdLabelMode: next });
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const toggleAdapterVisibility = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const edge = store.edges.find((e) => e.id === menu.edgeId);
    if (!edge) return;

    // Find the adapter node — could be source, target, or a hidden adapter in between
    let adapterId: string | null = null;
    const srcData = store.nodes.find((n) => n.id === edge.source)?.data as DeviceData | undefined;
    const tgtData = store.nodes.find((n) => n.id === edge.target)?.data as DeviceData | undefined;

    if (srcData?.deviceType === "adapter") adapterId = edge.source;
    else if (tgtData?.deviceType === "adapter") adapterId = edge.target;
    // Check for hidden adapter (virtual edge — target is hidden adapter)
    else if (store.hiddenAdapterNodeIds.has(edge.target)) adapterId = edge.target;

    if (!adapterId) return;

    const adapterData = store.nodes.find((n) => n.id === adapterId)?.data as DeviceData | undefined;
    const current = adapterData?.adapterVisibility ?? "default";
    const isCurrentlyHidden = current === "force-hide" || (current === "default" && store.hideAdapters);
    const newVisibility = isCurrentlyHidden ? "force-show" : "force-hide";

    store.patchDeviceData(adapterId, { adapterVisibility: newVisibility });
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const setLineStyle = useCallback((ls: LineStyle) => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    store.patchEdgeData(menu.edgeId, { lineStyle: ls === "solid" ? undefined : ls });
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const goToNode = useCallback((nodeId: string | undefined) => {
    if (!menu || !nodeId) return;
    const internal = getInternalNode(nodeId);
    if (!internal) return;
    const { x, y } = internal.internals.positionAbsolute;
    const w = internal.measured?.width ?? 200;
    const h = internal.measured?.height ?? 100;
    setCenter(x + w / 2, y + h / 2, { zoom: getZoom(), duration: 300 });
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu, setCenter, getZoom, getInternalNode]);

  const selectBundleMembers = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const bid = store.edges.find((e) => e.id === menu.edgeId)?.data?.bundleId;
    if (!bid) return;
    store.selectEdges(store.edges.filter((e) => e.data?.bundleId === bid).map((e) => e.id));
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const removeFromBundleItem = useCallback(() => {
    if (!menu) return;
    useSchematicStore.getState().removeFromBundle([menu.edgeId]);
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const dissolveBundleItem = useCallback(() => {
    if (!menu) return;
    const store = useSchematicStore.getState();
    const bid = store.edges.find((e) => e.id === menu.edgeId)?.data?.bundleId;
    if (bid) store.dissolveBundle(bid);
    useSchematicStore.setState({ edgeContextMenu: null });
  }, [menu]);

  const bundleSelection = useCallback(() => {
    const store = useSchematicStore.getState();
    store.createBundle(store.edges.filter((e) => e.selected).map((e) => e.id));
    useSchematicStore.setState({ edgeContextMenu: null });
  }, []);

  if (!menu) return null;

  const store = useSchematicStore.getState();
  const edge = store.edges.find((e) => e.id === menu.edgeId);
  const hasManual = !!(edge?.data?.manualWaypoints?.length);
  const isStubbed = !!edge?.data?.linkedConnectionId;
  const isCableIdHidden = edge?.data?.hideCableId === true;
  const edgeCableIdMode = (edge?.data?.cableIdLabelMode as string) ?? useSchematicStore.getState().cableIdLabelMode;
  const hasLabelOffset = !!edge?.data?.labelOffset;
  // NOTE: Stub label show-port / page-mode overrides moved to StubLabelNode.data
  // (per-stub, not per-edge). Right-click on a stub label node will surface these
  // options in a future menu; for now they fall back to the global setting.
  const currentLineStyle: LineStyle = (edge?.data?.lineStyle as LineStyle) ?? "solid";
  const hasMismatch = edge?.data?.connectorMismatch === true;
  const allowIncompatible = edge?.data?.allowIncompatible === true;
  const isDirectAttach = edge?.data?.directAttach === true;
  const customColor = (edge?.data?.color as string | undefined) ?? "";

  // Patch panel routing (#232): hops live on the source-side leg of a stubbed pair —
  // right-clicking the target leg redirects to the partner so the assignment lands right.
  const patchEdge = (() => {
    if (!edge) return undefined;
    if (!edge.data?.linkedConnectionId) return edge;
    const srcIsStub = store.nodes.find((n) => n.id === edge.source)?.type === "stub-label";
    if (!srcIsStub) return edge;
    return store.edges.find(
      (e) => e.id !== edge.id && e.data?.linkedConnectionId === edge.data?.linkedConnectionId,
    ) ?? edge;
  })();
  const isPatched = ((patchEdge?.data?.patchHops?.length ?? 0) as number) > 0;

  const patchViaPanel = () => {
    const s = useSchematicStore.getState();
    if (!patchEdge) return;
    const pageId = s.addPatchPanelPage();
    s.setPatchAssignEdge(patchEdge.id);
    s.setActivePage(pageId);
    useSchematicStore.setState({ edgeContextMenu: null });
  };

  const removePatching = () => {
    const s = useSchematicStore.getState();
    if (patchEdge) s.clearEdgePatchHops(patchEdge.id);
    useSchematicStore.setState({ edgeContextMenu: null });
  };
  const bundleId = edge?.data?.bundleId;
  const inBundle = !!bundleId && (store.bundles[bundleId]?.id != null
    || store.edges.filter((e) => e.data?.bundleId === bundleId).length >= 2);

  // Bundle-from-selection: offered when ≥2 connections are selected and the right-clicked one is
  // among them — so you can bundle a highlighted set without opening the bulk-edit panel. Hidden
  // when the selection is already a single intact bundle (use the in-bundle items instead).
  const selectedEdgeObjs = store.edges.filter((e) => e.selected);
  const selectedBundleIds = [...new Set(selectedEdgeObjs.map((e) => e.data?.bundleId).filter(Boolean))];
  const selectionIsOneBundle =
    selectedBundleIds.length === 1 && selectedEdgeObjs.every((e) => e.data?.bundleId === selectedBundleIds[0]);
  const isMultiSelection =
    selectedEdgeObjs.length >= 2 && selectedEdgeObjs.some((e) => e.id === menu.edgeId);
  const canBundleSelection = isMultiSelection && !selectionIsOneBundle;

  // Check if this is a trunk (multicable) edge
  const srcNode = store.nodes.find((n) => n.id === edge?.source);
  const tgtNode = store.nodes.find((n) => n.id === edge?.target);
  const srcPort = resolvePort(srcNode, edge?.sourceHandle);
  const tgtPort = resolvePort(tgtNode, edge?.targetHandle);
  const isTrunkEdge = !!(srcPort?.isMulticable || tgtPort?.isMulticable);

  // Check if edge connects to an adapter (visible or hidden)
  const srcIsAdapter = (srcNode?.data as DeviceData)?.deviceType === "adapter";
  const tgtIsAdapter = (tgtNode?.data as DeviceData)?.deviceType === "adapter";
  const hiddenAdapterTarget = edge ? store.hiddenAdapterNodeIds.has(edge.target) : false;
  const connectsToAdapter = srcIsAdapter || tgtIsAdapter || hiddenAdapterTarget;
  const adapterId = srcIsAdapter ? edge?.source : tgtIsAdapter ? edge?.target : hiddenAdapterTarget ? edge?.target : null;
  const adapterData = adapterId ? store.nodes.find((n) => n.id === adapterId)?.data as DeviceData | undefined : undefined;
  const adapterVisibility = adapterData?.adapterVisibility ?? "default";
  const adapterIsHidden = adapterVisibility === "force-hide" || (adapterVisibility === "default" && store.hideAdapters);

  let nearWaypoint = false;
  const checkNear = (wps: { x: number; y: number }[]) => {
    for (const wp of wps) {
      if (Math.abs(wp.x - menu.flowX) + Math.abs(wp.y - menu.flowY) < 60) return true;
    }
    return false;
  };
  if (hasManual) nearWaypoint = checkNear(edge!.data!.manualWaypoints!);

  if (editingLabel) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 bg-white border border-gray-300 rounded shadow-lg p-2 min-w-[200px]"
        style={{
          left: menuPos.x,
          top: menuPos.y,
          maxHeight: menuPos.maxHeight,
          overflowY: menuPos.maxHeight ? "auto" : undefined,
          visibility: menuPos.ready ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs text-gray-500 mb-1">
          {editingLabel === "multicable" ? t("Cable Label")
            : editingLabel === "source" ? t("Source-end Label")
            : editingLabel === "target" ? t("Target-end Label")
            : editingLabel === "length" ? t("Cable Length")
            : t("Midpoint Label")}
        </div>
        <input
          className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitLabel();
            else if (e.key === "Escape") {
              setEditingLabel(false);
              useSchematicStore.setState({ edgeContextMenu: null });
            }
          }}
          placeholder={
            editingLabel === "multicable" ? t("e.g. Audio Snake A")
            : editingLabel === "length" ? t("e.g. 50 ft")
            : t("e.g. Program Feed")
          }
          autoFocus
        />
        <div className="flex justify-end gap-1 mt-1.5">
          <button
            onClick={() => { setEditingLabel(false); useSchematicStore.setState({ edgeContextMenu: null }); }}
            className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={commitLabel}
            className="px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-500 cursor-pointer"
          >
            {t("Set")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-300 rounded shadow-lg py-1 min-w-[160px]"
      style={{
        left: menuPos.x,
        top: menuPos.y,
        maxHeight: menuPos.maxHeight,
        overflowY: menuPos.maxHeight ? "auto" : undefined,
        visibility: menuPos.ready ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Right-clicking inside a multi-connection selection: bulk edit first, since that's
          the action the user almost always means there. */}
      {isMultiSelection && (
        <>
          <MenuItem
            label={t("Edit Properties of {n} Connections...", { n: selectedEdgeObjs.length })}
            onClick={editSelectedProperties}
          />
          <div className="h-px bg-gray-200 my-1" />
        </>
      )}
      <MenuItem label={t("Add Handle")} onClick={addHandle} />
      {nearWaypoint && (
        <MenuItem label={t("Remove Handle")} onClick={removeHandle} />
      )}
      {hasManual && (
        <>
          <div className="h-px bg-gray-200 my-1" />
          <MenuItem label={t("Reset Route")} onClick={resetRoute} />
        </>
      )}
      <div className="h-px bg-gray-200 my-1" />
      <MenuItem label={t("Set Source-end Label...")} onClick={setSourceEndLabel} />
      <MenuItem label={t("Set Midpoint Label...")} onClick={setConnectionLabel} />
      <MenuItem label={t("Set Target-end Label...")} onClick={setTargetEndLabel} />
      {isTrunkEdge && (
        <MenuItem label={t("Set Cable Label...")} onClick={setCableLabel} />
      )}
      {!isDirectAttach && (
        <MenuItem label={t("Set Cable Length...")} onClick={setCableLength} />
      )}
      <MenuItem
        label={isCableIdHidden ? t("Show Cable ID") : t("Hide Cable ID")}
        onClick={toggleHideCableId}
      />
      <MenuItem
        label={edgeCableIdMode === "endpoint" ? t("Cable ID at Midpoint") : t("Cable ID at Endpoints")}
        onClick={toggleEdgeCableIdMode}
      />
      {hasLabelOffset && (
        <MenuItem
          label={t("Reset Label Position")}
          onClick={() => {
            useSchematicStore.getState().patchEdgeData(menu.edgeId, { labelOffset: undefined });
            useSchematicStore.setState({ edgeContextMenu: null });
          }}
        />
      )}
      <MenuItem
        label={isStubbed ? t("Show Full Connection") : t("Stub Connection")}
        onClick={toggleStubbed}
      />
      {!isDirectAttach && (
        <>
          <MenuItem
            label={isPatched ? t("Patch via Panel (Add Hop)...") : t("Patch via Panel...")}
            onClick={patchViaPanel}
          />
          {isPatched && <MenuItem label={t("Remove Patching")} onClick={removePatching} />}
        </>
      )}
      {canBundleSelection && (
        <>
          <div className="h-px bg-gray-200 my-1" />
          <MenuItem
            label={t("Bundle {n} Connections", { n: selectedEdgeObjs.length })}
            onClick={bundleSelection}
          />
        </>
      )}
      {inBundle && (
        <>
          <div className="h-px bg-gray-200 my-1" />
          <MenuItem label={t("Select Bundle Members")} onClick={selectBundleMembers} />
          <MenuItem label={t("Remove from Bundle")} onClick={removeFromBundleItem} />
          <MenuItem label={t("Dissolve Bundle")} onClick={dissolveBundleItem} />
        </>
      )}
      {(hasMismatch || allowIncompatible) && (
        <MenuItem
          label={allowIncompatible ? t("Disallow Incompatible") : t("Allow Incompatible")}
          onClick={toggleAllowIncompatible}
        />
      )}
      {connectsToAdapter && (
        <MenuItem
          label={adapterIsHidden ? t("Show Adapter") : t("Hide Adapter")}
          onClick={toggleAdapterVisibility}
        />
      )}
      {!isDirectAttach && (
        <>
          <div className="h-px bg-gray-200 my-1" />
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs text-gray-700 flex-1">{t("Cable Color")}</span>
            <input
              type="color"
              value={customColor || "#9ca3af"}
              onChange={(e) => setEdgeColor(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-5 cursor-pointer border border-gray-300 rounded p-0.5 bg-white"
              title={
                customColor
                  ? t("Override: {color}", { color: customColor })
                  : t("Pick a custom cable color")
              }
            />
            {customColor && (
              <button
                onClick={clearEdgeColor}
                className="text-[10px] text-gray-500 hover:text-red-600 underline cursor-pointer"
                title={t("Reset to signal-type color")}
              >
                {t("reset")}
              </button>
            )}
          </div>
        </>
      )}
      <div className="h-px bg-gray-200 my-1" />
      <MenuSubmenu
        label={t("Line Style: {style}", { style: t(LINE_STYLE_LABELS[currentLineStyle]) })}
        minWidth={180}
      >
        {(["solid", "dashed", "dotted", "dash-dot"] as LineStyle[]).map((ls) => (
          <button
            key={ls}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 cursor-pointer ${
              currentLineStyle === ls
                ? "text-blue-700 bg-blue-50"
                : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`}
            onClick={() => setLineStyle(ls)}
          >
            <svg width="24" height="8" className="shrink-0">
              <line
                x1="0" y1="4" x2="24" y2="4"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={LINE_STYLE_DASHARRAY[ls] ?? "none"}
              />
            </svg>
            <span>{t(LINE_STYLE_LABELS[ls])}</span>
          </button>
        ))}
      </MenuSubmenu>
      <div className="h-px bg-gray-200 my-1" />
      <MenuItem label={t("Go to Source")} onClick={() => goToNode(edge?.source)} />
      <MenuItem label={t("Go to Destination")} onClick={() => goToNode(edge?.target)} />
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
