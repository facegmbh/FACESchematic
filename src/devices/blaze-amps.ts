import type { AmplifierLoadSpec, ConnectorType, DeviceTemplate, Port, SignalType } from "../types";

/**
 * Blaze Audio PowerZone amplifiers — every model of the three families (26.11.2026).
 *
 * Figures are the maker's: the PowerZone Connect 1U datasheet (Rev E, 06/2025) and manual,
 * the Connect 2U datasheet (Rev K, 06/2025) and manual, and the PowerZone datasheet (2025)
 * and manual (Rev M). Blaze Audio is now part of Sonance; the product pages live on
 * sonance.com. Four models FACE had already drawn keep their entries, because schematics
 * reference those ids, and got their load data there: Connect 1002, 2004 and 4008 in
 * face-library.json, Connect 504D in face-products.ts. The other seventeen are here.
 *
 * What the load check (src/speakerLoad.ts) is told, and what it is not:
 *  - PowerZone Connect bridges two channels for 70 V / 100 V: a four-channel amplifier has
 *    two such lines. `hiZBridgesPairs` says so, and the 70 V / 100 V rating is the pair's.
 *    The plain PowerZone switches every channel on its own.
 *  - PowerShare is entered only where it spans the whole amplifier (Connect 122, 252, 254
 *    and PowerZone 252): one channel may then take the full supply. On the others it works
 *    in groups (per pair, or per four channels on the 508), which the check has no notion
 *    of — there a channel is held to its rated power, the cautious reading.
 *  - Peak output voltage is the datasheet's: 45 V RMS single-ended on the 1U models, 65 V
 *    or 80 V peak on the 2U models. No peak current is published for any model.
 *  - On the 1U and the plain series "100 V" is at −1 dB, about 90 V (datasheet footnote).
 *
 * `powerDrawW` is the consumption at 1/8 power; the plain PowerZone has only an
 * unqualified "power consumption" figure, and that is what stands there.
 */

type PortSpec = [label: string, signal: SignalType, dir: Port["direction"], connector: ConnectorType, section: string];

interface Row {
  /** "Connect 504D", "504" */
  name: string;
  sku: string;
  channels: number;
  rated: NonNullable<AmplifierLoadSpec["ratedW"]>;
  totalW: number;
  /** PowerShare across the whole amplifier: the most one channel may take. */
  shareW?: number;
  peakV: number;
  minOhm: number;
  bridges: boolean;
  he: 1 | 2;
  size: [w: number, h: number, d: number];
  kg: number;
  drawW: number;
  inputs: number;
  connect: boolean;
  dante?: boolean;
  facts: string[];
}

/** 45 V RMS single-ended, as a peak. */
const PEAK_1U = Math.round(45 * Math.SQRT2 * 10) / 10;
const HIZ_1U = "100 V bei −1 dB (ca. 90 V)";

const connect1U = (name: string, sku: string, ch: number, w: number, pairW: number, total: number, size: Row["size"], kg: number, drawW: number, inputs: number, share: number | string, dante = false): Row => ({
  name, sku, channels: ch, rated: { ohm4: w, ohm8: w, v70: pairW, v100: pairW }, totalW: total,
  shareW: typeof share === "number" ? share : undefined,
  peakV: PEAK_1U, minOhm: 4, bridges: true, he: 1, size, kg, drawW, inputs, connect: true, dante,
  facts: [
    `Leistung: ${ch}× ${w} W @ 4 / 8 Ω`,
    `70 V / 100 V: ${ch / 2}× ${pairW} W — je Kanalpaar gebrückt eine Linie; ${HIZ_1U}`,
    `PowerShare: ${typeof share === "number" ? `bis ${share} W auf einem Kanal` : share}`,
  ],
});

