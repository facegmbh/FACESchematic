# Spec: odoo-device-library

Modul aus `CAPABILITY-MAP.md` · hängt ab von face-identity · Stand 2026-11-27 · **Entwurf, wartet
auf Freigabe**

Umsetzung in zwei Repos:
- FACESchematic: Backend in `mcp-server/src/cloud/` und Editor.
- `facegmbh/Odoo`: neues Modul `custom_addons/face_schematic_library`.

## Objective

Eigene Geräte liegen heute nur im Browser, in dem sie angelegt wurden (`localStorage`). Andere
bekommen sie nur, wenn sie eine Zeichnung öffnen, die das Gerät enthält. Jean-Luc entschied am
27.11.: **alle eigenen Geräte zentral in Odoo**. Das gilt für die, die ein Mensch im Editor anlegt,
und für die, die Claude anlegt. Wer angemeldet ist, sieht dieselbe Bibliothek. Eine Vorlage kann
optional mit dem Odoo-Artikel verknüpft sein.

User Stories:
1. Ich lege im Editor ein Gerät an. Ein Kollege sieht es kurz darauf in seiner Bibliothek, ohne
   dass eine Zeichnung ausgetauscht wurde.
2. Ich ändere eine Vorlage, zum Beispiel mit einem zusätzlichen Port. Zeichnungen mit dem alten
   Stand zeigen das als Drift und bieten die Aktualisierung an, wie heute bei Bibliotheks-Updates.
3. Meine bisherigen Browser-Geräte lade ich einmal nach Odoo hoch. Was es dort schon gibt, wird
   nicht verdoppelt.
4. An einer Vorlage steht der Odoo-Artikel (z. B. „Blaze PowerZone Connect 122“). Später kann die
   Geräteliste der Zeichnung daraus Angebotspositionen machen (`schaltplan-lebenszyklus`).
5. Ohne Anmeldung oder ohne Netz arbeitet der Editor wie heute: mit der letzten bekannten
   Bibliothek und lokalen Geräten.

## Odoo: Modul `face_schematic_library`

Modell `face.schematic.template` (`_inherit = ["mail.thread"]`):

| Feld | Typ | Inhalt |
|---|---|---|
| `key` | Char, Pflicht, eindeutig | Vorlagen-ID aus FACESchematic (`custom-…`). Bleibt beim Hochladen erhalten, damit bestehende Zeichnungen weiter darauf zeigen. |
| `name` | Char, Pflicht | `label` |
| `device_type`, `manufacturer`, `model_number` | Char | aus der Vorlage, zum Suchen und Anzeigen |
| `data` | Text | die ganze `DeviceTemplate` als JSON, höchstens 256 KB |
| `version` | Integer | steigt bei jeder Änderung um 1 |
| `product_id` | Many2one `product.product` | optional |
| `origin` | Selection | `editor`, `claude` oder `upload`, wie die Vorlage entstand |
| `active` | Boolean | Archivieren statt Löschen |

- **Änderungsverlauf:** `name`, `version`, `product_id` und `active` werden im Chatter verfolgt.
  So steht in Odoo, wer was geändert hat.
- **Rechte:** Interne Benutzer dürfen lesen, anlegen und schreiben. Löschen darf nur
  `base.group_system`. Alle anderen archivieren.
- **Ansicht:** Liste und Formular unter einem eigenen Menüpunkt „FACESchematic-Vorlagen“ (Name,
  Hersteller, Modell, Typ, Artikel, Version, Chatter). Das JSON ist nur lesbar sichtbar.
  Bearbeitet wird im Editor.
- **Prüfung in Odoo:** `data` muss gültiges JSON sein. `key`, `name` und `device_type` müssen zu
  `data` passen. So kann auch ein direkter RPC-Aufruf keinen Unsinn speichern.

## Backend: `/face/api/library` (`mcp-server/src/cloud/library.ts`)

Jeder Aufruf läuft mit dem Odoo-Schlüssel des angemeldeten Nutzers (`odooFor`), wie bei
`drawings.ts`.

