# Tasks: backend-deploy + face-identity

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
