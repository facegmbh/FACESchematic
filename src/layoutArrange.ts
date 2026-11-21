/**
 * FACE: arranging a room for Claude (SPEC-schaltplan-layout.md). Pure geometry, like alignUtils:
 * the bridge applies the result as one undo step.
 *
 * A room's direct children (devices, and nested rooms such as rack boxes, which move as one
 * block) go into columns by signal flow: a child feeding another stands left of it. Lines of
 * devices inside a rack box count for the box. Within a column the order follows the
 * neighbours in the column before (barycentre), which keeps lines short and crossings few.
 * Everything lands on the grid.
 */
import type { ConnectionEdge, SchematicNode } from "./types";
import { GRID_SIZE } from "./gridConstants";
import { layoutSize } from "./layoutCheck";

type Point = { x: number; y: number };

/** Left edge of the first column, and the top below the room label. */
const START_X = 32;
const START_Y = 48;
/** Room between columns for the lines, and between devices in a column. */
const COL_GAP = 96;
const ROW_GAP = 32;
/** A column of areas wraps once it would grow past this height (or past its tallest area). */
const AREA_COLUMN_MAX = 720;
/** Margin a fitted room keeps around its content; the editor's minimum room size. */
const FIT_MARGIN = 32;
const MIN_ROOM = { width: 200, height: 150 };

const snap = (v: number) => Math.ceil(v / GRID_SIZE) * GRID_SIZE;

/** FACE: a room's margin for lines (SPEC-schaltplan-leitungen.md) — stored on the room as
 *  `layoutMargin` so every later fit keeps it; the default reproduces the plain layout. */
export const DEFAULT_ROOM_MARGIN = FIT_MARGIN;
export function roomMargin(room: SchematicNode | undefined): number {
  const m = (room?.data as { layoutMargin?: number } | undefined)?.layoutMargin;
  return typeof m === "number" && m >= 0 ? m : DEFAULT_ROOM_MARGIN;
}

export function applyPositions(nodes: SchematicNode[], positions: Record<string, Point>): SchematicNode[] {
  return nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n));
}

/** New positions (relative to the room) for the room's direct children. */
export function arrangeRoom(nodes: SchematicNode[], edges: ConnectionEdge[], roomId: string): Record<string, Point> {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const children = nodes.filter((n) => n.parentId === roomId && (n.type === "device" || n.type === "room"));
  if (!children.length) return {};
  const childIds = new Set(children.map((c) => c.id));

  /** The direct child of the room that contains this node (itself, or the rack box it sits in). */
  const owner = (id: string): string | undefined => {
    let n = byId.get(id);
    while (n) {
      if (childIds.has(n.id)) return n.id;
      n = n.parentId ? byId.get(n.parentId) : undefined;
    }
    return undefined;
  };

  const succ = new Map<string, Set<string>>(children.map((c) => [c.id, new Set()]));
  const pred = new Map<string, Set<string>>(children.map((c) => [c.id, new Set()]));
  for (const e of edges) {
    const s = owner(e.source);
    const t = owner(e.target);
    if (s && t && s !== t) {
      succ.get(s)!.add(t);
      pred.get(t)!.add(s);
    }
  }

  // Break cycles: drop arcs that point back along a depth-first walk (in original reading order).
  const order = [...children].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y).map((c) => c.id);
  const state = new Map<string, "open" | "done">();
  const back = new Set<string>();
  const walk = (v: string) => {
    state.set(v, "open");
    for (const w of succ.get(v)!) {
      if (state.get(w) === "open") back.add(`${v}>${w}`);
      else if (!state.has(w)) walk(w);
    }
    state.set(v, "done");
  };
  for (const v of order) if (!state.has(v)) walk(v);

  // Longest-path layering: a child sits one column right of everything feeding it.
  const layer = new Map<string, number>();
  const layerOf = (v: string, seen = new Set<string>()): number => {
    if (layer.has(v)) return layer.get(v)!;
    seen.add(v);
    let l = 0;
    for (const u of pred.get(v)!) {
      if (back.has(`${u}>${v}`) || seen.has(u)) continue;
      l = Math.max(l, layerOf(u, seen) + 1);
    }
    layer.set(v, l);
    return l;
  };
  for (const v of order) layerOf(v);

  const columns: string[][] = [];
  for (const v of order) (columns[layer.get(v)!] ??= []).push(v);
  // Initial order: as they were from top to bottom; then sort by the neighbours on the left.
  for (const col of columns) col.sort((a, b) => byId.get(a)!.position.y - byId.get(b)!.position.y);
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let k = 1; k < columns.length; k++) {
      const rank = new Map(columns[k - 1].map((v, i) => [v, i] as const));
      const bary = (v: string) => {
        const r = [...pred.get(v)!].filter((u) => rank.has(u)).map((u) => rank.get(u)!);
        return r.length ? r.reduce((a, b) => a + b, 0) / r.length : Number.POSITIVE_INFINITY;
      };
      columns[k].sort((a, b) => bary(a) - bary(b));
    }
  }

  const positions: Record<string, Point> = {};
  const extra = roomMargin(byId.get(roomId)) - DEFAULT_ROOM_MARGIN;
  let x = START_X + extra;
  const top = START_Y + extra;
  for (const col of columns) {
    if (!col?.length) continue;
    // FACE: a column of areas or rack boxes (not wired to each other, so all in one signal-flow column)
    // wraps into the next column instead of growing into one long strip (Jean-Luc, 21.11.). Columns
    // of devices stay whole — a source feeding eight displays reads best as one column.
    const sizes = col.map((v) => layoutSize(byId.get(v)!));
    const roomsOnly = col.every((v) => byId.get(v)?.type === "room");
    const cap = roomsOnly ? Math.max(AREA_COLUMN_MAX, ...sizes.map((sz) => sz.height)) : Infinity;
    let y = top;
    let width = 0;
    col.forEach((v, i) => {
      const size = sizes[i];
      if (y > top && y + size.height > top + cap) {
        x = snap(x + width + COL_GAP);
        y = top;
        width = 0;
      }
      positions[v] = { x, y };
      y = snap(y + size.height + ROW_GAP);
      width = Math.max(width, size.width);
    });
    x = snap(x + width + COL_GAP);
  }
  return positions;
}

