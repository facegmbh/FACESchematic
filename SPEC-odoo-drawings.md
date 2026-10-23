# Spec: odoo-drawings

Modul aus `CAPABILITY-MAP.md` · hängt ab von face-identity · Stand 2026-10-22

## Objective

Zeichnungen liegen an Odoo-Projekten, und jeder mit Zugriff auf das Projekt kann sie öffnen.
Es bearbeitet immer nur einer; die anderen sehen, wer, und können lesen oder eine Kopie
unter neuem Namen speichern.

User Stories:
1. **In Odoo speichern…** (Menü Datei): Projekt suchen (Projekt- oder Kundenname, z. B.
   „Soccerbeat“ oder „FACE/26/10/560“), Namen der Zeichnung eingeben (vorbelegt mit dem
   Schaltplan-Namen), speichern. Danach steht oben „Projekt › Zeichnung“.
2. **Aus Odoo öffnen…** (Menü Datei): Projekt suchen → Liste seiner Zeichnungen mit
   Name, „zuletzt gespeichert von … am …“ und „in Bearbeitung von … seit …“ → öffnen.
3. **Speichern / Strg+S** speichert eine aus Odoo geöffnete Zeichnung zurück an ihr
   Projekt (Meldung „In Odoo gespeichert“). Für alles andere bleibt Speichern wie bisher
   (Datei auf dem Rechner).
4. **Sperre:** Wer eine Zeichnung öffnet oder anlegt, bearbeitet sie. Öffnet ein anderer sie
   gleichzeitig, sieht er eine Leiste „In Bearbeitung von X seit 14:05 — nur lesen“. Strg+S
   bietet ihm dann „In Odoo speichern unter…“ (neue Zeichnung) an. Niemand übernimmt die
   Sperre eines anderen; sie fällt 90 s nach Schließen des Tabs weg.
5. **Wer noch zuschaut:** Wer bearbeitet, sieht neben „Projekt › Zeichnung“, wer dieselbe
   Zeichnung gerade zusätzlich offen hat („Auch geöffnet von: Max (liest mit)“).
6. **Nicht still überschreiben:** Hat seit dem Öffnen jemand anderes gespeichert (z. B. nach
   einem Verbindungsabbruch, der die Sperre verfallen ließ), fragt Strg+S: „Max hat um 15:10
   gespeichert — trotzdem überschreiben, oder unter neuem Namen speichern?“
7. **Eigener zweiter Tab:** Habe ich dieselbe Zeichnung in einem anderen Tab offen, zeigt die
   Leiste „In einem anderen Tab von dir in Bearbeitung“ mit dem Knopf „Hier bearbeiten“.
8. **Ungespeichertes:** Vor „Aus Odoo öffnen“ fragt die App, wenn die offene Odoo-Zeichnung
   seit dem letzten Speichern geändert wurde.
9. **Neu laden:** Nach einem Neuladen des Tabs weiß die App weiter, zu welchem Projekt und
   welcher Zeichnung der Inhalt gehört, und holt sich die Sperre neu.
10. **Nicht angemeldet:** Die Menüpunkte öffnen zuerst „Mit Odoo anmelden“.

In Odoo erscheint eine Zeichnung als Anhang des Projekts (`<Name>.faceschematic.json`) — dort
lässt sie sich auch herunterladen oder löschen.

**Nicht Teil dieses Moduls:** Versionen (Speichern überschreibt), Löschen und Umbenennen in
der App, Zuordnung zu einer Anlage (`face.installation`), Claude-Werkzeuge (claude-connector).

