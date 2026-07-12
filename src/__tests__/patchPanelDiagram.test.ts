import { describe, it, expect } from "vitest";
import { computePatchPanelDiagram, collectDiagramSignals } from "../patchPanelDiagram";
import { DEFAULT_SIGNAL_COLORS } from "../signalColors";
import { makeDevice, makeEdge, makePort } from "../routingHarness/fixtures";
import type { SchematicNode, ConnectionEdge } from "../types";

describe("computePatchPanelDiagram", () => {
  it("builds one panel per patch panel with connected/unconnected ports and signal colors", () => {
    const p1 = makePort("Port 1", "sdi", "input", { connectorType: "bnc" });
    const p2 = makePort("Port 2", "hdmi", "input", { connectorType: "hdmi" });
    const p3 = makePort("Port 3", "sdi", "input");
    const p4 = makePort("Port 4", "sdi", "input");
    const panel = makeDevice({
      id: "pp1", label: "Patch A", x: 0, y: 0, deviceType: "patch-panel",
      ports: [p1, p2, p3, p4],
    });
    const o1 = makePort("Out 1", "sdi", "output");
    const o2 = makePort("Out 2", "hdmi", "output");
    const src = makeDevice({ id: "src", label: "Router", x: 500, y: 0, ports: [o1, o2] });

    const nodes: SchematicNode[] = [panel, src];
    const edges: ConnectionEdge[] = [
      makeEdge({ id: "e1", source: "src", sourceHandle: o1.id, target: "pp1", targetHandle: p1.id, signalType: "sdi" }),
      makeEdge({ id: "e2", source: "src", sourceHandle: o2.id, target: "pp1", targetHandle: p2.id, signalType: "hdmi" }),
    ];

    const panels = computePatchPanelDiagram(nodes, edges);
    expect(panels).toHaveLength(1);

    const pp = panels[0];
    expect(pp.panel).toBe("Patch A");
    expect(pp.totalCount).toBe(4);
    expect(pp.connectedCount).toBe(2);
    expect(pp.rows).toBe(1);
    expect(pp.columns).toBe(4);
    expect(pp.hasPassthrough).toBe(false);

    // Connected port carries the remote device and the SDI signal color.
    expect(pp.ports[0].face.connected).toBe(true);
    expect(pp.ports[0].face.remoteDevice).toBe("Router");
    expect(pp.ports[0].face.color).toBe(DEFAULT_SIGNAL_COLORS.sdi);
    expect(pp.ports[1].face.color).toBe(DEFAULT_SIGNAL_COLORS.hdmi);

    // Unconnected ports are flagged and carry no remote.
    expect(pp.ports[2].face.connected).toBe(false);
    expect(pp.ports[2].face.remoteDevice).toBe("");

    // Legend surfaces the distinct signals present.
    const signals = collectDiagramSignals(panels).map((s) => s.signalType).sort();
    expect(signals).toEqual(["hdmi", "sdi"]);
  });

  it("splits passthrough ports into rear/front faces with per-face connection state", () => {
    const pt = makePort("Circuit 1", "custom", "passthrough", {
      inheritsSignal: true,
      rearConnectorType: "bnc",
      frontConnectorType: "bnc",
    });
    const panel = makeDevice({ id: "pp2", label: "Bay 1", x: 0, y: 0, deviceType: "patch-panel", ports: [pt] });
    const out = makePort("Out", "sdi", "output");
    const src = makeDevice({ id: "src2", label: "Camera", x: 400, y: 0, ports: [out] });

    const nodes: SchematicNode[] = [panel, src];
    // Only the rear face is patched; the front stays open.
    const edges: ConnectionEdge[] = [
      makeEdge({ id: "er", source: "src2", sourceHandle: out.id, target: "pp2", targetHandle: `${pt.id}-rear`, signalType: "sdi" }),
    ];

    const panels = computePatchPanelDiagram(nodes, edges);
    expect(panels).toHaveLength(1);
    const port = panels[0].ports[0];
    expect(port.passthrough).toBe(true);
    expect(panels[0].hasPassthrough).toBe(true);

    expect(port.rear!.connected).toBe(true);
    expect(port.rear!.remoteDevice).toBe("Camera");
    expect(port.rear!.color).toBe(DEFAULT_SIGNAL_COLORS.sdi);

    expect(port.front!.connected).toBe(false);
    expect(port.front!.remoteDevice).toBe("");
  });
});
