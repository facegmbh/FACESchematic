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

describe("legend text from the library", () => {
  it("a group bound to a template inherits model, install cable and install note", () => {
    useSchematicStore.setState({
      customTemplates: [{
        id: "tpl-dm6se", deviceType: "speaker", label: "Bose DM6SE", manufacturer: "Bose Professional", modelNumber: "DesignMax DM6SE",
        installCable: "Kabel aus Decke: 2x2,5 mm²", installNotes: "Montage an der Decke; Kabel 5 cm von der Wand.", ports: [],
      }],
    });
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS Gastro", templateId: "tpl-dm6se" }) as { description?: string; installNoteAdded: string | null };
    expect(g.description).toBe("Bose Professional DesignMax DM6SE | Kabel aus Decke: 2x2,5 mm²");
    expect(g.installNoteAdded).toBe("DesignMax DM6SE: Montage an der Decke; Kabel 5 cm von der Wand.");
    expect(floorplans()[0].legend.notes).toEqual(["DesignMax DM6SE: Montage an der Decke; Kabel 5 cm von der Wand."]);
    expect(floorplans()[0].groups[0].imageCaption).toBe("DesignMax DM6SE");
    // A second group of the same model does not duplicate the note; an explicit description wins.
    const g2 = handlers.add_floorplan_group({ pageId, label: "LS Bar", templateId: "tpl-dm6se", description: "own text" }) as { description?: string };
    expect(g2.description).toBe("own text");
    expect(floorplans()[0].legend.notes).toHaveLength(1);
    useSchematicStore.setState({ customTemplates: [] });
  });
});

describe("groups from a library model", () => {
  it("inherits symbol, legend line and install note from the template", () => {
    useSchematicStore.setState({
      customTemplates: [{
        id: "tpl-dm6se", deviceType: "speaker", label: "Bose DM6SE", manufacturer: "Bose", modelNumber: "DM6SE", ports: [],
        installCable: "Kabel aus Decke: 2x2,5 mm²", installNotes: "Montage an der Decke.",
        planSymbol: { shape: "circle", color: "#e11d1d", glyph: "L" },
      }],
    });
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS Gastro", templateId: "tpl-dm6se" }) as { shape: string; color: string; description: string; installNoteAdded: string | null };
    expect(g.shape).toBe("circle");
    expect(g.color).toBe("#e11d1d");
    expect(g.description).toBe("Bose DM6SE | Kabel aus Decke: 2x2,5 mm²");
    expect(g.installNoteAdded).toBe("DM6SE: Montage an der Decke.");
    const page = floorplans()[0];
    expect(page.groups[0].glyph).toBe("L");
    expect(page.legend.notes).toContain("DM6SE: Montage an der Decke.");
    // Explicit choices still win
    const g2 = handlers.add_floorplan_group({ pageId, label: "Other", templateId: "tpl-dm6se", shape: "diamond", glyph: "X" }) as { shape: string };
    expect(g2.shape).toBe("diamond");
    expect(floorplans()[0].groups[1].glyph).toBe("X");
    useSchematicStore.setState({ customTemplates: [] });
  });
});

