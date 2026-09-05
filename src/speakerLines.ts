/**
 * Amplifier lines: which amplifier channel feeds which loudspeakers, read off the
 * schematic, and how a floorplan's line numbers bind to those channels.
 *
 * A "channel" is a speaker-level output port of a non-speaker device (an amplifier, a
 * mixer-amp). Its speakers are every speaker reached from that port over speaker-level
 * connections, following loop-through ports ("Speaker Loop Out", "Speaker Link") from
 * speaker to speaker. Stub-split connections (two legs sharing a linkedConnectionId)
 * count as one wire, the way the cable schedule reads them.
 *
 * Pure functions, no React, no store. Load figures come from ./speakerLoad.
 */
import type {
  AmplifierLoadSpec,
  ConnectionEdge,
  DeviceData,
  FloorplanLine,
  FloorplanPage,
  FloorplanSymbol,
  Port,
  SchematicNode,
  SpeakerLoadSpec,
} from "./types";
import { effectiveLabelTemplate, formatSymbolLabel } from "./floorplan";
import {
  computeAmplifierLoad,
  defaultLineMode,
  formatChannelLoad,
  type AmplifierLoadResult,
  type ChannelLoadInput,
  type ChannelLoadResult,
} from "./speakerLoad";

// ── Schematic reading ────────────────────────────────────────────────

export interface AmplifierChannel {
  ampNodeId: string;
  ampLabel: string;
  portId: string;
  portLabel: string;
  /** 1-based position among the amplifier's speaker-level outputs. */
  channelIndex: number;
  /** Speakers wired to this channel, in wiring order from the amplifier outwards. */
  speakerNodeIds: string[];
}

export interface SchematicAmplifier {
  nodeId: string;
  label: string;
  channels: AmplifierChannel[];
}

export function isSpeakerLevelOutput(port: Port): boolean {
  return port.signalType === "speaker-level" && (port.direction === "output" || port.direction === "bidirectional");
}

export function isSpeakerDevice(data: DeviceData | undefined): boolean {
  return (data?.deviceType ?? "").toLowerCase() === "speaker";
}

/** The amplifier's channel ports: speaker-level outputs, in port order. */
export function speakerLevelOutputs(data: DeviceData): Port[] {
  return (data.ports ?? []).filter(isSpeakerLevelOutput);
}

/** A device drives lines when it is not itself a loudspeaker and has speaker-level outputs. */
export function drivesSpeakerLines(data: DeviceData | undefined): boolean {
  return Boolean(data) && !isSpeakerDevice(data) && speakerLevelOutputs(data!).length > 0;
}

function portIdFromHandle(handleId: string | null | undefined): string | undefined {
  if (!handleId) return undefined;
  return handleId.replace(/-(in|out|rear|front)$/, "");
}

interface Wire { aNode: string; aPort?: string; bNode: string; bPort?: string }

/** Logical wires: one per connection, stub legs merged. Only speaker-level wires matter here. */
function speakerWires(nodes: SchematicNode[], edges: ConnectionEdge[]): Wire[] {
  const nodeType = new Map(nodes.map((n) => [n.id, n.type] as const));
  const linkedPartner = new Map<string, ConnectionEdge>();
  for (const e of edges) {
    const link = e.data?.linkedConnectionId;
    if (!link) continue;
    const partner = edges.find((p) => p.id !== e.id && p.data?.linkedConnectionId === link);
    if (partner) linkedPartner.set(e.id, partner);
  }
  const wires: Wire[] = [];
  for (const e of edges) {
    if (e.data?.signalType !== "speaker-level") continue;
    if (e.data?.linkedConnectionId) {
      // Only the leg whose source is a real device speaks for the pair.
      if (nodeType.get(e.source) === "stub-label") continue;
      const partner = linkedPartner.get(e.id);
      const end = partner ?? e;
      if (nodeType.get(end.target) === "stub-label") continue; // dangling stub
      wires.push({ aNode: e.source, aPort: portIdFromHandle(e.sourceHandle), bNode: end.target, bPort: portIdFromHandle(end.targetHandle) });
      continue;
    }
    wires.push({ aNode: e.source, aPort: portIdFromHandle(e.sourceHandle), bNode: e.target, bPort: portIdFromHandle(e.targetHandle) });
  }
  return wires;
}

