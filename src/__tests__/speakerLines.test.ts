/**
 * Reading amplifier lines off the schematic and binding a floorplan's line numbers to them.
 */
import { describe, it, expect } from "vitest";
import type { ConnectionEdge, DeviceData, FloorplanPage, FloorplanSymbol, Port, SchematicNode, SpeakerLoadSpec } from "../types";
import {
  amplifiersOnSchematic,
  buildLegendLineRows,
  channelShortLabel,
  compareLineNo,
  computeLineLoads,
  findChannelForSpeaker,
  legendShowsLines,
  lineForDevice,
  nextLineNo,
  planLines,
  syncLinesFromSchematic,
  wiringSignature,
  type LoadSpecLookup,
} from "../speakerLines";

const DM6: SpeakerLoadSpec = { impedanceOhm: 8, rmsPowerW: 100, tapsW: [80, 40, 20, 10, 5, 2.5], profile: "FR" };

function port(id: string, label: string, direction: Port["direction"], signalType: Port["signalType"] = "speaker-level"): Port {
  return { id, label, direction, signalType };
}

function amp(id: string, label: string, channels: number): SchematicNode {
  const ports: Port[] = [port(`${id}-in`, "Line In", "input", "analog-audio")];
  for (let i = 1; i <= channels; i++) ports.push(port(`${id}-out${i}`, `Speaker Out ${i}`, "output"));
  return { id, type: "device", position: { x: 0, y: 0 }, data: { label, deviceType: "amplifier", ports, ampLoad: { channels, ratedW: { ohm4: 300, ohm8: 300, v70: 300, v100: 300 }, totalRatedW: 300 * channels } } as DeviceData } as SchematicNode;
}

function speaker(id: string, label = id): SchematicNode {
  return {
    id, type: "device", position: { x: 0, y: 0 },
    data: { label, deviceType: "speaker", ports: [port(`${id}-in`, "Speaker In", "input"), port(`${id}-loop`, "Speaker Loop Out", "output")], speakerLoad: DM6 } as DeviceData,
  } as SchematicNode;
}

function wire(id: string, from: string, fromPort: string, to: string, toPort: string, extra: Record<string, unknown> = {}): ConnectionEdge {
  return { id, source: from, sourceHandle: fromPort, target: to, targetHandle: toPort, data: { signalType: "speaker-level", ...extra } } as ConnectionEdge;
}

const lookup: LoadSpecLookup = {
  speakerSpecFor: (n) => (n.data as DeviceData).speakerLoad,
  ampSpecFor: (n) => (n.data as DeviceData).ampLoad,
};

/** Amp A: CH1 → s1 → s2 (loop) → s3; CH2 → s4; CH3/CH4 empty. Amp B: CH1 → s5. */
const nodes: SchematicNode[] = [amp("A", "PSX", 4), amp("B", "P2600", 2), speaker("s1"), speaker("s2"), speaker("s3"), speaker("s4"), speaker("s5"), speaker("s6")];
const edges: ConnectionEdge[] = [
  wire("e1", "A", "A-out1", "s1", "s1-in"),
  wire("e2", "s1", "s1-loop", "s2", "s2-in"),
  wire("e3", "s2", "s2-loop", "s3", "s3-in"),
  wire("e4", "A", "A-out2", "s4", "s4-in"),
  wire("e5", "B", "B-out1", "s5", "s5-in"),
];

