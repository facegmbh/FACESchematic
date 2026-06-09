import { port, ports } from "./_helpers";
import type { DeviceTemplate } from "../types";

/**
 * KNX and DALI building-automation devices.
 *
 * Signal types:
 *   - "knx"  → KNX TP bus (twisted pair, polarity-aware bus terminal). KNX/IP uses the
 *              "ethernet" ports alongside the bus.
 *   - "dali" → DALI / DALI-2 lighting control bus (2-core, polarity-free).
 *
 * Both are bus topologies — ports default to multi-connect so many devices can share one
 * line (see MULTI_CONNECT_DEFAULT_SIGNALS in connectorTypes.ts). Switched / dimmed loads on
 * actuators are modelled as "power" outputs.
 */
export const templates: DeviceTemplate[] = [
  // ── KNX: Infrastructure ──────────────────────────────────────────
  {
    id: "c0a80101-0ba1-4000-8000-000000000a01",
    deviceType: "knx-power-supply",
    label: "MDT KNX Power Supply 640mA",
    manufacturer: "MDT",
    modelNumber: "STC-0640.02",
    referenceUrl: "https://www.mdt.de/en/products/system-devices/power-supplies.html",
    searchTerms: ["knx", "power supply", "psu", "640ma", "mdt", "bus power"],
    powerDrawW: 12,
    voltage: "230V",
    heightMm: 90,
    widthMm: 72, // 4 DIN modules
    depthMm: 63,
    weightKg: 0.3,
    ports: [
      port("AC In", "power", "input"),
      port("KNX Bus", "knx", "output"),
      port("KNX Bus (unchoked)", "knx", "output"),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a02",
    deviceType: "knx-ip-router",
    label: "MDT KNX IP Router",
    manufacturer: "MDT",
    modelNumber: "SCN-IP000.03",
    referenceUrl: "https://www.mdt.de/en/products/system-devices/ip-router.html",
    searchTerms: ["knx", "ip router", "knxnet/ip", "line coupler", "mdt"],
    powerDrawW: 5,
    heightMm: 90,
    widthMm: 36, // 2 DIN modules
    depthMm: 63,
    weightKg: 0.13,
    ports: [
      port("LAN (KNX/IP)", "ethernet", "bidirectional"),
      port("KNX Bus", "knx", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a03",
    deviceType: "knx-ip-interface",
    label: "Gira KNX/IP Interface",
    manufacturer: "Gira",
    modelNumber: "216800",
    referenceUrl: "https://www.gira.com/en/en/products",
    searchTerms: ["knx", "ip interface", "knxnet/ip", "commissioning", "gira", "ets"],
    powerDrawW: 4,
    heightMm: 90,
    widthMm: 36,
    depthMm: 63,
    weightKg: 0.1,
    ports: [
      port("LAN", "ethernet", "bidirectional"),
      port("KNX Bus", "knx", "bidirectional"),
    ],
  },

  // ── KNX: Actuators ───────────────────────────────────────────────
  {
    id: "c0a80101-0ba1-4000-8000-000000000a04",
    deviceType: "knx-actuator",
    label: "MDT Switch Actuator 8-fold",
    manufacturer: "MDT",
    modelNumber: "AKK-0816.03",
    referenceUrl: "https://www.mdt.de/en/products/actuators/switch-actuators.html",
    searchTerms: ["knx", "switch actuator", "relay", "8 channel", "mdt", "schaltaktor"],
    powerDrawW: 3,
    heightMm: 90,
    widthMm: 144, // 8 DIN modules
    depthMm: 63,
    weightKg: 0.45,
    ports: [
      port("KNX Bus", "knx", "bidirectional"),
      ...ports("Out", "power", "output", 8),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a05",
    deviceType: "knx-dimmer",
    label: "MDT Universal Dimming Actuator 4-fold",
    manufacturer: "MDT",
    modelNumber: "AKD-0401.02",
    referenceUrl: "https://www.mdt.de/en/products/actuators/dimming-actuators.html",
    searchTerms: ["knx", "dimmer", "dimming actuator", "universal", "4 channel", "mdt"],
    powerDrawW: 4,
    heightMm: 90,
    widthMm: 72, // 4 DIN modules
    depthMm: 63,
    weightKg: 0.35,
    ports: [
      port("KNX Bus", "knx", "bidirectional"),
      ...ports("Dim Out", "power", "output", 4),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a06",
    deviceType: "knx-blind-actuator",
    label: "MDT Blind/Shutter Actuator 4-fold",
    manufacturer: "MDT",
    modelNumber: "JAL-0410.02",
    referenceUrl: "https://www.mdt.de/en/products/actuators/shutter-actuators.html",
    searchTerms: ["knx", "blind", "shutter", "jalousie", "actuator", "4 channel", "mdt"],
    powerDrawW: 3,
    heightMm: 90,
    widthMm: 72,
    depthMm: 63,
    weightKg: 0.35,
    ports: [
      port("KNX Bus", "knx", "bidirectional"),
      ...ports("Blind", "power", "output", 4),
    ],
  },

  // ── KNX: Sensors / Input ─────────────────────────────────────────
  {
    id: "c0a80101-0ba1-4000-8000-000000000a07",
    deviceType: "knx-sensor",
    label: "MDT Glass Push Button Smart",
    manufacturer: "MDT",
    modelNumber: "BE-GT2TW.01",
    referenceUrl: "https://www.mdt.de/en/products/inputs/glass-push-button.html",
    searchTerms: ["knx", "push button", "taster", "glass", "wall switch", "mdt"],
    powerDrawW: 1,
    heightMm: 81,
    widthMm: 81,
    depthMm: 11,
    weightKg: 0.15,
    ports: [
      port("KNX Bus", "knx", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a08",
    deviceType: "knx-sensor",
    label: "Theben Presence Detector KNX",
    manufacturer: "Theben",
    modelNumber: "PlanoCentro KNX",
    referenceUrl: "https://www.theben.de/en/presence-detectors",
    searchTerms: ["knx", "presence detector", "occupancy", "motion", "theben", "praesenzmelder"],
    powerDrawW: 1,
    heightMm: 28,
    widthMm: 110,
    depthMm: 110,
    weightKg: 0.12,
    ports: [
      port("KNX Bus", "knx", "bidirectional"),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a09",
    deviceType: "knx-sensor",
    label: "Elsner Weather Station KNX",
    manufacturer: "Elsner",
    modelNumber: "Suntracer KNX-GPS",
    referenceUrl: "https://www.elsner-elektronik.de/en/",
    searchTerms: ["knx", "weather station", "wetterstation", "wind", "rain", "gps", "elsner"],
    powerDrawW: 2,
    heightMm: 92,
    widthMm: 92,
    depthMm: 80,
    weightKg: 0.2,
    ports: [
      port("KNX Bus", "knx", "bidirectional"),
    ],
  },

  // ── DALI: Infrastructure ─────────────────────────────────────────
  {
    id: "c0a80101-0ba1-4000-8000-000000000a0a",
    deviceType: "dali-power-supply",
    label: "Lunatone DALI Power Supply",
    manufacturer: "Lunatone",
    modelNumber: "DALI PS 250mA",
    referenceUrl: "https://www.lunatone.com/en/product-category/dali-power-supplies/",
    searchTerms: ["dali", "power supply", "bus power", "250ma", "lunatone"],
    powerDrawW: 8,
    voltage: "230V",
    heightMm: 90,
    widthMm: 36, // 2 DIN modules
    depthMm: 63,
    weightKg: 0.15,
    ports: [
      port("AC In", "power", "input"),
      port("DALI Bus", "dali", "output"),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a0b",
    deviceType: "dali-gateway",
    label: "Lunatone DALI-2 Ethernet Gateway",
    manufacturer: "Lunatone",
    modelNumber: "DALI-2 IoT",
    referenceUrl: "https://www.lunatone.com/en/product-category/control-devices-light-management/",
    searchTerms: ["dali", "gateway", "controller", "ethernet", "iot", "lunatone", "dali-2"],
    powerDrawW: 6,
    heightMm: 90,
    widthMm: 36,
    depthMm: 63,
    weightKg: 0.18,
    ports: [
      port("LAN", "ethernet", "bidirectional"),
      port("DALI Line 1", "dali", "bidirectional"),
      port("DALI Line 2", "dali", "bidirectional"),
      port("AC In", "power", "input"),
    ],
  },

  // ── DALI: Drivers / Sensors ──────────────────────────────────────
  {
    id: "c0a80101-0ba1-4000-8000-000000000a0c",
    deviceType: "dali-driver",
    label: "Tridonic DALI LED Driver",
    manufacturer: "Tridonic",
    modelNumber: "LCAI 75W 24V",
    referenceUrl: "https://www.tridonic.com/com/en/products-led-drivers.asp",
    searchTerms: ["dali", "led driver", "constant voltage", "tridonic", "dimmable", "lca"],
    powerDrawW: 80,
    voltage: "230V",
    heightMm: 30,
    widthMm: 280,
    depthMm: 30,
    weightKg: 0.5,
    ports: [
      port("AC In", "power", "input"),
      port("DALI In", "dali", "input"),
      port("LED Out", "power", "output"),
    ],
  },
  {
    id: "c0a80101-0ba1-4000-8000-000000000a0d",
    deviceType: "dali-sensor",
    label: "Lunatone DALI Multi-Sensor",
    manufacturer: "Lunatone",
    modelNumber: "DALI MSensor",
    referenceUrl: "https://www.lunatone.com/en/product-category/sensors/",
    searchTerms: ["dali", "sensor", "presence", "motion", "lux", "daylight", "lunatone"],
    powerDrawW: 1,
    heightMm: 30,
    widthMm: 50,
    depthMm: 50,
    weightKg: 0.05,
    ports: [
      port("DALI Bus", "dali", "bidirectional"),
    ],
  },

  // ── Bridge: KNX ↔ DALI ───────────────────────────────────────────
  {
    id: "c0a80101-0ba1-4000-8000-000000000a0e",
    deviceType: "knx-dali-gateway",
    label: "MDT KNX-DALI Gateway",
    manufacturer: "MDT",
    modelNumber: "SCN-DALI64.03",
    referenceUrl: "https://www.mdt.de/en/products/system-devices/dali-control.html",
    searchTerms: ["knx", "dali", "gateway", "bridge", "lighting control", "mdt", "dali64"],
    powerDrawW: 5,
    heightMm: 90,
    widthMm: 36, // 2 DIN modules
    depthMm: 63,
    weightKg: 0.15,
    ports: [
      port("KNX Bus", "knx", "bidirectional"),
      port("DALI Line", "dali", "bidirectional"),
      port("AC In", "power", "input"),
    ],
  },
];
