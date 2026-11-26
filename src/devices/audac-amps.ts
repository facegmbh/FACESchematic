import type { AmplifierLoadSpec, ConnectorType, DeviceTemplate, Port, SignalType } from "../types";

/**
 * Audac amplifiers — the whole range FACE has in its price list (26.11.2026).
 *
 * Every figure is Audac's own: product page on audac.eu, the user manual, the product sheet
 * or the "Devices Heat Dissipation 2024 V1.5" sheet. What Audac does not publish is left
 * out rather than filled in — no model has a peak output voltage or current, so the load
 * check (src/speakerLoad.ts) derives those from the rated power the way it does for any
 * amplifier without them.
 *
 * Three things to know about how the load check sees them:
 *  - SCP and MFA deliver 70 V / 100 V only with both channels bridged into ONE line. Their
 *    `ampLoad` says so (`hiZBridgesPairs`): the 70 V / 100 V rating is the pair's.
 *  - COM12MK2 / COM24MK2 are one amplifier channel behind five switched zone outputs, so
 *    they have one speaker port. 70 V needs the internal transformer re-plugged — left out.
 *  - CAP224 / 248 / 424 / 448 are 100 V only.
 *
 * `powerDrawW` is the consumption at 1/8 rated power, the figure Audac gives for normal
 * programme material. Weights and sizes follow the product page where page and manual
 * disagree.
 */

type PortSpec = [label: string, signal: SignalType, dir: Port["direction"], connector: ConnectorType, section: string];

interface Row {
  model: string;
  /** What it is, as it reads in the library list. */
  text: string;
  channels: number;
  rated: NonNullable<AmplifierLoadSpec["ratedW"]>;
  minOhm?: number;
  /** 70 V / 100 V bridges both channels into one line; the 70 V / 100 V rating is the pair's. */
  bridgesPairs?: boolean;
  he: number | null;
  size: [w: number, h: number, d: number];
  kg: number;
  drawW: number;
  /** Data rows shown on the device: power as stated, and what the load check cannot say. */
  facts: [string, string][];
  ports: PortSpec[];
  terms?: string[];
}

const many = (n: number, f: (i: number) => PortSpec): PortSpec[] => Array.from({ length: n }, (_, i) => f(i + 1));
const speakers = (n: number, connector: ConnectorType): PortSpec[] =>
  many(n, (i) => [`Speaker Out ${i}`, "speaker-level", "output", connector, "Lautsprecher"]);
const xlrIn = (n: number): PortSpec[] => many(n, (i) => [`Line In ${i}`, "analog-audio", "input", "xlr-3", "Eingänge"]);
const xlrLink = (n: number): PortSpec[] => many(n, (i) => [`Link Out ${i}`, "analog-audio", "output", "xlr-3", "Link"]);
const AC: PortSpec = ["AC In", "power", "input", "iec", "Netz"];
const DC24: PortSpec = ["24 V DC", "power", "input", "other", "Netz"];
const RS232: PortSpec = ["RS-232", "serial", "bidirectional", "other", "Steuerung"];

const HALF_RACK: [string, string] = ["Bauform", "9,5\" (halbe Rackbreite), 1 HE"];
const BRIDGE_HIZ = (w70: number, w100: number): [string, string] => [
  "70 V / 100 V",
  w70 === w100
    ? `nur gebrückt: 1× ${w100} W auf einer Linie, nicht je Kanal`
    : `nur gebrückt: 1× ${w100} W @ 100 V bzw. ${w70} W @ 70 V auf einer Linie, nicht je Kanal`,
];
const DANTE_OPTION: [string, string] = ["Dante", "optional über Modul ANI44XT (4 ein / 4 aus)"];

const wave = (model: string, ch: number, w4: number, w8: number, bridgedW: number, kg: number, drawW: number): Row => ({
  model,
  text: `${ch}× ${w4} W @ 4 Ω, WaveDynamics DSP`,
  channels: ch,
  rated: { ohm4: w4, ohm8: w8 },
  he: 2,
  size: [482, 88, 420],
  kg,
  drawW,
  facts: [
    ["Leistung", `${ch}× ${w4} W @ 4 Ω / ${ch}× ${w8} W @ 8 Ω`],
    ["Gebrückt", `${ch / 2}× ${bridgedW} W @ 8 Ω`],
    ["70 V / 100 V", "nein — nur niederohmig"],
    DANTE_OPTION,
  ],
  ports: [...xlrIn(ch), RS232, ...speakers(ch, "speakon"), AC],
});

