# Implementation Plan: backend-deploy + face-identity + odoo-drawings + cloud-bridge + odoo-mcp-schaltplan + schaltplan-layout + odoo-device-library + device-template

Specs: `SPEC-backend-deploy.md`, `SPEC-face-identity.md`, `SPEC-odoo-drawings.md`, `SPEC-cloud-bridge.md`, `SPEC-odoo-mcp-schaltplan.md`, `SPEC-schaltplan-layout.md`, `SPEC-odoo-device-library.md`, `SPEC-device-template.md` · Karte: `CAPABILITY-MAP.md`

## Overview

Ein Backend-Container neben der App, erreichbar über den App-nginx unter `/face/`, und
darauf die Anmeldung mit Odoo-E-Mail + API-Schlüssel samt Knopf „Anmelden“ im Editor.
Zwei Freigaben: nach Phase 1 geht nur `/face/health` live, nach Phase 2 die Anmeldung.

## Architecture Decisions

- **Backend im Paket `mcp-server/`** (Einstieg `dist/cloud/server.js`): die späteren
  Module brauchen dessen Werkzeugliste und Playbooks; ein eigenes Paket hieße doppelt pflegen.
- **nginx löst `backend` erst zur Laufzeit auf** (`resolver 127.0.0.11` + Variable in
  `proxy_pass`). So läuft `nginx -t` schon beim Image-Bau ohne laufendes Backend — und ein
  kaputtes nginx.conf lässt den Build scheitern, statt die laufende App zu ersetzen.
- **Kein Port am Host** für das Backend; einziger Eingang bleibt der App-nginx.
- **Geheimnis aus dem Workflow:** `~/faceschematic/backend.env` wird einmalig erzeugt und
  vor jedem `docker compose up` als `.env` eingesetzt (Checkout wird bei jedem Lauf geleert).
- **Frontend-Schalter `VITE_FACE_BACKEND=1`** im Dockerfile; ohne ihn bleibt der
  Upstream-Knopf, damit Dev ohne Backend und der öffentliche Build unverändert bleiben.
- **Entwürfe für spätere Module** (Zeichnungen/Sperre, Relay, MCP) liegen außerhalb des
  Repos und kommen erst mit ihren eigenen Specs zurück.

## Task List

### Phase 1: backend-deploy
- [x] Task 1: Backend-Grundgerüst mit `/face/health`
- [x] Task 2: Container, Compose und nginx-Weiterleitung
- [x] Task 3: Deploy-Workflow mit Geheimnis und Healthcheck

### Checkpoint A (Freigabe durch Jean-Luc, dann Push auf master)
- [x] `npm test` (mcp-server), `npx vitest run`, `npx tsc -b`, `npm run build` grün
- [x] Nach Deploy: `https://schematic.face-gmbh.com/face/health` antwortet, App läuft wie vorher (20.10.)

### Phase 2: face-identity
- [x] Task 4: Anmelde-API gegen Odoo (Login, Me, Logout) mit Mock-Odoo-Tests
- [x] Task 5: Anmeldung im Editor (Client, Store, Dialog, Knopf, Texte)

### Checkpoint B (Freigabe, dann Push auf master)
- [x] Alle Tests und Build grün
- [x] Lokal Ende-zu-Ende: Backend gegen Mock-Odoo, Vite-Dev mit Proxy, Anmelden/Abmelden im Browser (Playwright)
- [x] Nach Deploy: Jean-Luc meldet sich mit echtem Odoo-Konto an (22.10.)

### Phase 3: odoo-drawings

Entscheidungen für diese Phase:
- **Zuordnung im Inhalt, nicht im Tab** (geändert 23.10. beim Bau von Task 8): Die
  Browser-Sicherung teilen sich alle Tabs — ein neu geladener Tab kann den Inhalt eines
  anderen Tabs wiederherstellen. Hinge die Zuordnung am Tab (`sessionStorage`), schriebe
  Strg+S dann fremden Inhalt in die Odoo-Zeichnung. Deshalb liegt `odooDrawing` im Store
  und reist mit der Sicherung, genau wie das vorhandene `cloudSchematicId`; Neu, Öffnen,
  Import und Datei-Übernahme setzen es zurück (dieselben Stellen). Nur die `tabId` (wem die
  Sperre gehört) liegt in `sessionStorage`.
