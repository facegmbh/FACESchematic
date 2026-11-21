# Implementation Plan: backend-deploy + face-identity + odoo-drawings + cloud-bridge + odoo-mcp-schaltplan + schaltplan-layout

Specs: `SPEC-backend-deploy.md`, `SPEC-face-identity.md`, `SPEC-odoo-drawings.md`, `SPEC-cloud-bridge.md`, `SPEC-odoo-mcp-schaltplan.md`, `SPEC-schaltplan-layout.md` · Karte: `CAPABILITY-MAP.md`

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
- [ ] Task 23: Verschachtelte Orte und Racks — `create_room` mit `parentRoomId`, `add_rack_to_room` (Kasten + Rack-Ansicht), `place_device_in_rack` setzt in beide
- [ ] Task 24: `arrange_room` (Signalfluss, Raster, Racks als Block) und `fit_room`

### Checkpoint G1 (Zwischenstand zeigen, kein Push)
- [ ] Kapelle-Fixture: nach Ordnen keine `overlap`/`outside`; Screenshot an Jean-Luc

- [ ] Task 25: `arrange_rooms` und `route_connections`
- [ ] Task 26: `render_schematic` (PNG) — und im Odoo-Connector als Bild durchreichen
- [ ] Task 27: Playbook „build-schematic“ + Odoo-Leitfaden (Orte, Racks, prüfen, Bild), Ende-zu-Ende über `/face/service/call`

### Checkpoint G (Freigabe, Push auf master; Odoo-Teil direkt auf main)
- [ ] Alle Tests und Build grün; Ende-zu-Ende: Kapelle neu ordnen, `check_layout` leer, Bild kommt an
- [ ] In claude.ai: „Mach aus KALK-0003 eine Zeichnung“ gliedert örtlich mit Rack und Rack-Ansicht

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

## Open Questions

Keine.