/** Every line-driving device on the schematic with the speakers on each channel. */
export function amplifiersOnSchematic(nodes: SchematicNode[], edges: ConnectionEdge[]): SchematicAmplifier[] {
  const devices = new Map<string, DeviceData>();
  for (const n of nodes) if (n.type === "device") devices.set(n.id, n.data as DeviceData);
  const wires = speakerWires(nodes, edges);

  // Adjacency per (node, port) and per node.
  const byEnd = new Map<string, { node: string; port?: string }[]>();
  const key = (node: string, port?: string) => `${node}::${port ?? ""}`;
  for (const w of wires) {
    const a = key(w.aNode, w.aPort);
    const b = key(w.bNode, w.bPort);
    (byEnd.get(a) ?? byEnd.set(a, []).get(a)!).push({ node: w.bNode, port: w.bPort });
    (byEnd.get(b) ?? byEnd.set(b, []).get(b)!).push({ node: w.aNode, port: w.aPort });
  }

  const amps: SchematicAmplifier[] = [];
  for (const [nodeId, data] of devices) {
    if (!drivesSpeakerLines(data)) continue;
    const outputs = speakerLevelOutputs(data);
    const channels = outputs.map<AmplifierChannel>((port, i) => {
      const speakers: string[] = [];
      const visited = new Set<string>([nodeId]);
      // Breadth-first from the amp port, only through speakers.
      let frontier = (byEnd.get(key(nodeId, port.id)) ?? []).slice();
      while (frontier.length) {
        const next: { node: string; port?: string }[] = [];
        for (const hop of frontier) {
          if (visited.has(hop.node)) continue;
          const d = devices.get(hop.node);
          if (!d || !isSpeakerDevice(d)) continue;
          visited.add(hop.node);
          speakers.push(hop.node);
          // Continue over every other speaker-level port of this speaker (loop / link).
          for (const p of d.ports ?? []) {
            if (p.signalType !== "speaker-level" || p.id === hop.port) continue;
            for (const n of byEnd.get(key(hop.node, p.id)) ?? []) if (!visited.has(n.node)) next.push(n);
          }
        }
        frontier = next;
      }
      return { ampNodeId: nodeId, ampLabel: data.label, portId: port.id, portLabel: port.label, channelIndex: i + 1, speakerNodeIds: speakers };
    });
    amps.push({ nodeId, label: data.label, channels });
  }
  return amps;
}

export function channelKey(ampNodeId: string, portId: string): string {
  return `${ampNodeId}::${portId}`;
}

/** The channel a speaker hangs on — the first one found when it is (wrongly) on several. */
export function findChannelForSpeaker(amps: SchematicAmplifier[], speakerNodeId: string): AmplifierChannel | undefined {
  for (const amp of amps) for (const ch of amp.channels) if (ch.speakerNodeIds.includes(speakerNodeId)) return ch;
  return undefined;
}

/** Short channel name for tables: "Speaker Out 3" → "CH 3" when the port only carries the index; else the port label. */
export function channelShortLabel(ch: Pick<AmplifierChannel, "portLabel" | "channelIndex">): string {
  const label = (ch.portLabel ?? "").trim();
  const m = /(\d+(?:\s*\/\s*\d+)?)\s*$/.exec(label);
  return m ? `CH ${m[1].replace(/\s+/g, "")}` : label || `CH ${ch.channelIndex}`;
}

// ── Plan lines ───────────────────────────────────────────────────────

