import { describe, it, expect } from "vitest";
import { templates as security } from "../devices/security";
import { DEVICE_TEMPLATES, DEVICE_TYPE_TO_CATEGORY } from "../deviceLibrary";
import { CONNECTOR_LABELS, SIGNAL_LABELS, SIGNAL_COLORS, SIGNAL_GROUPS, type SignalType } from "../types";
import { DEFAULT_CONNECTOR, shouldDefaultMultiConnect } from "../connectorTypes";
import { SIGNAL_TO_CABLE } from "../cableTypes";
import { DEVICE_TYPE_LABELS } from "../deviceTypeCategories";

const ALARM_BUSES: SignalType[] = ["fibra", "jeweller", "bus-2"];

describe("intrusion-alarm bus signal types", () => {
  it("are registered in every table a signal has to appear in", () => {
    for (const bus of ALARM_BUSES) {
      expect(SIGNAL_LABELS, bus).toHaveProperty(bus);
      expect(SIGNAL_COLORS, bus).toHaveProperty(bus);
      expect(SIGNAL_TO_CABLE, bus).toHaveProperty(bus);
      expect(DEFAULT_CONNECTOR, bus).toHaveProperty(bus);
    }
    expect(SIGNAL_GROUPS.Security).toEqual(ALARM_BUSES);
  });

  it("default to multi-connect, because a detector line is shared", () => {
    // A Fibra or BUS-2 line carries many detectors and one hub holds dozens of Jeweller
    // devices — without this, wiring the second detector onto a line would be refused.
    for (const bus of ALARM_BUSES) {
      expect(shouldDefaultMultiConnect(bus), bus).toBe(true);
    }
  });

  it("terminates on screw terminals when wired and on radio when not", () => {
    expect(DEFAULT_CONNECTOR.fibra).toBe("terminal-block");
    expect(DEFAULT_CONNECTOR["bus-2"]).toBe("terminal-block");
    expect(DEFAULT_CONNECTOR.jeweller).toBe("wireless");
  });
});

describe("security device library", () => {
  it("is bundled into DEVICE_TEMPLATES", () => {
    expect(security.length).toBeGreaterThan(0);
    const bundledIds = new Set(DEVICE_TEMPLATES.map((t) => t.id));
    for (const t of security) expect(bundledIds, t.label).toContain(t.id);
  });

  it("has ids unique within itself and disjoint from the rest of the library", () => {
    const ids = security.map((t) => t.id);
    expect(ids.filter(Boolean).length).toBe(ids.length);
    expect(new Set(ids).size).toBe(ids.length);

    const ownIds = new Set(ids);
    const collisions = DEVICE_TEMPLATES.filter(
      (t) => !security.includes(t) && t.id && ownIds.has(t.id),
    ).map((t) => `${t.id} (${t.label})`);
    expect(collisions).toEqual([]);
  });

  it("uses only signal and connector types the app knows", () => {
    for (const t of security) {
      for (const p of t.ports) {
        expect(SIGNAL_LABELS, `${t.label} / ${p.label}`).toHaveProperty(p.signalType);
        if (p.connectorType) {
          expect(CONNECTOR_LABELS, `${t.label} / ${p.label}`).toHaveProperty(p.connectorType);
        }
      }
    }
  });

  it("maps every device type to the Security category", () => {
    for (const t of security) {
      expect(DEVICE_TYPE_TO_CATEGORY, t.label).toHaveProperty(t.deviceType);
      expect(DEVICE_TYPE_TO_CATEGORY[t.deviceType], t.label).toBe("Security");
    }
  });

  it("spells NVR as an acronym rather than a word", () => {
    expect(DEVICE_TYPE_LABELS.nvr).toBe("NVR");
    expect(DEVICE_TYPE_LABELS["ip-camera"]).toBe("IP Camera");
  });

  it("gives every device a way onto one of the buses, or an uplink of its own", () => {
    // A security device that speaks none of the buses and has no network port would be
    // unwireable on a plan — the one thing this catalog exists to prevent.
    for (const t of security) {
      const reachable = t.ports.some(
        (p) => ALARM_BUSES.includes(p.signalType) || p.signalType === "ethernet",
      );
      expect(reachable, t.label).toBe(true);
    }
  });

  it("wires bus-powered line devices as in/out so a line can be drawn hop by hop", () => {
    // Fibra and BUS-2 detectors are pulled in a beam: the cable arrives and leaves. Both
    // ends have to exist or the second hop has nowhere to start.
    const lineDevices = security.filter((t) =>
      t.ports.some((p) => p.signalType === "fibra" || p.signalType === "bus-2"),
    );
    expect(lineDevices.length).toBeGreaterThan(10);
    for (const t of lineDevices) {
      const busPorts = t.ports.filter((p) => p.signalType === "fibra" || p.signalType === "bus-2");
      // A panel is the head of the line and carries bidirectional line terminals instead.
      if (t.deviceType === "alarm-panel") {
        expect(busPorts.every((p) => p.direction === "bidirectional"), t.label).toBe(true);
        continue;
      }
      if (busPorts.some((p) => p.direction === "bidirectional")) continue;
      expect(busPorts.some((p) => p.direction === "input"), t.label).toBe(true);
      expect(busPorts.some((p) => p.direction === "output"), t.label).toBe(true);
    }
  });

  it("covers both systems and both wired buses", () => {
    const makers = new Set(security.map((t) => t.manufacturer));
    expect(makers).toContain("Ajax Systems");
    expect(makers).toContain("Telenot");

    const signals = new Set(security.flatMap((t) => t.ports.map((p) => p.signalType)));
    for (const bus of ALARM_BUSES) expect(signals, bus).toContain(bus);
  });

  it("gives cameras an aimable plan symbol and a PoE draw", () => {
    const cameras = security.filter((t) => t.deviceType === "ip-camera");
    expect(cameras.length).toBeGreaterThan(0);
    for (const cam of cameras) {
      // The camera pictogram is the one that can be turned to face the room, which is
      // what a coverage area anchored to it needs.
      expect(cam.planSymbol?.shape, cam.label).toBe("camera");
      expect(cam.poeDrawW, cam.label).toBeGreaterThan(0);
    }
  });

  it("leaves the model number off the detectors that stand in for a range", () => {
    // Deliberate: the Telenot BUS-2 line devices carry no SKU rather than an invented one.
    const generic = security.filter((t) => t.manufacturer === "Telenot" && !t.modelNumber);
    expect(generic.length).toBeGreaterThan(0);
    for (const t of generic) expect(t.label, t.id).toMatch(/Telenot/);
  });
});
