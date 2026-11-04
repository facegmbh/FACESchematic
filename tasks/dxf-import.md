# Tasks: dxf-import

Zu `SPEC-dxf-import.md` · Stand 2026-11-04 · Test zuerst, ein Commit je Task,
Freigabe vor dem Push auf `master`.

## Task 1: Parser-Schicht — Datei zu Zeichnungsmodell

**Description:** `src/dxfImport/parse.ts` macht aus dem Text einer DXF ein Modell:
Einheiten aus `$INSUNITS`, Ausdehnung aus `$EXTMIN`/`$EXTMAX` (ersatzweise aus den
Entitäten gerechnet), Ebenen aus der LAYER-Tabelle mit ihrem Zustand, Blöcke und
Entitäten. `dxf-parser` wird reguläre Abhängigkeit und faul geladen.

**Acceptance criteria:**
- [x] Einheiten: 1→Zoll, 4→mm, 5→cm, 6→m; 0/fehlend → mm, als `assumed: true` markiert
- [x] Ausdehnung auch ohne `$EXTMIN`/`$EXTMAX` korrekt (aus den Entitäten)
- [x] Ebenen mit Namen und Vorauswahl: eingefroren oder Farbe < 0 → `visible: false`
- [x] Eine Datei ohne Entitäten bricht mit einer Meldung ab, die sagt was zu tun ist

**Verification:**
- [x] `npx vitest run src/__tests__/dxfImportParse.test.ts`
- [x] `npx tsc -b`

**Dependencies:** None

**Files likely touched:** `package.json`, `src/dxfImport/parse.ts`,
`src/__tests__/dxfImportParse.test.ts`

**Estimated scope:** Medium

## Task 2: Renderer — Entitäten zu SVG

**Description:** `src/dxfImport/render.ts` zeichnet das Modell in eine SVG: Linien,
Polylinien (auch mit Bogensegmenten über `bulge`), Kreise, Bögen, Ellipsen, Punkte,
SOLID, TEXT/MTEXT, INSERT mit voller Transformation (auch verschachtelt) und DIMENSION über
seinen Block. SPLINE über Kontrollpunkte angenähert, HATCH übersprungen. Abgewählte Ebenen
kommen nicht hinein.

**Acceptance criteria:**
- [x] Je Entitätstyp ein Test gegen den erwarteten Pfad
- [x] INSERT: Versatz, Skalierung (auch negativ = gespiegelt), Drehung, Verschachtelung
- [x] Eine abgewählte Ebene erscheint nicht in der Ausgabe, auch nicht über einen Block
- [x] Y-Achse gespiegelt (DXF zählt nach oben, SVG nach unten)

**Verification:**
- [x] `npx vitest run src/__tests__/dxfImportRender.test.ts`

**Dependencies:** Task 1

**Files likely touched:** `src/dxfImport/render.ts`, `src/__tests__/dxfImportRender.test.ts`

**Estimated scope:** Large

## Task 3: Einbindung in den Planimport, maßstabsgerecht

**Description:** `importUnderlayFile` nimmt `.dxf` an und liefert eine Unterlage mit
SVG-Data-URL, `kind: "dxf"`, Größe in mm und gesetztem `mmPerPx` — die Zeichnung kommt
kalibriert auf das Blatt. Über der Obergrenze aus der Spec wird gerastert statt eingebettet,
mit Hinweis.

**Acceptance criteria:**
- [x] `.dxf` wird angenommen (Dateiwähler und Ablegen), die alte Ablehnung ist weg
- [x] `mmPerPx` stimmt für eine Zeichnung in mm, in cm und in Zoll
- [x] Zu große Ausgabe → Raster, mit Toast, statt stillschweigend 20 MB im Projekt
- [x] DWG lehnt weiter ab, jetzt mit Verweis auf „als DXF exportieren“

**Verification:**
- [x] `npx vitest run src/__tests__/dxfImportUnderlay.test.ts`
- [x] `npx tsc -b && npm run build`

**Dependencies:** Task 2

**Files likely touched:** `src/dxfImport/index.ts`, `src/floorplanUnderlay.ts`,
`src/types.ts`, `src/i18n/de/*.ts`

**Estimated scope:** Medium

## Task 4: Ebenenwahl und Einheitenwahl im Importdialog

**Description:** Der bestehende Importdialog zeigt für eine DXF ihre Ebenen (wie bisher die
PDF-Ebenen) und, wenn die Einheit geraten wurde, eine Auswahl mm/cm/m/Zoll. Ändern der
Auswahl zeichnet neu, solange die Quelle noch im Speicher liegt.

**Acceptance criteria:**
- [x] Ebenenliste erscheint für DXF, Auswahl wirkt auf die gezeichnete Unterlage (Beleg: E2E in Task 6)
- [x] Geratene Einheit ist als solche erkennbar und umstellbar; Umstellen ändert die Größe (Beleg: E2E in Task 6)
- [x] Für PDF ändert sich nichts (bestehende E2E-Tests in Task 6)

**Verification:**
- [x] `npx vitest run`
- [x] `npm run i18n:check`

**Dependencies:** Task 3

**Files likely touched:** `src/components/FloorplanToolbar.tsx`, `src/store.ts`,
`src/i18n/de/*.ts`

**Estimated scope:** Medium

## Task 5: PDF-Export mit Vektor-Unterlage

**Description:** Der Export rastert eine SVG-Unterlage einmal in der gewählten Auflösung und
setzt sie wie bisher ins PDF.

**Acceptance criteria:**
- [ ] Export mit DXF-Unterlage enthält die Zeichnung
- [ ] Auflösung folgt der Einstellung; kein Hängenbleiben bei großen Zeichnungen
- [ ] Export ohne Unterlage und mit PDF-Unterlage unverändert

**Verification:**
- [ ] `npx vitest run src/__tests__/floorplanPdf*.test.ts`

**Dependencies:** Task 3

**Files likely touched:** `src/floorplanPdf.ts`, `src/floorplanUnderlay.ts`

**Estimated scope:** Small

## Task 6: E2E, Doku, Abnahme

**Description:** Ein E2E-Test führt den Weg in der laufenden App vor: DXF wählen, Unterlage
erscheint, Ebene abwählen, Export. Dazu ein Abschnitt in der Dokumentation und die Abnahme
mit Jean-Luc vor dem Push.

**Acceptance criteria:**
- [ ] `e2e/floorplan-dxf.spec.ts` grün
- [ ] Vollständige Prüfung grün: `tsc -b`, `vitest`, `build`, `i18n:check`, `playwright`
- [ ] Freigabe von Jean-Luc, dann Push auf `master` (= live auf face-docker1)

**Dependencies:** Task 5

**Files likely touched:** `e2e/floorplan-dxf.spec.ts`, `SPEC-dxf-import.md`

**Estimated scope:** Small
