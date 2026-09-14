import { describe, it, expect } from "vitest";
import {
  polygonAreaMm2,
  polygonPerimeterMm,
  pointInPolygon,
  simplifyPolyline,
  rasterizeWalls,
  suggestRoomPolygon,
  DEFAULT_BRIDGE_GAPS_MM,
} from "../floorplanRooms";
import type { FloorplanWall } from "../types";

/** Zeichenfläche, großzügig — die Suche darf nicht am Rand des Ausschnitts scheitern. */
const AREA = { x: 0, y: 0, w: 400, h: 300 };
const SCALE = 50;

let wallId = 0;
function wall(points: [number, number][], thicknessMm = 240): FloorplanWall {
  return {
    id: `w${wallId++}`,
    pointsMm: points.map(([x, y]) => ({ x, y })),
    material: "brick-solid",
    thicknessMm,
  };
}

/** Ein geschlossener Raum als vier Wandzüge. Bei 1:50 sind 120 Papier-mm sechs Meter. */
function closedRoom(x: number, y: number, w: number, h: number, thicknessMm = 240): FloorplanWall[] {
  return [
    wall([[x, y], [x + w, y]], thicknessMm),
    wall([[x + w, y], [x + w, y + h]], thicknessMm),
    wall([[x + w, y + h], [x, y + h]], thicknessMm),
    wall([[x, y + h], [x, y]], thicknessMm),
  ];
}

describe("polygonAreaMm2 / polygonPerimeterMm", () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it("misst ein Quadrat", () => {
    expect(polygonAreaMm2(square)).toBe(100);
    expect(polygonPerimeterMm(square)).toBe(40);
  });

  it("ist von der Umlaufrichtung unabhängig", () => {
    expect(polygonAreaMm2([...square].reverse())).toBe(100);
  });

  it("gibt für entartete Polygone null", () => {
    expect(polygonAreaMm2([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
    expect(polygonAreaMm2([])).toBe(0);
  });

  it("misst auch ein L", () => {
    // 10x10 minus das fehlende 5x5-Eck.
    const l = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 10 }];
    expect(polygonAreaMm2(l)).toBe(75);
  });
});

describe("pointInPolygon", () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it("unterscheidet innen und außen", () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: -1, y: 5 }, square)).toBe(false);
  });

  it("erkennt die Kerbe eines L-Raums", () => {
    const l = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPolygon({ x: 2, y: 8 }, l)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 8 }, l)).toBe(false); // das ausgeschnittene Eck
  });
});

describe("simplifyPolyline", () => {
  it("dampft eine gerade Treppe auf ihre Endpunkte ein", () => {
    const stair = [{ x: 0, y: 0 }, { x: 1, y: 0.4 }, { x: 2, y: 0 }, { x: 3, y: 0.4 }, { x: 4, y: 0 }];
    expect(simplifyPolyline(stair, 1)).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
  });

  it("behält eine echte Ecke", () => {
    const corner = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const out = simplifyPolyline(corner, 0.5);
    expect(out).toContainEqual({ x: 10, y: 0 });
    expect(out).not.toContainEqual({ x: 5, y: 0 });
  });
});

describe("rasterizeWalls", () => {
  it("stempelt die Wand mit ihrer realen Dicke plus Überbrückung", () => {
    // 240 mm reale Dicke bei 1:50 sind 4,8 Papier-mm, halb also 2,4 — plus 60/50 = 1,2
    // Überbrückung macht 3,6 Papier-mm Halbbreite.
    const grid = rasterizeWalls([wall([[100, 100], [200, 100]])], {
      scaleDenominator: SCALE, area: AREA, cellMm: 1, bridgeGapsMm: DEFAULT_BRIDGE_GAPS_MM,
    });
    const at = (x: number, y: number) => grid.wall[Math.round(y) * grid.cols + Math.round(x)];
    expect(at(150, 100)).toBe(1);
    expect(at(150, 103)).toBe(1);   // innerhalb der 3,6 mm
    expect(at(150, 105)).toBe(0);   // außerhalb
    expect(at(250, 100)).toBe(0);   // hinter dem Ende der Wand
  });

  it("überspringt ausgeblendete Wände", () => {
    const hidden = { ...wall([[100, 100], [200, 100]]), hidden: true };
    const grid = rasterizeWalls([hidden], { scaleDenominator: SCALE, area: AREA, cellMm: 1, bridgeGapsMm: 0 });
    expect(grid.wall.some((v) => v === 1)).toBe(false);
  });
});

