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

`FloorplanPage.projections?: FloorplanProjection[]` (optionales Feld, keine Migration):

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

### Betrachtungsabstand nach AVIXA (Erweiterung, noch nicht freigegeben)

Grundlage: AVIXA DISCAS (ANSI/AVIXA V202.01). Die Norm gibt eine Empfehlung, kein
Gerätelimit — deshalb eigene Hinweisfarbe, nie die rote Warnfarbe des Kegels.

**Zuschauerzone.** Der Planer zieht auf dem Plan ein Rechteck auf: dort sitzen die Zuschauer.
Es gehört zu einer Projektion (eine Zone je Bildfläche) und wird beim Anlegen parallel zur
Bildfläche ausgerichtet. Griffe: verschieben, an den Ecken ziehen, drehen.

    FloorplanProjection.audience?: { centerMm, widthM, depthM, rotationDeg }
    FloorplanProjection.viewing?:  { task: "bdm" | "adm", elementPct?, pixelsV? }

Beide Felder sind optional, alte Dateien brauchen keine Migration.

**Rechnung** — `evaluateViewing(...)` in `src/projection.ts`, reine Funktion:

Formeln und Faktoren wie im AVIXA-Rechner (avixa.org, „Analytical and Basic Decision Making
Calculations“, aus dessen Rechencode abgelesen am 23.11.2026):

- BDM (Präsentation, Besprechung): fernster Platz = Bildhöhe × 200 × Zeichenhöhe [%] ÷ 100.
  Die Norm führt Zeichenhöhen von 0,5 % bis 5 % (Betrachtungsverhältnis 1 bis 10).
- ADM (Detailarbeit): fernster Platz = Bildhöhe × 3438 ÷ vertikale Pixelzahl. Einen nächsten
  Platz rechnet der AVIXA-Rechner für ADM nicht; die seitliche Grenze gilt trotzdem.
- Nächster Platz (BDM): Bildversatz = Bildunterkante − Augenhöhe; senkrechter Sichtfaktor =
  Bildhöhe + Bildversatz (Bildoberkante über Augenhöhe); nächster Platz = 1,732 × Sichtfaktor,
  das ist ein Blick von 30° nach oben zur Bildoberkante. Liegt der Sichtfaktor unter 50 % der
  Bildhöhe, ist der nächste Platz nicht definiert und wird nicht angezeigt.
- Seitliche Grenze: von jeder Bildkante eine Linie 60° zur Senkrechten, zur gegenüberliegenden
  Seite hin. Ein Platz im Abstand d vor der Bildebene und x neben der Bildmitte liegt drin,
  wenn |x| ≤ 1,732 × d − Bildbreite ÷ 2. (Der Rechner nennt die Breite dieser Fläche am
  nächsten Platz „Max. Length of CV Plane“ = 6 × Sichtfaktor − Bildbreite.)
- Der nächste Platz braucht die Bildunterkante (steht schon unter „Mehr“) und eine Augenhöhe
  (neu, Standard 1,20 m sitzend). Fehlt die Bildunterkante, entfällt nur „zu nah“.
- aus dem Rechteck: fernster und nächster Platz, größter seitlicher Winkel (über die vier
  Ecken und den der Bildfläche nächsten Punkt)
- Ergebnis: Grenzen der Norm, Werte der Zone, was nicht passt, und die Bildhöhe, die für den
  fernsten Platz nötig wäre

**Bedienung.** Im Block „Projektion“ kommen zwei Zeilen dazu, mehr nicht:

    Nutzung     [ Präsentation (BDM) ▾ ]          [ Zuschauerzone zeichnen ]
    Betrachtung 2,10 – 9,40 m · empfohlen bis 8,10 m
                Letzte Reihe 1,30 m zu weit — Bildhöhe mind. 1,57 m   [ Übernehmen ]

- „Übernehmen“ setzt die Bildgröße auf den empfohlenen Wert (ein Undo-Schritt); danach
  laufen Abstand, Zoom und Helligkeit wie gewohnt neu.
