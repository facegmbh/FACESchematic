import { describe, expect, it } from "vitest";
import { computeAlignment, resolveAlignmentOverlaps, type AlignOperation } from "../alignUtils";
import { GRID_SIZE } from "../gridConstants";
import type { SchematicNode } from "../types";

function device(id: string, x: number, y: number, width = 176, height = 96): SchematicNode {
  return {
    id,
    type: "device",
    position: { x, y },
    measured: { width, height },
    data: { label: id, deviceType: "amplifier", ports: [] },
  } as unknown as SchematicNode;
}

function align(nodes: SchematicNode[], op: AlignOperation) {
  const raw = computeAlignment(nodes, op);
  const resolved = resolveAlignmentOverlaps(nodes, raw, op);
  return nodes.map((n) => resolved.get(n.id) ?? n.position);
}

describe("Ausrichten bleibt auf dem Zeichenraster", () => {
  // Ziehen rastet auf GRID_SIZE. Setzt Ausrichten ein Gerät daneben, kann man
  // danach kein gezogenes Gerät mehr mit ihm in eine Flucht bringen.
  it("oben ausrichten landet auf einem Vielfachen des Rasters", () => {
    const pos = align([device("a", 0, 176), device("b", 400, 240)], "top");
    for (const p of pos) {
      expect(p.x % GRID_SIZE).toBe(0);
      expect(p.y % GRID_SIZE).toBe(0);
    }
    expect(pos[0].y).toBe(pos[1].y);
  });

  it("links ausrichten landet auf einem Vielfachen des Rasters", () => {
    const pos = align([device("a", 176, 0), device("b", 240, 400)], "left");
    for (const p of pos) expect(p.x % GRID_SIZE).toBe(0);
    expect(pos[0].x).toBe(pos[1].x);
  });

  it("rechts ausrichten bringt die rechten Kanten verschieden breiter Geräte in eine Flucht", () => {
    const nodes = [device("a", 0, 0, 176), device("b", 32, 400, 224)];
    const pos = align(nodes, "right");
    expect(pos[0].x + 176).toBe(pos[1].x + 224);
  });
});
