import type {
  SchematicNode,
  ConnectionEdge,
  DeviceData,
  Port,
  ConnectorType,
  SignalType,
  SchematicPage,
} from "./types";
import { DEFAULT_SIGNAL_COLORS } from "./signalColors";
import { effectiveSignalType, resolvePortGender } from "./connectorTypes";
import {
  computeCableSchedule,
  type CableScheduleRow,
  type CableScheduleDistanceContext,
} from "./cableSchedule";
import { inferRackHeightU } from "./rackUtils";
import { transformLabelNow } from "./labelCaseUtils";
import { getRoomLabel, resolvePortLabel } from "./packList";

/**
 * Cabinet / network rack plan.
 *
 * Enumerates every rack elevation in the schematic and, per rack, every racked
 * device in rack-unit order — a realistic "as it sits in the cabinet" front
 * view. Devices with front jacks (patch panels, network switches, …) expose
 * their ports as a single row so the drawing layer can render them like real
 * 19" hardware, with per-port destination + cable-ID labels.
 */

const EMPTY = "—";

export interface RackPlanPort {
  portId: string;
  /** Port number / label, e.g. "12". */
  position: string;
  connectorType?: ConnectorType;
  signalType: SignalType;
  /** Resolved hex signal color (never a CSS var — usable in PDF). */
  color: string;
  /** "M" | "F" | "—" */
  gender: string;
  connected: boolean;
  remoteDevice: string;
  remoteRoom: string;
  remotePort: string;
  cableId: string;
}

export interface RackPlanDevice {
  nodeId: string;
  label: string;
  deviceType: string;
  uPosition: number;
  heightU: number;
  /** Faceplate color. */
  color: string;
  /** Front jacks in physical order (empty for devices without signal ports). */
  ports: RackPlanPort[];
  connectedCount: number;
}

export interface RackPlanRack {
  rackId: string;
  label: string;
  room: string;
  heightU: number;
  /** Devices top-first (descending U position), as read top-down in the cabinet. */
  devices: RackPlanDevice[];
}

const isPowerSignal = (s: string) => s.startsWith("power");

function handleMatchesPort(handle: string | null | undefined, portId: string): boolean {
  return handle === portId || !!handle?.startsWith(`${portId}-`);
}

function resolvePortConnection(
  nodeId: string,
  port: Port,
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  cableByEdge: Map<string, CableScheduleRow>,
): Pick<RackPlanPort, "connected" | "remoteDevice" | "remoteRoom" | "remotePort" | "cableId"> {
  // Prefer a front-face edge for passthrough ports; otherwise the first match.
  const candidates = edges.filter(
    (e) =>
      !e.data?.directAttach &&
      ((e.source === nodeId && handleMatchesPort(e.sourceHandle, port.id)) ||
        (e.target === nodeId && handleMatchesPort(e.targetHandle, port.id))),
  );
  const edge =
    candidates.find(
      (e) =>
        (e.source === nodeId && e.sourceHandle?.endsWith("-front")) ||
        (e.target === nodeId && e.targetHandle?.endsWith("-front")),
    ) ?? candidates[0];

  if (!edge) {
    return { connected: false, remoteDevice: "", remoteRoom: "", remotePort: "", cableId: "" };
  }
  const isSource = edge.source === nodeId;
  const remoteNodeId = isSource ? edge.target : edge.source;
  const remoteHandle = isSource ? edge.targetHandle : edge.sourceHandle;
  const remoteNode = nodes.find((n) => n.id === remoteNodeId);
  const remoteDevice =
    remoteNode?.type === "device"
      ? transformLabelNow((remoteNode.data as DeviceData).label || "Unnamed")
      : remoteNode
        ? "Unknown"
        : "";
  const remotePort = remoteNode ? resolvePortLabel(remoteNode, remoteHandle) : "";
  const remoteRoom = remoteNode ? getRoomLabel(nodes, remoteNode.parentId) : "";
  const cableId = cableByEdge.get(edge.id)?.cableId ?? "";
  return { connected: true, remoteDevice, remoteRoom, remotePort, cableId };
}

