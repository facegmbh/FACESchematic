# Tasks: backend-deploy + face-identity + odoo-drawings + cloud-bridge + odoo-mcp-schaltplan + schaltplan-layout

## Task 1: Backend-Grundgerüst mit `/face/health`

**Description:** Express-Server im Paket `mcp-server` (Einstieg `src/cloud/server.ts`), liest
die Konfiguration aus der Umgebung und bricht bei fehlendem oder zu kurzem `FACE_SECRET` mit
klarer Meldung ab. `npm test` läuft künftig auch die Tests unter `dist/cloud/`.

**Acceptance criteria:**
- [ ] `GET /face/health` → `200 {"status":"ok","version":…}`
- [ ] Ohne `FACE_SECRET` (oder < 32 Zeichen) endet der Prozess mit Exit-Code ≠ 0 und Meldung
- [ ] Die bestehenden Tests des lokalen MCP-Servers laufen weiter

**Verification:**
- [ ] `cd mcp-server && npm test`
- [ ] `node mcp-server/dist/cloud/server.js` lokal, `curl localhost:8787/face/health`

**Dependencies:** None

**Files likely touched:** `mcp-server/package.json`, `mcp-server/src/cloud/config.ts`,
`mcp-server/src/cloud/server.ts`, `mcp-server/src/cloud/server.test.ts`

**Estimated scope:** Small–Medium

## Task 2: Container, Compose und nginx-Weiterleitung

**Description:** Image `mcp-server/Dockerfile.cloud`; Dienst `backend` in `compose.yml` mit
Volume `/data`, ohne Host-Port; App-nginx leitet `^~ /face/` an `backend:8787` weiter
(Laufzeit-Auflösung, `client_max_body_size 64m`, Timeouts ≥ 60 s); `nginx -t` im
App-Image-Build; Vite-Dev-Proxy für `/face`.

**Acceptance criteria:**
- [ ] `/api/**`-Regeln und CSP unverändert
- [ ] App-Image-Build führt `nginx -t` aus
- [ ] `npm run dev` leitet `/face/**` an `localhost:8787`

**Verification:**
- [ ] `npm run build` und `npx tsc -b` grün
- [ ] Review des Diffs von `docker/nginx.conf` und `compose.yml` (Docker lokal nicht verfügbar)

**Dependencies:** Task 1

**Files likely touched:** `mcp-server/Dockerfile.cloud`, `compose.yml`, `docker/nginx.conf`,
`Dockerfile`, `vite.config.ts`

**Estimated scope:** Medium

## Task 3: Deploy-Workflow mit Geheimnis und Healthcheck

**Description:** Vor `docker compose up`: `~/faceschematic/backend.env` anlegen, falls
fehlend (`FACE_SECRET=$(openssl rand -base64 48)`, Rechte 600), und als `.env` in den
Checkout kopieren. Healthcheck prüft zusätzlich `http://localhost:8080/face/health`.

**Acceptance criteria:**
- [ ] Existierende `backend.env` wird nie überschrieben
- [ ] Healthcheck schlägt fehl, wenn das Backend nicht antwortet

**Verification:**
- [ ] Shell-Schritte lokal in einem Temp-Verzeichnis durchgespielt (zweimal: Anlage, dann unverändert)

**Dependencies:** Task 2

**Files likely touched:** `.github/workflows/deploy.yml`

**Estimated scope:** XS

## Checkpoint A — Freigabe, Push, `/face/health` von außen

## Task 4: Anmelde-API gegen Odoo

**Description:** `odoo.ts` (Client mit Fail2Ban-Schutz), `store.ts` (verschlüsselte
Schlüssel, gehashte Sitzungen), `auth.ts` mit `POST /face/api/login`, `GET /face/api/me`,
`POST /face/api/logout`; Cookie `face_session`; `X-FACE-Request`-Pflicht; Rate-Limit.

**Acceptance criteria:**
- [ ] Gültige Daten → Cookie + `/me` liefert Name; falsche → 401 deutsch + 5 min Pause
- [ ] 11. Versuch in 15 min → 429; ohne `X-FACE-Request` → 403
- [ ] Logout macht die Sitzung ungültig; `store.json` ohne Klartext-Schlüssel/-Sitzung

**Verification:**
- [ ] `cd mcp-server && npm test` (Mock-Odoo im Test)

**Dependencies:** Task 1

**Files likely touched:** `mcp-server/src/cloud/{odoo,store,auth,server}.ts`,
`mcp-server/src/cloud/auth.test.ts`

**Estimated scope:** Medium

## Task 5: Anmeldung im Editor

**Description:** `src/faceBackend.ts` (fetch-Client), `faceUser` im Store, Dialog
`FaceLoginDialog`, `UserMenuButton` wählt bei `VITE_FACE_BACKEND=1` die FACE-Anmeldung;
deutsche Texte; Flag im `Dockerfile`.

**Acceptance criteria:**
- [ ] Mit Flag: „Anmelden“ → Dialog → Name oben rechts → „Abmelden“
- [ ] Ohne Flag: Upstream-Verhalten unverändert
- [ ] 401 vom Backend zeigt den Nutzer als abgemeldet

**Verification:**
- [ ] `npx vitest run`, `npx tsc -b`, `npm run i18n:check`
- [ ] Playwright gegen Vite-Dev + Backend + Mock-Odoo: Anmelden, Neuladen, Abmelden

**Dependencies:** Task 4

**Files likely touched:** `src/faceBackend.ts`, `src/components/FaceLoginDialog.tsx`,
`src/components/UserMenuButton.tsx`, `src/i18n/de/settings.ts`, `Dockerfile`

**Estimated scope:** Medium

## Checkpoint B — Freigabe, Push, Anmeldung mit echtem Odoo-Konto

## Task 6: Backend — Projekte, Zeichnungsliste, Laden

**Description:** `requireUser` und Odoo-Client je Nutzer in `auth.ts`; `drawings.ts` mit
`GET /face/api/projects?q=`, `GET /projects/:id/drawings`, `GET /drawings/:id`; Mock-Odoo
kennt `project.project` und `ir.attachment` und einen zweiten Nutzer.

**Acceptance criteria:**
- [ ] Ohne Sitzung 401; Projektsuche nach Projekt- und Kundenname
- [ ] Liste zeigt nur `.faceschematic.json`-Anhänge des Projekts, mit „zuletzt gespeichert von/am“
- [ ] Ein fremder Anhang (anderes Modell oder andere Endung) wird nicht geladen (404)

**Verification:** `cd mcp-server && npm test`

**Dependencies:** Task 4 · **Files:** `auth.ts`, `drawings.ts`, `drawings.test.ts`, `mockOdoo.ts`, `server.ts` · **Scope:** M

## Task 7: Backend — Anlegen, Speichern, Sperre, Zuschauer, Veraltet-Prüfung

**Description:** `POST /projects/:id/drawings`, `PUT /drawings/:id`, `POST /drawings/:id/lock|view|unlock`;
Sperrtabelle mit Herzschlag/90 s-Verfall; Zuschauerliste; `baseWriteDate`/`force`.

**Acceptance criteria:**
- [ ] Anlegen setzt Sperre für den Tab; zweiter Nutzer → 409 mit Name; eigener Tab mit `takeOver` übernimmt
- [ ] Speichern ohne Sperre → 409 `locked`; mit veraltetem `baseWriteDate` → 409 `stale`, mit `force` → 200
- [ ] Zuschauer erscheinen in `viewers`, nach 90 s ohne Herzschlag nicht mehr

**Verification:** `cd mcp-server && npm test` (Uhr im Test steuerbar)

**Dependencies:** Task 6 · **Files:** `drawings.ts`, `locks.ts`, `drawings.test.ts`, `mockOdoo.ts` · **Scope:** M

## Checkpoint — Backend vollständig, Tests grün

## Task 8: Frontend-Client — Odoo-Zustand, Herzschlag, Freigabe, Fingerabdruck