- **„Geändert seit Speichern“** über einen Fingerabdruck von `exportToJSON()` beim Öffnen und
  Speichern, nur bei Bedarf berechnet (vor „Öffnen“) — die App kennt sonst keinen Dirty-Zustand.
- **Eigener kleiner Store** für den Odoo-Zustand (wie `useFaceSession`), damit `store.ts`
  (≈ 9000 Zeilen) nur die Strg+S-Weiche berührt.

- [x] Task 6: Backend — Projekte, Zeichnungsliste, Laden
- [x] Task 7: Backend — Anlegen, Speichern, Sperre, Zuschauer, Veraltet-Prüfung
- [x] Task 8: Frontend-Client — Odoo-Zustand, Herzschlag, Freigabe, Fingerabdruck
- [x] Task 9: „In Odoo speichern…“ und Strg+S-Weiche
- [x] Task 10: „Aus Odoo öffnen…“ mit Rückfrage bei Ungespeichertem
- [x] Task 11: Sperr-Leiste, Zuschauer-Anzeige, Rückfrage vor Überschreiben

- [x] Task 12: Review-Funde (Code-Review 23.10.) — späte Antwort verknüpft fremden Inhalt; Sperre nach Neuladen im Produktions-Build; Undo über das Öffnen hinweg; Tab-ID je Seitenaufruf und uid in der Sperre; Leser ohne Bearbeiter kann übernehmen; Backend prüft die Daten; CSRF-Test; Fehlercodes

### Checkpoint C (Freigabe, dann Push auf master)
- [x] Alle Tests und Build grün
- [x] Ende-zu-Ende mit zwei Nutzern (zwei Browser-Kontexte, Mock-Odoo): Speichern, Öffnen beim zweiten → Leiste, Zuschauer beim ersten, Freigabe nach Schließen
- [ ] Nach Deploy: Jean-Luc speichert an einem echten Projekt, sieht den Anhang in Odoo, öffnet von einem zweiten Gerät

### Phase 4: cloud-bridge

Entscheidungen für diese Phase (10.11.):
- **Werkzeugname = Befehlsname.** `schaltplan_befehl { befehl, parameter }` reicht `befehl`
  unverändert als `command` durch — wie der lokale Server heute (`index.ts` → `bridge.call(name, args)`).
  Der Katalog (`/face/service/catalog`) liefert `TOOLS`, `SERVER_INSTRUCTIONS` und `PROMPTS` aus
  `mcp-server/src/` — dieselbe Quelle wie der lokale Weg, nichts doppelt.
- **Ein Befehlsausführer, zwei Transporte.** Aus `BridgeController.onMessage` wird
  `runCommand(command, params)` herausgelöst; WebSocket (lokal) und Long-Polling (Odoo) rufen
  beide nur diese Funktion. Die 47 Handler bleiben unberührt.
- **Relay nur im Speicher** (ein Container, wie `Presence`). Startet das Backend neu, antwortet
  der Poll mit 409 `unbound` und der Tab meldet sich von selbst wieder an.
- **Der nächste Poll startet sofort nach der Antwort**, nicht per Timer — Chrome drosselt Timer
  in Hintergrund-Tabs, laufende Anfragen nicht. Nur nach Fehlern wird mit Pause neu versucht.
- **Odoo-Befehle sind vorsichtig:** `open_odoo_drawing`/`new_odoo_drawing` verweigern, wenn die
  offene Zeichnung ungespeicherte Änderungen hat (`discardChanges: true` nur, wenn der Nutzer es
  gesagt hat); `save_odoo_drawing` überschreibt einen inzwischen fremden Stand nur mit
  `force: true` und meldet sonst, wer gespeichert hat; fremde Sperre → klare Meldung, kein Speichern.
