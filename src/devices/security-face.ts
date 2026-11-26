import { DEFAULT_CONNECTOR } from "../connectorTypes";
import type { ConnectorType, DetectionSpec, DeviceTemplate, FloorplanSymbolShape, Port, SignalType } from "../types";

/**
 * The Telenot and Ajax components FACE actually buys and sells.
 *
 * The list is Odoo's (26.11.2026): every active Telenot / Ajax product on a confirmed sales
 * order or purchase order, minus what is never drawn — batteries, housings, spacer sets,
 * magnets, LSA strips, transponders, licences, plug-on boards and the hand-held key fob.
 * Colour and housing variants of one device are one entry.
 *
 * Figures are the makers' own. Telenot: the official "Ausschreibungstexte aller Telenot
 * Produkte" (article numbers, bus, VdS class, range and angle), cross-checked against the
 * histar, histar DUAL 360 and complex 200H brochures. Ajax: the spec pages and manuals on
 * ajax.systems. Where the maker states nothing, nothing is entered.
 *
 * Each model names its BHE symbol (`planSymbol.libraryId`) and, where a datasheet states a
 * reach, its detection area (`detection`) — a plan draws both without anyone picking them.
 * Shape and glyph are what is drawn where the BHE library is not installed.
 *
 * Telenot's buses are three different things and are kept apart: com2BUS (the panels' own
 * bus, "C2B"), BUS-1 (detector bus) and DSS2 (radio). Conventional detectors hang on a
 * detector group and have a contact, not a bus.
 *
 * Not in here, on purpose:
 *  - Signalgeber OAS-R: Telenot's current tender texts and brochures no longer list it.
 *  - EKS DL-485-TELE fibre converters: sold for Telenot buses but another maker's device.
 *  - "FMK 4 G2" is in Odoo as a radio contact; Telenot lists it as a wired flat contact,
 *    and that is how it is entered.
 */

const BHE = {
  pir: "1-einbruchmeldetechnik/infrarot-bewegungsmelder",
  dual: "1-einbruchmeldetechnik/dualmelder",
  ceiling: "1-einbruchmeldetechnik/infrarot-rundummelder",
  magnet: "1-einbruchmeldetechnik/magnetkontakt",
  bolt: "1-einbruchmeldetechnik/schliessblechkontakt",
  lock: "1-einbruchmeldetechnik/sperrelement",
  panic: "1-einbruchmeldetechnik/ueberfallmelder",
  smoke: "3-gefahrenwarnanlage-gwa-vornorm-din-vde-v-0826/rauchwarnmelder",
  heat: "5-brandmeldetechnik/waermemelder-maximal",
  sounder: "4-signalgeber/signalgeber-akustisch",
  siren: "4-signalgeber/sirene",
  keypad: "6-schalteinrichtungen-leser-depots/schalteinrichtung-geistig",
  reader: "6-schalteinrichtungen-leser-depots/ausweisleser",
  readerCode: "6-schalteinrichtungen-leser-depots/ausw-codeangabe",
  panelRemote: "12-zubehoer-kontakte-und-sonstiges/abgesetztes-bedienfeld",
  panel: "7-zentralen-busmodule-kuerzel/einbruchmelderzentrale",
  transmitter: "7-zentralen-busmodule-kuerzel/uebertragungsgeraet",
  radio: "7-zentralen-busmodule-kuerzel/funkkoppler",
  distributor: "7-zentralen-busmodule-kuerzel/verteiler",
  input: "7-zentralen-busmodule-kuerzel/anschaltmodul",
  output: "7-zentralen-busmodule-kuerzel/steuermodul",
  isolator: "7-zentralen-busmodule-kuerzel/isolatormodul",
  psu: "12-zubehoer-kontakte-und-sonstiges/netzgeraet",
} as const;

type P = [label: string, signal: SignalType, dir: Port["direction"], connector?: ConnectorType];

const line = (name: string, signal: SignalType): P[] => [[`${name} In`, signal, "input"], [`${name} Out`, signal, "output"]];
const C2B = line("com2BUS", "com2bus");
const B1 = line("BUS-1", "bus-1");
const FIBRA = line("Fibra", "fibra");
const DSS2: P = ["Funk DSS2", "dss2", "bidirectional"];
const JEWELLER: P = ["Jeweller", "jeweller", "bidirectional"];
/** A conventional detector: its contact goes to a detector group of a panel or module. */
const CONTACT: P = ["Kontakt", "contact-closure", "output"];
const many = (n: number, label: string, signal: SignalType, dir: Port["direction"]): P[] =>
  Array.from({ length: n }, (_, i): P => [`${label} ${i + 1}`, signal, dir]);

interface Entry {
  slug: string;
  deviceType: string;
  /** Model as the maker writes it; the label is "<maker> <text>". */
  model: string;
  text: string;
  article?: string;
  bhe: string;
  draw: [FloorplanSymbolShape, string];
  ports: P[];
  detection?: DetectionSpec;
  notes?: string;
  size?: [w: number, h: number, d: number];
  url?: string;
  terms?: string[];
}

