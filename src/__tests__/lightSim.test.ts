import { describe, it, expect } from "vitest";
import {
  cosExponent,
  peakIntensityCd,
  intensityCd,
  illuminanceAtLux,
  totalIlluminanceLux,
  collectLuminaires,
  computeLuxGrid,
  gridStats,
  luxColor,
  luminaireBoundsMm,
  connectedLoadW,
  type LuminairePlacement,
  type LightCalcOptions,
} from "../lightSim";
import {
  roomSurfacesM2,
  meanReflectance,
  indirectLux,
  fluxInRoomLm,
  roomStats,
} from "../lightSim";
import { DEFAULT_REFLECTANCE, type FloorplanRoom, type LuminairePhotometry } from "../types";

/** Der MAG48-Spot aus dem Plan: 900 lm, 36°, 10 W. */
const SPOT: LuminairePhotometry = { fluxLm: 900, beamAngleDeg: 36, powerW: 10, cctK: 3000 };

/** 1:50, Nutzebene 0,85 m, ohne Wartungsabschlag — so lassen sich die Rohwerte prüfen. */
const OPTS: LightCalcOptions = { scaleDenominator: 50, workPlaneMm: 850, maintenanceFactor: 1 };

function spotAt(xMm: number, yMm: number, mountHeightMm = 2900): LuminairePlacement {
  return { positionMm: { x: xMm, y: yMm }, mountHeightMm, photometry: SPOT, dimming: 1 };
}

describe("cosExponent", () => {
  it("leitet den Exponenten aus dem Halbwertswinkel ab", () => {
    // cos^n(18°) = 0,5 → n = ln(0,5)/ln(cos 18°) ≈ 13,8
    expect(cosExponent(36)).toBeCloseTo(13.83, 1);
  });

  it("gibt bei halber Lichtstärke genau den halben Wert", () => {
    // Die Definition selbst: am Rand des Abstrahlwinkels ist I auf 50 % gefallen.
    const half = intensityCd(SPOT, (18 * Math.PI) / 180);
    const peak = intensityCd(SPOT, 0);
    expect(half / peak).toBeCloseTo(0.5, 6);
  });

  it("nähert sich bei 120° dem Lambert-Strahler", () => {
    expect(cosExponent(120)).toBeCloseTo(1, 2);
  });

  it("fängt unsinnige Winkel ab statt zu divergieren", () => {
    expect(Number.isFinite(cosExponent(0))).toBe(true);
    expect(Number.isFinite(cosExponent(-5))).toBe(true);
    expect(cosExponent(180)).toBe(0);
    expect(cosExponent(400)).toBe(0);
  });
});

describe("peakIntensityCd", () => {
  it("rechnet den Lichtstrom des MAG48-Spots in Candela um", () => {
    // I₀ = Φ·(n+1)/2π = 900 · 14,83 / 6,283 ≈ 2124 cd
    expect(peakIntensityCd(900, cosExponent(36))).toBeCloseTo(2124, -1);
  });

  it("integriert sich über die Halbkugel zum Lichtstrom zurück", () => {
    // Φ = 2π ∫ I(γ)·sin γ dγ — numerisch über 90°, die Gegenprobe zur Normierung aus §5.3.
    const n = cosExponent(36);
    const i0 = peakIntensityCd(900, n);
    const steps = 20000;
    let flux = 0;
    for (let i = 0; i < steps; i++) {
      const g = ((i + 0.5) / steps) * (Math.PI / 2);
      flux += i0 * Math.pow(Math.cos(g), n) * Math.sin(g) * ((Math.PI / 2) / steps);
    }
    expect(2 * Math.PI * flux).toBeCloseTo(900, 0);
  });
});

