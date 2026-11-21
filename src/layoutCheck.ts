/**
 * FACE: layout check for Claude (SPEC-schaltplan-layout.md). Pure geometry — what overlaps, what
 * sticks out of its room, which lines run through devices, cross each other or take a detour —
 * so an assistant that only gets numbers back can still tell a clean drawing from a messy one.
 *
 * Input is what the editor already has: nodes (with `measured` sizes), edges and the routed lines
 * (`routedEdges` in the store, or `routeFixture` in tests). Changes nothing.
 */
import type { ConnectionEdge, SchematicNode } from "./types";
import { extractSegments, segmentsCross } from "./edgeRouter";
import { GRID_SIZE } from "./gridConstants";

export type LayoutFindingKind =
  | "overlap"
  | "outside"
  | "room_overlap"
  | "off_grid"
  | "crosses_device"
  | "crossings"
  | "detour"
  | "unrouted";

export interface LayoutFinding {
  kind: LayoutFindingKind;
  ids: string[];
  message: string;
}

type Point = { x: number; y: number };
type Routes = Record<string, { waypoints: Point[] } | undefined>;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Overlaps smaller than this are rounding, not a problem. */
const TOLERANCE = 2;
/** A detour is a line more than this many times its shortest (orthogonal) way… */
const DETOUR_RATIO = 2;
/** …and at least this much longer — short jogs around a neighbour are fine. */
const DETOUR_MIN_EXTRA = 200;

function size(n: SchematicNode): { width: number; height: number } {
  const isRoom = n.type === "room";
  const style = (n.style ?? {}) as { width?: number; height?: number };
  return {
    width: n.measured?.width ?? style.width ?? (n.width as number | undefined) ?? (isRoom ? 400 : 144),
    height: n.measured?.height ?? style.height ?? (n.height as number | undefined) ?? (isRoom ? 300 : 48),
  };
}

function absolute(n: SchematicNode, byId: Map<string, SchematicNode>): Point {
  let { x, y } = n.position;
  let parentId = n.parentId;
  while (parentId) {
    const p = byId.get(parentId);
    if (!p) break;
    x += p.position.x;
    y += p.position.y;
    parentId = p.parentId;
  }
  return { x, y };
}

function rectOf(n: SchematicNode, byId: Map<string, SchematicNode>): Rect {
  const p = absolute(n, byId);
  const s = size(n);
  return { left: p.x, top: p.y, right: p.x + s.width, bottom: p.y + s.height };
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > TOLERANCE &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TOLERANCE
  );
}

function sticksOut(child: Rect, parent: Rect): boolean {
  return (
    child.left < parent.left - TOLERANCE ||
    child.top < parent.top - TOLERANCE ||
    child.right > parent.right + TOLERANCE ||
    child.bottom > parent.bottom + TOLERANCE
  );
}

function isAncestor(ancestorId: string, n: SchematicNode, byId: Map<string, SchematicNode>): boolean {
  let parentId = n.parentId;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = byId.get(parentId)?.parentId;
  }
  return false;
}

function label(n: SchematicNode | undefined): string {
  return String((n?.data as { label?: string } | undefined)?.label ?? n?.id ?? "?");
}

/** Does an axis-aligned segment pass through the inside of a rect (not just touch its edge)? */
function segmentEnters(a: Point, b: Point, r: Rect): boolean {
  const inset = { left: r.left + TOLERANCE, top: r.top + TOLERANCE, right: r.right - TOLERANCE, bottom: r.bottom - TOLERANCE };
  if (a.y === b.y) {
    const [x1, x2] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
    return a.y > inset.top && a.y < inset.bottom && x2 > inset.left && x1 < inset.right;
  }
  if (a.x === b.x) {
    const [y1, y2] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
    return a.x > inset.left && a.x < inset.right && y2 > inset.top && y1 < inset.bottom;
  }
  // Diagonal (shouldn't happen with orthogonal routing): test its bounding box.
  return intersects({ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) }, inset);
}

function length(wps: Point[]): number {
  let sum = 0;
  for (let i = 1; i < wps.length; i++) sum += Math.abs(wps[i].x - wps[i - 1].x) + Math.abs(wps[i].y - wps[i - 1].y);
  return sum;
}

