# Spec: device-template

Modul aus `CAPABILITY-MAP.md` · hängt ab von odoo-device-library, odoo-mcp-schaltplan · Stand
2026-11-27 · **Entwurf, wartet auf Freigabe**

## Objective

Claude soll über den Odoo-Connector Gerätevorlagen anlegen, lesen und bearbeiten. Jean-Luc fragte
am 27.11.: „Kann der Claude MCP keine Vorlagen anlegen?“ Seine Entscheidungen:
- Claude darf auch bearbeiten, und zwar alle zentralen Vorlagen.
- Die Vorlagen liegen zentral in Odoo (`odoo-device-library`).
- Lautsprecherlast und Melderreichweite darf Claude auch ohne Basis-Vorlage angeben.

Heute kann Claude Vorlagen nur suchen (`search_templates`) und setzen (`add_device`).
`set_device_property` lehnt Ports und Slots ab. Fehlt ein Gerät, muss ein Mensch es im Editor
anlegen. Am Handy und bei Jarvis geht das nicht.

User Stories:
1. „Leg eine Vorlage für den Audac MFA208 an, 2× Mic/Line rein XLR, 1× Line raus, 2× Lautsprecher
   raus Phoenix, RS-232.“ Claude nennt die Port-Liste, legt die Vorlage an, und sie ist für alle in
   der Bibliothek.
2. „Wie der Blaze PowerZone Connect 122, aber als 172 mit vier Kanälen.“ Claude leitet vom 122 ab
   und passt Ports und Endstufenwerte an.
3. „Beim Ajax MotionProtect fehlt die Reichweite, laut Datenblatt 12 m, 88,5°.“ Claude ändert die
   zentrale Vorlage. Die Zeichnungen mit dem Melder zeigen Drift.
4. „Verknüpf die Vorlage mit dem Artikel MFA208.“ Claude setzt den Odoo-Artikel.
5. Gibt es Hersteller und Modell schon, legt Claude kein zweites Gerät an. Es nennt das vorhandene.

## Befehle

Alle drei stehen in `TOOLS` (`mcp-server/src/tools.ts`). Damit kommen sie über den Katalog in
`schaltplan_befehl`, und die Freigabeliste `known` des Backends wird aus `TOOLS` gebaut. **Am Odoo-Modul
`face_mcp_server` ändert sich kein Code.** Die Befehle laufen im verbundenen Tab und speichern über
`centralLibrary.ts` (siehe `SPEC-odoo-device-library.md`) mit der Odoo-Anmeldung des Nutzers.
Ist der Tab nicht angemeldet, zum Beispiel über die lokale Brücke in Claude Desktop, speichert der
Befehl im Browser wie der Editor. Die Antwort sagt dann `stored: "browser"`.

### `get_device_template`
- **Eingabe:** `{ templateId }`.
- **Antwort:** die ganze Vorlage, dazu `stored` (`odoo`, `browser` oder `library` für die
  mitgelieferte und die Community-Bibliothek), `version`, `productId` und `productName`.
- **Zweck:** Vor dem Bearbeiten liest Claude damit die Ports samt IDs und die Version.

### `create_device_template`

| Feld | Pflicht | Inhalt |
|---|---|---|
| `label` | ja | 1–120 Zeichen |
| `deviceType` | ja* | ein Typ aus `DEVICE_TYPE_TO_CATEGORY`. Bei einem unbekannten Typ nennt der Fehler die nächstliegenden. |
| `ports` | ja* | 1–256 Ports, siehe unten |
| `baseTemplateId` | nein | Vorlage, von der abgeleitet wird |
| `manufacturer`, `modelNumber`, `shortName` | nein | je bis 120 Zeichen |
| Zahlen ≥ 0 | nein | `powerDrawW`, `poeBudgetW`, `poeDrawW`, `unitCost`, `heightMm`, `widthMm`, `depthMm`, `weightKg` |
| Text | nein | `voltage`, `installCable`, `installNotes`, `referenceUrl` und `imageUrl` (nur `https://`), `searchTerms` (bis 20) |
| `speakerLoad` | nein | `impedanceOhm` 2–64, `rmsPowerW` 0–5000, `tapsW` (bis 12 Werte, absteigend), `profile` aus der bestehenden Liste |
| `ampLoad` | nein | `channels` 1–64, `ratedW` (`ohm2`/`ohm4`/`ohm8`/`v70`/`v100`), `totalRatedW`, `maxBurstPerChannelW`, `maxBurstTotalW`, `maxAvgTotalW`, `peakVoltageV`, `peakCurrentA`, `minImpedanceOhm`, Brückung wie im Typ |
| `detection` | nein | `shape` `sector`/`circle`/`rect`, `rangeM` 0,5–200. Bei `sector` ist `apertureDeg` 1–360 Pflicht, bei `rect` ist `widthM` Pflicht. |
| `micCoverage` | nein | `areaM {w,d}` 0,5–30, `minSideM`, `fixed`, `maxAreas` 1–16, `dedicatedAreaM`, `maxTalkerDistanceM`, `maxMountHeightM` |
| `productId` | nein | Odoo-Artikel (`product.product`). Claude findet ihn mit `search_records`. |
| `allowDuplicate` | nein | legt auch bei gleichem Hersteller und Modell an |