const connect2U = (name: string, sku: string, ch: number, w4: number, w8: number, w70: number, w100: number, peakV: number, size: Row["size"], kg: number, drawW: number, inputs: number, dante = false): Row => ({
  name, sku, channels: ch, rated: { ohm2: w4, ohm4: w4, ohm8: w8, v70: w70, v100: w100 }, totalW: ch * w4,
  peakV, minOhm: 2, bridges: true, he: 2, size, kg, drawW, inputs, connect: true, dante,
  facts: [
    `Leistung: ${ch}× ${w4} W @ 2 / 4 Ω, ${ch}× ${w8} W @ 8 Ω`,
    w70 === w100
      ? `70 V / 100 V: ${ch / 2}× ${w100} W — je Kanalpaar gebrückt eine Linie`
      : `70 V / 100 V: ${ch / 2}× ${w100} W @ 100 V, ${w70} W @ 70 V — je Kanalpaar gebrückt eine Linie`,
    `Gebrückt niederohmig: ${ch / 2}× ${2 * w4} W @ 4 / 8 Ω`,
  ],
});

const plain = (name: string, sku: string, ch: number, w: number, size: Row["size"], kg: number, drawW: number, share: number | string): Row => ({
  name, sku, channels: ch, rated: { ohm4: w, ohm8: w, v70: w, v100: w }, totalW: ch * w,
  shareW: typeof share === "number" ? share : undefined,
  peakV: PEAK_1U, minOhm: 4, bridges: false, he: 1, size, kg, drawW, inputs: ch, connect: false,
  facts: [
    `Leistung: ${ch}× ${w} W @ 4 / 8 Ω, 70 V oder 100 V`,
    `70 V / 100 V: je Kanal einzeln schaltbar; ${HIZ_1U}`,
    `PowerShare: ${typeof share === "number" ? `bis ${share} W auf einem Kanal` : share}`,
  ],
});

const HALF: Row["size"] = [220, 44, 213];
const HALF_LONG: Row["size"] = [220, 44, 319];
const FULL_1U: Row["size"] = [440, 44, 319];
const FULL_2U: Row["size"] = [440, 88, 321];
const FULL_2U_8CH: Row["size"] = [440, 88, 414];

const ROWS: Row[] = [
  // ── PowerZone Connect, 1 HE ──
  connect1U("Connect 122", "ubx-888-008", 2, 60, 125, 125, HALF, 2, 33, 4, 125),
  connect1U("Connect 122D", "ubx-888-026", 2, 60, 125, 125, HALF, 2, 33, 4, 125, true),
  connect1U("Connect 252", "ubx-888-010", 2, 125, 250, 250, HALF, 2, 54, 4, 250),
  connect1U("Connect 254", "ubx-888-009", 4, 60, 125, 250, HALF_LONG, 2.8, 59, 4, 250),
  connect1U("Connect 504", "ubx-888-011", 4, 125, 250, 500, HALF_LONG, 2.8, 107, 4, "250 W je Kanalpaar (1/2, 3/4)"),
  connect1U("Connect 508", "ubx-888-024", 8, 60, 125, 500, FULL_1U, 3.5, 97, 8, "250 W je Vierergruppe (1–4, 5–8)"),
  connect1U("Connect 1008", "ubx-888-025", 8, 125, 250, 1000, FULL_1U, 3.8, 200, 8, "250 W je Kanalpaar"),
  connect1U("Connect 1008D", "ubx-888-031", 8, 125, 250, 1000, FULL_1U, 3.8, 200, 8, "250 W je Kanalpaar", true),

  // ── PowerZone Connect, 2 HE (1002, 2004 and 4008 are in face-library.json) ──
  connect2U("Connect 1502", "lbx-888-002", 2, 750, 400, 1200, 1500, 80, FULL_2U, 5.9, 247, 4),
  connect2U("Connect 2004D", "lbx-888-007", 4, 500, 250, 1000, 1000, 65, FULL_2U, 7.4, 346, 4, true),
  connect2U("Connect 3004", "lbx-888-004", 4, 750, 400, 1200, 1500, 80, FULL_2U, 7.4, 498, 4),
  connect2U("Connect 3004D", "lbx-888-008", 4, 750, 400, 1200, 1500, 80, FULL_2U, 7.4, 498, 4, true),
  connect2U("Connect 6008", "lbx-888-009", 8, 750, 400, 1200, 1500, 80, FULL_2U_8CH, 11.6, 999, 8),
  connect2U("Connect 6008D", "lbx-888-011", 8, 750, 400, 1200, 1500, 80, FULL_2U_8CH, 11.6, 999, 8, true),

  // ── PowerZone (no network, no DSP) ──
  plain("252", "ubx-888-015", 2, 125, [220, 44.5, 262], 1.9, 75, 250),
  plain("504", "ubx-888-016", 4, 125, [220, 44.5, 337], 2.4, 150, "250 W je Kanalpaar (1/2, 3/4)"),
  plain("1004", "ubx-888-017", 4, 250, [440, 44.5, 292], 3.6, 300, "nein"),
];

