# Spec: schaltplan-layout

Modul aus `CAPABILITY-MAP.md` · hängt ab von cloud-bridge · Stand 2026-11-21

## Objective

Claude soll Schaltpläne so aufbauen, wie FACE sie zeichnet, und das Ergebnis selbst prüfen können.
Auslöser: erster Durchlauf aus KALK-0003 („Medientechnik Kapelle“, 21.11.). Claude legte die
Kalkulationsbereiche als Räume an (Mikrofone, Beschallung, Netzwerk …), alle 500 × 400. Der
Switch ragte in den Nachbarraum, Geräte lagen übereinander, und Leitungen liefen um die ganze
Zeichnung. Claude hat davon nichts gemerkt: Es bekommt nur Zahlen zurück, kein Bild und keine
Prüfung.

Jean-Luc: „Ich möchte das immer eher örtlich sortiert und nach Räumen, und darin dann Racks.“ –
„Es überlappt auch viel.“ – „Der MCP muss sehen, dass die Linien sauber geführt sind, und sie
anpassen können. Klare Strukturen.“

User Stories:
1. Claude gliedert nach **Orten** (Kapelle, Sakristei, Technikraum, Kirche …). Im Ort steht ein
   **Rack/Wandschrank** als eigener Kasten, darin die 19″-Geräte. Kennt Claude die Orte nicht,
   fragt es.
2. Nach dem Aufbau prüft Claude selbst. Überlappende Geräte, Geräte, die aus ihrem Raum ragen,
   sich überschneidende Räume, Leitungen durch Geräte, Kreuzungen und Umwege werden gemeldet,
   mit den betroffenen IDs.
3. Claude kann es beheben. Geräte in einem Raum nach Signalfluss ordnen (Quellen links, Senken
   rechts, auf dem Raster), Räume an ihren Inhalt anpassen, Räume ohne Überlappung anordnen,
   Leitungen neu verlegen.
4. Claude **sieht** die Zeichnung als Bild, ganz oder nur einen Raum, und zeigt es mir in
   claude.ai.

## Neue Befehle (Tab, `src/mcpBridge.ts`; Katalog `mcp-server/src/tools.ts`)

| Befehl | Zweck |
|---|---|
| `create_room` + `parentRoomId` | Ort anlegen, auch verschachtelt |
| `add_rack_to_room` `{ roomId, name, heightU, rackType? }` | Rack/Schrank als Kasten im Ort **und** Rack-Ansicht (HE-Belegung), verknüpft; `place_device_in_rack` setzt das Gerät dann in beide |
| `check_layout` `{ roomId? }` | Befunde: `overlap` (Gerät/Gerät, Raum/Raum ohne Verschachtelung), `outside` (Gerät ragt aus dem Raum), `crosses_device` (Leitung durch ein Gerät), `crossings` (Anzahl je Leitung), `detour` (Leitung > 2 × kürzester Weg), `off_grid`; je Befund IDs und ein Satz zur Abhilfe. Leer = sauber |
| `arrange_room` `{ roomId, flow?: "left-right" }` | Geräte eines Raums in Spalten nach Signalfluss setzen (Abstand nach Raster, keine Überlappung), Unterräume (Racks) als Block; danach `fit_room` |
| `fit_room` `{ roomId, padding? }` | Raum an Inhalt anpassen (wachsen und schrumpfen), Eltern-Räume mit |
| `arrange_rooms` `{ order?: roomId[] }` | Räume oberster Ebene ohne Überlappung anordnen (Zeilen, Abstand), in der gegebenen Reihenfolge |
| `route_connections` `{ connectionIds? }` | Leitungen mit dem Auto-Routing des Editors neu verlegen (alle oder Auswahl); eigene Wegpunkte gehen dabei verloren, deshalb nur auf Wunsch für bereits von Hand gelegte |
| `rename_room` `{ roomId, label }` | Raum umbenennen, z. B. Gewerk-Raum „Netzwerk“ → Ort „Technik“; nichts bewegt sich |
| `dissolve_room` `{ roomId }` | Rahmen entfernen, Inhalt bleibt an seinem Platz (mit Leitungen) und rutscht in den umgebenden Raum oder auf die oberste Ebene; ein Undo-Schritt; gesperrte Räume nicht; verknüpfte Rack-Ansicht bleibt |
| `render_schematic` `{ roomId?, maxWidth? }` | PNG der Zeichnung (oder eines Raums) als `{ image: { mimeType, data } }` |

