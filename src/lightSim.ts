/**
 * Lichtsimulation, Stufe 1: von der Leuchte auf dem Plan zur Beleuchtungsstärke auf der
 * Nutzebene.
 *
 * Das Modell ist die Punkt-zu-Punkt-Rechnung, die jede Lichtplanung als Grundlage hat:
 *
 *     E = Σ  I(γ) · cos θ / r²
 *
 * `I(γ)` ist die Lichtstärke der Leuchte unter dem Winkel γ zu ihrer Achse. Ohne
 * gemessene Photometrie wird sie aus zwei Zahlen genähert, die jedes Datenblatt nennt —
 * Lichtstrom und Abstrahlwinkel:
 *
 *     I(γ) = I₀ · cosⁿγ        n  = ln(0,5) / ln(cos(Abstrahlwinkel/2))
 *                              I₀ = Φ · (n+1) / 2π
 *
 * Der Abstrahlwinkel ist dabei der volle Winkel bei 50 % Lichtstärke, so wie ihn die
 * Hersteller angeben. Die Näherung trifft rotationssymmetrische Leuchten — Spots,
 * Downlights, die meisten Magnetschienenköpfe — auf etwa ±20–30 %. Das reicht für die
 * Frage „wie viele Spots", und es ist das, was ohne eine einzige Herstelleranfrage zu
 * haben ist. Gemessene Kurven (Phase C) und Radiance (Phase E) ersetzen später die Zahl,
 * nicht die Darstellung.
 *
 * Die Interreflexion kommt dazu, sobald ein Raum bekannt ist — als mittlerer indirekter
 * Anteil über das Verfahren der Ulbrichtschen Kugel (siehe `indirectLux`). Ohne Raum
 * bleibt es beim Direktanteil, und das Ergebnis liest sich dann eher zu dunkel als zu
 * hell.
 *
 * Was Stufe 1 bewusst NICHT rechnet:
 *  - Die Verteilung des indirekten Anteils. Er wird als über den Raum gleich verteilt
 *    angesetzt. Das ist die übliche Näherung und dem wahren Verlauf viel näher als beim
 *    Direktlicht, weil gestreutes Licht von allen Flächen kommt.
 *  - Verschattung durch Wände. Innerhalb eines Raums fast immer richtig, und über
 *    Raumgrenzen hinweg wird ohnehin nicht geplant.
 *  - Geneigte Leuchten. Phase A rechnet senkrecht nach unten — der Fall, den Spots und
 *    Downlights in 95 % der Grundrisse abdecken.
 *
 * Und der Satz, der in jede Ausgabe gehört: das hier ist eine Planungshilfe, kein
 * Nachweis nach DIN EN 12464-1.
 *
 * Aufbau und Einheiten folgen `wifiCoverage.ts`: Positionen in Papier-mm, Entfernungen
 * über den Maßstab der Seite in die Wirklichkeit gerechnet, Höhen dagegen immer in realen
 * Millimetern — eine Montagehöhe hat keinen Maßstabsbezug.
 */

import { DEFAULT_REFLECTANCE, LUX_STEPS, type FloorplanRoom, type LuminairePhotometry, type RoomReflectance } from "./types";
import { paperMmToRealMm, type Vec2 } from "./floorplan";
import { pointInPolygon, polygonAreaMm2, polygonPerimeterMm } from "./floorplanRooms";

/** Untergrenze für den Abstrahlwinkel. Darunter wird der cos-Exponent absurd groß und die
 *  Näherung beschreibt einen Laser statt einer Leuchte. */
const MIN_BEAM_ANGLE_DEG = 2;
/** Obergrenze: 180° ist die volle Halbkugel, mehr kann eine nach unten gerichtete Leuchte
 *  nicht ausleuchten. */
const MAX_BEAM_ANGLE_DEG = 180;

/**
 * Der cos-Exponent zu einem Abstrahlwinkel.
 *
 * Definiert über den Halbwertswinkel: bei γ = Abstrahlwinkel/2 ist die Lichtstärke auf die
 * Hälfte gefallen, also cosⁿ(γ) = 0,5. Ein 36°-Spot ergibt n ≈ 13,8, ein 120°-Downlight
 * n ≈ 1,0 (also fast den Lambert-Strahler).
 */
