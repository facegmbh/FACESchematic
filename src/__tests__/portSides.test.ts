/**
 * FACE: choose_port_sides (SPEC-schaltplan-leitungen.md, Task 28). A two-sided port (network,
 * bidirectional) has a handle on the left (`-in`) and on the right (`-out`); the line should leave
 * on the side facing the device it goes to. Claude used to connect everything `-out → -in`, so a
 * device right of the switch looped all the way round it.
 */
import { describe, it, expect } from "vitest";
import { choosePortSides } from "../portSides";
import type { ConnectionEdge, SchematicNode } from "../types";
import kapelle from "./fixtures/layout/kapelle-2026-11-21.json";

const ports = [
  { id: "lan", label: "LAN", direction: "bidirectional", signalType: "ethernet" },
  { id: "hdmi-in", label: "HDMI In", direction: "input", signalType: "hdmi" },
  { id: "hdmi-out", label: "HDMI Out", direction: "output", signalType: "hdmi" },
  { id: "pp", label: "Patch", direction: "passthrough", signalType: "ethernet" },
];
function device(id: string, x: number, y: number, parentId?: string): SchematicNode {
  return {
    id, type: "device", position: { x, y }, parentId, measured: { width: 160, height: 96 },
    data: { label: id, deviceType: "test", ports },
  } as unknown as SchematicNode;
}
function edge(id: string, source: string, sourceHandle: string, target: string, targetHandle: string, data = {}): ConnectionEdge {
  return { id, source, sourceHandle, target, targetHandle, data: { signalType: "ethernet", ...data } } as ConnectionEdge;
}
const sw = device("sw", 1000, 0);

describe("choosePortSides", () => {
  it("a device right of the switch: its port faces left, the switch port faces right", () => {
    const changes = choosePortSides([sw, device("tv", 1600, 0)], [edge("e", "tv", "lan-out", "sw", "lan-in")]);
    expect(changes).toEqual([{ id: "e", sourceHandle: "lan-in", targetHandle: "lan-out" }]);
  });

  it("a device left of the switch already facing it is left alone", () => {
    expect(choosePortSides([sw, device("cam", 0, 0)], [edge("e", "cam", "lan-out", "sw", "lan-in")])).toEqual([]);
  });

  it("devices on top of each other (a rack) use the same side — the fixed side of the other end if it has one", () => {
    const n = [device("a", 0, 0), device("b", 0, 200)];
    // Both two-sided: they meet on one side (left) instead of a Z through both devices.
    expect(choosePortSides(n, [edge("e", "a", "lan-out", "b", "lan-in")])).toEqual([{ id: "e", sourceHandle: "lan-in", targetHandle: "lan-in" }]);
    // One end can only be on the right (an output): the two-sided end joins it there.
    expect(choosePortSides(n, [edge("f", "a", "hdmi-out", "b", "lan-in")])).toEqual([{ id: "f", sourceHandle: "hdmi-out", targetHandle: "lan-out" }]);
  });

  it("one-sided ports and pass-through ports are never changed", () => {
    const n = [sw, device("tv", 1600, 0)];
    expect(choosePortSides(n, [
      edge("a", "tv", "hdmi-out", "sw", "hdmi-in"),
      edge("b", "tv", "pp-rear", "sw", "pp-front"),
    ])).toEqual([]);
  });

  it("the user's own waypoints are kept — such a line is only changed when named", () => {
    const own = edge("e", "tv", "lan-out", "sw", "lan-in", { manualWaypoints: [{ x: 1300, y: 300 }] });
    const n = [sw, device("tv", 1600, 0)];
    expect(choosePortSides(n, [own])).toEqual([]);
    expect(choosePortSides(n, [own], ["e"])).toHaveLength(1);
    // Waypoints the router laid itself are not the user's.
    const routed = edge("r", "tv", "lan-out", "sw", "lan-in", { manualWaypoints: [{ x: 1300, y: 300 }], autoRouteWaypoints: true });
    expect(choosePortSides(n, [routed])).toHaveLength(1);
  });

  it("connectionIds limits the work to those connections", () => {
    const n = [sw, device("tv", 1600, 0), device("pc", 1600, 300)];
    const e = [edge("a", "tv", "lan-out", "sw", "lan-in"), edge("b", "pc", "lan-out", "sw", "lan-in")];
    expect(choosePortSides(n, e, ["b"]).map((c) => c.id)).toEqual(["b"]);
  });

  it("positions inside rooms count where they are on the canvas", () => {
    const room = { id: "r", type: "room", position: { x: 2000, y: 0 }, data: { label: "Sakristei" }, style: { width: 400, height: 300 } } as unknown as SchematicNode;
    // tv sits at x 2016 on the canvas — right of the switch, though its own x is small.
    const changes = choosePortSides([sw, room, device("tv", 16, 48, "r")], [edge("e", "tv", "lan-out", "sw", "lan-in")]);
    expect(changes).toEqual([{ id: "e", sourceHandle: "lan-in", targetHandle: "lan-out" }]);
  });

  it("only connections between two devices (stub tags keep their own rules)", () => {
    const tag = { id: "t", type: "stub-label", position: { x: 0, y: 0 }, data: {} } as unknown as SchematicNode;
    expect(choosePortSides([sw, tag], [edge("e", "sw", "lan-out", "t", "l")])).toEqual([]);
  });

  it("the Kapelle: it changes something and leaves the rest of each connection alone", () => {
    const nodes = kapelle.nodes as unknown as SchematicNode[];
    const edges = kapelle.edges as unknown as ConnectionEdge[];
    const changes = choosePortSides(nodes, edges);
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) {
      const e = edges.find((x) => x.id === c.id)!;
      expect(c.sourceHandle.replace(/-(in|out)$/, "")).toBe(e.sourceHandle!.replace(/-(in|out)$/, ""));
      expect(c.targetHandle.replace(/-(in|out)$/, "")).toBe(e.targetHandle!.replace(/-(in|out)$/, ""));
    }
  });
});
