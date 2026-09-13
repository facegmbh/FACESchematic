/**
 * Handler-level tests for the Ship-L light MCP tools.
 *
 * Der Schwerpunkt liegt auf den Wachen, nicht auf der Physik — die steht in
 * lightSim.test.ts. Hier geht es darum, was passiert, wenn Claude ein Datenblatt falsch
 * liest: Halbwinkel statt vollem Abstrahlwinkel, Meter statt Millimeter, ein Faktor zehn
 * beim Lichtstrom. Genau das sind die Fehler, die ein Werkzeug abfangen muss, weil sie im
 * Ergebnis nicht mehr auffallen.
 *
 * Gleicher In-Memory-Bootstrap wie mcpFloorplan.test.ts.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { DeviceData, SchematicNode } from "../types";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}

let useSchematicStore: typeof import("../store")["useSchematicStore"];
let handlers: typeof import("../mcpBridge")["handlers"];

beforeAll(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
  ({ useSchematicStore } = await import("../store"));
  ({ handlers } = await import("../mcpBridge"));
});

type CreateResult = {
  templateId: string;
  label: string;
  photometry: { fluxLm: number; beamAngleDeg: number; origin: string };
  derived: { cosExponent: number; peakIntensityCd: number; exampleLuxBelow: number };
};
type Report = {
  luminaireCount: number; averageLux: number; minLux: number; maxLux: number;
  uniformity: number; connectedLoadW: number; basis: string; hint?: string;
};
type Summary = { pageId: string; groups: { groupId: string }[] };

/** Ein Gerät, das auf ein Leuchten-Template zeigt — so hängt ein Plansymbol an Photometrie. */
function luminaireDevice(id: string, templateId: string): SchematicNode {
  return {
    id,
    type: "device",
    position: { x: 0, y: 0 },
    data: { label: `Leuchte ${id}`, deviceType: "luminaire", templateId, ports: [] } as DeviceData,
  } as SchematicNode;
}

beforeEach(() => {
  useSchematicStore.setState({ nodes: [], edges: [], pages: [], customTemplates: [] });
});

