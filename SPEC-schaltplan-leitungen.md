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

- **Zeichnung:** das Rechteck um alle Orte (Räume oberster Ebene). Gibt es keine Räume, gilt das
  Rechteck um alle Geräte.
- **Text:** Ortsnamen (Beschriftung oben links im Raum, Schriftgröße `labelSize`, Standard 12 px)
  und Notizen (`note`-Knoten). Gerätetexte sind schon heute geschützt, weil Geräte Hindernisse
  sind. Stub-Beschriftungen haben eigene Regeln im Router und bleiben unverändert.

## Neue und geänderte Befehle

| Befehl | Zweck |
|---|---|
| `choose_port_sides` `{ connectionIds? }` | Bei zweiseitigen Ports (`-in`/`-out`) die Seite zum Gegenüber wählen. Liegt das Gegenüber rechts, rechts; liegt es links, links. Liegen beide übereinander, etwa im Rack, nehmen beide dieselbe Seite. Die Verbindung behält ihre ID (Kabelnummern hängen daran). Ein Undo-Schritt. Durchgangsports (`rear`/`front`) bleiben, ebenso Verbindungen mit eigenen Stützpunkten, außer sie sind ausdrücklich genannt |
| `check_layout` | Neue Befunde: `line_outside` (Leitung verlässt die Zeichnung, mit Länge) und `over_text` (Leitung über einem Ortsnamen oder einer Notiz) |
| `arrange_rooms` `{ order?, gap? }` | `gap`: Abstand zwischen den Orten in px (Raster, Standard 96, höchstens 480) |
| `arrange_room` / `fit_room` `{ …, margin? }` | `margin`: Rand im Ort für Leitungen (Standard 32, höchstens 160) |
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

## Open Questions

1. Sollen Notizen wirklich Hindernisse sein? Annahme: ja. Wer eine Leitung bewusst über eine
   Notiz legt, setzt Stützpunkte.