export function cosExponent(beamAngleDeg: number): number {
  const beam = Math.min(MAX_BEAM_ANGLE_DEG, Math.max(MIN_BEAM_ANGLE_DEG, beamAngleDeg));
  // Die volle Halbkugel ist der Grenzfall n = 0 (gleichmäßig in alle Richtungen). Er wird
  // am Winkel abgefangen und nicht am Kosinus: Math.cos(Math.PI/2) ist nicht null, sondern
  // 6·10⁻¹⁷, und der Logarithmus davon ergäbe ein knapp positives n statt der Grenze.
  if (beam >= MAX_BEAM_ANGLE_DEG) return 0;
  const halfRad = (beam / 2) * (Math.PI / 180);
  const c = Math.cos(halfRad);
  if (c <= 0) return 0;
  if (c >= 1) return Number.POSITIVE_INFINITY;
  return Math.log(0.5) / Math.log(c);
}

/**
 * Lichtstärke in der Achse, in Candela.
 *
 * Aus der Forderung, dass die Verteilung über die Halbkugel den Lichtstrom ergibt:
 * Φ = ∫ I dΩ = 2π·I₀/(n+1).
 */
export function peakIntensityCd(fluxLm: number, n: number): number {
  if (!Number.isFinite(n)) return 0;
  return (Math.max(0, fluxLm) * (n + 1)) / (2 * Math.PI);
}

/** Der wirksame Lichtstrom einer Leuchte: Datenblattwert mal Dimmung. */
export function effectiveFluxLm(photometry: LuminairePhotometry, dimming = 1): number {
  const d = Math.min(1, Math.max(0, dimming));
  return Math.max(0, photometry.fluxLm) * d;
}

/** Lichtstärke unter dem Winkel γ zur Leuchtenachse, in Candela. Hinter der Halbkugel
 *  (γ ≥ 90°) strahlt eine nach unten gerichtete Leuchte nichts mehr ab. */
export function intensityCd(photometry: LuminairePhotometry, gammaRad: number, dimming = 1): number {
  const cosGamma = Math.cos(gammaRad);
  if (cosGamma <= 0) return 0;
  const n = cosExponent(photometry.beamAngleDeg);
  if (!Number.isFinite(n)) return 0;
  return peakIntensityCd(effectiveFluxLm(photometry, dimming), n) * Math.pow(cosGamma, n);
}

/** Eine platzierte Leuchte, so wie die Rechnung sie braucht. */
export interface LuminairePlacement {
  /** Position auf dem Blatt, in Papier-mm. */
  positionMm: Vec2;
  /** Montagehöhe über OKFF, in realen mm. */
  mountHeightMm: number;
  photometry: LuminairePhotometry;
  /** 0–1. */
  dimming: number;
  /** Für die Rückmeldung, welches Symbol gemeint ist. */
  id?: string;
}

export interface LightCalcOptions {
  /** Maßstabsnenner der Seite — 50 heißt 1:50. */
  scaleDenominator: number;
  /** Höhe der Nutzebene über OKFF, in realen mm. */
  workPlaneMm: number;
  /** Wartungsfaktor: Alterung, Verschmutzung, Spannungsabfall. 0,8 ist der übliche Ansatz
   *  für ein normal gewartetes Innenraum-Projekt. */
  maintenanceFactor: number;
}

/**
 * Beleuchtungsstärke in Lux, die eine Leuchte an einem Punkt der Nutzebene erzeugt.
 *
 * Für eine senkrecht nach unten gerichtete Leuchte fallen Ausstrahlungswinkel und
 * Einfallswinkel zusammen (cos γ = cos θ = h/r), und die Rechnung verkürzt sich auf
 *
 *     E = I₀ · h^(n+1) / r^(n+3)
 *
 * Direkt unter der Leuchte (r = h) ist das erwartungsgemäß I₀/h².
 */
