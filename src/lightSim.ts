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
 * Was Stufe 1 bewusst NICHT rechnet:
 *  - Interreflexion. Ohne Raumpolygon und Reflexionsgrade gibt es keinen indirekten
 *    Anteil; das Ergebnis ist deshalb eher zu dunkel als zu hell. Kommt mit
 *    `FloorplanRoom` in Phase B.
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

import { LUX_STEPS, type LuminairePhotometry } from "./types";
import { paperMmToRealMm, type Vec2 } from "./floorplan";

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
 */
export function computeLuxGrid(
  lums: readonly LuminairePlacement[],
  area: { x: number; y: number; w: number; h: number },
  opts: LightCalcOptions & { pitchMm: number },
): LuxGrid {
  const pitch = Math.max(0.5, opts.pitchMm);
  const cols = Math.max(1, Math.ceil(area.w / pitch) + 1);
  const rows = Math.max(1, Math.ceil(area.h / pitch) + 1);
  const lux = new Float32Array(cols * rows);
  const origin = { x: area.x, y: area.y };
  if (lums.length === 0) return { cols, rows, pitchMm: pitch, originMm: origin, lux };

  for (let r = 0; r < rows; r++) {
    const y = origin.y + r * pitch;
    for (let c = 0; c < cols; c++) {
      lux[r * cols + c] = totalIlluminanceLux(lums, { x: origin.x + c * pitch, y }, opts);
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