- Zeichenhöhe (BDM) bzw. Pixelzahl (ADM) liegen unter „Mehr“.
- Ohne Zuschauerzone zeigt die Zeile nur die Empfehlung („empfohlen 1,40 – 8,10 m“).

**Auf dem Plan.** Das Rechteck als Rahmen, darin eine Heatmap der Sichtgüte; dazu die Grenze
des fernsten Platzes als feine Linie. Ein- und ausblendbar zusammen mit der Projektion, im
PDF gleich.

**Heatmap der Sichtgüte.** Nur innerhalb der Zuschauerzone, nicht über den ganzen Plan.

- Je Rasterpunkt ein Wert: Abstand zur Bildfläche im Verhältnis zur empfohlenen Grenze, und
  der seitliche Blickwinkel im Verhältnis zu seiner Grenze. Der schlechtere der beiden zählt.
- Wenige feste Stufen statt eines stufenlosen Verlaufs (gut · Grenzbereich · außerhalb der
  Empfehlung, getrennt nach „zu weit“, „zu nah“, „zu schräg“), mit Farbschlüssel in der
  Legende wie bei der WLAN-Heatmap.
- `viewingGrid(...)` in `src/projection.ts` liefert das Raster im Koordinatensystem des
  Rechtecks; gezeichnet wird es wie `FloorplanHeatmapLayer` als Canvas, im PDF als ein Bild
  (Muster: `heatmapPng` in `src/floorplanPdf.ts`). Das Rechteck darf gedreht sein, das Bild
  wird mitgedreht.
- Wände und Sichthindernisse zählen nicht mit (Draufsicht, keine Höhen).
- Schalter „Heatmap“ unter „Mehr“; aus = nur Rahmen und Grenzlinie.

### Schnitt: ab wo steht jemand im Bild (Erweiterung, noch nicht freigegeben)

Die Draufsicht zeigt nicht, ob ein stehender Mensch in den Lichtkegel ragt. Dafür braucht es
den senkrechten Schnitt durch Objektiv und Bildmitte.

**Erzeugter Schnitt.** Aus den Höhen, die die Projektion schon kennt (Bildunterkante,
Objektivhöhe), plus Raumhöhe und Personenhöhe:

    FloorplanProjection.section?: { roomHeightM?, personHeightM?, show?, positionMm?, widthMm? }

Gezeichnet werden Boden, Decke, Bildfläche, Beamer und die Ober- und Unterkante des
Lichtkegels, dazu eine Person an der Stelle, an der ihr Kopf die Unterkante berührt.

**Rechnung** — `evaluateSection(...)` in `src/projection.ts`, reine Funktion:

- Höhe der Kegel-Unterkante im Abstand x vor der Bildfläche:
  Bildunterkante + (Objektivhöhe − Bildunterkante) · x ÷ Projektionsabstand
- daraus der Bereich vor der Bildfläche, in dem eine Person der gewählten Höhe ins Bild ragt
  (Deckenmontage: nah an der Bildfläche; Tischaufstellung: nah am Beamer)
- Kopffreiheit unter dem Beamer und Abstand der Bildoberkante zur Decke

**Bedienung.** Unter „Mehr“ kommt eine Zeile „Schnitt“ mit Raumhöhe und Personenhöhe
(Standard 1,80 m stehend); darunter der kleine Schnitt und ein Satz:

    Stehend (1,80 m) im Bild bis 1,78 m vor der Bildfläche

**Auf dem Plan.** Der Bereich, in dem jemand im Bild steht, wird im Kegel schraffiert — das
ist die Antwort in der Draufsicht. Der Schnitt selbst lässt sich als Kasten auf das Blatt
legen (verschieben, Breite ziehen, wie die Legende) und geht so ins PDF.

**Angefügter Schnitt.** Statt des erzeugten Schnitts ein Bild oder eine PDF-Seite des
Architekten als Hintergrund des Kastens: zwei Punkte anklicken (Boden an der Bildfläche,
Boden am Beamer) legt Maßstab und Lage fest, Kegel und Person werden darüber gezeichnet.