**Description:** `odooDrawing` (Projekt, Zeichnung, `baseWriteDate`) im App-Store neben
`cloudSchematicId` — mit der Sicherung gespeichert, bei Neu/Öffnen/Import/Datei
zurückgesetzt. `src/faceDrawings.ts`: API-Aufrufe, kleiner Store `useOdooPresence` (Rolle
editor/viewer, Inhaber, Zuschauer, Fingerabdruck), `tabId` in sessionStorage, Herzschlag alle
30 s, Freigabe per `fetch(keepalive)` bei `pagehide`.

**Acceptance criteria:**
- [ ] Öffnen/Anlegen setzt den Zustand und startet den Herzschlag; Freigabe beim Verlassen
- [ ] Ein anderes Laden (Neu/Datei/Import) beendet die Zuordnung
- [ ] `isChangedSinceSave()` stimmt nach Öffnen (nein), Bearbeiten (ja), Speichern (nein)

**Verification:** `npx vitest run src/__tests__/faceDrawings.test.ts`, `npx tsc -b`

**Dependencies:** Task 7 · **Files:** `src/store.ts`, `src/faceDrawings.ts`, `src/__tests__/faceDrawings.test.ts` · **Scope:** M

## Task 9: „In Odoo speichern…“ und Strg+S-Weiche

**Description:** Dialog mit Projektsuche und Namensfeld; Menüpunkt in Datei; Strg+S/„Speichern“
schreibt eine Odoo-Zeichnung nach Odoo (Toast), sonst wie bisher; „Projekt › Zeichnung“ oben.

**Acceptance criteria:**
- [ ] Speichern unter legt die Zeichnung am gewählten Projekt an und zeigt „Projekt › Zeichnung“
- [ ] Strg+S einer Odoo-Zeichnung → „In Odoo gespeichert“; einer lokalen Datei → wie bisher
- [ ] Nicht angemeldet → zuerst der Anmeldedialog

**Verification:** vitest, tsc, i18n:check; Playwright gegen Backend + Mock-Odoo

**Dependencies:** Task 8 · **Files:** `OdooSaveDialog.tsx`, `OdooProjectPicker.tsx`, `MenuBar.tsx`, `src/i18n/de/menu.ts` · **Scope:** M

## Task 10: „Aus Odoo öffnen…“ mit Rückfrage bei Ungespeichertem

**Description:** Dialog: Projekt suchen → Zeichnungen (zuletzt gespeichert von/am, in
Bearbeitung von/seit) → öffnen; Rückfrage, wenn die offene Odoo-Zeichnung geändert ist.

**Acceptance criteria:**
- [ ] Öffnen lädt die Zeichnung und setzt Rolle editor oder viewer je nach Sperre
- [ ] Geänderte offene Zeichnung → Rückfrage vor dem Öffnen
- [ ] Leeres Projekt → Hinweis „Noch keine Zeichnungen“

**Verification:** vitest, tsc, i18n:check; Playwright

**Dependencies:** Task 9 · **Files:** `OdooOpenDialog.tsx`, `MenuBar.tsx`, `src/i18n/de/menu.ts` · **Scope:** M

## Task 11: Sperr-Leiste, Zuschauer-Anzeige, Rückfrage vor Überschreiben

**Description:** Leiste „In Bearbeitung von X seit … — nur lesen“ (Strg+S → Speichern unter),
„In einem anderen Tab von dir“ mit „Hier bearbeiten“; beim Bearbeiter „Auch geöffnet von: …“;
409 `stale` → Rückfrage „trotzdem überschreiben / unter neuem Namen“.

**Acceptance criteria:**
- [ ] Zweiter Nutzer sieht die Leiste und kann nicht zurückspeichern
- [ ] Bearbeiter sieht den Zuschauer, nach Schließen des Zuschauer-Tabs spätestens nach 90 s nicht mehr
- [ ] Veralteter Stand → Rückfrage statt stillem Überschreiben

**Verification:** vitest, tsc, i18n:check; Playwright mit zwei Kontexten

**Dependencies:** Task 10 · **Files:** `OdooLockBanner.tsx`, `MenuBar.tsx`, `src/i18n/de/menu.ts`, `faceDrawings.ts` · **Scope:** M

## Task 12: Review-Funde beheben

**Description:** Ergebnis der Code-Review vor Checkpoint C.
1. Antworten auf Speichern/Anlegen/Sperren gelten nur, wenn währenddessen nichts anderes geladen wurde (`loadSeq` + Zeichnungs-ID); sonst verwerfen bzw. die neue Sperre freigeben. „Speichern unter“ lässt sich während des Speicherns nicht schließen.
2. Die Sperre holt sich ein Beobachter, sobald eine Verknüpfung auftaucht — auch die aus der Sicherung nach dem Neuladen, unabhängig von der Effekt-Reihenfolge.
3. Öffnen aus Odoo leert Undo/Redo.
4. Tab-ID je Seitenaufruf (nicht `sessionStorage`); Sperre/Leser prüfen zusätzlich die uid.
5. Leser ohne Bearbeiter: „Bearbeiten“ (Sperre holen) neben „Neu laden“; Speichern mit 409 ohne Inhaber holt die Sperre und versucht es einmal neu; erneutes Öffnen derselben Zeichnung gibt die Sperre nicht kurz frei.
6. Backend: `data` muss ein Schaltplan sein (Objekt mit `nodes`-Liste) → sonst 400; fehlende Tab-ID 400; MissingError 404; 502 ohne interne Fehlertexte (Log); Test für CSRF auf den neuen Routen.
7. Doppeltes Strg+S wartet auf das laufende Speichern.

**Acceptance criteria:**
- [ ] Je Fund ein Test, der vorher fehlschlägt und danach grün ist
- [ ] Zwei-Nutzer-Ende-zu-Ende weiterhin grün; Neuladen im Produktions-Build (`vite build` + `vite preview`) holt die Sperre zurück

**Verification:** `npm test` (mcp-server), `npx vitest run`, `npx tsc -b`, Playwright

**Dependencies:** Task 11 · **Files:** `faceDrawings.ts`, `presence.ts`, `drawings.ts`, `store.ts`, `OdooLockBanner.tsx`, `OdooSaveDialog.tsx`, `OdooDialogs.tsx`, Tests · **Scope:** L (bewusst als ein Review-Durchgang)

## Checkpoint C — Freigabe, Push, Abnahme an echtem Projekt

---

# Phase 4: cloud-bridge (SPEC-cloud-bridge.md)

## Task 13: Relay im Backend — Tab anmelden, Poll, Antwort, Ablösung, Verfall

**Description:** `mcp-server/src/cloud/relay.ts` (Klasse `Relay`, Zeit injizierbar wie `Presence`)
und die Tab-Routen `POST /face/bridge/hello`, `GET /face/bridge/poll?tabId=`,
`POST /face/bridge/respond` hinter `requireUser` und `requireFaceHeader`. Ein gebundener Tab je
uid; `hello` eines zweiten Tabs löst den ersten ab (dessen nächster Poll → `superseded`, offene
Befehle → Fehler). Poll wartet bis 25 s; Tab ohne Poll seit 40 s gilt als weg. Unbekannter Tab →
409 `unbound` (Tab meldet sich neu an). `Relay.call(uid, command, params, timeoutMs)` ist die
Schnittstelle für Task 14.

**Acceptance criteria:**
- [x] `call` für uid 8 landet beim Poll von uid 8 und nie bei uid 9; die Antwort kommt bei `call` an
- [x] Zweiter Tab desselben Nutzers übernimmt, der erste bekommt `superseded`; ohne Poll 40 s → `call` meldet „kein Tab“
- [x] Poll ohne Sitzung 401, ohne `X-FACE-Request` 403, falsche Protokollversion 409 mit Hinweis

**Verification:** `cd mcp-server && npm test` (Relay-Einheitstests mit Fake-Zeit + Routen gegen Mock-Odoo)

