import { describe, it, expect, beforeEach, vi } from "vitest";

import { useSchematicStore } from "../store";
import type { ConnectionEdge } from "../types";

// The store persists on every mutation; node env has no localStorage.
vi.stubGlobal("localStorage", {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
});

function edge(id: string, extra: Partial<ConnectionEdge["data"]> = {}): ConnectionEdge {
  return {
    id,
    source: "d1",
    target: "d2",
    sourceHandle: "p1-out",
    targetHandle: "p2-in",
    selected: true,
    data: { signalType: "sdi", ...extra },
  } as ConnectionEdge;
}

function setEdges(edges: ConnectionEdge[]) {
  useSchematicStore.setState({ nodes: [], edges });
}

function dataOf(id: string) {
  return useSchematicStore.getState().edges.find((e) => e.id === id)!.data!;
}

describe("runAsSingleUndoStep — bulk connection edits", () => {
  beforeEach(() => {
    setEdges([edge("e1"), edge("e2"), edge("e3")]);
  });

  it("collapses N per-edge actions into one undo entry", () => {
    const store = useSchematicStore.getState();
    const before = useSchematicStore.getState().undoSize;

    store.runAsSingleUndoStep(() => {
      for (const id of ["e1", "e2", "e3"]) {
        useSchematicStore.getState().patchEdgeData(id, { cableIdLabelMode: "midpoint" });
      }
    });

    expect(useSchematicStore.getState().undoSize).toBe(before + 1);
    for (const id of ["e1", "e2", "e3"]) {
      expect(dataOf(id).cableIdLabelMode).toBe("midpoint");
    }
  });

  it("restores the pre-batch state — not an intermediate one — on a single undo", () => {
    const store = useSchematicStore.getState();
    store.runAsSingleUndoStep(() => {
      for (const id of ["e1", "e2", "e3"]) {
        useSchematicStore.getState().patchEdgeData(id, { hideCableId: true });
      }
    });

    useSchematicStore.getState().undo();

    for (const id of ["e1", "e2", "e3"]) {
      expect(dataOf(id).hideCableId).toBeUndefined();
    }
  });

  it("leaves no undo entry when the wrapped actions change nothing", () => {
    const before = useSchematicStore.getState().undoSize;
    useSchematicStore.getState().runAsSingleUndoStep(() => {
      // clearManualWaypoints bails out on edges that have no manual route
      for (const id of ["e1", "e2", "e3"]) {
        useSchematicStore.getState().clearManualWaypoints(id);
      }
    });
    expect(useSchematicStore.getState().undoSize).toBe(before);
  });

  it("resets manual routes on every selected connection in one step", () => {
    setEdges([
      edge("e1", { manualWaypoints: [{ x: 10, y: 10 }] }),
      edge("e2", { manualWaypoints: [{ x: 20, y: 20 }] }),
      edge("e3"),
    ]);
    const before = useSchematicStore.getState().undoSize;

    useSchematicStore.getState().runAsSingleUndoStep(() => {
      for (const id of ["e1", "e2", "e3"]) {
        useSchematicStore.getState().clearManualWaypoints(id);
      }
    });

    expect(useSchematicStore.getState().undoSize).toBe(before + 1);
    expect(dataOf("e1").manualWaypoints).toBeUndefined();
    expect(dataOf("e2").manualWaypoints).toBeUndefined();

    useSchematicStore.getState().undo();
    expect(dataOf("e1").manualWaypoints).toEqual([{ x: 10, y: 10 }]);
    expect(dataOf("e2").manualWaypoints).toEqual([{ x: 20, y: 20 }]);
  });

  it("does not suppress undo entries for actions run after the batch", () => {
    const store = useSchematicStore.getState();
    store.runAsSingleUndoStep(() => {
      useSchematicStore.getState().patchEdgeData("e1", { hideCableId: true });
    });
    const afterBatch = useSchematicStore.getState().undoSize;

    useSchematicStore.getState().patchEdgeData("e2", { hideCableId: true });
    expect(useSchematicStore.getState().undoSize).toBe(afterBatch + 1);
  });

  it("re-enables undo pushing even when the wrapped callback throws", () => {
    const store = useSchematicStore.getState();
    expect(() =>
      store.runAsSingleUndoStep(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    const before = useSchematicStore.getState().undoSize;
    useSchematicStore.getState().patchEdgeData("e1", { hideCableId: true });
    expect(useSchematicStore.getState().undoSize).toBe(before + 1);
  });
});

describe("batchPatchEdgeData — cable ID placement", () => {
  beforeEach(() => {
    setEdges([edge("e1"), edge("e2", { cableIdLabelMode: "midpoint" })]);
  });

  it("applies one cable-ID mode across a mixed selection in one undo step", () => {
    const before = useSchematicStore.getState().undoSize;
    useSchematicStore.getState().batchPatchEdgeData([
      { edgeId: "e1", patch: { cableIdLabelMode: "endpoint" } },
      { edgeId: "e2", patch: { cableIdLabelMode: "endpoint" } },
    ]);
    expect(useSchematicStore.getState().undoSize).toBe(before + 1);
    expect(dataOf("e1").cableIdLabelMode).toBe("endpoint");
    expect(dataOf("e2").cableIdLabelMode).toBe("endpoint");
  });
});