## Schnittstelle (Backend, alle unter `/face/api`, Sitzung nötig, sonst 401)

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/projects?q=` | bis 50 Projekte, Name oder Kunde passt, zuletzt geänderte zuerst |
| GET | `/projects/:id/drawings` | Zeichnungen des Projekts inkl. `editedBy` |
| GET | `/drawings/:id` | Inhalt + Projektname + Metadaten |
| POST | `/projects/:id/drawings` | `{ name, data, tabId }` → neue Zeichnung, Sperre für `tabId` |
| PUT | `/drawings/:id` | `{ data, tabId, baseWriteDate, force? }` → überschreiben; nur mit eigener Sperre (sonst 409 `locked`); hat jemand anderes seit `baseWriteDate` gespeichert, 409 `stale` mit `{ writtenBy, writeDate }`, außer `force` |
| POST | `/drawings/:id/lock` | `{ tabId, takeOver? }` → `{ ok: true, viewers }` oder 409 `{ holder: { name, since, sameUser }, viewers }`; zugleich Herzschlag |
| POST | `/drawings/:id/view` | `{ tabId }` → Herzschlag eines nur lesenden Tabs; `{ holder, viewers }` |
| POST | `/drawings/:id/unlock` | `{ tabId }` → Sperre frei (beim Schließen per `fetch(keepalive)`) |

- Odoo-Zugriff mit dem Schlüssel des angemeldeten Nutzers — Odoo entscheidet, wer welches
  Projekt sieht. Gelesen und geschrieben werden nur `ir.attachment` mit `res_model =
  project.project` und Namensendung `.faceschematic.json`.
- Sperren im Speicher des Backends: Herzschlag alle 30 s, verfällt nach 90 s; ein Neustart
  löscht sie, die Tabs holen sie sich mit dem nächsten Herzschlag zurück.
- `takeOver` wirkt nur gegenüber einem Tab desselben Nutzers.
- `viewers`: Namen der Nutzer, die die Zeichnung gerade nur lesend offen haben (Herzschlag
  ≤ 90 s alt), ohne den Fragenden selbst.
- Größe: bis 64 MB je Zeichnung (nginx-Grenze aus backend-deploy).

## Frontend

- Zustand der offenen Odoo-Zeichnung (`projectId`, `projectName`, `drawingId`, `name`,
  Sperrstatus, Stand beim letzten Speichern) im Store; reist in der Browser-Sicherung mit,
  nicht in der Projektdatei.
- `tabId` je Tab (sessionStorage), Herzschlag solange eine Odoo-Zeichnung offen ist.
- Zwei Dialoge (Öffnen, Speichern unter) mit Projektsuche, eine Hinweisleiste für die Sperre,
  Menüpunkte in Datei, Strg+S-Weiche; alles nur im FACE-Build (`VITE_FACE_BACKEND=1`).
- Gestaltung und Bedienbarkeit wie FaceLoginDialog (Rolle dialog, Labels, Tastatur).

## Commands / Structure / Style

Wie `SPEC-backend-deploy.md`. Neu: `mcp-server/src/cloud/drawings.ts` (+ Tests),
`src/faceDrawings.ts` (Client, Sperre, Herzschlag), `src/components/OdooOpenDialog.tsx`,
`src/components/OdooSaveDialog.tsx`, `src/components/OdooLockBanner.tsx`; geändert:
`server.ts`, `auth.ts` (Sitzungs-Middleware), `MenuBar.tsx`, `store.ts`, `src/i18n/de/*`.

## Testing Strategy

- Backend (`node:test`, Mock-Odoo um `project.project` / `ir.attachment` erweitert): Liste,
  Anlegen, Laden, Speichern; fremde Anhänge werden nicht gelesen; Sperre: zweiter Nutzer →
  409 mit Name, eigener zweiter Tab mit `takeOver`, Verfall nach 90 s, Speichern ohne
  Sperre → 409; Zuschauer erscheinen in `viewers` und verschwinden nach 90 s; veralteter
  `baseWriteDate` → 409 `stale`, mit `force` gespeichert.
- Frontend (`vitest`): Client, Herzschlag/Freigabe, Strg+S-Weiche, „geändert seit Speichern“.
- Ende-zu-Ende (Playwright, Backend + Mock-Odoo): Speichern unter → Öffnen in zweitem
  Browser-Kontext als anderer Nutzer zeigt die Leiste; Schließen des ersten → Sperre frei.
- Abnahme durch Jean-Luc: an einem echten Projekt speichern, in Odoo als Anhang sehen,
  von einem zweiten Gerät öffnen.

## Boundaries

- Always: nur eigene `.faceschematic.json`-Anhänge an Projekten anfassen; Odoo-Rechte gelten.
- Ask first: Speichern an anderen Modellen (Anlage, Aufgabe), Löschen aus der App, Versionen.
- Never: fremde Sperren brechen; Zeichnungen im Backend zwischenspeichern.

## Success Criteria

1. Eine Zeichnung, in der App „In Odoo gespeichert“, liegt als Anhang am gewählten Projekt.
2. Ein Kollege mit Projektzugriff öffnet sie, sieht „In Bearbeitung von …“ und kann nicht
   zurückspeichern, aber unter neuem Namen speichern.
3. Nach Schließen des bearbeitenden Tabs kann er sie spätestens nach 90 s bearbeiten.
4. Der Bearbeiter sieht, wer die Zeichnung zusätzlich offen hat; hat zwischendurch jemand
   anderes gespeichert, wird vor dem Überschreiben gefragt.
5. Strg+S einer Odoo-Zeichnung schreibt nach Odoo; bei einer lokalen Datei wie bisher.
6. Neu laden behält die Zuordnung; Speichern geht danach weiter nach Odoo.
7. Alle bestehenden Tests grün; ohne `VITE_FACE_BACKEND` keine sichtbare Änderung.

## Open Questions

Keine.
