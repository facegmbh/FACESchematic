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
});