export function checkLayout(
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  routes: Routes,
  opts: { roomId?: string } = {},
): LayoutFinding[] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const inScope = (n: SchematicNode | undefined) =>
    !!n && (!opts.roomId || n.id === opts.roomId || isAncestor(opts.roomId, n, byId));
  const devices = nodes.filter((n) => n.type === "device");
  const rooms = nodes.filter((n) => n.type === "room");
  const rects = new Map(nodes.filter((n) => n.type === "device" || n.type === "room").map((n) => [n.id, rectOf(n, byId)] as const));
  const findings: LayoutFinding[] = [];

  // Devices on top of each other.
  for (let i = 0; i < devices.length; i++) {
    for (let j = i + 1; j < devices.length; j++) {
      const a = devices[i];
      const b = devices[j];
      if (!(inScope(a) || inScope(b))) continue;
      if (intersects(rects.get(a.id)!, rects.get(b.id)!)) {
        findings.push({
          kind: "overlap",
          ids: [a.id, b.id],
          message: `"${label(a)}" and "${label(b)}" lie on top of each other — move one (or arrange_room).`,
        });
      }
    }
  }

  // Devices and rooms sticking out of the room they belong to.
  for (const n of [...devices, ...rooms]) {
    if (!n.parentId || !inScope(n)) continue;
    const parent = byId.get(n.parentId);
    if (!parent || parent.type !== "room") continue;
    if (sticksOut(rects.get(n.id)!, rects.get(parent.id)!)) {
      findings.push({
        kind: "outside",
        ids: [n.id, parent.id],
        message: `"${label(n)}" sticks out of "${label(parent)}" — enlarge the room (fit_room) or move it inside.`,
      });
    }
  }

  // Rooms overlapping each other (a room inside its parent is fine).
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      if (!(inScope(a) || inScope(b))) continue;
      if (isAncestor(a.id, b, byId) || isAncestor(b.id, a, byId)) continue;
      if (intersects(rects.get(a.id)!, rects.get(b.id)!)) {
        findings.push({
          kind: "room_overlap",
          ids: [a.id, b.id],
          message: `Rooms "${label(a)}" and "${label(b)}" overlap — move one (or arrange_rooms).`,
        });
      }
    }
  }

  // Devices off the grid (one finding for all).
  const offGrid = devices.filter((d) => {
    if (!inScope(d)) return false;
    const p = absolute(d, byId);
    return p.x % GRID_SIZE !== 0 || p.y % GRID_SIZE !== 0;
  });
  if (offGrid.length) {
    findings.push({
      kind: "off_grid",
      ids: offGrid.map((d) => d.id),
      message: `${offGrid.length} device(s) are off the ${GRID_SIZE} px grid, so lines cannot run straight into them — arrange_room snaps them.`,
    });
  }

  // Lines. Only judged when they have been routed.
  const scopedEdges = edges.filter((e) => inScope(byId.get(e.source)) || inScope(byId.get(e.target)));
  const routed = scopedEdges.filter((e) => (routes[e.id]?.waypoints.length ?? 0) >= 2);
  const unrouted = scopedEdges.filter((e) => (routes[e.id]?.waypoints.length ?? 0) < 2);
  if (unrouted.length) {
    findings.push({
      kind: "unrouted",
      ids: unrouted.map((e) => e.id),
      message: `${unrouted.length} connection(s) have no routed line yet, so lines were not judged — route_connections first.`,
    });
  }

  for (const e of routed) {
    const wps = routes[e.id]!.waypoints;
    const through = devices.filter(
      (d) => d.id !== e.source && d.id !== e.target && wps.slice(1).some((p, k) => segmentEnters(wps[k], p, rects.get(d.id)!)),
    );
    if (through.length) {
      findings.push({
        kind: "crosses_device",
        ids: [e.id, ...through.map((d) => d.id)],
        message: `The line ${label(byId.get(e.source))} → ${label(byId.get(e.target))} runs through ${through.map((d) => `"${label(d)}"`).join(", ")} — re-route it or move the device.`,
      });
    }
    const shortest = Math.abs(wps[wps.length - 1].x - wps[0].x) + Math.abs(wps[wps.length - 1].y - wps[0].y);
    const actual = length(wps);
    if (actual > DETOUR_RATIO * shortest && actual - shortest > DETOUR_MIN_EXTRA) {
      findings.push({
        kind: "detour",
        ids: [e.id],
        message: `The line ${label(byId.get(e.source))} → ${label(byId.get(e.target))} is ${Math.round(actual)} px long for ${Math.round(shortest)} px of distance — bring the devices closer or re-route.`,
      });
    }
  }

  // Crossings between lines (one finding naming every line involved).
  const segs = routed.map((e) => ({ id: e.id, segs: extractSegments(routes[e.id]!.waypoints) }));
  const involved = new Set<string>();
  let pairs = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segs[i].segs.some((a) => segs[j].segs.some((b) => segmentsCross(a, b)))) {
        pairs++;
        involved.add(segs[i].id);
        involved.add(segs[j].id);
      }
    }
  }
  if (pairs) {
    findings.push({
      kind: "crossings",
      ids: [...involved],
      message: `${pairs} pair(s) of lines cross. A few are normal; many mean devices sit in the wrong order — arrange_room sorts by signal flow.`,
    });
  }

  return findings;
}