**Dependencies:** None · **Files:** `relay.ts`, `relay.test.ts`, `server.ts` · **Scope:** M

## Task 14: Dienst-Zugang — `/face/service/call` und `/face/service/catalog`

**Description:** `mcp-server/src/cloud/service.ts`: Bearer-Prüfung mit `timingSafeEqual` gegen
`FACE_SERVICE_TOKEN` (neu, optional in `config.ts`; ohne → 503). `call { uid, command, params }`
prüft die Eingaben (uid positive Ganzzahl, command bekannter Name), ruft `Relay.call` mit 60 s und
übersetzt: kein Tab → 409 `{ reason: "no-tab", message: <deutsche Anleitung> }`, Zeitüberschreitung
→ 504, Befehlsfehler des Tabs → 200 `{ ok: false, error }`. `catalog` liefert `TOOLS`,
`SERVER_INSTRUCTIONS`, `PROMPTS` (mit Texten). Eigenes Rate-Limit auf Fehlversuche.

**Acceptance criteria:**
- [x] Ohne/mit falschem Token 401, ohne konfigurierten Token 503, unbekannter Befehl 400
- [x] Mit Token und gebundenem Tab kommt das Tab-Ergebnis zurück; ohne Tab 409 mit Anleitung; 504 nach Zeitüberschreitung
- [x] `catalog` enthält alle Werkzeuge aus `tools.ts` und die Playbooks; Token-Wert erscheint in keinem Log

**Verification:** `cd mcp-server && npm test`

**Dependencies:** Task 13 · **Files:** `service.ts`, `service.test.ts`, `config.ts`, `server.ts` · **Scope:** M

## Task 15: Deploy — `FACE_SERVICE_TOKEN` einmalig erzeugen und durchreichen

**Description:** Der Workflow-Schritt „Backend-Geheimnis einsetzen“ ergänzt in
`~/faceschematic/backend.env` eine Zeile `FACE_SERVICE_TOKEN=$(openssl rand -hex 32)`, nur wenn
sie fehlt (die vorhandene Datei mit `FACE_SECRET` bleibt sonst unberührt). `compose.yml` reicht
die Variable an `backend` weiter. Die Datei wird nie ausgegeben.

**Acceptance criteria:**
- [x] Vorhandene `backend.env` ohne Token → Token ergänzt, `FACE_SECRET` unverändert
- [x] Zweiter Lauf ändert nichts; neue Anlage erzeugt beide Zeilen mit Rechten 600

**Verification:** Shell-Schritt lokal in einem Temp-Verzeichnis dreimal durchgespielt (ohne Datei, mit altem Stand, unverändert)

**Dependencies:** Task 14 · **Files:** `.github/workflows/deploy.yml`, `compose.yml` · **Scope:** XS

## Checkpoint D — Freigabe, Push, Token in Odoo eintragen

## Task 16: Long-Polling-Transport im Tab

**Description:** In `src/mcpBridge.ts` wird die Befehlsausführung zu `runCommand(command, params)`
herausgelöst (WebSocket nutzt sie unverändert). Neuer Transport `OdooRelayTransport`:
`hello` → Poll-Schleife (nächster Poll sofort nach Antwort, Pause nur nach Fehlern) → Befehl über
`runCommand` → `respond`. 409 `unbound` → neu anmelden; `superseded` → anhalten mit Hinweis;
401 → anhalten, Hinweis „Erst oben rechts mit Odoo anmelden“. Gleiche Status-Werte wie heute.

**Acceptance criteria:**
- [x] Ein Befehl aus dem (gemockten) Poll läuft über die vorhandenen Handler und wird beantwortet
- [x] `unbound` führt zu neuem `hello`; `superseded` und 401 halten an und setzen den Status-Text
- [x] Die bestehenden MCP-Tests (`mcpEditing`, `mcpFloorplan`, `mcpValidation`) bleiben grün

**Verification:** `npx vitest run`, `npx tsc -b`

**Dependencies:** Task 13 (Vertrag) · **Files:** `src/mcpBridge.ts`, `src/__tests__/mcpRelay.test.ts`, `src/mcp/protocol.ts` · **Scope:** M

## Task 17: Einstellungen → KI mit zwei Wegen

**Description:** Store-Einstellung `mcpBridgeMode` (`"odoo" | "local"`, localStorage wie die
anderen `mcp…`-Werte). Im FACE-Build zeigt Einstellungen → KI die Wahl „Über den Odoo-Connector“
(Standard, nur Schalter; nicht angemeldet → Hinweis statt Schalter) und „Lokal (Claude Desktop)“
(Token + Port wie heute). `useMcpBridge` startet den passenden Transport; Abmelden stoppt den
Odoo-Weg. Ohne FACE-Build unverändert.

**Acceptance criteria:**
- [x] FACE-Build, angemeldet: Schalter ein → Status „Verbunden“ (gegen Backend + Mock-Odoo)
- [x] Nicht angemeldet → Hinweis, kein Start; Umschalten auf „Lokal“ zeigt Token/Port und nutzt den WebSocket
- [x] Upstream-Build zeigt die Einstellung wie bisher; `npm run i18n:check` grün

**Verification:** `npx vitest run`, `npx tsc -b`, `npm run i18n:check`; Playwright-Blick auf den Dialog

**Dependencies:** Task 16 · **Files:** `PreferencesDialog.tsx`, `src/store.ts`, `src/mcpBridge.ts`, `src/i18n/de/settings.ts` · **Scope:** M

## Task 18: Vier Odoo-Befehle

**Description:** Neue `CommandType`s in `src/mcp/protocol.ts`, Handler in `src/mcpBridge.ts`
(rufen die vorhandenen Funktionen aus `faceDrawings.ts`), Werkzeugbeschreibungen in
`mcp-server/src/tools.ts` und ein Absatz in `SERVER_INSTRUCTIONS`:
- `get_editor_status` → angemeldet als, Schaltplanname, Odoo-Projekt/Zeichnung, Rolle (bearbeite/lese, wer bearbeitet), ungespeicherte Änderungen
- `open_odoo_drawing { drawingId, discardChanges? }`
- `save_odoo_drawing { force? }` (nur eine verknüpfte Zeichnung; fremde Sperre → Fehler mit Name; inzwischen gespeichert → Fehler mit wer/wann)
- `new_odoo_drawing { projectId, name, discardChanges? }` (leerer Schaltplan, sofort am Projekt angelegt)

**Acceptance criteria:**
- [x] Ungespeicherte Änderungen → Öffnen/Neu verweigern mit Satz, mit `discardChanges` erlaubt
- [x] Speichern bei fremder Sperre oder veraltetem Stand verweigert mit Namen; mit `force` nur der Veraltet-Fall
- [x] Nicht angemeldet → klarer Fehler; die Befehle erscheinen im Katalog

**Verification:** `npx vitest run` (mit gemocktem `faceApi`), `cd mcp-server && npm test`, `npx tsc -b`

**Dependencies:** Task 16 · **Files:** `src/mcp/protocol.ts`, `src/mcpBridge.ts`, `mcp-server/src/tools.ts`, `mcp-server/src/prompts.ts`, Test · **Scope:** M

## Task 19: Ende-zu-Ende und Hilfeseite

**Description:** Playwright gegen `vite build` + `vite preview`, Backend (mit Test-Token) und
Mock-Odoo: zwei Nutzer, beide schalten ein; `/face/service/call` für uid 8 mit `add_device` →
Gerät erscheint nur bei Nutzer 8; `get_editor_status` für uid 9 nennt dessen Zeichnung; Tab im
Hintergrund bleibt verbunden. Hilfeseite „KI-Assistent“ um den Odoo-Weg ergänzen.

**Acceptance criteria:**
- [x] Ende-zu-Ende grün, inkl. Ablösung durch einen zweiten Tab
- [x] Hilfeseite erklärt: anmelden, Schalter, in claude.ai „Schaltplan“ fragen; der lokale Weg bleibt beschrieben

