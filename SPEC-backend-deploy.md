# Spec: backend-deploy

Modul aus `CAPABILITY-MAP.md` · hängt von nichts ab · Stand 2026-10-19

## Objective

Ein FACE-eigenes Backend läuft neben der App auf face-docker1 und ist unter derselben
Adresse `https://schematic.face-gmbh.com` erreichbar — ohne neuen DNS-Eintrag, ohne neues
Zertifikat und ohne Handgriff im Nginx Proxy Manager. Es ist die Grundlage für
face-identity, odoo-drawings, cloud-bridge und claude-connector; in diesem Modul liefert es
nur `/face/health`.

Nutzer merken nichts davon. Betrieb: ein `git push` auf `master` baut und startet beide
Container wie bisher die App.

## Tech Stack

- Node 22 (Alpine-Image), TypeScript 5.x, Express 5 (über `@modelcontextprotocol/sdk` 1.29
  ohnehin installiert, wird explizite Abhängigkeit), Paket `mcp-server/` mit zweitem
  Einstiegspunkt `dist/cloud/server.js`.
- Docker Compose (Projekt `faceschematic`), App-nginx als einziger Eingang.

## Commands

```
Build:   cd mcp-server && npm ci && npm run build
Test:    cd mcp-server && npm test
Start:   FACE_SECRET=… FACE_PUBLIC_URL=http://localhost:5173 DATA_DIR=./.data node mcp-server/dist/cloud/server.js
Dev:     npm run dev   (Vite leitet /face/** an http://localhost:8787 weiter)
Deploy:  git push origin master   (Runner auf face-docker1: docker compose -p faceschematic up -d --build)
```

## Project Structure

```
mcp-server/src/cloud/        → Backend-Quellcode (server.ts als Einstieg)
mcp-server/src/cloud/*.test.ts → Tests (node:test), laufen gegen den gebauten Code
mcp-server/Dockerfile.cloud  → Image des Backends
docker/nginx.conf            → Weiterleitung /face/ (und später OAuth/MCP) an das Backend
compose.yml                  → zweiter Dienst `backend` mit Volume für /data
.github/workflows/deploy.yml → Geheimnis anlegen/einsetzen, Healthcheck um /face/health erweitern
vite.config.ts               → Dev-Proxy für /face
```

## Code Style

Wie `mcp-server/src`: ESM, strikte Typen, kleine Module, deutschsprachige Meldungen an den
Nutzer, englische Bezeichner und Kommentare im Stil des übrigen Codes.

```ts
app.get("/face/health", (_req, res) => res.json({ status: "ok", version: VERSION }));
```

## Konfiguration

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `FACE_SECRET` | ja | ≥ 32 Zeichen; verschlüsselt die hinterlegten API-Schlüssel |
| `FACE_PUBLIC_URL` | ja | `https://schematic.face-gmbh.com` |
| `ODOO_URL` | nein | Standard `https://facegmbh-odoo.odoo.com` |
| `ODOO_DB` | nein | sonst automatisch ermittelt |
| `DATA_DIR` | nein | Standard `/data` (Docker-Volume) |
| `PORT` | nein | Standard `8787` |

Das Geheimnis liegt auf face-docker1 in `~/faceschematic/backend.env`. Fehlt die Datei,
erzeugt der Deploy-Workflow sie einmalig (`openssl rand`) — kein Handgriff nötig — und
kopiert sie vor `docker compose up` als `.env` in den Checkout. Es steht nie im Repository.

## Testing Strategy

- Unit: `node:test` im Paket `mcp-server` (bestehender `npm test`, erweitert auf `dist/**`).
- Integration: Server startet in einem Test auf zufälligem Port, `/face/health` antwortet;
  fehlendes oder zu kurzes `FACE_SECRET` bricht mit klarer Meldung ab.
- Abnahme auf face-docker1: Healthcheck im Workflow prüft `http://localhost:8080/face/health`
  (also durch den App-nginx hindurch), und `https://schematic.face-gmbh.com/face/health`
  antwortet von außen.

## Boundaries

- Always: App-nginx bleibt einziger Eingang; Backend-Port nur im Compose-Netz, nicht am Host.
  `/api/**` bleibt wie es ist (nur `GET /api/templates` nach außen).
- Ask first: Änderungen am Nginx Proxy Manager, neue Domains, Änderungen an der CSP über
  `connect-src 'self'` hinaus.
- Never: Geheimnisse ins Repository; Zeichnungen oder API-Schlüssel an Dritte.

## Success Criteria

1. `npm test` in `mcp-server` grün, App-Tests (`npx vitest run`) und `tsc -b` unverändert grün.
2. Nach Deploy: `curl https://schematic.face-gmbh.com/face/health` → `{"status":"ok",…}`.
3. Ein zweiter Deploy behält dasselbe Geheimnis (Datei wird nicht neu erzeugt).
4. Die App unter `/` und die Gerätebibliothek unter `/api/templates` funktionieren wie vorher.
5. Ohne `FACE_SECRET` startet der Container nicht und nennt den Grund im Log.

## Open Questions

Keine.