describe("amplifiersOnSchematic", () => {
  it("lists every amplifier channel with the speakers reached over loop-through", () => {
    const amps = amplifiersOnSchematic(nodes, edges);
    expect(amps.map((a) => a.nodeId)).toEqual(["A", "B"]);
    const a = amps[0];
    expect(a.channels).toHaveLength(4);
    expect(a.channels[0].speakerNodeIds).toEqual(["s1", "s2", "s3"]);
    expect(a.channels[0].channelIndex).toBe(1);
    expect(a.channels[1].speakerNodeIds).toEqual(["s4"]);
    expect(a.channels[2].speakerNodeIds).toEqual([]);
    expect(amps[1].channels[0].speakerNodeIds).toEqual(["s5"]);
    expect(findChannelForSpeaker(amps, "s3")?.portId).toBe("A-out1");
    expect(findChannelForSpeaker(amps, "s6")).toBeUndefined();
  });

  it("ignores wires that are not speaker-level and follows a wire drawn from the speaker's side", () => {
    const reversed = [wire("r1", "s1", "s1-in", "A", "A-out1"), wire("x", "A", "A-in", "s2", "s2-in", { signalType: "analog-audio" })];
    const amps = amplifiersOnSchematic(nodes, reversed);
    expect(amps[0].channels[0].speakerNodeIds).toEqual(["s1"]);
  });

  it("merges the two legs of a stub-split connection", () => {
    const stub: SchematicNode = { id: "stub", type: "stub-label", position: { x: 0, y: 0 }, data: {} } as unknown as SchematicNode;
    const legs = [
      wire("l1", "A", "A-out3", "stub", null as unknown as string, { linkedConnectionId: "c9" }),
      wire("l2", "stub", null as unknown as string, "s6", "s6-in", { linkedConnectionId: "c9" }),
    ];
    const amps = amplifiersOnSchematic([...nodes, stub], legs);
    expect(amps[0].channels[2].speakerNodeIds).toEqual(["s6"]);
  });

  it("does not wander from a speaker into another amplifier or count a speaker twice", () => {
    const loopBack = [...edges, wire("e6", "s3", "s3-loop", "s1", "s1-in")];
    const amps = amplifiersOnSchematic(nodes, loopBack);
    expect(amps[0].channels[0].speakerNodeIds).toEqual(["s1", "s2", "s3"]);
  });

  it("channelShortLabel shortens indexed port names", () => {
    expect(channelShortLabel({ portLabel: "Speaker Out 3", channelIndex: 3 })).toBe("CH 3");
    expect(channelShortLabel({ portLabel: "Out CH 1/2", channelIndex: 1 })).toBe("CH 1/2");
    expect(channelShortLabel({ portLabel: "Zone A", channelIndex: 1 })).toBe("Zone A");
  });
});

describe("plan lines", () => {
  it("orders numerically first, then text, and finds the next free number", () => {
    expect(["SB", "10", "2", "1"].sort(compareLineNo)).toEqual(["1", "2", "10", "SB"]);
    expect(nextLineNo(["1", "2", "SB"])).toBe("3");
    expect(nextLineNo(["2"])).toBe("1");
    expect(nextLineNo([])).toBe("1");
  });

  it("planLines merges the registry with lines implied by symbols", () => {
    const page = {
      lines: [{ lineNo: "2", ampNodeId: "A", ampPortId: "A-out2" }],
      symbols: [{ lineNo: "1" }, { lineNo: "1" }, { lineNo: "SB" }] as FloorplanSymbol[],
    };
    expect(planLines(page).map((l) => l.lineNo)).toEqual(["1", "2", "SB"]);
    expect(planLines(page)[1].ampPortId).toBe("A-out2");
  });
});

function pageWith(symbols: Partial<FloorplanSymbol>[], lines?: FloorplanPage["lines"]): Pick<FloorplanPage, "lines" | "symbols" | "kind" | "labelTemplate" | "groups" | "legend"> {
  return {
    kind: "loudspeaker",
    labelTemplate: undefined,
    groups: [{ id: "g1", label: "LS", color: "#f00", shape: "circle" }],
    legend: { visible: true, title: "L", positionMm: { x: 0, y: 0 }, widthMm: 100, showImages: false, onlyUsedGroups: false },
    lines,
    symbols: symbols.map((s, i) => ({ id: `sym-${i}`, groupId: "g1", positionMm: { x: 0, y: 0 }, label: s.label ?? String(i + 1), ...s })),
  };
}

