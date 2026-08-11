import { describe, it, expect, beforeEach, vi } from "vitest";

import { useSchematicStore } from "../store";
import type { DeviceData, DeviceNode, SchematicNode } from "../types";

// The store persists on every mutation; node env has no localStorage.
vi.stubGlobal("localStorage", {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
});

function device(id: string, label: string, y: number, extra: Partial<DeviceData> = {}): DeviceNode {
  return {
    id,
    type: "device",
    position: { x: 0, y },
    selected: true,
    data: { label, deviceType: "speaker", ports: [], ...extra },
  } as DeviceNode;
}

function setNodes(nodes: SchematicNode[]) {
  useSchematicStore.setState({ nodes, edges: [] });
}

function labels() {
  return useSchematicStore
    .getState()
    .nodes.filter((n): n is DeviceNode => n.type === "device")
    .map((n) => n.data.label);
}

function dataOf(id: string): DeviceData {
  const n = useSchematicStore.getState().nodes.find((x) => x.id === id);
  return n!.data as DeviceData;
}

const patchAll = (ids: string[], patch: Partial<DeviceData>) =>
  useSchematicStore.getState().batchPatchDeviceData(ids.map((nodeId) => ({ nodeId, patch })));

describe("batchPatchDeviceData — bulk device property edit", () => {
  beforeEach(() => {
    setNodes([device("a", "Top", 0), device("b", "Middle", 100), device("c", "Bottom", 200)]);
  });

  it("applies one patch to every listed device", () => {
    patchAll(["a", "b", "c"], { color: "#ff0000", manufacturer: "d&b" });
    for (const id of ["a", "b", "c"]) {
      expect(dataOf(id).color).toBe("#ff0000");
      expect(dataOf(id).manufacturer).toBe("d&b");
    }
  });

  it("leaves unlisted devices untouched", () => {
    patchAll(["a"], { color: "#ff0000" });
    expect(dataOf("a").color).toBe("#ff0000");
    expect(dataOf("b").color).toBeUndefined();
    expect(dataOf("c").color).toBeUndefined();
  });

  it("deletes keys patched to undefined rather than storing undefined", () => {
    patchAll(["a"], { color: "#ff0000", note: "check me" });
    patchAll(["a"], { color: undefined });
    expect("color" in dataOf("a")).toBe(false);
    // Untouched keys survive — the patch is a merge, not a replace.
    expect(dataOf("a").note).toBe("check me");
  });

  it("never disturbs ports or other per-device identity", () => {
    setNodes([
      device("a", "L", 0, { ports: [{ id: "p1", label: "In", signalType: "analog-audio", direction: "input" }], serialNumber: "SN-1" }),
      device("b", "R", 100, { ports: [], serialNumber: "SN-2" }),
    ]);
    patchAll(["a", "b"], { category: "audio" });
    expect(dataOf("a").ports).toHaveLength(1);
    expect(dataOf("a").serialNumber).toBe("SN-1");
    expect(dataOf("b").serialNumber).toBe("SN-2");
  });

  describe("naming", () => {
    it("numbers the group top-left first when baseLabel is set", () => {
      patchAll(["a", "b", "c"], { baseLabel: "Lautsprecher", label: "Lautsprecher" });
      expect(labels()).toEqual(["Lautsprecher 1", "Lautsprecher 2", "Lautsprecher 3"]);
    });

    it("orders numbering by position, not by node order", () => {
      setNodes([device("a", "X", 300), device("b", "Y", 100), device("c", "Z", 200)]);
      patchAll(["a", "b", "c"], { baseLabel: "LS", label: "LS" });
      expect(dataOf("b").label).toBe("LS 1");
      expect(dataOf("c").label).toBe("LS 2");
      expect(dataOf("a").label).toBe("LS 3");
    });

    it("gives every device the identical name when baseLabel is cleared", () => {
      patchAll(["a", "b", "c"], { label: "Lautsprecher", baseLabel: undefined });
      expect(labels()).toEqual(["Lautsprecher", "Lautsprecher", "Lautsprecher"]);
      expect("baseLabel" in dataOf("a")).toBe(false);
    });

    it("renumbers the remaining devices after one is renamed out of the group", () => {
      patchAll(["a", "b", "c"], { baseLabel: "LS", label: "LS" });
      patchAll(["b"], { label: "Sub", baseLabel: undefined });
      expect(labels()).toEqual(["LS 1", "Sub", "LS 2"]);
    });
  });

  it("collapses the whole batch into a single undo step", () => {
    const before = useSchematicStore.getState().undoSize;
    patchAll(["a", "b", "c"], { color: "#ff0000" });
    expect(useSchematicStore.getState().undoSize).toBe(before + 1);

    useSchematicStore.getState().undo();
    for (const id of ["a", "b", "c"]) expect(dataOf(id).color).toBeUndefined();
  });

  it("restores prior labels when a numbering batch is undone", () => {
    patchAll(["a", "b", "c"], { baseLabel: "LS", label: "LS" });
    useSchematicStore.getState().undo();
    expect(labels()).toEqual(["Top", "Middle", "Bottom"]);
  });

  it("is a no-op for an empty change list", () => {
    const before = useSchematicStore.getState().undoSize;
    useSchematicStore.getState().batchPatchDeviceData([]);
    expect(useSchematicStore.getState().undoSize).toBe(before);
    expect(labels()).toEqual(["Top", "Middle", "Bottom"]);
  });
});