### Displays (Erweiterung, noch nicht freigegeben)

Dasselbe wie beim Beamer, ohne Beamer: Ein Display ist eine Bildfläche, die an ihrem Symbol
hängt. Betrachtungsabstand, Zuschauerzone, Heatmap und Farbschlüssel gelten unverändert.

**Planobjekt.** Kein neuer Objekttyp, sondern `FloorplanProjection` mit `kind: "display"`:

    kind?: "display"        fehlt = Beamer
    aspect, widthM, heightM Bildformat und Bildgröße, wie gehabt (Standard 16:9)
    screenBottomM?          Bildunterkante, für den nächsten Platz
    viewing?, audience?     wie gehabt; `pixelsV` kommt aus der gewählten Auflösung

Bildmitte und Richtung werden bei einem Display nicht gespeichert-und-gezogen, sondern
folgen dem Symbol: Das Display hängt, wo sein Symbol steht, und zeigt, wohin es gedreht ist.
Optik, Kegel, Abstandsband, Shift, Helligkeit und Schnitt entfallen.

**Symbol in echter Größe.** Hat ein Display-Symbol eine Größe, wird statt des Piktogramms
ein Balken in echter Bildbreite gezeichnet (maßstäblich wie die Bildstrecke des Beamers),
quer zur Blickrichtung, in der Farbe der Symbolgruppe; die Tiefe ist fest (8 cm am Bau,
mindestens ein gut sichtbarer Strich). Die Nummer bleibt daneben. Ohne Größe bleibt das
Piktogramm. Auf dem Bildschirm und im PDF aus derselben Geometrie.

**Bedienung.** Am Display-Symbol erscheint im Inspektor der Knopf „Display planen“, danach
der Block „Display“:

    Diagonale   [ 75 ″ ▾ ]  (28 Größen von 22 bis 163 ″ oder frei)   Format [ 16:9 ▾ ]
    Breite 1,66 m · Höhe 0,93 m
    Auflösung   [ UHD 2160 ▾ ]  (FHD 1080 · UHD 2160 · frei)
    Nutzung     [ Präsentation (BDM) ▾ ]          [ Zuschauerzone ]
    Betrachtung empfohlen 1,10 – 5,60 m
    ▸ Mehr      Unterkante, Zeichenhöhe, Augenhöhe, Heatmap, Breite/Höhe frei (Videowand)

Dieselben Zeilen und Hinweise wie beim Beamer, aus demselben Code. Formate: die des Beamers,
dazu 32:9, 9:16 (hochkant) und 1:1.

**MCP.** `list_floorplans` meldet Displays mit Größe. `set_floorplan_display` setzt Größe,
Unterkante, Auflösung, Nutzung und die Zuschauerzone (als „ab nearM vor dem Display, depthM
tief, widthM breit“) und meldet die Betrachtungsabstände samt dem, was nicht passt;
`remove_floorplan_display` nimmt die Größe wieder weg.

### Auflösung aus dem Gerät (gebaut 24.11.2026)

ADM rechnet mit der vertikalen Pixelzahl. Sie kommt beim Beamer aus dem gewählten Modell:

- `tools/epsonThrowData.mjs` übernimmt Epsons Angabe `resolution` je Modell („WUXGA“,
  „Full HD“, „4K PRO-UHD“) in `epson.json`; `pixelsVOfResolution` macht daraus die
  Pixelzahl (aus „1920 x 1200“ direkt, sonst über eine Namensliste).
- `opticsForModel` legt sie als `optics.pixelsV` zur Projektion. Eine Projektion, die vor
  dieser Änderung angelegt wurde, bekommt den Wert nachgetragen, sobald sie im Inspektor
  offen ist und der Katalog geladen ist.
- Es gilt `viewing.pixelsV ?? optics.pixelsV` (`viewingSettingsOf`): eine von Hand
  eingetragene Zahl geht vor.
