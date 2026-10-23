# Implementation Plan: backend-deploy + face-identity + odoo-drawings

Specs: `SPEC-backend-deploy.md`, `SPEC-face-identity.md`, `SPEC-odoo-drawings.md` · Karte: `CAPABILITY-MAP.md`

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
- [ ] Task 8: Frontend-Client — Odoo-Zustand, Herzschlag, Freigabe, Fingerabdruck
- [ ] Task 9: „In Odoo speichern…“ und Strg+S-Weiche
- [ ] Task 10: „Aus Odoo öffnen…“ mit Rückfrage bei Ungespeichertem
- [ ] Task 11: Sperr-Leiste, Zuschauer-Anzeige, Rückfrage vor Überschreiben

### Checkpoint C (Freigabe, dann Push auf master)
- [ ] Alle Tests und Build grün
- [ ] Ende-zu-Ende mit zwei Nutzern (zwei Browser-Kontexte, Mock-Odoo): Speichern, Öffnen beim zweiten → Leiste, Zuschauer beim ersten, Freigabe nach Schließen
- [ ] Nach Deploy: Jean-Luc speichert an einem echten Projekt, sieht den Anhang in Odoo, öffnet von einem zweiten Gerät

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Kaputtes nginx.conf ersetzt die laufende App | Hoch | `nginx -t` im Image-Build; Laufzeit-Auflösung von `backend` |
| Kein Docker lokal, Container erst auf face-docker1 testbar | Mittel | Backend lokal per Node getestet; Healthcheck im Workflow durch den App-nginx |
| Workflow-Checkout löscht `.env` | Mittel | Geheimnis außerhalb des Checkouts, vor `compose up` kopiert |
| Odoo sperrt die IP nach Fehlversuchen (Fail2Ban) | Hoch | Rate-Limit je IP + 5 min Pause nach abgelehnter Anmeldung (wie face-odoo-mcp) |
| `/web/database/list` auf Odoo.sh abgeschaltet | Niedrig | `ODOO_DB` setzbar; face-odoo-mcp nutzt dieselbe Ermittlung erfolgreich |
| Große Zeichnungen (PDF-Unterlage) sprengen Odoo-Upload-Grenze | Mittel | 64 MB-Grenze in nginx; Fehlermeldung von Odoo durchreichen; beim Abnahme-Test eine Zeichnung mit Unterlage speichern |
| Zuordnung bleibt nach „Neu“/„Datei öffnen“ hängen → Strg+S überschreibt die falsche Odoo-Zeichnung | Hoch | Zuordnung endet bei jedem fremden Laden (loadSeq), Test dafür in Task 8 |
| Sperre verfällt bei Funkloch, ein anderer speichert dazwischen | Mittel | Veraltet-Prüfung über `write_date` (Task 7/11) |

## Open Questions

Keine.