/** Build the front-jack row for a device (excludes power ports). */
function buildPorts(
  node: SchematicNode,
  data: DeviceData,
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  cableByEdge: Map<string, CableScheduleRow>,
): RackPlanPort[] {
  const hidden = new Set(data.hiddenPorts ?? []);
  const ports: RackPlanPort[] = [];
  data.ports.forEach((port, idx) => {
    if (hidden.has(port.id)) return;
    if (isPowerSignal(port.signalType)) return;
    const sig = effectiveSignalType(port, node.id, edges);
    const g = resolvePortGender(port);
    const conn = resolvePortConnection(node.id, port, nodes, edges, cableByEdge);
    ports.push({
      portId: port.id,
      position: transformLabelNow(port.label || `${idx + 1}`),
      connectorType: port.connectorType,
      signalType: sig,
      color: DEFAULT_SIGNAL_COLORS[sig] ?? DEFAULT_SIGNAL_COLORS.custom,
      gender: g === "male" ? "M" : g === "female" ? "F" : EMPTY,
      ...conn,
    });
  });
  return ports;
}

/** Build a per-rack cabinet plan for every rack elevation in the schematic. */
export function computeRackPlan(
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  pages: SchematicPage[],
  namingScheme: "sequential" | "type-prefix" = "sequential",
  distanceContext?: CableScheduleDistanceContext,
): RackPlanRack[] {
  const cableRows = computeCableSchedule(nodes, edges, namingScheme, distanceContext);
  const cableByEdge = new Map(cableRows.map((r) => [r.edgeId, r]));

  const deviceDataMap = new Map<string, DeviceData>();
  for (const n of nodes) {
    if (n.type === "device") deviceDataMap.set(n.id, n.data as DeviceData);
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const racks: RackPlanRack[] = [];

  for (const page of pages) {
    if (page.type !== "rack-elevation") continue;
    for (const rack of page.racks) {
      const placements = page.placements
        .filter((p) => p.rackId === rack.id && !p.mountedOnShelfId)
        .sort((a, b) => b.uPosition - a.uPosition); // top-first

      const devices: RackPlanDevice[] = [];
      for (const pl of placements) {
        const node = nodeById.get(pl.deviceNodeId);
        const data = deviceDataMap.get(pl.deviceNodeId);
        if (!node || !data) continue;
        const ports = buildPorts(node, data, nodes, edges, cableByEdge);
        devices.push({
          nodeId: pl.deviceNodeId,
          label: transformLabelNow(data.label || "Unnamed"),
          deviceType: data.deviceType ?? "generic",
          uPosition: pl.uPosition,
          heightU: inferRackHeightU(data),
          color: data.headerColor ?? data.color ?? "#4a90d9",
          ports,
          connectedCount: ports.filter((p) => p.connected).length,
        });
      }

      if (devices.length === 0) continue;

      const linkedRoom = rack.linkedRoomId
        ? getRoomLabel(nodes, rack.linkedRoomId)
        : "";
      racks.push({
        rackId: rack.id,
        label: transformLabelNow(rack.label || "Rack"),
        room: linkedRoom,
        heightU: rack.heightU,
        devices,
      });
    }
  }

  racks.sort((a, b) => a.label.localeCompare(b.label) || a.rackId.localeCompare(b.rackId));
  return racks;
}

/** Distinct signal types present, for a legend. */
export function collectRackPlanSignals(racks: RackPlanRack[]): { signalType: SignalType; color: string }[] {
  const seen = new Map<SignalType, string>();
  for (const rack of racks) {
    for (const dev of rack.devices) {
      for (const p of dev.ports) {
        if (p.signalType && !seen.has(p.signalType)) seen.set(p.signalType, p.color);
      }
    }
  }
  return Array.from(seen.entries()).map(([signalType, color]) => ({ signalType, color }));
}
