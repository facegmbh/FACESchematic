import { describe, it, expect } from "vitest";
import { routeFixture } from "../../routingHarness/route";
import { makeDevice, makeEdge, makePort } from "../../routingHarness/fixtures";
import type { SchematicNode, ConnectionEdge } from "../../types";

/**
 * Manual routing handles used to be all-or-nothing: a single leg that A* could not
 * solve set `allFailed` and threw away the whole cable's routing in favour of
 * `orthogonalize(allPoints)` — a naive bend polyline with no obstacle awareness. A
 * handle dragged one grid step into such a spot made the entire cable jump to a line
 * through the devices, and jump back on the next step.
 *
 * Two things caused the failed legs to be so common: handles could only be entered
 * horizontally (astarOrthogonal accepts arrivalDir 0/2 unless freeEndDir is set), and
 * `reservedAtTarget` banned one of those two directions, leaving a single corridor.
 *
 * These tests pin both halves: handles route with freeEndDir, and an unroutable leg
 * degrades to that leg only ("manual-partial") instead of the whole cable.
 */

const GRID = 16;

/** Source left, target right, an obstacle device between them so A* has a choice. */
function build(handles: { x: number; y: number }[]) {
  const out = makePort("Out", "sdi", "output");
  const inp = makePort("In", "sdi", "input");
  const src = makeDevice({ id: "src", label: "Camera", x: 0, y: 240, ports: [out] });
  const tgt = makeDevice({ id: "tgt", label: "Monitor", x: 800, y: 240, ports: [inp] });
  const block = makeDevice({
    id: "block", label: "Rack", x: 380, y: 200,
    ports: [makePort("A", "sdi", "input"), makePort("B", "sdi", "output")],
  });
  const edge = makeEdge({
    id: "e1", source: "src", sourceHandle: out.id,
    target: "tgt", targetHandle: inp.id, signalType: "sdi",
  }) as ConnectionEdge;
  edge.data = { ...edge.data!, manualWaypoints: handles };
  return { nodes: [src, tgt, block] as SchematicNode[], edges: [edge] };
}

function routeFor(handles: { x: number; y: number }[]) {
  const { nodes, edges } = build(handles);
  const route = routeFixture(nodes, edges).routes["e1"];
  expect(route).toBeDefined();
  return route!;
}

/** Does the polyline pass through the handle, i.e. was the handle honoured? */
function passesThrough(wps: { x: number; y: number }[], h: { x: number; y: number }) {
  return wps.some((p) => p.x === h.x && p.y === h.y);
}

describe("manual handle routing", () => {
  it("never discards the whole cable's routing for the obstacle-blind polyline", () => {
    // Sweeping one handle across the obstacle's height used to produce a band of
    // `manual-fallback` steps. Every position must now keep real routing.
    const fellBack: number[] = [];
    for (let y = 80; y <= 460; y += GRID) {
      if (routeFor([{ x: 300, y }]).turns === "manual-fallback") fellBack.push(y);
    }
    expect(fellBack).toEqual([]);
  });

  it("keeps two-handle cables off the whole-cable fallback too", () => {
    // The y=176..288 band here was the original reproduction: turns flipped to
    // manual-fallback for seven consecutive grid steps, then back.
    const fellBack: number[] = [];
    for (let y = 80; y <= 460; y += GRID) {
      const r = routeFor([{ x: 300, y: 140 }, { x: 560, y }]);
      if (r.turns === "manual-fallback") fellBack.push(y);
    }
    expect(fellBack).toEqual([]);
  });

  it("honours every handle it was given", () => {
    for (let y = 80; y <= 460; y += GRID) {
      const handles = [{ x: 300, y: 140 }, { x: 560, y }];
      const wps = routeFor(handles).waypoints;
      for (const h of handles) {
        expect(passesThrough(wps, h), `handle (${h.x},${h.y}) missing from route`).toBe(true);
      }
    }
  });

  it("enters a handle vertically when that is the natural shape", () => {
    // (144,96) sits directly above the source's exit column, so the sane route is
    // "straight up into the handle". Without freeEndDir the arrival had to be
    // horizontal, which forced a sideways detour to come in from the left — the
    // whole family of "I only nudged it and it took a wild path" reports. Every
    // handle in this fixture was entered horizontally before the fix.
    const handle = { x: 144, y: 96 };
    const wps = routeFor([handle]).waypoints;
    const i = wps.findIndex((p) => p.x === handle.x && p.y === handle.y);
    expect(i).toBeGreaterThan(0);
    const prev = wps[i - 1];
    const vertical = Math.abs(handle.y - prev.y) > Math.abs(handle.x - prev.x);
    expect(vertical, `entered from (${prev.x},${prev.y}), expected a vertical approach`).toBe(true);
  });

  it("is deterministic — same handles, same route", () => {
    const handles = [{ x: 300, y: 140 }, { x: 560, y: 176 }];
    expect(routeFor(handles).waypoints).toEqual(routeFor(handles).waypoints);
  });
});