- Fehlt die Pixelzahl bei ADM, gibt es keine Heatmap und keinen Farbschlüssel, und der
  Inspektor fragt nach der Auflösung. Vorher war in diesem Fall jeder Platz grün.

Offen: „4K PRO-UHD“ ist als 2160 Zeilen eingetragen, obwohl das Panel dieser Geräte weniger
hat. Beamer anderer Hersteller haben keine Auflösung; dort bleibt das Eingabefeld.

### Kontrast (gebaut 24.11.2026)

DISCAS sagt nichts zur Helligkeit. Dafür gibt es eine Vorab-Schätzung des Kontrasts im
Raumlicht, angelehnt an AVIXAs Kontrastnorm (ISCR/PISCR). Die Norm wird vor Ort gemessen;
das hier ist eine Rechnung für die Planung, kein Nachweis.

    FloorplanProjection.light?: { ambientLux?, nativeContrast?, nits?, reflectancePct? }

**Rechnung** — `src/projectionContrast.ts`, reine Funktionen:

- Kontrast = (Weiß + Raumlicht) ÷ (Weiß ÷ Gerätekontrast + Raumlicht).
- Beamer (`projectedContrast`): Weiß = Beleuchtungsstärke auf der Bildfläche in Lux, wie
  sie die Helligkeitszeile schon rechnet (Lichtstrom × Gain ÷ Bildfläche); Raumlicht in Lux
  auf der Bildfläche.
- Display (`displayContrast`): Weiß = Leuchtdichte in cd/m²; das Raumlicht zählt mit dem
  Anteil, den die Displayfront zurückwirft (Reflexion ÷ π je Lux).
- Mindestwerte je Nutzung: passiv 7:1, Präsentation (BDM) 15:1, Detailarbeit (ADM) 50:1,
  Bewegtbild 80:1. Der Planer benutzt die Werte für BDM und ADM.
- Ergebnis: Kontrast, Mindestwert, ob er reicht, und das höchste Raumlicht, bei dem er
  noch reichen würde.

**Annahmen, nicht verifiziert:**

- Die vier Mindestwerte sind aus dem Gedächtnis, nicht am Normtext geprüft.
- Gerätekontrast 300:1 beim Beamer, 1000:1 beim Display; Reflexion der Displayfront 5 %.
  Alle drei unter „Mehr“ änderbar.
- Richtwerte für das Raumlicht kommen seit dem 25.11.2026 aus Epsons Rechner (siehe
  „Kontrast-Skala“ unten); die eigenen Werte 10/50/150/300 lx sind entfallen.
- Epsons Kontrastangabe wird nicht benutzt: Sie ist der dynamische Kontrast (10.000:1 bis
  über 5.000.000:1), die Norm misst Weiß und Schwarz gleichzeitig. Bei Raumlicht ändert der
  Gerätekontrast das Ergebnis ohnehin kaum (500 lx Bild, 50 lx Raum: 10,6:1 statt 11:1).

**Bedienung.** Im Block „Projektion“ bzw. „Display“ (`ProjectionContrastRows.tsx`):

    Raum        [ Besprechungsraum · 140 lx ▾ ]
    Raumlicht   [ 140 lx ]
    Helligkeit  [ 350 cd/m² ]                         (nur Display)
    Kontrast    12,0:1 · eine Präsentation braucht 15:1
                ▓▓▓▓▒▒▒▒░░░░|░░▒▒▒▒▓▓▓▓      Skala mit Marke, darunter 20 · 15 · 8 · 3
                ■ ausreichend · Besprechungsraum
                Reicht nicht — höchstens 40 lx Raumlicht        (nur wenn zu wenig)
    ▸ Mehr      Gerätekontrast, Reflexion (Display)

Ohne Raumlicht-Angabe erscheint keine Kontrastzeile. Nicht über den Connector.