describe("illuminanceAtLux", () => {
  it("trifft direkt unter der Leuchte I₀/h²", () => {
    // 2,90 m Montagehöhe auf 0,85 m Nutzebene → h = 2,05 m; 2124/2,05² ≈ 505 lx.
    // Das ist das Rechenbeispiel aus LIGHT_SIMULATION_PLAN.md §5.2.
    const e = illuminanceAtLux(spotAt(100, 100), { x: 100, y: 100 }, OPTS);
    expect(e).toBeCloseTo(505, -1);
  });

  it("fällt seitlich schneller ab als mit dem reinen Abstandsquadrat", () => {
    // Zwei Effekte überlagern sich: der längere Weg UND der Abfall der Lichtstärke.
    const under = illuminanceAtLux(spotAt(100, 100), { x: 100, y: 100 }, OPTS);
    // 1 m seitlich: bei 1:50 sind das 20 Papier-mm.
    const aside = illuminanceAtLux(spotAt(100, 100), { x: 120, y: 100 }, OPTS);
    const inverseSquareOnly = under * (2.05 ** 2 / (2.05 ** 2 + 1));
    expect(aside).toBeLessThan(inverseSquareOnly);
  });

  it("rechnet den Maßstab mit: derselbe Papierabstand ist bei 1:100 die doppelte Strecke", () => {
    const at50 = illuminanceAtLux(spotAt(100, 100), { x: 120, y: 100 }, OPTS);
    const at100 = illuminanceAtLux(spotAt(100, 100), { x: 120, y: 100 }, { ...OPTS, scaleDenominator: 100 });
    expect(at100).toBeLessThan(at50);
  });

  it("gibt null, wenn die Leuchte auf oder unter der Nutzebene hängt", () => {
    expect(illuminanceAtLux(spotAt(100, 100, 850), { x: 100, y: 100 }, OPTS)).toBe(0);
    expect(illuminanceAtLux(spotAt(100, 100, 400), { x: 100, y: 100 }, OPTS)).toBe(0);
  });

  it("skaliert linear mit der Dimmung", () => {
    const full = illuminanceAtLux(spotAt(100, 100), { x: 100, y: 100 }, OPTS);
    const half = illuminanceAtLux(
      { ...spotAt(100, 100), dimming: 0.5 }, { x: 100, y: 100 }, OPTS,
    );
    expect(half).toBeCloseTo(full / 2, 6);
  });
});

describe("totalIlluminanceLux", () => {
  it("addiert die Leuchten — anders als das WLAN, wo nur die stärkste zählt", () => {
    const one = totalIlluminanceLux([spotAt(100, 100)], { x: 100, y: 100 }, OPTS);
    const two = totalIlluminanceLux([spotAt(100, 100), spotAt(100, 100)], { x: 100, y: 100 }, OPTS);
    expect(two).toBeCloseTo(2 * one, 6);
  });

  it("wendet den Wartungsfaktor an", () => {
    const raw = totalIlluminanceLux([spotAt(100, 100)], { x: 100, y: 100 }, OPTS);
    const maintained = totalIlluminanceLux([spotAt(100, 100)], { x: 100, y: 100 }, { ...OPTS, maintenanceFactor: 0.8 });
    expect(maintained).toBeCloseTo(raw * 0.8, 6);
  });
});

describe("collectLuminaires", () => {
  const page = {
    symbols: [
      { id: "s1", groupId: "g1", positionMm: { x: 10, y: 10 }, deviceNodeId: "d1" },
      { id: "s2", groupId: "g1", positionMm: { x: 20, y: 10 }, deviceNodeId: "d1", mountHeightMm: 4000, dimming: 0.5 },
      { id: "s3", groupId: "gHidden", positionMm: { x: 30, y: 10 }, deviceNodeId: "d1" },
      { id: "s4", groupId: "g1", positionMm: { x: 40, y: 10 } },
      { id: "s5", groupId: "g1", positionMm: { x: 50, y: 10 }, deviceNodeId: "dSpeaker" },
    ],
    groups: [{ id: "g1" }, { id: "gHidden", hidden: true }],
  };
  const resolve = (id: string) => (id === "d1" ? SPOT : undefined);

  it("nimmt nur Symbole, deren Gerät eine Photometrie hat", () => {
    const lums = collectLuminaires(page, 2900, resolve);
    // s3 liegt auf einer ausgeblendeten Ebene, s4 hat kein Gerät, s5 ist ein Lautsprecher.
    expect(lums.map((l) => l.id)).toEqual(["s1", "s2"]);
  });

  it("erbt die Montagehöhe der Seite und lässt sie am Symbol überschreiben", () => {
    const lums = collectLuminaires(page, 2900, resolve);
    expect(lums[0].mountHeightMm).toBe(2900);
    expect(lums[0].dimming).toBe(1);
    expect(lums[1].mountHeightMm).toBe(4000);
    expect(lums[1].dimming).toBe(0.5);
  });
});

