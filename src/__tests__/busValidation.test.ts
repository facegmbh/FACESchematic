import { describe, it, expect } from "vitest";
import { computeBusSegments, BUS_DEVICE_LIMIT } from "../busValidation";
import type { ConnectionEdge, SchematicNode, SignalType } from "../types";

function dev(id: string): SchematicNode {
  return {
    id,
    type: "device",
    position: { x: 0, y: 0 },
    data: { label: id, deviceType: "custom", ports: [] },
  } as unknown as SchematicNode;
}

function edge(id: string, source: string, target: string, signalType: SignalType): ConnectionEdge {
  return { id, source, target, data: { signalType } } as unknown as ConnectionEdge;
}

/** Build a chain of `count` devices linked by edges of the given signal type. */
function chain(prefix: string, count: number, signalType: SignalType) {
  const nodes = Array.from({ length: count }, (_, i) => dev(`${prefix}${i}`));
  const edges = Array.from({ length: count - 1 }, (_, i) =>
    edge(`${prefix}e${i}`, `${prefix}${i}`, `${prefix}${i + 1}`, signalType),
  );
  return { nodes, edges };
}

describe("computeBusSegments", () => {
  it("returns nothing when there are no KNX/DALI edges", () => {
    const { nodes } = chain("n", 3, "ethernet");
    const eth = [edge("e0", "n0", "n1", "ethernet")];
    expect(computeBusSegments(nodes, eth)).toEqual([]);
  });

  it("groups a connected KNX chain into one segment with the right device count", () => {
    const { nodes, edges } = chain("k", 4, "knx");
    const segs = computeBusSegments(nodes, edges);
    expect(segs).toHaveLength(1);
    expect(segs[0].busType).toBe("knx");
    expect(segs[0].deviceCount).toBe(4);
    expect(segs[0].overLimit).toBe(false);
  });

  it("flags a KNX line that exceeds the 64-device limit", () => {
    const { nodes, edges } = chain("k", BUS_DEVICE_LIMIT + 1, "knx");
    const segs = computeBusSegments(nodes, edges);
    expect(segs).toHaveLength(1);
    expect(segs[0].deviceCount).toBe(BUS_DEVICE_LIMIT + 1);
    expect(segs[0].overLimit).toBe(true);
  });

  it("treats disconnected groups as separate segments", () => {
    const a = chain("a", 2, "dali");
    const b = chain("b", 3, "dali");
    const segs = computeBusSegments([...a.nodes, ...b.nodes], [...a.edges, ...b.edges]);
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.deviceCount).sort()).toEqual([2, 3]);
    expect(segs.every((s) => s.busType === "dali")).toBe(true);
  });

  it("reports KNX and DALI segments together, KNX first", () => {
    const k = chain("k", 2, "knx");
    const d = chain("d", 2, "dali");
    const segs = computeBusSegments([...k.nodes, ...d.nodes], [...k.edges, ...d.edges]);
    expect(segs.map((s) => s.busType)).toEqual(["knx", "dali"]);
  });
});
