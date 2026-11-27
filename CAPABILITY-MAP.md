# Capability Map: Odoo-Speicher und Cloud-Connector

Stand: 2026-10-19 · freigegeben von Jean-Luc Doijen · geändert 2026-11-10 (Claude über den Odoo-Connector statt eigenem Connector; Gerätedatenbank vorgemerkt) · geändert 2026-11-27 (Gerätedatenbank zentral für alle eigenen Geräte, neues Modul `device-template`)

Ziel: Zeichnungen liegen zentral an Odoo-Projekten, jeder mit Projektzugriff kann sie
öffnen; Claude (claude.ai, Desktop, Handy, Jarvis) bearbeitet den offenen Schaltplan über den
FACE-Odoo-Connector, den alle schon verbunden haben. Ersetzt in diesem Punkt die Richtung „nur Zeichnung → Odoo“ aus
`ODOO_INTEGRATION_PLAN.md` (14.08.).

| Modul | Aufgabe | Hängt ab von |
|---|---|---|
| `backend-deploy` | Backend-Container, nginx-Weiterleitung, Geheimnis, Deploy-Workflow | — |
| `face-identity` | Anmeldung mit Odoo (E-Mail + API-Schlüssel), Browser-Sitzung, verschlüsselte Schlüssel | backend-deploy |
| `odoo-drawings` | Projekte und Zeichnungen in Odoo lesen/schreiben, Sperre, „Aus Odoo öffnen“ / „In Odoo speichern“ | face-identity |
| `cloud-bridge` | Tab ↔ Backend (Long-Polling), Weiterleitung der Werkzeugaufrufe, KI-Einstellung ohne Token | face-identity |
| ~~`claude-connector`~~ | entfällt (10.11.): kein zweiter Connector mit eigener Anmeldung | — |
| `odoo-mcp-schaltplan` | Schaltplan-Werkzeuge im Odoo-Connector (`face_mcp_server`, Repo `facegmbh/Odoo`), rufen das Backend mit Dienst-Token + Odoo-Nutzer | cloud-bridge, odoo-drawings |
| `odoo-device-library` | Alle eigenen Geräte zentral in Odoo (Modell `face.schematic.template`), Editor liest und schreibt dort, Hochladen der Browser-Vorlagen, optional verknüpft mit dem Odoo-Artikel (27.11.) — **Spec-Entwurf** | face-identity |
| `device-template` | Claude legt Gerätevorlagen über den Connector an, liest und bearbeitet sie, auch mit Last-, Melder- und Mikrofondaten (27.11.) — **Spec-Entwurf** | odoo-device-library, odoo-mcp-schaltplan |
| `schaltplan-layout` | Claude gliedert örtlich (Orte → Racks), prüft Überlappungen und Leitungsführung, ordnet, verlegt neu und sieht das Ergebnis als Bild (21.11.) | cloud-bridge |
| `schaltplan-leitungen` | Keine Linien außerhalb der Zeichnung und über Text: Port-Seiten wählen, Ortsnamen/Notizen als Hindernisse, Ränder und Abstände, eigene Stützpunkte (21.11.) | schaltplan-layout |
| `schaltplan-rahmen` | Keine Linien auf Rahmen oder durch fremde Orte/Bereiche (Router, für alle Zeichnungen), Geräte leicht verschieben für gerade Leitungen (22.11.) | schaltplan-leitungen |
| `schaltplan-lebenszyklus` | Zeichnung durch Kalkulation → Angebot → Auftrag → Montage/Abnahme → Wartung: Abgleich Zeichnung ↔ Positionen, Seriennummern/Asset-IDs, Verknüpfung mit der Anlage (`face.installation`) — **vorgemerkt, Spec folgt** | odoo-mcp-schaltplan, odoo-device-library |

Reihenfolge: backend-deploy + face-identity → odoo-drawings, cloud-bridge → odoo-mcp-schaltplan → schaltplan-layout → schaltplan-leitungen → schaltplan-rahmen → odoo-device-library → device-template → schaltplan-lebenszyklus

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
