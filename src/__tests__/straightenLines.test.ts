/**
 * FACE: straighten_lines (SPEC-schaltplan-rahmen.md). Jean-Luc, 22.11.: "Geräte könnten leicht
 * verschoben werden damit die Linien sauberer laufen." Two ports facing each other a row or two
 * apart make a line with a jog; moving the lighter device by that much makes it straight.
 */
import { describe, it, expect } from "vitest";
import { straightenLines } from "../straightenLines";
import { routeFixture } from "../routingHarness/route";
import type { ConnectionEdge, SchematicNode } from "../types";
import jl from "./fixtures/layout/kapelle-jl-2026-11-22.json";

function room(id: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}, parentId?: string): SchematicNode {
  return { id, type: "room", position: { x, y }, parentId, data: { label: id, ...extra }, measured: { width: w, height: h } } as unknown as SchematicNode;
}
function device(id: string, x: number, y: number, parentId?: string, h = 96): SchematicNode {
  return { id, type: "device", position: { x, y }, parentId, measured: { width: 160, height: h }, data: { label: id, deviceType: "x", ports: [] } } as unknown as SchematicNode;
}
function edge(id: string, source: string, target: string, data: Record<string, unknown> = {}): ConnectionEdge {
  return { id, source, target, sourceHandle: "o", targetHandle: "i", data: { signalType: "hdmi", ...data } } as ConnectionEdge;
}
/** A line from a's right side to b's left side, ports at the given heights. */
const line = (ax: number, ay: number, bx: number, by: number) => ({ waypoints: [{ x: ax, y: ay }, { x: (ax + bx) / 2, y: ay }, { x: (ax + bx) / 2, y: by }, { x: bx, y: by }] });

describe("straightenLines", () => {
  it("moves the device with fewer connections so the line runs straight", () => {
    // a has one line, b two: a moves down 32 to b's port row.
    const n = [device("a", 0, 0), device("b", 400, 0), device("c", 800, 0)];
    const e = [edge("e1", "a", "b"), edge("e2", "b", "c")];
    const routes = { e1: line(160, 48, 400, 80), e2: { waypoints: [{ x: 560, y: 48 }, { x: 800, y: 48 }] } };
    expect(straightenLines(n, e, routes)).toEqual([{ id: "a", dy: 32, straightens: ["e1"] }]);
  });

  it("not further than maxShift, and only on the grid", () => {
    const n = [device("a", 0, 0), device("b", 400, 0)];
    const e = [edge("e1", "a", "b")];
    expect(straightenLines(n, e, { e1: line(160, 48, 400, 160) }, { maxShift: 64 })).toEqual([]);
    expect(straightenLines(n, e, { e1: line(160, 48, 400, 58) })).toEqual([]);
  });

  it("not onto another device, and not out of its room — then the other end moves", () => {
    // a would have to go down 64 and touch "under" (no gap left): b comes up 64 instead.
    const blocked = [device("a", 0, 0), device("b", 400, 0), device("under", 0, 160)];
    expect(straightenLines(blocked, [edge("e1", "a", "b")], { e1: line(160, 48, 400, 112) })).toEqual([{ id: "b", dy: -64, straightens: ["e1"] }]);
    // a would end at 48 + 64 + 96 = 208, past its room's bottom (200 less 16).
    const tight = [room("r", 0, 0, 240, 200), device("a", 32, 48, "r"), device("b", 400, 48)];
    expect(straightenLines(tight, [edge("e1", "a", "b")], { e1: line(192, 96, 400, 160) }).map((m) => m.id)).toEqual(["b"]);
  });

  it("devices in a rack box move like any other; in a locked room they stay and the other end moves", () => {
    // Both have one line; "a1" goes first — the rack box's picture is free (U live on the rack page).
    const n = [room("rack", 0, 0, 400, 400, { isEquipmentRack: true }), device("a1", 32, 48, "rack"), device("z1", 600, 0)];
    const routes = { e1: line(192, 96, 600, 128) };
    expect(straightenLines(n, [edge("e1", "a1", "z1")], routes)).toEqual([{ id: "a1", dy: 32, straightens: ["e1"] }]);
    const locked = [room("box", 500, -100, 400, 400, { locked: true }), { ...device("a1", 100, 100), parentId: "box" } as SchematicNode, device("z1", 32, 48)];
    expect(straightenLines(locked, [edge("e1", "z1", "a1")], routes)).toEqual([{ id: "z1", dy: 32, straightens: ["e1"] }]);
  });

  it("does not break a line that is straight already", () => {
    // b is straight to c; a cannot move (locked room). Moving b to a's row would straighten one
    // line and break the other — so nothing moves.
    const n = [room("box", -32, -48, 240, 400, { locked: true }), device("a", 32, 48, "box"), device("b", 400, 0), device("c", 800, 0)];
    const e = [edge("e1", "b", "a"), edge("e2", "b", "c")];
    const routes = { e1: { waypoints: [{ x: 400, y: 48 }, { x: 300, y: 48 }, { x: 300, y: 80 }, { x: 160, y: 80 }] }, e2: { waypoints: [{ x: 560, y: 48 }, { x: 800, y: 48 }] } };
    expect(straightenLines(n, e, routes)).toEqual([]);
  });

  it("leaves lines alone whose ports do not face each other, and the user's own paths", () => {
    const n = [device("a", 0, 0), device("b", 400, 0)];
    // Both ports on the right side: the line turns anyway.
    const sameSide = { e1: { waypoints: [{ x: 160, y: 48 }, { x: 600, y: 48 }, { x: 600, y: 80 }, { x: 560, y: 80 }] } };
    expect(straightenLines(n, [edge("e1", "a", "b")], sameSide)).toEqual([]);
    const own = edge("e1", "a", "b", { manualWaypoints: [{ x: 280, y: 48 }] });
    expect(straightenLines(n, [own], { e1: line(160, 48, 400, 80) })).toEqual([]);
  });

  it("only inside the room asked for", () => {
    const n = [room("r", 0, 0, 300, 400), device("a", 32, 48, "r"), device("b", 600, 48)];
    const routes = { e1: line(192, 96, 600, 128) };
    expect(straightenLines(n, [edge("e1", "a", "b")], routes, { roomId: "r" }).map((m) => m.id)).toEqual(["a"]);
    expect(straightenLines(n, [edge("e1", "a", "b")], routes, { roomId: "elsewhere" })).toEqual([]);
  });

  it("Jean-Luc's Kapelle: straightens lines, nothing lands on anything", () => {
    const nodes = jl.nodes as unknown as SchematicNode[];
    const edges = jl.edges as unknown as ConnectionEdge[];
    const { routes } = routeFixture(nodes, edges);
    const moves = straightenLines(nodes, edges, routes);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(Math.abs(m.dy)).toBeLessThanOrEqual(64);
  });
});