describe("suggestRoomPolygon", () => {
  const opts = { scaleDenominator: SCALE, area: AREA };

  it("findet den Raum aus einem Klick in seine Mitte", () => {
    // 120 x 80 Papier-mm bei 1:50 = 6 x 4 m = 24 m².
    const room = suggestRoomPolygon(closedRoom(100, 100, 120, 80), { x: 160, y: 140 }, opts);
    expect(room.ok).toBe(true);
    if (!room.ok) return;
    // Das Polygon liegt an der Innenkante der Wände, ist also etwas kleiner als die
    // Mittellinien-Fläche von 9600 mm². Wand plus Überbrückung nehmen je Seite rund
    // 3,6 mm weg.
    const areaM2 = (room.areaMm2 * SCALE * SCALE) / 1e6;
    expect(areaM2).toBeGreaterThan(20);
    expect(areaM2).toBeLessThan(24);
  });

  it("liefert ein einfaches Rechteck, keine Treppe", () => {
    const room = suggestRoomPolygon(closedRoom(100, 100, 120, 80), { x: 160, y: 140 }, opts);
    expect(room.ok).toBe(true);
    if (!room.ok) return;
    // Vier Ecken, nicht vierhundert Rasterstufen.
    expect(room.pointsMm.length).toBeLessThanOrEqual(6);
    expect(room.pointsMm.length).toBeGreaterThanOrEqual(4);
  });

  it("schließt die Haarrisse, an denen ein exaktes Verfahren scheitert", () => {
    // Eine Lücke von 2 Papier-mm (10 cm real) in der Nordwand — der klassische Fall, wo
    // zwei Wandzüge nicht ganz aneinanderstoßen.
    const leaky = [
      wall([[100, 100], [158, 100]]),
      wall([[162, 100], [220, 100]]),
      wall([[220, 100], [220, 180]]),
      wall([[220, 180], [100, 180]]),
      wall([[100, 180], [100, 100]]),
    ];
    expect(suggestRoomPolygon(leaky, { x: 160, y: 140 }, opts).ok).toBe(true);
  });

  it("sagt es, wenn der Raum wirklich offen ist", () => {
    // Eine ganze Wand fehlt — das ist keine Lücke mehr, das ist kein Raum.
    const open = [
      wall([[100, 100], [220, 100]]),
      wall([[220, 100], [220, 180]]),
      wall([[100, 180], [100, 100]]),
    ];
    const res = suggestRoomPolygon(open, { x: 160, y: 140 }, opts);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("leaked");
  });

  it("meldet einen Klick auf die Wand statt daneben zu raten", () => {
    const res = suggestRoomPolygon(closedRoom(100, 100, 120, 80), { x: 160, y: 100 }, opts);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("on-wall");
  });

  it("meldet einen Klick außerhalb der Zeichenfläche", () => {
    const res = suggestRoomPolygon(closedRoom(100, 100, 120, 80), { x: -50, y: 140 }, opts);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("outside");
  });

  it("trennt zwei Räume an ihrer gemeinsamen Wand", () => {
    const two = [
      ...closedRoom(100, 100, 120, 80),
      wall([[160, 100], [160, 180]]), // Trennwand in der Mitte
    ];
    const left = suggestRoomPolygon(two, { x: 130, y: 140 }, opts);
    const right = suggestRoomPolygon(two, { x: 190, y: 140 }, opts);
    expect(left.ok && right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    // Jeder ist etwa halb so groß wie der ungeteilte Raum, und sie überlappen nicht.
    expect(left.areaMm2).toBeLessThan(5500);
    expect(right.areaMm2).toBeLessThan(5500);
    expect(pointInPolygon({ x: 190, y: 140 }, left.pointsMm)).toBe(false);
    expect(pointInPolygon({ x: 130, y: 140 }, right.pointsMm)).toBe(false);
  });

  it("findet auch einen L-förmigen Raum", () => {
    const lShape = [
      wall([[100, 100], [220, 100]]),
      wall([[220, 100], [220, 140]]),
      wall([[220, 140], [160, 140]]),
      wall([[160, 140], [160, 180]]),
      wall([[160, 180], [100, 180]]),
      wall([[100, 180], [100, 100]]),
    ];
    const res = suggestRoomPolygon(lShape, { x: 120, y: 160 }, opts);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Die einspringende Ecke muss erhalten bleiben: mehr als vier Punkte.
    expect(res.pointsMm.length).toBeGreaterThanOrEqual(6);
    expect(pointInPolygon({ x: 200, y: 120 }, res.pointsMm)).toBe(true);  // im oberen Schenkel
    expect(pointInPolygon({ x: 200, y: 170 }, res.pointsMm)).toBe(false); // im fehlenden Eck
  });

  it("das gefundene Polygon enthält den Saatpunkt", () => {
    const res = suggestRoomPolygon(closedRoom(100, 100, 120, 80), { x: 160, y: 140 }, opts);
    expect(res.ok).toBe(true);
    if (res.ok) expect(pointInPolygon({ x: 160, y: 140 }, res.pointsMm)).toBe(true);
  });
});
