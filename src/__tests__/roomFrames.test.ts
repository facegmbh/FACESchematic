/**
 * FACE: lines keep off room frames and out of rooms that hold neither of their devices
 * (SPEC-schaltplan-rahmen.md). Jean-Luc, 22.11.: "Linien laufen noch auf Linien von Rahmen …
 * Linien sollen auch nicht durch die Rahmen laufen von anderen." For every drawing, by hand too.
 */
import { describe, it, expect } from "vitest";
import { routeFixture } from "../routingHarness/route";
import { makeDevice, makeEdge, makePort } from "../routingHarness/fixtures";
import { computeDeviceHandles } from "../routingHarness/deviceHandleLayout";
import { checkLayout } from "../layoutCheck";
import type { ConnectionEdge, DeviceData, SchematicNode } from "../types";
import jl from "./fixtures/layout/kapelle-jl-2026-11-22.json";

function room(id: string, x: number, y: number, w: number, h: number, parentId?: string) {
  return { id, type: "room", position: { x, y }, parentId, data: { label: id }, measured: { width: w, height: h } } as unknown as SchematicNode;
}
function pair(ax: number, bx: number, y: number) {
  const out = makePort("Out", "hdmi", "output");
  const inn = makePort("In", "hdmi", "input");
  const a = makeDevice({ id: "a", x: ax, y, ports: [out] });
  const b = makeDevice({ id: "b", x: bx, y, ports: [inn] });
  const handleY = y + (computeDeviceHandles(a as { data: DeviceData }).find((h) => h.id === out.id)?.relY ?? 0);
  const edge = makeEdge({ id: "e", source: "a", sourceHandle: out.id, target: "b", targetHandle: inn.id, signalType: "hdmi" });
  return { a, b, handleY, edge };
}
const kinds = (nodes: SchematicNode[], edges: ConnectionEdge[]) => {
  const { routes } = routeFixture(nodes, edges);
  return checkLayout(nodes, edges, routes).map((f) => f.kind);
};

describe("routing and room frames", () => {
  it("a line whose straight way lies on a frame moves off it", () => {
    const { a, b, handleY, edge } = pair(0, 960, 160);
    // Room "x" between them, its top edge exactly on the line.
    const x = room("x", 400, handleY, 320, 300);
    expect(kinds([a, b, x], [edge])).not.toContain("on_frame");
  });

  it("a line goes round a room that holds neither of its devices", () => {
    const { a, b, handleY, edge } = pair(48, 1248, 400);
    // a and b each in their own location, tall; "x" between them, the straight way right through it.
    const left = room("left", 0, 0, 320, 900);
    const right = room("right", 1200, 0, 320, 900);
    const x = room("x", 480, handleY - 160, 560, 320);
    const inA = { ...a, parentId: "left" } as SchematicNode;
    const inB = { ...b, parentId: "right", position: { x: 48, y: 400 } } as SchematicNode;
    expect(kinds([left, right, x, inA, inB], [edge])).not.toContain("through_room");
  });

  it("but runs straight through its own rooms", () => {
    const { a, b, edge } = pair(48, 800, 160);
    const own = room("own", 0, 0, 1200, 600);
    const inA = { ...a, parentId: "own" } as SchematicNode;
    const inB = { ...b, parentId: "own" } as SchematicNode;
    const { routes } = routeFixture([own, inA, inB], [edge]);
    expect(routes.e?.waypoints.length).toBe(2);
  });

  it("Jean-Luc's Kapelle (22.11.): no line on a frame, none through another room except the Kirche's", () => {
    const nodes = jl.nodes as unknown as SchematicNode[];
    const edges = jl.edges as unknown as ConnectionEdge[];
    const { routes } = routeFixture(nodes, edges);
    const f = checkLayout(nodes, edges, routes);
    expect(f.filter((x) => x.kind === "on_frame").map((x) => x.message)).toEqual([]);
    // The Kirche sits above the Kapelle, the switch below it: that one line has to cross the
    // Kapelle — check_layout tells Claude to put Kirche and Technik side by side.
    const through = f.filter((x) => x.kind === "through_room");
    expect(through.map((x) => x.ids.slice(1))).toEqual([["room-23"]]);
    expect(f.map((x) => x.kind)).not.toContain("line_outside");
  });

  it("a line back to the left turns between its two devices when one sits well above the other", () => {
    // a's output faces right, b's input left, b lower and further left: the way back runs in
    // the gap between them, not over a or under b.
    const out = makePort("Out", "hdmi", "output");
    const inn = makePort("In", "hdmi", "input");
    const a = makeDevice({ id: "a", x: 800, y: 0, ports: [out] });
    const b = makeDevice({ id: "b", x: 0, y: 640, ports: [inn] });
    const edge = makeEdge({ id: "e", source: "a", sourceHandle: out.id, target: "b", targetHandle: inn.id, signalType: "hdmi" });
    const { routes } = routeFixture([a, b], [edge]);
    const ys = routes.e!.waypoints.map((p) => p.y);
    const [top, bottom] = [ys[0], ys[ys.length - 1]];
    for (const y of ys) expect(y >= top && y <= bottom, `waypoints ${JSON.stringify(routes.e!.waypoints)}`).toBe(true);
  });

  it("Jean-Luc's Kapelle: the access point's line to the ESP turns above the rack box, not under it", () => {
    // Jean-Luc's drawing laid this one by hand; given back to the router it went down past the
    // ESP, under the whole rack box and back up (22.11.).
    const nodes = jl.nodes as unknown as SchematicNode[];
    const edges = (jl.edges as unknown as ConnectionEdge[]).map((e) =>
      e.id === "edge-41" ? ({ ...e, data: { ...e.data, manualWaypoints: undefined } } as ConnectionEdge) : e,
    );
    const { routes } = routeFixture(nodes, edges);
    const wps = routes["edge-41"]!.waypoints;
    const espPortY = wps[wps.length - 1].y;
    expect(Math.max(...wps.map((p) => p.y)), JSON.stringify(wps)).toBe(espPortY);
    const f = checkLayout(nodes, edges, routes).filter((x) => x.ids.includes("edge-41") && x.kind !== "crossings");
    expect(f.map((x) => `${x.kind}: ${x.message}`)).toEqual([]);
  });
});
