# Spec: cloud-bridge

Modul aus `CAPABILITY-MAP.md` · hängt ab von face-identity · Stand 2026-11-10

## Objective

Claude soll im offenen Schaltplan arbeiten können, ohne dass auf dem Rechner etwas
installiert ist. Heute vermittelt dazu ein lokaler MCP-Server auf `127.0.0.1` zwischen Claude
Desktop und dem Tab. Dieses Modul gibt dem FACESchematic-Backend dieselbe Vermittlerrolle:
Es nimmt Befehle für einen Odoo-Nutzer entgegen und reicht sie an **dessen** offenen,
angemeldeten Tab weiter. Wer die Befehle schickt, regelt `odoo-mcp-schaltplan` (der
Odoo-Connector); dieses Modul liefert die Strecke Backend ↔ Tab und den Dienst-Zugang.

Die 47 Befehle selbst (Geräte, Verbindungen, Räume, Racks, Grundrisse …) bleiben, wie sie sind:
Sie laufen im Tab (`src/mcpBridge.ts`) gegen den Store, mit Undo und Autosave.

User Stories:
1. Ich bin auf schematic.face-gmbh.com mit Odoo angemeldet und schalte unter Einstellungen →
   KI „Claude über den Odoo-Connector arbeiten lassen“ ein. Der Status zeigt „Verbunden“.
2. Bitte ich Claude (claude.ai, Desktop, Handy oder Jarvis), im Schaltplan etwas zu tun,
   passiert es in diesem Tab — und nur in meinem, nie im Tab eines Kollegen.
3. Habe ich zwei Tabs mit eingeschaltetem Schalter, arbeitet Claude im zuletzt
   eingeschalteten; der andere zeigt „Ein anderer Tab hat die KI-Verbindung übernommen“.
4. Ist kein Tab verbunden, sagt Claude genau das und wie man es einschaltet.
5. Der lokale Weg (Claude Desktop + lokaler Server) bleibt als zweite Option erhalten.

Zusätzlich lernt der Tab vier Befehle für Odoo-Zeichnungen (aus odoo-drawings):
`get_editor_status`, `open_odoo_drawing`, `save_odoo_drawing`, `new_odoo_drawing`.

## Schnittstelle (Backend)

Für den Tab (Sitzung aus face-identity, `X-FACE-Request`):

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/face/bridge/hello` | `{ tabId, schematicName, protocolVersion }` → dieser Tab wird für den Nutzer gebunden |
| GET | `/face/bridge/poll?tabId=` | wartet bis 25 s → `{ type: "command", requestId, command, params }`, `{ type: "superseded" }` oder 204 |
| POST | `/face/bridge/respond` | `{ tabId, requestId, ok, result \| error }` |

Für den Odoo-Connector (Dienst-Zugang, `Authorization: Bearer <FACE_SERVICE_TOKEN>`):

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/face/service/call` | `{ uid, command, params }` → Ergebnis des Tabs, oder 409 `{ reason: "no-tab" }` mit deutscher Anleitung, 504 bei Zeitüberschreitung (60 s) |
| GET | `/face/service/catalog` | Befehlsliste mit Parametern und Playbooks (aus `mcp-server/src/tools.ts` / `prompts.ts` — eine Quelle) |

- Long-Polling statt WebSocket: geht durch Nginx Proxy Manager und App-nginx ohne Umstellung.
- Ein gebundener Tab je Odoo-Nutzer; ein Tab, der 40 s nicht pollt, gilt als weg.
- `uid` kommt vom Odoo-Connector (aus dem angemeldeten Odoo-Nutzer, nie vom Modell); das
  Backend glaubt ihn nur mit gültigem Dienst-Token (zeitkonstanter Vergleich).
- `FACE_SERVICE_TOKEN`: erzeugt der Deploy-Workflow einmalig in `~/faceschematic/backend.env`,
  wie `FACE_SECRET`. Jean-Luc trägt ihn einmal in Odoo als Systemparameter ein
  (`face_schematic.token`, siehe SPEC-odoo-mcp-schaltplan). Ohne Token sind `/face/service/*` aus (503).

## Frontend

- Einstellungen → KI im FACE-Build: zwei Wege.
  - **Über den Odoo-Connector** (Standard): ein Schalter, kein Token, kein Port; nur angemeldet
    möglich, sonst Hinweis „Erst oben rechts mit Odoo anmelden“.
  - **Lokal (Claude Desktop)**: wie heute, mit Token und Port.
- `mcpBridge.ts` bekommt einen zweiten Transportweg (Long-Polling) neben dem WebSocket; die
  Befehls-Handler bleiben unverändert und gelten für beide Wege. Status-Anzeige wie heute.
- Ein abgemeldeter Nutzer (401 beim Poll) trennt die Verbindung und zeigt den Hinweis.

## Commands / Structure / Style

Wie `SPEC-backend-deploy.md`. Neu: `mcp-server/src/cloud/relay.ts` (+ Tests),
`mcp-server/src/cloud/service.ts` (Dienst-Zugang); geändert: `server.ts`, `src/mcpBridge.ts`,
`src/mcp/protocol.ts` (neue Befehle), `src/components/PreferencesDialog.tsx`,
`.github/workflows/deploy.yml` (Token), `src/i18n/de/settings.ts`.

## Testing Strategy

- Backend (`node:test`): Befehl landet beim Tab des richtigen Nutzers und nicht bei einem
  anderen; Antwort kommt zurück; zweiter Tab löst den ersten ab; kein Tab → 409 mit Anleitung;
  Zeitüberschreitung → 504; ohne/mit falschem Token → 401; ohne konfigurierten Token → 503;
  Poll ohne Sitzung → 401.
- Frontend (`vitest`): Transport Long-Polling führt einen Befehl über die vorhandenen Handler
  aus und antwortet; die vier neuen Odoo-Befehle.
- Ende-zu-Ende (Playwright): Tab einschalten, über `/face/service/call` mit Token einen
  `add_device` schicken → Gerät erscheint im Tab; zweiter Nutzer bekommt den Befehl nicht.

## Boundaries

- Always: Befehle nur an den Tab des Nutzers, für den der Odoo-Connector fragt; Dienst-Token
  nur im Server-zu-Server-Verkehr.
- Ask first: Befehle ohne offenen Tab (Bearbeiten auf dem Server), weitere Dienst-Clients
  außer Odoo.
- Never: das Dienst-Token im Browser oder im Repository; einem Modell die Wahl des Nutzers
  überlassen.

## Success Criteria

1. Mit eingeschaltetem Schalter führt ein `/face/service/call` für meine uid einen Befehl in
   meinem Tab aus und liefert dessen Ergebnis.
2. Derselbe Aufruf für eine andere uid erreicht meinen Tab nie.
3. Ohne verbundenen Tab kommt eine deutsche Anleitung zurück, kein technischer Fehler.
4. Der lokale Weg funktioniert unverändert.
5. Alle bestehenden Tests grün.

## Open Questions

Keine.