\* Ohne `baseTemplateId` sind `deviceType` und `ports` Pflicht. Mit Basis kommen sie aus der Basis,
wenn sie fehlen.

Port-Felder:
- **Pflicht:** `label`, `signalType` (ein Schlüssel aus `DEFAULT_SIGNAL_COLORS`) und `direction`
  (`input`, `output` oder `bidirectional`).
- **Wahlweise:** `connectorType` (ein Schlüssel aus `CONNECTOR_TO_CABLE`), `section`,
  `multiConnect`, `poeDrawW`, `notes` und `id`.
- **Port-IDs:** Ohne `id` gilt `p1` … `pn`. Doppelte IDs werden abgelehnt.
- **Nicht frei angebbar:** `passthrough`, Normalling, Netzwerk-Konfiguration, Slots, `wifi` und
  `planSymbol`. Diese Werte kommen nur über `baseTemplateId`.

Ablauf:
1. **Prüfen:** `parseTemplateInput` in `src/mcp/templateValidation.ts`. Die Funktion ist rein
   und prüft streng. Unbekannte Felder werden abgelehnt, nicht verworfen. Das Ergebnis besteht
   danach auch die lockerere Speicherprüfung `checkStoredTemplate`.
2. **Ableiten:** Die Basis wird mit `structuredClone` kopiert, die übergebenen Felder ersetzen die
   Kopie. `id` und `version` der Basis fallen weg.
3. **Doppelte prüfen:** gleicher Hersteller und gleiches Modell (getrimmt, Groß- und
   Kleinschreibung egal) über alle Bibliotheken. Treffer sind ein Fehler mit der vorhandenen
   `templateId`, außer `allowDuplicate` ist gesetzt.
4. **Speichern:** `id` = `custom-<Zeitstempel>`, `origin` = `claude`.
5. **Antwort:** `{ templateId, version, stored, label, deviceType, basedOn?, productName?, ports:
   [{ id, label, signalType, direction }] }`.

### `update_device_template`
- **Eingabe:** `{ templateId, baseVersion, ...Felder }` mit denselben Feldern wie beim Anlegen,
  außer `baseTemplateId` und `allowDuplicate`. `productId: null` löst die Verknüpfung.
- **Nur was übergeben wird, ändert sich.** Bei Last-, Melder- und Mikrofondaten wird der ganze
  Block ersetzt, `null` entfernt ihn.
- **`ports` ist die neue vollständige Liste:**
  - Ein Eintrag mit der `id` eines bestehenden Ports ändert diesen Port.
  - Ein Eintrag ohne `id` ist neu.
  - Fehlende Ports entfallen.
  - Die Antwort nennt `removedPorts`, und `connectedInOpenDrawing` sagt, ob sie in der offenen
    Zeichnung verbunden sind. Die Geräte in Zeichnungen ändern sich trotzdem nicht. Die
    Aktualisierung über Drift bleibt beim Nutzer.
- **Was nicht bearbeitet werden kann:**
  - die mitgelieferte und die Community-Bibliothek. Der Fehler schlägt
    `create_device_template` mit `baseTemplateId` vor;
  - Vorlagen, die nur in einem anderen Browser liegen.
- **Konflikt:** Ist `baseVersion` älter als die Version in Odoo, kommt ein Fehler mit Name und
  Zeitpunkt der letzten Änderung. Claude liest dann neu.
- **Antwort:** `{ templateId, version, changed: [Feldnamen], removedPorts, addedPorts }`.

### Leitfaden (`mcp-server/src/prompts.ts`)
- **Reihenfolge:** erst `search_templates`. Nur wenn nichts passt: anlegen, bevorzugt abgeleitet.
- **Absprache:** Port-Liste und Datenblattwerte nennt Claude vor dem Anlegen oder Ändern in einem
  Satz. Werte kommen aus dem Datenblatt oder vom Nutzer, Claude rät nie.