**Kontrast-Skala nach dem Epson-Rechner (gebaut 25.11.2026).** Epsons Throw Distance
Simulator hat einen „Leitfaden zu Helligkeit & Kontrast“; Raumarten, übliches Raumlicht und
Stufengrenzen sind aus dessen Code abgelesen (25.11.2026):

    Raumart            Raumlicht   sehr gut  empfohlen  ausreichend  Grenze   zu niedrig
    Besprechungsraum   140 lx      ≥ 20      ≥ 15       ≥ 8          ≥ 3      darunter
    Klassenraum        210 lx      ≥ 15      ≥ 10       ≥ 7          ≥ 5      darunter
    Saal               140 lx      ≥ 15      ≥ 7        ≥ 5          ≥ 3      darunter
    Wohnraum            70 lx      ≥ 10      ≥ 5        ≥ 4          ≥ 3      darunter
    Kino                14 lx      ≥ 80      ≥ 50       ≥ 30         ≥ 20     darunter

- `light.application` wählt die Raumart (fehlt = Besprechungsraum). Die Wahl setzt das
  Raumlicht auf Epsons Wert; die Zahl lässt sich danach überschreiben.
- `rateContrast` ordnet den Kontrast einer Stufe zu und legt die Marke wie Epson: fünf
  gleich breite Stufen, innerhalb einer Stufe linear, oben bei 200:1 gekappt.
- Farben grün bis rot wie die Sichtgüte, nicht Epsons Blautöne.
- Abweichung von Epson: Epson rechnet Kontrast = Bildlicht ÷ Raumlicht + 1, ohne
  Gerätekontrast und ohne Gain. Hier bleibt die Rechnung von oben; sie liefert im hellen
  Raum praktisch dasselbe und im dunklen Raum etwas weniger. Beispiel 1724 lx Bild, 14 lx
  Raum: Epson 124:1, hier 88:1.
- Die Skala gilt auch für Displays, obwohl Epson sie nur für Beamer führt.
- Die AVIXA-Zeile („braucht 15:1“) und der gelbe Hinweis bleiben daneben stehen. In einem
  Besprechungsraum fällt AVIXAs 15:1 mit Epsons Grenze zu „empfohlen“ zusammen.

**In der Legende.** Jede sichtbare Bildfläche mit bekanntem Kontrast bekommt im Block
„BILDKONTRAST IM RAUMLICHT“ eine Zeile Text („1 · 12,0:1 · ausreichend · Besprechungsraum
150 lx“) und darunter den Stufenbalken mit Marke; unter dem letzten Balken stehen die Enden
„sehr gut“ und „zu niedrig“. Bildschirm und PDF aus derselben Liste (`pictureContrastRows`,
`legendColorKeys`), nach WLAN-Schlüssel und Sichtgüte.

### Planungsplan und Ausführungsplan (gebaut 25.11.2026)

Ein Plan, zwei Ausdrucke. `FloorplanPage.hidePlanning` (Haken „Ausführungsplan — Planung
ausblenden“ oben im Reiter „Planung“) nimmt alles vom Blatt und aus dem PDF, was nur der
Planung dient:

- Projektionskegel, Abstandsband, Schraffur „im Bild“, Schnittkasten
- Zuschauerzone, empfohlene Betrachtungsfläche, Heatmap der Sichtgüte
- WLAN-Heatmap
- Abdeckungsbereiche (wie `hideCoverages`, das als eigener Schalter bleibt)
- die Farbschlüssel der Legende: Signalstärke, Sichtgüte, Bildkontrast

Es bleibt, was gebaut wird: Symbole, Bildfläche mit Beschriftung, Display-Balken, Wände.
Nichts wird gelöscht; Haken weg, und der Planungsplan ist wieder da. Nicht über den Connector.

### Symbole in echter Größe (gebaut 24.11.2026)

Eine Symbolgruppe kann ihre Geräte maßstäblich zeichnen statt als Piktogramm:

    FloorplanSymbolGroup.trueSize?: boolean
    FloorplanSymbolGroup.footprint?: "depth" | "height"    Standard "depth"

