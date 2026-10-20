# Implementation Plan: backend-deploy + face-identity

Specs: `SPEC-backend-deploy.md`, `SPEC-face-identity.md` · Karte: `CAPABILITY-MAP.md`

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
- [ ] Nach Deploy: `https://schematic.face-gmbh.com/face/health` antwortet, App läuft wie vorher

### Phase 2: face-identity
- [ ] Task 4: Anmelde-API gegen Odoo (Login, Me, Logout) mit Mock-Odoo-Tests
- [ ] Task 5: Anmeldung im Editor (Client, Store, Dialog, Knopf, Texte)

### Checkpoint B (Freigabe, dann Push auf master)
- [ ] Alle Tests und Build grün
- [ ] Lokal Ende-zu-Ende: Backend gegen Mock-Odoo, Vite-Dev mit Proxy, Anmelden/Abmelden im Browser (Playwright)
- [ ] Nach Deploy: Jean-Luc meldet sich mit echtem Odoo-Konto an

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Kaputtes nginx.conf ersetzt die laufende App | Hoch | `nginx -t` im Image-Build; Laufzeit-Auflösung von `backend` |
| Kein Docker lokal, Container erst auf face-docker1 testbar | Mittel | Backend lokal per Node getestet; Healthcheck im Workflow durch den App-nginx |
| Workflow-Checkout löscht `.env` | Mittel | Geheimnis außerhalb des Checkouts, vor `compose up` kopiert |
| Odoo sperrt die IP nach Fehlversuchen (Fail2Ban) | Hoch | Rate-Limit je IP + 5 min Pause nach abgelehnter Anmeldung (wie face-odoo-mcp) |
| `/web/database/list` auf Odoo.sh abgeschaltet | Niedrig | `ODOO_DB` setzbar; face-odoo-mcp nutzt dieselbe Ermittlung erfolgreich |

## Open Questions

Keine.
