// SPEC-odoo-device-library.md, Task 39 — the check every device template passes before it is
// written to the central library in Odoo. It runs in the editor and in the backend (copied by
// mcp-server/scripts/sync-protocol.mjs), so it may import nothing but protocol.ts.

import { describe, it, expect } from "vitest";
import { checkStoredTemplate, parseTemplateInput } from "../mcp/templateValidation";
import { SIGNAL_TYPES_WIRE, CONNECTOR_TYPES_WIRE, MAX_TEMPLATE_BYTES, DEVICE_TYPES_WIRE, SPEAKER_PROFILES_WIRE } from "../mcp/protocol";
import { DEFAULT_SIGNAL_COLORS } from "../signalColors";
import { DEVICE_TYPE_TO_CATEGORY } from "../deviceTypeCategories";
import { SPEAKER_LOAD_PROFILES } from "../types";
import { CONNECTOR_TO_CABLE } from "../connectorTypes";
import { getBundledTemplates } from "../templateApi";

/** What the device editor saves for a hand-made device (DeviceEditor.tsx: id custom-<ts>,
 *  port ids tpl-<i>, deviceType free text). */
const editorTemplate = () => ({
  id: "custom-1764230000000",
  label: "Audac MFA208",
  deviceType: "custom",
  manufacturer: "Audac",
  modelNumber: "MFA208",
  ports: [
    { id: "tpl-0", label: "Mic/Line 1", signalType: "analog-audio", direction: "input", connectorType: "combo-xlr-trs" },
    { id: "tpl-1", label: "Speaker A", signalType: "speaker-level", direction: "output", connectorType: "phoenix" },
    { id: "tpl-2", label: "RS-232", signalType: "serial", direction: "bidirectional", connectorType: "db9" },
  ],
});

describe("value lists in protocol.ts", () => {
  it("SIGNAL_TYPES_WIRE is exactly the app's signal types", () => {
    expect([...SIGNAL_TYPES_WIRE].sort()).toEqual(Object.keys(DEFAULT_SIGNAL_COLORS).sort());
  });

  it("CONNECTOR_TYPES_WIRE is exactly the app's connector types", () => {
    expect([...CONNECTOR_TYPES_WIRE].sort()).toEqual(Object.keys(CONNECTOR_TO_CABLE).sort());
  });

  it("DEVICE_TYPES_WIRE is exactly the app's device types with a category", () => {
    expect([...DEVICE_TYPES_WIRE].sort()).toEqual(Object.keys(DEVICE_TYPE_TO_CATEGORY).sort());
  });

  it("SPEAKER_PROFILES_WIRE is exactly the app's speaker profiles", () => {
    expect([...SPEAKER_PROFILES_WIRE]).toEqual(SPEAKER_LOAD_PROFILES);
  });
});

describe("checkStoredTemplate accepts what the app makes", () => {
  it("accepts a device made in the device editor", () => {
    expect(checkStoredTemplate(editorTemplate())).toBeNull();
  });

  it("accepts every bundled template, with slots, passthrough ports and load data", () => {
    const problems = getBundledTemplates()
      .map((t) => [t.id, checkStoredTemplate(t)] as const)
      .filter(([, p]) => p !== null);
    expect(problems).toEqual([]);
  });

  it("accepts an empty deviceType (the editor's legacy custom- devices)", () => {
    expect(checkStoredTemplate({ ...editorTemplate(), deviceType: "" })).toBeNull();
  });

  it("accepts a template without ports (a card)", () => {
    expect(checkStoredTemplate({ ...editorTemplate(), ports: [] })).toBeNull();
  });
});

