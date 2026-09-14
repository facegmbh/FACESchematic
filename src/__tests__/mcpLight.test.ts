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

// ── Phase B: Räume ─────────────────────────────────────────────────

type RoomResult = {
  roomId: string; name: string; heightMm: number; floorAreaM2: number;
  reflectance: { ceiling: number; walls: number; floor: number };
  pointsM: { xM: number; yM: number }[];
};
type Suggestions = {
  wallCount: number;
  suggestions: ({ ok: true; floorAreaM2: number; pointsM: { xM: number; yM: number }[] } | { ok: false; reason: string; error: string })[];
};
type RoomReport = Report & {
  roomCount?: number;
  rooms?: { roomId: string; name: string; averageLux: number; minLux: number; indirectLux: number; uniformity: number; floorAreaM2: number; meanReflectance: number }[];
};

/** Vier Wandzüge um einen Raum — in realen Metern gedacht, in Papier-mm abgelegt.
 *  Bei 1:50 auf A1 liegt die Zeichenfläche bei etwa x=20, y=20. */
function walledRoom(pageId: string, xM: number, yM: number, wM: number, hM: number) {
  const st = useSchematicStore.getState();
  const page = st.pages.find((p) => p.id === pageId)!;
  if (page.type !== "floorplan") throw new Error("keine Grundrissseite");
  // Reale Meter → Papier-mm relativ zur Zeichenfläche. Die Ecke der Zeichenfläche holen
  // wir uns über ein Symbol-Roundtrip nicht, sondern rechnen sie wie der Bridge-Code.
  const originMm = { x: 20, y: 20 };
  const toPaper = (mx: number, my: number) => ({
    x: originMm.x + (mx * 1000) / page.scaleDenominator,
    y: originMm.y + (my * 1000) / page.scaleDenominator,
  });
  const c = [toPaper(xM, yM), toPaper(xM + wM, yM), toPaper(xM + wM, yM + hM), toPaper(xM, yM + hM)];
  useSchematicStore.getState().addFloorplanWalls(pageId, [
    { pointsMm: [c[0], c[1]], material: "brick-solid", thicknessMm: 240 },
    { pointsMm: [c[1], c[2]], material: "brick-solid", thicknessMm: 240 },
    { pointsMm: [c[2], c[3]], material: "brick-solid", thicknessMm: 240 },
    { pointsMm: [c[3], c[0]], material: "brick-solid", thicknessMm: 240 },
  ]);
}

describe("suggest_rooms", () => {
  it("liest den Umriss aus den Wänden und trifft die Fläche", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    walledRoom(page.pageId, 2, 2, 6, 4); // 6 x 4 m = 24 m²
    const res = handlers.suggest_rooms({ pageId: page.pageId, seeds: [{ xM: 5, yM: 4 }] }) as Suggestions;
    expect(res.wallCount).toBe(4);
    const first = res.suggestions[0];
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Innenmaß, also etwas unter den 24 m² der Mittellinien.
    expect(first.floorAreaM2).toBeGreaterThan(20);
    expect(first.floorAreaM2).toBeLessThan(24);
  });

  it("sagt je Saatpunkt, was schiefging, statt den ganzen Aufruf zu verwerfen", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    walledRoom(page.pageId, 2, 2, 6, 4);
    const res = handlers.suggest_rooms({
      pageId: page.pageId,
      seeds: [{ xM: 5, yM: 4 }, { xM: 30, yM: 30 }],
    }) as Suggestions;
    expect(res.suggestions[0].ok).toBe(true);
    const second = res.suggestions[1];
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.length).toBeGreaterThan(10);
  });

  it("verweist auf den Editor, wenn es noch keine Wände gibt", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    expect(() => handlers.suggest_rooms({ pageId: page.pageId, seeds: [{ xM: 5, yM: 4 }] }))
      .toThrow(/no walls/i);
  });
});

describe("define_room", () => {
  it("legt den Raum aus einem Klickpunkt an", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    walledRoom(page.pageId, 2, 2, 6, 4);
    const room = handlers.define_room({
      pageId: page.pageId, name: "Abschiedsraum", heightMm: 3000, seedM: { xM: 5, yM: 4 },
    }) as RoomResult;
    expect(room.name).toBe("Abschiedsraum");
    expect(room.floorAreaM2).toBeGreaterThan(20);
    expect(room.reflectance).toEqual({ ceiling: 0.7, walls: 0.5, floor: 0.2 });
  });

  it("nimmt auch ein fertiges Polygon", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    const room = handlers.define_room({
      pageId: page.pageId, name: "Handgezeichnet", heightMm: 2800,
      pointsM: [{ xM: 0, yM: 0 }, { xM: 6, yM: 0 }, { xM: 6, yM: 4 }, { xM: 0, yM: 4 }],
    }) as RoomResult;
    expect(room.floorAreaM2).toBeCloseTo(24, 1);
  });

  it("verlangt genau eines von Saatpunkt und Polygon", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    expect(() => handlers.define_room({ pageId: page.pageId, name: "X", heightMm: 3000 }))
      .toThrow(/exactly one/);
    expect(() => handlers.define_room({
      pageId: page.pageId, name: "X", heightMm: 3000,
      seedM: { xM: 1, yM: 1 }, pointsM: [{ xM: 0, yM: 0 }, { xM: 1, yM: 0 }, { xM: 1, yM: 1 }],
    })).toThrow(/exactly one/);
  });

  it("weist Meter zurück, wo Millimeter verlangt sind", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    expect(() => handlers.define_room({
      pageId: page.pageId, name: "X", heightMm: 3,
      pointsM: [{ xM: 0, yM: 0 }, { xM: 6, yM: 0 }, { xM: 6, yM: 4 }],
    })).toThrow(/MILLIMETRES/);
  });

  it("weist unsinnige Reflexionsgrade zurück", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    expect(() => handlers.define_room({
      pageId: page.pageId, name: "X", heightMm: 3000,
      pointsM: [{ xM: 0, yM: 0 }, { xM: 6, yM: 0 }, { xM: 6, yM: 4 }],
      reflectance: { ceiling: 1.4, walls: 0.5, floor: 0.2 },
    })).toThrow(/reflectance.ceiling/);
  });

  it("erkennt ein Polygon ohne Fläche", () => {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    expect(() => handlers.define_room({
      pageId: page.pageId, name: "X", heightMm: 3000,
      pointsM: [{ xM: 0, yM: 0 }, { xM: 3, yM: 0 }, { xM: 6, yM: 0 }],
    })).toThrow(/enclose no area/);
  });
});