/** Size that encloses the room's direct children with a margin (never below the editor's minimum). */
export function fitRoomSize(nodes: SchematicNode[], roomId: string): { width: number; height: number } {
  let right = 0;
  let bottom = 0;
  for (const n of nodes) {
    if (n.parentId !== roomId) continue;
    const s = layoutSize(n);
    right = Math.max(right, n.position.x + s.width);
    bottom = Math.max(bottom, n.position.y + s.height);
  }
  const margin = roomMargin(nodes.find((n) => n.id === roomId));
  return {
    width: Math.max(MIN_ROOM.width, snap(right + margin)),
    height: Math.max(MIN_ROOM.height, snap(bottom + margin)),
  };
}

function hubInMiddle(nodes: SchematicNode[], rooms: SchematicNode[], edges: ConnectionEdge[]): SchematicNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const topOf = (id: string): string | undefined => {
    let n = byId.get(id);
    while (n?.parentId) n = byId.get(n.parentId);
    return n?.type === "room" ? n.id : undefined;
  };
  const links = new Map<string, number>(rooms.map((r) => [r.id, 0]));
  for (const e of edges) {
    const a = topOf(e.source);
    const b = topOf(e.target);
    if (a && b && a !== b) {
      if (links.has(a)) links.set(a, links.get(a)! + 1);
      if (links.has(b)) links.set(b, links.get(b)! + 1);
    }
  }
  const ranked = [...rooms].sort((a, b) => links.get(b.id)! - links.get(a.id)!);
  const sequence: SchematicNode[] = [];
  ranked.forEach((r, i) => (i % 2 === 1 ? sequence.unshift(r) : sequence.push(r)));
  return sequence;
}

/** Gap between rooms, and the width after which the next row starts. */
const ROOM_GAP = 96;
const MAX_ROW_WIDTH = 2400;

/** New positions for the top-level rooms: rows left to right, no overlap, on the grid. Rooms keep
 *  their content (nested rooms and devices move with them). Order: as given; without one, the room
 *  with the most connections to other rooms (the technical room) goes in the middle and the others
 *  around it by their number of connections, so lines between rooms stay short. */
export function arrangeRooms(
  nodes: SchematicNode[],
  order: string[] = [],
  edges: ConnectionEdge[] = [],
  gap: number = ROOM_GAP,
): Record<string, Point> {
  const tops = nodes.filter((n) => n.type === "room" && !n.parentId);
  if (!tops.length) return {};
  const reading = (a: SchematicNode, b: SchematicNode) => a.position.y - b.position.y || a.position.x - b.position.x;
  const given = order.map((id) => tops.find((t) => t.id === id)).filter((t): t is SchematicNode => !!t);
  let rest = tops.filter((t) => !given.includes(t)).sort(reading);
  if (!given.length && edges.length && rest.length > 2) rest = hubInMiddle(nodes, rest, edges);
  const x0 = Math.floor(Math.min(...tops.map((t) => t.position.x)) / GRID_SIZE) * GRID_SIZE;
  const y0 = Math.floor(Math.min(...tops.map((t) => t.position.y)) / GRID_SIZE) * GRID_SIZE;

  // FACE: locations fill columns inside a band as high as the tallest location — a short location
  // stacks under the one before it while there is height left, instead of opening a second row and
  // leaving the space beside a tall location empty (Jean-Luc, 21.11.). Reading order is kept: column
  // by column, top to bottom. A band that gets wider than a landscape sheet starts the next band.
  const sequence = [...given, ...rest];
  const bandHeight = Math.max(...sequence.map((r) => layoutSize(r).height));
  const maxWidth = Math.max(MAX_ROW_WIDTH, 2 * bandHeight);
  const positions: Record<string, Point> = {};
  let bandTop = y0;
  let bandBottom = y0;
  let colX = x0;
  let colY = y0;
  let colWidth = 0;
  for (const room of sequence) {
    const s = layoutSize(room);
    if (colWidth > 0 && snap(colY + gap) + s.height <= bandTop + bandHeight) {
      colY = snap(colY + gap);
      positions[room.id] = { x: colX, y: colY };
      colY += s.height;
      colWidth = Math.max(colWidth, s.width);
      bandBottom = Math.max(bandBottom, colY);
      continue;
    }
    let nextX = colWidth > 0 ? snap(colX + colWidth + gap) : colX;
    if (nextX > x0 && nextX - x0 + s.width > maxWidth) {
      // The next band starts under what this band really holds, not under the tallest location.
      bandTop = snap(bandBottom + gap);
      nextX = x0;
    }
    colX = nextX;
    colY = bandTop;
    positions[room.id] = { x: colX, y: colY };
    colY += s.height;
    colWidth = s.width;
    bandBottom = Math.max(bandBottom, colY);
  }
  return positions;
}