const ROOM_15: DetectionSpec = { shape: "sector", rangeM: 15, apertureDeg: 90 };
const ROOM_12: DetectionSpec = { shape: "sector", rangeM: 12, apertureDeg: 90 };
const ROOM_10: DetectionSpec = { shape: "sector", rangeM: 10, apertureDeg: 90 };
// Telenot states the curtain as "ca. 3° horizontal": 25 m as a trap, 12 m for climb-through (VdS).
const CURTAIN_25: DetectionSpec = { shape: "sector", rangeM: 25, apertureDeg: 3 };
const HISTAR: [number, number, number] = [56, 117, 37];
const COMSTAR: [number, number, number] = [66, 140, 55];
const MOUNT_3M = "Montagehöhe bis max. 3 m";

const TELENOT: Entry[] = [
  // ── Bewegungsmelder com2BUS ──
  { slug: "histar-1015-c2b", deviceType: "motion-detector", model: "histar 1015-C2B", text: "Infrarot-Bewegungsmelder 15 m (com2BUS)", article: "100033910", bhe: BHE.pir, draw: ["triangle", "BM"], ports: C2B, detection: ROOM_15, notes: `15 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse B`, size: HISTAR },
  { slug: "histar-1015am-c2b", deviceType: "motion-detector", model: "histar 1015AM-C2B", text: "Infrarot-Bewegungsmelder 15 m mit Abdecküberwachung (com2BUS)", article: "100033912", bhe: BHE.pir, draw: ["triangle", "BM"], ports: C2B, detection: ROOM_15, notes: `15 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse C`, size: HISTAR },
  { slug: "histar-1025-c2b", deviceType: "motion-detector", model: "histar 1025-C2B", text: "Infrarot-Vorhangmelder 25 m (com2BUS)", article: "100033911", bhe: BHE.pir, draw: ["triangle", "VM"], ports: C2B, detection: CURTAIN_25, notes: `Vorhang ca. 3°: 25 m als Falle, 12 m für Durchstieg (VdS); ${MOUNT_3M}; VdS-Klasse B`, size: HISTAR, terms: ["vorhang"] },
  { slug: "histar-1025am-c2b", deviceType: "motion-detector", model: "histar 1025AM-C2B", text: "Infrarot-Vorhangmelder 25 m mit Abdecküberwachung (com2BUS)", article: "100033913", bhe: BHE.pir, draw: ["triangle", "VM"], ports: C2B, detection: CURTAIN_25, notes: `Vorhang ca. 3°: 25 m als Falle, 12 m für Durchstieg (VdS); ${MOUNT_3M}; VdS-Klasse C`, size: HISTAR, terms: ["vorhang"] },
  { slug: "histar-dual-1012am-c2b", deviceType: "motion-detector", model: "histar DUAL 1012AM-C2B", text: "IR-Mikrowellen-Bewegungsmelder 12 m mit Abdecküberwachung (com2BUS)", article: "100033915", bhe: BHE.dual, draw: ["triangle", "DM"], ports: C2B, detection: ROOM_12, notes: `12 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse C`, size: HISTAR, terms: ["dual", "mikrowelle"] },

  // ── Bewegungsmelder BUS-1 ──
  { slug: "histar-1015-b1", deviceType: "motion-detector", model: "histar 1015-B1", text: "Infrarot-Bewegungsmelder 15 m (BUS-1)", article: "100033900", bhe: BHE.pir, draw: ["triangle", "BM"], ports: B1, detection: ROOM_15, notes: `15 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse B`, size: HISTAR },
  { slug: "histar-1025-b1", deviceType: "motion-detector", model: "histar 1025-B1", text: "Infrarot-Vorhangmelder 25 m (BUS-1)", article: "100033901", bhe: BHE.pir, draw: ["triangle", "VM"], ports: B1, detection: CURTAIN_25, notes: `Vorhang ca. 3°: 25 m als Falle, 12 m für Durchstieg (VdS); ${MOUNT_3M}; VdS-Klasse B`, size: HISTAR, terms: ["vorhang"] },
  { slug: "histar-dual-1012-b1", deviceType: "motion-detector", model: "histar DUAL 1012-B1", text: "IR-Mikrowellen-Bewegungsmelder 12 m (BUS-1)", article: "100033904", bhe: BHE.dual, draw: ["triangle", "DM"], ports: B1, detection: ROOM_12, notes: `12 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse B`, size: HISTAR, terms: ["dual", "mikrowelle"] },
  // Ø 20 m is Telenot's figure at 5 m mounting height; no other height is stated.
  { slug: "histar-dual-b360-bus", deviceType: "motion-detector", model: "histar DUAL B360 BUS", text: "IR-Mikrowellen-Decken-Bewegungsmelder 360° (BUS-1)", article: "100033882", bhe: BHE.ceiling, draw: ["circle", "DM"], ports: B1, detection: { shape: "circle", rangeM: 10 }, notes: "Deckenmontage 2–5 m; Erfassung Ø 20 m bei 5 m Montagehöhe; VdS-Klasse B", size: [127, 55, 127], terms: ["decke", "360", "dual", "rundum"] },
  { slug: "comstar-pro-b15-bus", deviceType: "motion-detector", model: "comstar pro B15 BUS", text: "Infrarot-Bewegungsmelder 15 m (BUS-1)", article: "100033802", bhe: BHE.pir, draw: ["triangle", "BM"], ports: B1, detection: ROOM_15, notes: `15 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse B`, size: COMSTAR },
  { slug: "comstar-pro-c15-bus", deviceType: "motion-detector", model: "comstar pro C15 BUS", text: "Infrarot-Bewegungsmelder 15 m mit Abdecküberwachung (BUS-1)", article: "100033812", bhe: BHE.pir, draw: ["triangle", "BM"], ports: B1, detection: ROOM_15, notes: `15 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse C`, size: COMSTAR },
  { slug: "comstar-pro-dual-b10-bus", deviceType: "motion-detector", model: "comstar pro DUAL B10 BUS", text: "IR-Mikrowellen-Bewegungsmelder 10 m (BUS-1)", article: "100033822", bhe: BHE.dual, draw: ["triangle", "DM"], ports: B1, detection: ROOM_10, notes: `10 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse B`, size: COMSTAR, terms: ["dual", "mikrowelle"] },
  { slug: "comstar-pro-dual-c10-bus", deviceType: "motion-detector", model: "comstar pro DUAL C10 BUS", text: "IR-Mikrowellen-Bewegungsmelder 10 m mit Abdecküberwachung (BUS-1)", article: "100033832", bhe: BHE.dual, draw: ["triangle", "DM"], ports: B1, detection: ROOM_10, notes: `10 m / ca. 90°; ${MOUNT_3M}; VdS-Klasse C`, size: COMSTAR, terms: ["dual", "mikrowelle"] },
  { slug: "comstar-f215", deviceType: "motion-detector", model: "comstar F215", text: "Infrarot-Bewegungsmelder 15 m (Funk)", article: "100035960", bhe: BHE.pir, draw: ["triangle", "BM"], ports: [DSS2], detection: ROOM_15, notes: "15 m / ca. 90°; Batteriepack BP1; VdS-Klasse A", size: COMSTAR, terms: ["funk"] },

  // ── Kontakte ──
  { slug: "mk30", deviceType: "opening-detector", model: "MK30", text: "Magnetkontakt Ø 6 mm", article: "100091742", bhe: BHE.magnet, draw: ["circle", "MK"], ports: [CONTACT], notes: "Einbau- oder Aufbaumontage; VdS-Klasse B", terms: ["magnetkontakt", "reed"] },
  { slug: "mk4", deviceType: "opening-detector", model: "MK4", text: "Magnetkontakt Ø 8 mm", article: "100090042", bhe: BHE.magnet, draw: ["circle", "MK"], ports: [CONTACT], notes: "Einbaumontage; VdS-Klasse B", terms: ["magnetkontakt", "reed"] },
  { slug: "maxi-p-1004", deviceType: "opening-detector", model: "Magnetkontakt Maxi P 1004", text: "Magnetkontakt Maxi für größere Türen", article: "100091782", bhe: BHE.magnet, draw: ["circle", "MK"], ports: [CONTACT], notes: "Aufbaumontage; VdS-Klasse B", size: [72.5, 15.5, 14.5], terms: ["magnetkontakt"] },
  { slug: "fmk-4-g2", deviceType: "opening-detector", model: "FMK 4 G2", text: "Flacher Magnetkontakt für den Fensterfalz", article: "100091870", bhe: BHE.magnet, draw: ["circle", "MK"], ports: [CONTACT], notes: "verdeckte Montage, Anschlusskabel 3 m; VdS-Klasse B", size: [60, 5, 13], terms: ["magnetkontakt", "falz"] },
  { slug: "amk-4-g2", deviceType: "opening-detector", model: "AMK 4 G2", text: "Rolltorkontakt", article: "100093175", bhe: BHE.magnet, draw: ["circle", "RT"], ports: [CONTACT], notes: "für Roll-, Schiebe- und Schwingtore; VdS-Klasse B", size: [146, 16.5, 50], terms: ["rolltor", "magnetkontakt"] },
  { slug: "rk-15", deviceType: "opening-detector", model: "RK 15", text: "Riegelkontakt (Verschlussüberwachung)", article: "100093171", bhe: BHE.bolt, draw: ["circle", "RK"], ports: [CONTACT], notes: "Schließblechkontakt; VdS-Klasse C", size: [9, 30, 18], terms: ["riegelkontakt", "schließblech", "verschluss"] },
  { slug: "sperrelement-8320", deviceType: "opening-detector", model: "Sperrelement 8320.0", text: "Sperrelement mit Magnetkontakt", article: "100090880", bhe: BHE.lock, draw: ["square", "SE"], ports: [["12 V DC", "power", "input"], ["Ansteuerung", "contact-closure", "input"], ["Rückmeldung", "contact-closure", "output"], CONTACT], notes: "motorisch, Rückmeldung der Bolzenposition; VdS-Klasse C", size: [19, 135, 28], terms: ["sperrelement", "zwangsläufigkeit"] },
  { slug: "ms-232", deviceType: "opening-detector", model: "MS 232", text: "Funk-Meldersender mit 2 Magnetkontakten", article: "100035923", bhe: BHE.magnet, draw: ["circle", "MS"], ports: [DSS2, ["Eingang", "contact-closure", "input"]], notes: "1 zusätzlicher Eingang; Batteriepack BP1", size: [36, 160, 40], terms: ["funk", "meldersender", "magnetkontakt"] },
  { slug: "ms-221", deviceType: "opening-detector", model: "MS 221", text: "Funk-Meldersender mit Magnetkontakt", article: "100035915", bhe: BHE.magnet, draw: ["circle", "MS"], ports: [DSS2, ...many(2, "Eingang", "contact-closure", "input")], notes: "2 zusätzliche Eingänge; Batteriepack BP3", size: [26, 170, 25.5], terms: ["funk", "meldersender", "magnetkontakt"] },
  { slug: "hmk-2", deviceType: "panic-button", model: "HMK 2", text: "Überfallmelder", article: "100090214", bhe: BHE.panic, draw: ["circle", "ÜM"], ports: [CONTACT], notes: "versenkte Drucktaste unter Papierplombe; VdS-Klasse C", size: [82, 82, 47], terms: ["überfall", "panik"] },

  // ── Rauch und Wärme ──
  { slug: "hd-3002-o-bus-1", deviceType: "smoke-detector", model: "HD 3002 O BUS-1", text: "Rauchwarnmelder optisch (BUS-1)", article: "100078980", bhe: BHE.smoke, draw: ["circle", "RM"], ports: B1, notes: "max. 60 m² Überwachungsfläche; über 85 dB(A); EN 14604", size: [100, 55, 100], terms: ["rauchmelder", "rauchwarnmelder"] },
  { slug: "hdv-3002-ts-bus-1", deviceType: "heat-detector", model: "HDv 3002 TS BUS-1", text: "Thermowarnmelder (BUS-1)", article: "100078983", bhe: BHE.heat, draw: ["circle", "WM"], ports: B1, notes: "max. 60 m² Überwachungsfläche; über 85 dB(A); Sensorik EN 54-5 Klasse A1", size: [100, 62, 100], terms: ["wärmemelder", "thermomelder", "hitze"] },

  // ── Signalgeber ──
  { slug: "as270-d", deviceType: "siren-indoor", model: "AS270-D", text: "Intern-Signalgeber akustisch", article: "100090186", bhe: BHE.sounder, draw: ["diamond", "SI"], ports: [["12 V DC", "power", "input"], ["Ansteuerung", "contact-closure", "input"]], notes: "Aufputz, innen; VdS-Klasse C", size: [155, 114, 44], terms: ["sirene", "signalgeber", "innen"] },
  { slug: "as271-d", deviceType: "siren-indoor", model: "AS271-D", text: "Intern-Signalgeber optisch-akustisch", article: "100090187", bhe: BHE.sounder, draw: ["diamond", "SI"], ports: [["12 V DC", "power", "input"], ["Ansteuerung", "contact-closure", "input"]], notes: "Sirene und weißer LED-Blitz, Aufputz, innen; VdS-Klasse C", size: [155, 114, 44], terms: ["sirene", "signalgeber", "blitz", "innen"] },
  { slug: "hiflac", deviceType: "siren-outdoor", model: "hiflac", text: "Extern-Signalgeber optisch-akustisch", article: "100059410", bhe: BHE.siren, draw: ["diamond", "AS"], ports: [["12 V DC", "power", "input"], ["Ansteuerung", "contact-closure", "input"], ["Sabotage", "contact-closure", "output"]], notes: "Druckkammerlautsprecher mit Blitzleuchte; VdS-Klasse C / EN 50131-4 Grad 3", size: [125, 320, 148], terms: ["außensirene", "signalgeber", "blitz"] },
  { slug: "roshni", deviceType: "siren-indoor", model: "Warntonsirene Roshni", text: "Warntonsirene (32 Töne)", article: "100078850", bhe: BHE.siren, draw: ["diamond", "SI"], ports: [["12–28 V DC", "power", "input"]], notes: "konventionell; EN 54-3", size: [93, 93, 63], terms: ["sirene", "warnton"] },

  // ── Bedienen und Zutritt ──
  { slug: "bt-800-ap", deviceType: "alarm-keypad", model: "BT 800 aP", text: "Touch-Bedienteil 7\" Aufputz (com2BUS)", article: "100076700", bhe: BHE.panelRemote, draw: ["square", "BT"], ports: C2B, notes: "VdS-Klasse C / EN 50131-3 Grad 3", size: [205, 144, 35], terms: ["bedienteil", "touch"] },
  { slug: "cryplock-blm10-d", deviceType: "transponder-reader", model: "cryplock BLM10 D", text: "RFID-Leser", article: "100077600", bhe: BHE.reader, draw: ["square", "L"], ports: [["Leser-Schnittstelle", "serial", "bidirectional", "terminal-block"]], notes: "MIFARE DESFire / Classic; Anschluss an ein Türmodul; VdS-Klasse C", size: [82, 95, 18], terms: ["leser", "rfid", "transponder", "scharfschalten"] },
  { slug: "cryplock-blm10-k-d", deviceType: "transponder-reader", model: "cryplock BLM10/K D", text: "RFID-Tastatur-Leser", article: "100077620", bhe: BHE.readerCode, draw: ["square", "LT"], ports: [["Leser-Schnittstelle", "serial", "bidirectional", "terminal-block"]], notes: "MIFARE DESFire / Classic mit Tastatur; Anschluss an ein Türmodul; VdS-Klasse C", size: [82, 167, 18], terms: ["leser", "rfid", "tastatur", "code"] },
  { slug: "cryplock-blm10-duo", deviceType: "transponder-reader", model: "cryplock BLM10 DUO", text: "RFID-Schreib-Leser (RS-485)", article: "100097155", bhe: BHE.reader, draw: ["square", "L"], ports: [["RS-485", "rs485", "bidirectional", "terminal-block"]], notes: "MIFARE DESFire / Classic; VdS-Klasse C", size: [82, 95, 18], terms: ["leser", "rfid", "transponder"] },
  { slug: "cryplock-blm10-k-duo", deviceType: "transponder-reader", model: "cryplock BLM10/K DUO", text: "RFID-Tastatur-Schreib-Leser (RS-485)", article: "100097158", bhe: BHE.readerCode, draw: ["square", "LT"], ports: [["RS-485", "rs485", "bidirectional", "terminal-block"]], notes: "MIFARE DESFire / Classic mit Tastatur; VdS-Klasse C", size: [82, 167, 18], terms: ["leser", "rfid", "tastatur", "code"] },
  { slug: "comlock-410", deviceType: "alarm-expander", model: "comlock 410", text: "Türmodul (com2BUS)", article: "100075740", bhe: BHE.input, draw: ["square", "TM"], ports: [...C2B, ["Leser", "serial", "bidirectional", "terminal-block"], ...many(5, "Eingang", "contact-closure", "input"), ["Relais", "contact-closure", "output"]], notes: "Tür-Peripherie am com2BUS: 1 Leser, 5 Eingänge, 5 Ausgänge, 1 Relais; VdS-Klasse C", size: [75, 115, 27], terms: ["türmodul", "tür"] },

  // ── Module ──
  { slug: "mi20-c2b-b1", deviceType: "alarm-expander", model: "MI20-C2B/B1", text: "Eingangsmodul, 2 Eingänge (com2BUS / BUS-1)", article: "100075590", bhe: BHE.input, draw: ["square", "EM"], ports: [["com2BUS", "com2bus", "bidirectional"], ["BUS-1", "bus-1", "bidirectional"], ...many(2, "Eingang", "contact-closure", "input")], notes: "für konventionelle Melder; am com2BUS oder am BUS-1, nicht beides; VdS-Klasse C", size: [136, 51, 26], terms: ["eingangsmodul", "meldergruppe"] },
  { slug: "mio22-c2b-b1", deviceType: "alarm-expander", model: "MIO22-C2B/B1", text: "Ein-Ausgangsmodul, 2 Eingänge / 2 Relais (com2BUS / BUS-1)", article: "100075582", bhe: BHE.input, draw: ["square", "EA"], ports: [["com2BUS", "com2bus", "bidirectional"], ["BUS-1", "bus-1", "bidirectional"], ...many(2, "Eingang", "contact-closure", "input"), ...many(2, "Relais", "contact-closure", "output")], notes: "am com2BUS oder am BUS-1, nicht beides; VdS-Klasse C", size: [136, 101, 26], terms: ["ein-ausgangsmodul", "relais"] },
  { slug: "smb-140-h4", deviceType: "alarm-expander", model: "SMB 140 H4", text: "Schaltmodul, 4 Relais (BUS-1)", article: "100075535", bhe: BHE.output, draw: ["square", "SM"], ports: [...B1, ...many(4, "Relais", "contact-closure", "output")], notes: "4 potenzialfreie Wechsler 16 A, Hutschiene", size: [72, 90, 62], terms: ["schaltmodul", "relais"] },
  { slug: "iso-expander-c2b", deviceType: "alarm-expander", model: "ISO-Expander C2B", text: "Erweiterungsplatine, 3 getrennte com2BUS-Stränge", article: "100076880", bhe: BHE.isolator, draw: ["square", "ISO"], ports: [["com2BUS In", "com2bus", "input"], ...many(3, "com2BUS Strang", "com2bus", "bidirectional")], notes: "entkoppelt den com2BUS der hiplex in 3 galvanisch getrennte Stränge", size: [91.5, 70.5, 20], terms: ["expander", "trennung"] },
  // Telenot does not name the link to the hiplex in the tender text, so it has no port here.
  { slug: "hislave-8000", deviceType: "alarm-expander", model: "hislave 8000", text: "Erweiterungsplatine für hiplex 8400H", article: "100076881", bhe: BHE.input, draw: ["square", "HS"], ports: [["AC In", "power", "input"], ...many(2, "BUS-1 Strang", "bus-1", "bidirectional"), ...many(16, "Meldergruppe", "contact-closure", "input"), ...many(2, "Relais", "contact-closure", "output")], notes: "16 Meldergruppen, 2 BUS-1-Stränge, 21 Transistorausgänge, 2 Relais; Anbindung an die hiplex laut Technischer Beschreibung", size: [287, 168, 60], terms: ["erweiterung", "hiplex"] },

  // ── Zentralen ──
  { slug: "hiplex-8400h", deviceType: "alarm-panel", model: "hiplex 8400H", text: "Einbruchmelderzentrale VdS C / Grad 3", article: "100076820", bhe: BHE.panel, draw: ["square", "Z"], ports: [["AC In", "power", "input"], ["LAN", "ethernet", "bidirectional"], ...many(3, "com2BUS", "com2bus", "bidirectional"), ...many(2, "BUS-1 Strang", "bus-1", "bidirectional"), ...many(16, "Meldergruppe", "contact-closure", "input"), ...many(3, "Relais", "contact-closure", "output")], notes: "3 com2BUS, 2 BUS-1-Stränge mit je 63 Adressen, 16 Meldergruppen, 21 Transistorausgänge, 3 Relais; Gehäuse GR80", size: [310, 275, 126], terms: ["zentrale", "emz", "einbruchmelderzentrale", "hiplex"] },
  { slug: "complex-200h-fk", deviceType: "alarm-panel", model: "complex 200H-FK", text: "Einbruchmelderzentrale VdS A / Grad 2", article: "100075240", bhe: BHE.panel, draw: ["square", "Z"], ports: [["AC In", "power", "input"], ["com2BUS", "com2bus", "bidirectional"], ["BUS-1 Strang", "bus-1", "bidirectional"], ...many(8, "Meldergruppe", "contact-closure", "input"), ...many(3, "Relais", "contact-closure", "output")], notes: "1 com2BUS, 1 BUS-1-Strang, 8 Meldergruppen, 15 Transistorausgänge, 3 Relais; Gehäuse GR80", size: [310, 275, 126], terms: ["zentrale", "emz", "einbruchmelderzentrale", "complex", "200h"] },

  // ── Übertragung und Funk ──
  { slug: "hiline1-eth-lte", deviceType: "alarm-transmitter", model: "hiline1 ETH/LTE", text: "Übertragungseinrichtung Ethernet + Mobilfunk", article: "100072208", bhe: BHE.transmitter, draw: ["square", "ÜG"], ports: [["12 V DC", "power", "input"], ...many(2, "LAN", "ethernet", "bidirectional"), ["com2BUS (RS-485)", "com2bus", "bidirectional"], ...many(4, "Eingang", "contact-closure", "input"), ["Relais", "contact-closure", "output"]], notes: "2 Übertragungswege; Einbausatz; EN 50136-2 / EN 54-21", size: [102, 70, 22], terms: ["übertragung", "wählgerät", "lte", "leitstelle"] },
  { slug: "fgw-210", deviceType: "radio-extender", model: "FGW 210", text: "Funk-Gateway DSS2 (com2BUS)", article: "100075905", bhe: BHE.radio, draw: ["diamond", "FG"], ports: [["com2BUS", "com2bus", "bidirectional"], DSS2], notes: "für complex 200H / 400H; VdS-Klasse A", size: [92, 71, 20], terms: ["funk", "gateway"] },
  { slug: "fgw230", deviceType: "radio-extender", model: "FGW230", text: "Funk-Gateway DSS2 / DSS3 (com2BUS)", article: "100076883", bhe: BHE.radio, draw: ["diamond", "FG"], ports: [["com2BUS", "com2bus", "bidirectional"], DSS2], notes: "für hiplex; Einbausatz; VdS-Klasse A", size: [92, 71, 20], terms: ["funk", "gateway"] },

  // ── Versorgung und Verteilung ──
  { slug: "nt1210", deviceType: "alarm-power-supply", model: "NT1210", text: "Einbau-Netzteil 12 V DC", article: "100046070", bhe: BHE.psu, draw: ["square", "NT"], ports: [["AC In", "power", "input"], ...many(2, "12 V DC Out", "power", "output"), ["com2BUS", "com2bus", "bidirectional"]], notes: "Dauerstrom je nach Überbrückungszeit (Technische Beschreibung); VdS-Klasse C", size: [147, 99, 54], terms: ["netzteil", "energieversorgung"] },
  { slug: "ntz-400", deviceType: "alarm-power-supply", model: "NTZ 400", text: "Zusatznetzteil 12 V DC im Gehäuse GR80", article: "100046063", bhe: BHE.psu, draw: ["square", "NT"], ports: [["AC In", "power", "input"], ["12 V DC Out", "power", "output"]], notes: "Dauerstrom je nach Überbrückungszeit (Technische Beschreibung)", size: [310, 275, 126], terms: ["netzteil", "zusatznetzteil", "energieversorgung"] },
  { slug: "mv3-lsa-8da", deviceType: "alarm-distributor", model: "MV3 LSA-8DA", text: "Verteiler LSA-Plus, 8 Doppeladern", article: "100058180", bhe: BHE.distributor, draw: ["square", "V"], ports: [["Adern (LSA)", "contact-closure", "bidirectional", "krone-idc"]], notes: "Aufputz, Gehäuse K11, Deckelkontakt; VdS-Klasse C", size: [136, 51, 26], terms: ["verteiler", "lsa"] },
  { slug: "mv3-lsa-16da", deviceType: "alarm-distributor", model: "MV3 LSA-16DA", text: "Verteiler LSA-Plus, 16 Doppeladern", article: "100058181", bhe: BHE.distributor, draw: ["square", "V"], ports: [["Adern (LSA)", "contact-closure", "bidirectional", "krone-idc"]], notes: "Aufputz, Gehäuse K21, Deckelkontakt; VdS-Klasse C", size: [136, 101, 26], terms: ["verteiler", "lsa"] },
  { slug: "mv3-lsa-5da-up", deviceType: "alarm-distributor", model: "MV3 LSA-5DA uP", text: "Unterputz-Verteiler LSA-Plus, 5 Doppeladern", article: "100058183", bhe: BHE.distributor, draw: ["square", "V"], ports: [["Adern (LSA)", "contact-closure", "bidirectional", "krone-idc"]], notes: "Dosenverteiler mit Deckelkontakt; VdS-Klasse C", size: [75.5, 75.5, 20], terms: ["verteiler", "lsa", "unterputz"] },
  { slug: "vt-60-da", deviceType: "alarm-distributor", model: "VT 60 DA", text: "Verteiler LSA-Plus, 60 Doppeladern", article: "100058201", bhe: BHE.distributor, draw: ["square", "V"], ports: [["Adern (LSA)", "contact-closure", "bidirectional", "krone-idc"]], notes: "Aufputz, Stahlblechgehäuse S4; VdS-Klasse C", size: [310, 110, 47], terms: ["verteiler", "lsa"] },
];

