# Tasks: backend-deploy + face-identity + odoo-drawings + cloud-bridge + odoo-mcp-schaltplan

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
- [ ] Ohne/mit falschem Token 401, ohne konfigurierten Token 503, unbekannter Befehl 400
- [ ] Mit Token und gebundenem Tab kommt das Tab-Ergebnis zurück; ohne Tab 409 mit Anleitung; 504 nach Zeitüberschreitung
- [ ] `catalog` enthält alle Werkzeuge aus `tools.ts` und die Playbooks; Token-Wert erscheint in keinem Log

**Verification:** `cd mcp-server && npm test`

**Dependencies:** Task 13 · **Files:** `service.ts`, `service.test.ts`, `config.ts`, `server.ts` · **Scope:** M

## Task 15: Deploy — `FACE_SERVICE_TOKEN` einmalig erzeugen und durchreichen

**Description:** Der Workflow-Schritt „Backend-Geheimnis einsetzen“ ergänzt in
`~/faceschematic/backend.env` eine Zeile `FACE_SERVICE_TOKEN=$(openssl rand -hex 32)`, nur wenn
sie fehlt (die vorhandene Datei mit `FACE_SECRET` bleibt sonst unberührt). `compose.yml` reicht
die Variable an `backend` weiter. Die Datei wird nie ausgegeben.

**Acceptance criteria:**
- [ ] Vorhandene `backend.env` ohne Token → Token ergänzt, `FACE_SECRET` unverändert
- [ ] Zweiter Lauf ändert nichts; neue Anlage erzeugt beide Zeilen mit Rechten 600

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
- [ ] Ein Befehl aus dem (gemockten) Poll läuft über die vorhandenen Handler und wird beantwortet
- [ ] `unbound` führt zu neuem `hello`; `superseded` und 401 halten an und setzen den Status-Text
- [ ] Die bestehenden MCP-Tests (`mcpEditing`, `mcpFloorplan`, `mcpValidation`) bleiben grün

**Verification:** `npx vitest run`, `npx tsc -b`

**Dependencies:** Task 13 (Vertrag) · **Files:** `src/mcpBridge.ts`, `src/__tests__/mcpRelay.test.ts`, `src/mcp/protocol.ts` · **Scope:** M

## Task 17: Einstellungen → KI mit zwei Wegen

**Description:** Store-Einstellung `mcpBridgeMode` (`"odoo" | "local"`, localStorage wie die
anderen `mcp…`-Werte). Im FACE-Build zeigt Einstellungen → KI die Wahl „Über den Odoo-Connector“
(Standard, nur Schalter; nicht angemeldet → Hinweis statt Schalter) und „Lokal (Claude Desktop)“
(Token + Port wie heute). `useMcpBridge` startet den passenden Transport; Abmelden stoppt den
Odoo-Weg. Ohne FACE-Build unverändert.

**Acceptance criteria:**
- [ ] FACE-Build, angemeldet: Schalter ein → Status „Verbunden“ (gegen Backend + Mock-Odoo)
- [ ] Nicht angemeldet → Hinweis, kein Start; Umschalten auf „Lokal“ zeigt Token/Port und nutzt den WebSocket
- [ ] Upstream-Build zeigt die Einstellung wie bisher; `npm run i18n:check` grün

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
- [ ] Ungespeicherte Änderungen → Öffnen/Neu verweigern mit Satz, mit `discardChanges` erlaubt
- [ ] Speichern bei fremder Sperre oder veraltetem Stand verweigert mit Namen; mit `force` nur der Veraltet-Fall
- [ ] Nicht angemeldet → klarer Fehler; die Befehle erscheinen im Katalog

**Verification:** `npx vitest run` (mit gemocktem `faceApi`), `cd mcp-server && npm test`, `npx tsc -b`

**Dependencies:** Task 16 · **Files:** `src/mcp/protocol.ts`, `src/mcpBridge.ts`, `mcp-server/src/tools.ts`, `mcp-server/src/prompts.ts`, Test · **Scope:** M

## Task 19: Ende-zu-Ende und Hilfeseite

**Description:** Playwright gegen `vite build` + `vite preview`, Backend (mit Test-Token) und
Mock-Odoo: zwei Nutzer, beide schalten ein; `/face/service/call` für uid 8 mit `add_device` →
Gerät erscheint nur bei Nutzer 8; `get_editor_status` für uid 9 nennt dessen Zeichnung; Tab im
Hintergrund bleibt verbunden. Hilfeseite „KI-Assistent“ um den Odoo-Weg ergänzen.

**Acceptance criteria:**
- [ ] Ende-zu-Ende grün, inkl. Ablösung durch einen zweiten Tab
- [ ] Hilfeseite erklärt: anmelden, Schalter, in claude.ai „Schaltplan“ fragen; der lokale Weg bleibt beschrieben

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
