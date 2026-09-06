import { port } from "./_helpers";
import type { DeviceTemplate } from "../types";

/**
 * Wi-Fi access points — Ubiquiti UniFi, Wi-Fi 7 generation.
 *
 * Each carries a `wifi` radio spec (bands, transmit power, antenna gain) which is what
 * the floorplan's Wi-Fi heatmap propagates. It sits on the template the way speakerLoad
 * does: the model supplies the starting figures, the installation overrides them.
 *
 * ── On the figures ──────────────────────────────────────────────────────────────────
 * `txDbm` is a planning default, not a fact about your site: UniFi's transmit power is
 * configurable and its "auto" setting moves it around, and EU regulation caps EIRP
 * (20 dBm at 2.4 GHz, 23 dBm at 5 GHz, 23 dBm for 6 GHz low-power indoor) — which is
 * transmit power *plus* antenna gain. The values here stay inside those caps. Set the
 * power you actually configured before a heatmap goes to a customer, and check the
 * antenna gains against the current datasheet; they differ per band and per model.
 *
 * U7 Lite and U7 Outdoor are dual-band (2.4 + 5 GHz) — they have no 6 GHz radio, so a
 * 6 GHz heatmap correctly shows nothing for them.
 */
export const templates: DeviceTemplate[] = [
  {
    id: "c0a80101-0ba3-4000-8000-000000000201",
    deviceType: "access-point",
    label: "UniFi U7 Pro",
    shortName: "U7 Pro",
    manufacturer: "Ubiquiti",
    modelNumber: "U7-Pro",
    referenceUrl: "https://techspecs.ui.com/unifi/wifi/u7-pro",
    searchTerms: ["unifi", "ubiquiti", "u7", "wifi 7", "wlan", "access point", "ap", "6ghz", "tri-band", "poe"],
    planSymbol: { shape: "circle", glyph: "AP" },
    poeDrawW: 21,
    voltage: "PoE+ (802.3at)",
    wifi: {
      bands: ["2.4", "5", "6"],
      txDbm: { "2.4": 16, "5": 17, "6": 17 },
      gainDbi: { "2.4": 4, "5": 6, "6": 6 },
    },
    ports: [
      port("LAN (2.5 GbE, PoE+ In)", "ethernet", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba3-4000-8000-000000000202",
    deviceType: "access-point",
    label: "UniFi U7 Pro Max",
    shortName: "U7 Pro Max",
    manufacturer: "Ubiquiti",
    modelNumber: "U7-Pro-Max",
    referenceUrl: "https://techspecs.ui.com/unifi/wifi/u7-pro-max",
    searchTerms: ["unifi", "ubiquiti", "u7", "pro max", "wifi 7", "wlan", "access point", "ap", "6ghz", "poe"],
    planSymbol: { shape: "circle", glyph: "AP" },
    poeDrawW: 26,
    voltage: "PoE+ (802.3at)",
    wifi: {
      bands: ["2.4", "5", "6"],
      txDbm: { "2.4": 16, "5": 17, "6": 17 },
      gainDbi: { "2.4": 4, "5": 6, "6": 6 },
    },
    ports: [
      port("LAN (2.5 GbE, PoE+ In)", "ethernet", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba3-4000-8000-000000000203",
    deviceType: "access-point",
    label: "UniFi U7 Pro Wall",
    shortName: "U7 Pro Wall",
    manufacturer: "Ubiquiti",
    modelNumber: "U7-Pro-Wall",
    referenceUrl: "https://techspecs.ui.com/unifi/wifi/u7-pro-wall",
    searchTerms: ["unifi", "ubiquiti", "u7", "wall", "wandmontage", "wifi 7", "wlan", "access point", "ap", "6ghz"],
    planSymbol: { shape: "square", glyph: "AP" },
    installNotes: "Wandmontage — richtwirkend in den Raum",
    poeDrawW: 21,
    voltage: "PoE+ (802.3at)",
    wifi: {
      bands: ["2.4", "5", "6"],
      txDbm: { "2.4": 16, "5": 17, "6": 17 },
      gainDbi: { "2.4": 4, "5": 6, "6": 6 },
      // Wall-mounted: its coverage area starts as a sector aimed off the wall.
      mount: "wall",
    },
    ports: [
      port("LAN (2.5 GbE, PoE+ In)", "ethernet", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba3-4000-8000-000000000204",
    deviceType: "access-point",
    label: "UniFi U7 Lite",
    shortName: "U7 Lite",
    manufacturer: "Ubiquiti",
    modelNumber: "U7-Lite",
    referenceUrl: "https://techspecs.ui.com/unifi/wifi/u7-lite",
    searchTerms: ["unifi", "ubiquiti", "u7", "lite", "wifi 7", "wlan", "access point", "ap", "dual-band", "poe"],
    planSymbol: { shape: "circle", glyph: "AP" },
    poeDrawW: 12,
    voltage: "PoE (802.3af)",
    wifi: {
      // Dual-band: no 6 GHz radio at all.
      bands: ["2.4", "5"],
      txDbm: { "2.4": 16, "5": 17 },
      gainDbi: { "2.4": 3, "5": 5 },
    },
    ports: [
      port("LAN (1 GbE, PoE In)", "ethernet", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba3-4000-8000-000000000205",
    deviceType: "access-point",
    label: "UniFi U7 Outdoor",
    shortName: "U7 Outdoor",
    manufacturer: "Ubiquiti",
    modelNumber: "U7-Outdoor",
    referenceUrl: "https://techspecs.ui.com/unifi/wifi/u7-outdoor",
    searchTerms: ["unifi", "ubiquiti", "u7", "outdoor", "aussen", "wifi 7", "wlan", "access point", "ap", "poe"],
    planSymbol: { shape: "circle", glyph: "AA" },
    installNotes: "Außenbereich, IP55",
    poeDrawW: 21,
    voltage: "PoE+ (802.3at)",
    wifi: {
      bands: ["2.4", "5"],
      txDbm: { "2.4": 16, "5": 17 },
      gainDbi: { "2.4": 4, "5": 6 },
    },
    ports: [
      port("LAN (1 GbE, PoE+ In)", "ethernet", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba3-4000-8000-000000000206",
    deviceType: "access-point",
    label: "UniFi U7 IW (In-Wall)",
    shortName: "U7 IW",
    manufacturer: "Ubiquiti",
    modelNumber: "U7-IW",
    referenceUrl: "https://techspecs.ui.com/unifi/wifi/u7-iw",
    searchTerms: ["unifi", "ubiquiti", "u7", "in-wall", "iw", "unterputz", "wifi 7", "wlan", "access point", "ap"],
    planSymbol: { shape: "square", glyph: "AP" },
    installNotes: "Unterputz-Montage, mit LAN-Durchschleifung",
    poeDrawW: 21,
    voltage: "PoE+ (802.3at)",
    wifi: {
      bands: ["2.4", "5", "6"],
      txDbm: { "2.4": 16, "5": 17, "6": 17 },
      gainDbi: { "2.4": 3, "5": 5, "6": 5 },
      mount: "wall",
    },
    ports: [
      port("LAN In (2.5 GbE, PoE+ In)", "ethernet", "input"),
      port("LAN Out (1 GbE, PoE Out)", "ethernet", "output"),
    ],
  },
  {
    id: "c0a80101-0ba3-4000-8000-000000000207",
    deviceType: "access-point",
    label: "UniFi E7",
    shortName: "E7",
    manufacturer: "Ubiquiti",
    modelNumber: "E7",
    referenceUrl: "https://techspecs.ui.com/unifi/wifi/e7",
    searchTerms: ["unifi", "ubiquiti", "e7", "wifi 7", "wlan", "access point", "ap", "6ghz", "10gbe", "flagship"],
    planSymbol: { shape: "circle", glyph: "E7" },
    poeDrawW: 40,
    voltage: "PoE++ (802.3bt)",
    wifi: {
      bands: ["2.4", "5", "6"],
      txDbm: { "2.4": 16, "5": 17, "6": 17 },
      gainDbi: { "2.4": 4, "5": 6, "6": 6 },
    },
    ports: [
      port("LAN (10 GbE, PoE++ In)", "ethernet", "bidirectional"),
    ],
  },
];
