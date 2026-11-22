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

  it("place_device_in_rack also puts the device into the rack box, side by side by signal flow, without overlap", async () => {
    // Jean-Luc, 21.11.: the box need not stack the gear — the U order lives in the rack elevation.
    store.setState({ edges: [{ id: "sig", source: "device-2", target: "device-1", sourceHandle: "o", targetHandle: "i", data: { signalType: "analog-audio" } }] as never });
    const ort = await ok("create_room", { label: "Technik", x: 0, y: 0, width: 800, height: 700 });
    const rack = await ok("add_rack_to_room", { roomId: ort.roomId, name: "Wandschrank", heightU: 12 });
    const b = await ok("place_device_in_rack", { deviceId: "device-2", rackId: rack.rackId, uPosition: 5 });
    const a = await ok("place_device_in_rack", { deviceId: "device-1", rackId: rack.rackId, uPosition: 10 });
    expect(a.rackRoomId).toBe(rack.rackRoomId);
    // device-2 feeds device-1: left of it, although it sits lower in the rack.
    expect(node("device-2")!.position.x).toBeLessThan(node("device-1")!.position.x);
    // The rack elevation still has the U positions.
    const page = store.getState().pages.find((p) => p.id === rack.pageId) as { placements: { deviceNodeId: string; uPosition: number }[] };
    expect(page.placements.find((pl) => pl.deviceNodeId === "device-1")?.uPosition).toBe(10);
    expect(node("device-1")?.parentId).toBe(rack.rackRoomId);
    expect(node("device-2")?.parentId).toBe(rack.rackRoomId);
    const check = await ok("check_layout", { roomId: ort.roomId as string });
    const kinds = (check.findings as { kind: string }[]).map((f) => f.kind);
    expect(kinds).not.toContain("overlap");
    expect(kinds).not.toContain("outside");
    void b;
  });

  it("a rack box is not dissolved — it is the link to the rack elevation", async () => {
    const ort = await ok("create_room", { label: "Technik", x: 0, y: 0, width: 800, height: 700 });
    const rack = await ok("add_rack_to_room", { roomId: ort.roomId, name: "Wandschrank", heightU: 12 });
    const r = await run("dissolve_room", { roomId: rack.rackRoomId });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/arrange_room/);
    expect(node(rack.rackRoomId as string)).toBeDefined();
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

describe("restructuring an existing drawing (rename_room, dissolve_room)", () => {
  const node = (id: string) => store.getState().nodes.find((n) => n.id === id);
  const absolute = (id: string) => {
    let n = node(id);
    let { x, y } = n!.position;
    while (n?.parentId) {
      n = node(n.parentId);
      x += n!.position.x;
      y += n!.position.y;
    }
    return { x, y };
  };

  it("rename_room gives a trade room its location's name, nothing else changes", async () => {
    const before = node("room-8")!;
    const r = await run("rename_room", { roomId: "room-8", label: "Technik" });
    expect(r).toMatchObject({ ok: true, result: { roomId: "room-8", label: "Technik" } });
    const after = node("room-8")!;
    expect((after.data as { label: string }).label).toBe("Technik");
    expect(after.position).toEqual(before.position);
    expect(node("device-27")?.parentId).toBe("room-8");
  });

  it("rename_room needs a room and a name", async () => {
    expect((await run("rename_room", { roomId: "device-27", label: "X" })).ok).toBe(false);
    expect((await run("rename_room", { roomId: "room-8", label: "  " })).ok).toBe(false);
  });

  it("dissolve_room removes the frame and keeps the devices where they are, and their lines", async () => {
    const devices = ["device-15", "device-16", "device-17", "device-18"];
    const where = Object.fromEntries(devices.map((id) => [id, absolute(id)]));
    const edgeCount = store.getState().edges.length;
    const r = await run("dissolve_room", { roomId: "room-4" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result).toMatchObject({ roomId: "room-4", label: "Mikrofone", movedInto: null });
    expect((r.result as { released: string[] }).released.sort()).toEqual(devices);
    expect(node("room-4")).toBeUndefined();
    for (const id of devices) {
      expect(node(id)?.parentId).toBeUndefined();
      expect(absolute(id)).toEqual(where[id]);
    }
    expect(store.getState().edges.length).toBe(edgeCount);
  });

  it("dissolve_room is one undo step", async () => {
    const before = JSON.stringify(store.getState().nodes.map((n) => [n.id, n.parentId, n.position]));
    await run("dissolve_room", { roomId: "room-4" });
    store.getState().undo();
    expect(JSON.stringify(store.getState().nodes.map((n) => [n.id, n.parentId, n.position]))).toBe(before);
  });

  it("the contents of a nested room fall into the room around it, not out of everything", async () => {
    store.setState({
      nodes: [
        { id: "ort", type: "room", position: { x: 0, y: 0 }, data: { label: "Technik" }, style: { width: 800, height: 600 } },
        { id: "ecke", type: "room", position: { x: 32, y: 48 }, parentId: "ort", data: { label: "Netzwerk" }, style: { width: 400, height: 300 } },
        { id: "sw", type: "device", position: { x: 16, y: 48 }, parentId: "ecke", measured: { width: 176, height: 96 }, data: { label: "Switch", deviceType: "switch", ports: [] } },
      ] as never,
      edges: [], routedEdges: {},
    });
    const r = await run("dissolve_room", { roomId: "ecke" });
    expect(r).toMatchObject({ ok: true, result: { movedInto: "ort", released: ["sw"] } });
    expect(node("sw")?.parentId).toBe("ort");
    expect(absolute("sw")).toEqual({ x: 48, y: 96 });
  });

  it("a locked room is not dissolved — the user locked it on purpose", async () => {
    store.setState({
      nodes: [{ id: "ort", type: "room", position: { x: 0, y: 0 }, data: { label: "Kirche", locked: true }, style: { width: 400, height: 300 } }] as never,
      edges: [], routedEdges: {},
    });
    const r = await run("dissolve_room", { roomId: "ort" });
    expect(r.ok).toBe(false);
    expect(node("ort")).toBeDefined();
  });

  it("dissolve_room needs a room", async () => {
    expect((await run("dissolve_room", { roomId: "device-27" })).ok).toBe(false);
    expect(node("device-27")).toBeDefined();
  });
});

describe("choose_port_sides (Task 28)", () => {
  const handles = () => Object.fromEntries(store.getState().edges.map((e) => [e.id, [e.sourceHandle, e.targetHandle]]));

  it("turns two-sided ports towards each other, keeps every connection id, one undo step", async () => {
    const before = handles();
    const r = await run("choose_port_sides", {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = r.result as { changed: { connectionId: string }[] };
    expect(result.changed.length).toBeGreaterThan(0);
    const after = handles();
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(result.changed.every((c) => JSON.stringify(after[c.connectionId]) !== JSON.stringify(before[c.connectionId]))).toBe(true);
    store.getState().undo();
    expect(handles()).toEqual(before);
  });

  it("a second run changes nothing", async () => {
    await run("choose_port_sides", {});
    const again = await run("choose_port_sides", {});
    expect(again).toMatchObject({ ok: true, result: { changed: [] } });
  });

  it("unknown connection ids are refused", async () => {
    expect((await run("choose_port_sides", { connectionIds: ["nope"] })).ok).toBe(false);
  });
});

describe("margin and gap commands (Task 30)", () => {
  it("arrange_room with margin keeps that margin for later fits", async () => {
    const r = await run("arrange_room", { roomId: "room-8", margin: 96 });
    expect(r.ok).toBe(true);
    const room = store.getState().nodes.find((n) => n.id === "room-8")!;
    expect((room.data as { layoutMargin?: number }).layoutMargin).toBe(96);
    const fit = await run("fit_room", { roomId: "room-8" });
    const again = await run("arrange_room", { roomId: "room-8" });
    if (!r.ok || !fit.ok || !again.ok) throw new Error("command failed");
    expect((fit.result as { size: unknown }).size).toEqual((r.result as { size: unknown }).size);
  });

  it("margin and gap are checked", async () => {
    expect((await run("arrange_room", { roomId: "room-8", margin: 1000 })).ok).toBe(false);
    expect((await run("fit_room", { roomId: "room-8", margin: "x" })).ok).toBe(false);
    expect((await run("arrange_rooms", { gap: 5 })).ok).toBe(false);
    expect((await run("arrange_rooms", { gap: 192 })).ok).toBe(true);
  });
});

describe("set_connection_path (Task 31)", () => {
  const edgeOf = (id: string) => store.getState().edges.find((e) => e.id === id)!;
  const someId = () => store.getState().edges[0].id;

  it("lays a line along given points, snapped to the grid, as the user's own path — one undo step", async () => {
    const id = someId();
    const before = JSON.stringify(edgeOf(id).data);
    const r = await run("set_connection_path", { connectionId: id, waypoints: [{ x: 1003, y: 205 }, { x: 1003, y: 610 }] });
    expect(r).toMatchObject({ ok: true, result: { connectionId: id, waypoints: [{ x: 1008, y: 208 }, { x: 1008, y: 608 }] } });
    expect(edgeOf(id).data?.manualWaypoints).toEqual([{ x: 1008, y: 208 }, { x: 1008, y: 608 }]);
    expect(edgeOf(id).data?.autoRouteWaypoints).toBeFalsy();
    store.getState().undo();
    expect(JSON.stringify(edgeOf(id).data)).toBe(before);
  });

  it("adds the corner between two points that are not on one line, so every leg is straight", async () => {
    const id = someId();
    const r = await run("set_connection_path", { connectionId: id, waypoints: [{ x: 0, y: 0 }, { x: 320, y: 480 }, { x: 320, y: 800 }] });
    expect(r).toMatchObject({ ok: true, result: { waypoints: [{ x: 0, y: 0 }, { x: 320, y: 0 }, { x: 320, y: 480 }, { x: 320, y: 800 }] } });
  });

  it("an empty list gives the line back to the router", async () => {
    const id = someId();
    await run("set_connection_path", { connectionId: id, waypoints: [{ x: 0, y: 0 }] });
    const r = await run("set_connection_path", { connectionId: id, waypoints: [] });
    expect(r.ok).toBe(true);
    expect(edgeOf(id).data?.manualWaypoints).toBeUndefined();
  });

  it("checks what it is given", async () => {
    const id = someId();
    expect((await run("set_connection_path", { connectionId: "nope", waypoints: [] })).ok).toBe(false);
    expect((await run("set_connection_path", { connectionId: id, waypoints: "x" })).ok).toBe(false);
    expect((await run("set_connection_path", { connectionId: id, waypoints: [{ x: "a", y: 1 }] })).ok).toBe(false);
    const many = Array.from({ length: 51 }, (_, i) => ({ x: i * 16, y: 0 }));
    expect((await run("set_connection_path", { connectionId: id, waypoints: many })).ok).toBe(false);
  });
});

describe("get_schematic gives canvas rectangles (for set_connection_path)", () => {
  it("devices and rooms carry where they are on the canvas, nested rooms resolved", async () => {
    store.setState({
      nodes: [
        { id: "ort", type: "room", position: { x: 1000, y: 500 }, data: { label: "Kapelle" }, style: { width: 800, height: 600 } },
        { id: "ber", type: "room", position: { x: 32, y: 48 }, parentId: "ort", data: { label: "Kamera" }, style: { width: 300, height: 200 } },
        { id: "cam", type: "device", position: { x: 16, y: 48 }, parentId: "ber", measured: { width: 176, height: 96 }, data: { label: "Kamera", deviceType: "x", ports: [] } },
      ] as never,
      edges: [], routedEdges: {},
    });
    const r = await run("get_schematic", {});
    if (!r.ok) throw new Error(r.error);
    const res = r.result as { devices: { nodeId: string; canvas: unknown }[]; rooms: { roomId: string; canvas: unknown }[] };
    expect(res.devices.find((d) => d.nodeId === "cam")?.canvas).toEqual({ x: 1048, y: 596, width: 176, height: 96 });
    expect(res.rooms.find((d) => d.roomId === "ber")?.canvas).toEqual({ x: 1032, y: 548, width: 300, height: 200 });
  });
});

describe("route_connections waits until the router has settled", () => {
  it("a first intermediate result is not taken for the final one", async () => {
    store.setState({ autoRoute: true, routedEdges: {} } as never);
    const first = { e: { waypoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }] } };
    const final = { e: { waypoints: [{ x: 0, y: 0 }, { x: 9, y: 0 }] }, f: { waypoints: [{ x: 0, y: 0 }, { x: 2, y: 0 }] } };
    setTimeout(() => store.setState({ routedEdges: first } as never), 100);
    setTimeout(() => store.setState({ routedEdges: final } as never), 450);
    await run("route_connections", { waitMs: 5000 });
    expect(store.getState().routedEdges).toBe(final);
    // …and route_connections only returned after the final one arrived.
  });
});

describe("renumber_ports (Jean-Luc 21.11.: switch ports may be renumbered)", () => {
  const handles = () => Object.fromEntries(store.getState().edges.map((e) => [e.id, [e.sourceHandle, e.targetHandle]]));

  it("renumbers the switch by the sheet, says which port became which, one undo step", async () => {
    const before = handles();
    const r = await run("renumber_ports", { deviceId: "device-27" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = r.result as { changed: { connectionId: string; from: string; to: string }[] };
    expect(result.changed.length).toBeGreaterThan(0);
    expect(result.changed[0].from).toMatch(/Port/);
    expect(Object.keys(handles()).sort()).toEqual(Object.keys(before).sort());
    store.getState().undo();
    expect(handles()).toEqual(before);
  });

  it("needs a device", async () => {
    expect((await run("renumber_ports", { deviceId: "room-8" })).ok).toBe(false);
  });
});

describe("straighten_lines (SPEC-schaltplan-rahmen.md)", () => {
  const two = () => store.setState({
    autoRoute: true,
    nodes: [
      { id: "a", type: "device", position: { x: 0, y: 0 }, measured: { width: 160, height: 96 }, data: { label: "Kamera", deviceType: "x", ports: [] } },
      { id: "b", type: "device", position: { x: 400, y: 0 }, measured: { width: 160, height: 96 }, data: { label: "Encoder", deviceType: "x", ports: [] } },
      { id: "c", type: "device", position: { x: 800, y: 0 }, measured: { width: 160, height: 96 }, data: { label: "Switch", deviceType: "x", ports: [] } },
    ] as never,
    edges: [
      { id: "e1", source: "a", target: "b", sourceHandle: "o", targetHandle: "i", data: { signalType: "sdi" } },
      { id: "e2", source: "b", target: "c", sourceHandle: "o", targetHandle: "i", data: { signalType: "ethernet" } },
    ] as never,
    routedEdges: {
      e1: { waypoints: [{ x: 160, y: 48 }, { x: 280, y: 48 }, { x: 280, y: 80 }, { x: 400, y: 80 }] },
      e2: { waypoints: [{ x: 560, y: 48 }, { x: 800, y: 48 }] },
    } as never,
  });

  it("moves the camera down to the encoder's port in one undo step and says which", async () => {
    two();
    const r = await run("straighten_lines", { waitMs: 0 });
    if (!r.ok) throw new Error(r.error);
    expect((r.result as { moved: unknown[] }).moved).toEqual([{ deviceId: "a", label: "Kamera", dy: 32, straightens: ["e1"] }]);
    expect(store.getState().nodes.find((n) => n.id === "a")?.position).toEqual({ x: 0, y: 32 });
    store.getState().undo();
    expect(store.getState().nodes.find((n) => n.id === "a")?.position).toEqual({ x: 0, y: 0 });
  });

  it("asks for routed lines first, and checks its arguments", async () => {
    two();
    store.setState({ routedEdges: {} });
    const r = await run("straighten_lines", { waitMs: 0 });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toContain("route_connections");
    two();
    expect((await run("straighten_lines", { maxShift: 500, waitMs: 0 })).ok).toBe(false);
    expect((await run("straighten_lines", { roomId: "nope", waitMs: 0 })).ok).toBe(false);
  });
});