const many = (n: number, f: (i: number) => PortSpec): PortSpec[] => Array.from({ length: n }, (_, i) => f(i + 1));

function build(row: Row): DeviceTemplate {
  const slug = row.name.toLowerCase().replace(/\s+/g, "-");
  const model = `PowerZone ${row.name}`;
  // The RCA inputs of the Connect models are wired in parallel with the balanced ones —
  // the same input channels, so they are not separate ports.
  const ports: PortSpec[] = [
    ...many(row.inputs, (i): PortSpec => [`Analog In ${i}`, "analog-audio", "input", "phoenix", "Eingänge"]),
    ...(row.connect ? [
      ["S/PDIF In", "spdif", "input", "rca", "Digital"] as PortSpec,
      ["S/PDIF Out", "spdif", "output", "rca", "Digital"] as PortSpec,
      ["Network", "ethernet", "bidirectional", "rj45", "Netzwerk"] as PortSpec,
    ] : []),
    ...(row.dante ? [["Dante", "dante", "bidirectional", "rj45", "Netzwerk"] as PortSpec] : []),
    ["GPIO", "gpio", "bidirectional", "phoenix", "Steuerung"],
    ...many(row.channels, (i): PortSpec => [`Speaker Out ${i}`, "speaker-level", "output", "phoenix", "Lautsprecher"]),
    ["AC In", "power", "input", "iec", "Netz"],
  ];
  const ampLoad: AmplifierLoadSpec = {
    channels: row.channels,
    ratedW: row.rated,
    totalRatedW: row.totalW,
    ...(row.shareW ? { maxBurstPerChannelW: row.shareW } : {}),
    peakVoltageV: row.peakV,
    minImpedanceOhm: row.minOhm,
    ...(row.bridges ? { hiZBridgesPairs: true } : {}),
  };
  const perChannel = row.rated.ohm4!;
  return {
    id: `face-blaze-pz-${slug}-0000-4000-8000-000000000001`,
    deviceType: "amplifier",
    label: `Blaze ${model} (${row.channels}× ${perChannel} W${row.dante ? ", Dante" : ""})`,
    shortName: row.connect ? `PZC ${row.name.replace("Connect ", "")}` : `PZ ${row.name}`,
    manufacturer: "Blaze Audio",
    modelNumber: model,
    referenceUrl: `https://sonance.com/products/${row.sku}`,
    searchTerms: ["blaze", "blaze audio", "sonance", "powerzone", ...(row.connect ? ["pzc", "connect", "matrix", "dsp"] : ["pz"]), row.name.toLowerCase().replace("connect ", ""), "endstufe", "verstärker", "amplifier", `${row.channels}-kanal`, ...(row.dante ? ["dante"] : [])],
    powerDrawW: row.drawW,
    heightMm: row.size[1],
    widthMm: row.size[0],
    depthMm: row.size[2],
    weightKg: row.kg,
    auxiliaryData: [...row.facts, ...(row.dante ? ["Dante: 4 ein / 4 aus"] : [])].map((text) => ({ text })),
    ports: ports.map(([label, signalType, direction, connectorType, section], i) => ({
      id: `port-blaze-${slug}-${String(i + 1).padStart(3, "0")}`,
      label,
      signalType,
      direction,
      connectorType,
      section,
    })),
    ampLoad,
  };
}

export const templates: DeviceTemplate[] = ROWS.map(build);
