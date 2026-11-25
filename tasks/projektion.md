# Plan: projektion

Spec: `SPEC-projektion.md` · freigegeben von Jean-Luc am 23.11.2026

## Architecture Decisions

- **Rechnung getrennt vom Plan:** `src/projection.ts` kennt weder Store noch React; alles
  Sichtbare (Bildschirm, PDF) liest dieselbe Geometrie daraus.
- **Epson-Daten zur Laufzeit:** `public/projection/epson.json`, gitignoriert, von
  `tools/epsonThrowData.mjs` erzeugt, beim Deploy von face-docker1 hineinkopiert (wie BHE).
  Geladen wird erst, wenn eine Projektion im Spiel ist.
- **Die Projektion speichert ihre Optik mit** (Koeffizienten des gewählten Modells). So
  rechnet eine Zeichnung auch dort richtig, wo die Epson-Datei fehlt, und ändert sich nicht
  still, wenn Epson Daten nachzieht.
- **Bildfläche ist der Fixpunkt:** gespeichert werden Lage und Richtung der Bildfläche; der
  Abstand ergibt sich aus der Lage des Beamer-Symbols. Der Regler verschiebt das Symbol.
- **Shift-Grenze als Sechseck** (aus dem Epson-Code): bei vollem Shift H bleibt für V nur
  der kombinierte Wert, dazwischen linear.

## Task List

### Phase 1: Rechnen
- [x] Task 1: `src/projection.ts` — Abstand, Zoom, Bildgröße, Shift, Helligkeit (Tests zuerst)
- [x] Task 2: `tools/epsonThrowData.mjs` + Lader `src/projectionData.ts` + `.gitignore`

### Phase 2: Auf dem Plan
- [x] Task 3: Typ `FloorplanProjection`, Migration v49 → v50, Store-Aktionen
- [x] Task 4: Geometrie und Zeichnung (Bildstrecke, Kegel, Abstandsband, Griffe)
- [x] Task 5: Inspektor-Block „Projektion“ (Modell, Größe mit Schlössern, Abstandsregler, Helligkeit, „Mehr“)
- [x] Task 6: PDF-Export
- [x] Task 7: Deutsche Texte, Deploy-Schritt, Doku-Absatz

### Checkpoint (Freigabe durch Jean-Luc, dann Push auf master)
- [x] `npx vitest run`, `npx tsc -b`, `npm run build`, `npm run i18n:check` grün
- [x] Im Browser: Beamer ziehen, Modell wählen, Regler schieben, Warnung außerhalb der Grenzen
- [ ] Drei Fälle gegen den Epson-Rechner verglichen
- [x] Epson-Datei liegt auf face-docker1 unter `~/faceschematic/projection/` (24.11.2026 mit Auflösung erneuert; wirkt nach dem nächsten Deploy)

### Phase 3: Betrachtungsabstand nach AVIXA (noch nicht freigegeben)
- [x] Task 8: `evaluateViewing` in `src/projectionViewing.ts` — Grenzen BDM/ADM, Auswertung des Rechtecks (Tests zuerst)
- [x] Task 9: Zuschauerzone als Rechteck — Typ, Knopf „Zuschauerzone“ legt sie an, Griffe auf dem Plan (kein Aufziehen mit der Maus, keine eigene Store-Aktion nötig)
- [x] Task 10: Inspektor-Zeilen „Nutzung“ und „Betrachtung“, „Übernehmen“, PDF, deutsche Texte
- [x] Task 10a: Heatmap der Sichtgüte in der Zone — Raster, Canvas, PDF-Bild, Farbschlüssel

### Checkpoint Phase 3
- [x] Offene Punkte 4–8 der Spec entschieden (4, 5, 7, 8 am 23.11.; 6 am 24.11.2026 gebaut)
- [ ] Drei Fälle gegen den AVIXA-Rechner verglichen (fernster Platz, nächster Platz, CV-Ebene)
- [ ] `npx vitest run`, `npx tsc -b`, `npm run i18n:check` grün
- [ ] Im Browser: Zone aufziehen, zu weit ziehen, Hinweis erscheint, „Übernehmen“ vergrößert das Bild

### Phase 4: Schnitt (noch nicht freigegeben)
- [x] Task 11: `evaluateSection` in `src/projection.ts` — Kegel-Unterkante, Bereich „im Bild“, Kopffreiheit (Tests zuerst)
- [x] Task 12: Schnitt im Inspektor unter „Mehr“ und Schraffur im Kegel auf dem Plan
- [x] Task 13: Schnitt als Kasten auf dem Blatt und im PDF
- [x] Task 14: Architektenschnitt anfügen (Bild/PDF, zwei Punkte kalibrieren)