**Verification:** Playwright-Skript, `npm run build`

**Dependencies:** Tasks 17, 18 · **Files:** Playwright-Skript (Scratchpad), Hilfeseite in `docs/` · **Scope:** S

## Checkpoint E — Freigabe, Push, Tab einschalten und mit Token prüfen

---

# Phase 5: odoo-mcp-schaltplan (Repo `facegmbh/Odoo`, SPEC-odoo-mcp-schaltplan.md)

## Task 20: `tools/schaltplan.py` mit vier Werkzeugen

**Description:** Muster `campaignred.py`: `schaltplan_leitfaden`, `schaltplan_status`,
`schaltplan_zeichnungen`, `schaltplan_befehl`; URL und Token aus `ir.config_parameter` (sudo),
`uid = env.user.id`; Werkzeuge nur mit Token; Fehler als sprechbare Sätze.

**Acceptance criteria:**
- [ ] Ohne Token keine Werkzeuge; die uid im Aufruf ist immer der angemeldete Nutzer
- [ ] `data/neutralize.sql` löscht `face_schematic.token` (Staging/Entwicklung rufen die Produktion nie mit Token)
- [ ] 409/504/401/nicht erreichbar → klare Sätze; `schaltplan_zeichnungen` nur `.faceschematic.json` an Projekten
- [ ] Bestehende Tests des Moduls unverändert grün

**Verification:** Odoo-Tests (`tests/test_schaltplan.py`) auf Odoo.sh-Staging

**Dependencies:** Checkpoint D · **Files:** `tools/schaltplan.py`, `tools/__init__.py`, `tests/test_schaltplan.py` · **Scope:** M

## Task 21: Leitfaden-Abschnitt und Pull-Request

**Description:** Abschnitt „Schaltplan“ in `data/leitfaden.md` (erst Leitfaden, dann Status;
Geräte nur mit `search_templates`-IDs; speichern, überschreiben und verwerfen nur auf
ausdrücklichen Wunsch); Branch + Pull-Request mit Beschreibung; Staging-Build prüfen.

**Acceptance criteria:**
- [ ] Pull-Request offen, Staging-Build grün
- [ ] Nach Merge durch Jean-Luc: Success Criteria 1–3 der Spec in claude.ai erfüllt

**Dependencies:** Task 20, Checkpoint E · **Files:** `data/leitfaden.md` · **Scope:** S

## Checkpoint F — Jean-Luc merged, Abnahme in claude.ai

---

# Phase 6: schaltplan-layout (SPEC-schaltplan-layout.md)

## Task 22: Spike + `check_layout`

**Description:** Erst klären (Notiz in `tasks/plan.md`): Haben Geräte im Store `measured`-Größen?
Wo liegen die verlegten Linien (Auto-Routing-Wegpunkte, eigene Wegpunkte, sonst L-Form)? Geht
`exportImage` in einem Hintergrund-Tab? Dann `src/layoutCheck.ts` (reine Funktionen) und Befehl
`check_layout { roomId? }` mit Befunden `overlap`, `outside`, `room_overlap`, `off_grid`,
`crosses_device`, `crossings`, `detour` – je mit IDs und einem Satz zur Abhilfe.

**Acceptance criteria:**
- [x] Kapelle-Fixture: Switch `outside` (ragt aus „Netzwerk“), RX1/PureLink `overlap`
- [x] Eine saubere Zeichnung liefert keine Befunde; `check_layout` ändert nichts
- [x] Linie durch ein Gerät und Umweg (> 2 × kürzester Weg) werden erkannt

**Verification:** `npx vitest run`, `npx tsc -b`

**Dependencies:** None · **Files:** `src/layoutCheck.ts`, `src/__tests__/layoutCheck.test.ts`, Fixture, `src/mcp/protocol.ts`, `src/mcpBridge.ts`, `mcp-server/src/tools.ts` · **Scope:** M

## Task 23: Verschachtelte Orte und Racks

**Description:** `create_room` bekommt `parentRoomId` (Ort im Ort, Position relativ). Neuer Befehl
`add_rack_to_room { roomId, name, heightU, rackType? }`: Rack-Kasten als Unterraum (Rahmen,
Kennung „Rack“) **und** Rack in der Rack-Ansicht (vorhandenes `create_rack`), verknüpft über die
Rack-ID am Kasten. `place_device_in_rack` setzt ein Gerät dann zusätzlich in den Kasten.

**Acceptance criteria:**
- [x] Ort → Rack → Gerät verschachtelt; Positionen bleiben relativ zum Eltern-Raum
- [x] `add_rack_to_room` legt Kasten und Rack-Ansicht an; Gerät ins Rack → in beiden
- [~] Löschen: der Editor löst die Verknüpfung schon selbst. Undo: `add_rack_to_room` sind mehrere Undo-Schritte (Rack, Kasten, Kennzeichnung, Verknüpfung) – einmal Rückgängig nimmt nur den letzten zurück. Zusammenfassen bräuchte eine Store-Änderung; offen

**Verification:** `npx vitest run`, `npx tsc -b`, `npm run i18n:check`

**Dependencies:** None · **Files:** `src/mcpBridge.ts`, `src/mcp/protocol.ts`, `src/store.ts` (Verknüpfung), Raum-Darstellung, Tests · **Scope:** M

## Task 24: `arrange_room` und `fit_room`

**Description:** `src/layoutArrange.ts`: Geräte eines Raums in Spalten nach Signalfluss
(Quellen links, Senken rechts; innerhalb der Spalte nach Verbindungen sortiert, damit Linien
kurz bleiben), Abstand und Position auf dem Raster; Rack-Kästen als Block. `fit_room` passt den
Raum (und seine Eltern) an den Inhalt an.

**Acceptance criteria:**
- [x] Nach `arrange_room` keine Überlappung im Raum; Quellen links von ihren Zielen
- [x] `fit_room` umschließt alle Kinder mit Rand, auch verschachtelt
- [x] Ein Schritt Undo stellt den Raum wieder her

**Verification:** `npx vitest run`, `npx tsc -b`

**Dependencies:** Tasks 22, 23 · **Files:** `src/layoutArrange.ts`, Tests, `src/mcpBridge.ts`, `src/mcp/protocol.ts`, `mcp-server/src/tools.ts` · **Scope:** M

## Checkpoint G1 — Zwischenstand zeigen (kein Push)

## Task 25: `arrange_rooms` und `route_connections`

**Description:** Räume oberster Ebene ohne Überlappung in Zeilen anordnen (Reihenfolge optional).
`route_connections { connectionIds? }` verlegt mit dem Auto-Routing des Editors neu; eigene
Wegpunkte nur, wenn ausdrücklich genannt.

**Acceptance criteria:**
- [x] Kapelle-Fixture nach `arrange_room` je Raum + `arrange_rooms` + `route_connections`: keine `overlap`, `outside`, `room_overlap`
- [x] Eigene Wegpunkte bleiben ohne ausdrückliche Nennung erhalten

**Verification:** `npx vitest run`, `npx tsc -b`

**Dependencies:** Task 24 · **Files:** `src/layoutArrange.ts`, `src/mcpBridge.ts`, Tests · **Scope:** M

## Task 25a: `rename_room` und `dissolve_room`

**Description:** Lücke aus G1: Claude soll eine bestehende Zeichnung mit Gewerke-Räumen örtlich
umbauen können. `rename_room` ändert nur den Namen; `dissolve_room` entfernt den Rahmen, der
Inhalt bleibt liegen und kommt in den umgebenden Raum.

**Acceptance criteria:**
- [x] Umbenennen ändert nur das Label, Inhalt und Lage bleiben
- [x] Auflösen: Geräte behalten ihre absolute Lage und ihre Leitungen; ein Undo-Schritt
- [x] Inhalt eines verschachtelten Raums landet im Raum drumherum
- [x] Gesperrter Raum wird nicht aufgelöst; Nicht-Räume werden abgelehnt