| Route | Zweck |
|---|---|
| `GET /library` | alle aktiven Vorlagen: `{ key, version, productId, productName, writeDate, writtenBy, template }` |
| `POST /library` | anlegen `{ template, origin, productId? }` → 201. Bei bekanntem `key` kommt 409. |
| `PUT /library/:key` | ändern `{ template, baseVersion, productId? }`. Ist die Version in Odoo neuer, kommt 409 mit `writtenBy` und `writeDate`. |
| `POST /library/:key/archive` | archivieren |
| `POST /library/upload` | Liste aus dem Browser → `{ added, same, skipped: [{ key, label, reason, error? }] }`. `same` sind Vorlagen, die mit gleichem Inhalt schon in Odoo liegen. |
| `GET /library/products?q=` | Artikel für die Verknüpfung suchen (Name, `default_code`), höchstens 20 |

- **Prüfung vor dem Schreiben:** Das Backend prüft die Vorlage mit derselben reinen Funktion
  wie der Editor (`checkStoredTemplate` aus `src/mcp/templateValidation.ts`). `sync-protocol`
  kopiert die Datei ins Backend.
- **Hochladen:**
  - Vorlagen, die die mitgelieferte Bibliothek schon hat, filtert der Browser vor dem Senden
    heraus (`dropBundledDuplicates`), denn nur er kennt diese Bibliothek.
  - Gibt es den `key` schon, wird übersprungen, außer der Inhalt ist gleich. Abweichungen werden
    gemeldet und nicht überschrieben.
- **Fehler:** als deutsche Sätze, wie bei den Zeichnungen.
- **Odoo-Modul fehlt:** Ist `face_schematic_library` noch nicht installiert, antworten die Routen
  mit 503 und einem Satz. Der Editor bleibt dann bei den Geräten im Browser.
- **Doppelte Sicherung gegen Überschreiben:** Das Backend vergleicht `baseVersion` selbst und
  gibt sie Odoo als `expected_version` mit. Schreibt jemand zwischen Lesen und Schreiben, lehnt
  Odoo ab, und auch das endet als 409.

## Editor

Neuer Baustein `src/faceLibrary.ts`, nach dem Muster von `faceDrawings.ts`.

- **Laden:** beim Start, bei der Anmeldung, wenn das Fenster nach mehr als 5 Minuten wieder den
  Fokus bekommt, und nach jedem eigenen Schreiben.
  - Die zentralen Vorlagen kommen in `customTemplates`. Bei gleichem `key` gewinnt die höhere
    Version.
  - Gruppen und Reihenfolge der eigenen Geräte bleiben pro Browser.
- **Herkunft je Vorlage:** Der Store bekommt `libraryMeta: Record<key, { version, productId?,
  productName? }>`. Was dort fehlt, ist „nur in diesem Browser“ und bekommt in der Bibliothek ein
  Kennzeichen.
- **Schreiben** (`addCustomTemplate`, `updateCustomTemplate`, `removeCustomTemplate`):
  - **Angemeldet:** Die Änderung erscheint sofort und geht gleichzeitig nach Odoo. Schlägt Odoo
    fehl, wird sie zurückgenommen, und der Fehler wird angezeigt. Am Ende ist also nichts
    geändert. Die sechs Aufrufer (Geräte-Editor, Karten-Editor, Bibliothek, Import-Dialoge,
    Menü) bleiben synchron. Entfernen archiviert in Odoo.
  - **Nicht angemeldet:** Es bleibt lokal wie heute.
- **Hochladen:** In der Bibliothek gibt es „Nach Odoo hochladen (n)“ für alle lokalen Geräte, mit
  Ergebnisliste.
- **Zeichnung laden:** In die Zeichnung eingebettete Vorlagen mit einem zentralen `key` werden
  durch die zentrale ersetzt, wenn die zentrale Version gleich oder neuer ist. Unbekannte bleiben
  lokal und lassen sich hochladen.
- **Drift:** Jedes Schreiben setzt `template.version` = Odoo-Version. Die bestehende Drift-Anzeige
  (`templateSync.ts`) sorgt für den Rest. Platzierte Geräte ändern sich nie von selbst.