describe("syncLinesFromSchematic", () => {
  it("creates a line per wired channel in amp/channel order and moves placed symbols onto them", () => {
    const page = pageWith([
      { deviceNodeId: "s4", lineNo: "7", seq: 1, label: "7.1" },
      { deviceNodeId: "s1" },
      { deviceNodeId: "s3" },
      { deviceNodeId: "s6", lineNo: "9", seq: 1, label: "9.1" }, // unwired: untouched
    ]);
    const res = syncLinesFromSchematic(page, nodes, edges, lookup);
    // A/CH1 → 1, A/CH2 → 2, B/CH1 → 3 (CH3/4 of A have no speakers → no line)
    expect(res.lines.filter((l) => l.ampNodeId).map((l) => [l.lineNo, l.ampNodeId, l.ampPortId])).toEqual([
      ["1", "A", "A-out1"], ["2", "A", "A-out2"], ["3", "B", "B-out1"],
    ]);
    expect(res.addedLineNos).toEqual(["1", "2", "3"]);
    expect(res.lines.every((l) => !l.ampNodeId || l.mode === "lo-z")).toBe(true);
    const byDevice = Object.fromEntries(res.symbols.map((s) => [s.deviceNodeId, s]));
    expect(byDevice.s1.lineNo).toBe("1"); expect(byDevice.s1.seq).toBe(1); expect(byDevice.s1.label).toBe("1.1");
    expect(byDevice.s3.lineNo).toBe("1"); expect(byDevice.s3.seq).toBe(2); expect(byDevice.s3.label).toBe("1.2");
    expect(byDevice.s4.lineNo).toBe("2"); expect(byDevice.s4.label).toBe("2.1");
    expect(byDevice.s6.lineNo).toBe("9"); expect(byDevice.s6.label).toBe("9.1");
    expect(res.relabeledCount).toBe(3);
  });

  it("keeps existing bindings and numbers; a second sync is a no-op", () => {
    const page = pageWith([{ deviceNodeId: "s1" }, { deviceNodeId: "s4" }], [{ lineNo: "4", ampNodeId: "A", ampPortId: "A-out2", mode: "100v", name: "Bar" }]);
    const first = syncLinesFromSchematic(page, nodes, edges, lookup);
    const l4 = first.lines.find((l) => l.lineNo === "4");
    expect(l4).toMatchObject({ ampPortId: "A-out2", mode: "100v", name: "Bar" });
    expect(first.symbols.find((s) => s.deviceNodeId === "s4")?.label).toBe("4.1");
    expect(first.addedLineNos).toEqual(["1", "2"]); // A/CH1 and B/CH1
    const again = syncLinesFromSchematic({ ...page, lines: first.lines, symbols: first.symbols }, nodes, edges, lookup);
    expect(again.addedLineNos).toEqual([]);
    expect(again.relabeledCount).toBe(0);
    expect(again.symbols.map((s) => s.label)).toEqual(first.symbols.map((s) => s.label));
  });
});

describe("lineForDevice", () => {
  it("returns the bound line, or a new one for a wired-but-unbound channel, or nothing", () => {
    const page = pageWith([], [{ lineNo: "2", ampNodeId: "A", ampPortId: "A-out1" }]);
    expect(lineForDevice(page, "s2", nodes, edges, lookup)).toEqual({ lineNo: "2" });
    const fresh = lineForDevice(page, "s4", nodes, edges, lookup);
    expect(fresh?.lineNo).toBe("1");
    expect(fresh?.newLine).toMatchObject({ lineNo: "1", ampNodeId: "A", ampPortId: "A-out2", mode: "lo-z" });
    expect(lineForDevice(page, "s6", nodes, edges, lookup)).toBeUndefined();
  });
});

describe("computeLineLoads / legend rows", () => {
  it("reports each line with its channel, counts and load, and the amplifier totals", () => {
    const page = pageWith(
      [{ deviceNodeId: "s1", lineNo: "1", seq: 1 }, { deviceNodeId: "s2", lineNo: "1", seq: 2 }, { lineNo: "SB", seq: 1 }],
      [{ lineNo: "1", ampNodeId: "A", ampPortId: "A-out1", name: "Gastro" }],
    );
    const report = computeLineLoads(page, nodes, edges, lookup);
    expect(report.rows.map((r) => r.line.lineNo)).toEqual(["1", "SB"]);
    const l1 = report.rows[0];
    expect(l1.placedCount).toBe(2);
    expect(l1.wiredCount).toBe(3);
    expect(l1.load?.requestedW).toBe(600); // 3 × DM6 × 2
    expect(l1.load?.impedanceOhm).toBeCloseTo(8 / 3, 6);
    expect(l1.load?.status).toBe("exceeds"); // 2.67 Ω is below the amplifier's 4 Ω minimum
    expect(l1.load?.limitedBy).toBe("impedance");
    expect(l1.amp?.totalRequestedW).toBe(800); // + s4 on CH2
    expect(report.rows[1].channel).toBeUndefined();
    expect(report.rows[1].load).toBeUndefined();
    expect(report.amps.get("A")?.result.channels[2].status).toBe("empty");

    const legend = buildLegendLineRows(report);
    expect(legend).toEqual([
      { lineNo: "1", name: "Gastro", feed: "PSX · CH 1", count: 3, load: "2.7 Ω · 600 W" },
      { lineNo: "SB", name: undefined, feed: "–", count: 1, load: "–" },
    ]);
  });

  it("legendShowsLines defaults to on for loudspeaker plans with lines, and honors the switch", () => {
    const page = pageWith([{ lineNo: "1" }]);
    expect(legendShowsLines(page)).toBe(true);
    expect(legendShowsLines({ ...page, kind: "generic" })).toBe(false);
    expect(legendShowsLines({ ...page, legend: { ...page.legend, showLines: false } })).toBe(false);
    expect(legendShowsLines({ ...page, kind: "generic", legend: { ...page.legend, showLines: true } })).toBe(true);
    expect(legendShowsLines(pageWith([]))).toBe(false);
  });
});

