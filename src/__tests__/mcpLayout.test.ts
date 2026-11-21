/**
 * FACE: the layout commands Claude gets through the bridge (SPEC-schaltplan-layout.md).
 * Run against the real store, like mcpEditing.test.ts.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import kapelle from "./fixtures/layout/kapelle-2026-11-21.json";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

let store: typeof import("../store").useSchematicStore;
let run: typeof import("../mcpBridge").runCommand;

beforeAll(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
  ({ useSchematicStore: store } = await import("../store"));
  ({ runCommand: run } = await import("../mcpBridge"));
});

beforeEach(() => {
  store.setState({
    nodes: structuredClone(kapelle.nodes) as never,
    edges: structuredClone(kapelle.edges) as never,
    routedEdges: {},
  });
});

describe("check_layout", () => {
  it("reports the Kapelle's problems and changes nothing", async () => {
    const before = JSON.stringify(store.getState().nodes);
    const r = await run("check_layout", {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = r.result as { clean: boolean; findings: { kind: string; ids: string[] }[]; summary: Record<string, number> };
    expect(result.clean).toBe(false);
    expect(result.summary.outside).toBeGreaterThanOrEqual(1);
    expect(result.summary.overlap).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(store.getState().nodes)).toBe(before);
  });

  it("roomId must be a room", async () => {
    const r = await run("check_layout", { roomId: "device-27" });
    expect(r.ok).toBe(false);
  });

  it("an empty schematic is clean", async () => {
    store.setState({ nodes: [], edges: [], routedEdges: {} });
    const r = await run("check_layout", {});
    expect(r).toMatchObject({ ok: true, result: { clean: true, findings: [] } });
  });
});

describe("locations and racks (Task 23)", () => {
  const FULL_1U = { widthMm: 480, heightMm: 44.45 };
  const FULL_2U = { widthMm: 480, heightMm: 88.9 };
  function rackDevice(id: string, size: { widthMm: number; heightMm: number }) {
    return {
      id, type: "device", position: { x: 2000, y: 2000 }, measured: { width: 176, height: 96 },
      data: { label: id, deviceType: "test", ports: [], ...size },
    };
  }
  const ok = async (command: string, params: Record<string, unknown>) => {
    const r = await run(command, params);
    if (!r.ok) throw new Error(`${command}: ${r.error}`);
    return r.result as Record<string, unknown>;
  };
  const node = (id: string) => store.getState().nodes.find((n) => n.id === id);

  beforeEach(() => {
    store.setState({
      nodes: [rackDevice("device-1", FULL_1U), rackDevice("device-2", FULL_2U)] as never,
      edges: [], routedEdges: {}, pages: [],
    });
  });

  it("create_room with parentRoomId nests a room inside a location, position relative", async () => {
    const ort = await ok("create_room", { label: "Technik", x: 0, y: 0, width: 800, height: 600 });
    const sub = await ok("create_room", { label: "Ecke", x: 32, y: 48, width: 240, height: 300, parentRoomId: ort.roomId });
    expect(node(sub.roomId as string)?.parentId).toBe(ort.roomId);
    expect(node(sub.roomId as string)?.position).toEqual({ x: 32, y: 48 });
  });

  it("a nested room that does not fit is refused and nothing is left behind", async () => {
    const ort = await ok("create_room", { label: "Technik", x: 0, y: 0, width: 300, height: 200 });
    const count = store.getState().nodes.length;
    const r = await run("create_room", { label: "Zu groß", x: 400, y: 0, width: 240, height: 300, parentRoomId: ort.roomId });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/fit|inside/i);
    expect(store.getState().nodes.length).toBe(count);
  });

  it("add_rack_to_room creates the rack box in the location and the rack elevation, linked", async () => {
    const ort = await ok("create_room", { label: "Technik", x: 0, y: 0, width: 800, height: 700 });
    const rack = await ok("add_rack_to_room", { roomId: ort.roomId, name: "Wandschrank", heightU: 12, rackType: "wall-mount" });
    const box = node(rack.rackRoomId as string);
    expect(box?.parentId).toBe(ort.roomId);
    expect(box?.data).toMatchObject({ label: "Wandschrank", isEquipmentRack: true, linkedRackId: rack.rackId, linkedRackPageId: rack.pageId });
    const page = store.getState().pages.find((p) => p.id === rack.pageId) as { racks: { id: string; linkedRoomId?: string; heightU: number }[] };
    expect(page.racks.find((r) => r.id === rack.rackId)).toMatchObject({ linkedRoomId: rack.rackRoomId, heightU: 12 });
  });

  it("place_device_in_rack also puts the device into the rack box, stacked without overlap", async () => {
    const ort = await ok("create_room", { label: "Technik", x: 0, y: 0, width: 800, height: 700 });
    const rack = await ok("add_rack_to_room", { roomId: ort.roomId, name: "Wandschrank", heightU: 12 });
    const b = await ok("place_device_in_rack", { deviceId: "device-2", rackId: rack.rackId, uPosition: 5 });
    const a = await ok("place_device_in_rack", { deviceId: "device-1", rackId: rack.rackId, uPosition: 10 });
    expect(a.rackRoomId).toBe(rack.rackRoomId);
    // The box mirrors the rack: higher U on top (device-1 at U10 above device-2 at U5).
    expect(node("device-1")!.position.y).toBeLessThan(node("device-2")!.position.y);
    expect(node("device-1")?.parentId).toBe(rack.rackRoomId);
    expect(node("device-2")?.parentId).toBe(rack.rackRoomId);
    const check = await ok("check_layout", { roomId: ort.roomId as string });
    const kinds = (check.findings as { kind: string }[]).map((f) => f.kind);
    expect(kinds).not.toContain("overlap");
    expect(kinds).not.toContain("outside");
    void b;
  });

  it("add_rack_to_room needs a room", async () => {
    const r = await run("add_rack_to_room", { roomId: "device-1", name: "X", heightU: 12 });
    expect(r.ok).toBe(false);
  });
});

describe("arrange_room and fit_room (Task 24)", () => {
  const roomSize = (id: string) => {
    const n = store.getState().nodes.find((x) => x.id === id)!;
    const style = n.style as { width: number; height: number };
    return { width: n.measured?.width ?? style.width, height: n.measured?.height ?? style.height };
  };
  const problemsIn = async (roomId: string) => {
    const r = await run("check_layout", { roomId });
    if (!r.ok) throw new Error(r.error);
    const inside = new Set(store.getState().nodes.filter((n) => n.parentId === roomId).map((n) => n.id));
    return (r.result as { findings: { kind: string; ids: string[] }[] }).findings.filter(
      (f) => (f.kind === "overlap" && f.ids.every((id) => inside.has(id))) || (f.kind === "outside" && inside.has(f.ids[0])),
    );
  };

  it("arrange_room clears the Projektion room (PureLink/RX1 no longer overlap) and fits it", async () => {
    expect((await problemsIn("room-6")).length).toBeGreaterThan(0);
    const r = await run("arrange_room", { roomId: "room-6" });
    expect(r.ok).toBe(true);
    expect(await problemsIn("room-6")).toEqual([]);
  });

  it("arrange_room is one undo step — positions and size come back together", async () => {
    const before = JSON.stringify(store.getState().nodes.map((n) => [n.id, n.position, n.style]));
    await run("arrange_room", { roomId: "room-8" });
    store.getState().undo();
    expect(JSON.stringify(store.getState().nodes.map((n) => [n.id, n.position, n.style]))).toBe(before);
  });

  it("fit_room makes the switch fit into 'Netzwerk'", async () => {
    expect((await problemsIn("room-8")).some((f) => f.kind === "outside")).toBe(true);
    const r = await run("fit_room", { roomId: "room-8" });
    expect(r.ok).toBe(true);
    expect(await problemsIn("room-8")).toEqual([]);
    expect(roomSize("room-8").height).toBeGreaterThanOrEqual(608);
  });

  it("both need a room", async () => {
    expect((await run("arrange_room", { roomId: "device-27" })).ok).toBe(false);
    expect((await run("fit_room", {})).ok).toBe(false);
  });
});

describe("arrange_rooms and route_connections (Task 25)", () => {
  const edgeData = (id: string) => store.getState().edges.find((e) => e.id === id)?.data as { manualWaypoints?: unknown[]; autoRouteWaypoints?: boolean } | undefined;

  it("arrange_rooms moves the rooms apart in one undo step", async () => {
    for (const r of store.getState().nodes.filter((n) => n.type === "room")) await run("arrange_room", { roomId: r.id });
    const r = await run("arrange_rooms", {});
    expect(r.ok).toBe(true);
    const check = await run("check_layout", {});
    if (!check.ok) throw new Error(check.error);
    const kinds = (check.result as { findings: { kind: string }[] }).findings.map((f) => f.kind);
    expect(kinds).not.toContain("room_overlap");
    expect(kinds).not.toContain("overlap");
    const before = JSON.stringify(store.getState().nodes.map((n) => n.position));
    await run("arrange_rooms", { order: ["room-10", "room-4"] });
    store.getState().undo();
    expect(JSON.stringify(store.getState().nodes.map((n) => n.position))).toBe(before);
  });

  it("route_connections turns auto-routing on and keeps the user's own waypoints", async () => {
    store.setState({
      autoRoute: false,
      edges: store.getState().edges.map((e, i) =>
        i === 0 ? { ...e, data: { ...e.data, manualWaypoints: [{ x: 1, y: 1 }] } } : e,
      ) as never,
    });
    const own = store.getState().edges[0].id;
    const r = await run("route_connections", { waitMs: 0 });
    expect(r.ok).toBe(true);
    expect(store.getState().autoRoute).toBe(true);
    expect(edgeData(own)?.manualWaypoints).toEqual([{ x: 1, y: 1 }]);
  });

  it("named connections lose their own waypoints so the router lays them anew", async () => {
    store.setState({
      autoRoute: true,
      edges: store.getState().edges.map((e, i) =>
        i === 0 ? { ...e, data: { ...e.data, manualWaypoints: [{ x: 1, y: 1 }] } } : e,
      ) as never,
    });
    const own = store.getState().edges[0].id;
    const r = await run("route_connections", { connectionIds: [own], waitMs: 0 });
    expect(r.ok).toBe(true);
    expect(edgeData(own)?.manualWaypoints).toBeUndefined();
  });

  it("unknown connection ids are refused", async () => {
    expect((await run("route_connections", { connectionIds: ["nope"], waitMs: 0 })).ok).toBe(false);
  });
});

describe("G1 findings (21.11.)", () => {
  it("place_device_in_room lets a small room grow for a tall device instead of refusing", async () => {
    store.setState({
      nodes: [
        { id: "room-x", type: "room", position: { x: 0, y: 0 }, data: { label: "Technik" }, style: { width: 240, height: 160 } },
        { id: "sw", type: "device", position: { x: 900, y: 900 }, measured: { width: 176, height: 608 }, data: { label: "Switch", deviceType: "switch", ports: [] } },
      ] as never,
      edges: [], routedEdges: {},
    });
    const r = await run("place_device_in_room", { deviceId: "sw", roomId: "room-x", x: 16, y: 48 });
    expect(r.ok).toBe(true);
    expect(store.getState().nodes.find((n) => n.id === "sw")?.parentId).toBe("room-x");
    const check = await run("check_layout", {});
    if (!check.ok) throw new Error(check.error);
    expect((check.result as { findings: { kind: string }[] }).findings.map((f) => f.kind)).not.toContain("outside");
  });

  it("a position outside the room is still refused", async () => {
    store.setState({
      nodes: [
        { id: "room-x", type: "room", position: { x: 0, y: 0 }, data: { label: "Technik" }, style: { width: 240, height: 160 } },
        { id: "d", type: "device", position: { x: 900, y: 900 }, measured: { width: 176, height: 96 }, data: { label: "D", deviceType: "x", ports: [] } },
      ] as never,
      edges: [], routedEdges: {},
    });
    expect((await run("place_device_in_room", { deviceId: "d", roomId: "room-x", x: 500, y: 48 })).ok).toBe(false);
  });

  it("add_rack_to_room leaves the user on the page they were looking at", async () => {
    store.setState({ nodes: [{ id: "ort", type: "room", position: { x: 0, y: 0 }, data: { label: "Technik" }, style: { width: 600, height: 400 } }] as never, edges: [], pages: [] });
    const before = store.getState().activePage;
    const r = await run("add_rack_to_room", { roomId: "ort", name: "Schrank", heightU: 12 });
    expect(r.ok).toBe(true);
    expect(store.getState().activePage).toBe(before);
  });
});
