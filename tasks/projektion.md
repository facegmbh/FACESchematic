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
- [ ] Task 1: `src/projection.ts` — Abstand, Zoom, Bildgröße, Shift, Helligkeit (Tests zuerst)
- [ ] Task 2: `tools/epsonThrowData.mjs` + Lader `src/projectionData.ts` + `.gitignore`

### Phase 2: Auf dem Plan
- [ ] Task 3: Typ `FloorplanProjection`, Migration v49 → v50, Store-Aktionen
- [ ] Task 4: Geometrie und Zeichnung (Bildstrecke, Kegel, Abstandsband, Griffe)
- [ ] Task 5: Inspektor-Block „Projektion“ (Modell, Größe mit Schlössern, Abstandsregler, Helligkeit, „Mehr“)
- [ ] Task 6: PDF-Export
- [ ] Task 7: Deutsche Texte, Deploy-Schritt, Doku-Absatz

### Checkpoint (Freigabe durch Jean-Luc, dann Push auf master)
- [ ] `npx vitest run`, `npx tsc -b`, `npm run build`, `npm run i18n:check` grün
- [ ] Im Browser: Beamer ziehen, Modell wählen, Regler schieben, Warnung außerhalb der Grenzen
- [ ] Drei Fälle gegen den Epson-Rechner verglichen
- [ ] Epson-Datei liegt auf face-docker1 unter `~/faceschematic/projection/`

## Tasks

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
