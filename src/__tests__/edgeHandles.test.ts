import { describe, it, expect } from "vitest";
import { computeHandleInsertion, projectOntoSegments } from "../edgeHandles";
import type { ConnectionEdge, SchematicNode } from "../types";

const GRID = 10;

const edge = (data: Partial<ConnectionEdge["data"]> = {}): ConnectionEdge =>
  ({
    id: "e1",
    source: "src",
    target: "tgt",
    sourceHandle: "a",
    targetHandle: "b",
    type: "offset",
    data: { signalType: "sdi", ...data },
  }) as ConnectionEdge;

/** An L: right along y=0 to x=100, then down to y=100. */
const lRoute = { waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };

describe("projectOntoSegments", () => {
  it("picks the nearest segment and returns its index", () => {
    const onTop = projectOntoSegments(40, 8, lRoute.waypoints);
    expect(onTop.segIdx).toBe(0);
    expect(onTop).toMatchObject({ x: 40, y: 0 });

    const onSide = projectOntoSegments(92, 70, lRoute.waypoints);
    expect(onSide.segIdx).toBe(1);
    expect(onSide).toMatchObject({ x: 100, y: 70 });
  });
});

describe("computeHandleInsertion", () => {
  it("keeps a horizontal segment on its own y, snapping only x", () => {
    const res = computeHandleInsertion(edge(), lRoute, { x: 43, y: 6 }, GRID, []);
    expect(res).toEqual({ kind: "manual", waypoints: [{ x: 40, y: 0 }] });
  });

  it("keeps a vertical segment on its own x, snapping only y", () => {
    const res = computeHandleInsertion(edge(), lRoute, { x: 96, y: 63 }, GRID, []);
    expect(res).toEqual({ kind: "manual", waypoints: [{ x: 100, y: 60 }] });
  });

  it("inserts a new handle before an existing one further along the path", () => {
    // Existing handle sits on the vertical leg (segIdx 1); the new click is on the
    // horizontal leg (segIdx 0), so it must land first, not appended.
    const withHandle = edge({ manualWaypoints: [{ x: 100, y: 60 }] });
    const res = computeHandleInsertion(withHandle, lRoute, { x: 43, y: 6 }, GRID, []);
    expect(res).toEqual({
      kind: "manual",
      waypoints: [{ x: 40, y: 0 }, { x: 100, y: 60 }],
    });
  });

  it("appends when the click is further along than every existing handle", () => {
    const withHandle = edge({ manualWaypoints: [{ x: 40, y: 0 }] });
    const res = computeHandleInsertion(withHandle, lRoute, { x: 96, y: 63 }, GRID, []);
    expect(res).toEqual({
      kind: "manual",
      waypoints: [{ x: 40, y: 0 }, { x: 100, y: 60 }],
    });
  });

  it("routes a stubbed edge's handle to the nearer stub leg", () => {
    const nodes = [
      { id: "src", position: { x: 0, y: 0 } },
      { id: "tgt", position: { x: 400, y: 0 } },
    ] as SchematicNode[];
    const stubbed = edge({ stubbed: true });

    expect(computeHandleInsertion(stubbed, lRoute, { x: 30, y: 0 }, GRID, nodes)).toEqual({
      kind: "stub",
      field: "stubSourceWaypoints",
      waypoints: [{ x: 30, y: 0 }],
    });
    expect(computeHandleInsertion(stubbed, lRoute, { x: 370, y: 0 }, GRID, nodes)).toEqual({
      kind: "stub",
      field: "stubTargetWaypoints",
      waypoints: [{ x: 370, y: 0 }],
    });
  });

  it("bails when the edge has no drawn route yet", () => {
    expect(computeHandleInsertion(edge(), undefined, { x: 10, y: 10 }, GRID, [])).toBeNull();
    expect(
      computeHandleInsertion(edge(), { waypoints: [{ x: 0, y: 0 }] }, { x: 10, y: 10 }, GRID, []),
    ).toBeNull();
  });
});