describe("loudspeaker plans: lines and label placement", () => {
  it("numbers per amplifier line on a loudspeaker plan and applies the preset", () => {
    const res = handlers.create_floorplan({ label: "EG", kind: "loudspeaker" }) as Summary & { kind: string; labelTemplate: string };
    expect(res.kind).toBe("loudspeaker");
    expect(res.labelTemplate).toBe("{{line}}.{{n}}");
    expect(res.legend.title).toBe("BESCHALLUNG - LEGENDE & MONTAGE");
    expect(res.drawingBlock.revisionHeaders[2]).toBe("ÄNDERUNGEN");
    expect(res.drawingBlock.fields[0].label).toBe("Bauvorhaben");
    const g = handlers.add_floorplan_group({ pageId: res.pageId, label: "LS" }) as { groupId: string };
    const placed = handlers.place_floorplan_symbols({
      pageId: res.pageId,
      symbols: [
        { groupId: g.groupId, lineNo: "4", xM: 1, yM: 1 },
        { groupId: g.groupId, lineNo: "4", xM: 2, yM: 1, labelPosition: "w", labelRotationDeg: 90 },
        { groupId: g.groupId, lineNo: "SB", xM: 3, yM: 1 },
        { groupId: g.groupId, lineNo: "4", xM: 4, yM: 1 },
      ],
    }) as { results: { result: { label: string; lineNo?: string; seq?: number } }[] };
    expect(placed.results.map((r) => r.result.label)).toEqual(["4.1", "4.2", "SB.1", "4.3"]);
    const page = floorplans()[0];
    expect(page.symbols[1].labelAlign).toBe("end");
    expect(page.symbols[1].labelOffsetMm!.x).toBeLessThan(0);
    expect(page.symbols[1].labelRotationDeg).toBe(90);

    // Moving a speaker to another line rebuilds its label; explicit labels still win.
    const upd = handlers.update_floorplan_symbol({ pageId: res.pageId, symbolId: page.symbols[3].id, lineNo: "5" }) as { label: string; lineNo?: string; seq?: number };
    expect(upd.label).toBe("5.3"); // seq kept until renumbered
    expect(() => handlers.place_floorplan_symbols({ pageId: res.pageId, symbols: [{ groupId: g.groupId, xM: 1, yM: 2, labelPosition: "up" }] })).not.toThrow();
    const bad = handlers.place_floorplan_symbols({ pageId: res.pageId, symbols: [{ groupId: g.groupId, xM: 1, yM: 2, labelPosition: "up" }] }) as { failed: number; results: { error?: string }[] };
    expect(bad.failed).toBe(1);
    expect(bad.results[0].error).toMatch(/labelPosition/);
  });

  it("update_floorplan switches kind and template", () => {
    const { pageId } = handlers.create_floorplan({}) as Summary;
    const res = handlers.update_floorplan({ pageId, kind: "loudspeaker", labelTemplate: "L{{line}}-{{n}}" }) as Summary & { kind: string; labelTemplate: string };
    expect(res.kind).toBe("loudspeaker");
    expect(res.labelTemplate).toBe("L{{line}}-{{n}}");
    expect(() => handlers.update_floorplan({ pageId, kind: "wiring" })).toThrow(/kind must be/);
  });
});