describe("checkStoredTemplate refuses with a sentence naming the field", () => {
  const refuse = (t: unknown, mentions: RegExp) => {
    const problem = checkStoredTemplate(t);
    expect(problem).toMatch(mentions);
  };

  it("refuses what is not an object", () => {
    refuse(null, /Vorlage/);
    refuse([editorTemplate()], /Vorlage/);
    refuse("x", /Vorlage/);
  });

  it("refuses a missing or empty id", () => {
    refuse({ ...editorTemplate(), id: undefined }, /id/);
    refuse({ ...editorTemplate(), id: "  " }, /id/);
  });

  it("refuses a missing or empty label", () => {
    refuse({ ...editorTemplate(), label: "" }, /label/);
    refuse({ ...editorTemplate(), label: 7 }, /label/);
  });

  it("refuses a deviceType that is not text", () => {
    refuse({ ...editorTemplate(), deviceType: 3 }, /deviceType/);
  });

  it("refuses ports that are not a list", () => {
    refuse({ ...editorTemplate(), ports: {} }, /ports/);
  });

  it("refuses a port without id or label", () => {
    const t = editorTemplate();
    t.ports[1] = { ...t.ports[1], id: "" };
    refuse(t, /Port 2.*id/);
    const u = editorTemplate();
    (u.ports[0] as Record<string, unknown>).label = undefined;
    refuse(u, /Port 1.*label/);
  });

  it("refuses duplicate port ids", () => {
    const t = editorTemplate();
    t.ports[2] = { ...t.ports[2], id: "tpl-0" };
    refuse(t, /tpl-0.*doppelt|doppelt.*tpl-0/);
  });

  it("refuses an unknown signal type, direction or connector, also on the front and rear face", () => {
    const sig = editorTemplate();
    sig.ports[0] = { ...sig.ports[0], signalType: "telepathy" };
    refuse(sig, /signalType.*telepathy/);

    const dir = editorTemplate();
    dir.ports[0] = { ...dir.ports[0], direction: "sideways" };
    refuse(dir, /direction.*sideways/);

    const con = editorTemplate();
    con.ports[1] = { ...con.ports[1], connectorType: "cee-7-7" };
    refuse(con, /connectorType.*cee-7-7/);

    const front = editorTemplate();
    front.ports[1] = { ...front.ports[1], frontConnectorType: "warp-plug" } as typeof front.ports[1];
    refuse(front, /frontConnectorType.*warp-plug/);
  });

  it("refuses links that are not http or https — the template is shared with every colleague", () => {
    refuse({ ...editorTemplate(), referenceUrl: "javascript:alert(1)" }, /referenceUrl/);
    refuse({ ...editorTemplate(), imageUrl: "data:text/html,<script>" }, /imageUrl/);
    expect(checkStoredTemplate({ ...editorTemplate(), referenceUrl: "https://audac.eu/mfa208" })).toBeNull();
    expect(checkStoredTemplate({ ...editorTemplate(), imageUrl: "http://example.com/a.png" })).toBeNull();
  });

  it("refuses text fields that are not text", () => {
    refuse({ ...editorTemplate(), manufacturer: { name: "Audac" } }, /manufacturer/);
  });

  it("refuses a version that is not a whole number ≥ 0", () => {
    refuse({ ...editorTemplate(), version: -1 }, /version/);
    refuse({ ...editorTemplate(), version: 1.5 }, /version/);
    expect(checkStoredTemplate({ ...editorTemplate(), version: 3 })).toBeNull();
  });

  it("refuses slots that are not a list", () => {
    refuse({ ...editorTemplate(), slots: "A" }, /slots/);
  });

  it("refuses a template larger than MAX_TEMPLATE_BYTES", () => {
    const ports = Array.from({ length: 300 }, (_, i) => ({
      id: `p${i}`, label: `Port ${i}`, signalType: "ethernet", direction: "bidirectional", notes: "x".repeat(1000),
    }));
    expect(300 * 1000).toBeGreaterThan(MAX_TEMPLATE_BYTES);
    refuse({ ...editorTemplate(), ports }, /zu groß.*KB/);
  });

  it("refuses an overlong text field", () => {
    refuse({ ...editorTemplate(), installNotes: "x".repeat(10_001) }, /installNotes/);
  });

  it("names the template in the sentence, so an upload list says which one failed", () => {
    const t = editorTemplate();
    t.ports[0] = { ...t.ports[0], signalType: "telepathy" };
    expect(checkStoredTemplate(t)).toMatch(/Audac MFA208/);
  });
});

// --- Task 46: what Claude may send (SPEC-device-template.md) -------------------------------------

type Result = ReturnType<typeof parseTemplateInput>;
const ok = (r: Result) => {
  if ("error" in r) throw new Error(`expected a template, got: ${r.error}`);
  return r;
};
const fails = (r: Result, mentions: RegExp) => {
  expect("error" in r ? r.error : "no error").toMatch(mentions);
};

