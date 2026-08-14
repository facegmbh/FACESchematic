# Odoo ↔ FACESchematic — Integrationsplan

Status: **Richtung geklärt, Umsetzung offen** · Stand: 2026-08-14 · Owner: FACE GmbH

## Ziel

Eine in FACESchematic gezeichnete Anlage soll **in Odoo lesbar sein**: welche Geräte gehören
zur Anlage, und **was hängt woran** — in Textform, nicht als Bild. Damit werden die Geräte zu
Prüflingen: die bestehende Geräteprüfung (`face.device.test`) hängt ohne weiteres Zutun daran.

**Eine Richtung: Zeichnung → Odoo.** In Odoo wird nicht gezeichnet und nichts nach
FACESchematic geschickt. Gezeichnet wird in FACESchematic, Odoo ist der Ort, an dem das
Ergebnis auswertbar wird.

Entscheidung 2026-08-14 (Nutzer). Der frühere Entwurf hatte den Auftragsimport
(Odoo → Zeichnung) als Phase 1 — der ist damit **nicht mehr der Weg**, siehe §10.

---

## 1. Der Anker: `face.installation`

Odoo hat das passende Modell bereits — **`face.installation` („Anlage")** aus
`face_device_testing`:

- `partner_id` (Kunde), `location`, `user_id` (Zuständiger)
- `device_ids` → One2many auf `face.device`
- `system_test_ids`, `last_test_date`, `next_test_date`, `maintenance_state`,
  `days_to_next_test`, `maintenance_hint` samt Erinnerungslogik
- Formular hat schon die Reiter „Geräte / Prüflinge", „Anlagenprüfungen",
  „Meldegruppenplan", „Bemerkungen"

**Eine Zeichnung entspricht einer Anlage.** Die Geräte der Zeichnung werden zu `face.device`
mit `installation_id` — und damit ist die Geräteprüfung sofort anwendbar, ohne dass daran
irgendetwas gebaut werden müsste. `face.device.test` hängt an `device_id` **und**
`installation_id`; beides ist dann gesetzt.

Das ist der ganze Trick: **wir bauen keine neue Welt, wir füllen die vorhandene.**

### Kardinalität (entschieden 2026-08-14)

```
res.partner (Kunde)  1 ──── n  face.installation (Anlage)  1 ──── 1  Zeichnung
```

Ein Kunde hat **mehrere** Zeichnungen. Eine Zeichnung gehört zu **genau einer** Anlage und
**genau einem** Kunden. Kein Sammelbecken je Kunde — `next_test_date` und `maintenance_state`
gelten je Anlage und wären sonst wertlos.

Daraus folgt für den Import: Die Anlage ist der Einstiegspunkt (§4), und auf ihr wird
festgehalten, aus welcher Zeichnung sie stammt. Wird versehentlich eine **andere** Zeichnung
auf dieselbe Anlage hochgeladen, passt kein `schematic_node_id` (§4.2) und es entstünde
stillschweigend ein zweiter Gerätesatz. Deshalb schreibt der Import beim ersten Mal eine
Zeichnungs-Kennung auf die Anlage (`schematic_uid`, Char) und in die zurückgegebene Datei
(§7.3); beim nächsten Upload wird sie verglichen und bei Abweichung **gewarnt**, bevor
irgendetwas geschrieben wird.

---

## 2. Ist-Stand

| Baustein | Status |
|---|---|
| FACESchematic live auf `schematic.face-gmbh.com` | läuft (§3) |
| Asset-ID-Feld je Gerät in der Zeichnung | fertig (Commit `751e04d`) — trägt jetzt den Match-Schlüssel |
| `face.installation` / `face.device` / `face.device.test` | vorhanden, produktiv |
| Import-Wizard „Zeichnung einlesen" | **fehlt** — das ist die Arbeit (§4) |
| Verbindungsmodell `face.device.connection` | **fehlt** — entschieden, nicht gebaut (§5) |
| Darstellung „was hängt woran" | **fehlt** (§6) |
| Odoo-Modul `face_schematic` (Auftragsexport) | gebaut, untracked, **wird nicht gebraucht** (§10) |
| Cloud-Upload zu fremdem Dienst offen | **AKUT** (§8.1) |

---

## 3. Infrastruktur (geprüft 2026-08-14)

| | |
|---|---|
| **FACESchematic live** | `https://schematic.face-gmbh.com` |
| Host | VM `face-docker1` = **192.168.100.70** (SSH nur aus dem Büronetz) |
| Container | `faceschematic-easyschematic-1`, Port 8080 → nginx |
| Reverse-Proxy | `nginxproxymanager-app-1` auf derselben VM |
| Deploy | **automatisch**: Push auf `master` → self-hosted GitHub-Runner `face-docker1` → `docker compose up -d --build` (`.github/workflows/deploy.yml`) |
| Gerätebibliothek | 562 Templates, live von `https://api.easyschematic.live` (`src/templateApi.ts:6`) |
| **Odoo** | `https://portal.face-gmbh.com` (Odoo.sh, DB `facegmbh-odoo-main-29045974`) |

Die `wrangler.toml` im Repo ist Upstream-Erbe (Cloudflare) und für FACE nicht der
Auslieferungsweg.

---

## 4. Der Import-Wizard „Zeichnung einlesen"

Einstieg: Button **auf der Anlage** (`face.installation`) → Upload der `.schematic`-Datei.
Kunde und Anlage stehen damit fest, **bevor** die Datei gelesen wird.

### Ablauf

1. Datei parsen: `nodes` (Geräte, Räume) + `edges` (Kabel).
2. Je Geräte-Node ein `face.device` anlegen oder aktualisieren (Match nach §4.2).
3. Je Edge einen `face.device.connection` anlegen oder aktualisieren (§5).
4. **Vorschau vor dem Schreiben:** Liste „neu / aktualisiert / unverändert / ohne Zuordnung",
   erst dann übernehmen. Nichts passiert stillschweigend.
5. Die Datei als `ir.attachment` an der Anlage ablegen — Nachvollziehbarkeit, welcher Stand
   eingelesen wurde. Sinnvoll dazu: das PDF aus FACESchematic (`src/pdfExport.ts`) als zweiter
   Anhang, dann liegen Bild und Text nebeneinander.

### 4.1 Feld-Mapping

| Zeichnung (`DeviceData`) | `face.device` |
|---|---|
| `label` | `name` |
| `manufacturer` | `manufacturer` |
| `modelNumber` | `model` |
| Raum-Node, in dem das Gerät liegt (`parentId`) | `location` (Standort / Raum) |
| `odoo.assetCode` | `asset_code` — **Match-Schlüssel** |
| `hostname`, `note` | in `note` bzw. eigenes Feld |
| aus dem Wizard-Kontext | `installation_id`, `partner_id` |
| **nicht** aus der Zeichnung — siehe §7 | `serial_number`, `product_id` |

Die Zeichnung trägt diese Felder bereits (`src/types.ts`, `DeviceData`). Nichts davon muss in
FACESchematic neu gebaut werden.

**Seriennummern kommen ausdrücklich nicht von hier.** `DeviceData.serialNumber` existiert zwar
im Datenmodell der Zeichnung, wird aber nicht gepflegt — die Seriennummern liegen in Odoo.
Der Import darf ein bereits gesetztes `serial_number` deshalb **nie** mit einem leeren Wert aus
der Datei überschreiben. Wie die Zuordnung läuft: §7.

### 4.2 Identität — mehrfaches Einlesen darf nichts doppeln

Match-Reihenfolge je Node:

1. **`odoo.assetCode`** — die FACE Asset-ID. Das Feld gibt es im Geräte-Editor schon
   (`DeviceEditor.tsx:1027`); wer ein bereits erfasstes Gerät zeichnet, trägt sie ein.
2. **Node-`id` der Zeichnung**, gespeichert auf `face.device` als `schematic_node_id`
   (neues Char-Feld, indiziert) — greift automatisch ab dem zweiten Einlesen derselben
   Zeichnung, ohne dass jemand etwas eintippen muss.
3. Sonst: **neu anlegen**, `asset_code` aus der Sequenz `face.asset.code`.

Kein Treffer heißt immer „neu", nie „raten". Namensähnlichkeit wird **nicht** zum Matchen
benutzt — zwei Geräte „Display 1" in verschiedenen Räumen sind zwei Geräte.

**Geräte, die in Odoo an der Anlage hängen, aber nicht mehr in der Zeichnung sind:** im Report
melden, **nie** automatisch löschen oder archivieren. Eine hochgeladene Datei darf keinen
Bestand vernichten — an den Geräten hängen Prüfprotokolle.

---

## 5. Verbindungsmodell `face.device.connection`

**Die „Hauptkette" über `upstream_id` ist verworfen** (Entscheidung 2026-08-14): Many2one
trägt nur eine Beziehung, ein Gerät hängt real an Video *und* Netzwerk *und* Strom. Jede
Auswahl-Heuristik wäre stille Informationsvernichtung. Anforderung ist ausdrücklich:
**je Gerät ist alles sichtbar, was daran hängt.**

Neues Modell, ein Datensatz je Kabel-Edge:

| Feld | Typ | Inhalt |
|---|---|---|
| `source_device_id` | m2o `face.device`, required, `ondelete="cascade"` | Quelle |
| `source_port` | Char | Port-Label, z. B. „SDI Out" |
| `target_device_id` | m2o `face.device`, required, `ondelete="cascade"` | Ziel |
| `target_port` | Char | Port-Label, z. B. „SDI In" |
| `signal_type` | Char | `sdi`, `hdmi`, `dante`, `ethernet`, … (aus der Edge) |
| `cable_id` | Char | Kabelnummer aus der Zeichnung, z. B. „SDI-1" |
| `cable_length_m` | Float | Länge, falls in der Zeichnung gepflegt |
| `schematic_edge_id` | Char, indiziert | Edge-ID → idempotenter Upsert |
| `installation_id` | related auf `source_device_id.installation_id`, stored | Anker + Datensatzregeln |

Auf `face.device`:
- `connection_out_ids` = One2many über `source_device_id`
- `connection_in_ids` = One2many über `target_device_id`
- `connection_ids` = computed über **beide** Richtungen

`upstream_id` / `downstream_ids` bleiben unangetastet: reine Handpflege, nur in
`face_label_manager/views/face_device_views.xml:36` sichtbar, keine Logik hängt daran. Der
Import schreibt sie **nicht** — keine zwei konkurrierenden Wahrheiten. Perspektivisch im
Formular durch `connection_ids` ersetzen.

---

## 6. Darstellung in Odoo — „was hängt woran"

Das ist der eigentliche Zweck. Drei Ebenen:

### 6.1 Am Gerät — Reiter „Verbindungen"

Neben dem vorhandenen Reiter „Geräteprüfungen"
(`face_device_testing/views/inherited_views.xml:33`):

```
Richtung   Port am Gerät   Gegenstelle                    Port dort     Signal   Kabel
Eingang    SDI In          Kamera 1 (FACE-2026/00284)     SDI Out       sdi      SDI-1
Eingang    Ethernet 1      Switch EG                      Port 12       ethernet NET-4
Ausgang    HDMI Out        Display Foyer                  HDMI In       hdmi     HDMI-3
Ausgang    Analog Out L    Endstufe Saal                  Input 1       audio    AUD-7
```

Die Gegenstelle ist ein Link — von dort geht es weiter durch die Anlage. Das ist die
Textform, die gefragt war: pro Gerät vollständig, in beide Richtungen.

### 6.2 An der Anlage — Reiter „Verkabelung"

Alle Verbindungen der Anlage als Liste, gruppierbar nach Signaltyp, Quellgerät oder Raum.
Damit beantwortet man „welche Dante-Strecken gibt es" ohne die Zeichnung zu öffnen.

### 6.3 Signalweg als Text (computed / Report)

Für Doku und Ausdruck ein generierter Baum je Anlage:

```
Kamera 1  (FACE-2026/00284)
  └ SDI Out ──[SDI-1, 15 m]──▶ Bildmischer / SDI In 1
Bildmischer  (FACE-2026/00285)
  ├ PGM Out ──[SDI-4]──▶ Recorder / SDI In
  └ AUX Out ──[SDI-5]──▶ Display Foyer / SDI In
```

Als `Text`-Feld (computed, nicht gespeichert) oder QWeb-Report an der Anlage. Zyklen und
Mehrfacheingänge müssen dabei sauber dargestellt werden — kein Endlos-Baum, ein Gerät wird
einmal ausgeklappt und danach nur noch referenziert.

---

## 7. Identität aus Odoo: Seriennummern und Produkte

Die Zeichnung sagt, **was wo hängt**. Odoo weiß, **welches Stück** das ist. Diese beiden
Informationen treffen sich in Odoo — nicht in der Zeichnung.

### 7.1 Seriennummern — Zuordnungs-Wizard an der Anlage

#### Wo die Stück-Datensätze liegen (geprüft 2026-08-14)

| Fall | Stück-Datensatz | Seriennummer | FACE-ID |
|---|---|---|---|
| **Serialisierte** Ware | `stock.lot` | `name` | `asset_code` (beim Wareneingang vergeben, `wizard/receipt_label_wizard.py:106`) |
| **Nicht serialisierte** Ware | `face.asset` | — (gibt es nicht) | `asset_code` |
| **Kundengerät** | keiner | vom Kunden / vom Typenschild | erst mit dem Gerät selbst |

**Wichtig, weil es die Annahme „`face.asset.device_id` reicht" bricht:** `face.asset` wird
*ausdrücklich nur für nicht serialisierte Ware* angelegt — der Docstring sagt es wörtlich:
„For non-serial products there is no per-piece Odoo record, so we create a face.asset per
piece at goods receipt" (`models/face_asset.py:6`). Bei serialisierter Ware ist `stock.lot`
der Stück-Datensatz, und dort gibt es **kein** `device_id`. Ausgerechnet die Geräte *mit*
Seriennummer wären über `face.asset.device_id` also nicht verknüpfbar.

#### Der Link: `asset_code`, kein neues Feld

`asset_code` ist FACE-weit eindeutig und wird von `face.asset`, `stock.lot` **und**
`face.device` aus derselben Sequenz (`face.asset.code`) gezogen. Damit ist
`face.device.asset_code` bereits die Verknüpfung zum Stück — es braucht **weder** ein `lot_id`
noch die Erweiterung von `face.asset`:

- serialisiert → `asset_code` findet den `stock.lot`
- nicht serialisiert → `asset_code` findet den `face.asset` (dessen `device_id` wird zusätzlich
  gesetzt, das Feld gibt es schon)
- Kundengerät → es gibt kein Stück; `asset_code` gehört dann dem Gerät allein, und nichts
  zeigt ins Leere

Dazu ein berechnetes Feld bzw. ein Smart-Button „Stück anzeigen", der `asset_code` auflöst und
zum Lot oder Asset springt. Ein echtes `Many2one` würde für Kundengeräte ohnehin leer bleiben
und wäre bei serialisierter Ware ein zweites Feld neben `asset_code`, das auseinanderlaufen kann.

#### Der Wizard

Aufruf an der Anlage. Links die Geräte aus der Zeichnung, rechts pro Gerät **eine** Nummer —
auf drei Wegen, alle gleichwertig nebeneinander:

**a) Aus dem Wareneingang vorschlagen.** Wir wissen aus dem Einkauf, welche Stücke für dieses
Projekt gedacht waren: `stock.move._face_project_origin()` bzw. `stock.lot._face_project_origin()`
leiten den Projektbezug aus dem **Kostenstellen-/Analysekonto** der Wareneingangsbewegung ab
(`models/stock_move.py:9`, `models/stock_lot.py:75`). Kandidatenliste je Gerät = Stücke mit
passendem Produkt aus diesem Projekt, noch keinem Gerät zugeordnet.