export function illuminanceAtLux(
  lum: LuminairePlacement,
  at: Vec2,
  opts: LightCalcOptions,
): number {
  // Höhe der Leuchte ÜBER DER NUTZEBENE — nicht über dem Boden. Eine Leuchte auf oder
  // unter der Nutzebene beleuchtet sie nicht mehr sinnvoll; 1 mm verhindert die Division
  // durch null, ohne einen unsinnigen Wert vorzutäuschen.
  const hMm = lum.mountHeightMm - opts.workPlaneMm;
  if (hMm <= 0) return 0;
  const h = hMm / 1000;

  const paperDist = Math.hypot(at.x - lum.positionMm.x, at.y - lum.positionMm.y);
  const s = paperMmToRealMm(paperDist, opts.scaleDenominator) / 1000;
  const r = Math.hypot(h, s);
  if (r <= 0) return 0;

  const n = cosExponent(lum.photometry.beamAngleDeg);
  if (!Number.isFinite(n)) return 0;
  const i0 = peakIntensityCd(effectiveFluxLm(lum.photometry, lum.dimming), n);
  return (i0 * Math.pow(h, n + 1)) / Math.pow(r, n + 3);
}

/** Was alle Leuchten zusammen an einem Punkt erzeugen. Licht addiert sich — anders als
 *  beim WLAN, wo nur der stärkste Sender zählt. */
export function totalIlluminanceLux(
  lums: readonly LuminairePlacement[],
  at: Vec2,
  opts: LightCalcOptions,
): number {
  let sum = 0;
  for (const lum of lums) sum += illuminanceAtLux(lum, at, opts);
  return sum * Math.min(1, Math.max(0, opts.maintenanceFactor));
}

/**
 * Die Leuchten auf einem Plan, fertig für die Rechnung.
 *
 * Ein Symbol zählt als Leuchte, sobald das Gerät dahinter auf ein Modell mit Photometrie
 * zeigt. Symbole auf einer ausgeschalteten Ebene bleiben draußen — eine ausgeblendete
 * Ebene ist nicht Teil des Bildes, und ihre Leuchten sind nicht Teil der Rechnung.
 */
export function collectLuminaires(
  page: {
    symbols: readonly {
      id: string;
      groupId: string;
      positionMm: Vec2;
      deviceNodeId?: string;
      mountHeightMm?: number;
      dimming?: number;
    }[];
    groups: readonly { id: string; hidden?: boolean }[];
  },
  defaultMountHeightMm: number,
  resolvePhotometry: (deviceNodeId: string) => LuminairePhotometry | undefined,
): LuminairePlacement[] {
  const out: LuminairePlacement[] = [];
  for (const symbol of page.symbols) {
    if (!symbol.deviceNodeId) continue;
    const group = page.groups.find((g) => g.id === symbol.groupId);
    if (group?.hidden) continue;
    const photometry = resolvePhotometry(symbol.deviceNodeId);
    if (!photometry) continue;
    out.push({
      id: symbol.id,
      positionMm: { ...symbol.positionMm },
      mountHeightMm: symbol.mountHeightMm ?? defaultMountHeightMm,
      photometry,
      dimming: symbol.dimming ?? 1,
    });
  }
  return out;
}

/** Ein gerechnetes Lux-Raster: `lux[y * cols + x]`, Ursprung und Schrittweite in Papier-mm. */
export interface LuxGrid {
  cols: number;
  rows: number;
  /** Papier-mm zwischen zwei Stützstellen. */
  pitchMm: number;
  originMm: Vec2;
  lux: Float32Array;
}

/**
 * Das Raster über einem Ausschnitt des Blattes.
 *
 * Der Aufwand ist cols × rows × Leuchten. Die Schrittweite entscheidet, ob das sofort
 * oder träge ist, und gehört deshalb dem Aufrufer — genauso wie beim WLAN-Raster.
 *
 * Sind Räume bekannt, kommt innerhalb jedes Raums sein indirekter Anteil hinzu. Der wird
 * je Raum einmal gerechnet und dann nur noch zugeordnet — das Bild zeigt damit dieselbe
 * Zahl, die `roomStats` berichtet, statt ihr zu widersprechen.
 */