const mfa = () => ({
  label: "Audac MFA208",
  deviceType: "amplifier",
  manufacturer: "Audac",
  modelNumber: "MFA208",
  ports: [
    { label: "Mic/Line 1", signalType: "analog-audio", direction: "input", connectorType: "combo-xlr-trs" },
    { label: "Line Out", signalType: "analog-audio", direction: "output", connectorType: "rca" },
    { label: "Speaker A", signalType: "speaker-level", direction: "output", connectorType: "phoenix" },
    { label: "RS-232", signalType: "serial", direction: "bidirectional", connectorType: "db9" },
  ],
});

/** A bundled-style amplifier to derive from: load data, slots, plan symbol. */
const blaze122 = () => ({
  id: "blaze-pzc-122",
  version: 7,
  label: "Blaze PowerZone Connect 122",
  deviceType: "amplifier",
  manufacturer: "Blaze",
  modelNumber: "PZC-122",
  ports: [
    { id: "out1", label: "Out 1", signalType: "speaker-level", direction: "output", connectorType: "phoenix" },
    { id: "out2", label: "Out 2", signalType: "speaker-level", direction: "output", connectorType: "phoenix" },
    { id: "lan", label: "LAN", signalType: "ethernet", direction: "bidirectional", connectorType: "rj45" },
  ],
  ampLoad: { channels: 2, ratedW: { ohm4: 125, ohm8: 125, v70: 250 }, hiZBridgesPairs: true },
  planSymbol: { shape: "square" },
  slots: [{ id: "s1", label: "Slot", slotFamily: "x" }],
});