**Verification:** `npx vitest run`, `npx tsc -b`, `cd mcp-server && npm test`

**Dependencies:** Task 23 · **Files:** `src/mcpBridge.ts`, `src/mcp/protocol.ts`, `mcp-server/src/tools.ts`, `src/__tests__/mcpLayout.test.ts` · **Scope:** S

## Task 26: `render_schematic`

**Description:** PNG der Zeichnung oder eines Raums (`roomId`, `maxSize`) über den vorhandenen
Export, als `{ image: { mimeType, data } }`. Im Odoo-Connector gibt `schaltplan_befehl` ein Bild
als Bildinhalt weiter (`registry.text_und_bild`).

**Acceptance criteria:**
- [x] Liefert ein gültiges PNG ≤ ~1 MB, auch für den ganzen Plan (Kapelle örtlich: 1600×1393, 356 KB; Technik 191 KB)
- [x] Von einer Rack-Seite aus: Bild vom Schaltplan, danach wieder die Rack-Seite
- [x] Hintergrund-Tab: html-to-image wartet auf Animation-Frames, die ein verdeckter Tab nicht bekommt —
  während der Aufnahme ersetzt ein Timer sie. Geprüft mit nachgestelltem Hintergrund (`document.hidden`,
  keine Frames); einen echt verdeckten Tab konnte Playwright auf dem Mac nicht erzeugen. Wechselt ein
  verdeckter Tab erst die Seite, misst React Flow evtl. nicht — dann sagt der Befehl, den Tab einmal nach vorn zu holen
- [x] Lokaler MCP-Server gibt das Bild als Bildinhalt aus (`mcp-server/src/content.ts`), Odoo ebenso (facegmbh/Odoo, Branch `feat/schaltplan-bild`)
- [ ] In claude.ai erscheint das Bild (nach dem Push, Checkpoint G)

**Verification:** `npx vitest run`, Playwright gegen den Tab, Odoo-Test für die Bildweitergabe

**Dependencies:** Task 22 (Spike) · **Files:** `src/mcpBridge.ts`, Export-Helfer, Odoo `tools/schaltplan.py` + Test · **Scope:** M

## Task 27: Playbook, Leitfaden, Ende-zu-Ende

**Description:** „build-schematic“ und Odoo-Leitfaden „Schaltplan“: Orte klären → Orte und
Racks (`add_rack_to_room`, Rack-Ansicht immer) → Geräte → `arrange_room` → `arrange_rooms` →
verbinden → `route_connections` → `check_layout` bis leer (max. 3 Runden) → `render_schematic`.
`schaltplan_geraeteliste` → `naechster_schritt` entsprechend (Räume = Orte, Schränke = Racks).

**Acceptance criteria:**
- [x] Ende-zu-Ende über `/face/service/call` (21.11., Tab mit `VITE_FACE_BACKEND=1`, Mock-Odoo): Kapelle nach
  Gewerken (7 Räume) umgebaut — `rename_room` Mikrofone → Kapelle, 6 × `dissolve_room`, 19 Verbindungen erhalten —,
  Orte und Wandschrank (HE 1–10) angelegt, geordnet, verlegt, geprüft, Bild 1600×1355 / 360 KB über den Dienst;
  42 Aufrufe, langsamster `render_schematic` 3,1 s (Grenze 50 s)
- [ ] `check_layout` **leer**: nicht erreicht. Keine harten Befunde (overlap/outside/room_overlap/no_room/off_grid/
  unrouted), es bleiben 1 Umweg (Epson → Switch) und 63 Kreuzungspaare — fast alle in der Gasse links vom Schrank,
  wo die Netzwerkleitungen auf die Switch-Ports springen. Senken ließe sich das über die Port-Zuordnung am Switch
  (fachliche Änderung, nicht still) — nach Checkpoint G mit Jean-Luc klären. Claude nennt den Rest laut Playbook.
- [x] Odoo-Leitfaden („Aufbau: örtlich“) und Geräteliste (`naechster_schritt`) nennen die Regeln (Branch `feat/schaltplan-bild`)

**Dependencies:** Tasks 25, 26 · **Files:** `mcp-server/src/prompts.ts`, Odoo `data/leitfaden.md`, `tools/schaltplan.py` · **Scope:** S

## Checkpoint G — Freigabe, Push (FACESchematic master, Odoo main)

# Phase 7: schaltplan-leitungen (SPEC-schaltplan-leitungen.md)

## Task 28: `choose_port_sides`

**Description:** Bei Verbindungen mit zweiseitigen Ports (`-in` links / `-out` rechts) die Seite
zum Gegenüber wählen; übereinander liegende Geräte (Rack) nehmen dieselbe Seite. Verbindungs-ID
bleibt, ein Undo-Schritt. Durchgangsports nie; Verbindungen mit eigenen Stützpunkten nur, wenn
genannt (die Stützpunkte selbst bleiben; vom Router gelegte gehen mit der alten Seite).

**Acceptance criteria:**
- [x] Gegenüber rechts → `-out`, links → `-in`, auf beiden Enden
- [x] Übereinander (waagerecht überlappend) → beide dieselbe Seite (die feste Seite des anderen Endes, sonst links)
- [x] `rear`/`front` und einseitige Ports unverändert; Stub-Leitungen unverändert; eigene Stützpunkte nur, wenn genannt
- [x] Befehl am Store: ID bleibt, ein Undo-Schritt, meldet geänderte Verbindungen; zweiter Lauf ändert nichts

**Verification:** `npx vitest run`, `npx tsc -b`, `cd mcp-server && npm test`

**Dependencies:** — · **Files:** `src/portSides.ts`, `src/mcpBridge.ts`, `src/store.ts` (Aktion), `src/mcp/protocol.ts`, `mcp-server/src/tools.ts`, Tests · **Scope:** S

## Task 29: Ortsnamen und Notizen als Hindernisse

**Description:** `buildObstacles` nimmt den Ortsnamen jedes Raums (geschätzte Textbreite) und
Notizen auf. Gilt auch beim Zeichnen von Hand.

**Acceptance criteria:**
- [x] Leitung, deren kürzester Weg über einen Ortsnamen ginge, läuft daran vorbei
- [x] Vorhandene Routing-Tests und Harness grün: `routing:check` 13/13 ohne Änderung, keine Baseline neu geschrieben

**Dependencies:** — · **Files:** `src/pathfinding.ts`, Tests · **Scope:** S–M

## Task 30: Prüfen und Platz schaffen

**Description:** `check_layout`: `line_outside` (mit Länge) und `over_text`. `arrange_rooms`
bekommt `gap`, `arrange_room`/`fit_room` bekommen `margin`.

**Acceptance criteria:**
- [x] Befunde mit Leitungs-IDs und Abhilfe-Satz; `line_outside` nennt Länge und den Ort, an dem die Leitung vorbeiläuft; Gerätetexte nicht doppelt (Geräte sind schon `crosses_device`)
- [x] `gap`/`margin` auf dem Raster, Grenzen geprüft; `margin` bleibt am Raum (`layoutMargin`)

**Dependencies:** Task 29 (gleiche Text-Rechtecke) · **Files:** `src/layoutCheck.ts`, `src/layoutArrange.ts`, `src/mcpBridge.ts`, Tests · **Scope:** M

## Task 31: `set_connection_path`

**Description:** Claude legt eine Leitung mit Stützpunkten selbst (`setManualWaypoints`); leere
Liste gibt sie dem Routing zurück.

**Acceptance criteria:**
- [x] Stützpunkte auf das Raster gerundet, höchstens 50, ungültige Punkte und unbekannte Verbindung abgelehnt; ein Undo-Schritt; leere Liste gibt die Leitung dem Routing zurück

**Dependencies:** — · **Files:** `src/mcpBridge.ts`, Protokoll, Katalog, Tests · **Scope:** S