- Grundfläche = Breite × Tiefe des Geräts aus der Zeichnung; bei „height“ Breite × Höhe
  (für Geräte, die flach an der Wand hängen). Geteilt durch den Planmaßstab.
- `symbolFootprintMm` in `src/floorplan.ts`. Hat das Gerät keine Maße, bleibt das
  Piktogramm — eine Größe wird nie geraten. Der Inspektor nennt die Symbole ohne Maße.
- Sehr kleine Geräte werden auf 1,2 mm Papier angehoben, damit sie sichtbar bleiben.
- Runde Gruppenform ergibt eine Ellipse, sonst ein Rechteck; gedreht mit dem Symbol. Am
  Bildschirm und im PDF aus derselben Geometrie.
- Connector: Gruppenfelder `trueSize` und `footprint`; die Antwort nennt
  `symbolsWithoutSize`.
- Displays mit geplanter Bildgröße behalten ihren Balken in Bildbreite (siehe oben).

Offen: Die Gerätebibliothek kennt die Maße nur zum Teil (419 von 784 allgemeinen, 36 von
153 FACE-Geräten).

### Rechtes Panel: Planoptionen und Planung (gebaut 24.11.2026)

Das Panel hat zwei Reiter (`src/floorplanPanelTab.ts`, `FloorplanOptionsPanel.tsx`):

- **Planoptionen:** ausgewähltes Symbol, Gruppen, Nummerierung, Linien und Last, Legende,
  Plankopf, Abdeckflächen, Notizen. Aufgeklappt sind nur die Gruppen und der Block des
  ausgewählten Symbols; Legende, Plankopf, Abdeckflächen und Notizen klappen auf, wenn ihr
  Objekt auf dem Plan ausgewählt ist.
- **Planung:** Beamer- bzw. Display-Block des ausgewählten Symbols, ausgewählter
  Abdeckungsbereich, Wände, WLAN-Heatmap, Wanddämpfung, Abdeckungsbereiche.
- **Wechsel von selbst:** zu „Planung“ bei Auswahl einer Bildfläche, Zuschauerzone, eines
  Abdeckungsbereichs oder einer Wand und beim Werkzeug Wand oder Abdeckung; zurück zu
  „Planoptionen“ beim Klick auf ein gewöhnliches Symbol. Am Beamer- oder Display-Symbol
  führt der Knopf „Bild planen →“ hinüber.

## Entscheidungen

Entschieden (Jean-Luc, 23.11.2026):

- Die Zuschauerzone wird als Rechteck auf dem Plan definiert.
- Über die Zuschauerzone lässt sich eine Heatmap der Sichtgüte legen.
- Betrachtung, vorerst so: Abstand eines Platzes = Luftlinie in der Draufsicht zur ferneren
  Bildkante; Zeichenhöhe 3 % als Standard; Heatmap „gut“ bis 80 %, „Grenzbereich“ bis 100 %
  der Grenze; eine Zone je Bildfläche. (Offene Punkte 4, 5, 7, 8 damit entschieden.)
- Die Betrachtungsrechnung liegt in `src/projectionViewing.ts`, nicht in `src/projection.ts`.
- Gebaut, abweichend vom Entwurf oben: Die Zuschauerzone wird per Knopf „Zuschauerzone“
  angelegt und dann an Rahmen, Ecken und Drehgriff zurechtgezogen (kein Aufziehen mit der
  Maus). Die Heatmap besteht aus zusammengefassten Vektorflächen statt aus einem Rasterbild,
  am Bildschirm und im PDF aus derselben Geometrie; sie ist standardmäßig an. Der
  Farbschlüssel steht im Inspektor und, sobald eine Heatmap auf dem Blatt liegt, als Block
  „SICHTGÜTE (AVIXA)“ in der Legende (Bildschirm und PDF, nach dem WLAN-Schlüssel).

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