const pmq = (model: string, w: number, kg: number, drawW: number): Row => ({
  model,
  text: `4× ${w} W @ 100 V / 70 V / 8 Ω, WaveDynamics DSP`,
  channels: 4,
  rated: { ohm8: w, v70: w, v100: w },
  minOhm: 8,
  he: 2,
  size: [482, 88, 420],
  kg,
  drawW,
  facts: [
    ["Leistung", `4× ${w} W — je Kanal wählbar 100 V, 70 V oder 8 Ω`],
    ["Hinweis", "transformatorlos: keine 100-V-Leitungsübertrager direkt anschließen"],
    DANTE_OPTION,
  ],
  ports: [...xlrIn(4), RS232, ...speakers(4, "phoenix"), AC],
});

const cap100 = (model: string, ch: number, w: number, kg: number, drawW: number): Row => ({
  model,
  text: `${ch}× ${w} W @ 100 V`,
  channels: ch,
  rated: { v100: w },
  he: 2,
  size: [482, 88, 420],
  kg,
  drawW,
  facts: [
    ["Leistung", `${ch}× ${w} W @ 100 V`],
    ["Betrieb", `nur 100 V — kein 70 V, nicht niederohmig (kleinste Linienimpedanz ${w === 240 ? 42 : 21} Ω)`],
  ],
  ports: [...xlrIn(ch), ...xlrLink(ch), ...speakers(ch, "phoenix"), AC],
});

const epa = (model: string, ch: number, w4: number, w8: number, bridgedW: number, kg: number, drawW: number): Row => ({
  model,
  text: `${ch}× ${w4} W @ 4 Ω, lüfterlos`,
  channels: ch,
  rated: { ohm4: w4, ohm8: w8 },
  he: 1,
  size: [482, 44, 330],
  kg,
  drawW,
  facts: [
    ["Leistung", `${ch}× ${w4} W @ 4 Ω / ${ch}× ${w8} W @ 8 Ω`],
    ["Gebrückt", `${ch / 2}× ${bridgedW} W @ 8 Ω`],
    ["70 V / 100 V", "nein — nur niederohmig"],
  ],
  // The two-channel models carry link outputs and Speakon; the four-channel ones neither.
  ports: ch === 2
    ? [...xlrIn(2), ...xlrLink(2), ...speakers(2, "speakon"), AC]
    : [...xlrIn(4), ...speakers(4, "phoenix"), AC],
});

const scp = (model: string, w4: number, w8: number, w70: number, w100: number, kg: number, drawW: number): Row => ({
  model,
  text: `2× ${w4} W @ 4 Ω oder 1× ${w100} W @ 70/100 V`,
  channels: 2,
  rated: { ohm4: w4, ohm8: w8, v70: w70, v100: w100 },
  bridgesPairs: true,
  minOhm: 4,
  he: 1,
  size: [217.5, 44, 300],
  kg,
  drawW,
  facts: [["Leistung", `2× ${w4} W @ 4 Ω / 2× ${w8} W @ 8 Ω`], BRIDGE_HIZ(w70, w100), HALF_RACK],
  ports: [
    ...many(2, (i): PortSpec => [`Line In ${i}`, "analog-audio", "input", "phoenix", "Eingänge"]),
    ["Wandpanel In", "analog-audio", "input", "rj45", "Eingänge"],
    ["Remote Volume", "gpio", "input", "rj45", "Steuerung"],
    ["Priority Mute", "gpio", "input", "phoenix", "Steuerung"],
    ...speakers(2, "phoenix"),
    AC,
  ],
});

const com1 = (model: string, w: number, drawW: number): Row => ({
  model,
  text: `Mischverstärker ${w} W @ 4 Ω / 70 V / 100 V`,
  channels: 1,
  rated: { ohm4: w, v70: w, v100: w },
  minOhm: 4,
  he: 1,
  size: [217.5, 43.7, 300],
  kg: 3,
  drawW,
  facts: [["Leistung", `1× ${w} W @ 4 Ω, 70 V oder 100 V`], HALF_RACK],
  ports: [
    ["Mic In", "analog-audio", "input", "phoenix", "Eingänge"],
    ["Line In", "analog-audio", "input", "rca", "Eingänge"],
    ["Priority Mute", "gpio", "input", "phoenix", "Steuerung"],
    ...speakers(1, "phoenix"),
    AC,
  ],
  terms: ["mischverstärker", "mixing amplifier"],
});