Alle schreibenden Befehle laufen über vorhandene Store-Aktionen (Undo, Autosave). Was der
Editor schon kann (Ausrichten, Auto-Routing, verschachtelte Räume), wird angebunden, nicht neu
gebaut.

## Odoo-Seite (`facegmbh/Odoo`, kleine Folgeänderung)

- `schaltplan_befehl` gibt ein Ergebnis mit `image` als Bild weiter (`registry.text_und_bild`),
  damit claude.ai es anzeigt.
- Leitfaden „Schaltplan“ und `schaltplan_geraeteliste` → `naechster_schritt`:
  - Räume sind Orte, nicht Kalkulationsbereiche.
  - Racks und Schränke aus der Liste (z. B. DIGITUS-Wandgehäuse) werden Rack-Unterräume, die
    19″-Geräte kommen hinein.
  - Nach dem Aufbau `check_layout`, Befunde beheben, `render_schematic` zeigen.

## Playbook (`mcp-server/src/prompts.ts`, „build-schematic“)

Orte klären → Orte und Racks anlegen → Geräte hinein → `arrange_room` je Raum →
`arrange_rooms` → verbinden → `route_connections` → `check_layout` bis leer (höchstens drei
Runden, Rest dem Nutzer nennen) → `render_schematic`.

## Commands / Structure / Style

Wie `SPEC-cloud-bridge.md`.
- **Neue reine Funktionen** in `src/layoutCheck.ts` (Befunde) und `src/layoutArrange.ts`
  (Spalten nach Signalfluss, Raumgröße). Das Bild kommt über den vorhandenen PNG-Export.
- **Geändert:** `src/mcp/protocol.ts`, `src/mcpBridge.ts`, `mcp-server/src/tools.ts`,
  `prompts.ts`.

## Testing Strategy

- **Vitest, reine Funktionen:** Überlappung, Ragen aus dem Raum, Leitung durch Gerät,
  Kreuzungen, Umweg. Anordnen erzeugt keine Überlappung und hält Quellen links von Senken.
  `fit_room` umschließt alle Kinder.
- **Fixture:** Die Kapelle-Zeichnung vom 21.11. dient als Fixture.
  - Vorher meldet `check_layout` den Switch (`outside`) und RX1/PureLink (`overlap`).
  - Nach `arrange_room`, `fit_room`, `arrange_rooms` und `route_connections` meldet es keine
    `overlap` und kein `outside` mehr.
- **Handler-Tests:** `create_room` mit `parentRoomId` verschachtelt. `render_schematic`
  liefert ein PNG.
- **Ende-zu-Ende:** über `/face/service/call` die Kapelle neu ordnen, Bild abrufen.

## Boundaries

- **Always:** Undo für jeden Befehl. `check_layout` ändert nichts. Eigene Wegpunkte des
  Nutzers nur nach Rückfrage überschreiben.
- **Ask first:** automatisches Umbauen einer Zeichnung, die der Nutzer schon von Hand
  geordnet hat.
- **Never:** Geräte löschen oder Verbindungen ändern, um ein Layout „sauber“ zu bekommen.

## Success Criteria

1. Die Kapelle-Zeichnung lässt sich per Befehl in eine örtliche Gliederung mit Rack bringen.
   Danach meldet `check_layout` keine Überlappung und nichts, was aus seinem Raum ragt.
2. Claude zeigt in claude.ai ein Bild der Zeichnung.
3. Ein neuer Durchlauf „Zeichnung aus KALK-0003“ gliedert örtlich, ohne dass man es sagen
   muss.

## Entscheidungen (21.11.)

1. Orte für das Kapelle-Fixture: Kapelle (Altar/Ambo), Sakristei, Technik (Wandschrank), Kirche
   (Kamera/TX2), Haus-TV. Im Betrieb fragt Claude oder kennt sie aus dem Chat.
2. Rack: Zum Rack-Kasten auf dem Schaltplan legt Claude **immer auch die Rack-Ansicht** an
   (Seite mit HE-Belegung). Neuer Befehl `add_rack_to_room` legt beides verknüpft an.
   Ein Gerät, das in die Rack-Ansicht gesetzt wird, landet auch im Rack-Kasten des
   Schaltplans.
3. Bestehende Zeichnungen mit Gewerke-Räumen umbauen: `rename_room` und `dissolve_room` gehören
   in diese Phase (Jean-Luc, 21.11.).

## Open Questions

Keine.