## Checkpoint H1 — Zwischenstand zeigen (kein Push)

Kapelle (G-Anordnung) im Browser, nur über Claudes Befehle: alter Ablauf 7 Leitungen / 4048 px außerhalb,
57 Kreuzungspaare, 1 Umweg; nach `choose_port_sides` 3 / 1392 px, 48; nach einer Runde Rand 80 + Abstand 128:
0 außerhalb, 0 über Text, 46 Paare, kein Umweg.

## Task 32: Playbook, Leitfaden, Ende-zu-Ende

**Acceptance criteria:**
- [x] Playbook und Odoo-Leitfaden mit neuem Ablauf und Jean-Lucs Wünschen aus dem Chat vom 21.11.
- [x] Kapelle nach Leitfaden (Browser, nur Claudes Befehle): `line_outside` = 0, `over_text` = 0, kein Umweg,
  20 Kreuzungspaare; zwei Läufe gleich
- [x] Derselbe Ablauf über `/face/service/call` (21.11., Tab mit `VITE_FACE_BACKEND=1`, Mock-Odoo): Kapelle nach
  Gewerken → 7 × `dissolve_room` → Orte, 6 Bereiche, Schrank (3 Spalten, 19 Verbindungen erhalten) → keine
  Leitung außerhalb oder über Text, keine harten Befunde, 1 Kreuzungs-Befund; Schrank-Kasten nicht auflösbar;
  Bild 1600×1600 / 391 KB; 57 Aufrufe, langsamster 3,3 s

## Checkpoint H — Freigabe, Push (FACESchematic master, Odoo main)

# Phase 8: schaltplan-rahmen (SPEC-schaltplan-rahmen.md)

Jean-Luc, 22.11.: „Linien laufen aber noch auf Linien von Rahmen und Geräte könnten leicht verschoben
werden damit die Linien sauberer laufen. Linien sollen auch nicht durch die Rahmen laufen von anderen.“
Entschieden: für alle Zeichnungen.

## Task 35: Router meidet Rahmen

**Acceptance criteria:**
- [x] Auf einem Rahmen entlang läuft keine Leitung mehr; um einen fremden Raum geht sie herum, durch eigene gerade
- [x] Ohne Räume unverändert: `routing:check` 13/13 „ok (no changes)“
- [x] Jean-Lucs Kapelle: 7 → 0 auf Rahmen, 3 → 1 durch fremde Rahmen (Kirche über der Kapelle, nur durch Anordnung lösbar), kein `line_outside`

**Files:** `src/pathfinding.ts`, `src/edgeRouter.ts`, `src/__tests__/roomFrames.test.ts`, Fixture `kapelle-jl-2026-11-22.json` · **Scope:** M

## Task 36: `on_frame` und `through_room`

**Acceptance criteria:**
- [x] `on_frame`: bis 8 px neben einer Rahmenseite, mindestens 16 px lang; Kreuzen zählt nicht
- [x] `through_room`: nur fremde Räume, der äußerste genannt; Abhilfe je nach Ort oder Bereich

**Files:** `src/layoutCheck.ts`, Tests · **Scope:** S

## Task 37: `straighten_lines`

**Acceptance criteria:**
- [x] Gerät mit weniger Verbindungen rückt senkrecht, ganze Rasterfelder, höchstens `maxShift` (64)
- [x] Nie auf andere Geräte/Räume, nie aus dem eigenen Raum, keine gerade Leitung knicken; gesperrte Räume bleiben; Hand-Wege bleiben
- [x] Befehl: ein Undo-Schritt, verlegt neu und wartet; ohne verlegte Leitungen Hinweis auf `route_connections`
- [x] Jean-Lucs Kapelle: 3 Geräte gerückt (16–32 px), 3 Leitungen gerade

**Files:** `src/straightenLines.ts`, `src/mcpBridge.ts`, Protokoll, Katalog, Tests · **Scope:** M

## Task 38: Playbook, Leitfaden, Ende-zu-Ende

**Acceptance criteria:**
- [x] Playbook und Odoo-Leitfaden: `straighten_lines` nach dem Verlegen, `through_room` → Orte nebeneinander, `on_frame` wie `line_outside`
- [x] Über `/face/service/call` (22.11.): Kapelle nach Gewerken → Orte/Bereiche/Schrank → nach einer Korrekturrunde
  (Rand 96 für Technik, Kirche, Kapelle; Lücke 160) keine Leitung außerhalb, über Text, auf Rahmen oder durch
  fremde Orte, keine harten Befunde, 1 Kreuzungs-Befund; 71 Aufrufe, Bild 1563×1600 / 356 KB
- [x] Alle Tests grün (2195 + 96), `tsc -b`, routing:check 13/13

## Checkpoint I — Freigabe, Push (FACESchematic master, Odoo main)


---

# Phase 9: odoo-device-library (SPEC-odoo-device-library.md)

## Task 39: Gemeinsame Vorlagen-Prüfung

**Description:** `src/mcp/templateValidation.ts` mit `checkStoredTemplate(template)`. Die Funktion
prüft Form (`key`, `label`, `deviceType`, Ports mit `id`/`label`/`signalType`/`direction`, eindeutige
Port-IDs), Größe (≤ 256 KB als JSON) und die bekannten Werte. Die Werte stehen als Konstanten in
`protocol.ts`. `sync-protocol.mjs` kopiert beide Dateien ins Backend.

**Acceptance criteria:**
- [x] Alle 899 mitgelieferten Vorlagen bestehen die Prüfung, auch mit Slots, `passthrough` und Lastdaten
- [x] Kaputte Vorlagen werden mit einem deutschen Satz abgelehnt, der Vorlage, Feld und Grund nennt; Links nur `http(s)` (geteilte Vorlage, sonst `javascript:` beim Kollegen)
- [x] Ein Gleichheitstest vergleicht die Listen in `protocol.ts` mit `DEFAULT_SIGNAL_COLORS` und `CONNECTOR_TO_CABLE`. Die Gerätetyp-Liste wandert nach Task 46: Im Editor ist der Gerätetyp freier Text, deshalb prüft nur die strenge Prüfung für Claude ihn.

**Verification:**
- [x] `npx vitest run src/__tests__/templateValidation.test.ts` (21 Tests), ganze Suite 2496 grün, `tsc -b` grün
- [x] `cd mcp-server && npm test` (102 grün, die Kopie läuft unter Node); `Dockerfile.cloud` kopiert die Datei mit

**Dependencies:** keine
**Files:** `src/mcp/protocol.ts`, `src/mcp/templateValidation.ts`, `mcp-server/scripts/sync-protocol.mjs`, `mcp-server/.gitignore`, Test · **Scope:** M

## Task 40: Odoo-Modul `face_schematic_library`

**Description:** Im Repo `facegmbh/Odoo` (Worktree von `origin/main`): Modell
`face.schematic.template` wie in der Spec, mit `mail.thread`, eindeutigem `key`, JSON-Prüfung,
steigender `version` bei jedem Schreiben von `data`, Archivieren, Liste und Formular unter
eigenem Menü, Rechten (intern: lesen/anlegen/schreiben, Löschen nur `base.group_system`).

**Acceptance criteria:**
- [x] Doppelter `key` und ungültiges JSON scheitern mit einer deutschen Meldung (Code + Test)
- [x] `version` steigt nur, wenn sich `data` ändert; der Chatter verfolgt Name, Version, Artikel und Archiv (Code + Test)
- [x] Portal-Benutzer sehen nichts; interne Benutzer können nicht löschen, aber archivieren (Code + Test)
- [x] Zusätzlich: `expected_version` im Kontext verweigert das Schreiben, wenn inzwischen jemand anderes geändert hat; Name, Hersteller, Modell und Typ kommen aus dem JSON

