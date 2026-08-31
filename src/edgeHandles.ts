/**
 * Manual routing handles ("Add Handle").
 *
 * Placing a handle is a geometry problem: project the click onto the path that is
 * actually drawn, keep orthogonal segments orthogonal so the cable doesn't jump when
 * the handle appears, and insert into `manualWaypoints` at the position matching where
 * along the path the user clicked. Two entry points share it — the edge context menu
 * and double-click on the edge — so it lives here as a pure function over
 * (edge, route, click) instead of inside either caller.
 */

import type { ConnectionEdge, SchematicNode } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** Project a point onto the nearest segment and return the projected point. */
export function projectOntoSegments(
  px: number,
  py: number,
  waypoints: Point[],
): { x: number; y: number; segIdx: number } {
  let bestX = px;
  let bestY = py;
  let bestDist = Infinity;
  let bestSeg = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const ax = waypoints[i].x, ay = waypoints[i].y;
    const bx = waypoints[i + 1].x, by = waypoints[i + 1].y;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dist = (px - cx) ** 2 + (py - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestX = cx;
      bestY = cy;
      bestSeg = i;
    }
  }

  return { x: bestX, y: bestY, segIdx: bestSeg };
}

/** Where a new handle should be written, with the full replacement waypoint list. */
export type HandleInsertion =
  | { kind: "stub"; field: "stubSourceWaypoints" | "stubTargetWaypoints"; waypoints: Point[] }
  | { kind: "manual"; waypoints: Point[] };

/**
 * Work out the waypoint list that adds one handle at `click`, or null if the edge has
 * no drawn route to project onto yet.
 */
export function computeHandleInsertion(
  edge: ConnectionEdge,
  route: { waypoints: Point[] } | undefined,
  click: Point,
  grid: number,
  nodes: SchematicNode[],
): HandleInsertion | null {
  const snapped = {
    x: Math.round(click.x / grid) * grid,
    y: Math.round(click.y / grid) * grid,
  };

  // For stubbed edges, add the waypoint to the closer stub (source or target)
  if (edge.data?.stubbed) {
    const srcX = nodes.find((n) => n.id === edge.source)?.position.x ?? 0;
    const tgtX = nodes.find((n) => n.id === edge.target)?.position.x ?? 0;
    const field =
      Math.abs(click.x - srcX) <= Math.abs(click.x - tgtX)
        ? "stubSourceWaypoints"
        : "stubTargetWaypoints";
    const existing =
      (field === "stubSourceWaypoints"
        ? edge.data.stubSourceWaypoints
        : edge.data.stubTargetWaypoints) ?? [];
    return { kind: "stub", field, waypoints: [...existing, snapped] };
  }

  // Existing manual waypoints (just user-placed handles, not auto-route copies)
  const manualWps: Point[] = edge.data?.manualWaypoints?.map((p) => ({ ...p })) ?? [];

  if (!route || route.waypoints.length < 2) return null;

  // Project click position onto nearest segment of the current path
  const projected = projectOntoSegments(click.x, click.y, route.waypoints);

  // For orthogonal segments, lock the fixed axis and snap only the free axis.
  const segStart = route.waypoints[projected.segIdx];
  const segEnd = route.waypoints[projected.segIdx + 1];
  let newPt: Point;
  if (segStart && segEnd && Math.abs(segStart.y - segEnd.y) < 1) {
    newPt = { x: Math.round(projected.x / grid) * grid, y: segStart.y };
  } else if (segStart && segEnd && Math.abs(segStart.x - segEnd.x) < 1) {
    newPt = { x: segStart.x, y: Math.round(projected.y / grid) * grid };
  } else {
    newPt = {
      x: Math.round(projected.x / grid) * grid,
      y: Math.round(projected.y / grid) * grid,
    };
  }

  if (manualWps.length === 0) {
    manualWps.push(newPt);
  } else {
    // Find the correct insertion position by comparing the new point's position along
    // the routed path to each existing manual waypoint's position. projected.segIdx
    // indexes the routed path (many A* segments), NOT the manual waypoints array —
    // we need to map between the two.
    const manualSegIdxes = manualWps.map((wp) =>
      projectOntoSegments(wp.x, wp.y, route.waypoints).segIdx,
    );
    let insertIdx = manualWps.length; // default: after all existing
    for (let i = 0; i < manualSegIdxes.length; i++) {
      if (projected.segIdx <= manualSegIdxes[i]) {
        insertIdx = i;
        break;
      }
    }
    manualWps.splice(insertIdx, 0, newPt);
  }

  return { kind: "manual", waypoints: manualWps };
}