describe("amplifier lines & load (Ship 11)", () => {
  const DM6 = { impedanceOhm: 8, rmsPowerW: 100, tapsW: [80, 40, 20, 10, 5, 2.5], profile: "FR" as const };
  const PSX = { channels: 4, ratedW: { ohm2: 1500, ohm4: 1200, ohm8: 1300, v70: 2100, v100: 2200 }, totalRatedW: 4800, maxBurstPerChannelW: 2200, maxBurstTotalW: 6000, maxAvgTotalW: 840, peakVoltageV: 139, peakCurrentA: 45, minImpedanceOhm: 2 };
  type Port = { id: string; label: string; direction: "input" | "output"; signalType: string };
  const spk = (id: string): SchematicNode => ({
    id, type: "device", position: { x: 0, y: 0 },
    data: {
      label: `LS ${id}`, deviceType: "speaker", speakerLoad: DM6,
      ports: [{ id: `${id}-in`, label: "Speaker In", direction: "input", signalType: "speaker-level" }, { id: `${id}-loop`, label: "Speaker Loop Out", direction: "output", signalType: "speaker-level" }] as Port[],
    } as unknown as DeviceData,
  } as SchematicNode);
  const ampNode: SchematicNode = {
    id: "amp-1", type: "device", position: { x: 0, y: 0 },
    data: { label: "PSX4804D", deviceType: "amplifier", ampLoad: PSX, ports: [1, 2, 3, 4].map((i) => ({ id: `amp-out${i}`, label: `Speaker Out ${i}`, direction: "output", signalType: "speaker-level" })) as Port[] } as unknown as DeviceData,
  } as SchematicNode;
  const wire = (id: string, s: string, sh: string, t: string, th: string) => ({ id, source: s, sourceHandle: sh, target: t, targetHandle: th, data: { signalType: "speaker-level" } });

  type LineRow = { lineNo: string; ampDeviceId?: string; ampPortLabel?: string; channel?: string; mode?: string; placedCount: number; wiredCount: number; load?: { requestedW: number; impedanceOhm?: number; status: string; headroomDb?: number; limitedBy?: string }; amplifierHasLoadData: boolean };
  type LinesResult = { lines: LineRow[]; amplifiers: { deviceId: string; status: string; totalRequestedW: number; channels: { channel: string; speakerCount: number; status: string }[] }[] };

  beforeEach(() => {
    useSchematicStore.setState({
      nodes: [ampNode, spk("s1"), spk("s2"), spk("s3"), spk("s4")],
      edges: [wire("e1", "amp-1", "amp-out1", "s1", "s1-in"), wire("e2", "s1", "s1-loop", "s2", "s2-in"), wire("e3", "amp-1", "amp-out3", "s3", "s3-in")] as unknown as typeof useSchematicStore extends never ? never : ReturnType<typeof useSchematicStore.getState>["edges"],
      pages: [],
    });
  });

  it("a speaker dropped on a loudspeaker plan lands on its amplifier channel's line automatically", () => {
    const { pageId } = handlers.create_floorplan({ kind: "loudspeaker" }) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS" }) as { groupId: string };
    const res = handlers.place_floorplan_symbols({ pageId, symbols: [
      { groupId: g.groupId, deviceId: "s3", xM: 1, yM: 1 }, // CH3 → line 1 (first wired channel used)
      { groupId: g.groupId, deviceId: "s1", xM: 2, yM: 1 }, // CH1 → line 2
      { groupId: g.groupId, deviceId: "s2", xM: 3, yM: 1 }, // CH1 → line 2 again
      { groupId: g.groupId, deviceId: "s4", xM: 4, yM: 1 }, // unwired → no line
    ] }) as { results: { result?: { label?: string; lineNo?: string } }[] };
    expect(res.results.map((r) => r.result?.label)).toEqual(["1.1", "2.1", "2.2", "1"]);
    const page = floorplans()[0];
    expect(page.lines?.map((l) => [l.lineNo, l.ampPortId, l.mode])).toEqual([["1", "amp-out3", "lo-z"], ["2", "amp-out1", "lo-z"]]);
    const list = handlers.list_floorplans({}) as { pages: (Summary & { lines: { lineNo: string; ampDeviceId?: string }[] })[] };
    expect(list.pages[0].lines).toHaveLength(2);
    expect(list.pages[0].lines[0].ampDeviceId).toBe("amp-1");
  });

  it("list_floorplan_lines reports channel, counts and the load verdict; sync binds the rest", () => {
    const { pageId } = handlers.create_floorplan({ kind: "loudspeaker" }) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS" }) as { groupId: string };
    // Place with an explicit line so nothing is bound yet, then sync.
    handlers.place_floorplan_symbols({ pageId, symbols: [{ groupId: g.groupId, deviceId: "s1", xM: 1, yM: 1, lineNo: "7" }, { groupId: g.groupId, deviceId: "s2", xM: 2, yM: 1, lineNo: "7" }] });
    const before = handlers.list_floorplan_lines({ pageId }) as LinesResult;
    expect(before.lines).toEqual([expect.objectContaining({ lineNo: "7", placedCount: 2, wiredCount: 0, load: undefined })]);
    expect(before.amplifiers[0].channels.map((c) => c.speakerCount)).toEqual([2, 0, 1, 0]);

    const sync = handlers.sync_floorplan_lines({ pageId }) as { addedLineNos: string[]; relabeledCount: number; lines: LineRow[] };
    expect(sync.addedLineNos).toEqual(["1", "2"]); // CH1, CH3
    expect(sync.relabeledCount).toBe(2);
    const after = handlers.list_floorplan_lines({ pageId }) as LinesResult;
    const l1 = after.lines.find((l) => l.lineNo === "1")!;
    expect(l1.ampPortLabel).toBe("Speaker Out 1");
    expect(l1.channel).toBe("CH 1");
    expect(l1.placedCount).toBe(2);
    expect(l1.wiredCount).toBe(2);
    expect(l1.load).toMatchObject({ requestedW: 400, impedanceOhm: 4, status: "ok" });
    expect(l1.amplifierHasLoadData).toBe(true);
    expect(after.lines.find((l) => l.lineNo === "7")).toBeUndefined(); // emptied line vanishes (it was only implied)
    expect(floorplans()[0].symbols.map((s) => s.label).sort()).toEqual(["1.1", "1.2"]);
  });

  it("update_floorplan_line wires, sets mode/tap/name, renames, and validates", () => {
    const { pageId } = handlers.create_floorplan({ kind: "loudspeaker" }) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS" }) as { groupId: string };
    handlers.place_floorplan_symbols({ pageId, symbols: [{ groupId: g.groupId, xM: 1, yM: 1, lineNo: "4" }] });
    const wired = handlers.update_floorplan_line({ pageId, lineNo: "4", ampDeviceId: "amp-1", ampPort: "Speaker Out 3", name: "Terrasse" }) as LineRow & { name?: string };
    expect(wired).toMatchObject({ lineNo: "4", ampDeviceId: "amp-1", ampPortLabel: "Speaker Out 3", name: "Terrasse", wiredCount: 1 });
    expect(wired.load?.status).toBe("ok");

    const hiZ = handlers.update_floorplan_line({ pageId, lineNo: "4", mode: "100v", tapW: 20 }) as LineRow & { tapW?: number };
    expect(hiZ.mode).toBe("100v");
    expect(hiZ.tapW).toBe(20);
    expect(hiZ.load?.requestedW).toBe(20);

    const renamed = handlers.update_floorplan_line({ pageId, lineNo: "4", newLineNo: "SB" }) as LineRow;
    expect(renamed.lineNo).toBe("SB");
    expect(floorplans()[0].symbols[0].label).toBe("SB.1");

    expect(() => handlers.update_floorplan_line({ pageId, lineNo: "9", name: "x" })).toThrow(/No line "9"/);
    expect(() => handlers.update_floorplan_line({ pageId, lineNo: "SB", ampDeviceId: "amp-1", ampPort: "Speaker Out 9" })).toThrow(/No speaker-level output/);
    expect(() => handlers.update_floorplan_line({ pageId, lineNo: "SB", ampDeviceId: "s1", ampPort: "Speaker Loop Out" })).not.toThrow(); // a speaker's loop-out is speaker-level too — allowed, the planner's call
    expect(() => handlers.update_floorplan_line({ pageId, lineNo: "SB", mode: "hi-z" })).toThrow(/mode must be/);
    expect(() => handlers.update_floorplan_line({ pageId, lineNo: "SB", tapW: -5 })).toThrow(/tapW/);
    expect(() => handlers.update_floorplan_line({ pageId, lineNo: "SB" })).toThrow(/Nothing to update/);

    const unwired = handlers.update_floorplan_line({ pageId, lineNo: "SB", ampDeviceId: null, ampPort: null }) as LineRow;
    expect(unwired.ampDeviceId).toBeUndefined();
    expect(unwired.load).toBeUndefined();
  });

  it("a channel cannot feed two lines", () => {
    const { pageId } = handlers.create_floorplan({ kind: "loudspeaker" }) as Summary;
    const g = handlers.add_floorplan_group({ pageId, label: "LS" }) as { groupId: string };
    handlers.place_floorplan_symbols({ pageId, symbols: [{ groupId: g.groupId, xM: 1, yM: 1, lineNo: "1" }, { groupId: g.groupId, xM: 2, yM: 1, lineNo: "2" }] });
    handlers.update_floorplan_line({ pageId, lineNo: "1", ampDeviceId: "amp-1", ampPort: "amp-out1" });
    expect(() => handlers.update_floorplan_line({ pageId, lineNo: "2", ampDeviceId: "amp-1", ampPort: "amp-out1" })).toThrow(/already feeds line "1"/);
  });

  it("speaker_load_report judges every amplifier on the schematic, with or without a plan", () => {
    const report = handlers.speaker_load_report({}) as { amplifierCount: number; amplifiers: { label: string; hasLoadData: boolean; status: string; totalRequestedW: number; channels: { channel: string; speakerCount: number; requestedW: number; status: string; limitedBy?: string }[] }[] };
    expect(report.amplifierCount).toBe(1);
    const a = report.amplifiers[0];
    expect(a.label).toBe("PSX4804D");
    expect(a.hasLoadData).toBe(true);
    expect(a.totalRequestedW).toBe(600); // 2 × DM6 on CH1 + 1 × DM6 on CH3, each 2 × 100 W
    expect(a.channels.map((c) => c.channel)).toEqual(["CH 1", "CH 2", "CH 3", "CH 4"]);
    expect(a.channels.map((c) => c.status)).toEqual(["ok", "empty", "ok", "empty"]);

    // A plan's line mode is honored when its pageId is passed.
    const { pageId } = handlers.create_floorplan({ kind: "loudspeaker" }) as Summary;
    handlers.sync_floorplan_lines({ pageId });
    handlers.update_floorplan_line({ pageId, lineNo: "1", mode: "70v" });
    const withPlan = handlers.speaker_load_report({ pageId }) as typeof report & { pageId: string };
    expect(withPlan.pageId).toBe(pageId);
    expect(withPlan.amplifiers[0].channels[0].requestedW).toBe(160); // 2 × 80 W tap
    expect(() => handlers.speaker_load_report({ pageId: "floorplan-999" })).toThrow(/No floorplan page/);
  });

  it("sync_floorplan_lines complains when the schematic has no amplifier", () => {
    useSchematicStore.setState({ nodes: [spk("s1")], edges: [] });
    const { pageId } = handlers.create_floorplan({ kind: "loudspeaker" }) as Summary;
    expect(() => handlers.sync_floorplan_lines({ pageId })).toThrow(/No amplifier on the schematic/);
  });

  it("set_floorplan_legend toggles the line table and its heading", () => {
    const { pageId } = handlers.create_floorplan({ kind: "loudspeaker" }) as Summary;
    const legend = handlers.set_floorplan_legend({ pageId, showLines: false, linesTitle: "LINIEN" }) as { showLines?: boolean; linesTitle?: string };
    expect(legend.showLines).toBe(false);
    expect(legend.linesTitle).toBe("LINIEN");
  });
});