> **Falle:** `face.asset.project_origin` ist ein **Char** (zusammengesetzte Kontonamen), kein
> `project.project`-Link. Der Filter muss über das Analysekonto laufen, nicht über den
> Namensstring — sonst hängt die Zuordnung an der Schreibweise eines Kontonamens.

**b) Scannen.** Feld mit Scanner-Fokus, das sowohl das FACE-Etikett (`asset_code`) als auch
eine Hersteller-Seriennummer annimmt — die Suche über beide ist vorbereitet
(`stock.lot._rec_names_search = ["name", "ref", "asset_code"]`). Vor Ort ist das der schnellste
Weg und der einzige, bei dem sicher das richtige Stück getroffen wird.

**c) Von Hand eintragen** — für Kundengeräte und für alles, was nie durch unser Lager lief.

**Automatisch geht nur der Vorschlag, nie die Entscheidung.** Bei fünf baugleichen Displays
weiß nur der Monteur, welches Stück in welchem Raum hängt — jede automatische Verteilung wäre
geraten. Odoo schlägt vor, ein Mensch bestätigt.

#### Unbekannte Seriennummern — Rückfrage statt stillschweigend speichern

Wird eine Nummer gescannt oder getippt, die weder als `stock.lot` noch als `face.asset` noch
als `asset_code` existiert, wird sie **nicht** einfach übernommen. Stattdessen eine explizite
Abfrage:

```
Seriennummer „SN-88231" ist in Odoo nicht bekannt.
  ○ Als Kundengerät übernehmen   (Gerät gehört dem Kunden, lief nie über unser Lager)
  ○ Tippfehler — noch einmal eingeben
  ○ Abbrechen
```

Nur bei ausdrücklicher Bestätigung wird gespeichert. Das Gerät bekommt dann
`ownership = "customer"` (neues Selection-Feld auf `face.device`: FACE geliefert / Kundengerät)
und eine eigene FACE Asset-ID aus der Sequenz — es ist ja ein Prüfling wie jeder andere, nur
eben keiner aus unserem Wareneingang.

**Vorbelegung aus der Zeichnung:** `DeviceData.isVenueProvided` („Venue-owned gear") und
`procurementSource` (`stock` / `procuring` / `contractor`) gibt es in FACESchematic bereits.
Der Import kann `ownership` daraus vorbelegen — dann erwartet der Wizard bei diesen Geräten von
vornherein eine freie Nummer und fragt nicht unnötig nach.

### 7.2 Produkt-Zuordnung

`face.device.product_id` ist für die Prüfung nicht nötig, aber die Voraussetzung dafür, dass
§7.1 überhaupt Kandidaten vorschlagen kann. Gesucht wird über Hersteller + Modell:

1. `modelNumber` gegen `x_Hersteller_Nummer` (Studio-Feld, ~97 % Abdeckung)
2. gegen `default_code` / `barcode`
3. Fuzzy über `manufacturer` + `modelNumber`

Kein Treffer → `product_id` bleibt leer, Vermerk im Report, Zuordnung von Hand. **Kein
Blocker.** Eine gepflegte Mapping-Tabelle (Hersteller/Modell ↔ `product.product`) lohnt sich,
sobald dieselben Geräte wiederkommen.

### 7.3 Rückgabe in die Zeichnung

Damit Asset-ID und Seriennummer auch **auf dem Plan** stehen, gibt der Wizard eine
aktualisierte `.schematic`-Datei zum Download aus: je Node sind `odoo.assetCode` und
`serialNumber` gesetzt, dazu die Zeichnungs-Kennung aus §1. Der Zeichner öffnet sie einmal und
arbeitet damit weiter — die Asset-ID erscheint dann als Caption unter dem Gerät
(`DeviceNode.tsx:499`, seit Phase 0 vorhanden).

**Abgrenzung:** Das ist kein Zeichnen in Odoo und kein Sync-Kanal. Zurück fließen
ausschließlich Identitätsdaten, die Odoo selbst vergeben oder festgestellt hat — keine Geräte,
keine Verbindungen, keine Geometrie. Die Zeichnung bleibt in der Hand des Zeichners.

Konflikt-Regel: Beim nächsten Import gewinnt bei `serialNumber` und `assetCode` **immer Odoo**.
Sie stehen in der Datei nur zur Anzeige; ein dort geänderter Wert wird gemeldet, nicht
übernommen.

---

## 8. Sicherheit

Grundsatz: **keine Sonderwege.** Jeder Schreibzugriff läuft durch die Odoo-Rechte des
angemeldeten Nutzers, und kein Kundendatum verlässt das Haus.

### 8.1 AKUT — die Live-Instanz kann Zeichnungen an einen fremden Dienst hochladen

**Befund (geprüft 2026-08-14 am laufenden Container):** Im ausgelieferten Bundle steht als
API-Basis der Upstream-Default `https://api.easyschematic.live` — ein Cloudflare-Worker des
Upstream-Autors, nicht FACE. Weder `Dockerfile` noch `compose.yml` setzen
`VITE_TEMPLATE_API_URL`, es gibt keine `.env`.

Das ist nicht nur die Gerätebibliothek (deren Abruf ist ein reiner GET und unkritisch).
`src/templateApi.ts` bietet gegen dieselbe Basis-URL an:

| Funktion | Wirkung |
|---|---|
| `saveSchematicToCloud` / `updateSchematicInCloud` | **POST/PUT der kompletten Zeichnung** (`MenuBar.tsx:459`, im Menü erreichbar) |
| `toggleSchematicSharing` | erzeugt einen **öffentlichen Freigabe-Link** |
| `createHandoff`, `createDraft` | weitere Uploads |
| `requestLogin` / `checkSession` | Login gegen den fremden Dienst, `credentials: "include"` |

Eine Zeichnung enthält Kundenanlagen mit Standorten, Seriennummern und künftig Asset-IDs.
Wer sich einloggt und „in der Cloud speichern" klickt, lädt das zu einem Dritten hoch.

**Zu tun:**
1. Cloud-Speichern und Freigabe im FACE-Fork entfernen (`MenuBar.tsx`, Login-Dialog dazu) —
   oder ersatzweise `VITE_TEMPLATE_API_URL` als Build-Arg auf eine Basis richten, die nur die
   Bibliothek bedient.
2. Prüfen, ob dort bereits etwas liegt: Hat sich jemand eingeloggt und gespeichert?

Die Gerätebibliothek darf weiter von `api.easyschematic.live` kommen — GET ohne Kundendaten,
mit IndexedDB-Cache und gebündeltem Fallback (`src/deviceLibrary.fallback.json`).

### 8.2 Der Import-Wizard

Der Dateiweg schafft **keine neue Angriffsfläche** — kein offener Endpunkt, alles im
angemeldeten Backend. Regeln trotzdem:

- **Kein `sudo()`.** Alle Zugriffe als angemeldeter Nutzer, damit ACLs und Datensatzregeln
  greifen. Wer auf einen Kunden keine Rechte hat, darf ihm auch per Datei keine Geräte anlegen.
- **Die Datei ist nicht vertrauenswürdig.** Sie kann beliebige IDs enthalten. Maßgeblich ist
  immer der **Wizard-Kontext** (die Anlage, von der aus hochgeladen wurde) — Angaben aus der
  Datei dienen nur dem Abgleich („Datei nennt Kunde X, Anlage gehört Y — abbrechen?").
- **Parser hart begrenzen:** Dateigröße (z. B. 10 MB), Anzahl Nodes/Edges. `json.loads`,
  niemals `eval`/`literal_eval` auf Fremddaten.
- **Notiz-HTML nie ungeprüft rendern.** Die App bereinigt beim Import (`sanitizeNoteHtml`,
  `store.ts:4893`); übernimmt Odoo Notiztexte in ein `Html`-Feld oder einen QWeb-Report, muss
  dort ebenfalls bereinigt werden — sonst ist die `.schematic`-Datei ein XSS-Vektor ins Backend.
- Anhänge an der Anlage erben deren Zugriffsrechte — ausreichend.

### 8.3 Betrieb — SSH auf `face-docker1`

Der Host trägt neben FACESchematic auch **Vaultwarden**, Traccar und einen
GitHub-Actions-Runner mit Repo-Zugriff. Wer auf die VM kommt, kommt an den Passworttresor und
kann über den Runner Code in den Deploy schieben.

**Stand geprüft 2026-08-14 — Key-Auth läuft bereits.** In `/home/user/.ssh/authorized_keys`
liegen zwei Schlüssel (`j.ldoijen@gmail.com`, `jld@face-gmbh.com face-docker1 deploy`);
ein Login ohne Passwort funktioniert. Es ist also **nichts zu erzeugen und nirgends etwas zu
hinterlegen** — der private Schlüssel liegt dort, wo er hingehört:

```
Privater Teil   ~/.ssh/id_ed25519        nur auf dem Mac, Rechte 0600, verlässt ihn nie
Öffentlicher T. ~/.ssh/authorized_keys   auf dem Server (schon vorhanden)
```

**Sicherungskopie:** In **Bitwarden** (Cloud) ist der Schlüssel gut aufgehoben — der Dienst ist
von diesem Host unabhängig. Ins **Vaultwarden** auf `face-docker1` gehört er nicht: Wer den
Schlüssel braucht, weil der Host nicht erreichbar ist, käme dann auch an den Tresor nicht heran.
Das ist beim geplanten Umzug Bitwarden → Vaultwarden zu beachten — dieser eine Eintrag muss
draußen bleiben (oder es braucht einen zweiten Weg auf die VM).

Auch ohne Sicherungskopie ist ein verlorener Schlüssel kein Drama: Man erzeugt einen neuen,
trägt ihn über die Hypervisor-Konsole nach und streicht den alten aus `authorized_keys`.

Offen sind daher nur zwei Dinge:

1. **Der private Schlüssel hat keine Passphrase.** Wer Lesezugriff auf die Platte des Macs
   bekommt, hat den Server. Nachrüsten ohne neuen Schlüssel:
   ```bash
   ssh-keygen -p -f ~/.ssh/id_ed25519          # Passphrase setzen
   ssh-add --apple-use-keychain ~/.ssh/id_ed25519
   ```
   Dazu in `~/.ssh/config`: `AddKeysToAgent yes` + `UseKeychain yes`. Die Passphrase liegt dann
   im macOS-Schlüsselbund, es ist nichts zu tippen, und automatisierte Zugriffe laufen weiter.
   Denselben Schlüssel nutzt auch der Odoo.sh-Zugang — die Passphrase wirkt für beide.

2. **Passwort-Login ist noch aktiv.** Gesetzt wird das nicht in `/etc/ssh/sshd_config`, sondern
   in `/etc/ssh/sshd_config.d/50-cloud-init.conf` (`PasswordAuthentication yes`, von cloud-init
   angelegt). **Falle:** In `sshd_config` gewinnt der *erste* gefundene Wert, und die
   `Include`-Zeile steht ganz oben — eine zusätzliche `99-hardening.conf` bliebe daher wirkungslos.
   Die cloud-init-Datei muss selbst geändert oder entfernt werden.

   Reihenfolge gegen Aussperren: ändern → `sudo sshd -t` → **in einer zweiten Sitzung** neu
   anmelden, während die erste offen bleibt → erst dann `sudo systemctl reload ssh`.
   Rückfallebene ist die Hypervisor-Konsole der VM.

Zusätzlich: Der Runner baut, was auf `master` landet. Wer ins Repo schreiben darf, führt Code
auf dieser VM aus — Branch-Schutz auf `master` ist damit eine Sicherheits- und keine
Prozessfrage.

---

## 9. Roadmap

| # | Schritt | Aufwand | Repo |
|---|---|---|---|
| **0** | Cloud-Upload zu `api.easyschematic.live` schließen (§8.1) | klein | FACESchematic |
| 1 | Modul `face_schematic_import`: `face.device.connection` + `schematic_node_id` (§5, §4.2) | klein | Odoo |
| 2 | Upload-Wizard an der Anlage mit Vorschau (§4) | mittel | Odoo |
| 3 | Reiter „Verbindungen" am Gerät + „Verkabelung" an der Anlage (§6.1, §6.2) | klein | Odoo |
| 4 | Signalweg als Text/Report (§6.3) | klein–mittel | Odoo |
| 5 | Produkt-Zuordnung (§7.2) | klein | Odoo |
| 6 | Seriennummern-Wizard an der Anlage: Vorschlag / Scan / freie Eingabe mit Rückfrage (§7.1) | mittel | Odoo |
| 7 | Rückgabe von Asset-ID + Seriennummer in die Zeichnung (§7.3) | klein | Odoo |

Nach Schritt 3 ist das Kernziel erreicht: Zeichnung in Odoo lesbar, Geräte als Prüflinge
nutzbar. Schritt 5+6 hängen zusammen — ohne Produkt-Zuordnung kann der Seriennummern-Wizard
keine Kandidaten vorschlagen. Schritt 4 und 7 sind Komfort.

Unabhängig davon und nicht Teil dieser Integration (§8.3): Passphrase auf den privaten
SSH-Schlüssel setzen und Passwort-Login auf `face-docker1` abschalten.

---

## 10. Was aus dem Auftragsimport wird (früher „Flow A")

Der frühere Entwurf wollte aus einem Verkaufsauftrag eine vorbefüllte Zeichnung erzeugen
(Odoo → FACESchematic). Das ist **nicht mehr der Weg**: in Odoo wird nicht gezeichnet.

Das dafür gebaute Modul **`face_schematic`** (`custom_addons/face_schematic`, untracked, nie
deployed) wird damit nicht gebraucht. Es kann liegen bleiben oder gelöscht werden — es ist in
keinem Branch, also entsteht durch Nichtstun kein Schaden.

Mit ihm entfallen auch zwei Probleme, die es mitbrachte:
- **Ports/Template-Matching**: Der Wizard erzeugte Geräte mit `ports: []` — nackte Kästen ohne
  Anschlüsse, an denen sich kein Kabel andocken lässt. Für den Export hätte deshalb jedes
  Odoo-Produkt auf eine `templateId` der Bibliothek gemappt werden müssen. **Entfällt
  vollständig**, weil der Zeichner die Geräte aus der Bibliothek zieht — dort haben sie ihre
  Ports längst.
- **`odooMeta` in der Datei**: Kunde/Projekt sollten in der Zeichnung mitreisen; FACESchematic
  kannte das Feld nicht und hätte es beim Speichern verworfen (`SchematicFile` in
  `types.ts:773`, `exportToJSON` in `store.ts:4819`). **Entfällt**, weil Kunde und Anlage beim
  Import aus dem Wizard-Kontext kommen — das ist ohnehin die sicherere Quelle (§8.2).

**An FACESchematic ist damit nur eine einzige Änderung nötig: Schritt 0 (Sicherheit).**
Alles Weitere passiert in Odoo.

---

## 11. Offene Entscheidungen

- **Räume**: `face.device.location` ist ein Char. Genügt der Raumname aus der Zeichnung, oder
  soll es ein eigenes Modell geben? Vorschlag: erstmal Char.
- **Kandidatenfilter (§7.1a)**: Über welches Feld genau läuft „für dieses Projekt gedacht"?
  `_face_project_origin()` liefert Kontonamen als Text; sauber wäre das Analysekonto selbst.
  Zu klären, sobald der Wizard gebaut wird.
- **`ownership` (§7.1)**: Reicht „FACE geliefert / Kundengerät", oder braucht es zusätzlich
  „Fremdgewerk" (die Zeichnung kennt `procurementSource = contractor`)?
- **Welche Geräte werden Prüflinge?** Eine Zeichnung enthält auch Steckfelder, Adapter und
  Kabelzubehör (`isCableAccessory`). Vorschlag: im Wizard vorauswählbar, Zubehör per Default ab.
- **Signalweg-Text (§6.3)**: computed Feld im Formular oder QWeb-Report zum Ausdrucken — oder
  beides?

---

## 12. Referenzen (Code-Anker)

**Odoo:** `face_device_testing/models/installation.py` (`face.installation`),
`…/models/device.py` (`face.device`, `installation_id`), `…/models/device_test.py`
(`face.device.test`), `…/views/inherited_views.xml:33` (Reiter „Geräteprüfungen"),
`…/views/installation_views.xml:82` (Reiter der Anlage);
`face_label_manager/models/face_device.py` (`asset_code`, `product_id`, `position`),
`…/data/sequence_data.xml` (`face.asset.code`).

**FACESchematic:** `src/types.ts` (`DeviceData` — `label`, `manufacturer`, `modelNumber`,
`serialNumber`, `hostname`, `note`; `OdooDeviceLink` ab `:236`), `src/store.ts:4819`
(`exportToJSON` — Dateiformat), `src/components/DeviceEditor.tsx:1027` (Asset-ID-Feld),
`src/pdfExport.ts` (PDF als zweiter Anhang), `src/templateApi.ts` (§8.1),
`.github/workflows/deploy.yml` (Deploy auf face-docker1).