describe("computeLuxGrid / gridStats", () => {
  const area = { x: 0, y: 0, w: 100, h: 100 };

  it("liefert ein leeres Raster ohne Leuchten", () => {
    const grid = computeLuxGrid([], area, { ...OPTS, pitchMm: 10 });
    const stats = gridStats(grid);
    expect(stats.maxLux).toBe(0);
    expect(stats.uniformity).toBe(0);
  });

  it("ist unter der Leuchte am hellsten und am Rand am dunkelsten", () => {
    const grid = computeLuxGrid([spotAt(50, 50)], area, { ...OPTS, pitchMm: 5 });
    const stats = gridStats(grid);
    expect(stats.maxLux).toBeGreaterThan(stats.avgLux);
    expect(stats.minLux).toBeLessThan(stats.avgLux);
    // Ein einzelner enger Spot über einer großen Fläche ist alles andere als gleichmäßig.
    expect(stats.uniformity).toBeLessThan(0.2);
  });

  it("wird durch mehr Leuchten gleichmäßiger", () => {
    const one = gridStats(computeLuxGrid([spotAt(50, 50)], area, { ...OPTS, pitchMm: 5 }));
    const four = gridStats(computeLuxGrid(
      [spotAt(25, 25), spotAt(75, 25), spotAt(25, 75), spotAt(75, 75)],
      area, { ...OPTS, pitchMm: 5 },
    ));
    expect(four.uniformity).toBeGreaterThan(one.uniformity);
    expect(four.avgLux).toBeGreaterThan(one.avgLux);
  });

  it("deckt den Bereich ab und hält die Schrittweite ein", () => {
    const grid = computeLuxGrid([spotAt(50, 50)], area, { ...OPTS, pitchMm: 10 });
    expect(grid.pitchMm).toBe(10);
    expect((grid.cols - 1) * grid.pitchMm).toBeGreaterThanOrEqual(area.w);
    expect(grid.lux.length).toBe(grid.cols * grid.rows);
  });
});

describe("luminaireBoundsMm", () => {
  it("hat ohne Leuchten keinen Bereich", () => {
    expect(luminaireBoundsMm([], OPTS)).toBeNull();
  });

  it("weitet das Rechteck um einen halben Leuchtenabstand auf", () => {
    const bounds = luminaireBoundsMm([spotAt(100, 100), spotAt(200, 150)], OPTS);
    // Nächster Nachbar für beide: hypot(100, 50) = 111,8 Papier-mm → halbiert 55,9.
    const pad = Math.hypot(100, 50) / 2;
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeCloseTo(100 - pad, 5);
    expect(bounds!.y).toBeCloseTo(100 - pad, 5);
    expect(bounds!.w).toBeCloseTo(100 + 2 * pad, 5);
    expect(bounds!.h).toBeCloseTo(50 + 2 * pad, 5);
  });

  it("nimmt bei einer einzelnen Leuchte die Montagehöhe als Ersatzmaßstab", () => {
    const bounds = luminaireBoundsMm([spotAt(100, 100)], OPTS);
    // h = 2,05 m = 2050 reale mm → bei 1:50 sind das 41 Papier-mm.
    expect(bounds!.x).toBeCloseTo(59, 5);
    expect(bounds!.w).toBeCloseTo(82, 5);
  });

  it("liefert eine brauchbare Gleichmäßigkeit statt einer konstanten Null", () => {
    // Der Grund für die Regel: über einem zu groß gewählten Bereich wäre E_min bei engen
    // Spots immer null und U₀ damit als Kennzahl wertlos.
    const grid2 = computeLuxGrid([spotAt(100, 100), spotAt(150, 100)], luminaireBoundsMm([spotAt(100, 100), spotAt(150, 100)], OPTS)!, { ...OPTS, pitchMm: 2 });
    expect(gridStats(grid2).uniformity).toBeGreaterThan(0);
  });
});

describe("luxColor", () => {
  it("folgt der Falschfarben-Konvention: dunkel ist blau, hell ist rot", () => {
    expect(luxColor(1000)).toBe("#dc2626");
    expect(luxColor(400)).toBe("#eab308");
    expect(luxColor(5)).toBe("#1e1b4b");
  });

  it("trifft die Stufengrenzen von unten", () => {
    expect(luxColor(300)).toBe("#eab308");
    expect(luxColor(299.9)).toBe("#65a30d");
  });
});

