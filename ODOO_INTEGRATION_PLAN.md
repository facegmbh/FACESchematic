# Odoo ↔ FACESchematic — Integrationsplan

Status: **Entwurf / Design** · Stand: 2026-06 · Owner: FACE GmbH

Bidirektionale Verknüpfung zwischen Odoo (ERP, System of Record) und FACESchematic
(Zeichnungs-Tool). Ziel: **minimaler Nutzeraufwand bei maximaler Transparenz und
Nachvollziehbarkeit** — Auftragsimport mit allen Komponenten in die Zeichnung, Rückschreiben
der verbauten Geräte nach Odoo, Zuordnung zu Kunde und Projekt je Zeichnung.

Getroffene Entscheidungen (Stand dieses Entwurfs):
- **Komponentenquelle für den Import:** Verkaufsauftrag (`sale.order` / `sale.order.line`).
- **Austausch-Mechanismus v1:** dateibasiert (`.schematic`-JSON), on-prem, keine neue Infrastruktur.
- **Hub:** Odoo. Kunden-/Projektdaten verlassen das Haus nicht (NICHT über den öffentlichen
  Worker `api.easyschematic.live`).

---

## 1. Kernidee

Das Odoo-Modell **`face.device`** ist faktisch das Gegenstück zu einem Geräte-Node in der
Zeichnung — es trägt bereits alles Nötige:

- `asset_code` — FACE Asset-ID (Sequenz `face.asset.code`, Format `FACE-2026/00284`)
  → `face_label_manager/models/face_device.py`
- `product_id`, `manufacturer`, `model`, `serial_number`
- `partner_id` (Kunde, Pflicht) · `project_id` (`project.project`) · `position` (Einbauort)
- **`upstream_id` / `downstream_ids`** — Signalkette (entspricht den Kabel-Edges!)
- `install_date`, `qr_url` (Deep-Link in Odoo)

> Eine FACESchematic-Zeichnung ist damit ein **grafischer Editor für `face.device`-Datensätze
> samt Signalkette**. Node ↔ `face.device`, Edge ↔ `upstream/downstream`.

---

## 2. Identität & Schlüssel

**Universeller Schlüssel = `asset_code`** (FACE-weit eindeutig, geteilt von
`face.asset` / `face.device` / `stock.lot`, Sequenz in
`face_label_manager/data/sequence_data.xml`).

**Identitäts-Lebenszyklus** (wichtig, weil ein Verkaufsauftrag noch keine Asset-IDs hat):

| Zeitpunkt | Stabiler Schlüssel des Node |
|---|---|
| Import aus Verkaufsauftrag (Flow A) | `orderRef` + `orderLineId` + Stückindex (noch **kein** `assetCode`) |
| Nach Wareneingang / nach Rückschreiben (Flow B) | `assetCode` (final) |

Match-Reihenfolge beim Sync: `assetCode` → `odooDeviceId` → (`orderRef`+`orderLineId`+`unitIndex`).
Dadurch sind Upserts **idempotent**, auch bevor Asset-IDs existieren.

---

## 3. Datenmodell-Mapping

| FACESchematic | Odoo | Schlüssel / Feld |
|---|---|---|
| Device-Node `DeviceData` | `face.device` | `assetCode ↔ asset_code` |
| `manufacturer` / `modelNumber` | `product.product` (`x_Hersteller_Nummer` → `default_code`/`barcode`) | Produkt-Match |
| Kabel-Edge (Quelle → Ziel) | `upstream_id` / `downstream_ids` | Signalkette |
| Node-Label / Raum (Room-Node) | `face.device.position` | Einbauort |
| Zeichnung (Datei) | `project.project` + `res.partner` | `projectId` / `customerId` |
| Pack-List / Stückliste | `face.asset` (Wareneingang) | `face.asset.device_id` setzen |
| Titelblock | `sale.order` / Kunde / Projekt | Anzeige + Metadaten |

Odoo-Referenzen: `face.device` Basis in `face_device_testing/models/device.py`, Erweiterung in
`face_label_manager/models/face_device.py`; `face.asset` in
`face_label_manager/models/face_asset.py`; Verkaufsbezug in
`face_label_manager/models/sale_order.py`.

---

## 4. Neue Felder