export function computeLuxGrid(
  lums: readonly LuminairePlacement[],
  area: { x: number; y: number; w: number; h: number },
  opts: LightCalcOptions & { pitchMm: number; rooms?: readonly FloorplanRoom[] },
): LuxGrid {
  const pitch = Math.max(0.5, opts.pitchMm);
  const cols = Math.max(1, Math.ceil(area.w / pitch) + 1);
  const rows = Math.max(1, Math.ceil(area.h / pitch) + 1);
  const lux = new Float32Array(cols * rows);
  const origin = { x: area.x, y: area.y };

  const mf = Math.min(1, Math.max(0, opts.maintenanceFactor));
  const rooms = (opts.rooms ?? [])
    .filter((room) => !room.hidden && room.pointsMm.length >= 3)
    .map((room) => ({ room, indirect: indirectLux(fluxInRoomLm(lums, room), room, opts.scaleDenominator) * mf }));

  if (lums.length === 0) return { cols, rows, pitchMm: pitch, originMm: origin, lux };

  for (let r = 0; r < rows; r++) {
    const y = origin.y + r * pitch;
    for (let c = 0; c < cols; c++) {
      const at = { x: origin.x + c * pitch, y };
      let v = totalIlluminanceLux(lums, at, opts);
      for (const entry of rooms) {
        if (entry.indirect > 0 && pointInPolygon(at, entry.room.pointsMm)) { v += entry.indirect; break; }
      }
      lux[r * cols + c] = v;
    }
  }
  return { cols, rows, pitchMm: pitch, originMm: origin, lux };
}

/**
 * Der Ausschnitt, über den die Kennwerte gebildet werden.
 *
 * Richtig wäre das Raumpolygon — das gibt es in Phase A noch nicht. Bis dahin ist es das
 * umschließende Rechteck der Leuchten plus einem halben Leuchtenabstand ringsum. Das ist
 * genau die Fläche, die eine Anordnung versorgt, und es ist dieselbe Regel, nach der eine
 * Lichtplanung von Hand aufgebaut wird: voller Abstand zwischen den Leuchten, halber
 * Abstand zur Wand.
 *
 * Die naheliegende Alternative — um eine Montagehöhe aufweiten — ist für enge Spots
 * unbrauchbar: ein 36°-Spot auf 2 m über der Nutzebene leuchtet nur gut 0,7 m zur Seite,
 * die Ecken eines so aufgeweiteten Rechtecks blieben dunkel, und U₀ wäre immer null. Bei
 * einer einzelnen Leuchte gibt es keinen Nachbarn, an dem sich der Abstand ablesen ließe;
 * dort ist die Montagehöhe der beste verfügbare Maßstab.
 *
 * Eine Hilfskonstruktion bleibt es so oder so. Mit `FloorplanRoom` (Phase B) tritt der
 * Raum an diese Stelle.
 */