- **Artikel:** Im Geräte-Editor gibt es ein Feld „Odoo-Artikel“ mit Suche, nur wenn man angemeldet
  ist.

## Entscheidungen

1. Alle eigenen Geräte sind zentral, und Claude darf alle zentralen Vorlagen bearbeiten. Die
   Artikel-Verknüpfung kommt optional schon jetzt (Jean-Luc, 27.11.).
2. Ein eigenes Odoo-Modell statt JSON-Anhängen. So lässt sich suchen, die Rechte gelten, der
   Chatter zeigt den Verlauf, und der Artikel ist ein echtes Feld.
3. Ein eigenes Odoo-Modul `face_schematic_library`. `face_mcp_server` hängt nur von `base` und
   `mail` ab und soll nicht `product` brauchen. `face_schematic_import` liest Zeichnungen in
   Anlagen ein, das ist eine andere Aufgabe.
4. Der `key` bleibt die bisherige Vorlagen-ID. Damit müssen Zeichnungen nicht umgeschrieben werden.
5. Konflikte beim Ändern löst die Version (wer zuletzt gelesen hat, muss neu laden), nicht eine
   Sperre.
6. Die mitgelieferte FACE-Bibliothek (`face-library.ts`) und die Community-Bibliothek bleiben, wo
   sie sind.

## Commands

```
npx vitest run src/__tests__/faceLibrary.test.ts src/__tests__/customTemplateImport.test.ts
npx tsc -b
cd mcp-server && npm test
# Odoo: Odoo.sh-Staging-Build des Branches (lokal laufen die Odoo-Tests nicht)
```

## Testing Strategy

- **Odoo** (`face_schematic_library/tests/test_template.py`):
  - `key` ist eindeutig;
  - `data` wird geprüft;
  - `version` steigt;
  - Löschen geht nur für Systemadministratoren, Archivieren für alle internen Benutzer;
  - Portal-Benutzer sehen nichts.
- **Backend** (`library.test.ts`, mit `mockOdoo.ts`): alle Routen, 409 bei Versionskonflikt und
  doppeltem `key`, Hochladen mit gleich/abweichend/mitgeliefert, Fehlersätze.
- **Editor** (`faceLibrary.test.ts`):
  - Laden zusammenführen (höhere Version gewinnt, lokale bleiben);
  - Schreiben angemeldet und abgemeldet;
  - fehlgeschlagenes Schreiben ändert nichts;
  - eingebettete Vorlagen beim Laden einer Zeichnung;
  - Drift nach Änderung.
- **Ende-zu-Ende (Jean-Luc):** zwei Browser, in einem anlegen, im anderen sehen; ändern, Drift in
  einer Zeichnung; lokale Geräte hochladen; Artikel verknüpfen.

## Boundaries

- Always: Odoo-Rechte des Nutzers; jede Vorlage vor dem Schreiben prüfen; Geräte in Zeichnungen
  nie automatisch ändern.
- Ask first: Löschen statt Archivieren; Gruppen/Reihenfolge zentral machen; Abweichungen beim
  Hochladen automatisch überschreiben.
- Never: Vorlagen ohne Anmeldung nach Odoo schreiben; die Community- oder Upstream-Bibliothek
  ändern; Push auf `master` ohne Freigabe (geht ungeprüft live).

## Success Criteria

1. Eine im Editor angelegte Vorlage erscheint in einem zweiten Browser eines anderen Nutzers
   spätestens nach Fokuswechsel oder Neuladen.
2. Eine Änderung erhöht die Version. Zeichnungen mit dem alten Stand zeigen Drift.
3. Hochladen verdoppelt nichts und meldet Abweichungen.
4. Ohne Anmeldung verhält sich der Editor wie heute. Alle bestehenden Tests laufen.
5. In Odoo zeigt der Chatter jeder Vorlage, wer sie angelegt und geändert hat.

## Open Questions

1. Sollen auch Nicht-FACE-Nutzer des Editors (ohne Odoo-Anmeldung) die zentrale Bibliothek lesen
   können? Der Vorschlag ist nein, sie bleibt hinter der Anmeldung.