describe("create_luminaire", () => {
  it("legt den MAG48-Spot an und gibt die Plausibilitätsrechnung zurück", () => {
    const res = handlers.create_luminaire({
      label: "Magnetschiene 48 V Spot 10 W 3000 K",
      fluxLm: 900, beamAngleDeg: 36, powerW: 10, cctK: 3000, system: "MAG48",
    }) as CreateResult;

    expect(res.photometry.origin).toBe("datasheet");
    expect(res.derived.cosExponent).toBeCloseTo(13.83, 1);
    expect(res.derived.peakIntensityCd).toBeCloseTo(2124, -1);
    // Das ist die Zahl, an der ein Verlesen auffällt: rund 505 lx bei 2,90 m auf 0,85 m.
    expect(res.derived.exampleLuxBelow).toBeGreaterThan(450);
    expect(res.derived.exampleLuxBelow).toBeLessThan(560);
  });

  it("macht einen Faktor zehn beim Lichtstrom sichtbar statt ihn zu schlucken", () => {
    const right = handlers.create_luminaire({ label: "richtig", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    const wrong = handlers.create_luminaire({ label: "verlesen", fluxLm: 9000, beamAngleDeg: 36 }) as CreateResult;
    expect(wrong.derived.exampleLuxBelow).toBeCloseTo(right.derived.exampleLuxBelow * 10, -2);
    expect(wrong.derived.exampleLuxBelow).toBeGreaterThan(4000);
  });

  it("macht den Halbwinkel-Fehler sichtbar", () => {
    // 18° statt 36°: doppelt so eng, also grob die vierfache Lichtstärke in der Achse.
    const full = handlers.create_luminaire({ label: "voll", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    const half = handlers.create_luminaire({ label: "halb", fluxLm: 900, beamAngleDeg: 18 }) as CreateResult;
    expect(half.derived.peakIntensityCd).toBeGreaterThan(full.derived.peakIntensityCd * 3);
  });

  it("weist unbrauchbare Datenblattwerte zurück", () => {
    expect(() => handlers.create_luminaire({ label: "x", fluxLm: 0, beamAngleDeg: 36 })).toThrow(/fluxLm/);
    expect(() => handlers.create_luminaire({ label: "x", fluxLm: 900, beamAngleDeg: 0 })).toThrow(/beamAngleDeg/);
    expect(() => handlers.create_luminaire({ label: "x", fluxLm: 900, beamAngleDeg: 400 })).toThrow(/beamAngleDeg/);
    expect(() => handlers.create_luminaire({ label: "", fluxLm: 900, beamAngleDeg: 36 })).toThrow(/label/);
  });

  it("nimmt keine erfundene Messung entgegen", () => {
    // Eine Messung kommt über ihre eigene Auswertung herein (Phase C), nicht über
    // getippte Datenblattwerte mit umgestelltem Etikett.
    expect(() => handlers.create_luminaire({ label: "x", fluxLm: 900, beamAngleDeg: 36, origin: "measured" }))
      .toThrow(/origin must be/);
  });

  it("legt das Template im Katalog ab, auffindbar über list_luminaires", async () => {
    const created = handlers.create_luminaire({ label: "Surf20 Linienleuchte", fluxLm: 2400, beamAngleDeg: 110, powerW: 20, system: "Surf20" }) as CreateResult;
    const list = await handlers.list_luminaires({ query: "surf" }) as { luminaires: { templateId: string; label: string; fluxLm: number }[] };
    expect(list.luminaires).toHaveLength(1);
    expect(list.luminaires[0].templateId).toBe(created.templateId);
    expect(list.luminaires[0].fluxLm).toBe(2400);
  });

  it("vergibt auch im Block eindeutige Ids", () => {
    const a = handlers.create_luminaire({ label: "A", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    const b = handlers.create_luminaire({ label: "B", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    expect(a.templateId).not.toBe(b.templateId);
  });
});

describe("set_light_calculation", () => {
  it("weist Meter zurück, wo Millimeter verlangt sind", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    // 2,9 statt 2900 — der Fehler, der eine Rechnung still um den Faktor 1000 verschiebt.
    expect(() => handlers.set_light_calculation({ pageId: page.pageId, defaultMountHeightMm: 2.9 }))
      .toThrow(/MILLIMETRES/);
    expect(() => handlers.set_light_calculation({ pageId: page.pageId, workPlaneMm: 0.85 }))
      .not.toThrow();
  });

  it("hält den Wartungsfaktor in seinen Grenzen", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    expect(() => handlers.set_light_calculation({ pageId: page.pageId, maintenanceFactor: 1.5 })).toThrow(/maintenanceFactor/);
    expect(() => handlers.set_light_calculation({ pageId: page.pageId, maintenanceFactor: 0 })).toThrow(/maintenanceFactor/);
  });

  it("verlangt mindestens eine Einstellung", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    expect(() => handlers.set_light_calculation({ pageId: page.pageId })).toThrow(/at least one/);
  });
});

describe("Lichtplan von Anfang bis Ende", () => {
  it("schaltet das Lux-Raster mit dem Plantyp ein", () => {
    const page = handlers.create_floorplan({ kind: "light", label: "Abschiedsraum" }) as Summary;
    const res = handlers.set_light_calculation({ pageId: page.pageId, workPlaneMm: 850 }) as { light: { visible: boolean } };
    expect(res.light.visible).toBe(true);
  });

  it("sagt bei einem leeren Plan, was als Nächstes zu tun ist", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    const report = handlers.light_report({ pageId: page.pageId }) as Report;
    expect(report.luminaireCount).toBe(0);
    expect(report.hint).toMatch(/create_luminaire/);
  });

  it("rechnet den Abschiedsraum durch: platzieren, rechnen, nachlegen, heller", () => {
    const spot = handlers.create_luminaire({ label: "MAG48 Spot", fluxLm: 900, beamAngleDeg: 36, powerW: 10 }) as CreateResult;
    useSchematicStore.setState({
      nodes: [luminaireDevice("d1", spot.templateId), luminaireDevice("d2", spot.templateId),
              luminaireDevice("d3", spot.templateId), luminaireDevice("d4", spot.templateId)],
    });
    const page = handlers.create_floorplan({ kind: "light", label: "Abschiedsraum" }) as Summary;
    const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "Spots" }) as { groupId: string };

    // Zwei Spots, 2,5 m auseinander, auf 2,90 m Montagehöhe.
    handlers.place_floorplan_symbols({
      pageId: page.pageId,
      symbols: [
        { groupId: group.groupId, deviceId: "d1", xM: 2, yM: 2, mountHeightMm: 2900 },
        { groupId: group.groupId, deviceId: "d2", xM: 4.5, yM: 2, mountHeightMm: 2900 },
      ],
    });
    const two = handlers.light_report({ pageId: page.pageId }) as Report;
    expect(two.luminaireCount).toBe(2);
    expect(two.connectedLoadW).toBe(20);
    expect(two.averageLux).toBeGreaterThan(0);
    expect(two.maxLux).toBeGreaterThan(two.averageLux);
    // Die Herkunft der Zahl muss mitkommen, sonst liest sie sich wie ein Nachweis.
    expect(two.basis).toMatch(/not a DIN EN 12464-1 verification/);

    // Zwei weitere Spots dazwischen: heller und gleichmäßiger — die Schleife, um die es geht.
    handlers.place_floorplan_symbols({
      pageId: page.pageId,
      symbols: [
        { groupId: group.groupId, deviceId: "d3", xM: 2, yM: 4.5, mountHeightMm: 2900 },
        { groupId: group.groupId, deviceId: "d4", xM: 4.5, yM: 4.5, mountHeightMm: 2900 },
      ],
    });
    const four = handlers.light_report({ pageId: page.pageId }) as Report;
    expect(four.luminaireCount).toBe(4);
    expect(four.averageLux).toBeGreaterThan(two.averageLux);
  });

  it("zeigt, dass enge Spots den Abstand brauchen, nicht die Stückzahl", () => {
    // Die Anordnung zu verlängern macht heller, aber nicht gleichmäßiger: ein 36°-Spot
    // leuchtet auf 2,05 m über der Nutzebene nur rund 0,7 m zur Seite, bei 2,5 m Abstand
    // überlappen sich die Kegel nicht. Näher zusammen schon — das ist der Hebel, den das
    // Playbook nennt, und deshalb steht er hier als Test.
    const spot = handlers.create_luminaire({ label: "Spot", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    const uniformityAtSpacing = (spacingM: number): number => {
      useSchematicStore.setState({
        nodes: [luminaireDevice("d1", spot.templateId), luminaireDevice("d2", spot.templateId)],
        pages: [],
      });
      const page = handlers.create_floorplan({ kind: "light" }) as Summary;
      const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "Spots" }) as { groupId: string };
      handlers.place_floorplan_symbols({
        pageId: page.pageId,
        symbols: [
          { groupId: group.groupId, deviceId: "d1", xM: 3, yM: 3, mountHeightMm: 2900 },
          { groupId: group.groupId, deviceId: "d2", xM: 3 + spacingM, yM: 3, mountHeightMm: 2900 },
        ],
      });
      return (handlers.light_report({ pageId: page.pageId }) as Report).uniformity;
    };
    expect(uniformityAtSpacing(1.3)).toBeGreaterThan(uniformityAtSpacing(2.5));
  });

  it("ist mit einem breit strahlenden Downlight bei gleichem Abstand gleichmäßiger", () => {
    const build = (beamAngleDeg: number): number => {
      const lamp = handlers.create_luminaire({ label: `L${beamAngleDeg}`, fluxLm: 900, beamAngleDeg }) as CreateResult;
      useSchematicStore.setState({
        nodes: [luminaireDevice("d1", lamp.templateId), luminaireDevice("d2", lamp.templateId)],
        pages: [],
      });
      const page = handlers.create_floorplan({ kind: "light" }) as Summary;
      const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "L" }) as { groupId: string };
      handlers.place_floorplan_symbols({
        pageId: page.pageId,
        symbols: [
          { groupId: group.groupId, deviceId: "d1", xM: 3, yM: 3, mountHeightMm: 2900 },
          { groupId: group.groupId, deviceId: "d2", xM: 5.5, yM: 3, mountHeightMm: 2900 },
        ],
      });
      return (handlers.light_report({ pageId: page.pageId }) as Report).uniformity;
    };
    expect(build(90)).toBeGreaterThan(build(36));
  });

  it("dimmt sich auf die Hälfte herunter", () => {
    const spot = handlers.create_luminaire({ label: "Spot", fluxLm: 900, beamAngleDeg: 36, powerW: 10 }) as CreateResult;
    useSchematicStore.setState({ nodes: [luminaireDevice("d1", spot.templateId)] });
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "Spots" }) as { groupId: string };
    handlers.place_floorplan_symbols({ pageId: page.pageId, symbols: [{ groupId: group.groupId, deviceId: "d1", xM: 3, yM: 3 }] });
    const full = handlers.light_report({ pageId: page.pageId }) as Report;

    const symbolId = (handlers.list_floorplans({}) as { pages: { symbols: { symbolId: string }[] }[] }).pages[0].symbols[0].symbolId;
    handlers.update_floorplan_symbol({ pageId: page.pageId, symbolId, dimming: 0.5 });
    const dimmed = handlers.light_report({ pageId: page.pageId }) as Report;

    expect(dimmed.averageLux).toBeCloseTo(full.averageLux / 2, 0);
    expect(dimmed.connectedLoadW).toBe(5);
  });

  it("weist eine Montagehöhe in Metern am Symbol zurück", () => {
    const spot = handlers.create_luminaire({ label: "Spot", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    useSchematicStore.setState({ nodes: [luminaireDevice("d1", spot.templateId)] });
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "Spots" }) as { groupId: string };
    const res = handlers.place_floorplan_symbols({
      pageId: page.pageId,
      symbols: [{ groupId: group.groupId, deviceId: "d1", xM: 3, yM: 3, mountHeightMm: 2.9 }],
    }) as { failed: number; results: { error?: string }[] };
    expect(res.failed).toBe(1);
    expect(res.results[0].error).toMatch(/MILLIMETRES/);
  });

  it("lässt Lautsprecher aus der Lichtrechnung heraus", () => {
    const spot = handlers.create_luminaire({ label: "Spot", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    useSchematicStore.setState({
      nodes: [
        luminaireDevice("d1", spot.templateId),
        { id: "d2", type: "device", position: { x: 0, y: 0 },
          data: { label: "Deckenlautsprecher", deviceType: "speaker", ports: [] } as DeviceData } as SchematicNode,
      ],
    });
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "Gemischt" }) as { groupId: string };
    handlers.place_floorplan_symbols({
      pageId: page.pageId,
      symbols: [
        { groupId: group.groupId, deviceId: "d1", xM: 2, yM: 2 },
        { groupId: group.groupId, deviceId: "d2", xM: 3, yM: 2 },
      ],
    });
    expect((handlers.light_report({ pageId: page.pageId }) as Report).luminaireCount).toBe(1);
  });
});