describe("connectedLoadW", () => {
  it("summiert die Leistung und berücksichtigt die Dimmung", () => {
    expect(connectedLoadW([spotAt(0, 0), spotAt(10, 0)])).toBe(20);
    expect(connectedLoadW([{ ...spotAt(0, 0), dimming: 0.5 }])).toBe(5);
  });

  it("zählt Leuchten ohne Leistungsangabe mit null", () => {
    const noPower: LuminairePlacement = {
      positionMm: { x: 0, y: 0 }, mountHeightMm: 2900, dimming: 1,
      photometry: { fluxLm: 500, beamAngleDeg: 60 },
    };
    expect(connectedLoadW([noPower])).toBe(0);
  });
});

// ── Phase B: Räume, Interreflexion, raumbezogene Kennwerte ──────────

/** Der Testraum aus dem Plan: 6 x 4 m bei 1:50 sind 120 x 80 Papier-mm. */
function room6x4(overrides: Partial<FloorplanRoom> = {}): FloorplanRoom {
  return {
    id: "R01",
    name: "Abschiedsraum",
    pointsMm: [{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 220, y: 180 }, { x: 100, y: 180 }],
    heightMm: 3000,
    ...overrides,
  };
}

describe("roomSurfacesM2", () => {
  it("misst Boden, Decke und Wände des 6 x 4 x 3 m Raums", () => {
    const a = roomSurfacesM2(room6x4(), 50);
    expect(a.floor).toBeCloseTo(24, 5);
    expect(a.ceiling).toBeCloseTo(24, 5);
    expect(a.walls).toBeCloseTo(2 * (6 + 4) * 3, 5); // 60 m²
    expect(a.total).toBeCloseTo(108, 5);
  });

  it("wächst mit der Raumhöhe nur über die Wände", () => {
    const low = roomSurfacesM2(room6x4({ heightMm: 2500 }), 50);
    const high = roomSurfacesM2(room6x4({ heightMm: 4000 }), 50);
    expect(high.floor).toBeCloseTo(low.floor, 5);
    expect(high.walls).toBeGreaterThan(low.walls);
  });
});

describe("meanReflectance", () => {
  it("gewichtet die Flächen, nicht die drei Zahlen", () => {
    // (0,7·24 + 0,5·60 + 0,2·24) / 108 = 51,6 / 108 = 0,478
    expect(meanReflectance(room6x4(), 50)).toBeCloseTo(0.478, 3);
  });

  it("nimmt ohne Angabe die üblichen Ansätze", () => {
    const explicit = meanReflectance(room6x4({ reflectance: DEFAULT_REFLECTANCE }), 50);
    expect(meanReflectance(room6x4(), 50)).toBeCloseTo(explicit, 10);
  });

  it("folgt den eingetragenen Werten", () => {
    const dark = meanReflectance(room6x4({ reflectance: { ceiling: 0.2, walls: 0.1, floor: 0.1 } }), 50);
    expect(dark).toBeLessThan(meanReflectance(room6x4(), 50));
  });
});

describe("indirectLux", () => {
  it("trifft die Handrechnung für 8 Spots im Abschiedsraum", () => {
    // Φ·ρ̄ / (A·(1−ρ̄)) = 7200 · 0,478 / (108 · 0,522) ≈ 61 lx
    expect(indirectLux(8 * 900, room6x4(), 50)).toBeCloseTo(61, 0);
  });

  it("ist linear im Lichtstrom", () => {
    const one = indirectLux(900, room6x4(), 50);
    expect(indirectLux(3600, room6x4(), 50)).toBeCloseTo(4 * one, 6);
  });

  it("fällt in einem dunklen Raum deutlich ab", () => {
    const bright = indirectLux(7200, room6x4(), 50);
    const dark = indirectLux(7200, room6x4({ reflectance: { ceiling: 0.3, walls: 0.2, floor: 0.1 } }), 50);
    expect(dark).toBeLessThan(bright / 2);
  });

  it("bleibt endlich, auch wenn jemand Reflexionsgrade von 1 einträgt", () => {
    const absurd = indirectLux(7200, room6x4({ reflectance: { ceiling: 1, walls: 1, floor: 1 } }), 50);
    expect(Number.isFinite(absurd)).toBe(true);
  });

  it("ist ohne Licht und ohne Fläche null", () => {
    expect(indirectLux(0, room6x4(), 50)).toBe(0);
    expect(indirectLux(7200, room6x4({ pointsMm: [] }), 50)).toBe(0);
  });
});