4. **Bezugspunkt für den fernsten Platz** — Faktoren und Winkel sind am AVIXA-Rechner
   geprüft (200, 3438, 30° nach oben, 60° seitlich). Offen bleibt nur, wohin der Abstand
   eines seitlich sitzenden Zuschauers gemessen wird; der Rechner kennt nur eine Zahl.
   Vorschlag: Luftlinie in der Draufsicht zur ferneren Bildkante (die vorsichtige Lesart).
   Nächster Platz: senkrechter Abstand zur Bildebene, wie im Glossar der Norm.
5. **Standard-Zeichenhöhe für BDM** — Vorschlag: 3 % (ergibt 6 × Bildhöhe), änderbar.
6. **Pixelzahl für ADM** — aus den Epson-Daten, falls dort vorhanden, sonst Eingabefeld.
   (So gebaut am 24.11.2026, siehe „Auflösung aus dem Gerät“.)
7. **Eine Zone je Bildfläche** — Vorschlag: ja; getrennte Sitzblöcke deckt ein Rechteck
   über alle Plätze ab, weil nur die äußersten Plätze zählen.
8. **Stufen der Heatmap** — Vorschlag: „gut“ bis 80 % der Grenze, „Grenzbereich“ bis 100 %,
   darüber „außerhalb“. Die 80 % sind eine eigene Festlegung, nicht aus der Norm.
9. **Schnitt: erzeugen zuerst, anfügen danach** — Vorschlag: zuerst der erzeugte Schnitt
   mit Schraffur im Plan; der angefügte Architektenschnitt als zweiter Schritt.
10. **Personenhöhe** — Vorschlag: 1,80 m stehend als Standard, frei änderbar; sitzend
    (1,30 m) als zweite Vorgabe.

Displays sind mit den Vorschlägen 11–13 gebaut (23.11.2026), die Freigabe steht aus:
Balken ersetzt das Piktogramm, Diagonale aus Liste oder frei, Videowand über Breite/Höhe
unter „Mehr“. Ein unverdrehtes Display-Symbol zeigt nach unten auf dem Blatt.

11. **Display-Symbol** — Vorschlag: Der maßstäbliche Balken ersetzt das Piktogramm, sobald
    eine Größe gesetzt ist; die Nummer bleibt. Alternative: Piktogramm und Balken zusammen.
12. **Größe eines Displays** — Vorschlag: Diagonale aus einer Vorgabeliste oder frei
    eintippen; nichts wird aus dem Modellnamen geraten.
13. **Videowände** — Vorschlag: vorerst über frei eingegebene Breite und Höhe unter „Mehr“;
    Raster aus Einzeldisplays später.

Heatmap, Stand 23.11.2026 (ersetzt die festen Stufen oben): stufenloser Verlauf statt fünf
Klassen. Je Platz zählt das schlechteste von drei Verhältnissen — Abstand zum fernsten Platz,
Winkel zur 60°-Linie, nächster Platz zum eigenen Abstand; 1 = genau auf der Grenze. Farben:
grün bis 0,6, gelb bei 0,85, orange auf der Grenze, rot ab 1,3; hinter dem Bild grau.
Gezeichnet als ein aufrechtes Rasterbild über der Zone (4 cm Raster, höchstens 256 Punkte
je Seite), am Bildschirm und im PDF dasselbe. Der Farbschlüssel ist ein Verlaufsbalken mit
„gut · Grenze · außerhalb“.

## Testing Strategy

- Auflösung: `pixelsVOfResolution` für Epsons Namen und für „1920 x 1200“; `opticsForModel`
  trägt die Pixelzahl ein; ADM ohne Pixelzahl → keine Heatmap, kein Farbschlüssel
  (`projectionData.test.ts`, `projectionViewing.test.ts`).
- Kontrast-Skala: Stufe und Lage der Marke je Raumart, Kappung bei 200:1; Legendenblock je
  Bildfläche; Ausführungsplan ohne Farbschlüssel und ohne Abdeckungsbereiche. e2e: Raumart
  Kino setzt 14 lx, Haken „Ausführungsplan“ nimmt Kegel und Legendenblock weg.