- **Modus als eigene Einstellung** `mcpBridgeMode: "odoo" | "local"` neben `mcpBridgeEnabled`
  (wie die vorhandenen `loadMcp…`-Werte in localStorage). Im FACE-Build Standard `"odoo"`,
  im Upstream-Build gibt es nur `"local"`.
- **Token zuerst live:** Checkpoint D bringt Relay, Dienst-Zugang und Token auf face-docker1,
  bevor der Tab etwas davon weiß. Ohne eingeschalteten Tab antwortet der Dienst nur „kein Tab“ —
  so kann Jean-Luc den Token schon in Odoo eintragen und Phase 5 parallel beginnen.

- [x] Task 13: Relay im Backend — Tab anmelden, Poll, Antwort, Ablösung, Verfall
- [x] Task 14: Dienst-Zugang — `/face/service/call` und `/face/service/catalog` mit Token
- [x] Task 15: Deploy — `FACE_SERVICE_TOKEN` einmalig erzeugen und durchreichen

### Checkpoint D (Freigabe, dann Push auf master)
- [ ] `npm test` (mcp-server), `npx vitest run`, `npx tsc -b`, `npm run build` grün
- [ ] Nach Deploy: `/face/service/catalog` ohne Token 401, mit Token 200; Jean-Luc trägt den Token in Odoo ein

- [x] Task 16: Long-Polling-Transport im Tab (`runCommand` gemeinsam für beide Wege)
- [x] Task 17: Einstellungen → KI mit zwei Wegen
- [x] Task 18: Vier Odoo-Befehle (`get_editor_status`, `open_odoo_drawing`, `save_odoo_drawing`, `new_odoo_drawing`)
- [x] Task 19: Ende-zu-Ende und Hilfeseite
- [x] Review-Funde (Code-Review 21.11.): Bremse zählt nur falsche Tokens; Grundriss/Rack zählt als ungespeichert; Prüfung direkt vor dem Ersetzen; Laden/Neuladen übernimmt nicht (eigener Odoo-Schalter, „Diesen Tab verbinden“, leises Nachfragen); Tab während Befehl verloren → „tab-lost“; 50 s statt 60 s; Header auch beim Poll; nach 401 Sitzung neu laden; `.env` 600
- [x] Anmeldesperre je E-Mail statt für alle (21.11., Wunsch Jean-Luc)

### Checkpoint E (Freigabe, dann Push auf master)
- [x] Alle Tests und Build grün; lokaler Weg (Claude Desktop) unverändert
- [x] Ende-zu-Ende (Playwright, Mock-Odoo, zwei Nutzer): `add_device` über `/face/service/call` erscheint im Tab des richtigen Nutzers, nie beim anderen (21.11., 19 Prüfungen; Hintergrund-Drosselung headless nicht prüfbar → bei der Abnahme)
- [ ] Nach Deploy: Jean-Luc schaltet den Tab ein; ein `get_editor_status` mit dem Token (curl von face-docker1) antwortet

### Phase 5: odoo-mcp-schaltplan (Repo `facegmbh/Odoo`, eigener Branch + Pull-Request)
- [x] Task 20: `tools/schaltplan.py` mit fünf Werkzeugen (+ `schaltplan_geraeteliste`), Tests mit gemocktem HTTP — facegmbh/Odoo#2, auf Wunsch direkt nach main (Prelive ging nicht), 21.11.
- [x] Task 21: Leitfaden-Abschnitt „Schaltplan“, Pull-Request (gemergt 21.11., Produktion 19.0.6.51.0)

### Checkpoint F (Jean-Luc merged nach Produktion)
- [x] In claude.ai: Zeichnung „Medientechnik Kapelle“ aus KALK-0003 am Projekt Kapelle Spelle, 17 Geräte, 19 Verbindungen (21.11.) — Aufbau schlecht → Phase 6

### Phase 6: schaltplan-layout (SPEC-schaltplan-layout.md)

Entscheidungen:
- **Erst messen, dann bauen:** Task 22 klärt als Spike, woher Gerätegrößen (`measured`) und
  verlegte Linien kommen und ob der Bild-Export im Hintergrund-Tab geht. Erst danach stehen die
  Befunde von `check_layout` fest.