const com5 = (model: string, w: number, kg: number, drawW: number): Row => ({
  model,
  text: `Mischverstärker ${w} W @ 100 V, 5 Zonen`,
  channels: 1,
  // 70 V needs the internal transformer re-plugged, so it is not offered as a mode here.
  rated: { ohm4: w, v100: w },
  minOhm: 4,
  he: 2,
  size: [420, 88, 320],
  kg,
  drawW,
  facts: [
    ["Leistung", `1× ${w} W @ 100 V oder 4 Ω`],
    ["Zonen", `5 schaltbare Zonenausgänge teilen sich die ${w} W — ein Verstärkerkanal`],
    ["Betrieb", "100 V und 4 Ω nicht gleichzeitig; 70 V nur durch Umstecken im Gerät"],
  ],
  ports: [
    ["Mic/Line In 1", "analog-audio", "input", "combo-xlr-trs", "Eingänge"],
    ["Mic/Line In 2", "analog-audio", "input", "combo-xlr-trs", "Eingänge"],
    ["Mic/Line In 3", "analog-audio", "input", "xlr-3", "Eingänge"],
    ["Mic/Line In 4", "analog-audio", "input", "xlr-3", "Eingänge"],
    ["Line In 5", "analog-audio", "input", "rca", "Eingänge"],
    ["Line In 6", "analog-audio", "input", "rca", "Eingänge"],
    ["Remote Mic", "analog-audio", "input", "phoenix", "Eingänge"],
    ["Tele-Paging", "analog-audio", "input", "phoenix", "Eingänge"],
    ["Link In", "analog-audio", "input", "trs-quarter", "Link"],
    ["Link Out", "analog-audio", "output", "trs-quarter", "Link"],
    ["Priority Mute", "gpio", "input", "phoenix", "Steuerung"],
    ["Speaker Out (5 Zonen)", "speaker-level", "output", "phoenix", "Lautsprecher"],
    // A fixed mains lead with a moulded plug, no IEC inlet.
    ["AC In", "power", "input", "schuko", "Netz"],
  ],
  terms: ["mischverstärker", "mixing amplifier", "zonen"],
});

const mfa = (model: string, w: number, drawW: number): Row => ({
  model,
  text: `SourceCon-Verstärker 2× ${w} W oder 1× ${2 * w} W @ 70/100 V`,
  channels: 2,
  rated: { ohm4: w, ohm8: w, v70: 2 * w, v100: 2 * w },
  bridgesPairs: true,
  minOhm: 4,
  he: 1,
  size: [217.5, 43.7, 300],
  kg: 2.2,
  drawW,
  facts: [
    ["Leistung", `2× ${w} W @ 4 / 8 / 16 Ω`],
    BRIDGE_HIZ(2 * w, 2 * w),
    ["Quellen", "1 SourceCon-Steckplatz für ein Quellenmodul"],
    HALF_RACK,
  ],
  ports: [
    ["Mic/Line In", "analog-audio", "input", "phoenix", "Eingänge"],
    ["Line In", "analog-audio", "input", "rca", "Eingänge"],
    ["Line Out", "analog-audio", "output", "trs-eighth", "Ausgänge"],
    ["LAN", "ethernet", "bidirectional", "rj45", "Steuerung"],
    ["RS-232 / RS-485", "serial", "bidirectional", "phoenix", "Steuerung"],
    ["Priority Mute", "gpio", "input", "phoenix", "Steuerung"],
    ...speakers(2, "phoenix"),
    AC,
  ],
  terms: ["sourcecon", "multifunktional"],
});

const MINI: Pick<Row, "he" | "size"> = { he: null, size: [108, 44, 165] };