### FACESchematic (`src/types.ts`)
`DeviceData` (additive, optional — bricht keine Altdaten):
```ts
odoo?: {
  assetCode?: string;      // FACE-2026/00284 (final, sobald vorhanden)
  productRef?: string;     // default_code / x_Hersteller_Nummer
  productId?: number;      // product.product id (Deep-Link)
  deviceId?: number;       // face.device id (nach Flow B)
  orderRef?: string;       // sale.order name (Herkunft)
  orderLineId?: number;    // sale.order.line id
  unitIndex?: number;      // Stücknummer innerhalb der Position
};
```
Zeichnungs-Metadaten — über bestehendes `titleBlock.customFields` ODER ein neuer Top-Level-Block
in `exportToJSON()` (`src/store.ts:4536`):
```ts
odooMeta?: {
  customerId?: number; customerName?: string;
  projectId?: number; projectName?: string;
  orderRef?: string;
  lastSyncedAt?: string;
};
```

### Odoo
Minimal — `face.device` deckt fast alles ab. Sinnvolle Ergänzungen:
- `face.asset.project_id` (echter `project.project`-Link statt nur `project_origin`-Text), optional.
- `face.device.schematic_ref` (Char) — Datei-/Zeichnungsreferenz für Rückverfolgung, optional.

---

## 5. Austausch-Format (`.schematic`-JSON)

v1 erweitert die bestehende Export-/Import-Struktur (`exportToJSON` `src/store.ts:4536-4599`,
`importFromJSON` `src/store.ts:4603`, Migrationen `src/migrations.ts`). Keine Brüche:
neue Felder sind additiv, `version` wird hochgezählt, alte Dateien migrieren sauber.

Vertrag (Auszug):
```jsonc
{
  "version": 30,
  "name": "Kunde X – Konferenzraum 2.04",
  "odooMeta": { "customerId": 42, "projectId": 7, "orderRef": "SO-2026-0123" },
  "nodes": [ { "id": "...", "type": "device",
    "data": { "label": "Bose EX-1280C",
      "odoo": { "productId": 1234, "productRef": "BOSE-EX1280C",
                "orderRef": "SO-2026-0123", "orderLineId": 9001, "unitIndex": 1 } } } ],
  "edges": [ /* Quelle→Ziel = Signalkette */ ]
}
```

---

## 6. Flow A — Auftragsimport (Odoo → Zeichnung)

Odoo-Aktion auf `sale.order`: **„FACESchematic-Zeichnung erzeugen"**.

1. **Produktauswahl-Wizard:** zeigt die `sale.order.line` als Liste mit Checkbox je Position
   (Produkt, Menge, Vorschau des Template-Matches). Default vorausgewählt sind nur „geräteartige"
   Positionen (siehe Filter unten); der Nutzer **wählt frei, welche Produkte mit aufgenommen werden**
   und kann die zu erzeugende Stückzahl je Position anpassen. Ergebnis: kuratierte Geräteliste.
2. **Produkt → Template-Match** (siehe §8); Menge → so viele Geräte-Nodes (`unitIndex`).
3. Schreibt `.schematic`-JSON: FACE-Titelblock (Kunde/Projekt/Auftrag/Datum), platzierte
   Geräte je mit `odoo.{productId,productRef,orderRef,orderLineId,unitIndex}`, `odooMeta` gesetzt.
4. Nutzer öffnet Datei in FACESchematic → Geräte sind da → **nur noch verkabeln**.

**Auswahl-Default (Vor-Filter, alles übersteuerbar):** lagerfähige Produkte bzw. mit gesetztem
`x_Hersteller_Nummer`/`default_code`; Dienstleistungs-/Pauschal-/Text-Positionen sind
standardmäßig **ab**gewählt. Der Nutzer hat immer das letzte Wort über die Checkboxen.

Technik: reines Odoo-Modul + JSON-Writer; Auslieferung als Datei-Download oder als
`ir.attachment` am Auftrag. Wiederverwendbarer Anknüpfpunkt auf Tool-Seite:
CSV-/Import-Pfad (`src/csvImport.ts`, `CsvImportWizard`) bzw. `importFromJSON`.

---

## 7. Flow B — Rückschreiben (Zeichnung → Odoo)

Odoo-Wizard **„Zeichnung einlesen"** (Upload der `.schematic`-Datei):