describe("live sync (rewiring follows the schematic)", () => {
  it("moves only symbols on bound lines, creates lines just for the channels they move to, leaves hand numbering alone", () => {
    const page = pageWith(
      [
        { deviceNodeId: "s1", lineNo: "1", seq: 1, label: "1.1" },  // bound line 1 = A/CH1
        { deviceNodeId: "s4", lineNo: "1", seq: 2, label: "1.2" },  // wrongly on line 1, actually on A/CH2 → must move
        { deviceNodeId: "s5", lineNo: "7", seq: 1, label: "7.1" },  // hand-numbered (line 7 unbound) → untouched
      ],
      [{ lineNo: "1", ampNodeId: "A", ampPortId: "A-out1" }],
    );
    const res = syncLinesFromSchematic(page, nodes, edges, lookup, { live: true });
    expect(res.addedLineNos).toEqual(["2"]); // only A/CH2; B/CH1 (s5) gets no line in live mode
    expect(res.lines.find((l) => l.lineNo === "2")).toMatchObject({ ampNodeId: "A", ampPortId: "A-out2" });
    const byDevice = Object.fromEntries(res.symbols.map((s) => [s.deviceNodeId, s]));
    expect(byDevice.s4).toMatchObject({ lineNo: "2", seq: 1, label: "2.1" });
    expect(byDevice.s1).toMatchObject({ lineNo: "1", seq: 1, label: "1.1" });
    expect(byDevice.s5).toMatchObject({ lineNo: "7", seq: 1, label: "7.1" });
    expect(res.relabeledCount).toBe(1);
  });

  it("is a no-op when the wiring matches, and wiringSignature ignores node positions", () => {
    const page = pageWith([{ deviceNodeId: "s1", lineNo: "1", seq: 1, label: "1.1" }], [{ lineNo: "1", ampNodeId: "A", ampPortId: "A-out1" }]);
    const res = syncLinesFromSchematic(page, nodes, edges, lookup, { live: true });
    expect(res.relabeledCount).toBe(0);
    expect(res.addedLineNos).toEqual([]);
    const moved = nodes.map((n) => ({ ...n, position: { x: 99, y: 99 } })) as SchematicNode[];
    expect(wiringSignature(moved, edges)).toBe(wiringSignature(nodes, edges));
    const rewired = edges.map((e) => (e.id === "e4" ? { ...e, sourceHandle: "A-out3" } : e)) as ConnectionEdge[];
    expect(wiringSignature(nodes, rewired)).not.toBe(wiringSignature(nodes, edges));
  });
});

describe("robustness", () => {
  it("tolerates device nodes without a ports array and ports without labels", () => {
    const bare = { id: "x", type: "device", position: { x: 0, y: 0 }, data: { label: "X", deviceType: "amplifier" } } as unknown as SchematicNode;
    const odd = { ...amp("C", "C", 1), data: { ...(amp("C", "C", 1).data as DeviceData), ports: [{ id: "C-out1", direction: "output", signalType: "speaker-level" }] } } as unknown as SchematicNode;
    expect(() => wiringSignature([...nodes, bare, odd], edges)).not.toThrow();
    expect(() => amplifiersOnSchematic([...nodes, bare, odd], edges)).not.toThrow();
    expect(channelShortLabel({ portLabel: undefined as unknown as string, channelIndex: 2 })).toBe("CH 2");
  });
});
