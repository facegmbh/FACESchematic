# Capability Map: Odoo-Speicher und Cloud-Connector

Stand: 2026-10-19 · freigegeben von Jean-Luc Doijen

Ziel: Zeichnungen liegen zentral an Odoo-Projekten, jeder mit Projektzugriff kann sie
öffnen; Claude (claude.ai, Desktop, Handy) bearbeitet den offenen Schaltplan über einen
FACE-eigenen Connector. Ersetzt in diesem Punkt die Richtung „nur Zeichnung → Odoo“ aus
`ODOO_INTEGRATION_PLAN.md` (14.08.).

| Modul | Aufgabe | Hängt ab von |
|---|---|---|
| `backend-deploy` | Backend-Container, nginx-Weiterleitung, Geheimnis, Deploy-Workflow | — |
| `face-identity` | Anmeldung mit Odoo (E-Mail + API-Schlüssel), Browser-Sitzung, verschlüsselte Schlüssel | backend-deploy |
| `odoo-drawings` | Projekte und Zeichnungen in Odoo lesen/schreiben, Sperre, „Aus Odoo öffnen“ / „In Odoo speichern“ | face-identity |
| `cloud-bridge` | Tab ↔ Backend (Long-Polling), Weiterleitung der Werkzeugaufrufe, KI-Einstellung ohne Token | face-identity |
| `claude-connector` | OAuth für claude.ai, `/mcp`-Endpunkt, Odoo-Werkzeuge für Claude | cloud-bridge, odoo-drawings |

Reihenfolge: backend-deploy + face-identity → odoo-drawings, cloud-bridge → claude-connector

## Übergreifende Entscheidungen

- Backend erweitert das Paket `mcp-server/` (zweiter Einstiegspunkt), damit die
  Werkzeugliste und die Playbooks nur einmal existieren.
- Es gelten die Odoo-Rechte des angemeldeten Nutzers; das Backend vergibt keine eigenen.
- Speichern überschreibt den Anhang — keine Versionshistorie.
- Fremde Sperre: man wartet, oder speichert unter neuem Namen. Niemand übernimmt die
  Sperre eines anderen.
- Datei speichern und Browser-Sicherung bleiben; Odoo kommt dazu, kein Auto-Speichern nach Odoo.
- Claude arbeitet im offenen Tab. Bearbeiten ohne Tab ist nicht Teil dieses Vorhabens.
- Jedes Modul geht erst nach Freigabe auf `master` (= live auf face-docker1).

Spezifikationen: `SPEC-<modul>.md` neben dieser Datei.