### Phase 5: Displays (noch nicht freigegeben)
- [x] Task 15: Datenmodell und Geometrie — `kind: "display"`, Bildfläche folgt dem Symbol, Balken in echter Breite (Tests zuerst)
- [x] Task 16: Zeichnung auf dem Plan und im PDF — Balken statt Piktogramm, Zuschauerzone und Heatmap wie beim Beamer
- [x] Task 17: Inspektor-Block „Display“ — Diagonale, Format, Auflösung, Betrachtung; deutsche Texte
- [x] Task 18: `list_floorplans` meldet Displays; e2e

### Checkpoint Phase 5
- [ ] Offene Punkte 11–13 der Spec entschieden
- [ ] `npx vitest run`, `npx tsc -b`, `npm run i18n:check` grün
- [ ] Im Browser: Display planen, Größe ändern — Balken wächst; Zone anlegen; Symbol drehen

### Phase 6: Auflösung, Kontrast, echte Größe, Panel (gebaut 24.11.2026, Commit ec7d0f3)
- [x] Task 19: Mehr Display-Diagonalen (22–163 ″) und Formate (32:9, 9:16, 1:1)
- [x] Task 20: Vertikale Auflösung aus dem Epson-Katalog; ADM ohne Auflösung zeigt keine Heatmap
- [x] Task 21: Symbole einer Gruppe in echter Gerätegröße — Plan, PDF, Connector
- [x] Task 22: Panel in die Reiter „Planoptionen“ und „Planung“ geteilt; nur Gruppen aufgeklappt
- [x] Task 23: Kontrastschätzung für Beamer und Displays (`src/projectionContrast.ts`)

### Checkpoint Phase 6
- [x] `npx vitest run`, `npx tsc -b`, `npm run i18n:check`, `npm run build` grün
- [x] e2e Grundriss: 25 bestanden (ein Lauf direkt nach dem Build fiel mit 16 Fehlern aus, Ursache ungeklärt)
- [x] Deploy nach dem rsync der neuen `epson.json` (24.11.2026, im Container geprüft: 1156 Modelle mit Auflösung)
- [ ] Mindestwerte des Kontrasts (7, 15, 50, 80) am Normtext geprüft
- [ ] „4K PRO-UHD“: tatsächliche Zeilenzahl geklärt
- [ ] Gerätemaße in der Bibliothek ergänzt (419/784 allgemein, 36/153 FACE)
- [ ] Kontrast über den Connector und im PDF — nicht gebaut, bei Bedarf

### Phase 7: Kontrast-Skala und Ausführungsplan (gebaut 25.11.2026, noch nicht committet)
- [x] Task 24: Kontrast-Skala nach Epsons Leitfaden — Raumart, fünf Stufen, Marke im Inspektor
- [x] Task 25: Block „BILDKONTRAST IM RAUMLICHT“ in der Legende, Bildschirm und PDF
- [x] Task 26: Schalter „Ausführungsplan“ blendet die Planung aus (`hidePlanning`)

### Checkpoint Phase 7
- [x] `npx vitest run`, `npx tsc -b`, `npm run i18n:check`, `npm run build` grün; e2e Grundriss 25 bestanden
- [ ] PDF mit Legendenblock angesehen (bisher nur der Bildschirm)
- [ ] Jean-Luc: passt, was der Ausführungsplan ausblendet? Passt die Skala für Displays?
- [ ] Connector: Raumart, Raumlicht und `hidePlanning` setzen — nicht gebaut

## Tasks

### Task 15: Display-Datenmodell
**Acceptance:** 75″ 16:9 → 1,66 × 0,93 m; Bildmitte = Symbolposition, Richtung =
Symboldrehung, auch nach Verschieben und Drehen; Balken-Ecken in Papier-mm; alte Dateien
laden unverändert; Beamer-Projektionen verhalten sich wie bisher.
**Verification:** `npx vitest run src/__tests__/projection.test.ts src/__tests__/projectionViewing.test.ts`

### Task 16: Display auf dem Plan
**Acceptance:** Balken in echter Breite statt Piktogramm, sobald eine Größe gesetzt ist;
kein Kegel, kein Abstandsband; Zuschauerzone, Heatmap und Farbschlüssel wie beim Beamer;
PDF zeigt dasselbe.
**Verification:** Browser, PDF-Export ansehen

