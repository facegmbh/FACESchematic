/**
 * Handler-level tests for the Ship-10 floorplan MCP tools. The bridge handlers own the
 * metres → paper-mm conversion, the per-item batch semantics and the input validation;
 * the store actions underneath are exercised through them. Same in-memory localStorage
 * bootstrap as mcpEditing.test.ts.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { DeviceData, FloorplanPage, SchematicNode } from "../types";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}

let useSchematicStore: typeof import("../store")["useSchematicStore"];
let handlers: typeof import("../mcpBridge")["handlers"];

beforeAll(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
  ({ useSchematicStore } = await import("../store"));
  ({ handlers } = await import("../mcpBridge"));
});

function device(id: string): SchematicNode {
  return {
    id,
    type: "device",
    position: { x: 0, y: 0 },
    data: { label: `Speaker ${id}`, deviceType: "speaker", ports: [] } as DeviceData,
  } as SchematicNode;
}

function floorplans(): FloorplanPage[] {
  return useSchematicStore.getState().pages.filter((p): p is FloorplanPage => p.type === "floorplan");
}

// Only the shape we assert on — keeps the casts below readable.
type Summary = {
  pageId: string; label: string; scaleDenominator: number; scale: string;
  coversM: { width: number; height: number };
  underlay: { present: boolean; calibrated?: boolean };
  groups: { groupId: string; label: string; color: string; shape: string; symbolCount: number }[];
  symbols: { symbolId: string; label: string; deviceId?: string; deviceLabel: string | null; xM: number; yM: number }[];
  legend: { title: string; notes: string[]; notesTitle?: string };
  drawingBlock: { title: string; fields: { label: string; value: string; wide: boolean }[]; revisions: { index: string; date: string; description: string }[]; revisionHeaders: string[] };
  notes: { noteId: string; text: string; xM: number; yM: number }[];
};

beforeEach(() => {
  useSchematicStore.setState({ nodes: [device("device-1"), device("device-2")], edges: [], pages: [] });
});

describe("create_floorplan / list_floorplans / update_floorplan", () => {
  it("creates an A1 landscape 1:50 page by default and reports the real-world extent", () => {
    const res = handlers.create_floorplan({ label: "Erdgeschoss" }) as Summary;
    expect(res.label).toBe("Erdgeschoss");
    expect(res.scale).toBe("1:50");
    expect(res.underlay.present).toBe(false);
    // A1 landscape drawing area ≈ 820.7 × 573.8 mm → ×50 → ~41 × 28.7 m
    expect(res.coversM.width).toBeCloseTo(41.0, 0);
    expect(res.coversM.height).toBeCloseTo(28.7, 0);
    expect(floorplans()).toHaveLength(1);
    const list = handlers.list_floorplans({}) as { pageCount: number; pages: Summary[] };
    expect(list.pageCount).toBe(1);
    expect(list.pages[0].pageId).toBe(res.pageId);
  });

  it("honors paper, orientation and scale on create and rejects nonsense", () => {
    const res = handlers.create_floorplan({ paperId: "iso-a3", orientation: "portrait", scaleDenominator: 100 }) as Summary;
    expect(res.scaleDenominator).toBe(100);
    expect(floorplans()[0].paperId).toBe("iso-a3");
    expect(floorplans()[0].orientation).toBe("portrait");
    expect(() => handlers.create_floorplan({ paperId: "napkin" })).toThrow(/paperId must be one of/);
    expect(() => handlers.create_floorplan({ scaleDenominator: 0 })).toThrow(/scaleDenominator/);
    expect(() => handlers.create_floorplan({ scaleDenominator: 2.5 })).toThrow(/whole number/);
  });

  it("update_floorplan renames and rescales", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const res = handlers.update_floorplan({ pageId, label: "1. OG", scaleDenominator: 100 }) as Summary;
    expect(res.label).toBe("1. OG");
    expect(res.scaleDenominator).toBe(100);
    expect(() => handlers.update_floorplan({ pageId: "nope" })).toThrow(/No floorplan page/);
  });
});

describe("symbol groups and symbols", () => {
  it("adds a group with validated color/shape and places numbered symbols at metre positions", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const g = handlers.add_floorplan_group({
      pageId, label: "LS Gastro", color: "#E11D1D", shape: "circle",
      description: "Bose DM6SE schwarz | Kabel: 2x2,5 mm²", labelPrefix: "1.1",
    }) as { groupId: string; color: string; shape: string };
    expect(g.color).toBe("#e11d1d");
    expect(g.shape).toBe("circle");

    const res = handlers.place_floorplan_symbols({
      pageId,
      symbols: [
        { groupId: g.groupId, deviceId: "device-1", xM: 5, yM: 3 },
        { groupId: g.groupId, deviceId: "device-2", xM: 8.5, yM: 3 },
        { groupId: g.groupId, xM: 12, yM: 6, label: "2.1" },
        { groupId: g.groupId, xM: 14, yM: 6 },
      ],
    }) as { succeeded: number; failed: number; results: { ok: boolean; result?: { symbolId: string; label: string } }[] };
    expect(res.succeeded).toBe(4);
    expect(res.results.map((r) => r.result?.label)).toEqual(["1.1", "1.2", "2.1", "2.2"]);

    const page = floorplans()[0];
    // 5 m at 1:50 = 100 mm on paper, measured from the drawing area's corner (10.16 mm margin)
    expect(page.symbols[0].positionMm.x).toBeCloseTo(10.16 + 100, 1);
    expect(page.symbols[0].positionMm.y).toBeCloseTo(10.16 + 60, 1);
    expect(page.symbols[0].deviceNodeId).toBe("device-1");

    const list = handlers.list_floorplans({}) as { pages: Summary[] };
    const s0 = list.pages[0].symbols[0];
    expect(s0.xM).toBeCloseTo(5);
    expect(s0.yM).toBeCloseTo(3);
    expect(s0.deviceLabel).toBe("Speaker device-1");
    expect(list.pages[0].groups[0].symbolCount).toBe(4);
  });

  it("rejects per item without aborting the batch: bad group, unknown device, off-sheet, millimetre typo", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "Subs" }) as { groupId: string };
    const res = handlers.place_floorplan_symbols({
      pageId,
      symbols: [
        { groupId: "fpgroup-nope", xM: 1, yM: 1 },
        { groupId: g.groupId, deviceId: "device-99", xM: 1, yM: 1 },
        { groupId: g.groupId, xM: 60, yM: 1 }, // A1 landscape at 1:50 covers ~41 m
        { groupId: g.groupId, xM: 5000, yM: 1 },
        { groupId: g.groupId, xM: 2, yM: 2 },
      ],
    }) as { succeeded: number; failed: number; results: { ok: boolean; error?: string }[] };
    expect(res.succeeded).toBe(1);
    expect(res.failed).toBe(4);
    expect(res.results[0].error).toMatch(/No symbol group/);
    expect(res.results[1].error).toMatch(/No device found/);
    expect(res.results[2].error).toMatch(/off the sheet/);
    expect(res.results[3].error).toMatch(/millimetres/);
    expect(floorplans()[0].symbols).toHaveLength(1);
  });

  it("rejects an invalid color, shape or empty label on a group", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    expect(() => handlers.add_floorplan_group({ pageId, label: "X", color: "red" })).toThrow(/hex color/);
    expect(() => handlers.add_floorplan_group({ pageId, label: "X", shape: "star" })).toThrow(/shape must be one of/);
    expect(() => handlers.add_floorplan_group({ pageId, label: "  " })).toThrow(/label is required/);
  });

  it("update_floorplan_symbol moves, renumbers and unlinks; remove_floorplan_symbol deletes", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS" }) as { groupId: string };
    const placed = handlers.place_floorplan_symbols({ pageId, symbols: [{ groupId: g.groupId, deviceId: "device-1", xM: 1, yM: 1 }] }) as { results: { result: { symbolId: string } }[] };
    const symbolId = placed.results[0].result.symbolId;
    const upd = handlers.update_floorplan_symbol({ pageId, symbolId, xM: 4, label: "7.3", deviceId: null }) as { xM: number; yM: number; label: string; deviceId?: string };
    expect(upd.xM).toBeCloseTo(4);
    expect(upd.yM).toBeCloseTo(1); // untouched axis keeps its value
    expect(upd.label).toBe("7.3");
    expect(upd.deviceId).toBeUndefined();
    expect(() => handlers.update_floorplan_symbol({ pageId, symbolId })).toThrow(/Nothing to update/);
    handlers.remove_floorplan_symbol({ pageId, symbolId });
    expect(floorplans()[0].symbols).toHaveLength(0);
    expect(() => handlers.remove_floorplan_symbol({ pageId, symbolId })).toThrow(/No symbol/);
  });

  it("update_floorplan_group changes only what is passed", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS", description: "keep me" }) as { groupId: string };
    const res = handlers.update_floorplan_group({ pageId, groupId: g.groupId, color: "#0f0" }) as { color: string; description?: string };
    expect(res.color).toBe("#00ff00");
    expect(res.description).toBe("keep me");
    expect(() => handlers.update_floorplan_group({ pageId, groupId: g.groupId })).toThrow(/Nothing to update/);
  });
});

describe("legend, drawing block, revisions, notes", () => {
  it("set_floorplan_legend fills headline and installation notes", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const res = handlers.set_floorplan_legend({
      pageId, title: "BESCHALLUNG – LEGENDE & MONTAGE", notesTitle: "MONTAGEHINWEISE",
      notes: ["DM6SE: Montage an der Decke.", "MB210: Decke verstärken."],
    }) as Summary["legend"];
    expect(res.title).toBe("BESCHALLUNG – LEGENDE & MONTAGE");
    expect(res.notesTitle).toBe("MONTAGEHINWEISE");
    expect(res.notes).toHaveLength(2);
    expect(() => handlers.set_floorplan_legend({ pageId, notes: "not a list" })).toThrow(/array of strings/);
    expect(() => handlers.set_floorplan_legend({ pageId })).toThrow(/Nothing to update/);
  });

  it("set_floorplan_drawing_block replaces fields and revisions, with auto index/date", () => {
    const { pageId } = handlers.create_floorplan({ label: "Erdgeschoss" }) as Summary;
    const res = handlers.set_floorplan_drawing_block({
      pageId,
      title: "{{pageLabel}}",
      subtitle: "Lautsprecherplanung Gastraum EG",
      fields: [
        { label: "Bauvorhaben", value: "Cafe & Bar Celona Osnabrück", wide: true },
        { label: "Maßstab", value: "{{scale}}" },
        { label: "Blattgröße", value: "{{sheetSize}}" },
      ],
      revisionHeaders: ["Index", "Datum", "Änderungen", "Bearb.", "Gepr."],
      revisions: [{ description: "Lautsprecher Planung Gastraum EG", author: "SP" }, { description: "Subwoofer ergänzt" }],
      disclaimer: "Sämtliche Maße sind am Bau zu prüfen.",
    }) as Summary["drawingBlock"];
    expect(res.title).toBe("{{pageLabel}}");
    expect(res.fields.map((f) => f.label)).toEqual(["Bauvorhaben", "Maßstab", "Blattgröße"]);
    expect(res.fields[0].wide).toBe(true);
    expect(res.revisions.map((r) => r.index)).toEqual(["A", "B"]);
    expect(res.revisions[0].date).toMatch(/^\d\d\.\d\d\.\d\d$/);
    expect(res.revisionHeaders[2]).toBe("Änderungen");
    expect(() => handlers.set_floorplan_drawing_block({ pageId, revisionHeaders: ["a", "b"] })).toThrow(/five strings/);
    expect(() => handlers.set_floorplan_drawing_block({ pageId, fields: [{ label: "", value: "x" }] })).toThrow(/fields\[0\]\.label/);
  });

  it("add_floorplan_revision appends and continues the index sequence", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    handlers.add_floorplan_revision({ pageId, description: "First issue", date: "01.09.26" });
    const res = handlers.add_floorplan_revision({ pageId, description: "Speakers moved" }) as { revision: { index: string; date: string }; revisionCount: number };
    expect(res.revision.index).toBe("B");
    expect(res.revisionCount).toBe(2);
    expect(floorplans()[0].drawingBlock.revisions[0].date).toBe("01.09.26");
    expect(() => handlers.add_floorplan_revision({ pageId, description: "" })).toThrow(/description is required/);
  });

  it("notes: add in batch at metre positions, update, delete", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const res = handlers.add_floorplan_notes({
      pageId,
      notes: [
        { text: "Automatiktür schließen", xM: 10, yM: 4 },
        { text: "Decke verstärken 1,2 × 0,6 m", xM: 12, yM: 8, widthMm: 40, fontSizeMm: 2.5, boxed: false, color: "#c00" },
        { text: "", xM: 1, yM: 1 },
      ],
    }) as { succeeded: number; failed: number; results: { ok: boolean; result?: { noteId: string }; error?: string }[] };
    expect(res.succeeded).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.results[2].error).toMatch(/text is required/);
    const page = floorplans()[0];
    expect(page.notes).toHaveLength(2);
    expect(page.notes[0].boxed).toBe(true);
    expect(page.notes[1]).toMatchObject({ widthMm: 40, fontSizeMm: 2.5, boxed: false, color: "#cc0000" });
    expect(page.notes[0].positionMm.x).toBeCloseTo(10.16 + 200, 1);

    const noteId = res.results[0].result!.noteId;
    const upd = handlers.update_floorplan_note({ pageId, noteId, text: "Tür schließen", yM: 5 }) as { text: string; xM: number; yM: number };
    expect(upd.text).toBe("Tür schließen");
    expect(upd.xM).toBeCloseTo(10);
    expect(upd.yM).toBeCloseTo(5);
    expect(() => handlers.update_floorplan_note({ pageId, noteId, widthMm: 3 })).toThrow(/widthMm/);

    handlers.delete_floorplan_note({ pageId, noteId });
    expect(floorplans()[0].notes).toHaveLength(1);
    expect(() => handlers.delete_floorplan_note({ pageId, noteId })).toThrow(/No note/);

    const list = handlers.list_floorplans({}) as { pages: Summary[] };
    expect(list.pages[0].notes[0].text).toBe("Decke verstärken 1,2 × 0,6 m");
    expect(list.pages[0].notes[0].xM).toBeCloseTo(12);
  });
});

describe("images and covers", () => {
  it("accepts an https image reference on a group and rejects other schemes", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS", imageUrl: "https://img.example/dm6se.png" }) as { groupId: string };
    expect(floorplans()[0].groups[0].imageUrl).toBe("https://img.example/dm6se.png");
    expect(() => handlers.update_floorplan_group({ pageId, groupId: g.groupId, imageUrl: "ftp://nope" })).toThrow(/https URL/);
    handlers.update_floorplan_group({ pageId, groupId: g.groupId, imageUrl: "" });
    expect(floorplans()[0].groups[0].imageUrl).toBeUndefined();
    const list = handlers.list_floorplans({}) as { pages: { groups: { hasUploadedImage: boolean }[] }[] };
    expect(list.pages[0].groups[0].hasUploadedImage).toBe(false);
  });

  it("set_floorplan_masks replaces the covers in paper mm and rejects off-sheet rects", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const res = handlers.set_floorplan_masks({ pageId, masks: [{ xMm: 600, yMm: 300, wMm: 150, hMm: 120 }, { xMm: 10, yMm: 10, wMm: 20, hMm: 20 }] }) as { maskCount: number };
    expect(res.maskCount).toBe(2);
    expect(floorplans()[0].masks).toHaveLength(2);
    expect(floorplans()[0].masks[0]).toMatchObject({ positionMm: { x: 600, y: 300 }, sizeMm: { w: 150, h: 120 } });
    // A1 landscape is 841 × 594 mm
    expect(() => handlers.set_floorplan_masks({ pageId, masks: [{ xMm: 800, yMm: 10, wMm: 100, hMm: 10 }] })).toThrow(/off the sheet/);
    expect(() => handlers.set_floorplan_masks({ pageId, masks: [{ xMm: 0, yMm: 0, wMm: 0, hMm: 10 }] })).toThrow(/positive/);
    handlers.set_floorplan_masks({ pageId, masks: [] });
    expect(floorplans()[0].masks).toHaveLength(0);
    const list = handlers.list_floorplans({}) as { pages: { masks: unknown[] }[] };
    expect(list.pages[0].masks).toEqual([]);
  });
});