Stand 27.11.: Commit `595cbc2c` auf Branch `feat/schematic-library` (Worktree `~/dev/Odoo-schematic-library`), nicht gepusht. Lokal geprüft: Python-Syntax, XML, Manifest.

**Verification:**
- [ ] `face_schematic_library/tests/test_template.py` grün im Odoo.sh-Build (12 Tests), steht aus: Branch pushen
- [ ] Manuell nach Installation: Menü „FACESchematic → Gerätevorlagen“ sichtbar
- Abweichung: Im Formular kann man keinen Datensatz von Hand anlegen (`create="false"`). Bearbeitet wird im Editor.

**Dependencies:** keine (parallel zu 39)
**Files:** `__manifest__.py`, `models/face_schematic_template.py`, `security/ir.model.access.csv`, `views/…xml`, `tests/test_template.py` · **Scope:** M

## Task 41: Backend `/face/api/library`

**Description:** `mcp-server/src/cloud/library.ts` mit den sechs Routen aus der Spec, eingehängt in
`server.ts` hinter `requireUser`. Alle Odoo-Aufrufe laufen mit `odooFor` des Nutzers. Prüfung mit
`checkStoredTemplate`. `mockOdoo.ts` lernt `face.schematic.template` und `product.product`
(`search_read`, `create`, `write`).

**Acceptance criteria:**
- [x] `GET` liefert alle aktiven Vorlagen mit Version, Artikel, `writtenBy` und `writeDate`; die Version steht auch in der Vorlage selbst (für die Drift-Anzeige)
- [x] `POST` legt an (201) oder meldet 409 bei bekanntem `key` (auch archiviert); `PUT` mit älterer `baseVersion` meldet 409 mit Name und Zeit, ebenso Odoos eigene Sperre (`expected_version`)
- [x] `upload` meldet `added`, `same` und `skipped` (abweichend oder ungültig, in Eingabe-Reihenfolge); `archive` und `products?q=` funktionieren; Artikel setzen und lösen ändert die Version nicht
- [x] Ungültige Vorlagen bekommen 400 mit dem Satz aus der Prüfung; ohne Anmeldung 401; ohne Odoo-Modul 503; fehlende Rechte 403
- Nebenbei: `OdooError` behält den Namen der Odoo-Ausnahme (`odooName`), damit `UserError` und `ValidationError` unterscheidbar sind

**Verification:**
- [x] `cd mcp-server && npm test`: 117 grün, davon 15 in `library.test.ts`

**Dependencies:** 39 (Odoo-Felder wie in 40, Mock statt echtem Odoo)
**Files:** `mcp-server/src/cloud/library.ts`, `server.ts`, `mockOdoo.ts`, `library.test.ts` · **Scope:** M

## Checkpoint J1 — Zwischenstand

## Task 42: Editor lädt die zentrale Bibliothek

**Description:** `src/centralLibrary.ts` (Muster `faceDrawings.ts`) holt die Bibliothek beim Start,
nach der Anmeldung und bei Fokus nach mehr als 5 Minuten. Sie führt die Vorlagen in
`customTemplates` zusammen (höhere Version gewinnt) und füllt `libraryMeta` im Store. Die
Bibliothek kennzeichnet Geräte, die nur in diesem Browser liegen.

**Acceptance criteria:**
- [x] Angemeldet erscheinen zentrale Vorlagen in „Eigene Geräte“; nach Neuladen ohne Netz sind sie noch da (Zwischenspeicher `face-central-library-meta` neben den eigenen Geräten)
- [x] Lokale Geräte bleiben und tragen das Kennzeichen „lokal“; abgemeldet verhält sich alles wie heute; ohne Odoo-Modul (503) Status `unavailable`, kein Kennzeichen
- [x] Ohne `VITE_FACE_BACKEND` wird nie geladen
- Zusätzlich: Was ein Kollege archiviert hat, verschwindet beim nächsten Laden aus der Bibliothek (nur was vorher zentral war). Der Baustein heißt `centralLibrary.ts`, weil `faceLibrary` schon die FACE-Hausbibliothek meint.

**Verification:**
- [x] `npx vitest run src/__tests__/centralLibrary.test.ts` (14), ganze Suite grün
- [x] `npx tsc -b`
- [ ] Sichtprüfung im FACE-Build (Kennzeichen „lokal“) bei Checkpoint J

**Dependencies:** 41
**Files:** `src/centralLibrary.ts`, `src/store.ts`, `src/components/DeviceLibrary.tsx`, i18n, Test · **Scope:** M

## Task 43: Editor schreibt zentral

**Description:** `addCustomTemplate`, `updateCustomTemplate`, `removeCustomTemplate` und
`importCustomTemplates` rufen eine Senke, die `centralLibrary` anmeldet. Angemeldet schreibt sie
nach Odoo (anlegen, ändern mit `baseVersion`, archivieren) und setzt `template.version` und
`libraryMeta`. Bei einem Fehler nimmt sie die Änderung zurück und zeigt den Satz an.

**Acceptance criteria:**
- [x] Jeder der vier Schreibwege landet in Odoo, mit je einem Test (anlegen → `POST`, ändern → `PUT` mit `baseVersion`, entfernen → archivieren, Import → Hochladen)
- [x] Fehler oder Konflikt beim Ändern/Entfernen: genau diese Vorlage zurück (andere Änderungen bleiben), Meldung nennt bei 409 den anderen Nutzer und lädt neu. Ein neues Gerät, das Odoo nicht erreicht, bleibt lokal mit Hinweis.
- [x] Nach einer Änderung zeigt eine Zeichnung mit dem alten Stand Drift (`templateSync.ts`)
- Zusätzlich: Schreibvorgänge an derselben Vorlage laufen nacheinander. Lokale Geräte bleiben beim Ändern und Entfernen lokal. „Alle eigenen Geräte löschen“ wirkt nur im Browser und archiviert nichts in Odoo (ein Klick darf nicht die Bibliothek aller leeren); die zentralen kommen beim nächsten Laden wieder.

**Verification:**
- [x] `npx vitest run src/__tests__/centralLibrary.test.ts` (26), ganze Suite 2522 grün
- [x] `npx tsc -b`

**Dependencies:** 42
**Files:** `src/centralLibrary.ts`, `src/store.ts`, Test, i18n · **Scope:** M

## Task 44: Hochladen und eingebettete Vorlagen

**Description:** In der Bibliothek gibt es „Nach Odoo hochladen (n)“ für lokale Geräte. Der
Browser filtert vorher mitgelieferte Dubletten heraus, danach kommt eine Ergebnisliste. Beim Laden
einer Zeichnung werden eingebettete Vorlagen mit einem zentralen `key` durch die zentrale ersetzt,
wenn deren Version gleich oder neuer ist.

**Acceptance criteria:**
- [x] Hochladen verdoppelt nichts und listet Abweichungen; danach haben die Geräte kein Kennzeichen mehr (Knopf „Nach Odoo hochladen (n)“ mit Ergebnis im Abschnitt „Eigene Geräte“)
- [x] Eine Zeichnung mit älterer eingebetteter Vorlage zeigt nach dem Laden die zentrale (und Drift an Geräten). Brauchte keinen neuen Code: Das Laden behält die vorhandene Kopie, und fehlt sie, ersetzt das nächste Laden der Bibliothek die ältere.
- [x] Unbekannte eingebettete Vorlagen bleiben lokal und tragen das Kennzeichen
- Zusätzlich: Der Dialog „Alle eigenen Geräte löschen“ sagt angemeldet, dass zentrale Geräte in Odoo bleiben und wiederkommen.
- Grenze: Geräte, die vor der zentralen Bibliothek aus einer Vorlage ohne Version gesetzt wurden, haben keine `templateVersion` und zeigen deshalb nie Drift.

**Verification:**
- [x] `npx vitest run src/__tests__/centralLibrary.test.ts` (34), ganze Suite 2530 grün, `tsc -b` grün
- [ ] Sichtprüfung Knopf und Ergebnisliste bei Checkpoint J

