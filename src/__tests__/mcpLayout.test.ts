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
    const a = await ok("place_device_in_rack", { deviceId: "device-1", rackId: rack.rackId, uPosition: 10 });
    const b = await ok("place_device_in_rack", { deviceId: "device-2", rackId: rack.rackId, uPosition: 5 });
    expect(a.rackRoomId).toBe(rack.rackRoomId);
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