### Task 17: Inspektor „Display“
**Acceptance:** Knopf „Display planen“ am Display-Symbol; Diagonale aus Liste oder frei;
Auflösung setzt die Pixelzahl für ADM; Betrachtungszeilen und Hinweise wie beim Beamer.
**Verification:** Browser, `npm run i18n:check`

### Task 18: MCP-Liste und e2e
**Acceptance:** `list_floorplans` nennt je Display Diagonale, Breite, Höhe und Symbol;
e2e legt ein Display an, zieht eine Zone und dreht das Symbol.
**Verification:** `mcpFloorplan.test.ts`, e2e

### Task 8: Betrachtung rechnen
**Acceptance:** BDM 3 % und 1,35 m Bildhöhe → 8,10 m; ADM 1200 Pixel → 3,87 m; Rechteck
gerade, versetzt, gedreht liefert fernsten und nächsten Platz; nötige Bildhöhe für einen zu
fernen Platz; ohne Zone nur die Empfehlung.
**Verification:** `npx vitest run src/__tests__/projection.test.ts`

### Task 9: Zuschauerzone
**Acceptance:** Rechteck aufziehen, verschieben, an Ecken ziehen, drehen; ein Zug = ein
Undo-Schritt; Projektion löschen entfernt die Zone; Seite duplizieren kopiert sie; alte
Dateien laden ohne Migration.
**Verification:** `floorplan.test.ts`, Browser

### Task 10: Inspektor, PDF, Texte
**Acceptance:** zwei Zeilen wie in der Spec; Hinweisfarbe statt Warnfarbe; „Übernehmen“
setzt die Bildgröße in einem Undo-Schritt; PDF zeigt Zone und Grenzlinie.
**Verification:** Browser, e2e, `npm run i18n:check`

### Task 10a: Heatmap der Sichtgüte
**Acceptance:** `viewingGrid` liefert je Rasterpunkt eine Stufe (gut, Grenzbereich, zu weit,
zu nah, zu schräg); Canvas nur innerhalb des Rechtecks, auch gedreht; Schalter unter „Mehr“;
PDF zeigt dasselbe Bild und den Farbschlüssel in der Legende.
**Verification:** `npx vitest run src/__tests__/projection.test.ts`, Browser, PDF-Export ansehen

### Task 1: Rechenmodul
**Acceptance:** EB-L610U 16:10: 80″ → 2,33–3,78 m, 100″ → 2,92–4,74 m; Zoom 0 bei Wide,
1 bei Tele, „zu nah/zu weit“ außerhalb; Shift H aus Versatz/Breite gegen Grenze;
Sechseck-Grenze; Lux = lm · Gain ÷ m²; manuelles Projektionsverhältnis.
**Verification:** `npx vitest run src/__tests__/projection.test.ts`

### Task 2: Daten
**Acceptance:** Skript schreibt eine Datei < 1 MB mit allen Modellen; Wechseloptik wird über
Objektiv-ID + Panelgröße gefunden; Lader liefert `null`, wenn die Datei fehlt.
**Verification:** Skript laufen lassen, Test des Laders mit einer kleinen Beispieldatei.

### Task 3: Datenmodell
**Acceptance:** alte Dateien bekommen `projections: []`; anlegen, ändern, löschen mit Undo;
Symbol löschen entfernt seine Projektion; Seite duplizieren kopiert sie.
**Verification:** `migrations.test.ts`, `floorplan.test.ts`

### Task 4: Zeichnung
**Acceptance:** Kegel vom Objektiv zu den Enden der Bildstrecke; Warnfarbe außerhalb;
Bildfläche verschieben und drehen; ein Zug = ein Undo-Schritt.
**Verification:** Browser, e2e `e2e/floorplan-projection.spec.ts`

### Task 5: Inspektor
**Acceptance:** Block wie in der Spec skizziert; Regler reicht von Wide bis Tele und schiebt
nur den Beamer; Schlösser halten Breite/Höhe; Helligkeit als ausgeschriebene Rechnung.
**Verification:** Browser, e2e

### Task 6: PDF
**Acceptance:** dieselbe Geometrie und Beschriftung wie am Bildschirm.

### Task 7: Texte, Deploy, Doku
**Acceptance:** `npm run i18n:check` grün; Deploy-Schritt „Projektionsdaten einsetzen“;
Abschnitt in der Grundriss-Doku.
