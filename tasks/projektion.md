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
- [ ] Epson-Datei liegt auf face-docker1 unter `~/faceschematic/projection/`

### Phase 3: Betrachtungsabstand nach AVIXA (noch nicht freigegeben)
- [x] Task 8: `evaluateViewing` in `src/projectionViewing.ts` — Grenzen BDM/ADM, Auswertung des Rechtecks (Tests zuerst)
- [x] Task 9: Zuschauerzone als Rechteck — Typ, Knopf „Zuschauerzone“ legt sie an, Griffe auf dem Plan (kein Aufziehen mit der Maus, keine eigene Store-Aktion nötig)
- [x] Task 10: Inspektor-Zeilen „Nutzung“ und „Betrachtung“, „Übernehmen“, PDF, deutsche Texte
- [x] Task 11: Heatmap der Sichtgüte in der Zone — Raster, Canvas, PDF-Bild, Farbschlüssel

### Checkpoint Phase 3
- [ ] Offene Punkte 4–8 der Spec entschieden
- [ ] Drei Fälle gegen den AVIXA-Rechner verglichen (fernster Platz, nächster Platz, CV-Ebene)
- [ ] `npx vitest run`, `npx tsc -b`, `npm run i18n:check` grün
- [ ] Im Browser: Zone aufziehen, zu weit ziehen, Hinweis erscheint, „Übernehmen“ vergrößert das Bild

### Phase 4: Schnitt (noch nicht freigegeben)
- [x] Task 11: `evaluateSection` in `src/projection.ts` — Kegel-Unterkante, Bereich „im Bild“, Kopffreiheit (Tests zuerst)
- [x] Task 12: Schnitt im Inspektor unter „Mehr“ und Schraffur im Kegel auf dem Plan
- [x] Task 13: Schnitt als Kasten auf dem Blatt und im PDF
- [x] Task 14: Architektenschnitt anfügen (Bild/PDF, zwei Punkte kalibrieren)

## Tasks

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

### Task 11: Heatmap der Sichtgüte
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