const ROWS: Row[] = [
  // ── Mini amplifiers ──
  {
    model: "AMP203", text: "Mini-Verstärker 2× 30 W, Dante, PoE", channels: 2, rated: { ohm4: 30, ohm8: 30 }, minOhm: 4,
    ...MINI, kg: 0.7, drawW: 11,
    facts: [
      ["Leistung", "2× 30 W @ 4 Ω / 8 Ω"],
      ["Gebrückt", "1× 60 W @ 2 Ω oder 4 Ω"],
      ["70 V / 100 V", "nein"],
      ["Versorgung", "PoE 802.3bt oder 24 V DC"],
      ["Dante", "4 Eingangskanäle (Dante / AES67)"],
    ],
    ports: [
      ["Dante / LAN (PoE)", "dante", "bidirectional", "rj45", "Netzwerk"],
      ["Wandpanel (RS-485)", "rs485", "bidirectional", "rj45", "Steuerung"],
      ["Line Out", "analog-audio", "output", "phoenix", "Ausgänge"],
      ...speakers(2, "phoenix"),
      DC24,
    ],
    terms: ["dante", "poe", "mini"],
  },
  {
    model: "AMP22", text: "Mini-Verstärker 2× 15 W", channels: 2, rated: { ohm4: 15, ohm8: 7.5 }, minOhm: 4,
    ...MINI, kg: 0.8, drawW: 6,
    facts: [
      ["Leistung", "2× 15 W @ 4 Ω / 2× 7,5 W @ 8 Ω"],
      ["Gebrückt", "1× 30 W @ 8 Ω"],
      ["70 V / 100 V", "nur mit externem Übertrager TR3030 (30 W)"],
      ["Versorgung", "Netzteil PSD241, 24 V DC (liegt bei)"],
    ],
    ports: [
      ["Line In", "analog-audio", "input", "phoenix", "Eingänge"],
      ["Mic In", "analog-audio", "input", "phoenix", "Eingänge"],
      ["Wandpanel In", "analog-audio", "input", "rj45", "Eingänge"],
      ["Remote Volume", "gpio", "input", "rj45", "Steuerung"],
      ...speakers(2, "phoenix"),
      DC24,
    ],
    terms: ["mini"],
  },
  {
    model: "AMP523MK2", text: "Mini-Verstärker 2× 15 W, 4 Line + Mic, LAN", channels: 2, rated: { ohm4: 15, ohm8: 7.5 }, minOhm: 4,
    ...MINI, kg: 0.81, drawW: 7,
    facts: [
      ["Leistung", "2× 15 W @ 4 Ω / 2× 7,5 W @ 8 Ω"],
      ["Gebrückt", "1× 30 W @ 8 Ω"],
      ["70 V / 100 V", "nur mit externem Übertrager TR3030 (30 W)"],
      ["Versorgung", "Netzteil PSD241, 24 V DC (liegt bei)"],
    ],
    ports: [
      ...many(4, (i): PortSpec => [`Line In ${i}`, "analog-audio", "input", "phoenix", "Eingänge"]),
      ["Mic In", "analog-audio", "input", "phoenix", "Eingänge"],
      ["Line Out", "analog-audio", "output", "phoenix", "Ausgänge"],
      ["LAN", "ethernet", "bidirectional", "rj45", "Steuerung"],
      ["RS-232", "serial", "bidirectional", "db9", "Steuerung"],
      ["Wandpanel (RS-485)", "rs485", "bidirectional", "rj45", "Steuerung"],
      ...speakers(2, "phoenix"),
      DC24,
    ],
    terms: ["mini", "audac touch"],
  },

  // ── CAP: 100 V power amplifiers ──
  cap100("CAP224", 2, 240, 7.2, 115),
  cap100("CAP248", 2, 480, 7.5, 187),
  {
    model: "CAP412", text: "4× 120 W @ 4 Ω / 70 V / 100 V", channels: 4, rated: { ohm4: 120, ohm8: 75, v70: 120, v100: 120 }, minOhm: 4,
    he: 2, size: [482, 88, 420], kg: 14.8, drawW: 95,
    facts: [["Leistung", "4× 120 W @ 4 Ω, 70 V oder 100 V / 4× 75 W @ 8 Ω"]],
    ports: [...xlrIn(4), ...xlrLink(4), ...speakers(4, "phoenix"), AC],
  },
  cap100("CAP424", 4, 240, 8.35, 218),
  cap100("CAP448", 4, 480, 8.85, 440),

  // ── COM: mixing amplifiers ──
  com1("COM104", 40, 11),
  com1("COM108", 80, 19),
  com5("COM12MK2", 120, 9.7, 87),
  com5("COM24MK2", 240, 11, 53),

  // ── DPA / EPA: low-impedance power amplifiers ──
  {
    model: "DPA616", text: "16× 60 W @ 4 Ω", channels: 16, rated: { ohm4: 60, ohm8: 30 },
    he: 2, size: [482, 88, 322], kg: 8.2, drawW: 200,
    facts: [
      ["Leistung", "16× 60 W @ 4 Ω / 16× 30 W @ 8 Ω"],
      ["Gebrückt", "8× 120 W @ 8 Ω"],
      ["70 V / 100 V", "nein — nur niederohmig"],
    ],
    ports: [
      ...many(16, (i): PortSpec => [`Line In ${i}`, "analog-audio", "input", "phoenix", "Eingänge"]),
      ...speakers(16, "phoenix"),
      AC,
    ],
    terms: ["16-kanal", "multiroom"],
  },
  epa("EPA104", 4, 100, 50, 200, 4.5, 86),
  epa("EPA152", 2, 150, 80, 300, 4.1, 69),
  epa("EPA252", 2, 250, 130, 500, 4.4, 98),
  epa("EPA254", 4, 250, 130, 500, 4.7, 186),
  epa("EPA502", 2, 500, 300, 1000, 4.7, 183),

  // ── MFA: SourceCon all-in-one ──
  mfa("MFA208", 40, 28),
  mfa("MFA216", 80, 40),

  // ── PMQ: 100 V with DSP ──
  pmq("PMQ240", 240, 8.05, 190),
  pmq("PMQ480", 480, 8.5, 329),
  pmq("PMQ600", 600, 8.6, 416),

  // ── SCP: compact two-channel ──
  scp("SCP206", 60, 30, 120, 120, 2.7, 42),
  scp("SCP212", 120, 60, 240, 240, 2.7, 60),
  scp("SCP224", 240, 120, 480, 480, 2.75, 100),
  scp("SCP230", 300, 150, 600, 600, 2.7, 115),
  // The manual's spec table gives 800 W at 70 V, its impedance table 1000 W; the lower is kept.
  scp("SCP250", 500, 250, 800, 1000, 2.9, 200),

  // ── SMA / SMQ: low impedance with DSP ──
  wave("SMA350", 2, 350, 220, 700, 7.4, 145),
  wave("SMA500", 2, 500, 300, 1000, 7.45, 182),
  wave("SMA750", 2, 750, 380, 1500, 7.5, 262),
  wave("SMQ350", 4, 350, 220, 700, 8.1, 272),
  wave("SMQ500", 4, 500, 300, 1000, 8.25, 345),
  wave("SMQ750", 4, 750, 380, 1500, 8.4, 503),
  wave("SMQ1250", 4, 1250, 630, 2500, 9.76, 816),
];

