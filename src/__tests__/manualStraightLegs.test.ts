/**
 * FACE: a line laid with waypoints follows them (SPEC-schaltplan-leitungen.md, Claude's report from
 * claude.ai, 21.11.: "Wenn ich einer Leitung feste Stützpunkte gebe, verlegt der Editor die Teilstücke
 * dazwischen trotzdem selbst um Hindernisse herum"). Between two waypoints on one line, with nothing in
 * the way, the line runs straight from one to the other — as a person dragging waypoints expects too.
 */
import { describe, it, expect } from "vitest";
import { routeFixture } from "../routingHarness/route";
import { makeDevice, makeEdge, makePort } from "../routingHarness/fixtures";

function setup(waypointsA: { x: number; y: number }[], waypointsB: { x: number; y: number }[]) {
  const oa = makePort("Out", "ethernet", "output");
  const ia = makePort("In", "ethernet", "input");
  const ob = makePort("Out", "ethernet", "output");
  const ib = makePort("In", "ethernet", "input");
  const a1 = makeDevice({ id: "a1", x: 0, y: 0, ports: [oa] });
  const a2 = makeDevice({ id: "a2", x: 960, y: 0, ports: [ia] });
  const b1 = makeDevice({ id: "b1", x: 0, y: 160, ports: [ob] });
  const b2 = makeDevice({ id: "b2", x: 960, y: 160, ports: [ib] });
  const edges = [
    makeEdge({ id: "A", source: "a1", sourceHandle: oa.id, target: "a2", targetHandle: ia.id, signalType: "ethernet", data: { manualWaypoints: waypointsA } }),
    makeEdge({ id: "B", source: "b1", sourceHandle: ob.id, target: "b2", targetHandle: ib.id, signalType: "ethernet", data: { manualWaypoints: waypointsB } }),
  ];
  return routeFixture([a1, a2, b1, b2], edges).routes;
}

const hasStraight = (wps: { x: number; y: number }[], p: { x: number; y: number }, q: { x: number; y: number }) =>
  wps.some((w, i) => i > 0 && wps[i - 1].x === p.x && wps[i - 1].y === p.y && w.x === q.x && w.y === q.y);

describe("manual waypoints: straight legs stay straight", () => {
  it("two lines told to share a channel both run exactly along it — the second does not swerve", () => {
    const leg = [{ x: 320, y: 400 }, { x: 640, y: 400 }];
    const routes = setup(leg, leg);
    expect(hasStraight(routes.A!.waypoints, leg[0], leg[1])).toBe(true);
    expect(hasStraight(routes.B!.waypoints, leg[0], leg[1])).toBe(true);
  });

  it("a straight leg through a device is still routed round it", () => {
    // From x 320 to x 1200 along y 48 would run through a2 (x 960…): the router takes over.
    const routes = setup([{ x: 320, y: 48 }, { x: 1200, y: 48 }], [{ x: 320, y: 600 }, { x: 640, y: 600 }]);
    expect(hasStraight(routes.A!.waypoints, { x: 320, y: 48 }, { x: 1200, y: 48 })).toBe(false);
  });
});
