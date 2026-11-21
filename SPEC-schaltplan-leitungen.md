# Spec: schaltplan-leitungen

Modul aus `CAPABILITY-MAP.md` · hängt ab von schaltplan-layout · Stand 2026-11-21

## Objective

Claude soll Leitungen so führen, wie FACE zeichnet: **keine Linien außerhalb der Zeichnung,
keine Linien über Text.** Auslöser: nach Checkpoint G hat Claude in claude.ai die Kapelle
örtlich aufgebaut. Jean-Luc: „keine Linien außerhalb der Zeichnung und über Texte“. Claude kam
nicht weiter und schlug vor, den Rest im Editor von Hand nachzuziehen. Als Gründe nannte es:
- Es kann keine Wege vorgeben, nur das Auto-Routing starten.
- Die Netzwerk-Anschlüsse säßen fest auf der falschen Seite.
- Es kann den Abstand zwischen Orten nicht ändern.

Nachgeprüft (21.11., Kapelle-Fixture, 19 Verbindungen):
- **Ports mit zwei Seiten:** Netzwerk-Ports (bidirektional) haben einen Anschluss links (`-in`) und
  einen rechts (`-out`). Claude wählt die Seite beim Verbinden, kann sie danach aber nicht mehr
  ändern. Mit der Seite zum Gegenüber (7 von 19 Verbindungen) sinkt die Leitungslänge außerhalb
  der Orte von 2432 auf 672 px.
- **Text:** Der Router weicht nur Geräten aus (`pathfinding.buildObstacles`). Ortsnamen und
  Notizen sind für ihn kein Hindernis, darum laufen Leitungen über „Technik“.
- **Übrige Umläufe:** Was danach bleibt, läuft über den Technikraum hinweg (Kapelle → Sakristei)
  oder unten um den Schrank herum (ESP-Ausgänge rechts → P2600-Eingänge links). Den Orten fehlt
  dafür Platz am Rand.

User Stories:
1. Claude legt Leitungen so, dass keine Linie die Zeichnung verlässt und keine über einen
   Ortsnamen oder eine Notiz läuft. Dabei wählt es bei zweiseitigen Ports die Seite zum Gegenüber.
2. `check_layout` meldet beides, damit Claude es ohne Bild merkt.
3. Für hartnäckige Einzelfälle legt Claude eine Leitung selbst mit Stützpunkten. Das Routing
   behält diesen Weg, wie bei einem von Hand gezogenen.
4. Zeichne ich selbst im Editor, laufen Leitungen auch dort nicht über Ortsnamen und Notizen.

## Begriffe

- **Zeichnung:** das Rechteck um alle Orte (Räume oberster Ebene). Ohne Räume gibt es keinen
  Rahmen und keinen `line_outside`-Befund. Das Rechteck um die Geräte wäre zu eng: Jede rückwärts
  laufende Leitung würde gemeldet (entschieden beim Bauen, 21.11.).
- **Text:** Ortsnamen (Beschriftung oben links im Raum, Schriftgröße `labelSize`, Standard 12 px)
  und Notizen (`note`-Knoten). Gerätetexte sind schon heute geschützt, weil Geräte Hindernisse
  sind. Stub-Beschriftungen haben eigene Regeln im Router und bleiben unverändert.

## Neue und geänderte Befehle

| Befehl | Zweck |
|---|---|
| `choose_port_sides` `{ connectionIds? }` | Bei zweiseitigen Ports (`-in`/`-out`) die Seite zum Gegenüber wählen. Liegt das Gegenüber rechts, rechts; liegt es links, links. Liegen beide übereinander, etwa im Rack, nehmen beide dieselbe Seite. Die Verbindung behält ihre ID (Kabelnummern hängen daran). Ein Undo-Schritt. Durchgangsports (`rear`/`front`) bleiben, ebenso Verbindungen mit eigenen Stützpunkten, außer sie sind ausdrücklich genannt |
| `check_layout` | Neue Befunde: `line_outside` (Leitung verlässt die Zeichnung, mit Länge) und `over_text` (Leitung über einem Ortsnamen oder einer Notiz) |
| `arrange_rooms` `{ order?, gap? }` | `gap`: Abstand zwischen den Orten in px (Raster, Standard 96, höchstens 480) |
| `arrange_room` / `fit_room` `{ …, margin? }` | `margin`: Rand im Ort für Leitungen (16–160, Standard 32), am Raum gespeichert (`layoutMargin`), damit spätere Anpassungen ihn behalten; ein Undo nimmt Rand und Lage zurück |
| `set_connection_path` `{ connectionId, waypoints }` | Eine Leitung selbst legen: Stützpunkte in Zeichnungskoordinaten, auf das Raster gerundet, höchstens 50, über die vorhandene Editor-Aktion `setManualWaypoints`. Leere Liste = wieder dem Routing überlassen |

Router (betrifft auch das Zeichnen von Hand): Ortsnamen und Notizen werden Hindernisse in
`buildObstacles`. Der Ortsname bekommt ein Rechteck aus geschätzter Textbreite plus Innenabstand.
Die Schätzung ist bewusst großzügig, eine Messung im DOM gibt es im Router nicht.

