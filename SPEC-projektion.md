# Spec: projektion

Stand: 2026-11-23 · Entwurf, noch nicht freigegeben

## Objective

Im Grundriss einen Beamer und seine Bildfläche maßstäblich planen: Modell wählen, Bildgröße
festlegen, den Beamer auf dem Plan schieben und sofort sehen, ob Abstand, Zoom und Lens-Shift
passen. Die Rechnung entspricht dem Epson Throw Distance Simulator
(`files.support.epson.com/pdc`), läuft aber in Schematic selbst, ohne den Umweg über die
Epson-Seite und ohne Abtippen der Ergebnisse.

Fertig ist das Modul, wenn:

- ein Epson-Modell (und bei Wechseloptik ein Objektiv) aus der Epson-Liste gewählt werden kann,
- die Bildfläche als Strecke in echter Breite auf dem Plan liegt und der Projektionskegel
  vom Beamer zu ihren Enden gezeichnet wird,
- beim Schieben des Beamers Abstand, nötiger Zoom und nötiger horizontaler Shift live
  mitlaufen und der Kegel die Farbe wechselt, sobald etwas außerhalb der Grenzen liegt,
- der zulässige Abstandsbereich für die gewählte Bildgröße als Band auf dem Plan sichtbar ist,
- die Werte für den EB-L610U mit dem Epson-Rechner übereinstimmen (Abweichung ≤ 1 cm),
- dasselbe Bild im PDF-Export erscheint.

## Begriffe

- **Projektion** — ein Planobjekt: ein Beamer-Symbol plus seine Bildfläche plus Einstellungen.
- **Bildfläche** — in der Draufsicht eine Strecke (Bildbreite) mit Lage und Richtung.
- **Projektionsabstand** — senkrechter Abstand von der Objektiv-Vorderkante zur Bildebene.
- **Wide / Tele** — die beiden Zoom-Enden; dazwischen liegt der zulässige Abstandsbereich.
- **Shift H / V** — Verschiebung des Bildes gegen die Objektivachse, in % der Bildbreite bzw. -höhe.

## Lösung

### Daten

Der Epson-Rechner lädt seine Daten als offene JSON-Dateien (`static/data/*.json`, Stand der
Dateien: 13.10.2026): 1.157 Modelle, 383 feste Optiken, 100 Wechselobjektive. Je Bildformat
(16:10, 16:9, 4:3 …) stehen dort lineare Koeffizienten:

    Abstand [cm]  = a · Diagonale [Zoll] + b      (je für Wide und Tele)
    Diagonale     = a' · Abstand + b'

dazu Grenzen für Bildgröße und Abstand, Shift-Grenzen H, V und kombiniert, die Lage des
Objektivs am Gehäuse und der Lichtstrom je Objektiv. Geprüft am EB-L610U: 100″ in 16:10
ergibt 2,92–4,74 m, das entspricht dem veröffentlichten Projektionsverhältnis 1,35–2,20.

- `tools/epsonThrowData.mjs` holt die Dateien und schreibt eine verkleinerte
  `public/projection/epson.json` (nur Felder, die gerechnet oder angezeigt werden).
- Die Datei wird **nicht ins Repository eingecheckt** (öffentliches Repo, Epson-Material).
  Sie liegt wie die BHE-Symbole auf face-docker1 und wird beim Deploy hineinkopiert.
- Die App lädt sie erst, wenn eine Projektion angelegt oder geöffnet wird. Fehlt sie, bleibt
  der manuelle Weg.
- **Andere Hersteller / manuell:** Projektionsverhältnis (min–max) und Shift-Grenzen von Hand.
  Abstand = Verhältnis × Bildbreite. Vorlagen können die Werte als `DeviceTemplate.projection`
  mitbringen.

### Rechnung — `src/projection.ts` (reine Funktionen)

- `throwRangeM(optik, format, diagonaleZoll)` → Abstand Wide/Tele, begrenzt auf die Epson-Grenzen
- `zoomForDistance(...)` → 0 (Wide) … 1 (Tele) oder „außerhalb“
- `sizeRangeForDistance(...)` → kleinste/größte Diagonale bei gegebenem Abstand
- `requiredShift(...)` → Shift H aus dem seitlichen Versatz des Objektivs zur Bildmitte,
  Shift V aus Objektivhöhe und Bildunterkante; Prüfung gegen H-, V- und kombinierte Grenze
- `mountHeightRangeM(...)` → zulässige Objektivhöhe für die gewählte Bildunterkante
- `illuminanceLux(...)` → Lichtstrom / Bildfläche
- `projectionOutlineMm(...)` → Kegel, Bildstrecke und Abstandsband als Geometrie, einmal für
  Bildschirm und PDF (Muster: `coverageOutlineMm` in `src/floorplan.ts`)

### Planobjekt

`FloorplanPage.projections: FloorplanProjection[]` (Migration v49 → v50):

    id, symbolId            Beamer-Symbol, dem die Projektion folgt
    source                  { kind: "epson", code, name, lensId? } | { kind: "manual", throwMin, throwMax, shift… }
    aspect, widthM, heightM Bildformat und Bildgröße; lockWidth?, lockHeight? für die Schlösser
    screenGain?             Leinwand-Gain, Standard 1
    screenCenterMm, screenRotationDeg
    screenBottomM?, lensHeightM?    für Shift V und Montagehöhe (nur Zahlen, keine Seitenansicht)
    groupId?, hidden?       Ein-/Ausblenden wie bei Flächen

Der Zoom wird nicht gespeichert, er ergibt sich aus Abstand und Bildgröße.

### Bedienung

