import { describe, it, expect } from "vitest";
import { computeRackPlan, collectRackPlanSignals } from "../rackPlan";
import { DEFAULT_SIGNAL_COLORS } from "../signalColors";
import { makeDevice, makeEdge, makePort } from "../routingHarness/fixtures";
import type { SchematicNode, ConnectionEdge, SchematicPage } from "../types";

function rackPage(racks: unknown[], placements: unknown[]): SchematicPage {
  return { id: "rp1", label: "Racks", type: "rack-elevation", racks, placements, accessories: [] } as unknown as SchematicPage;
}

describe("computeRackPlan", () => {
  it("enumerates racked devices in U order with front-jack ports and connections", () => {
    const panelPorts = Array.from({ length: 24 }, (_, i) => makePort(`${i + 1}`, "ethernet", "input", { connectorType: "rj45" as never }));
    const panel = makeDevice({ id: "pp", label: "Patch Panel A", x: 0, y: 0, deviceType: "patch-panel", ports: panelPorts });
    const swPorts = Array.from({ length: 8 }, (_, i) => makePort(`${i + 1}`, "ethernet", "bidirectional", { connectorType: "rj45" as never }));
    const sw = makeDevice({ id: "sw", label: "Core Switch", x: 0, y: 0, deviceType: "network-switch", ports: swPorts });
    const rIn = makePort("Uplink", "ethernet", "input");
    const remote = makeDevice({ id: "ap", label: "Access Point", x: 900, y: 0, ports: [rIn] });

    const nodes: SchematicNode[] = [panel, sw, remote];
    const edges: ConnectionEdge[] = [
      makeEdge({ id: "e1", source: "pp", sourceHandle: panelPorts[0].id, target: "ap", targetHandle: rIn.id, signalType: "ethernet" }),
      makeEdge({ id: "e2", source: "pp", sourceHandle: panelPorts[1].id, target: "ap", targetHandle: rIn.id, signalType: "ethernet" }),
    ];

    const pages = [rackPage(
      [{ id: "R1", label: "Cabinet 1", rackType: "floor-19", heightU: 42, depthMm: 800, widthClass: "19in", position: { x: 0, y: 0 } }],
      [
        { id: "pl1", rackId: "R1", deviceNodeId: "pp", uPosition: 1, face: "front" },
        { id: "pl2", rackId: "R1", deviceNodeId: "sw", uPosition: 3, face: "front" },
      ],
    )];

    const racks = computeRackPlan(nodes, edges, pages);
    expect(racks).toHaveLength(1);
    const r = racks[0];
    expect(r.label).toBe("Cabinet 1");
    expect(r.heightU).toBe(42);

    // Top-first: switch at U3 comes before the panel at U1.
    expect(r.devices.map((d) => d.nodeId)).toEqual(["sw", "pp"]);

    const pp = r.devices[1];
    expect(pp.ports).toHaveLength(24);
    expect(pp.connectedCount).toBe(2);
    expect(pp.ports[0].connected).toBe(true);
    expect(pp.ports[0].remoteDevice).toBe("Access Point");
    expect(pp.ports[0].color).toBe(DEFAULT_SIGNAL_COLORS.ethernet);
    expect(pp.ports[2].connected).toBe(false);

    expect(collectRackPlanSignals(racks).map((s) => s.signalType)).toEqual(["ethernet"]);
  });

  it("excludes power ports from the front-jack row", () => {
    const ports = [
      makePort("1", "ethernet", "input", { connectorType: "rj45" as never }),
      makePort("PWR", "power", "input"),
    ];
    const dev = makeDevice({ id: "d1", label: "Switch", x: 0, y: 0, deviceType: "network-switch", ports });
    const pages = [rackPage(
      [{ id: "R1", label: "Rack", rackType: "floor-19", heightU: 42, depthMm: 800, widthClass: "19in", position: { x: 0, y: 0 } }],
      [{ id: "pl1", rackId: "R1", deviceNodeId: "d1", uPosition: 1, face: "front" }],
    )];
    const racks = computeRackPlan([dev], [], pages);
    expect(racks[0].devices[0].ports).toHaveLength(1);
    expect(racks[0].devices[0].ports[0].position).toBe("1");
  });

  it("returns no racks when there is no rack elevation page", () => {
    const dev = makeDevice({ id: "d1", label: "Panel", x: 0, y: 0, deviceType: "patch-panel", ports: [makePort("1", "ethernet", "input")] });
    expect(computeRackPlan([dev], [], [])).toEqual([]);
  });
});