/** Natural order for line numbers: numeric first ascending, then text. */
export function compareLineNo(a: string, b: string): number {
  const na = Number(a), nb = Number(b);
  const aNum = a.trim() !== "" && Number.isFinite(na);
  const bNum = b.trim() !== "" && Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  if (aNum) return -1;
  if (bNum) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Every line on the page: the registered ones plus those only implied by symbols. */
export function planLines(page: Pick<FloorplanPage, "lines" | "symbols">): FloorplanLine[] {
  const out = new Map<string, FloorplanLine>();
  for (const l of page.lines ?? []) {
    const key = l.lineNo.trim();
    if (key) out.set(key, { ...l, lineNo: key });
  }
  for (const s of page.symbols) {
    const key = (s.lineNo ?? "").trim();
    if (key && !out.has(key)) out.set(key, { lineNo: key });
  }
  return [...out.values()].sort((a, b) => compareLineNo(a.lineNo, b.lineNo));
}

export function lineForChannel(lines: FloorplanLine[] | undefined, ampNodeId: string, portId: string): FloorplanLine | undefined {
  return (lines ?? []).find((l) => l.ampNodeId === ampNodeId && l.ampPortId === portId);
}

/** Next free whole number as a line number. */
export function nextLineNo(existing: Iterable<string>): string {
  const used = new Set<number>();
  for (const l of existing) { const n = Number(l); if (Number.isInteger(n) && n > 0) used.add(n); }
  let n = 1;
  while (used.has(n)) n += 1;
  return String(n);
}

/** Where the specs come from — the store supplies device values with template fallback. */
export interface LoadSpecLookup {
  speakerSpecFor: (node: SchematicNode) => SpeakerLoadSpec | undefined;
  ampSpecFor: (node: SchematicNode) => AmplifierLoadSpec | undefined;
}

export interface LineLoadRow {
  line: FloorplanLine;
  channel?: AmplifierChannel;
  /** Speakers of this line placed on the plan, and wired on the schematic. */
  placedCount: number;
  wiredCount: number;
  /** Load verdict for the channel; undefined when the line has no channel. */
  load?: ChannelLoadResult;
  amp?: AmplifierLoadResult;
}

export interface LineLoadReport {
  rows: LineLoadRow[];
  /** Per amplifier node id, the whole-amplifier verdict (all channels, wired or not). */
  amps: Map<string, { amplifier: SchematicAmplifier; result: AmplifierLoadResult }>;
  schematicAmps: SchematicAmplifier[];
}

/** Compute every amplifier's load from the schematic, using the plan's line registry for
 *  the operating mode / tap of channels it binds. Channels without a line default to Lo-Z
 *  (or the amplifier's only Hi-Z mode). */
export function computeAmplifierLoads(
  amps: SchematicAmplifier[],
  lines: FloorplanLine[] | undefined,
  nodes: SchematicNode[],
  lookup: LoadSpecLookup,
): Map<string, { amplifier: SchematicAmplifier; result: AmplifierLoadResult }> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, { amplifier: SchematicAmplifier; result: AmplifierLoadResult }>();
  for (const amp of amps) {
    const ampNode = nodeById.get(amp.nodeId);
    const ampSpec = ampNode ? lookup.ampSpecFor(ampNode) : undefined;
    const fallbackMode = defaultLineMode(ampSpec);
    const inputs = amp.channels.map<ChannelLoadInput>((ch) => {
      const line = lineForChannel(lines, ch.ampNodeId, ch.portId);
      const speakers = ch.speakerNodeIds.map((id) => {
        const n = nodeById.get(id);
        return { spec: n ? lookup.speakerSpecFor(n) : undefined, count: 1 };
      });
      return { mode: line?.mode ?? fallbackMode, speakers, tapW: line?.tapW };
    });
    out.set(amp.nodeId, { amplifier: amp, result: computeAmplifierLoad(ampSpec, inputs, amp.channels.length) });
  }
  return out;
}

/** The plan's lines with their channel binding and load verdict. */
export function computeLineLoads(
  page: Pick<FloorplanPage, "lines" | "symbols">,
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  lookup: LoadSpecLookup,
): LineLoadReport {
  const schematicAmps = amplifiersOnSchematic(nodes, edges);
  const amps = computeAmplifierLoads(schematicAmps, page.lines, nodes, lookup);
  const placed = new Map<string, number>();
  for (const s of page.symbols) {
    const key = (s.lineNo ?? "").trim();
    if (key) placed.set(key, (placed.get(key) ?? 0) + 1);
  }
  const rows = planLines(page).map<LineLoadRow>((line) => {
    const entry = line.ampNodeId ? amps.get(line.ampNodeId) : undefined;
    const idx = entry ? entry.amplifier.channels.findIndex((c) => c.portId === line.ampPortId) : -1;
    const channel = idx >= 0 ? entry!.amplifier.channels[idx] : undefined;
    return {
      line,
      channel,
      placedCount: placed.get(line.lineNo) ?? 0,
      wiredCount: channel?.speakerNodeIds.length ?? 0,
      load: idx >= 0 ? entry!.result.channels[idx] : undefined,
      amp: entry?.result,
    };
  });
  return { rows, amps, schematicAmps };
}

// ── Sync from the schematic ──────────────────────────────────────────

