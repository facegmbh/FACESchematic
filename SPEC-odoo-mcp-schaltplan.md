# Spec: odoo-mcp-schaltplan

Modul aus `CAPABILITY-MAP.md` · hängt ab von cloud-bridge, odoo-drawings · Stand 2026-11-10
Umsetzung im Repo **`facegmbh/Odoo`**, Modul `custom_addons/face_mcp_server` (läuft in Odoo.sh).

## Objective

Der FACE-Odoo-Connector, den alle in claude.ai, Claude Desktop und am Handy schon verbunden
haben und den Jarvis (Chat, Telefon) mitbenutzt, bekommt Werkzeuge für FACESchematic. Damit
kann Claude im offenen Schaltplan des angemeldeten Nutzers arbeiten — ohne zweiten Connector,
ohne eigene Anmeldung, ohne Installation.

User Stories:
1. In claude.ai: „Öffne im Projekt Soccerbeat die Zeichnung Beschallung EG und häng zwei
   Deckenlautsprecher an die Endstufe.“ → Claude findet die Zeichnung, öffnet sie in meinem
   Tab, legt die Geräte an, verbindet sie und speichert auf Nachfrage.
2. Ist mein Tab nicht verbunden, sagt Claude in einem Satz, was ich einschalten muss.
3. Jarvis am Telefon kann dieselben Fragen beantworten („Welche Zeichnung habe ich offen?“).

## Werkzeuge (Python, `tools/schaltplan.py`, Muster wie `campaignred.py`)

Bewusst wenige, damit eine Odoo-Unterhaltung nicht 47 zusätzliche Werkzeuge sieht:

| Werkzeug | Zweck |
|---|---|
| `schaltplan_leitfaden` | Wie man mit dem Schaltplan arbeitet: Grundregeln, Befehlsliste mit Parametern, Playbooks (Schaltplan bauen, Rack, Chassis, Grundriss). Ohne `thema` das Inhaltsverzeichnis. Quelle: `GET /face/service/catalog` des Backends, kurz zwischengespeichert. |
| `schaltplan_status` | Ist ein Tab verbunden, welcher Schaltplan, welches Projekt/welche Zeichnung, bearbeite ich oder lese ich, ungespeicherte Änderungen. |
| `schaltplan_zeichnungen` | Zeichnungen an einem Projekt (Name/Nummer/Kunde), direkt aus Odoo (`ir.attachment` mit `.faceschematic.json`), mit den Odoo-Rechten des Nutzers. |
| `schaltplan_befehl` | `{ befehl, parameter }` — führt einen Befehl im verbundenen Tab aus (alle 47 aus dem Leitfaden plus `open_odoo_drawing`, `save_odoo_drawing`, `new_odoo_drawing`). |

- Aufruf ans Backend: `POST {face_schematic.url}/face/service/call` mit `Bearer {face_schematic.token}`
  und `uid = env.user.id` — Odoo setzt den Nutzer, nie das Modell.
- Systemparameter (Einstellungen → Technisch → Systemparameter, mit sudo gelesen):
  `face_schematic.url` (Standard `https://schematic.face-gmbh.com`), `face_schematic.token`.
  Fehlt das Token, bietet der Server die Werkzeuge nicht an.
- Rechte: alle internen Benutzer (Gruppe Benutzer). Schreiben passiert im Tab mit den Rechten,
  mit denen der Nutzer dort angemeldet ist; gespeichert wird nur, wenn Claude ausdrücklich
  `save_odoo_drawing` aufruft.
- Fehler als Sätze, die man auch am Telefon sagen kann (wie `_fehlertext` in campaignred.py).
- Leitfaden-Abschnitt „Schaltplan“ in `data/leitfaden.md`: wann welches Werkzeug, erst Leitfaden,
  dann Status, Geräte nur mit `search_templates`-IDs.

## Commands / Structure / Style

Wie das Repo `facegmbh/Odoo` (Python, Odoo 19, deutsche Docstrings mit dem „Warum“, Muster
`campaignred.py`/`symcon_wache.py`). Tests: `face_mcp_server/tests/test_schaltplan.py` mit
gemocktem HTTP-Aufruf. Auslieferung über Branch + Pull-Request; Odoo.sh baut Staging, Jean-Luc
übernimmt nach Produktion.

## Testing Strategy

- Odoo-Tests: Werkzeuge erscheinen nur mit gesetztem Token; `uid` im Aufruf ist der angemeldete
  Nutzer, auch wenn die Argumente etwas anderes behaupten; Backend-Fehler (409 kein Tab, 504,
  401, nicht erreichbar) werden zu klaren Sätzen; `schaltplan_zeichnungen` liefert nur
  `.faceschematic.json` an Projekten.
- Ende-zu-Ende nach Deploy (Jean-Luc): in claude.ai Status abfragen, eine Zeichnung öffnen
  lassen, ein Gerät anlegen lassen, speichern lassen.

## Boundaries

- Always: Nutzer aus `env.user`; Token nur aus Systemparametern; keine Zugangsdaten ans Modell.
- Ask first: weitere Werkzeuge außer den vier; Schreiben ohne ausdrücklichen Speicherbefehl.
- Never: Token im Repository; Befehle an Tabs anderer Nutzer.

## Success Criteria

1. In claude.ai mit dem bestehenden Odoo-Connector: „Welche Zeichnung habe ich offen?“ wird
   richtig beantwortet.
2. Claude kann eine Zeichnung aus Odoo öffnen, ein Gerät anlegen und verbinden, und speichern.
3. Ohne verbundenen Tab erklärt Claude in einem Satz, was zu tun ist.
4. Die bestehenden Odoo-Connector-Werkzeuge und -Tests sind unverändert.

## Open Questions

Keine.
