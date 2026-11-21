/**
 * FACE: layout check for Claude (SPEC-schaltplan-layout.md, Task 22). Pure geometry over nodes,
 * edges and the routed lines — what overlaps, what sticks out of its room, which lines run through
 * devices, cross a lot or take a detour. The Kapelle drawing Claude built on 21.11. is the fixture:
 * the switch sticks out of "Netzwerk" and the JAP receiver lies under the PureLink.
 */
import { describe, it, expect } from "vitest";
import { checkLayout, type LayoutFinding } from "../layoutCheck";
import { routeFixture } from "../routingHarness/route";
import type { ConnectionEdge, SchematicNode } from "../types";
import kapelle from "./fixtures/layout/kapelle-2026-11-21.json";

const nodes = kapelle.nodes as unknown as SchematicNode[];
const edges = kapelle.edges as unknown as ConnectionEdge[];
const kinds = (f: LayoutFinding[]) => f.map((x) => x.kind);
const find = (f: LayoutFinding[], kind: LayoutFinding["kind"]) => f.filter((x) => x.kind === kind);

function room(id: string, x: number, y: number, w: number, h: number, parentId?: string): SchematicNode {
  return { id, type: "room", position: { x, y }, parentId, data: { label: id }, style: { width: w, height: h } } as SchematicNode;
}
function device(id: string, x: number, y: number, parentId?: string, w = 160, h = 96): SchematicNode {
  return {
    id, type: "device", position: { x, y }, parentId, measured: { width: w, height: h },
    data: { label: id, deviceType: "test", ports: [] },
  } as unknown as SchematicNode;
}
function edge(id: string, source: string, target: string): ConnectionEdge {
  return { id, source, target, sourceHandle: "out", targetHandle: "in", data: { signalType: "hdmi" } } as ConnectionEdge;
}

describe("checkLayout — Kapelle 21.11.", () => {
  const findings = checkLayout(nodes, edges, {});

  it("the switch sticks out of its room", () => {
    const outside = find(findings, "outside");
    expect(outside.some((f) => f.ids.includes("device-27") && f.ids.includes("room-8"))).toBe(true);
  });

  it("the JAP receiver lies under the PureLink", () => {
    const overlap = find(findings, "overlap");
    expect(overlap.some((f) => f.ids.includes("device-22") && f.ids.includes("device-23"))).toBe(true);
  });

  it("the rooms themselves do not overlap", () => {
    expect(find(findings, "room_overlap")).toEqual([]);
  });

  it("without routed lines it says so instead of judging them", () => {
    expect(find(findings, "unrouted")).toHaveLength(1);
    expect(find(findings, "crosses_device")).toEqual([]);
  });

  it("every finding names its ids and says what to do", () => {
    for (const f of findings) {
      expect(f.ids.length).toBeGreaterThan(0);
      expect(f.message.length).toBeGreaterThan(10);
    }
  });

  it("roomId narrows the check to that room and what is in it", () => {
    const onlyNetwork = checkLayout(nodes, edges, {}, { roomId: "room-8" });
    expect(kinds(onlyNetwork)).toContain("outside");
    expect(find(onlyNetwork, "overlap").some((f) => f.ids.includes("device-22"))).toBe(false);
  });

  it("with routes from the editor's router it also judges the lines", () => {
    const { routes } = routeFixture(nodes, edges);
    const routed = checkLayout(nodes, edges, routes);
    expect(find(routed, "unrouted")).toEqual([]);
    // The check itself must not change anything it was given.
    expect(nodes.find((n) => n.id === "device-27")?.position).toEqual({ x: 150, y: 0 });
  });
});

describe("checkLayout — small cases", () => {
  it("a tidy room with two devices side by side and a straight line has no findings", () => {
    const n = [room("r", 0, 0, 480, 160), device("a", 16, 32, "r"), device("b", 288, 32, "r")];
    const e = [edge("e1", "a", "b")];
    const routes = { e1: { waypoints: [{ x: 176, y: 80 }, { x: 288, y: 80 }] } };
    expect(checkLayout(n, e, routes)).toEqual([]);
  });

  it("a line through a third device is reported with the line's id", () => {
    const n = [device("a", 0, 0), device("b", 640, 0), device("c", 320, 0)];
    const e = [edge("e1", "a", "b")];
    const routes = { e1: { waypoints: [{ x: 160, y: 48 }, { x: 640, y: 48 }] } };
    const f = find(checkLayout(n, e, routes), "crosses_device");
    expect(f).toHaveLength(1);
    expect(f[0].ids).toContain("e1");
  });

  it("a detour (more than twice the shortest way, and far) is reported", () => {
    const n = [device("a", 0, 0), device("b", 320, 0)];
    const e = [edge("e1", "a", "b")];
    const routes = { e1: { waypoints: [{ x: 160, y: 48 }, { x: 160, y: 1200 }, { x: 320, y: 1200 }, { x: 320, y: 48 }] } };
    expect(find(checkLayout(n, e, routes), "detour")[0]?.ids).toEqual(["e1"]);
  });

  it("crossing lines are counted, naming the lines involved", () => {
    const n = [device("a", 0, 0), device("b", 640, 0), device("c", 320, -320), device("d", 320, 320)];
    const e = [edge("h", "a", "b"), edge("v", "c", "d")];
    const routes = {
      h: { waypoints: [{ x: 160, y: 48 }, { x: 640, y: 48 }] },
      v: { waypoints: [{ x: 304, y: -224 }, { x: 304, y: 320 }] },
    };
    const f = find(checkLayout(n, e, routes), "crossings");
    expect(f).toHaveLength(1);
    expect(f[0].ids.sort()).toEqual(["h", "v"]);
  });

  it("overlapping rooms are reported unless one is inside the other", () => {
    const side = checkLayout([room("r1", 0, 0, 400, 300), room("r2", 300, 0, 400, 300)], [], {});
    expect(find(side, "room_overlap")[0]?.ids.sort()).toEqual(["r1", "r2"]);
    const nested = checkLayout([room("ort", 0, 0, 600, 400), room("rack", 32, 32, 200, 300, "ort")], [], {});
    expect(find(nested, "room_overlap")).toEqual([]);
  });

  it("a rack box sticking out of its location is 'outside' too", () => {
    const f = checkLayout([room("ort", 0, 0, 300, 200), room("rack", 32, 32, 200, 300, "ort")], [], {});
    expect(find(f, "outside")[0]?.ids).toEqual(["rack", "ort"]);
  });

  it("devices off the 16 px grid are listed in one finding", () => {
    const f = find(checkLayout([device("a", 20, 40), device("b", 32, 48)], [], {}), "off_grid");
    expect(f).toHaveLength(1);
    expect(f[0].ids).toEqual(["a"]);
  });
});
