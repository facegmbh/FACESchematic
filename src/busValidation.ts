import type { ConnectionEdge, DeviceData, SchematicNode } from "./types";

/**
 * KNX / DALI bus validation.
 *
 * A "bus segment" is a connected component formed by edges whose signal type is "knx"
 * (resp. "dali"). The canonical engineering rule for both is a maximum of 64 bus devices
 * per line segment (KNX TP line without a repeater; DALI/DALI-2 control gear per line).
 * We surface a warning when a segment exceeds that count.
 *
 * Bus current/mA-budget validation is intentionally out of scope here — it would require
 * per-device bus-current data that the templates don't carry yet.
 */
export type BusType = "knx" | "dali";

export const BUS_DEVICE_LIMIT = 64;

export interface BusSegment {
  busType: BusType;
  /** 1-based segment number per bus type, for display. */
  index: number;
  deviceCount: number;
  devices: { id: string; label: string }[];
  overLimit: boolean;
}

function segmentsForSignal(
  busType: BusType,
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
): BusSegment[] {
  // Build an undirected adjacency map from edges of this bus type only.
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  let hasAny = false;
  for (const e of edges) {
    if (e.data?.signalType !== busType) continue;
    hasAny = true;
    link(e.source, e.target);
    link(e.target, e.source);
  }
  if (!hasAny) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const segments: BusSegment[] = [];
  let index = 0;

  for (const start of adj.keys()) {
    if (visited.has(start)) continue;
    // BFS over the connected component.
    const queue = [start];
    const componentIds: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      componentIds.push(id);
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) queue.push(nb);
      }
    }

    // Count only real device nodes (skip waypoints/stub labels etc.).
    const devices = componentIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is SchematicNode => !!n && n.type === "device")
      .map((n) => ({ id: n.id, label: (n.data as DeviceData).label }));

    if (devices.length === 0) continue;
    index += 1;
    segments.push({
      busType,
      index,
      deviceCount: devices.length,
      devices,
      overLimit: devices.length > BUS_DEVICE_LIMIT,
    });
  }

  return segments;
}

/** All KNX and DALI bus segments in the schematic, KNX first. */
export function computeBusSegments(
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
): BusSegment[] {
  return [
    ...segmentsForSignal("knx", nodes, edges),
    ...segmentsForSignal("dali", nodes, edges),
  ];
}