const AJAX_URL = (slug: string) => `https://ajax.systems/products/${slug}/`;

const AJAX: Entry[] = [
  { slug: "superior-motionprotect-plus-g3-fibra", deviceType: "motion-detector", model: "Superior MotionProtect Plus G3 Fibra", text: "IR-Mikrowellen-Bewegungsmelder 15 m (Fibra)", bhe: BHE.dual, draw: ["triangle", "DM"], ports: FIBRA, detection: ROOM_15, notes: "15 m / 90°; Montagehöhe 2,4 m; Anti-Masking; keine Haustier-Immunität; Grad 3", size: [62, 120, 52], terms: ["dual", "mikrowelle", "verdrahtet", "superior"] },
  { slug: "superior-motioncam-phod-jeweller", deviceType: "motion-detector", model: "Superior MotionCam (PhOD) Jeweller", text: "Bewegungsmelder mit Fotoverifikation 12 m (Funk)", bhe: BHE.pir, draw: ["triangle", "MC"], ports: [JEWELLER], detection: { shape: "sector", rangeM: 12, apertureDeg: 88.5 }, notes: "12 m / 88,5°; Montagehöhe 2,4 m; Haustier-Immunität bis 20 kg; Grad 2", size: [70, 135, 60], terms: ["foto", "kamera", "funk", "superior"] },
  { slug: "superior-motioncam-am-phod-jeweller", deviceType: "motion-detector", model: "Superior MotionCam AM (PhOD) Jeweller", text: "Bewegungsmelder mit Fotoverifikation und Anti-Masking 12 m (Funk)", bhe: BHE.pir, draw: ["triangle", "MC"], ports: [JEWELLER], detection: { shape: "sector", rangeM: 12, apertureDeg: 92 }, notes: "12 m / 92°; Montagehöhe 2,4 m; keine Haustier-Immunität; Grad 2", size: [70, 134, 59], terms: ["foto", "kamera", "funk", "anti-masking", "superior"] },
  { slug: "superior-doorprotect-plus-jeweller", deviceType: "opening-detector", model: "Superior DoorProtect Plus Jeweller", text: "Öffnungsmelder mit Erschütterungs- und Neigungssensor (Funk)", bhe: BHE.magnet, draw: ["circle", "ÖM"], ports: [JEWELLER, ["Fremdmelder (NC)", "contact-closure", "input"]], notes: "Magnetabstand bis 1 cm (klein) / 2 cm (groß); Grad 2", size: [22, 103, 21], terms: ["magnetkontakt", "öffnungsmelder", "funk", "superior"] },
  { slug: "superior-button-jeweller", deviceType: "panic-button", model: "Superior Button Jeweller", text: "Paniktaster (Funk)", bhe: BHE.panic, draw: ["circle", "ÜM"], ports: [JEWELLER], notes: "Grad 2; IP55", size: [47, 35, 13], terms: ["panik", "überfall", "taster", "funk", "superior"] },
  { slug: "superior-keypad-touchscreen-fibra", deviceType: "alarm-keypad", model: "Superior KeyPad TouchScreen Fibra", text: "Bedienteil mit Touchscreen (Fibra)", bhe: BHE.keypad, draw: ["square", "BT"], ports: FIBRA, notes: "DESFire EV1 / EV2; Grad 3; IP30", size: [171, 82, 28], terms: ["bedienteil", "touch", "verdrahtet", "superior"] },
  { slug: "superior-keypad-outdoor-fibra", deviceType: "alarm-keypad", model: "Superior KeyPad Outdoor Fibra", text: "Außen-Bedienteil mit Leser (Fibra)", bhe: BHE.readerCode, draw: ["square", "BT"], ports: FIBRA, notes: "DESFire EV1 / EV2 / EV3; Grad 3; IP66, IK08", size: [45, 137, 27], terms: ["bedienteil", "außen", "leser", "verdrahtet", "superior"] },
  { slug: "superior-multitransmitter-io-4x4-fibra", deviceType: "alarm-expander", model: "Superior MultiTransmitter IO (4X4) Fibra", text: "Ein-Ausgangsmodul 4 / 4 (Fibra)", bhe: BHE.input, draw: ["square", "MT"], ports: [...FIBRA, ...many(4, "Eingang", "contact-closure", "input"), ...many(2, "Relais", "contact-closure", "output"), ...many(2, "Ausgang", "contact-closure", "output"), ["12 V DC Out", "power", "output"]], notes: "4 Eingänge, 2 Relais (1 A), 2 Logikausgänge (25 mA), Hilfsspannung 12 V / 500 mA; Platine für Ajax Case; Grad 3", size: [93, 55, 27], terms: ["fremdmelder", "integration", "relais", "verdrahtet", "superior"] },
  { slug: "fireprotect-2-smoke-heat-co", deviceType: "smoke-detector", model: "FireProtect 2 RB (Heat/Smoke/CO)", text: "Rauch-, Wärme- und CO-Melder (Funk)", bhe: BHE.smoke, draw: ["circle", "RM"], ports: [JEWELLER], notes: "50–60 m² je Melder, in Fluren höchstens 7,5 m Abstand; Deckenmitte; EN 14604 / EN 50291-1", size: [124, 45, 124], terms: ["rauchmelder", "rauchwarnmelder", "co", "funk"] },
];