export interface LineSyncResult {
  lines: FloorplanLine[];
  symbols: FloorplanSymbol[];
  /** Line numbers created by this sync. */
  addedLineNos: string[];
  /** Symbols whose line or number changed. */
  relabeledCount: number;
}

/** Bind the plan's lines to the schematic: every amplifier channel that has speakers on
 *  it gets a line (existing bindings are kept, new channels take the next free number in
 *  amplifier / channel order), and every placed symbol whose device hangs on a channel
 *  moves to that channel's line and is numbered within it. Symbols of unwired devices
 *  keep what they have. */
export interface LineSyncOptions {
  /** Live mode (runs on every wiring change): only symbols that already sit on a line bound
   *  to an amplifier channel follow a rewire, and lines are created only for the channels
   *  those symbols move to. Hand-numbered symbols and unbound lines are never touched. */
  live?: boolean;
}

export function syncLinesFromSchematic(
  page: Pick<FloorplanPage, "lines" | "symbols" | "kind" | "labelTemplate" | "groups">,
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  lookup: LoadSpecLookup,
  options: LineSyncOptions = {},
): LineSyncResult {
  const amps = amplifiersOnSchematic(nodes, edges);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const lines: FloorplanLine[] = planLines(page).map((l) => ({ ...l }));
  const addedLineNos: string[] = [];
  const boundLineNos = new Set(lines.filter((l) => l.ampNodeId).map((l) => l.lineNo));
  const follows = (s: FloorplanSymbol) => Boolean(s.deviceNodeId) && (!options.live || boundLineNos.has((s.lineNo ?? "").trim()));

  const addLine = (ch: AmplifierChannel) => {
    const ampNode = nodeById.get(ch.ampNodeId);
    const mode = defaultLineMode(ampNode ? lookup.ampSpecFor(ampNode) : undefined);
    const lineNo = nextLineNo(lines.map((l) => l.lineNo));
    lines.push({ lineNo, ampNodeId: ch.ampNodeId, ampPortId: ch.portId, mode });
    addedLineNos.push(lineNo);
  };

  if (options.live) {
    // Only the channels that following symbols need.
    for (const s of page.symbols) {
      if (!follows(s)) continue;
      const ch = findChannelForSpeaker(amps, s.deviceNodeId!);
      if (ch && !lineForChannel(lines, ch.ampNodeId, ch.portId)) addLine(ch);
    }
  } else {
    for (const amp of amps) {
      for (const ch of amp.channels) {
        if (ch.speakerNodeIds.length === 0) continue;
        if (!lineForChannel(lines, ch.ampNodeId, ch.portId)) addLine(ch);
      }
    }
  }

  // Move symbols onto their channel's line and renumber every touched line 1…n in
  // placement order; untouched lines keep their numbering.
  const template = effectiveLabelTemplate(page);
  const groupLabel = (gid: string) => page.groups.find((g) => g.id === gid)?.label;
  const lineNoForSymbol = new Map<string, string>();
  for (const s of page.symbols) {
    if (!follows(s)) continue;
    const ch = findChannelForSpeaker(amps, s.deviceNodeId!);
    if (!ch) continue;
    const line = lineForChannel(lines, ch.ampNodeId, ch.portId);
    if (line) lineNoForSymbol.set(s.id, line.lineNo);
  }
  const touched = new Set<string>();
  for (const s of page.symbols) {
    const target = lineNoForSymbol.get(s.id);
    if (target !== undefined && target !== (s.lineNo ?? "").trim()) {
      touched.add(target);
      if (s.lineNo?.trim()) touched.add(s.lineNo.trim());
    }
  }
  // Live mode appends a mover after the speakers already on its new line and leaves the
  // line it left alone (gaps included) — the fewest labels change on a plan that is being
  // worked on. The manual sync renumbers every touched line 1…n instead.
  const counters = new Map<string, number>();
  if (options.live) {
    for (const s of page.symbols) {
      const key = (s.lineNo ?? "").trim();
      const target = lineNoForSymbol.get(s.id);
      const stays = target === undefined || target === key;
      if (key && stays && typeof s.seq === "number") counters.set(key, Math.max(counters.get(key) ?? 0, s.seq));
    }
  }
  let relabeledCount = 0;
  const symbols = page.symbols.map((s) => {
    const lineNo = lineNoForSymbol.get(s.id) ?? (s.lineNo ?? "").trim();
    if (!lineNo || !touched.has(lineNo)) return s;
    if (options.live && lineNo === (s.lineNo ?? "").trim()) return s; // stays put
    const n = (counters.get(lineNo) ?? 0) + 1;
    counters.set(lineNo, n);
    const deviceLabel = s.deviceNodeId ? (nodeById.get(s.deviceNodeId)?.data as DeviceData | undefined)?.label : undefined;
    const label = formatSymbolLabel(template, { line: lineNo, n, group: groupLabel(s.groupId), device: deviceLabel });
    if (lineNo === (s.lineNo ?? "").trim() && n === s.seq && label === s.label) return s;
    relabeledCount += 1;
    return { ...s, lineNo, seq: n, label };
  });

  // A line that was only implied by symbols and lost them all is gone; anything the
  // planner wired, named or configured stays.
  const stillUsed = new Set(symbols.map((s) => (s.lineNo ?? "").trim()));
  const kept = lines.filter((l) => l.ampNodeId || l.name || l.mode || l.tapW !== undefined || stillUsed.has(l.lineNo));
  kept.sort((a, b) => compareLineNo(a.lineNo, b.lineNo));
  return { lines: kept, symbols, addedLineNos, relabeledCount };
}