- **Reine Funktionen** für Prüfen (`src/layoutCheck.ts`) und Anordnen (`src/layoutArrange.ts`),
  Handler nur als dünne Schicht: testbar ohne DOM, wie `alignUtils`.
- **Kapelle-Zeichnung vom 21.11. als Fixture** (aus `get_schematic` nachgebaut): Vorher-Befunde
  und Nachher-Ziel sind Tests.

- [x] Task 22: Spike + `check_layout` (Überlappung, Ragen, Raum/Raum, Raster; Linien durch Geräte, Kreuzungen, Umwege)
  Spike-Ergebnis (21.11.): Gerätegrößen stehen im Store (`measured`), verlegte Linien in
  `routedEdges` (Wegpunkte); headless routet `routingHarness/routeFixture`. `computeRoutingMetrics`
  zählt Kreuzungen/Umwege nur gesamt – `layoutCheck.ts` rechnet je Linie selbst (mit
  `extractSegments`/`segmentsCross`). Bild-Export im Hintergrund-Tab: offen bis Task 26.
  Kapelle-Fixture (Größen im Browser gemessen) meldet: 3 Überlappungen, Switch ragt heraus, Linie
  durch Control Server, 4 Umwege, 22 Kreuzungen, 17 Geräte neben dem Raster.
- [x] Task 23: Verschachtelte Orte und Racks — `create_room` mit `parentRoomId`, `add_rack_to_room` (Kasten + Rack-Ansicht), `place_device_in_rack` setzt in beide (Undo von `add_rack_to_room` noch mehrstufig)
- [x] Task 24: `arrange_room` (Signalfluss, Raster, Racks als Block) und `fit_room`

### Checkpoint G1 (Zwischenstand zeigen, kein Push)
- [x] Kapelle-Fixture: je Raum nach `arrange_room` keine `overlap`/`outside` (Test)
- [x] Kapelle örtlich mit den neuen Befehlen in der laufenden App aufgebaut (21.11.): keine Überlappung,
  nichts ragt heraus, Schrank in HE-Reihenfolge, Technik in der Mitte. Dabei gefunden und behoben:
  Gerät in keinem Raum wurde nicht gemeldet (`no_room`), großes Gerät passte nicht in kleinen Raum
  (Raum wächst jetzt), Rack anlegen schaltete die Ansicht weg, Kasten-Reihenfolge verkehrt,
  Rack-interne Leitungen galten als Umweg, Orte ohne Reihenfolge ungünstig (Mittelpunkt-Regel).
  Lücke für bestehende Zeichnungen: kein Befehl, um Räume umzubenennen oder aufzulösen

- [x] Task 25: `arrange_rooms` und `route_connections`
- [x] Task 25a: `rename_room` und `dissolve_room` — bestehende Gewerke-Räume in Orte umbauen (G1-Lücke)
- [x] Task 26: `render_schematic` (PNG) — und im Odoo-Connector als Bild durchreichen (Sichtprüfung in claude.ai bei Checkpoint G)
- [x] Task 27: Playbook „build-schematic“ + Odoo-Leitfaden (Orte, Racks, prüfen, Bild), Ende-zu-Ende über `/face/service/call` (Kreuzungen offen, siehe todo)

### Checkpoint G (Freigabe, Push auf master; Odoo-Teil direkt auf main)
- [ ] Alle Tests und Build grün; Ende-zu-Ende: Kapelle neu ordnen, `check_layout` leer, Bild kommt an
- [ ] In claude.ai: „Mach aus KALK-0003 eine Zeichnung“ gliedert örtlich mit Rack und Rack-Ansicht