const ON_DEVICE = new Set(["Leistung", "Gebrückt", "70 V / 100 V", "Zonen", "Betrieb", "Hinweis"]);

function build(row: Row): DeviceTemplate {
  const slug = row.model.toLowerCase();
  // The total is what all channels deliver together — for a bridging amplifier that is the
  // low-impedance sum, which equals its one bridged line.
  const perChannel = row.bridgesPairs ? [row.rated.ohm2, row.rated.ohm4, row.rated.ohm8] : Object.values(row.rated);
  const highest = Math.max(...perChannel.filter((w): w is number => typeof w === "number"));
  const ampLoad: AmplifierLoadSpec = {
    channels: row.channels,
    ratedW: row.rated,
    totalRatedW: highest * row.channels,
    ...(row.minOhm ? { minImpedanceOhm: row.minOhm } : {}),
    ...(row.bridgesPairs ? { hiZBridgesPairs: true } : {}),
  };
  return {
    id: `face-audac-${slug}-0000-4000-8000-000000000001`,
    deviceType: "amplifier",
    label: `Audac ${row.model} (${row.text})`,
    shortName: row.model,
    manufacturer: "Audac",
    modelNumber: row.model,
    referenceUrl: `https://audac.eu/eu/products/d/${slug}`,
    searchTerms: ["audac", slug, "endstufe", "verstärker", "amplifier", `${row.channels}-kanal`, ...(row.terms ?? [])],
    powerDrawW: row.drawW,
    heightMm: row.size[1],
    widthMm: row.size[0],
    depthMm: row.size[2],
    weightKg: row.kg,
    // On the device: what it delivers and what the load check cannot say. The rest of
    // `facts` (form factor, supply, Dante option) documents the model in this file.
    auxiliaryData: row.facts
      .filter(([label]) => ON_DEVICE.has(label))
      .map(([label, value]) => ({ text: `${label}: ${value}` })),
    ports: row.ports.map(([label, signalType, direction, connectorType, section], i) => ({
      id: `port-audac-${slug}-${String(i + 1).padStart(3, "0")}`,
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