export function luminaireBoundsMm(
  lums: readonly LuminairePlacement[],
  opts: LightCalcOptions,
): { x: number; y: number; w: number; h: number } | null {
  if (lums.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let maxHeightMm = 0;
  for (const lum of lums) {
    minX = Math.min(minX, lum.positionMm.x);
    maxX = Math.max(maxX, lum.positionMm.x);
    minY = Math.min(minY, lum.positionMm.y);
    maxY = Math.max(maxY, lum.positionMm.y);
    maxHeightMm = Math.max(maxHeightMm, lum.mountHeightMm - opts.workPlaneMm);
  }

  let padPaperMm: number;
  if (lums.length === 1) {
    // Kein Nachbar, kein Abstand: die Höhe über der Nutzebene als Ersatzmaßstab. Sie ist
    // eine reale Länge und muss deshalb in Papier-mm umgerechnet werden.
    padPaperMm = opts.scaleDenominator > 0 ? Math.max(0, maxHeightMm) / opts.scaleDenominator : 0;
  } else {
    // Der mittlere Abstand zum nächsten Nachbarn, halbiert — schon in Papier-mm, weil die
    // Positionen es sind.
    let sum = 0;
    for (const a of lums) {
      let nearest = Infinity;
      for (const b of lums) {
        if (a === b) continue;
        nearest = Math.min(nearest, Math.hypot(a.positionMm.x - b.positionMm.x, a.positionMm.y - b.positionMm.y));
      }
      sum += Number.isFinite(nearest) ? nearest : 0;
    }
    padPaperMm = sum / lums.length / 2;
  }

  return {
    x: minX - padPaperMm,
    y: minY - padPaperMm,
    w: maxX - minX + 2 * padPaperMm,
    h: maxY - minY + 2 * padPaperMm,
  };
}

/** Die Kennwerte, mit denen über eine Lichtplanung geredet wird. */
export interface LuxStats {
  /** Mittlere Beleuchtungsstärke E_m in Lux. */
  avgLux: number;
  minLux: number;
  maxLux: number;
  /** Gleichmäßigkeit U₀ = E_min / E_m. */
  uniformity: number;
  /** Zahl der Stützstellen, über die gemittelt wurde. */
  samples: number;
}

export function gridStats(grid: LuxGrid): LuxStats {
  if (grid.lux.length === 0) return { avgLux: 0, minLux: 0, maxLux: 0, uniformity: 0, samples: 0 };
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < grid.lux.length; i++) {
    const v = grid.lux[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const avg = sum / grid.lux.length;
  return {
    avgLux: avg,
    minLux: min,
    maxLux: max,
    uniformity: avg > 0 ? min / avg : 0,
    samples: grid.lux.length,
  };
}

/** Die Farbe, in der ein Wert gezeichnet wird. */
export function luxColor(lux: number): string {
  for (const step of LUX_STEPS) {
    if (lux >= step.minLux) return step.color;
  }
  return LUX_STEPS[LUX_STEPS.length - 1].color;
}

/**
 * Was die Leuchten zusammen aufnehmen, in Watt — die Zahl, nach der als Nächstes gefragt
 * wird, sobald die Lux stimmen. Leuchten ohne Leistungsangabe zählen mit null.
 */
export function connectedLoadW(lums: readonly LuminairePlacement[]): number {
  let sum = 0;
  for (const lum of lums) sum += (lum.photometry.powerW ?? 0) * Math.min(1, Math.max(0, lum.dimming));
  return sum;
}

// ── Räume: Bezugsfläche und indirekter Anteil ────────────────────────

/** Die Reflexionsgrade eines Raums, mit den üblichen Ansätzen als Rückfall. */
export function roomReflectance(room: Pick<FloorplanRoom, "reflectance">): RoomReflectance {
  return room.reflectance ?? DEFAULT_REFLECTANCE;
}

/** Die Flächen eines Raums in Quadratmetern: Boden, Decke und die umlaufenden Wände. */
export function roomSurfacesM2(
  room: Pick<FloorplanRoom, "pointsMm" | "heightMm">,
  scaleDenominator: number,
): { floor: number; ceiling: number; walls: number; total: number } {
  // Papier-mm² → reale m²: zweimal den Maßstab, dann durch eine Million.
  const floor = (polygonAreaMm2(room.pointsMm) * scaleDenominator * scaleDenominator) / 1e6;
  const perimeterM = paperMmToRealMm(polygonPerimeterMm(room.pointsMm), scaleDenominator) / 1000;
  const walls = perimeterM * (room.heightMm / 1000);
  return { floor, ceiling: floor, walls, total: floor + floor + walls };
}

/** Der flächengewichtete mittlere Reflexionsgrad des Raums — die eine Zahl, an der der
 *  indirekte Anteil hängt. */
export function meanReflectance(
  room: Pick<FloorplanRoom, "pointsMm" | "heightMm" | "reflectance">,
  scaleDenominator: number,
): number {
  const a = roomSurfacesM2(room, scaleDenominator);
  if (a.total <= 0) return 0;
  const r = roomReflectance(room);
  return (r.ceiling * a.ceiling + r.walls * a.walls + r.floor * a.floor) / a.total;
}

/**
 * Der mittlere indirekte Anteil in Lux.
 *
 * Verfahren der Ulbrichtschen Kugel: der gesamte Lichtstrom trifft die Raumflächen, ein
 * Anteil ρ̄ wird zurückgeworfen, verteilt sich erneut, wird wieder zurückgeworfen. Die
 * geometrische Reihe über alle Umläufe ergibt
 *
 *     E_indirekt = Φ · ρ̄ / (A_gesamt · (1 − ρ̄))
 *
 * Für einen 6 × 4 × 3 m großen Raum mit den üblichen Ansätzen (Decke 0,7 / Wände 0,5 /
 * Boden 0,2) ist ρ̄ ≈ 0,48, und 8 Spots mit zusammen 7200 lm steuern rund 61 lx bei — also
 * etwa ein Fünftel dessen, was direkt ankommt. Das ist die Größenordnung, die eine
 * Handrechnung auch liefert, und es ist der Grund, warum eine reine Direktrechnung einen
 * Raum systematisch zu dunkel zeigt.
 *
 * Der Anteil wird über den Raum gleich verteilt angesetzt. Das ist eine Näherung, aber
 * eine viel gutartigere als beim Direktlicht: gestreutes Licht kommt aus allen
 * Richtungen, während ein Spot eine scharf begrenzte Insel macht.
 */
export function indirectLux(
  totalFluxLm: number,
  room: Pick<FloorplanRoom, "pointsMm" | "heightMm" | "reflectance">,
  scaleDenominator: number,
): number {
  const a = roomSurfacesM2(room, scaleDenominator);
  if (a.total <= 0 || totalFluxLm <= 0) return 0;
  // Ein Raum, der alles zurückwirft, hätte unendlich viel Licht. Bei realen Oberflächen
  // kommt das nicht vor; die Schranke fängt getippte Unsinnswerte ab.
  const rho = Math.min(0.95, Math.max(0, meanReflectance(room, scaleDenominator)));
  return (totalFluxLm * rho) / (a.total * (1 - rho));
}

/** Der Lichtstrom, den die Leuchten innerhalb des Raums zusammen abgeben. */
export function fluxInRoomLm(
  lums: readonly LuminairePlacement[],
  room: Pick<FloorplanRoom, "pointsMm">,
): number {
  let sum = 0;
  for (const lum of lums) {
    if (pointInPolygon(lum.positionMm, room.pointsMm)) sum += effectiveFluxLm(lum.photometry, lum.dimming);
  }
  return sum;
}

/**
 * Die Kennwerte eines Raums — der Bezug, der in Phase A noch eine Hilfskonstruktion war.
 *
 * Gemittelt wird über die Stützstellen INNERHALB des Polygons. Alles außerhalb gehört zu
 * einem anderen Raum oder zu keinem, und beides hat in E_m und U₀ nichts verloren.
 */
export function roomStats(
  lums: readonly LuminairePlacement[],
  room: FloorplanRoom,
  opts: Omit<LightCalcOptions, "workPlaneMm"> & { workPlaneMm: number; pitchMm: number },
): LuxStats & { indirectLux: number; fluxLm: number; floorAreaM2: number; meanReflectance: number } {
  const pts = room.pointsMm;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const flux = fluxInRoomLm(lums, room);
  const indirect = indirectLux(flux, room, opts.scaleDenominator) * Math.min(1, Math.max(0, opts.maintenanceFactor));
  const surfaces = roomSurfacesM2(room, opts.scaleDenominator);

  const pitch = Math.max(0.5, opts.pitchMm);
  let sum = 0, min = Infinity, max = -Infinity, samples = 0;
  for (let y = minY; y <= maxY; y += pitch) {
    for (let x = minX; x <= maxX; x += pitch) {
      if (!pointInPolygon({ x, y }, pts)) continue;
      const v = totalIlluminanceLux(lums, { x, y }, opts) + indirect;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
      samples++;
    }
  }
  if (samples === 0) {
    return { avgLux: 0, minLux: 0, maxLux: 0, uniformity: 0, samples: 0, indirectLux: indirect, fluxLm: flux, floorAreaM2: surfaces.floor, meanReflectance: meanReflectance(room, opts.scaleDenominator) };
  }
  const avg = sum / samples;
  return {
    avgLux: avg,
    minLux: min,
    maxLux: max,
    uniformity: avg > 0 ? min / avg : 0,
    samples,
    indirectLux: indirect,
    fluxLm: flux,
    floorAreaM2: surfaces.floor,
    meanReflectance: meanReflectance(room, opts.scaleDenominator),
  };
}