### Phase 7: schaltplan-leitungen (SPEC-schaltplan-leitungen.md)
Ausgangsmessung Kapelle (G-Anordnung): 2432 px Leitung außerhalb der Orte, 5 Abschnitte über
Ortsnamen, 37 Kreuzungspaare; mit Seitenwahl 672 px / 3 / 48.
- [x] Task 28: `choose_port_sides` — zweiseitige Ports zum Gegenüber (reine Funktion + Befehl, ein Undo-Schritt)
- [x] Task 29: Router — Ortsnamen und Notizen als Hindernisse (`buildObstacles`), Routing-Tests/Harness grün
- [x] Task 30: `check_layout` meldet `line_outside` und `over_text`; `gap` für `arrange_rooms`, `margin` für `arrange_room`/`fit_room`
- [x] Task 31: `set_connection_path` — Claude legt eine Leitung selbst (Stützpunkte, Raster, Undo)

### Checkpoint H1 (Zwischenstand zeigen, kein Push)
- [x] Kapelle mit neuem Ablauf, nur über Claudes Befehle (21.11., App im Browser, Bild `scratchpad/kapelle/h1.png`):
  alter Ablauf 7 Leitungen / 4048 px außerhalb, 57 Kreuzungspaare, 1 Umweg → `choose_port_sides` (7 gedreht):
  3 / 1392 px, 48 Paare → eine Runde `margin` 80 für die drei genannten Orte + `gap` 128: **0 außerhalb,
  0 über Text**, 46 Paare, kein Umweg

- [x] Task 32: Playbook + Odoo-Leitfaden mit Jean-Lucs Wünschen (Bereiche, Schrank nebeneinander, Reihenfolge,
  Bild ansehen, Switch-Ports nur auf Wunsch); Kapelle nach Leitfaden im Browser: 0 außerhalb, 0 über Text,
  20 Kreuzungspaare, kein Umweg, zweimal gleich (`scratchpad/kapelle/leitfaden.png`)
- [x] Task 33: Schrank-Kasten nach Signalfluss (verknüpft), `dissolve_room` lehnt Schrank-Kästen ab
- [x] Task 34: kompakt anordnen (Bereichs-Spalten umbrechen, Orte in Bändern), `route_connections` wartet auf
  den fertigen Router, `get_schematic` mit `canvas`-Rechtecken

### Checkpoint H (Freigabe, Push)
- [x] Kapelle Ende-zu-Ende über den Dienst: `line_outside` = 0, `over_text` = 0; alle Tests grün (2166 + 95), routing:check 13/13

### Phase 8: schaltplan-rahmen (SPEC-schaltplan-rahmen.md)
Ausgangsmessung Jean-Lucs Kapelle (Odoo, 22.11.): 7 Leitungen auf Rahmen, 3 durch fremde Rahmen.
- [x] Task 35: Router — Rahmenfelder kosten (`FRAME_COST` 40), Felder außerhalb der Zeichnung kosten
  (`OUTSIDE_COST` 4), Spaltenverteiler meidet Rahmen und fremde Räume; für alle Zeichnungen
- [x] Task 36: `check_layout` meldet `on_frame` und `through_room`
- [x] Task 37: `straighten_lines` — Geräte leicht verschieben für gerade Leitungen
- [x] Task 38: Playbook, Leitfaden, Ende-zu-Ende über den Dienst

### Checkpoint I (Freigabe, Push)
- [ ] Jean-Luc gibt frei; FACESchematic master, Odoo main

### Phase 9: odoo-device-library (SPEC-odoo-device-library.md, Plan 27.11.)

Entscheidungen beim Planen:
- **Zwei Prüfstufen in einer Datei** `src/mcp/templateValidation.ts`, die nur `protocol.ts`
  importiert und von `sync-protocol` ins Backend kopiert wird:
  - `checkStoredTemplate` ist locker. Sie prüft Form, Größe und bekannte Listen und nimmt jede
    gültige Vorlage aus dem Editor an, auch mit Slots und `passthrough`.
  - `parseTemplateInput` ist streng und gilt für Claude (Phase 10).
- **Erlaubte Werte als Konstanten in `protocol.ts`:** Signaltypen, Stecker und Gerätetypen. Ein
  App-Test vergleicht sie mit `DEFAULT_SIGNAL_COLORS`, `CONNECTOR_TO_CABLE` und
  `DEVICE_TYPE_TO_CATEGORY`, damit keine Liste unbemerkt abweicht. Die App-Module selbst kann das
  Backend nicht importieren.