function build(maker: "Telenot" | "Ajax Systems", prefix: string, e: Entry): DeviceTemplate {
  const brand = maker === "Telenot" ? "Telenot" : "Ajax";
  return {
    id: `face-sec-${prefix}-${e.slug}`,
    deviceType: e.deviceType,
    label: `${brand} ${e.model} — ${e.text}`,
    shortName: e.model,
    manufacturer: maker,
    modelNumber: e.article ? `${e.model} (Art. ${e.article})` : e.model,
    referenceUrl: maker === "Telenot" ? "https://www.telenot.com/de/produkte" : AJAX_URL(e.slug),
    searchTerms: [brand.toLowerCase(), ...e.model.toLowerCase().split(/[\s/()]+/).filter(Boolean), ...(e.article ? [e.article] : []), ...(e.terms ?? [])],
    planSymbol: { shape: e.draw[0], glyph: e.draw[1], libraryId: e.bhe },
    ...(e.detection ? { detection: e.detection } : {}),
    ...(e.notes ? { installNotes: e.notes } : {}),
    ...(e.size ? { widthMm: e.size[0], heightMm: e.size[1], depthMm: e.size[2] } : {}),
    ports: e.ports.map(([label, signalType, direction, connectorType], i) => ({
      id: `port-sec-${prefix}-${e.slug}-${i + 1}`,
      label,
      signalType,
      direction,
      connectorType: connectorType ?? DEFAULT_CONNECTOR[signalType],
    })),
  };
}

export const templates: DeviceTemplate[] = [
  ...TELENOT.map((e) => build("Telenot", "tn", e)),
  ...AJAX.map((e) => build("Ajax Systems", "ajax", e)),
];