- **Vor dem Ändern:** `get_device_template`. Ändert Claude eine Vorlage, die andere Zeichnungen
  nutzen, sagt es dazu, dass dort Drift erscheint.
- **Artikel:** Verknüpft wird nur, wenn Hersteller und Modell zum Artikel passen oder der Nutzer
  es sagt.

## Entscheidungen

1. Claude darf alle zentralen Vorlagen bearbeiten. Last- und Melderdaten darf es frei angeben
   (Jean-Luc, 27.11.).
2. Archivieren oder Löschen kann Claude nicht. Das bleibt im Editor und in Odoo.
3. Geräte in Zeichnungen ändern sich nie durch einen Vorlagen-Befehl. Es gilt der bestehende
   Drift-Weg.
4. Wer die Vorlage geändert hat, sieht man in Odoo, über die Odoo-Anmeldung des Nutzers und
   `origin` = `claude` beim Anlegen.

## Commands

```
npx vitest run src/__tests__/mcpDeviceTemplate.test.ts src/__tests__/templateValidation.test.ts
npx tsc -b
cd mcp-server && npm test
```

## Project Structure

- `src/mcp/protocol.ts`: Parametertypen und Befehlsnamen.
- `src/mcp/templateValidation.ts`: `parseTemplateInput`, Port-Abgleich für `update`.
- `src/mcpBridge.ts`: drei Handler über `centralLibrary.ts`.
- `mcp-server/src/tools.ts`, `mcp-server/src/prompts.ts`: Beschreibungen und Leitfaden.
- `docs/src/pages{,-de}/`: Absatz zu Claude und eigenen Geräten.

## Testing Strategy

- **`templateValidation.test.ts`:**
  - Pflichtfelder;
  - unbekannte Typen, Signale und Stecker;
  - Grenzen der Last-, Melder- und Mikrofonwerte (`sector` ohne Winkel, absteigende Taps);
  - `passthrough` wird abgelehnt;
  - Port-Abgleich (behalten, ändern, neu, entfallen).
- **`mcpDeviceTemplate.test.ts`** gegen den echten Store und ein gemocktes `centralLibrary`:
  - anlegen, dann `search_templates` und `add_device`;
  - Dublette mit und ohne `allowDuplicate`;
  - Ableiten behält Lastdaten, und `speaker_load_report` bewertet wie bei der Basis;
  - ändern mit Konflikt;
  - Bibliotheksvorlage abgelehnt;
  - nicht angemeldet → `stored: "browser"`.
- **`mcp-server`:** die drei Befehle stehen in `TOOLS` und im Katalog, `/face/service/call` nimmt
  sie an.
- **Ende-zu-Ende (Jean-Luc), in claude.ai über den Odoo-Connector:**
  - eine fehlende Endstufe anlegen, setzen und verbinden;
  - eine Melderreichweite nachtragen und die Drift in einer Zeichnung sehen;
  - einen Artikel verknüpfen;
  - in Odoo den Chatter prüfen.

## Boundaries

- Always: jede Eingabe prüfen; Ports und Datenblattwerte vor dem Schreiben nennen; Fehler als
  Sätze, die Claude weitergeben kann.
- Ask first: Archivieren oder Löschen durch Claude; Geräte in Zeichnungen automatisch auf eine
  neue Version heben; weitere frei angebbare Blöcke (`wifi`, Slots, `passthrough`).
- Never: mitgelieferte, Community- oder Upstream-Bibliothek ändern; Push auf `master` ohne
  Freigabe.

## Success Criteria

1. In claude.ai legt Claude eine Vorlage an, setzt das Gerät und verbindet es. Ein Kollege sieht
   die Vorlage danach in seinem Editor.
2. Claude ändert eine zentrale Vorlage. Odoo zeigt die Änderung im Chatter, und Zeichnungen mit
   dem alten Stand zeigen Drift.
3. Eine frei angegebene Melderreichweite erscheint als Abdeckung, wenn der Melder auf einem
   Grundriss platziert wird.
4. Doppelte Vorlagen entstehen nur mit `allowDuplicate`. Bibliotheksvorlagen bleiben unverändert.
5. Alle bestehenden MCP-Tests laufen, und `face_mcp_server` bleibt ohne Codeänderung.

## Open Questions

Keine. Die offenen Punkte zum Speicherort stehen in `SPEC-odoo-device-library.md`.