- **Schreiben sofort, Rückweg bei Fehler:** Die Store-Aktionen bleiben synchron und rufen eine
  Senke, die `centralLibrary.ts` beim Start anmeldet (der Store importiert `centralLibrary` nicht, sonst
  gäbe es einen Kreis). Schlägt Odoo fehl, nimmt die Senke die Änderung zurück und zeigt den
  Fehler.
- **Angemeldet, aber Backend nicht erreichbar:** Zentrale Vorlagen lassen sich dann nicht ändern.
  Die Änderung wird zurückgenommen. Neue Geräte entstehen lokal und lassen sich später hochladen.
- **Odoo-Arbeit in einem Worktree von `origin/main`** (`~/dev/Odoo-main-wt`), nicht im alten
  `prelive`-Checkout. Odoo-Tests laufen nur auf Odoo.sh.

- [x] Task 39: Gemeinsame Vorlagen-Prüfung (`checkStoredTemplate`, Werte-Listen, sync)
- [x] Task 40: Odoo-Modul `face_schematic_library` (Modell, Rechte, Ansichten, Chatter, Tests) — Branch `feat/schematic-library` gepusht, Odoo.sh-Tests stehen aus
- [x] Task 41: Backend `/face/api/library` mit Mock-Odoo-Tests

### Checkpoint J1 (Zwischenstand, Odoo-Modul installiert)
- [ ] `cd mcp-server && npm test`, `npx vitest run`, `npx tsc -b` grün
- [ ] Odoo-Modul auf main, Odoo.sh-Build grün, Jean-Luc installiert es in Produktion
- [x] Freigabe für Push der Backend-Routen (Editor nutzt sie noch nicht) — gepusht 27.11. (52afb07)

- [x] Task 42: Editor lädt die zentrale Bibliothek (`centralLibrary.ts`, `libraryMeta`, Kennzeichen „nur in diesem Browser“)
- [x] Task 43: Editor schreibt zentral (Senke in den Store-Aktionen, Rückweg, Versionskonflikt)
- [ ] Task 44: Hochladen der Browser-Geräte und eingebettete Vorlagen beim Laden einer Zeichnung
- [ ] Task 45: Odoo-Artikel im Geräte-Editor und Handbuch-Absatz

### Checkpoint J (Freigabe, Push)
- [ ] Alle Tests und Build grün
- [ ] Jean-Luc: zwei Browser, anlegen und sehen; ändern und Drift; hochladen; Artikel verknüpfen; Chatter in Odoo
- [ ] Freigabe, FACESchematic master

### Phase 10: device-template (SPEC-device-template.md)
- [ ] Task 46: Strenge Eingabeprüfung `parseTemplateInput` und Port-Abgleich
- [ ] Task 47: Befehle `get_device_template`, `create_device_template`, `update_device_template`
- [ ] Task 48: Leitfaden, Handbuch, Ende-zu-Ende über den Dienst

