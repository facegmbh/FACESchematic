/**
 * FACE: which side a two-sided port should use (choose_port_sides, SPEC-schaltplan-leitungen.md).
 *
 * A bidirectional port (network, serial …) renders a handle on the left (`<port>-in`) and on the
 * right (`<port>-out`). Which one a connection uses is a drawing choice, not a signal one — so the
 * line can leave on the side facing the device it goes to instead of looping round. Pass-through
 * ports (`-rear`/`-front`) mean something physical and are never touched; neither are one-sided
 * ports, stub tags, or lines the user laid by hand (unless named).
 */
import type { ConnectionEdge, DeviceData, SchematicNode } from "./types";
import { portSide } from "./types";
import { layoutSize } from "./layoutCheck";

export interface PortSideChange {
  id: string;
  sourceHandle: string;
  targetHandle: string;
}

type Side = "left" | "right";
const TWO_SIDED = /^(.*)-(in|out)$/;

function absoluteX(n: SchematicNode, byId: Map<string, SchematicNode>): number {
  let x = n.position.x;
  let parent = n.parentId ? byId.get(n.parentId) : undefined;
  while (parent) {
    x += parent.position.x;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return x;
}

/** The port behind a handle and whether that handle is one of a two-sided pair. */
function handleInfo(node: SchematicNode, handle: string): { twoSided: boolean; base: string; side: Side } | null {
  const ports = (node.data as DeviceData).ports ?? [];
  const m = TWO_SIDED.exec(handle);
  if (m && ports.some((p) => p.id === m[1] && p.direction === "bidirectional")) {
    return { twoSided: true, base: m[1], side: m[2] === "out" ? "right" : "left" };
  }
  const port = ports.find((p) => p.id === handle);
  return port ? { twoSided: false, base: handle, side: portSide(port) } : null;
}

const handleFor = (base: string, side: Side) => `${base}-${side === "right" ? "out" : "in"}`;

/**
 * For each device↔device connection with at least one two-sided end, the handles that face each
 * other. Returns only connections that change. `connectionIds` limits the work and is the only way
 * to include a connection with the user's own waypoints.
 */
export function choosePortSides(
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  connectionIds?: string[],
): PortSideChange[] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const named = connectionIds ? new Set(connectionIds) : undefined;
  const changes: PortSideChange[] = [];

  for (const e of edges) {
    if (named && !named.has(e.id)) continue;
    const own = (e.data?.manualWaypoints?.length ?? 0) > 0 && !e.data?.autoRouteWaypoints;
    if (own && !named?.has(e.id)) continue;
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (src?.type !== "device" || tgt?.type !== "device" || !e.sourceHandle || !e.targetHandle) continue;
    const s = handleInfo(src, e.sourceHandle);
    const t = handleInfo(tgt, e.targetHandle);
    if (!s || !t || (!s.twoSided && !t.twoSided)) continue;

    const sLeft = absoluteX(src, byId);
    const tLeft = absoluteX(tgt, byId);
    const sRight = sLeft + layoutSize(src).width;
    const tRight = tLeft + layoutSize(tgt).width;
    let sSide: Side;
    let tSide: Side;
    if (tLeft >= sRight) {
      [sSide, tSide] = ["right", "left"];
    } else if (tRight <= sLeft) {
      [sSide, tSide] = ["left", "right"];
    } else {
      // On top of each other (a rack): meet on one side instead of a Z through both devices.
      const shared = !s.twoSided ? s.side : !t.twoSided ? t.side : s.side === t.side ? s.side : "left";
      [sSide, tSide] = [shared, shared];
    }
    const sourceHandle = s.twoSided ? handleFor(s.base, sSide) : e.sourceHandle;
    const targetHandle = t.twoSided ? handleFor(t.base, tSide) : e.targetHandle;
    if (sourceHandle !== e.sourceHandle || targetHandle !== e.targetHandle) {
      changes.push({ id: e.id, sourceHandle, targetHandle });
    }
  }
  return changes;
}
