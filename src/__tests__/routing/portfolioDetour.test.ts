/**
 * FACE: the portfolio must not trade a detour check_layout reports for a few crossings. In
 * Jean-Luc's Kapelle (22.11.) the access point's line to the ESP, given back to the router, turns
 * between the two devices — and crosses the access point's and charging station's lines down to
 * the switch. A candidate that dodged those crossings by sending both lines round the ceiling won
 * by 0.7 points and left two `detour` findings.
 */
import { describe, it, expect, afterEach } from "vitest";
import { routeFixture } from "../../routingHarness/route";
import { ROUTING_CANDIDATES, pickBest } from "../../routing/portfolio";
import { scoreRoutes, computeRoutingMetrics } from "../../routing/scoreRoutes";
import { checkLayout } from "../../layoutCheck";
import type { ConnectionEdge, SchematicNode } from "../../types";
import jl from "../fixtures/layout/kapelle-jl-2026-11-22.json";

/** The five lines Claude laid by hand in Jean-Luc's drawing, given back to the router. */
const HAND = ["edge-39", "edge-40", "edge-41", "edge-48", "edge-66"];
const g = globalThis as Record<string, unknown>;
afterEach(() => { delete g.__routingParams; });

describe("portfolio and detours", () => {
  it("counts the lines check_layout calls a detour", () => {
    const a = { id: "a", type: "device", position: { x: 0, y: 0 }, measured: { width: 160, height: 96 }, data: {} };
    const b = { id: "b", type: "device", position: { x: 400, y: 0 }, measured: { width: 160, height: 96 }, data: {} };
    const nodes = [a, b] as unknown as SchematicNode[];
    const edges = [{ id: "e", source: "a", target: "b" }] as unknown as ConnectionEdge[];
    const straight = { e: { waypoints: [{ x: 160, y: 48 }, { x: 400, y: 48 }] } };
    const round = { e: { waypoints: [{ x: 160, y: 48 }, { x: 200, y: 48 }, { x: 200, y: 400 }, { x: 360, y: 400 }, { x: 360, y: 48 }, { x: 400, y: 48 }] } };
    expect(computeRoutingMetrics(nodes, edges, straight).metrics.detourLines).toBe(0);
    expect(computeRoutingMetrics(nodes, edges, round).metrics.detourLines).toBe(1);
  });

  it("Jean-Luc's Kapelle, hand-laid lines given back: the best candidate leaves no detour", () => {
    const nodes = jl.nodes as unknown as SchematicNode[];
    const edges = (jl.edges as unknown as ConnectionEdge[]).map((e) =>
      HAND.includes(e.id) ? ({ ...e, data: { ...e.data, manualWaypoints: undefined } } as ConnectionEdge) : e,
    );
    const runs = ROUTING_CANDIDATES.map((c) => {
      g.__routingParams = c.params;
      const { routes } = routeFixture(nodes, edges);
      return { label: c.label, score: scoreRoutes(nodes, edges, routes), routes };
    });
    const best = runs.find((r) => r.label === pickBest(runs)!.label)!;
    const detours = checkLayout(nodes, edges, best.routes).filter((f) => f.kind === "detour");
    expect(detours.map((f) => `${best.label}: ${f.message}`)).toEqual([]);
  }, 30_000); // ten full routings of a real drawing
});
