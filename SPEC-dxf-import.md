# Spec: dxf-import

Eigenständiges Modul · hängt von nichts ab · Stand 2026-11-04

## Objective

Eine DXF des Architekten lässt sich direkt als Planunterlage importieren, ohne Umweg über
PDF. Drei Dinge, die der PDF-Weg nicht kann:

- **Maßstabstreu ohne Kalibrieren.** Eine DXF bringt ihre Einheiten mit. Das Lineal-Werkzeug
  wird überflüssig, und die Reichweiten der Abdeckungen stimmen ab dem ersten Moment.
- **Ebenen, die wirklich Ebenen sind.** Möblierung aus, Wände an — aus der Layer-Tabelle,
  nicht aus dem, was ein Plotter ins PDF geschrieben hat.
- **Scharf bei jedem Zoom.** Die Unterlage wird als Vektor gezeichnet. Damit ist die Frage
  „reichen 300 dpi?“ erledigt, die uns beim PDF-Import mehrfach eingeholt hat.

Nicht Teil dieses Moduls: DWG (siehe Open Questions), Schraffuren, Bemaßung als bearbeitbare
Maßobjekte, ACI-Farben.

## Tech Stack

- `dxf-parser` 1.1.2 — liegt schon im Projekt (bisher devDependency, prüft den DXF-**Export**),
  wird reguläre Abhängigkeit. Reines JS, `parseSync(text)` braucht zur Laufzeit keine
  Node-Builtins (`stream` ist dort nur ein TS-Typ), 120 KB, wird faul geladen wie pdfjs.
- Eigener Renderer DXF → SVG in `src/dxfImport/`. Kein Server, keine WASM, nichts verlässt
  den Browser.

## Commands

```
Build:   npm run build
Test:    npx vitest run && npx tsc -b
E2E:     npx playwright test
i18n:    npm run i18n:check
Deploy:  git push origin master   (Runner auf face-docker1)
```

## Project Structure

```
src/dxfImport/parse.ts    → Datei → DxfDrawing (Einheiten, Ebenen, Entitäten, Ausdehnung)
src/dxfImport/render.ts   → DxfDrawing + Ebenenwahl → SVG
src/dxfImport/index.ts    → importDxfUnderlay(): das, was floorplanUnderlay aufruft
src/floorplanUnderlay.ts  → nimmt .dxf an statt es abzulehnen
src/floorplanPdf.ts       → Vektor-Unterlage für den Export rastern
src/__tests__/dxfImport*.test.ts
e2e/floorplan-dxf.spec.ts
```

## Entscheidungen

1. **Vektor statt Raster.** `underlay.src` wird eine SVG-Data-URL, `kind: "dxf"`. Der Rest
   des Unterlagen-Modells (Position, Größe, Deckkraft, Sperre) bleibt wie er ist, damit
   Verschieben, Skalieren und Speichern unverändert funktionieren.
2. **Einheiten.** `$INSUNITS` (1 Zoll, 4 mm, 5 cm, 6 m …). Fehlt die Angabe oder steht sie
   auf 0, wird **mm** angenommen und im Importdialog angeboten — deutsche Architektur-DXF
   sind praktisch immer in mm, aber geraten wird sichtbar, nicht stillschweigend.
3. **Maßstab.** Aus Einheiten und Ausdehnung folgt `mmPerPx` exakt; die Unterlage kommt
   kalibriert auf das Blatt, passend zum eingestellten Maßstab der Seite.
4. **Ebenen.** Die LAYER-Tabelle wird zu `PdfLayerChoice[]` — die Auswahl im Importdialog
   und die Anzeige in der Werkzeugleiste gibt es damit geschenkt. Eingefrorene Ebenen und
   solche mit negativer Farbe (= ausgeschaltet) sind vorangewählt **aus**.
5. **Eine Tinte.** Alles wird in einem dunklen Grau gezeichnet. Eine Unterlage ist
   Hintergrund; die Symbole müssen darauf stehen können. (ACI-Farben später, wenn jemand
   sie vermisst.)
6. **Entitäten.** LINE, LWPOLYLINE, POLYLINE (auch geschlossen und mit Bögen), CIRCLE, ARC,
   ELLIPSE, POINT, SOLID, TEXT, MTEXT, INSERT (mit Versatz, Skalierung, Drehung, auch
   verschachtelt) und DIMENSION über den zugehörigen Block. SPLINE wird über seine
   Kontrollpunkte angenähert. HATCH wird übersprungen.
7. **Obergrenze.** Eine Zeichnung, deren SVG über 8 MB ginge, wird stattdessen gerastert —
   mit Hinweis, warum. Das Projekt soll nicht an einer Unterlage ersticken
   (localStorage-Budget, siehe `src/underlaySource.ts`).
8. **PDF-Export.** Die Vektor-Unterlage wird beim Export einmal gerastert (derselbe Weg wie
   die BHE-Symbole). jsPDF nimmt kein SVG; das ist der Grund, nicht eine Vorliebe.

## Code Style

Wie der Rest von `src/`: kleine Module, strikte Typen, englische Bezeichner und Kommentare,
deutschsprachige Texte an den Nutzer über `t()`. Keine Wegwerf-Kommentare, sondern die
Begründung an der Stelle, wo sie jemandem beim Lesen hilft.

## Testing Strategy

- **Unit, Parser:** handgeschriebene Minimal-DXF im Test (Einheiten, Ebenen, Extents,
  Blöcke). Dazu die Ausgabe unseres **eigenen** DXF-Exporters als realistische Datei —
  damit liegt kein fremdes Material im Repository.
- **Unit, Renderer:** jede Entität einzeln gegen den erwarteten Pfad; Transformationen von
  INSERT (verschachtelt, gedreht, gespiegelt über negative Skalierung).
- **Integration:** `importUnderlayFile` mit einer DXF → Unterlage mit gesetztem `mmPerPx`,
  Größe in mm, Ebenenliste.
- **E2E:** Datei im Dialog wählen, Unterlage erscheint, eine Ebene abwählen, Export-PDF
  entsteht ohne Fehler.
- **Gegenprobe:** je Fehlerklasse ein Test, der ohne die Korrektur fällt (Hausregel).

## Boundaries

- Always: alles im Browser. Kundenpläne verlassen das Haus nicht.
- Ask first: DWG-Konverter auf face-docker1, ACI-Farben, Schraffuren, Bemaßungsobjekte.
- Never: DXF aus Kundenprojekten oder Mitgliedsmaterial als Fixture ins Repository.

## Success Criteria

1. Eine DXF lässt sich im Planimport wählen; die Zeichnung erscheint maßstabsgerecht auf dem
   Blatt, ohne dass jemand kalibriert.
2. Die Ebenen der Zeichnung stehen im Importdialog und lassen sich an- und abwählen.
3. Beim Hineinzoomen bleibt die Unterlage scharf (Vektor, kein Raster).
4. Der PDF-Export enthält die Unterlage.
5. `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run i18n:check` und
   `npx playwright test` sind grün.
6. Eine DXF, die wir nicht lesen können, bricht mit einer Meldung ab, die sagt was zu tun
   ist — nicht mit einem leeren Blatt.

## Open Questions

- **DWG über CADCraft?** `cadcraft-cli convert` (Rust, MIT/Apache, liest DWG R13–2018) auf
  face-docker1 würde DWG → DXF machen, und ab da liefe alles aus diesem Modul. Die Datei
  bliebe im Haus, aber es käme eine Rust-Komponente auf den Server. Entscheidung vertagt,
  bis DXF steht und sich zeigt, wie oft wirklich nur DWG kommt.
