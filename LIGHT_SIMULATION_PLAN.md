# FACE Schematic — Modul Lichtsimulation

Status: **Planung, Zuschnitt entschieden** · Stand: 2026-09-13 · Owner: JLD

Ersetzt den Entwurf vom 13.09.2026 („face-light" als eigenes Repo mit zwei Python-Services).
Was sich geändert hat und warum, steht in §10.

---

## 1. Ziel

Aus einem Grundriss in wenigen Minuten ein belastbares Gefühl für Raum, Leuchtenanzahl und
Helligkeitsverteilung bekommen — als Grundlage für Lichtplanung, Angebot und Stückliste.
Und den Raum so zeigen können, dass der Kunde ihn versteht.

Das Modul soll:

- den vorhandenen Grundriss-Import weiternutzen und daraus Räume (Polygon + Höhe) machen
- Leuchten platzieren, auf der Fläche und entlang von Schienen
- Beleuchtungsstärke als Lux-Raster und Falschfarben-Overlay rechnen
- den Raum in 3D zeigen — Realansicht und Falschfarbe in derselben Szene
- eine Stückliste ausgeben, die über den bestehenden Weg ins Angebot geht

### Nicht-Ziele (bewusst)

- Kein Normnachweis nach DIN EN 12464-1, keine UGR, keine Notbeleuchtung
- Kein Tageslicht in Phase A–D
- Keine automatische Raumerkennung „auf Knopfdruck" — der Nutzer bestätigt Räume
- Kein Ersatz für DIALux bei Ausschreibungen

> **Das gehört in den PDF-Export, nicht nur hierher.** Ein Falschfarbenbild im FACE-Layout mit
> E<sub>m</sub> und U<sub>0</sub> *sieht aus* wie ein Nachweis. Der Unterschied zwischen
> Planungshilfe und Nachweis muss in der Fußzeile des Exports stehen.

---

## 2. Ausgangslage: was FACE Schematic schon kann

Der ursprüngliche Entwurf wollte Dinge bauen, die bereits im Repo stehen. Das ist der Grund
für den neuen Zuschnitt.

| Baustein | Stand | Ort |
|---|---|---|
| PDF-Import, Vektorgeometrie, Layer-Auswahl | fertig | `src/pdfWalls.ts` |
| Wände als Mittellinie **inkl. Dicke** (120/140/240/440 mm) | fertig, an echtem A1-Plan 1:50 validiert | `src/pdfWalls.ts`, `FloorplanWall` |
| Raster rechnen → Falschfarbe auf Canvas | fertig (Wi-Fi) | `src/wifiCoverage.ts`, `src/components/FloorplanHeatmapLayer.tsx` |
| Blatt, Maßstab, Plankopf, Legende, Revisionsindex | fertig | `FloorplanPage` (`src/types.ts`) |
| Symbol + gerichtete Wirkung aus Datenblattwerten | fertig (Kamera-DORI) | `FloorplanCoverage`, `CoverageOptics` |
| Plantyp-Muster (`generic` / `loudspeaker` / `wifi`) | fertig | `FloorplanKind` |
| Linienobjekt mit verteilten Symbolen | fertig (Lautsprecherlinien) | `FloorplanLine`, `src/speakerLines.ts` |
| Stückliste, PDF-Export im FACE-Layout | fertig | `src/packList.ts`, `src/floorplanPdf.ts` |
| DALI / DMX / KNX als Signaltypen, `daliAddress` je Gerät | fertig | `src/types.ts` |
| Nachladen schwerer Module per `await import(...)` | etabliertes Muster | `src/components/MenuBar.tsx` |
| Binärdaten je Projekt (IndexedDB, Datei-Save) | etabliert | `src/underlaySource.ts` |

**Konsequenz:** Der Import-Service aus dem alten Entwurf entfällt ersatzlos. PyMuPDF kann
nichts, was pdf.js hier nicht schon kann — und die teuerste Erkenntnis des Imports („Layer
schlägt Stiftbreite; der dicke Stift war die Bartheke") steckt bereits in `pdfWalls.ts`.
Zwei Importwege hießen zwei Wahrheiten über denselben Plan.

---

## 3. Was wirklich neu ist

Drei Dinge — und nur diese drei sind echter Modellzuwachs:

**3.1 Die dritte Dimension.** `FloorplanSymbol` hat keine Höhe, `FloorplanWall` keine, die
Seite keine. Licht braucht Montagehöhe je Leuchte, Raumhöhe und Nutzebene (0,85 m).

**3.2 Der Raum als Objekt.** Neues `FloorplanRoom`: Polygon, Höhe, Reflexionsgrade
(Decke/Wand/Boden). Nicht als zweite Raumerkennung bauen — aus den vorhandenen Wänden plus
einem Klick ins Rauminnere folgt das Polygon.

**3.3 Photometrie.** Lichtstärkeverteilung je Leuchte. Siehe §5 — das ist der Teil, der über
Qualität und Terminplan des ganzen Moduls entscheidet.

### Koordinaten

Der alte Entwurf rechnete in Metern mit Raumpolygonen als Primärobjekt. Schematic zeichnet in
**Papier-Millimetern plus Maßstab** (`positionMm`, `scaleDenominator`). Umgerechnet wird an
der Kante, nicht im Modell — `paperMmToRealMm()` / `realMmToPaperMm()` in `src/floorplan.ts`
gibt es bereits. Höhen (Montagehöhe, Raumhöhe, Nutzebene) sind dagegen **immer reale
Millimeter**, sie haben keinen Maßstabsbezug.

---

## 4. Die Rechnung

Zwei Stufen hinter derselben Darstellung. Die zweite ersetzt die erste, sie ergänzt sie nicht.

### 4.1 Stufe 1 — im Browser, direkt

Punkt-zu-Punkt über die Lichtstärkeverteilung, plus ein pauschaler Anteil für die
Interreflexion (Wirkungsgradverfahren über die Raumkennzahl und die Reflexionsgrade). Für
jeden Rasterpunkt P auf der Nutzebene und jede Leuchte L:

```
γ     = Winkel zwischen Leuchtenachse und dem Strahl L→P
r     = |L − P|
θ     = Winkel zwischen Strahl und der Normalen der Nutzebene
E_dir = Σ  I(γ) · cos θ / r²
E     = E_dir + E_indirekt
```

Das ist dieselbe Mathematik-Schublade wie `wifiCoverage.ts` (Raster über die Zeichenfläche,
Quellen aufsummieren, Canvas malen) und läuft in Millisekunden. Verdeckung durch Wände wird
in Stufe 1 **nicht** gerechnet — pro Raum ist das fast immer richtig, und über Raumgrenzen
hinweg wird ohnehin nicht gerechnet.

### 4.2 Stufe 2 — Radiance im Container

`rtrace` über eine aus demselben Modell erzeugte Szene. Physikalisch korrekt inklusive
Interreflexion und Verschattung. Ersetzt die Werte aus Stufe 1 hinter unveränderter
Darstellung. Details in §8.

**Warum in dieser Reihenfolge:** Nach Stufe 1 hast du ein benutzbares Werkzeug. Wenn Radiance
klemmt, ist das dann ein entgangener Ausbau und kein gescheitertes Projekt.

---

## 5. Photometrie — Leuchten selbst vermessen

Das eigentliche Projektrisiko ist nicht Radiance, sondern die Frage, ob wir für MAG48 und
Surf20 überhaupt LDT-Dateien bekommen. Bei Magnetschienensystemen rücken viele Hersteller
keine Photometrie heraus. Die Antwort darauf: **selbst messen.**

### 5.1 Die drei Stufen

| Stufe | Aufwand | Genauigkeit | Wofür |
|---|---|---|---|
| **P1** Datenblatt: Lichtstrom + Abstrahlwinkel → cos-Modell | 0 | ±20–30 % | Sofort, jede Leuchte |
| **P2** Luxmeter-Scan → eigene LDT | 15 min/Leuchte | ±10–15 % | Unsere Standardsysteme |
| **P3** Hersteller-LDT | Anfrage | Referenz | Wo verfügbar |

Alle drei erzeugen dasselbe Artefakt: eine gültige `.ldt`/`.ies`-Datei. „Selbst gemessen" und
„vom Hersteller" sind downstream nicht unterscheidbar — Radiance liest sie über `ies2rad`,
three.js über den `IESLoader`, Stufe 1 direkt. **Eine Datei, drei Verbraucher, keine
Sonderfälle.**

### 5.2 P1 — aus dem Datenblatt

Rotationssymmetrische Leuchten sind durch `I(γ) = I₀ · cosⁿγ` gut angenähert. Aus dem
Abstrahlwinkel (Herstellerangabe ist der **volle** Winkel bei 50 % Lichtstärke) und dem
Lichtstrom Φ folgt:

```
n  = ln(0,5) / ln(cos(Abstrahlwinkel / 2))
I₀ = Φ · (n + 1) / 2π
```

Beispiel MAG48-Spot, 900 lm, 36°:
`n = ln(0,5)/ln(cos 18°) ≈ 13,8` → `I₀ = 900 · 14,8 / 6,283 ≈ 2 120 cd`.
Bei 2,90 m Montagehöhe auf 0,85 m Nutzebene (h = 2,05 m) direkt unter der Leuchte:
`E = 2 120 / 2,05² ≈ 505 lx`. Plausibel — und ohne eine einzige Herstelleranfrage.

### 5.3 P2 — Messanleitung

**Was du brauchst:** Luxmeter (ab ca. 150 €, Klasse C reicht — siehe 5.4 warum), Stativ,
Maßband, dunkler Raum.

**Aufbau.** Leuchte auf das Stativ, senkrecht nach unten auf den Boden gerichtet, Abstand `d`
von der Leuchte zum Boden messen und notieren. Der Boden ist besser als eine Wand: die
Schwerkraft hält das Luxmeter flach, und flach liegen ist genau die Messgeometrie, die die
Formel unterstellt.

**Ablauf.**

1. Leuchte **30 Minuten einbrennen** lassen. LEDs verlieren beim Aufwärmen 5–15 % Lichtstrom;
   kalt gemessen ist zu optimistisch. Dimmer auf 100 %.
2. Bei ausgeschalteter Leuchte die **Grundhelligkeit** messen und notieren — wird von jedem
   Messwert abgezogen.
3. Maßband vom Fußpunkt der Leuchte radial nach außen auslegen.
4. Beleuchtungsstärke `E` messen: bei `a` = 0, 10, 20, 30 … cm, bis der Wert unter etwa 1 %
   des Mittelwerts fällt. Im Zentrum enger abtasten (5 cm), außen darf es gröber werden.
5. Zwei Radien in unterschiedliche Richtungen messen und vergleichen. Weichen sie deutlich
   ab, ist die Leuchte nicht rotationssymmetrisch → 5.5.

**Auswertung.** Für jeden Messpunkt:

```
γ     = atan(a / d)
I(γ)  = (E − E_grund) · d² / cos³γ        [cd; E in lx, d in m]
```

Das `cos³` hat zwei Ursachen: der längere Lichtweg zum äußeren Punkt (`cos²`, aus dem
Abstandsquadratgesetz) und der schräge Einfall auf den Boden (`cos`, Lambert).

**Normierung — der entscheidende Schritt.** Die gemessene Kurve wird auf den
Datenblatt-Lichtstrom skaliert:

```
Φ_gemessen = 2π · ∫ I(γ) · sin γ dγ        (numerisch über die Messreihe)
Faktor     = Φ_Datenblatt / Φ_gemessen
```

Wir messen also die **Form** der Verteilung und nehmen die **Höhe** aus dem Datenblatt.
Lumenangaben rücken die Hersteller immer heraus, auch wenn sie keine LDT geben — und damit
fällt der systematische Fehler des Messgeräts heraus (§5.4).

### 5.4 Fehlerbudget — was zu beachten ist

- **Absolutkalibrierung.** Billige Luxmeter liegen ±10–20 % daneben, dazu kommt die
  V(λ)-Fehlanpassung bei LED (besonders kaltweiß). Sie sind aber **innerhalb einer Messreihe
  konsistent**. Genau deshalb die Normierung aus 5.3: der Fehler ist gleichsinnig und kürzt
  sich weg.
- **Der Rand wird unsauber.** Bei γ = 60° ist cos³γ = 0,125, ein Lux-Fehler wird also
  verachtfacht. Die Kurve ist im Zentrum belastbar und in den Ausläufern rauschig — für die
  Leuchtenanzahl ist das die richtige Gewichtung, aber man sollte es wissen.
- **Mindestabstand (Fernfeld).** `d` ≥ 5× die größte leuchtende Abmessung. Bei einem
  50-mm-Spot sind das 25 cm, unkritisch. Bei Surf20 über 1 m Länge sind es 5 m — das ist die
  echte Einschränkung dieser Methode.
- **Immer dasselbe Messgerät** für alle Leuchten, damit der systematische Fehler
  gleichsinnig bleibt und Leuchten untereinander vergleichbar sind.
- **Photometrischen Mittelpunkt** markieren, nicht die Gehäusekante messen.

### 5.5 Nicht rotationssymmetrische Leuchten

Surf20 als Linienleuchte, Wallwasher, Asymmetriker: hier reicht eine Kurve nicht. Zwei Scans
statt einem — quer zur Leuchte (C0–C180) und längs (C90–C270). EULUMDAT trägt beide Ebenen,
es ist nur doppelte Arbeit. Bei Linienleuchten zusätzlich in **lm/m** rechnen statt in lm je
Leuchte.

### 5.6 Späteres Upgrade: Kamera statt Punktmessung

Lichtfleck auf einer matten weißen Wand im RAW fotografieren, linearisieren, mit 3–5
Luxmeter-Punkten kalibrieren. Das ergibt in einer Aufnahme die komplette 2D-Verteilung und
löst auch die asymmetrischen Optiken. Armer-Leute-Goniophotometer — funktioniert erstaunlich
gut, ist aber kein Teil der ersten Runde.

---

## 6. Die 3D-Ansicht

Die Realansicht ist ein Verkaufsargument, kein Nice-to-have — sie ist deshalb Phase D und
nicht „später". Der Einwand dagegen war nie 3D an sich, sondern **zwei konkurrierende
Lichtmodelle**. Der löst sich so auf:

**Die Zahlen kommen nie aus three.js.** Das Lux-Raster wird gerechnet (§4) und in der
3D-Szene als Falschfarbe auf die Nutzebene gelegt. three.js liefert die Anmutung, die
Rechnung liefert die Werte, beides umschaltbar in derselben Ansicht. Damit gibt es keinen
Widerspruch, den jemand dem Kunden erklären müsste.

**Dieselbe Photometriedatei treibt beides.** Die gemessene `.ies` geht in den `IESLoader` —
der Spot in der 3D-Szene hat denselben Abstrahlcharakter wie die Rechnung.

**Die Geometrie ist fast geschenkt.** Wände liegen als Mittellinien mit Dicke vor,
Extrusion auf Raumhöhe ist eine `ExtrudeGeometry`. Das gerasterte Underlay ist die
Bodentextur.

**Der bekannte Haken:** three.js-Spotlights kennen keine Interreflexion, Ecken sehen zu
dunkel aus. Gegenmittel: den indirekten Anteil aus der Rechnung (§4.1) als Ambient-Niveau in
die Szene geben. Dann stützt der Eindruck die Physik statt ihr zu widersprechen.

**Bundle.** three.js wird per `await import(...)` nachgeladen — das Muster ist etabliert
(`MenuBar.tsx` lädt die PDF-Exporte so). Die normale Zeichnung zahlt nichts dafür, und der
PWA-Cache nimmt Dateien bis 4 MB (`vite.config.ts`).

**Deckelung, damit es nicht ausufert:** Wände, Boden, Decke, Leuchten, Kamerafahrt,
Tonemapping. Keine Möbel, kein Glas, keine Materialbibliothek. Das ist das Loch, in dem
3D-Projekte verschwinden.

**Für das eine Bild ins Angebot** gibt es später den besseren Weg: Radiance `rpict` rendert
aus derselben Szene ein echtes Bild. three.js ist der begehbare Raum, `rpict` das Bild, das
ins PDF geht.

---

## 7. Datenmodell

Additiv zum bestehenden `FloorplanPage`. Nichts Vorhandenes wird umgebaut.

```ts
/** Ein Raum: das Polygon, seine Höhe und was seine Flächen zurückwerfen. */
export interface FloorplanRoom {
  id: string;
  name: string;
  /** Polygonpunkte in Papier-mm, wie Wände. Aus den Wänden abgeleitet, vom Nutzer bestätigt. */
  pointsMm: { x: number; y: number }[];
  /** Lichte Raumhöhe in realen mm. */
  heightMm: number;
  /** Höhe der Nutzebene in realen mm. 850 ist die Konvention. */
  workPlaneMm: number;
  reflectance: { ceiling: number; walls: number; floor: number };
  hidden?: boolean;
  locked?: boolean;
}

/** Ergänzung auf FloorplanSymbol — die fehlende dritte Dimension. */
mountHeightMm?: number;   // reale mm über OKFF; undefiniert = Deckenhöhe des Raums
aimDeg?: { tilt: number; pan: number };  // Ausrichtung; undefiniert = senkrecht nach unten
dimming?: number;         // 0–1, undefiniert = 1

/** Photometrie am Geräte-Template — keine zweite Artikelwelt. */
photometry?: {
  /** Schlüssel in den Projekt-Binärdaten (IndexedDB, wie underlaySource). */
  sourceKey?: string;
  /** Woher die Daten stammen. */
  origin: "datasheet" | "measured" | "manufacturer";
  fluxLm: number;
  /** Nur für origin "datasheet": voller Abstrahlwinkel in Grad → cos-Modell. */
  beamAngleDeg?: number;
  measuredAt?: string;
  measuredBy?: string;
};
```

**Leuchten sind Geräte, keine Katalogeinträge.** Der alte Entwurf führte `catalog.json` mit
eigener `odoo_product_id` ein. Schematic hat bereits Geräte-Templates, User-Templates,
Presets, `assetId` und den Odoo-Export in Arbeit (`ODOO_INTEGRATION_PLAN.md`). Zwei
Artikelstämme nebeneinander wären Pflegeaufwand ohne Gegenwert. Eine Leuchte ist ein
Device-Template mit dem `photometry`-Feld — dann fällt die Stückliste aus der bestehenden
Pack-List und geht denselben Weg nach Odoo wie alles andere.

**Schienen** sind strukturell das, was `FloorplanLine` und `src/speakerLines.ts` schon tun:
eine Linie, Objekte im Abstand darauf verteilt, Meter und Verbinder fallen aus der Linie.

---

## 8. Der Radiance-Service

Ein Service, nicht zwei.

```
services/light-sim/          # im selben Repo
  Dockerfile                 # Radiance + pyradiance + FastAPI
  app/
    main.py                  # POST /simulate → job_id · GET /jobs/{id} · GET /health
    scene.py                 # Szenen-JSON → .rad
    luminaire.py             # LDT/IES → Lichtquelle (ies2rad)
    simulate.py              # rtrace, Raster, Falschfarbe
    models.py
  tests/testraum_6x4.json
```

| | |
|---|---|
| **Wo er läuft** | `face-docker1` (192.168.100.70), dieselbe VM, dieselbe Compose-/Runner-Kette wie die App (`.github/workflows/deploy.yml`) |
| **Erreichbarkeit** | Nur aus dem Büronetz, über denselben Reverse-Proxy |
| **Konsequenz** | Der öffentliche Cloudflare-Build hat **keine** Stufe-2-Rechnung. Stufe 1 läuft dort weiter, Stufe 2 hängt an einem Feature-Flag. Das ist eine bewusste Entscheidung, keine Lücke. |

**Datenschutz:** Kundenpläne verlassen das Büronetz nicht. `ODOO_INTEGRATION_PLAN.md` §8.1
führt „Cloud-Upload zu fremdem Dienst" als akutes Thema — der Service steht deshalb
ausdrücklich auf eigener Hardware, und der Import bleibt ohnehin im Browser.

**Abnahmekriterium Stufe 2:** Testraum 6 × 4 × 3 m, zwei Leuchten mit echter Photometrie,
Ergebnis ± 15 % gegen dieselbe Rechnung in DIALux, Rechenzeit < 10 s je Raum.

---

## 9. Phasen

| | Inhalt | Dauer | Ergebnis |
|---|---|---|---|
| **A** | Plantyp `light`, Leuchtensymbole mit Montagehöhe, Lux-Raster aus dem cos-Modell (P1) | Tage | Ein Lichtplan mit Falschfarbe, ohne Container, ohne Herstelleranfrage |
| **B** | `FloorplanRoom` aus den vorhandenen Wänden, Höhe, Reflexionsgrade, indirekter Anteil | Tage | Die Rechnung wird raumbezogen und deutlich richtiger |
| **C** | Messplatz einrichten, MAG48-Spot und Surf20 vermessen, LDT-Schreiber (P2) | 1 Woche, davon 2 Tage Messen | Eigene Photometrie im Katalog; die Hersteller-Abhängigkeit ist weg |
| **D** | 3D-Realansicht: extrudierte Räume, IES-Leuchten aus C, Falschfarbe umschaltbar | 1–2 Wochen | Das, was der Kunde zu sehen bekommt |
| **E** | `light-sim`-Container mit Radiance, ersetzt die Werte aus A/B | 1–2 Wochen | Belastbare Zahlen |
| **F** | Schienen als Linienobjekt, Stückliste, Odoo-Übergabe | 1–2 Wochen | Vom Plan ins Angebot |

**Warum C vor D:** Die 3D-Ansicht mit echter Photometrie sieht sofort überzeugend aus, mit
geschätzter nur halb. Und C ist der Schritt, der das größte Projektrisiko auflöst.

**Warum E nicht zuerst:** Nach A/B/C gibt es ein funktionierendes Werkzeug. Radiance ist dann
Ausbau statt Voraussetzung.

### Was gestrichen ist

- **DWG-Import** — bis der erste echte Fall auftaucht. Die Wanderkennung ist an PDF gebaut
  und funktioniert dort. Damit erledigt sich auch die Lizenzfrage libredwg/ODA.
- **Der `light-import`-Service** — §2.
- **Tageslicht** — unverändert später.

---

## 10. Entscheidungen

| Datum | Entscheidung | Grund |
|---|---|---|
| 2026-09-13 | Radiance als Rechenkern, keine Eigenentwicklung | Physik ist gelöst, wir bauen die Anbindung |
| 2026-09-13 | Räume werden vom Nutzer bestätigt, nicht automatisch erkannt | Architektenpläne sind nie sauber genug |
| 2026-09-13 | Kein Normnachweis | Dafür gibt es DIALux; unser Mehrwert ist die Integration |
| 2026-09-13 | **Modul im FACESchematic-Repo, kein eigenes `face-light`** | Der Fork wird laufend mit Upstream gemerged (`merge/upstream-2026-08`). FACE-Code muss in wenigen eigenen Dateien liegen, wie `wifiCoverage.ts` und `pdfWalls.ts` es tun. Ein zweites Frontend müsste zweimal eingebettet, ausgeliefert und gepflegt werden. |
| 2026-09-13 | **Kein Import-Service; PDF-Import bleibt im Browser** | `pdfWalls.ts` kann es bereits, an einem echten Plan validiert. Zwei Importwege = zwei Wahrheiten. |
| 2026-09-13 | **Eigene Rechnung (Stufe 1) vor Radiance (Stufe 2)** | Nach Stufe 1 gibt es ein benutzbares Werkzeug; Radiance wird Ausbau statt Voraussetzung |
| 2026-09-13 | **Leuchten selbst vermessen statt auf Hersteller-LDTs warten** | Das war das größte Projektrisiko. Luxmeter-Scan mit Normierung auf den Datenblatt-Lichtstrom erreicht ±10–15 % — genug für ein Werkzeug, das ausdrücklich kein Nachweis ist. |
| 2026-09-13 | **3D auf Phase D vorgezogen (vorher „später")** | Die Realansicht ist das Verkaufsargument. Der Einwand war nie 3D, sondern zwei konkurrierende Lichtmodelle — das ist über §6 gelöst. |
| 2026-09-13 | **Leuchten sind Geräte-Templates, kein zweiter Artikelstamm** | Ein Stamm, ein Weg nach Odoo |

---

## 11. Offene Punkte

- [ ] Luxmeter beschaffen — Klasse C genügt (§5.4), Auswahl und Budget offen
- [ ] Welche Leuchten zuerst vermessen? Vorschlag: MAG48-Spot (rotationssymmetrisch, einfach),
      dann Surf20 (zwei Ebenen, §5.5)
- [ ] Hersteller-LDTs trotzdem anfragen — kostet nichts und ist die Referenz, gegen die wir
      unsere eigene Messung einmal prüfen können
- [ ] Feature-Flag für Stufe 2: wie verhält sich der öffentliche Build, wenn kein
      `light-sim` erreichbar ist? (Vorschlag: Schalter gar nicht anzeigen)
- [ ] Referenzprojekt für die Abnahme — Mikulla-Plan (Egbers, E1) liegt vor
- [ ] Einen real vermessenen Raum gegen die Rechnung halten: der ehrlichste Test des ganzen
      Moduls, und das Luxmeter ist dann ohnehin da

---

## 12. Nächster Schritt

**Phase A.** Plantyp `light`, ein Leuchtensymbol mit Montagehöhe, Lux-Raster aus dem
cos-Modell auf der vorhandenen Heatmap-Maschinerie. Ergebnis ist ein Grundriss mit
Falschfarbenbild und einem E<sub>m</sub>-Wert — ohne Container, ohne Messung, ohne
Herstelleranfrage.