- Kontrast (`projectionContrast.test.ts`): dunkler Raum ergibt den Gerätekontrast; mehr
  Raumlicht senkt ihn; höchstes Raumlicht trifft genau den Mindestwert; Display mit
  Reflexion; ungültige Eingaben → kein Ergebnis.
- Echte Größe (`floorplan.test.ts`, `mcpFloorplan.test.ts`, e2e `floorplan-true-size.spec.ts`):
  Grundfläche bei 1:50 und 1:100, Tiefe gegen Höhe, Mindestgröße, ohne Maße kein Umriss,
  Connector setzt die Gruppenfelder.
- Panel: e2e wechselt die Reiter und prüft den Wechsel von selbst (Wand, Abdeckung, Symbol).

- Displays: Bildgröße aus Diagonale und Format (75″ 16:9 → 1,66 × 0,93 m); Bildfläche folgt
  dem Symbol beim Verschieben und Drehen; Balken-Geometrie in echter Breite bei 1:50 und
  1:100; Betrachtung und Heatmap liefern für ein Display dieselben Werte wie für eine
  gleich große Beamer-Bildfläche an derselben Stelle. e2e: Display planen, Zone anlegen,
  Symbol drehen — Zone-Bewertung ändert sich.

- `projection.test.ts`, Betrachtung: BDM 3 % bei 1,35 m Bildhöhe → 8,10 m; ADM 1200 Pixel →
  3,87 m; Rechteck gerade, versetzt und gedreht → fernster/nächster Platz und Winkel;
  nötige Bildhöhe für einen zu fernen Platz; ohne Zone nur die Empfehlung.
- Nächster Platz: Bildhöhe 1,35 m, Unterkante 1,00 m, Augenhöhe 1,20 m → Sichtfaktor 1,15 m,
  nächster Platz 1,99 m; Sichtfaktor unter 50 % der Bildhöhe → kein nächster Platz.
  Seitlich: Bildbreite 2,15 m, 3,00 m vor der Bildebene → bis 4,12 m neben der Mitte.
  Drei Fälle von Hand gegen den AVIXA-Rechner.
- Heatmap-Raster: Stufe je Punkt für ein gerades und ein gedrehtes Rechteck, Punkt auf der
  Grenze, Punkt hinter der Bildfläche.

- `src/__tests__/projection.test.ts`: Referenzwerte EB-L610U (80″/100″/150″, 16:10 und 4:3),
  ein Wechselobjektiv (ELPLL06), Grenzen (zu nah, zu weit, Bild zu groß), Shift H/V einzeln
  und kombiniert, manuelles Projektionsverhältnis, Hin- und Rückrechnung Abstand ↔ Diagonale.
  Die Testdaten sind wenige abgeschriebene Koeffizienten, nicht die Epson-Datei.
- Keine Migration: `projections` ist ein optionales Feld (wie `heatmap`).
- Schnitt: Deckenmontage und Tischaufstellung, Person genau an der Grenze, Person nie im Bild.
- Abgleich von drei Fällen von Hand gegen den Epson-Rechner vor der Freigabe.
- e2e `e2e/floorplan-projection.spec.ts`: Projektion anlegen, Beamer ziehen, Warnung erscheint.

## Boundaries

- Nicht in V1: Trapez/schräge Projektion, gekrümmte Flächen, Edge-Blending,
  Ultrakurzdistanz-Sonderfälle (Wandhalter-Maße), Kamera-Assist, MCP-Werkzeuge für Claude.
- Keine Epson-Daten und keine Epson-Bilder im Repository.
- Die Shift-Semantik ist am Epson-Code geprüft: Prozent der Bildhöhe (V) bzw. -breite (H);
  bei vollem Shift H bleibt vertikal nur der kombinierte Wert, dazwischen linear.
- Vorlagen-IDs, die auch in der Upstream-Datenbank stehen, können `projection` beim Laden
  verlieren; FACE-eigene IDs verwenden oder die Zusammenführung anpassen.
