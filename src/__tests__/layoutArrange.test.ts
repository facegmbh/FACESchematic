/**
 * FACE: arranging a room for Claude (SPEC-schaltplan-layout.md, Task 24). Devices go into columns by
 * signal flow — sources left, sinks right — on the grid, without overlap; a rack box moves as one
 * block; the room then fits its content.
 */
import { describe, it, expect } from "vitest";
import { arrangeRoom, fitRoomSize, applyPositions } from "../layoutArrange";
import { checkLayout } from "../layoutCheck";
import type { ConnectionEdge, SchematicNode } from "../types";
import kapelle from "./fixtures/layout/kapelle-2026-11-21.json";

function room(id: string, x: number, y: number, w: number, h: number, parentId?: string): SchematicNode {
  return { id, type: "room", position: { x, y }, parentId, data: { label: id }, style: { width: w, height: h } } as SchematicNode;
}
function device(id: string, x: number, y: number, parentId?: string, h = 96): SchematicNode {
  return {
    id, type: "device", position: { x, y }, parentId, measured: { width: 176, height: h },
    data: { label: id, deviceType: "test", ports: [] },
  } as unknown as SchematicNode;
}
function edge(id: string, source: string, target: string): ConnectionEdge {
  return { id, source, target, sourceHandle: "out", targetHandle: "in", data: { signalType: "hdmi" } } as ConnectionEdge;
}
const within = (f: ReturnType<typeof checkLayout>) => f.filter((x) => x.kind === "overlap" || x.kind === "outside" || x.kind === "off_grid");

describe("arrangeRoom", () => {
  it("puts a chain in signal order, left to right, on the grid", () => {
    const nodes = [room("r", 0, 0, 400, 300), device("c", 20, 20, "r"), device("a", 300, 200, "r"), device("b", 10, 150, "r")];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];
    const pos = arrangeRoom(nodes, edges, "r");
    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.c.x);
    for (const p of Object.values(pos)) {
      expect(p.x % 16).toBe(0);
      expect(p.y % 16).toBe(0);
    }
  });

  it("stacks several devices of one column without overlap", () => {
    const nodes = [room("r", 0, 0, 400, 300), device("src", 0, 0, "r"), device("x", 0, 0, "r", 160), device("y", 0, 0, "r", 320), device("z", 0, 0, "r")];
    const edges = [edge("1", "src", "x"), edge("2", "src", "y"), edge("3", "src", "z")];
    const arranged = applyPositions(nodes, arrangeRoom(nodes, edges, "r"));
    const size = fitRoomSize(arranged, "r");
    const fitted = arranged.map((n) => (n.id === "r" ? { ...n, style: { width: size.width, height: size.height } } : n));
    expect(within(checkLayout(fitted, edges, {}))).toEqual([]);
  });

  it("moves a rack box as one block, counting the lines of the devices inside it", () => {
    const nodes = [
      room("ort", 0, 0, 800, 600), room("rack", 400, 300, 208, 300, "ort"), device("sw", 16, 48, "rack"),
      device("cam", 600, 40, "ort"), device("tv", 20, 400, "ort"),
    ];
    const edges = [edge("1", "cam", "sw"), edge("2", "sw", "tv")];
    const pos = arrangeRoom(nodes, edges, "ort");
    expect(Object.keys(pos).sort()).toEqual(["cam", "rack", "tv"]);
    expect(pos.cam.x).toBeLessThan(pos.rack.x);
    expect(pos.rack.x).toBeLessThan(pos.tv.x);
  });

  it("unconnected devices still get a place, without overlap", () => {
    const nodes = [room("r", 0, 0, 400, 300), device("a", 0, 0, "r"), device("b", 0, 0, "r"), device("c", 0, 0, "r")];
    const pos = arrangeRoom(nodes, [], "r");
    const arranged = applyPositions(nodes, pos);
    expect(within(checkLayout(arranged, [], {})).filter((f) => f.kind === "overlap")).toEqual([]);
  });

  it("the Kapelle: every room arranged and fitted has no overlap, nothing sticking out, all on the grid", () => {
    let nodes = kapelle.nodes as unknown as SchematicNode[];
    const edges = kapelle.edges as unknown as ConnectionEdge[];
    for (const r of nodes.filter((n) => n.type === "room")) {
      nodes = applyPositions(nodes, arrangeRoom(nodes, edges, r.id));
      const size = fitRoomSize(nodes, r.id);
      nodes = nodes.map((n) => (n.id === r.id ? { ...n, style: { ...n.style, width: size.width, height: size.height }, measured: undefined } : n));
    }
    // Within each room: nothing overlaps, nothing sticks out. (Rooms against each other and the
    // rooms' own grid position are arrange_rooms' job, Task 25.)
    for (const r of nodes.filter((n) => n.type === "room")) {
      const inside = new Set(nodes.filter((n) => n.parentId === r.id).map((n) => n.id));
      const problems = checkLayout(nodes, edges, {}, { roomId: r.id }).filter(
        (f) => (f.kind === "overlap" && f.ids.every((id) => inside.has(id))) || (f.kind === "outside" && inside.has(f.ids[0])),
      );
      expect(problems, r.id).toEqual([]);
    }
    // The ESP feeds the P2600A: left of it.
    const esp = nodes.find((n) => n.id === "device-19")!;
    const amp = nodes.find((n) => n.id === "device-20")!;
    expect(esp.position.x).toBeLessThan(amp.position.x);
  });
});

describe("fitRoomSize", () => {
  it("encloses every child with a margin, nested rooms included, rounded up to the grid", () => {
    const nodes = [room("r", 0, 0, 200, 150), device("a", 16, 48, "r"), room("rack", 300, 48, 208, 400, "r")];
    // 300 + 208 + 32 = 540 → 544 on the 16 px grid; 48 + 400 + 32 = 480 is on it already.
    expect(fitRoomSize(nodes, "r")).toEqual({ width: 544, height: 480 });
  });

  it("never goes below the editor's minimum", () => {
    expect(fitRoomSize([room("r", 0, 0, 400, 300)], "r")).toEqual({ width: 200, height: 150 });
  });
});
