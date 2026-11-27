// SPEC-odoo-device-library.md, Task 39 — the check every device template passes before it is
// written to the central library in Odoo. It runs in the editor and in the backend (copied by
// mcp-server/scripts/sync-protocol.mjs), so it may import nothing but protocol.ts.

import { describe, it, expect } from "vitest";
import { checkStoredTemplate } from "../mcp/templateValidation";
import { SIGNAL_TYPES_WIRE, CONNECTOR_TYPES_WIRE, MAX_TEMPLATE_BYTES } from "../mcp/protocol";
import { DEFAULT_SIGNAL_COLORS } from "../signalColors";
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
