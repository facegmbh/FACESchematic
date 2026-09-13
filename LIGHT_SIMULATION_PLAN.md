# FACE Schematic — Modul Lichtsimulation

Status: **Phase A gebaut** · Stand: 2026-09-13 · Owner: JLD

Ersetzt den Entwurf vom 13.09.2026 („face-light" als eigenes Repo mit zwei Python-Services).
Was sich geändert hat und warum, steht in §12.

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
- über die vorhandene MCP-Bridge von Claude bedienbar sein: Leuchten aus Datenblättern
  anlegen, Leuchten platzieren, rechnen, Ergebnis lesen, nachbessern (§7)

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
| **MCP-Bridge: Werkzeuge, Playbooks, Protokoll, Sicherheit** | **fertig, erweiterbar** | `mcp-server/`, `src/mcpBridge.ts`, `src/mcp/` |
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
Darstellung. Details in §9.

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

## 7. MCP — Claude legt Simulationen und Leuchten an

Das Modul bekommt seine MCP-Werkzeuge **nicht am Ende**, sondern in jeder Phase zusammen mit
der Funktion, die sie bedienen. Wer eine Funktion nur über die Oberfläche baut und den
Bridge-Befehl vertagt, baut sie zweimal.

### 7.1 Was schon steht

FACESchematic hat bereits eine vollständige MCP-Anbindung — sie muss nur erweitert werden:

```
Claude  ──stdio──▶  easyschematic-mcp  ──ws://127.0.0.1──▶  Editor-Tab
        (mcp-server/)                    (src/mcpBridge.ts)
```

| Teil | Datei | Rolle |
|---|---|---|
| Werkzeugkatalog (JSON-Schema je Tool) | `mcp-server/src/tools.ts` | Was Claude sieht |
| Playbooks + Server-Instruktionen | `mcp-server/src/prompts.ts` | In welcher Reihenfolge Claude arbeitet |
| Wire-Protokoll, **eine Quelle der Wahrheit** | `src/mcp/protocol.ts` | Wird per `sync-protocol.mjs` in den Server kopiert |
| Ausführung im Tab | `src/mcpBridge.ts` | Ruft die **vorhandenen Store-Actions** auf |
| Reine Prüf-Helfer | `src/mcp/validation.ts` | Unit-testbar ohne Store |

**Die entscheidende Eigenschaft:** Der MCP-Server hält kein eigenes Dokument. Er reicht
Befehle an den laufenden Tab durch, und der führt sie über dieselben Store-Actions aus, die
auch die Oberfläche benutzt. Deshalb funktionieren Undo, Autosave, Validierung und
Auto-Routing unverändert weiter. **Für die Lichtwerkzeuge gilt dieselbe Regel ohne Ausnahme:
kein Befehl schreibt am Store vorbei.**

Sicherheit ist geregelt und bleibt, wie sie ist: WebSocket nur auf `127.0.0.1`, Pairing-Token,
Origin-Prüfung, und der Nutzer muss die Verbindung in den Einstellungen aktiv einschalten.

### 7.2 Die Arbeitsteilung

Das ist der Punkt, an dem man sich sonst verrennt — **Claude kann den Grundriss nicht selbst
importieren.** Underlay rastern, Maßstab kalibrieren und die Wandebene wählen bleibt im
Editor, so wie es beim Beschallungsplan schon ist. Das ist keine Lücke, sondern die Stelle,
an der ein Mensch hinsehen muss: ein falsch kalibrierter Plan macht jede Lux-Zahl wertlos,
und der Fehler fiele niemandem auf.

| | |
|---|---|
| **Nutzer im Editor** | PDF importieren, Maßstab kalibrieren, Wandebene wählen, Räume bestätigen |
| **Claude über MCP** | Leuchten anlegen, platzieren, Schienen bestücken, rechnen lassen, Ergebnis lesen, nachbessern |
| **Claude ohne MCP** | Datenblatt-PDF lesen und die Werte herausziehen — das kann Claude von sich aus, dafür braucht die Bridge nichts |

Der letzte Punkt ist wichtig für den Zuschnitt: **im Protokoll werden nur Zahlen
transportiert, keine Dateien.** Claude liest das Datenblatt selbst und ruft das Werkzeug mit
Lichtstrom, Abstrahlwinkel und Leistung auf. Der MCP-Server bekommt keinen PDF-Parser.

### 7.3 Die Werkzeuge

**Leuchten anlegen (Ship-L1)** — deckt „aus meinen Leuchtendaten und Datenblättern":

| Tool | Zweck |
|---|---|
| `create_luminaire` | Aus Datenblattwerten: Name, System, Leistung, Lichtstrom, Abstrahlwinkel, CCT, Montageart → Geräte-Template mit Photometrie `origin: "datasheet"` (cos-Modell, §5.2) |
| `add_luminaire_measurement` | Messreihe nach §5.3: Abstand `d`, Grundhelligkeit, Messpunkte `[{abstandCm, lux}]` → rechnet I(γ), normiert auf den Datenblatt-Lichtstrom, speichert `origin: "measured"` |
| `import_photometry` | Vorhandene LDT/IES-Werte → `origin: "manufacturer"` |
| `list_luminaires` | Was im Katalog liegt, mit Herkunft und Messdatum je Eintrag |

`add_luminaire_measurement` ist das Werkzeug, das die Messung praktisch macht: Du liest die
Luxwerte vom Messgerät ab, Claude rechnet die Kurve, normiert sie, schreibt die LDT und sagt
dir, ob das Ergebnis zum Datenblatt passt. Aus der Anleitung in §5.3 wird damit ein Diktat.

**Simulation anlegen (Ship-L2)** — deckt „aus Plänen die Simulationen":

| Tool | Zweck |
|---|---|
| `create_floorplan` / `update_floorplan` mit `kind: "light"` | Plantyp Lichtplan — **erweitert**, kein eigenes `create_light_plan` |
| `place_floorplan_symbols` mit `mountHeightMm` und `dimming` | Leuchten platzieren — **erweitert**, kein eigenes `place_luminaires` |
| `set_light_calculation` | Nutzebene, Montagehöhe, Wartungsfaktor, Rasterweite, Sichtbarkeit |
| `light_report` | E<sub>m</sub>, E<sub>min</sub>, E<sub>max</sub>, U₀, Leuchtenzahl, Anschlussleistung |
| `suggest_rooms` · `define_room` | Phase B: Polygon aus den Wänden vorschlagen, Raum festlegen |
| `place_luminaires_on_track` | Phase F: Schiene von A nach B, Abstand **oder** Anzahl |

Die ersten beiden Zeilen weichen bewusst vom ersten Entwurf ab. Ein Lichtplan ist ein
Floorplan mit anderem Typ, und eine Leuchte ist ein Symbol mit zwei Feldern mehr — dafür
zwei parallele Werkzeuge zu bauen hieße, die Prüfung von Positionen, Gruppen und
Beschriftungen ein zweites Mal zu schreiben und beim nächsten Mal an einer Stelle zu
vergessen.

### 7.4 Die Schleife ist der eigentliche Gewinn

Einzelne Werkzeuge sind nett. Wertvoll wird es durch den Zyklus:

```
place_luminaires → run_light_calculation → light_report
     ▲                                          │
     └──────────  zu dunkel / zu ungleichmäßig ──┘
```

Claude platziert, rechnet, liest die Zahlen, korrigiert, rechnet erneut — bis 300 lx im Mittel
stehen. Das ist die Arbeit, die am Bildschirm mühsam und für einen Assistenten trivial ist.

**Daraus folgt eine Anforderung an die Rechnung:** Dieser Zyklus braucht Antworten in
Sekunden, nicht in Minuten. Die Browser-Rechnung aus §4.1 ist dafür der richtige Motor —
Radiance (§9, Rechenzeiten in §10) ist die Kontrollrechnung am Ende, nicht der Motor der Schleife. Das ist ein
weiterer Grund, warum Stufe 1 vor Stufe 2 kommt.

### 7.5 Playbook

Ein neuer Prompt `lichtplanung` in `mcp-server/src/prompts.ts`, neben den vorhandenen
`build-schematic`, `rack-elevation`, `modular-chassis` und `floorplan`. Er hält die
Reihenfolge fest (Plan prüfen → Räume → Leuchten aus dem Katalog → platzieren → rechnen →
nachbessern → Legende und Plankopf) und die Regeln, die sonst jedes Mal neu gelernt werden
müssten:

- Erst lesen, was schon da ist — nie eine leere Seite annehmen.
- Positionen sind **reale Meter** ab der Ecke der Zeichenfläche, keine Pixel (bestehende
  Konvention der Floorplan-Tools).
- Höhen sind reale Millimeter und haben keinen Maßstabsbezug.
- Keine Leuchten-Ids erfinden — immer aus `list_luminaires`.
- Ein Ergebnis ohne bestätigte Räume ist wertlos: ohne Raumhöhe und Reflexionsgrade
  keine Rechnung.
- Die Zahl, die herauskommt, ist eine Planungshilfe und kein Nachweis (§1). Das gehört in
  die Antwort an den Nutzer, nicht nur in den PDF-Export.

### 7.6 Was beim Bauen zu beachten ist

- **Photometrie kann nicht über `set_device_property` laufen.** `src/mcp/validation.ts`
  verwirft alles, was kein einfacher Skalar ist, und die Whitelist `SAFE_DEVICE_FIELDS` ist
  genau deshalb so eng. Photometrie ist ein Objekt und braucht einen eigenen Befehl mit
  eigener Prüfung — nicht eine Aufweichung der Whitelist.
- **Plausibilitätsprüfung gehört ins Werkzeug.** Claude zieht die Werte aus einem
  PDF-Datenblatt und kann sich verlesen (900 lm statt 9000, Halbwinkel statt vollem
  Abstrahlwinkel). `create_luminaire` prüft die Grenzen und **gibt die abgeleitete
  Lichtstärke I₀ und die Beleuchtungsstärke unter der Leuchte zurück**. 505 lx liest sich
  plausibel, 50 500 lx fällt sofort auf.
- **`CommandType` und die Parametertypen** kommen nach `src/mcp/protocol.ts`, nicht in den
  Server — `sync-protocol.mjs` kopiert die Datei beim Build, damit es genau eine Quelle gibt.
- **`PROTOCOL_VERSION` bumpen**, damit ein alter Server und ein neuer Tab sich nicht koppeln
  und dann seltsam verhalten.
- **Batch mit Ergebnis je Element**, wie bei `place_floorplan_symbols`: 24 Spots platzieren
  und erfahren, welche drei nicht gepasst haben, statt alles oder nichts.
- **Englische Tool-Namen, deutsche Beschreibungen** — so wie der Rest der Bridge es hält.

---

## 8. Datenmodell

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

## 9. Der Radiance-Service

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

## 10. Rechenpower — was das Ganze an Hardware braucht

Kurz: **nichts zu kaufen.** Die Antwort zerfällt in drei Teile, und nur der dritte kostet
überhaupt Rechenzeit — der ist aber bewusst aus dem Arbeitsfluss herausgehalten.

### 10.1 Die Rechnung im Browser (Phase A/B) — gemessen

Gemessen am fertigen Code, A1 quer, Rasterweite 2,5 mm, also rund **72.000 Stützstellen**,
auf einem 4-Kern-Container (langsamer als jeder Arbeitsplatzrechner):

| Leuchten | Rechenzeit |
|---|---|
| 8 | 132 ms |
| 24 | 406 ms |
| 64 | 1,07 s |
| 160 | 2,65 s |

Der Aufwand ist Stützstellen × Leuchten, also linear in der Leuchtenzahl. Ein normaler
Raum mit 8–24 Leuchten rechnet in einer Fünftelsekunde; ein Laptop ist dabei nochmal zwei-
bis dreimal schneller. Für die Schleife aus §7.4 — platzieren, rechnen, lesen, nachbessern —
ist das genau die Größenordnung, die sich flüssig anfühlt.

Erst ein ganzes Geschoss mit über hundert Leuchten wird zäh. Zwei Stellschrauben, bevor
irgendjemand über Hardware nachdenkt: die Rasterweite geht quadratisch ein (5 mm statt
2,5 mm ist viermal billiger), und eine Entfernungsabschneidung würde den Aufwand nahezu
unabhängig von der Gesamtzahl machen — ein 36°-Spot trägt jenseits weniger Meter ohnehin
unter ein Lux bei. Beides ist noch nicht nötig und deshalb nicht gebaut.

### 10.2 Die 3D-Ansicht (Phase D) — läuft auf dem Arbeitsplatzrechner

three.js rastert auf der Grafikkarte, die ohnehin im Rechner steckt. Die Geometrie ist
dabei nicht das Problem: ein extrudierter Raum sind ein paar tausend Dreiecke, das ist für
jede GPU der letzten zehn Jahre nichts. Teuer sind **schattenwerfende Lichtquellen** —
jede kostet eine eigene Schattenberechnung pro Bild, und bei 20 bis 30 Spots fängt ein
Laptop an zu arbeiten.

Der Ausweg ist schon da: Das Lux-Raster wird ohnehin gerechnet. Es wird als Lichtkarte auf
Boden und Wände gelegt, und die Leuchten in der Szene müssen dann kaum noch echtes Licht
werfen — sie sind sichtbare Körper mit einem Schein. Damit bleibt die Bildrate hoch, und
als Nebenwirkung stimmt die Helligkeitsverteilung in 3D exakt mit der Rechnung überein,
statt ihr zu widersprechen.

### 10.3 Radiance (Phase E) — hier steckt die Rechenzeit, aber als Stapeljob

Das ist der einzige Teil, der spürbar rechnet:

- **`rtrace` für ein Lux-Raster eines Raums:** Sekunden bis etwa eine Minute. Das
  Abbruchkriterium des Plans (< 10 s je Raum, §9) ist realistisch.
- **`rpict` für ein Bild ins Angebot:** Minuten, nicht Stunden — bei 1920 px und
  maßvollen Interreflexions-Einstellungen.

Entscheidend ist die Architektur, nicht die Maschine: **Radiance sitzt nie in der
Schleife.** Es ist die Kontrollrechnung am Ende und das eine Bild fürs Angebot. Dass es
zwei Minuten braucht, stört dort niemanden.

Radiance parallelisiert nahezu linear über Kerne. Damit bleibt genau **eine offene
Hardwarefrage: wie viele Kerne hat `face-docker1`?** Vier reichen für einen Raum, acht
machen den Hero-Shot angenehm. Mehr braucht es nicht.

### 10.4 Was ausdrücklich nicht gebraucht wird

Keine Renderfarm, kein GPU-Server, kein Accelerad. Der GPU-Beschleuniger aus dem ersten
Entwurf lohnt nur, wenn man Radiance interaktiv betreiben will — und genau das vermeidet
die Architektur, indem Stufe 1 im Browser läuft. Die Entscheidung „eigene Rechnung vor
Radiance" ist damit auch die Entscheidung, die die Hardwareanforderung auf null hält.

### 10.5 Wie gut wird das Bild am Ende?

Drei Stufen, mit ehrlichen Erwartungen:

| | Was man bekommt |
|---|---|
| **Lux-Raster als Falschfarbe** | Die Entscheidungsgrundlage. Kein Bild für den Kunden. |
| **three.js-Realansicht** | Eine gute Architektur-Visualisierung: Proportion, Stimmung, wo es hell ist und wo nicht. Begehbar. Nicht fotorealistisch. |
| **Radiance `rpict`** | Ein physikalisch korrektes Bild mit echten Lichtkegeln und Interreflexion. Das Bild, das ins Angebots-PDF geht. |

Was keine der drei Stufen liefert, ist die Bildsprache einer Visualisierungsagentur —
Möblierung, Materialien, Nachbearbeitung. Das ist ein eigenes Handwerk und eine eigene
Software (Blender), und genau deshalb ist Phase D in §6 hart gedeckelt: Wände, Boden,
Decke, Leuchten, Kamerafahrt, Tonemapping. Das ist das Loch, in dem 3D-Projekte
verschwinden.

---

## 11. Phasen

| | Inhalt | MCP-Werkzeuge, die mitgehen | Dauer |
|---|---|---|---|
| **A** ✅ | Plantyp `light`, Leuchtensymbole mit Montagehöhe, Lux-Raster aus dem cos-Modell (P1) | `create_luminaire`, `list_luminaires`, `set_light_calculation`, `light_report` | **gebaut** |
| **B** | `FloorplanRoom` aus den vorhandenen Wänden, Höhe, Reflexionsgrade, indirekter Anteil | `suggest_rooms`, `define_room` | Tage |
| **C** | Messplatz einrichten, MAG48-Spot und Surf20 vermessen, LDT-Schreiber (P2) | `add_luminaire_measurement`, `import_photometry` | 1 Woche, davon 2 Tage Messen |
| **D** | 3D-Realansicht: extrudierte Räume, IES-Leuchten aus C, Falschfarbe umschaltbar | — (Ansichtssache, nichts zu steuern) | 1–2 Wochen |
| **E** | `light-sim`-Container mit Radiance, ersetzt die Werte aus A/B | — (`run_light_calculation` bekommt nur eine Genauigkeitsstufe dazu) | 1–2 Wochen |
| **F** | Schienen als Linienobjekt, Stückliste, Odoo-Übergabe | `place_luminaires_on_track` | 1–2 Wochen |

Nach **A** kann Claude bereits eine Leuchte aus einem Datenblatt anlegen, sie in einem
kalibrierten Plan verteilen, rechnen lassen und das Ergebnis vorlesen. Das ist der erste
Punkt, an dem das Modul seinen Zweck erfüllt — und er liegt vor Messung, 3D und Radiance.

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

## 12. Entscheidungen

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
| 2026-09-13 | **MCP-Werkzeuge gehen in jeder Phase mit, nicht als eigene Phase am Ende** | Wer die Funktion nur über die Oberfläche baut und den Bridge-Befehl vertagt, baut sie zweimal |
| 2026-09-13 | **Auswertebereich ist das Leuchtenrechteck plus ein halber Leuchtenabstand** | Beim Bauen von Phase A aufgefallen: um eine Montagehöhe aufgeweitet, wäre E_min bei engen Spots immer null und U₀ als Kennzahl wertlos. Der halbe Abstand ist zugleich die Regel, nach der eine Lichtplanung von Hand aufgebaut wird. Ersetzt in Phase B durch das Raumpolygon. |
| 2026-09-13 | **Leuchtenabstand folgt dem Abstrahlwinkel, nicht der Montagehöhe** | Ebenfalls beim Bauen aufgefallen und als Test festgehalten: die übliche Faustregel (1–1,5 × Höhe) gilt für breit strahlende Downlights. Ein 36°-Spot will rund 1,3 m statt 2,5 m — sonst helle Lichtinseln mit Dunkelheit dazwischen, egal wie viele man dazulegt. Das Playbook rechnet die Regel jetzt aus dem Winkel. |
| 2026-09-13 | **Kein PDF-Parser im MCP-Server; Claude liest Datenblätter selbst** | Über die Bridge gehen Zahlen, keine Dateien. Hält den Server klein und das Protokoll prüfbar. |
| 2026-09-13 | **Import und Kalibrierung des Grundrisses bleiben beim Nutzer** | Ein falsch kalibrierter Plan macht jede Lux-Zahl wertlos, und der Fehler fiele niemandem auf |

---

## 13. Offene Punkte

- [ ] Luxmeter beschaffen — Klasse C genügt (§5.4), Auswahl und Budget offen
- [ ] Welche Leuchten zuerst vermessen? Vorschlag: MAG48-Spot (rotationssymmetrisch, einfach),
      dann Surf20 (zwei Ebenen, §5.5)
- [ ] Hersteller-LDTs trotzdem anfragen — kostet nichts und ist die Referenz, gegen die wir
      unsere eigene Messung einmal prüfen können
- [ ] Feature-Flag für Stufe 2: wie verhält sich der öffentliche Build, wenn kein
      `light-sim` erreichbar ist? (Vorschlag: Schalter gar nicht anzeigen)
- [ ] **Wie viele Kerne hat `face-docker1`?** Die einzige offene Hardwarefrage im ganzen
      Plan (§10.3). Vier reichen für einen Raum, acht machen den Hero-Shot angenehm.
- [ ] Referenzprojekt für die Abnahme — Mikulla-Plan (Egbers, E1) liegt vor
- [ ] Sollen die Lichtwerkzeuge in der Bridge hinter einem eigenen Schalter liegen oder mit
      der bestehenden AI-Beta-Einstellung mitkommen? (Vorschlag: mitkommen — ein Schalter
      weniger, dieselbe Sicherheitslage)
- [ ] Datenblätter der Leuchten sammeln — sie sind ab Phase A die Eingabe für
      `create_luminaire` und damit früher gebraucht als die Messung
- [ ] Einen real vermessenen Raum gegen die Rechnung halten: der ehrlichste Test des ganzen
      Moduls, und das Luxmeter ist dann ohnehin da

---

## 14. Nächster Schritt

**Phase A ist gebaut.** Plantyp `light`, Leuchten mit Montagehöhe und Dimmung, Lux-Raster
auf der vorhandenen Heatmap-Maschinerie, Bedienfeld, vier MCP-Werkzeuge und das Playbook
`lichtplanung`. Der Rechenkern steht in `src/lightSim.ts`, geprüft durch 27 Tests in
`src/__tests__/lightSim.test.ts` und 18 Handler-Tests in `src/__tests__/mcpLight.test.ts`.

**Als Nächstes: Phase B** — `FloorplanRoom` aus den vorhandenen Wänden, Raumhöhe,
Reflexionsgrade und damit der indirekte Anteil. Das ersetzt zugleich die Hilfskonstruktion
des Auswertebereichs (§12) durch den echten Raum.

---

<details><summary>Ursprüngliche Fassung dieses Abschnitts</summary>

**Phase A, mitsamt ihren MCP-Werkzeugen.** Plantyp `light`, ein Leuchtensymbol mit
Montagehöhe, Lux-Raster aus dem cos-Modell auf der vorhandenen Heatmap-Maschinerie — und die
Bridge-Befehle dazu, damit die Funktion von Anfang an beides bedient.

Das Abnahmekriterium ist ein Satz: *„Hier ist das Datenblatt des MAG48-Spots, verteile mir
davon genug im Abschiedsraum für 300 Lux."* — und Claude legt die Leuchte an, platziert sie,
rechnet und sagt, was herauskommt. Ohne Container, ohne Messung, ohne Herstelleranfrage.

</details>