Leitlinie: wenige Felder, nichts Überladenes. Sichtbar ist nur, was man zum Planen braucht;
alles Weitere liegt eingeklappt unter „Mehr“.

Ablauf:

1. Beamer aus der Zeichnung in den Plan ziehen. Am Symbol erscheint im Inspektor der Block
   „Projektion“. Ist das Gerät ein Epson-Modell aus der Liste, ist es schon vorgewählt.
2. Angaben machen: Modell (Suche), bei Wechseloptik das Objektiv, Bildformat, Bildgröße.
3. Bildfläche auf dem Plan an ihre Stelle setzen (ein Griff zum Verschieben, einer zum Drehen).
4. Abstand einstellen — per Schieberegler oder durch Ziehen des Beamers.

Der Block „Projektion“ im Inspektor:

    Modell      [ EB-L610U            ▾ ]
    Format      [ 16:10 ▾ ]
    Breite      [ 2,15 m ] 🔒   Höhe [ 1,35 m ] 🔒   Diagonale 100″
    Abstand     2,92 ├────●──────┤ 4,74 m      [ 3,45 m ]
    Zoom 29 %  ·  Shift H 4 %
    Helligkeit  6000 lm ÷ 2,90 m² = 2069 lx
    ▸ Mehr

- **Bildgröße:** Breite, Höhe oder Diagonale eingeben, die anderen rechnen sich aus dem
  Format. Das Schloss fixiert den Wert: ein fixierter Wert bleibt beim Formatwechsel stehen,
  der andere passt sich an. Sind Breite und Höhe fixiert, ist die Bildfläche festgelegt und
  das Format zeigt nur noch an, wie das Bild darin sitzt.
- **Abstand:** Der Schieberegler reicht genau von Wide bis Tele für die gewählte Bildgröße,
  ein unzulässiger Abstand lässt sich damit gar nicht einstellen. Er schiebt den Beamer auf
  der Achse senkrecht zur Bildfläche; die Bildfläche bleibt, wo sie ist.
- **Ziehen auf dem Plan:** Der Beamer lässt sich auch frei schieben. Seitlicher Versatz wird
  zu Shift H. Außerhalb der Grenzen wechselt der Kegel in die Warnfarbe und der Inspektor
  nennt den Grund („0,40 m zu nah“, „Shift H 34 % > 20 %“). Der Beamer bleibt parallel zur
  Bildfläche ausgerichtet (keine Trapezkorrektur).
- **Helligkeit:** Die Rechnung steht ausgeschrieben da: Lichtstrom des Modells bzw. Objektivs
  ÷ Bildfläche = Beleuchtungsstärke in Lux. Sie ändert sich mit der Bildgröße, nicht mit dem
  Abstand.
- **Mehr (eingeklappt):** Bildunterkante und Objektivhöhe → Shift V und zulässige
  Montagehöhe; Leinwand-Gain für die Helligkeit; zulässiger Größenbereich des Modells.
- **Auf dem Plan:** Bildstrecke, Kegel, das Abstandsband als feine Linie und eine Zeile
  Beschriftung (Modell · Diagonale · Abstand). Mehr nicht.
- Ein Zug am Regler oder am Beamer ist ein Undo-Schritt.

## Entscheidungen

Entschieden (Jean-Luc, 23.11.2026):

- Die Bildfläche bleibt an ihrer Stelle, nur der Beamer wird geschoben.
- Einfache Bedienung geht vor Funktionsumfang; die Oberfläche wird nicht überladen.
- Breite und Höhe lassen sich fixieren, der Abstand wird im zulässigen Bereich per Regler gewählt.
- Die Helligkeitsrechnung ist sichtbar.

Offen, mit Vorschlag:

1. **Epson-Daten** auf face-docker1 halten statt im Repo — Vorschlag: ja, wie BHE.
2. **Höhe nur als Zahlen** unter „Mehr“ (Montagehöhe, Shift V) — Vorschlag: ja, keine
   Seitenansicht in V1.
3. **Andere Hersteller** nur über manuelles Projektionsverhältnis und Lichtstrom —
   Vorschlag: ja.

## Testing Strategy

- `src/__tests__/projection.test.ts`: Referenzwerte EB-L610U (80″/100″/150″, 16:10 und 4:3),
  ein Wechselobjektiv (ELPLL06), Grenzen (zu nah, zu weit, Bild zu groß), Shift H/V einzeln
  und kombiniert, manuelles Projektionsverhältnis, Hin- und Rückrechnung Abstand ↔ Diagonale.
  Die Testdaten sind wenige abgeschriebene Koeffizienten, nicht die Epson-Datei.
- `migrations.test.ts`: v49 → v50 ergänzt `projections: []`.
- Abgleich von drei Fällen von Hand gegen den Epson-Rechner vor der Freigabe.
- e2e `e2e/floorplan-projection.spec.ts`: Projektion anlegen, Beamer ziehen, Warnung erscheint.

## Boundaries

- Nicht in V1: Seitenansicht, Trapez/schräge Projektion, gekrümmte Flächen, Edge-Blending,
  Ultrakurzdistanz-Sonderfälle (Wandhalter-Maße), Kamera-Assist, MCP-Werkzeuge für Claude.
- Keine Epson-Daten und keine Epson-Bilder im Repository.
- Die Shift-Semantik (Bezug der Prozentwerte, kombinierte Grenze) wird vor dem Bau am
  Epson-Code und am Rechner gegengeprüft; bis dahin gilt sie als Annahme.
- Vorlagen-IDs, die auch in der Upstream-Datenbank stehen, können `projection` beim Laden
  verlieren; FACE-eigene IDs verwenden oder die Zusammenführung anpassen.
