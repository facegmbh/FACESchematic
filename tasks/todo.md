# Tasks: backend-deploy + face-identity + odoo-drawings

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