/** The line a newly placed device symbol belongs on: the line bound to its amplifier
 *  channel, or — when `createIfMissing` — a new line for that channel. */
export function lineForDevice(
  page: Pick<FloorplanPage, "lines" | "symbols">,
  deviceNodeId: string,
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  lookup: LoadSpecLookup,
): { lineNo: string; newLine?: FloorplanLine } | undefined {
  const amps = amplifiersOnSchematic(nodes, edges);
  const ch = findChannelForSpeaker(amps, deviceNodeId);
  if (!ch) return undefined;
  const existing = lineForChannel(planLines(page), ch.ampNodeId, ch.portId);
  if (existing) return { lineNo: existing.lineNo };
  const ampNode = nodes.find((n) => n.id === ch.ampNodeId);
  const mode = defaultLineMode(ampNode ? lookup.ampSpecFor(ampNode) : undefined);
  const lineNo = nextLineNo(planLines(page).map((l) => l.lineNo));
  return { lineNo, newLine: { lineNo, ampNodeId: ch.ampNodeId, ampPortId: ch.portId, mode } };
}

/** Cheap fingerprint of the speaker wiring — what a rewire changes and a node drag does
 *  not — so the live sync can skip everything else. */
export function wiringSignature(nodes: SchematicNode[], edges: ConnectionEdge[]): string {
  const parts: string[] = [];
  for (const n of nodes) {
    if (n.type !== "device") continue;
    const d = n.data as DeviceData | undefined;
    parts.push(`${n.id}:${d?.deviceType ?? ""}:${(d?.ports ?? []).filter((p) => p.signalType === "speaker-level").map((p) => p.id).join(",")}`);
  }
  for (const e of edges) {
    if (e.data?.signalType !== "speaker-level") continue;
    parts.push(`${e.source}|${e.sourceHandle ?? ""}>${e.target}|${e.targetHandle ?? ""}|${e.data?.linkedConnectionId ?? ""}`);
  }
  return parts.join(";");
}

// ── Legend line table ────────────────────────────────────────────────

export interface LegendLineRow {
  lineNo: string;
  name?: string;
  /** "PSX4804D · CH 3", or "–" for an unwired line. */
  feed: string;
  count: number;
  /** "4 Ω · 800 W" / "100 V · 240 W" / "–". */
  load: string;
}

export function buildLegendLineRows(report: LineLoadReport): LegendLineRow[] {
  return report.rows
    .filter((r) => r.placedCount > 0 || r.channel)
    .map((r) => ({
      lineNo: r.line.lineNo,
      name: r.line.name?.trim() || undefined,
      feed: r.channel ? `${r.channel.ampLabel} · ${channelShortLabel(r.channel)}` : "–",
      count: Math.max(r.placedCount, r.wiredCount),
      load: r.load ? formatChannelLoad(r.load) : "–",
    }));
}

/** Whether the legend prints its line table: switched on, or (default) a loudspeaker plan with lines. */
export function legendShowsLines(page: Pick<FloorplanPage, "legend" | "kind" | "lines" | "symbols">): boolean {
  if (page.legend.showLines !== undefined) return page.legend.showLines;
  return page.kind === "loudspeaker" && planLines(page).length > 0;
}