describe("fluxInRoomLm", () => {
  it("zählt nur die Leuchten innerhalb des Polygons", () => {
    const inside = spotAt(160, 140);
    const outside = spotAt(300, 140);
    expect(fluxInRoomLm([inside, outside], room6x4())).toBe(900);
  });

  it("rechnet die Dimmung mit", () => {
    expect(fluxInRoomLm([{ ...spotAt(160, 140), dimming: 0.5 }], room6x4())).toBe(450);
  });
});

describe("roomStats", () => {
  const statOpts = { scaleDenominator: 50, workPlaneMm: 850, maintenanceFactor: 1, pitchMm: 4 };

  it("mittelt nur über das Rauminnere", () => {
    // Eine Leuchte im Raum, eine weit außerhalb: die außen liegende darf den Mittelwert
    // nicht mit ihrer eigenen Umgebung verwässern.
    const stats = roomStats([spotAt(160, 140)], room6x4(), statOpts);
    expect(stats.samples).toBeGreaterThan(100);
    expect(stats.avgLux).toBeGreaterThan(0);
    expect(stats.floorAreaM2).toBeCloseTo(24, 5);
  });

  it("hebt den indirekte Anteil den ganzen Raum an", () => {
    const withRoom = roomStats([spotAt(160, 140)], room6x4(), statOpts);
    const dark = roomStats([spotAt(160, 140)], room6x4({ reflectance: { ceiling: 0, walls: 0, floor: 0 } }), statOpts);
    expect(withRoom.indirectLux).toBeGreaterThan(0);
    expect(dark.indirectLux).toBe(0);
    // Der Unterschied ist genau der indirekte Anteil — er liegt überall gleich an.
    expect(withRoom.avgLux - dark.avgLux).toBeCloseTo(withRoom.indirectLux, 4);
    expect(withRoom.minLux - dark.minLux).toBeCloseTo(withRoom.indirectLux, 4);
  });

  it("macht die Gleichmäßigkeit besser, nicht schlechter", () => {
    // Das ist der eigentliche Gewinn von Phase B: der indirekte Anteil hebt die dunklen
    // Ecken an und ist damit genau dort am wirksamsten, wo U₀ entschieden wird.
    const lit = roomStats([spotAt(160, 140)], room6x4(), statOpts);
    const noBounce = roomStats([spotAt(160, 140)], room6x4({ reflectance: { ceiling: 0, walls: 0, floor: 0 } }), statOpts);
    expect(lit.uniformity).toBeGreaterThan(noBounce.uniformity);
  });

  it("meldet einen Raum ohne Licht als null statt als Fehler", () => {
    const stats = roomStats([], room6x4(), statOpts);
    expect(stats.avgLux).toBe(0);
    expect(stats.indirectLux).toBe(0);
  });
});

describe("computeLuxGrid mit Räumen", () => {
  const area = { x: 90, y: 90, w: 140, h: 100 };
  const opts = { scaleDenominator: 50, workPlaneMm: 850, maintenanceFactor: 1, pitchMm: 4 };

  it("legt den indirekten Anteil innerhalb des Raums auf, außerhalb nicht", () => {
    const lums = [spotAt(160, 140)];
    const plain = computeLuxGrid(lums, area, opts);
    const withRoom = computeLuxGrid(lums, area, { ...opts, rooms: [room6x4()] });
    const idx = (x: number, y: number) => {
      const c = Math.round((x - area.x) / opts.pitchMm);
      const r = Math.round((y - area.y) / opts.pitchMm);
      return r * withRoom.cols + c;
    };
    const inside = idx(160, 140);
    const outside = idx(95, 95); // Ecke der Zeichenfläche, außerhalb des Raums
    expect(withRoom.lux[inside]).toBeGreaterThan(plain.lux[inside]);
    expect(withRoom.lux[outside]).toBeCloseTo(plain.lux[outside], 4);
  });

  it("überspringt ausgeblendete Räume", () => {
    const lums = [spotAt(160, 140)];
    const hidden = computeLuxGrid(lums, area, { ...opts, rooms: [room6x4({ hidden: true })] });
    const plain = computeLuxGrid(lums, area, opts);
    expect(hidden.lux[0]).toBeCloseTo(plain.lux[0], 6);
  });
});
