/**
 * FACE: renumber_ports (Jean-Luc, 21.11.: "Switch-Ports dürfen neu belegt werden"). The connections
 * at a switch take its ports in the order the connected devices stand on the sheet, top to bottom,
 * so the lines run side by side into the switch instead of crossing on the way. Only like ports are
 * swapped (RJ45 with RJ45, SFP with SFP); management, console and USB ports stay.
 */
import { describe, it, expect } from "vitest";
import { renumberPorts } from "../renumberPorts";
import type { ConnectionEdge, SchematicNode } from "../types";
import kapelle from "./fixtures/layout/kapelle-2026-11-21.json";

const sw = {
  id: "sw", type: "device", position: { x: 1000, y: 0 }, measured: { width: 176, height: 600 },
  data: {
    label: "Switch", deviceType: "switch",
    ports: [
      { id: "oob", label: "Out-of-Band Management Port", direction: "bidirectional", signalType: "ethernet" },
      ...[1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, label: `Port ${n}`, direction: "bidirectional", signalType: "ethernet" })),
      { id: "sfp6", label: "SFP Port 6", direction: "bidirectional", signalType: "fiber" },
      { id: "sfp7", label: "SFP Port 7", direction: "bidirectional", signalType: "fiber" },
    ],
  },
} as unknown as SchematicNode;
function device(id: string, x: number, y: number): SchematicNode {
  return {
    id, type: "device", position: { x, y }, measured: { width: 160, height: 96 },
    data: { label: id, deviceType: "x", ports: [{ id: "lan", label: "LAN", direction: "bidirectional", signalType: "ethernet" }] },
  } as unknown as SchematicNode;
}
function edge(id: string, source: string, sourceHandle: string, target: string, targetHandle: string, data = {}): ConnectionEdge {
  return { id, source, sourceHandle, target, targetHandle, data: { signalType: "ethernet", ...data } } as ConnectionEdge;
}
const portOf = (h: string | null | undefined) => (h ?? "").replace(/-(in|out)$/, "");

describe("renumberPorts", () => {
  it("devices top to bottom get ports 1, 2, 3 — whichever ports they had", () => {
    const n = [sw, device("mid", 0, 300), device("top", 0, 0), device("low", 0, 600)];
    const e = [edge("a", "mid", "lan-out", "sw", "p5-in"), edge("b", "top", "lan-out", "sw", "p3-in"), edge("c", "low", "lan-out", "sw", "p1-in")];
    const changes = renumberPorts(n, e, "sw");
    const port = (id: string) => portOf(changes.find((c) => c.id === id)?.targetHandle ?? e.find((x) => x.id === id)!.targetHandle);
    expect([port("b"), port("a"), port("c")]).toEqual(["p1", "p2", "p3"]);
  });

  it("works whichever end of the connection the switch is", () => {
    const n = [sw, device("top", 0, 0), device("low", 0, 600)];
    const e = [edge("a", "sw", "p4-out", "low", "lan-in"), edge("b", "top", "lan-out", "sw", "p2-in")];
    const changes = renumberPorts(n, e, "sw");
    expect(portOf(changes.find((c) => c.id === "b")?.targetHandle ?? "p2")).toBe("p1");
    expect(portOf(changes.find((c) => c.id === "a")?.sourceHandle ?? "p4")).toBe("p2");
  });

  it("only like ports are swapped: SFP stays SFP, the management port stays", () => {
    const n = [sw, device("kirche", 0, 900), device("mgmt", 0, 0), device("cam", 0, 400)];
    const e = [
      edge("f", "kirche", "lan-out", "sw", "sfp7-in"),
      edge("m", "mgmt", "lan-out", "sw", "oob-in"),
      edge("c", "cam", "lan-out", "sw", "p4-in"),
    ];
    const changes = renumberPorts(n, e, "sw");
    expect(portOf(changes.find((c) => c.id === "f")?.targetHandle ?? "sfp7")).toBe("sfp6");
    expect(changes.find((c) => c.id === "m")).toBeUndefined();
    expect(portOf(changes.find((c) => c.id === "c")?.targetHandle ?? "p4")).toBe("p1");
  });

  it("a port held by a connection the user laid by hand is left as it is, and skipped", () => {
    const n = [sw, device("own", 0, 0), device("a", 0, 300), device("b", 0, 600)];
    const e = [
      edge("own", "own", "lan-out", "sw", "p1-in", { manualWaypoints: [{ x: 500, y: 0 }] }),
      edge("x", "a", "lan-out", "sw", "p5-in"),
      edge("y", "b", "lan-out", "sw", "p4-in"),
    ];
    const changes = renumberPorts(n, e, "sw");
    expect(changes.find((c) => c.id === "own")).toBeUndefined();
    expect(portOf(changes.find((c) => c.id === "x")?.targetHandle)).toBe("p2");
    expect(portOf(changes.find((c) => c.id === "y")?.targetHandle)).toBe("p3");
  });

  it("the Kapelle switch: ports follow the sheet, every connection keeps its id, nothing doubles up", () => {
    const nodes = kapelle.nodes as unknown as SchematicNode[];
    const edges = kapelle.edges as unknown as ConnectionEdge[];
    const changes = renumberPorts(nodes, edges, "device-27");
    const after = edges.map((e) => ({ ...e, ...(changes.find((c) => c.id === e.id) ?? {}) }));
    const used = after.flatMap((e) => [e.source === "device-27" ? portOf(e.sourceHandle) : null, e.target === "device-27" ? portOf(e.targetHandle) : null]).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
    expect(after.map((e) => e.id)).toEqual(edges.map((e) => e.id));
  });
});
