/**
 * FACE: lines do not run over text (SPEC-schaltplan-leitungen.md, Task 29). Room names and notes
 * become obstacles for the router — for Claude's drawings and for drawing by hand alike.
 */
import { describe, it, expect } from "vitest";
import { buildObstacles, textObstacleRects } from "../pathfinding";
import { routeFixture } from "../routingHarness/route";
import { makeDevice, makeEdge, makePort } from "../routingHarness/fixtures";
import { computeDeviceHandles } from "../routingHarness/deviceHandleLayout";
import type { DeviceData, SchematicNode } from "../types";

const abs = (n: { position: { x: number; y: number } }) => n.position;

function room(id: string, label: string, x: number, y: number, w = 320, h = 240, extra: Record<string, unknown> = {}) {
  return { id, type: "room", position: { x, y }, data: { label, ...extra }, measured: { width: w, height: h } } as unknown as SchematicNode;
}

describe("textObstacleRects", () => {
  it("a room's name: top-left of the room, wider for longer names and bigger type", () => {
    const [short] = textObstacleRects([room("r", "TV", 100, 200)], abs);
    const [long] = textObstacleRects([room("r", "Kamera und Übertragung", 100, 200)], abs);
    const [big] = textObstacleRects([room("r", "TV", 100, 200, 320, 240, { labelSize: 24 })], abs);
    expect(short.left).toBe(100);
    expect(short.top).toBe(200);
    expect(long.right - long.left).toBeGreaterThan(short.right - short.left);
    expect(big.bottom - big.top).toBeGreaterThan(short.bottom - short.top);
    // Never wider than the room itself.
    const [narrow] = textObstacleRects([room("r", "Ein sehr langer Ortsname für einen schmalen Raum", 0, 0, 200, 150)], abs);
    expect(narrow.right).toBeLessThanOrEqual(200);
  });

  it("a note is an obstacle as big as it is drawn", () => {
    const note = { id: "n", type: "note", position: { x: 40, y: 60 }, data: { html: "<p>Hinweis</p>" }, measured: { width: 200, height: 80 } } as unknown as SchematicNode;
    expect(textObstacleRects([note], abs)).toEqual([{ left: 40, top: 60, right: 240, bottom: 140, nodeId: "n#text" }]);
  });

  it("buildObstacles includes them, but not the room's body", () => {
    const { rects } = buildObstacles([room("r", "Technik", 0, 0)], [], abs);
    expect(rects).toHaveLength(1);
    expect(rects[0].nodeId).toBe("r#label");
    expect(rects[0].bottom).toBeLessThan(60);
  });
});

describe("routing around a room name", () => {
  it("a line whose straight way would cross the name goes round it", () => {
    const out = makePort("Out", "hdmi", "output");
    const inn = makePort("In", "hdmi", "input");
    const a = makeDevice({ id: "a", x: 0, y: 160, ports: [out] });
    const b = makeDevice({ id: "b", x: 960, y: 160, ports: [inn] });
    const handleY = 160 + (computeDeviceHandles(a as { data: DeviceData }).find((h) => h.id === out.id)?.relY ?? 0);
    // The room "Technik" sits between them with its name right on the straight line.
    const technik = room("technik", "Technik", 400, handleY - 12, 320, 400);
    const { routes } = routeFixture([a, b, technik], [makeEdge({ id: "e", source: "a", sourceHandle: out.id, target: "b", targetHandle: inn.id, signalType: "hdmi" })]);
    const wps = routes.e?.waypoints ?? [];
    expect(wps.length).toBeGreaterThanOrEqual(2);
    const [label] = textObstacleRects([technik], abs);
    for (let i = 1; i < wps.length; i++) {
      const p = wps[i - 1];
      const q = wps[i];
      const x1 = Math.min(p.x, q.x), x2 = Math.max(p.x, q.x), y1 = Math.min(p.y, q.y), y2 = Math.max(p.y, q.y);
      const through = x2 > label.left && x1 < label.right && y2 > label.top && y1 < label.bottom;
      expect(through, `segment ${JSON.stringify(p)} → ${JSON.stringify(q)} crosses the name`).toBe(false);
    }
  });
});