describe("light_report mit Räumen", () => {
  /** Ein fertiger Lichtplan: Raum, Leuchte, n Spots darin. */
  function litRoom(spotCount: number, spacingM: number) {
    const spot = handlers.create_luminaire({ label: "MAG48 Spot", fluxLm: 900, beamAngleDeg: 36, powerW: 10 }) as CreateResult;
    useSchematicStore.setState({
      nodes: Array.from({ length: spotCount }, (_, i) => luminaireDevice(`d${i}`, spot.templateId)),
      pages: [],
    });
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    walledRoom(page.pageId, 2, 2, 6, 4);
    handlers.define_room({ pageId: page.pageId, name: "Abschiedsraum", heightMm: 3000, seedM: { xM: 5, yM: 4 } });
    const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "Spots" }) as { groupId: string };
    handlers.place_floorplan_symbols({
      pageId: page.pageId,
      symbols: Array.from({ length: spotCount }, (_, i) => ({
        groupId: group.groupId,
        deviceId: `d${i}`,
        xM: 3 + (i % 4) * spacingM,
        yM: 3 + Math.floor(i / 4) * spacingM,
        mountHeightMm: 2900,
      })),
    });
    return handlers.light_report({ pageId: page.pageId }) as RoomReport;
  }

  it("rechnet je Raum statt über ein Hilfsrechteck", () => {
    const report = litRoom(8, 1.3);
    expect(report.rooms).toHaveLength(1);
    const room = report.rooms![0];
    expect(room.name).toBe("Abschiedsraum");
    expect(room.floorAreaM2).toBeGreaterThan(20);
    expect(room.averageLux).toBeGreaterThan(0);
    expect(room.meanReflectance).toBeCloseTo(0.48, 1);
  });

  it("weist den indirekten Anteil aus und zählt ihn mit", () => {
    const report = litRoom(8, 1.3);
    const room = report.rooms![0];
    // 8 Spots à 900 lm in einem 6x4x3-Raum: rund 61 lx indirekt, mal Wartungsfaktor 0,8.
    expect(room.indirectLux).toBeGreaterThan(40);
    expect(room.indirectLux).toBeLessThan(60);
    // Und E_min kann nicht unter dem indirekten Anteil liegen — er liegt überall an.
    expect(room.minLux).toBeGreaterThanOrEqual(room.indirectLux);
  });

  it("nennt die Interreflexion in der Herkunftsangabe", () => {
    expect(litRoom(4, 1.3).basis).toMatch(/interreflected/);
    expect(litRoom(4, 1.3).basis).toMatch(/not a DIN EN 12464-1 verification/);
  });

  it("weist ohne Raum darauf hin, dass die Zahl zu dunkel ist", () => {
    const spot = handlers.create_luminaire({ label: "Spot", fluxLm: 900, beamAngleDeg: 36 }) as CreateResult;
    useSchematicStore.setState({ nodes: [luminaireDevice("d1", spot.templateId)], pages: [] });
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    const group = handlers.add_floorplan_group({ pageId: page.pageId, label: "S" }) as { groupId: string };
    handlers.place_floorplan_symbols({ pageId: page.pageId, symbols: [{ groupId: group.groupId, deviceId: "d1", xM: 3, yM: 3 }] });
    const report = handlers.light_report({ pageId: page.pageId }) as RoomReport;
    expect(report.rooms).toBeUndefined();
    expect(report.hint).toMatch(/define_room/);
  });
});

describe("update_room / remove_room", () => {
  function roomOnPage() {
    const page = handlers.create_floorplan({ kind: "light" }) as Summary;
    const room = handlers.define_room({
      pageId: page.pageId, name: "Raum", heightMm: 3000,
      pointsM: [{ xM: 0, yM: 0 }, { xM: 6, yM: 0 }, { xM: 6, yM: 4 }, { xM: 0, yM: 4 }],
    }) as RoomResult;
    return { pageId: page.pageId, roomId: room.roomId };
  }

  it("ändert Höhe und Reflexionsgrade", () => {
    const { pageId, roomId } = roomOnPage();
    const updated = handlers.update_room({
      pageId, roomId, heightMm: 4000, reflectance: { ceiling: 0.5, walls: 0.3, floor: 0.1 },
    }) as RoomResult;
    expect(updated.heightMm).toBe(4000);
    expect(updated.reflectance.walls).toBe(0.3);
  });

  it("verlangt mindestens eine Änderung", () => {
    const { pageId, roomId } = roomOnPage();
    expect(() => handlers.update_room({ pageId, roomId })).toThrow(/at least one/);
  });

  it("entfernt den Raum", () => {
    const { pageId, roomId } = roomOnPage();
    expect(handlers.remove_room({ pageId, roomId })).toEqual({ removed: true, roomId });
    expect(() => handlers.update_room({ pageId, roomId, heightMm: 3000 })).toThrow(/No room/);
  });
});