### Checkpoint K (Freigabe, Push)
- [ ] Alle Tests grün; über `/face/service/call` angelegt, gesetzt, verbunden, geändert
- [ ] Jean-Luc in claude.ai: fehlende Endstufe anlegen, Melderreichweite nachtragen, Artikel verknüpfen
- [ ] Freigabe, FACESchematic master (Odoo unverändert)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Kaputtes nginx.conf ersetzt die laufende App | Hoch | `nginx -t` im Image-Build; Laufzeit-Auflösung von `backend` |
| Kein Docker lokal, Container erst auf face-docker1 testbar | Mittel | Backend lokal per Node getestet; Healthcheck im Workflow durch den App-nginx |
| Workflow-Checkout löscht `.env` | Mittel | Geheimnis außerhalb des Checkouts, vor `compose up` kopiert |
| Odoo sperrt die IP nach Fehlversuchen (Fail2Ban) | Hoch | Rate-Limit je IP; 5 min Pause je E-Mail nach abgelehnter Anmeldung, 5 min für alle erst nach 3 Ablehnungen in 15 min (21.11.) |
| `/web/database/list` auf Odoo.sh abgeschaltet | Niedrig | `ODOO_DB` setzbar; face-odoo-mcp nutzt dieselbe Ermittlung erfolgreich |
| Große Zeichnungen (PDF-Unterlage) sprengen Odoo-Upload-Grenze | Mittel | 64 MB-Grenze in nginx; Fehlermeldung von Odoo durchreichen; beim Abnahme-Test eine Zeichnung mit Unterlage speichern |
| Zuordnung bleibt nach „Neu“/„Datei öffnen“ hängen → Strg+S überschreibt die falsche Odoo-Zeichnung | Hoch | Zuordnung endet bei jedem fremden Laden (loadSeq), Test dafür in Task 8 |
| Sperre verfällt bei Funkloch, ein anderer speichert dazwischen | Mittel | Veraltet-Prüfung über `write_date` (Task 7/11) |
| Nginx Proxy Manager beendet lange Anfragen | Mittel | Poll wartet höchstens 25 s (NPM-Standard 60 s, App-nginx 90 s); Dienst-Aufruf 60 s → Odoo-Seite wartet 65 s |
| Hintergrund-Tab wird gedrosselt und fällt nach 40 s aus der Bindung | Mittel | Nächster Poll direkt nach der Antwort statt per Timer; Ende-zu-Ende mit verstecktem Tab prüfen |
| Claude überschreibt Ungespeichertes oder einen fremden Stand | Hoch | Odoo-Befehle verweigern ohne `discardChanges`/`force`; Leitfaden sagt: nur auf ausdrücklichen Wunsch |
| Befehl landet beim falschen Nutzer | Hoch | uid nur aus dem Token-geschützten Dienst-Aufruf, Bindung je uid aus der Sitzung; Test mit zwei Nutzern in Backend und Ende-zu-Ende |
| Token-Leck | Hoch | Nur in `backend.env` (umask 077) und Odoo-Systemparameter; zeitkonstanter Vergleich; nie im Browser oder Repo |
| Gerätegrößen nur im DOM gemessen, Linienverläufe nur in der Ansicht berechnet | Hoch | Task 22 als Spike zuerst; notfalls Größen aus Ports schätzen wie der Editor beim Einfügen |
| Bild-Export braucht sichtbaren Tab | Mittel | Spike in Task 22; sonst Export aus dem Datenmodell (SVG) statt DOM |
| Auto-Anordnen zerstört eine von Hand geordnete Zeichnung | Mittel | Undo; Leitfaden: nur auf Wunsch bei bestehenden Zeichnungen |
| Odoo-Tests laufen nur auf Odoo.sh | Mittel | Modul klein halten und früh bauen (Task 40 vor dem Editor); Backend-Tests mit Mock-Odoo decken die Aufrufe ab |
| Werte-Listen in `protocol.ts` laufen der App davon | Mittel | Gleichheitstest gegen die App-Tabellen (Task 39) |
| Sechs Schreibwege im Editor, einer wird vergessen | Hoch | Senke sitzt in den Store-Aktionen, nicht in den Komponenten; je Aktion ein Test (Task 43) |
| Zwei Leute ändern dieselbe Vorlage | Mittel | Version mit 409 und Name des anderen; Editor lädt neu und zeigt den Hinweis |
| Zentrale Vorlage überschreibt eine lokale Änderung beim Laden | Mittel | Höhere Version gewinnt; lokale Änderungen an zentralen Vorlagen gibt es nur über Odoo |
| Claude ändert eine Vorlage, die viele Zeichnungen nutzen | Mittel | Geräte in Zeichnungen ändern sich nie selbst (Drift); Leitfaden: vorher nennen; Chatter zeigt die Änderung |
| Fremde OneDrive-Ausführbar-Bits und parallele Sitzungen | Mittel | Nur eigene Dateien stagen, nie `git add -A` |

## Open Questions

Keine.