**Dependencies:** 43
**Files:** `src/centralLibrary.ts`, `src/store.ts` (Laden), `src/components/DeviceLibrary.tsx`, i18n, Test · **Scope:** M

## Task 45: Odoo-Artikel und Handbuch

**Description:** Im Geräte-Editor gibt es das Feld „Odoo-Artikel“ mit Suche über `/library/products`,
nur angemeldet. Es speichert `productId` über die Senke. Dazu kommt ein Absatz im Handbuch (de/en)
zu zentralen Geräten, Hochladen und Artikel.

**Acceptance criteria:**
- [x] Artikel setzen, ändern und lösen; der Name steht in der Bibliothek am Gerät („Odoo: …“). Feld „Odoo-Artikel (Vorlage)“ im Geräte-Editor (`TemplateProductField.tsx`), wirkt sofort, nicht mit dem Formular, weil es die Vorlage betrifft und nicht dieses Gerät
- [x] Ohne Anmeldung, ohne Odoo-Modul oder bei lokalen Vorlagen ist das Feld nicht da
- [x] Handbuch-Seite in beiden Sprachen: Abschnitt „Zentrale Bibliothek in Odoo“, der localStorage-Satz ist richtiggestellt

**Verification:**
- [x] `npx vitest run` (2534 grün, davon 38 in `centralLibrary.test.ts`), `npx tsc -b` grün, Docs-Build grün (in den Scratchpad gebaut; `tsc` im Docs-Paket meldet zwei Fehler in `SearchBar.tsx`, die es schon vorher gab)
- [ ] Sichtprüfung des Felds bei Checkpoint J

**Dependencies:** 43
**Files:** `src/components/DeviceEditor.tsx`, `src/centralLibrary.ts`, i18n, `docs/src/pages{,-de}/DeviceLibrary.tsx` · **Scope:** M

## Checkpoint J — Freigabe, Push

---

# Phase 10: device-template (SPEC-device-template.md)

## Task 46: Strenge Eingabeprüfung und Port-Abgleich

**Description:** `parseTemplateInput(params, base?)` in `templateValidation.ts` prüft die
Parameter aus der Spec streng, auch `speakerLoad`, `ampLoad`, `detection` und `micCoverage` mit
ihren Grenzen. Sie leitet von einer Basis ab. `mergePorts(old, next)` behält, ändert, ergänzt und
entfernt Ports nach `id`.

**Acceptance criteria:**
- [x] `deviceType` aus `DEVICE_TYPE_TO_CATEGORY` (Liste `DEVICE_TYPES_WIRE` in `protocol.ts` mit Gleichheitstest, aus Task 39 hierher verschoben); bei Tippfehlern nennt der Fehler nahe Typen
- [x] Unbekannte Felder, `passthrough`, Werte außerhalb der Grenzen (Sektor ohne Winkel, aufsteigende Taps) werden mit Feld und Grund abgelehnt; Slots, WLAN, Plan-Symbol nur über eine Basis
- [x] Ableiten behält Slots und Lastdaten und entfernt `id` und `version` der Basis; `null` entfernt einen Block
- [x] Das Ergebnis besteht immer `checkStoredTemplate` (zum Schluss geprüft)
- Ändern: `ports` ist die neue vollständige Liste (bekannte id ändert nur Genanntes, ohne id neu, fehlende entfallen), Antwort mit `addedPorts`/`removedPorts`; unbekannte Port-id ist ein Fehler. `templateId`, `baseVersion` und `productId` überspringt die Prüfung, `baseTemplateId` lehnt sie beim Ändern ab.

**Verification:**
- [x] `npx vitest run src/__tests__/templateValidation.test.ts` (43), ganze Suite grün, `tsc -b` grün, `mcp-server` 117 grün (Kopie kompiliert)

**Dependencies:** 39
**Files:** `src/mcp/templateValidation.ts`, `src/mcp/protocol.ts`, Test · **Scope:** M

## Task 47: Die drei Befehle

**Description:** Handler in `mcpBridge.ts` für `get_device_template`, `create_device_template` und
`update_device_template` über `centralLibrary` (angemeldet nach Odoo, sonst Browser mit `stored:
"browser"`). Dazu Dubletten-Prüfung, Schutz der mitgelieferten und Community-Bibliothek,
`removedPorts` mit `connectedInOpenDrawing` und Einträge in `TOOLS`.

**Acceptance criteria:**
- [x] Anlegen, dann `search_templates` und `add_device` mit den richtigen Ports; Dublette (Hersteller+Modell, auch gegen die mitgelieferte Bibliothek) nur mit `allowDuplicate`
- [x] Abgeleitete Endstufe: `speaker_load_report` bewertet wie bei der Basis (Blaze mit angeschlossenem Lautsprecher, gleiche Werte)
- [x] Ändern mit alter `baseVersion` meldet den Konflikt (Satz aus Odoo); Bibliotheksvorlagen werden mit Vorschlag `create_device_template` + `baseTemplateId` abgelehnt
- [x] `/face/service/call` nimmt die drei Befehle an
- Zusätzlich: ohne Anmeldung `stored: "browser"`; `productId` nur zentral; nur Artikel ändern geht ohne Version; `connectedInOpenDrawing` über `templatePortId` der platzierten Geräte; Geräte in der Zeichnung bleiben unverändert. Die Befehle prüfen gegen die bekannte Bibliothek ohne Netz (`getKnownLibraryTemplates`).

**Verification:**
- [x] `npx vitest run src/__tests__/mcpDeviceTemplate.test.ts` (19), ganze Suite 2575 grün, `cd mcp-server && npm test` 119 grün, `npx tsc -b` grün

**Dependencies:** 44, 46
**Files:** `src/mcpBridge.ts`, `src/mcp/protocol.ts`, `mcp-server/src/tools.ts`, Test · **Scope:** M

## Task 48: Leitfaden, Handbuch, Ende-zu-Ende

**Description:** Ein Abschnitt in `prompts.ts`: erst suchen, dann ableiten, Werte nennen, vor dem
Ändern lesen, Drift ansagen. Dazu ein Handbuch-Absatz. Ende-zu-Ende über `/face/service/call` gegen
das lokale Backend mit einem verbundenen Tab.

**Acceptance criteria:**
- [x] Der Katalog enthält den Abschnitt; die Odoo-Seite zeigt ihn ohne Codeänderung (fünftes Playbook
  `device-template` + Absatz in den Anweisungen; `/face/service/catalog` liefert beides)
- [x] Ende-zu-Ende (27.11., `/face/service/call`, Tab mit `VITE_FACE_BACKEND=1`, Mock-Odoo; 25 Prüfungen,
  61 Aufrufe): MotionCam Outdoor ohne Basis angelegt (Odoo, Herkunft claude), gesetzt, mit Ajax Hub 2 Plus
  verbunden, Reichweite mit `baseVersion` nachgetragen (Version 2), veraltete Version abgelehnt; MFA208 als
  vorhandene Vorlage erkannt und Doppel abgelehnt; Variante von Blaze PowerZone 504D abgeleitet, mit Bose
  FS2C verbunden, Lastprüfung sieht ihn; Artikel 9001 verknüpft ohne Versionssprung; verbundener Port aus
  der Vorlage entfernt → `connectedInOpenDrawing`, Gerät und Verbindung bleiben
- [x] Fund im Lauf: gesetzte Geräte haben eigene Port-IDs. Die Beschreibung von `create_device_template`
  versprach Ports „ready for connect_devices“; jetzt sagen sie und das Playbook: erst `get_device`

**Verification:**
- [x] `cd mcp-server && npm test` (123, davon 4 neue in `prompts.test.ts`), Docs-Typecheck ohne neue Fehler

**Dependencies:** 47
**Files:** `mcp-server/src/prompts.ts`, Test, `docs/src/pages{,-de}/…` · **Scope:** S

## Checkpoint K — Freigabe, Push