1. Parst `nodes`/`edges` + `odooMeta`.
2. **Upsert `face.device`** je Node (Match nach §2): setzt `product_id`, `position`
   (aus Label/Raum), `project_id`, `partner_id`; vergibt `asset_code` falls neu.
3. Schreibt die **Signalkette**: Edges → `upstream_id` / `downstream_ids`.
4. Verknüpft vorhandene `face.asset` (`device_id`), wo `asset_code` passt.
5. **Sync-Report**: angelegt / aktualisiert / ohne Produkt-Match / Konflikte.

Idempotent über `asset_code` → mehrfaches Einlesen erzeugt keine Doubletten.

---

## 8. Produkt → Template-Matching

Match-Reihenfolge (höchste Trefferquote zuerst):
1. `x_Hersteller_Nummer` (Studio-Feld, ~97 % Abdeckung)
2. `default_code` / `barcode`
3. `manufacturer` + `modelNumber` (Fuzzy, wie `scoreTemplate` in `src/csvImport.ts`)

Persistente **Mapping-Tabelle** (Odoo-Produkt ↔ FACESchematic-`templateId`), einmal gepflegt,
danach automatisch. Ohne Treffer → generisches Gerät + Flag „Template fehlt" → Kandidat für die
FACE-Produktbibliothek (`src/devices/face-products.ts`).

---

## 9. Transparenz & Nachvollziehbarkeit

- `assetCode` an jedem Node sichtbar + QR/Deep-Link nach Odoo (`face.device.qr_url`).
- `odooMeta.lastSyncedAt` + Sync-Report bei jedem Lauf.
- Idempotente Upserts per `asset_code`; Herkunft über `orderRef`/`orderLineId` auch ohne Asset-ID.
- Beidseitig dieselbe Sequenz → keine ID-Kollisionen.

---

## 10. Phasen & Aufwand

| Phase | Inhalt | Aufwand | Repo |
|---|---|---|---|
| **0 – Fundament** | `odoo`-Felder + `odooMeta` in `DeviceData`/Export; Editor-UI (Asset-ID etc.); Node-Anzeige; Migration | klein | FACESchematic |
| **1 – Flow A** | Odoo-Modul: Aktion auf `sale.order` → `.schematic`-Writer; Produkt-Matching | mittel | Odoo |
| **2 – Flow B** | Odoo-Wizard: `.schematic`-Parser → `face.device`-Upsert + Signalkette + Report | mittel | Odoo |
| **3 – Live-Sync v2** | Token-Endpunkte (Relay-Muster, HMAC aus `ir.config_parameter`) für Ein-Klick-Sync ohne Dateien | groß | beide |

Phase 0 deckt bereits die ursprüngliche Anforderung „Asset-ID den Geräten zuordnen" ab.

---

## 11. Offene Punkte / spätere Entscheidungen

- Mengenlogik Flow A: 1 Auftragsposition mit Menge n → n Einzel-Nodes oder 1 Sammel-Node? (Vorschlag: n Nodes, da `face.device` per Stück; im Auswahl-Wizard pro Position anpassbar.)
- Vor-Filter-Kriterium für die Default-Auswahl (lagerfähig vs. `face_asset_id_enabled` vs. Produktkategorie) — finale Heuristik festlegen. Auswahl bleibt immer manuell übersteuerbar (Anforderung #4).
- Räume/Position: aus Auftrag ableitbar oder erst in der Zeichnung gesetzt?
- v2-Transport: self-hosted FACESchematic ruft Odoo (Token) — Konfig-Ort im Tool.

---

## 12. Referenzen (Code-Anker)

**FACESchematic:** `src/store.ts:4536` (`exportToJSON`), `:4603` (`importFromJSON`),
`src/migrations.ts` (Schema-Version), `src/types.ts` (`DeviceData`, `TitleBlock`),
`src/csvImport.ts` + `CsvImportWizard` (Import-Hook), `api/` (Worker — für FACE NICHT Hub).

**Odoo:** `face_label_manager/models/face_device.py`, `…/face_asset.py`, `…/sale_order.py`,
`…/controllers/relay.py` (Token-/HMAC-Muster für v2), `…/data/sequence_data.xml`
(`face.asset.code`); Produktfelder `default_code`/`barcode`/`x_Hersteller_Nummer`.