describe("parseTemplateInput — creating", () => {
  it("builds a template that passes the stored check, with port ids p1…pn", () => {
    const r = ok(parseTemplateInput(mfa(), { mode: "create" }));
    expect(r.template.ports).toHaveLength(4);
    expect((r.template.ports as { id: string }[]).map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(checkStoredTemplate({ ...r.template, id: "custom-1" })).toBeNull();
  });

  it("keeps given port ids and numbers the others around them", () => {
    const input = mfa();
    (input.ports[1] as Record<string, unknown>).id = "p1";
    const r = ok(parseTemplateInput(input, { mode: "create" }));
    expect((r.template.ports as { id: string }[]).map((p) => p.id)).toEqual(["p2", "p1", "p3", "p4"]);
  });

  it("needs label, deviceType and ports without a base", () => {
    fails(parseTemplateInput({ ...mfa(), label: "" }, { mode: "create" }), /label/);
    fails(parseTemplateInput({ ...mfa(), deviceType: undefined }, { mode: "create" }), /deviceType/);
    fails(parseTemplateInput({ ...mfa(), ports: [] }, { mode: "create" }), /ports/);
  });

  it("refuses an unknown device type and names close ones", () => {
    fails(parseTemplateInput({ ...mfa(), deviceType: "amplifer" }, { mode: "create" }), /amplifer.*amplifier/);
  });

  it("refuses unknown fields instead of dropping them", () => {
    fails(parseTemplateInput({ ...mfa(), colour: "red" }, { mode: "create" }), /colour/);
    const input = mfa();
    (input.ports[0] as Record<string, unknown>).gain = 3;
    fails(parseTemplateInput(input, { mode: "create" }), /Port 1.*gain/);
  });

  it("ignores the command's own fields", () => {
    ok(parseTemplateInput({ ...mfa(), baseTemplateId: undefined, productId: 9001, allowDuplicate: true }, { mode: "create" }));
  });

  it("refuses passthrough, unknown signals and connectors, and duplicate ids", () => {
    const pass = mfa();
    pass.ports[0].direction = "passthrough";
    fails(parseTemplateInput(pass, { mode: "create" }), /passthrough/);
    const sig = mfa();
    sig.ports[0].signalType = "telepathy";
    fails(parseTemplateInput(sig, { mode: "create" }), /telepathy/);
    const con = mfa();
    con.ports[0].connectorType = "warp";
    fails(parseTemplateInput(con, { mode: "create" }), /warp/);
    const dup = mfa();
    (dup.ports[0] as Record<string, unknown>).id = "x";
    (dup.ports[1] as Record<string, unknown>).id = "x";
    fails(parseTemplateInput(dup, { mode: "create" }), /x.*doppelt/);
  });

  it("refuses more than 256 ports, long text, negative numbers and http-less links", () => {
    const many = { ...mfa(), ports: Array.from({ length: 257 }, (_, i) => ({ label: `P${i}`, signalType: "ethernet", direction: "bidirectional" })) };
    fails(parseTemplateInput(many, { mode: "create" }), /256/);
    fails(parseTemplateInput({ ...mfa(), label: "x".repeat(121) }, { mode: "create" }), /label.*120/);
    fails(parseTemplateInput({ ...mfa(), powerDrawW: -5 }, { mode: "create" }), /powerDrawW/);
    fails(parseTemplateInput({ ...mfa(), imageUrl: "http://audac.eu/a.png" }, { mode: "create" }), /imageUrl.*https/);
    fails(parseTemplateInput({ ...mfa(), searchTerms: Array.from({ length: 21 }, (_, i) => `t${i}`) }, { mode: "create" }), /searchTerms/);
  });

  it("accepts speaker load data within its limits", () => {
    const r = ok(parseTemplateInput(
      { ...mfa(), deviceType: "speaker", speakerLoad: { impedanceOhm: 8, rmsPowerW: 60, tapsW: [30, 15, 7.5], profile: "FR" } },
      { mode: "create" },
    ));
    expect(r.template.speakerLoad).toEqual({ impedanceOhm: 8, rmsPowerW: 60, tapsW: [30, 15, 7.5], profile: "FR" });
    fails(parseTemplateInput({ ...mfa(), speakerLoad: { impedanceOhm: 1 } }, { mode: "create" }), /impedanceOhm/);
    fails(parseTemplateInput({ ...mfa(), speakerLoad: { tapsW: [7.5, 15, 30] } }, { mode: "create" }), /tapsW.*absteigend/);
    fails(parseTemplateInput({ ...mfa(), speakerLoad: { profile: "XX" } }, { mode: "create" }), /profile/);
    fails(parseTemplateInput({ ...mfa(), speakerLoad: { impedance: 8 } }, { mode: "create" }), /speakerLoad.*impedance/);
  });

  it("accepts amplifier load data within its limits", () => {
    const amp = { channels: 4, ratedW: { ohm4: 120, v100: 240 }, totalRatedW: 480, hiZBridgesPairs: true };
    expect(ok(parseTemplateInput({ ...mfa(), ampLoad: amp }, { mode: "create" })).template.ampLoad).toEqual(amp);
    fails(parseTemplateInput({ ...mfa(), ampLoad: { channels: 0 } }, { mode: "create" }), /channels/);
    fails(parseTemplateInput({ ...mfa(), ampLoad: { ratedW: { ohm16: 10 } } }, { mode: "create" }), /ohm16/);
  });

  it("accepts a detector's reach and insists on the angle of a sector and the width of a corridor", () => {
    const pir = { shape: "sector", rangeM: 12, apertureDeg: 88.5 };
    expect(ok(parseTemplateInput({ ...mfa(), deviceType: "motion-detector", detection: pir }, { mode: "create" })).template.detection).toEqual(pir);
    fails(parseTemplateInput({ ...mfa(), detection: { shape: "sector", rangeM: 12 } }, { mode: "create" }), /apertureDeg/);
    fails(parseTemplateInput({ ...mfa(), detection: { shape: "rect", rangeM: 12 } }, { mode: "create" }), /widthM/);
    fails(parseTemplateInput({ ...mfa(), detection: { shape: "circle", rangeM: 0.1 } }, { mode: "create" }), /rangeM/);
    fails(parseTemplateInput({ ...mfa(), detection: { shape: "blob", rangeM: 5 } }, { mode: "create" }), /shape/);
  });

  it("accepts a ceiling microphone's coverage within its limits", () => {
    const mic = { areaM: { w: 9, d: 9 }, maxAreas: 8, maxTalkerDistanceM: 7, maxMountHeightM: 9 };
    expect(ok(parseTemplateInput({ ...mfa(), micCoverage: mic }, { mode: "create" })).template.micCoverage).toEqual(mic);
    fails(parseTemplateInput({ ...mfa(), micCoverage: { areaM: { w: 40, d: 9 } } }, { mode: "create" }), /areaM/);
    fails(parseTemplateInput({ ...mfa(), micCoverage: { maxAreas: 3 } }, { mode: "create" }), /areaM/);
  });

  it("derives from a base: keeps load data, slots and symbol, drops the base's id and version", () => {
    const r = ok(parseTemplateInput(
      {
        label: "Blaze PowerZone Connect 172",
        modelNumber: "PZC-172",
        ports: [1, 2, 3, 4].map((n) => ({ label: `Out ${n}`, signalType: "speaker-level", direction: "output", connectorType: "phoenix" })),
      },
      { mode: "create", base: blaze122() },
    ));
    expect(r.template.id).toBeUndefined();
    expect(r.template.version).toBeUndefined();
    expect(r.template.deviceType).toBe("amplifier");
    expect(r.template.manufacturer).toBe("Blaze");
    expect(r.template.ampLoad).toEqual(blaze122().ampLoad);
    expect(r.template.slots).toEqual(blaze122().slots);
    expect(r.template.planSymbol).toEqual({ shape: "square" });
    expect((r.template.ports as unknown[]).length).toBe(4);
    expect(checkStoredTemplate({ ...r.template, id: "custom-2" })).toBeNull();
  });

  it("with a base, ports and deviceType may be left out; null removes a block", () => {
    const r = ok(parseTemplateInput({ label: "Blaze ohne Last", ampLoad: null }, { mode: "create", base: blaze122() }));
    expect((r.template.ports as unknown[]).length).toBe(3);
    expect(r.template.ampLoad).toBeUndefined();
    fails(parseTemplateInput({ modelNumber: "X" }, { mode: "create", base: blaze122() }), /label/);
  });

  it("never lets the input touch blocks that may only come from a base", () => {
    fails(parseTemplateInput({ ...mfa(), slots: [] }, { mode: "create" }), /slots/);
    fails(parseTemplateInput({ ...mfa(), wifi: {} }, { mode: "create" }), /wifi/);
    fails(parseTemplateInput({ ...mfa(), planSymbol: { shape: "circle" } }, { mode: "create" }), /planSymbol/);
  });
});

describe("parseTemplateInput — changing", () => {
  const current = () => ({ ...blaze122(), id: "custom-blaze", version: 3 });

  it("changes only what is given and keeps id and version", () => {
    const r = ok(parseTemplateInput({ installNotes: "Lüfter frei halten" }, { mode: "update", base: current() }));
    expect(r.template).toEqual({ ...current(), installNotes: "Lüfter frei halten" });
    expect(r.addedPorts).toEqual([]);
    expect(r.removedPorts).toEqual([]);
  });

  it("ports is the new full list: known ids are changed, new ones added, missing ones removed", () => {
    const r = ok(parseTemplateInput(
      {
        ports: [
          { id: "out1", label: "Ausgang 1" },
          { id: "lan" },
          { label: "Out 3", signalType: "speaker-level", direction: "output", connectorType: "phoenix" },
        ],
      },
      { mode: "update", base: current() },
    ));
    const ports = r.template.ports as { id: string; label: string; signalType: string }[];
    expect(ports.map((p) => [p.id, p.label])).toEqual([["out1", "Ausgang 1"], ["lan", "LAN"], ["p1", "Out 3"]]);
    expect(ports[0].signalType).toBe("speaker-level");
    expect(r.addedPorts).toEqual(["p1"]);
    expect(r.removedPorts).toEqual(["out2"]);
  });

  it("refuses a port id that does not exist", () => {
    fails(parseTemplateInput({ ports: [{ id: "out9", label: "X" }] }, { mode: "update", base: current() }), /out9/);
  });

  it("replaces a load block whole, and null removes it", () => {
    const r = ok(parseTemplateInput({ ampLoad: { channels: 4 } }, { mode: "update", base: current() }));
    expect(r.template.ampLoad).toEqual({ channels: 4 });
    expect(ok(parseTemplateInput({ ampLoad: null }, { mode: "update", base: current() })).template.ampLoad).toBeUndefined();
  });

  it("ignores templateId, baseVersion and productId, and refuses baseTemplateId", () => {
    ok(parseTemplateInput({ templateId: "custom-blaze", baseVersion: 3, productId: null, label: "Neu" }, { mode: "update", base: current() }));
    fails(parseTemplateInput({ baseTemplateId: "x" }, { mode: "update", base: current() }), /baseTemplateId/);
  });
});