## Playbook

Neue Reihenfolge nach dem Verbinden: `choose_port_sides` → `route_connections` → `check_layout`.
Bei `line_outside` oder `over_text` zuerst die Abstände erhöhen (`gap` bzw. `margin`) und neu
ordnen. Bleibt danach eine einzelne Leitung übrig, legt Claude sie mit `set_connection_path`
selbst und prüft mit `render_schematic`.

## Commands / Structure / Style

Wie schaltplan-layout:
- **Wo der Code liegt:** reine Funktionen (Seitenwahl in `src/portSides.ts`, Prüfungen in
  `src/layoutCheck.ts`), angebunden in `src/mcpBridge.ts`.
- **Undo:** Store-Aktionen mit Undo.
- **Katalog:** Beschreibungen in `mcp-server/src/tools.ts`.
- **Router:** Die Änderung bleibt klein und nur in `pathfinding.buildObstacles`.

## Testing Strategy

- **Reine Funktionen:** Seitenwahl (rechts/links/übereinander, Durchgangsports und eigene
  Stützpunkte unberührt), `line_outside`, `over_text`, Rand und Abstand.
- **Router:** Eine Leitung, deren kürzester Weg über einen Ortsnamen ginge, läuft daran vorbei.
  Die vorhandenen Routing-Tests und das Routing-Harness bleiben grün. Weichen Kennzahlen ab, wird
  das begründet, nicht weggeschrieben.
- **Befehle am echten Store:** wie `mcpLayout.test.ts`.
- **Ende-zu-Ende:** Kapelle über `/face/service/call` mit dem neuen Playbook-Ablauf.

## Boundaries

- **Always:**
  - Verbindungs-IDs bleiben.
  - Eigene Stützpunkte des Nutzers bleiben, außer er nennt die Verbindung.
  - Jeder Befehl ist ein Undo-Schritt.
- **Ask first:**
  - Switch-Ports neu zuordnen, also eine Verbindung auf einen anderen Port legen. Das ist eine
    fachliche Änderung.
  - Weitere Eingriffe in den Router über die Hindernisse hinaus.
- **Never:**
  - Durchgangsports (vorn/hinten) umdrehen.
  - Prüf-Befunde abschwächen, damit sie verschwinden.

## Success Criteria

- Kapelle (Ende-zu-Ende, Playbook-Ablauf): `line_outside` = 0 und `over_text` = 0, ohne
  Stützpunkte von Hand.
- Leitungen außerhalb der Orte und Kreuzungen werden gemessen und genannt. Ziel ist weniger als
  vorher (2432 px, 37 Paare bei gleicher Anordnung).
- Alle vorhandenen Tests grün; Routing-Harness ohne unbegründete Verschlechterung.

## Entscheidungen (21.11. abends, aus Jean-Lucs Chat „Medientechnik Kapelle“)

1. **Bereiche im Ort:** Stellen, an denen Geräte räumlich zusammen sitzen (Kamera mit Encoder, Bodentank,
   Decke, Sakristeiwand mit Beamer und Decoder, Rollwagen), sind Unterräume im Ort, nicht eigene Orte
   („Kapelle – Kamera“).
2. **Schrank-Kasten nach Signalfluss** (Jean-Luc: „1. 33“): Der Kasten bleibt mit der Rack-Ansicht
   verknüpft, die Geräte darin stehen nebeneinander nach Signalfluss. `place_device_in_rack` ordnet den
   Kasten so; die Höheneinheiten zeigt nur die Rack-Ansicht. Löst Entscheidung 2 aus schaltplan-layout
   („Kasten zeigt die HE-Reihenfolge“) ab. `dissolve_room` lehnt Schrank-Kästen ab.
3. **Kompakt anordnen (Task 34):** Eine Spalte aus Bereichen bricht ab 720 px um. Orte füllen Spalten in
   einem Band so hoch wie der höchste Ort; ein neues Band beginnt unter dem tatsächlichen Inhalt.
4. **Reihenfolge im Ablauf:** erst verbinden, dann ordnen, dann `choose_port_sides`. Das Ordnen sortiert
   nach Signalfluss, die Seitenwahl hängt von der endgültigen Lage ab.
5. **`route_connections` wartet, bis der Router fertig ist** (600 ms ohne neues Ergebnis). Vorher kam
   manchmal ein Zwischenstand zurück. `check_layout` meldete dann Leitungen außerhalb und durch Geräte,
   die es gar nicht gab, und dieselbe Kapelle ergab bei jedem Lauf etwas anderes.
6. **Rand höchstens einmal anheben** (96 / Abstand 160). Größere Ränder machen nur leere Fläche.
   Danach einzelne Leitungen mit `set_connection_path`. Dafür liefert `get_schematic` jetzt für jedes
   Gerät und jeden Raum das Rechteck auf der Zeichnung (`canvas`).
7. **Switch-Ports** bleiben, wie verbunden. Neu belegen nur auf Wunsch (noch offen bei Jean-Luc).

## Open Questions

1. Sollen Notizen wirklich Hindernisse sein? Annahme: ja. Wer eine Leitung bewusst über eine
   Notiz legt, setzt Stützpunkte.
