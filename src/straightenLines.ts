/**
 * FACE: straighten lines by moving devices a little (SPEC-schaltplan-rahmen.md). Jean-Luc, 22.11.:
 * "Geräte könnten leicht verschoben werden damit die Linien sauberer laufen."
 *
 * Two ports facing each other a row or two apart give a line with a jog in the middle. Moving one of
 * the two devices up or down by exactly that much makes it one straight line. The device with fewer
 * connections moves (a camera to its encoder, not the switch to the camera), only by whole grid
 * steps up to `maxShift`, never onto another device or room, never out of its own room, and never
 * when that would bend a line that is straight already. A rack box counts as a room like any
 * other — its picture is free, the heights in U live on the rack page. Devices in a locked room
 * stay where they are; lines the user laid by hand are left alone.
 */
import type { ConnectionEdge, RoomData, SchematicNode } from "./types";
import { layoutSize } from "./layoutCheck";
import { GRID_SIZE } from "./gridConstants";

type Point = { x: number; y: number };
type Routes = Record<string, { waypoints: Point[] } | undefined>;
interface Rect { left: number; top: number; right: number; bottom: number }

export interface StraightenMove {
  /** The device moved. */
  id: string;
  /** How far, in px — positive is down. */
  dy: number;
  /** The connections that now run straight. */
  straightens: string[];
}

/** Default and limits for how far a device may move. */
export const STRAIGHTEN_MAX_SHIFT = 64;
/** Room for a room's name above its first device. */
const ROOM_LABEL_SPACE = 40;
/** Free space kept to other devices and to the room's frame. */
const CLEARANCE = GRID_SIZE;

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

function ancestors(n: SchematicNode, byId: Map<string, SchematicNode>): SchematicNode[] {
  const out: SchematicNode[] = [];
  let parent = n.parentId ? byId.get(n.parentId) : undefined;
  while (parent) {
    out.push(parent);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return out;
}

const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;

export function straightenLines(
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  routes: Routes,
  opts: { maxShift?: number; roomId?: string } = {},
): StraightenMove[] {
  const maxShift = opts.maxShift ?? STRAIGHTEN_MAX_SHIFT;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const rectOf = (n: SchematicNode): Rect => {
    const p = absolute(n, byId);
    const s = layoutSize(n);
    return { left: p.x, top: p.y, right: p.x + s.width, bottom: p.y + s.height };
  };
  const rects = new Map(nodes.filter((n) => n.type === "device" || n.type === "room").map((n) => [n.id, rectOf(n)] as const));
  const offset = new Map<string, number>(); // dy already given to a device

  const movable = (n: SchematicNode): boolean => {
    if (n.type !== "device") return false;
    const up = ancestors(n, byId);
    if (up.some((r) => r.type === "room" && (r.data as RoomData).locked)) return false;
    return !opts.roomId || up.some((r) => r.id === opts.roomId);
  };

  // Lines whose two ports face each other across open space: these can run straight.
  type Line = { id: string; source: string; target: string; sy: number; ty: number };
  const lines: Line[] = [];
  for (const e of edges) {
    if ((e.data?.manualWaypoints?.length ?? 0) > 0 && !e.data?.autoRouteWaypoints) continue;
    const wps = routes[e.id]?.waypoints;
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!wps || wps.length < 2 || src?.type !== "device" || tgt?.type !== "device") continue;
    const s = wps[0];
    const t = wps[wps.length - 1];
    const sr = rects.get(src.id)!;
    const tr = rects.get(tgt.id)!;
    const sRight = s.x >= (sr.left + sr.right) / 2;
    const tRight = t.x >= (tr.left + tr.right) / 2;
    const facing = (sRight && !tRight && t.x > s.x) || (!sRight && tRight && t.x < s.x);
    if (facing) lines.push({ id: e.id, source: e.source, target: e.target, sy: s.y, ty: t.y });
  }
  const yAt = (l: Line, end: "source" | "target") =>
    (end === "source" ? l.sy : l.ty) + (offset.get(end === "source" ? l.source : l.target) ?? 0);

  const degree = new Map<string, number>();
  for (const e of edges) for (const id of [e.source, e.target]) degree.set(id, (degree.get(id) ?? 0) + 1);
  const devices = nodes
    .filter((n) => n.type === "device" && movable(n))
    .sort((a, b) => (degree.get(a.id) ?? 0) - (degree.get(b.id) ?? 0) || a.id.localeCompare(b.id));

  const fits = (n: SchematicNode, dy: number): boolean => {
    const r = rects.get(n.id)!;
    const moved = { ...r, top: r.top + dy, bottom: r.bottom + dy };
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent?.type === "room") {
      const pr = rects.get(parent.id)!;
      if (moved.top < pr.top + Math.min(ROOM_LABEL_SPACE, r.top - pr.top)) return false;
      if (moved.bottom > pr.bottom - Math.min(CLEARANCE, pr.bottom - r.bottom)) return false;
    }
    const mine = new Set(ancestors(n, byId).map((a) => a.id));
    for (const [id, other] of rects) {
      if (id === n.id || mine.has(id)) continue;
      const o = byId.get(id)!;
      const shifted = { ...other, top: other.top + (offset.get(id) ?? 0), bottom: other.bottom + (offset.get(id) ?? 0) };
      // A room is only in the way if it is not one of ours and we would newly reach into it.
      if (o.type === "room" && overlaps(r, shifted, 0)) continue;
      if (overlaps(moved, shifted, o.type === "device" ? CLEARANCE - 1 : 0)) return false;
    }
    return true;
  };

  const moves: StraightenMove[] = [];
  for (const d of devices) {
    const mine = lines
      .filter((l) => l.source === d.id || l.target === d.id)
      .map((l) => {
        const end = l.source === d.id ? "source" : "target";
        return { l, my: yAt(l, end), other: yAt(l, end === "source" ? "target" : "source") };
      });
    const deltas = [...new Set(mine.map((m) => m.other - m.my))].filter(
      (dy) => dy !== 0 && Math.abs(dy) <= maxShift && dy % GRID_SIZE === 0,
    );
    let best: { dy: number; straightens: string[]; score: number } | undefined;
    for (const dy of deltas) {
      const straightens = mine.filter((m) => m.my + dy === m.other).map((m) => m.l.id);
      const breaks = mine.filter((m) => m.my === m.other).length;
      const score = straightens.length - breaks;
      if (score <= 0 || !fits(d, dy)) continue;
      if (!best || score > best.score || (score === best.score && Math.abs(dy) < Math.abs(best.dy))) best = { dy, straightens, score };
    }
    if (!best) continue;
    offset.set(d.id, best.dy);
    moves.push({ id: d.id, dy: best.dy, straightens: best.straightens });
  }
  return moves;
}
