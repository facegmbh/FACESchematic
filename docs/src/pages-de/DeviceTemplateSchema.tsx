import { SIGNAL_LABELS, CONNECTOR_LABELS, SIGNAL_GROUPS, CONNECTOR_GROUPS } from "../../../src/types";
import { DEVICE_TYPE_TO_CATEGORY } from "../../../src/deviceTypeCategories";

const SAMPLE_JSON = `{
  "label": "Extron DTP2 T 212",
  "manufacturer": "Extron",
  "modelNumber": "60-1271-01",
  "deviceType": "hdbaset-extender",
  "referenceUrl": "https://www.extron.com/product/dtp2t212",
  "heightMm": 25,
  "widthMm": 216,
  "depthMm": 114,
  "weightKg": 0.68,
  "powerDrawW": 12,
  "ports": [
    { "label": "HDMI IN",   "signalType": "hdmi",    "connectorType": "hdmi",    "direction": "input" },
    { "label": "HDMI LOOP", "signalType": "hdmi",    "connectorType": "hdmi",    "direction": "output" },
    { "label": "DTP2 OUT",  "signalType": "hdbaset", "connectorType": "rj45",    "direction": "output" },
    { "label": "RS-232",    "signalType": "serial",  "connectorType": "phoenix", "direction": "bidirectional" },
    { "label": "12V DC",    "signalType": "power",   "connectorType": "barrel",  "direction": "input" }
  ]
}`;

const SAMPLE_CSV = `model_number,manufacturer,label,device_type,height_mm,width_mm,depth_mm,weight_kg,power_draw_w,reference_url,port_label,port_direction,port_signal_type,port_connector_type,port_section
60-1271-01,Extron,Extron DTP2 T 212,hdbaset-extender,25,216,114,0.68,12,https://www.extron.com/product/dtp2t212,HDMI IN,input,hdmi,hdmi,Rear
60-1271-01,Extron,Extron DTP2 T 212,hdbaset-extender,25,216,114,0.68,12,https://www.extron.com/product/dtp2t212,HDMI LOOP,output,hdmi,hdmi,Rear
60-1271-01,Extron,Extron DTP2 T 212,hdbaset-extender,25,216,114,0.68,12,https://www.extron.com/product/dtp2t212,DTP2 OUT,output,hdbaset,rj45,Rear
60-1271-01,Extron,Extron DTP2 T 212,hdbaset-extender,25,216,114,0.68,12,https://www.extron.com/product/dtp2t212,RS-232,bidirectional,serial,phoenix,Rear
60-1271-01,Extron,Extron DTP2 T 212,hdbaset-extender,25,216,114,0.68,12,https://www.extron.com/product/dtp2t212,12V DC,input,power,barrel,Rear`;

// Group device types by category for display
function deviceTypesByCategory(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [type, cat] of Object.entries(DEVICE_TYPE_TO_CATEGORY)) {
    if (!map[cat]) map[cat] = [];
    map[cat].push(type);
  }
  for (const cat of Object.keys(map)) map[cat].sort();
  return map;
}

export default function DeviceTemplateSchemaPage() {
  const dtByCat = deviceTypesByCategory();
  const sortedCategories = Object.keys(dtByCat).sort();

  return (
    <>
      <h1>Schema der Gerätevorlagen</h1>
      <p>
        Dies ist die maßgebliche Referenz für das Format der EasySchematic-Gerätevorlagen.
        Mit ihr lässt sich jede externe Quelle (Visio-Schablonen der Hersteller,
        Tabellen, ausgelesene Katalogdaten) in ein Format umwandeln, das sich über
        {" "}<strong>Gerätebibliothek → Importieren</strong> gesammelt importieren lässt.
      </p>
      <p>
        <strong>Auf der Suche nach einer Anleitung?</strong> Der Leitfaden{" "}
        <a href="/import-devices">Geräte importieren</a> führt durch den Arbeitsablauf,
        mit Beispieldateien und Tipps zur Fehlerbehebung. Diese Seite ist die technische Referenz.
      </p>

      <h2>Beispielvorlage (JSON)</h2>
      <p>Die Felder, die mindestens nötig sind, um ein Gerät zu importieren:</p>
      <pre><code>{SAMPLE_JSON}</code></pre>
      <p>
        Es kann ein einzelnes Objekt oder ein Array von Objekten übergeben werden. Unbekannte Felder werden stillschweigend
        ignoriert — zusätzliche Metadaten, die die eigenen Werkzeuge mitführen, dürfen also gefahrlos enthalten sein. <code>id</code>-Felder
        werden automatisch erzeugt, wenn sie fehlen.
      </p>

      <h2>Pflichtfelder</h2>
      <table>
        <thead>
          <tr><th>Feld</th><th>Typ</th><th>Hinweise</th></tr>
        </thead>
        <tbody>
          <tr><td><code>label</code></td><td>string</td><td>Anzeigename (z. B. „Extron DTP2 T 212“)</td></tr>
          <tr><td><code>deviceType</code></td><td>string</td><td>Muss ein gültiger Typ sein — siehe Tabelle unten</td></tr>
          <tr><td><code>manufacturer</code></td><td>string</td><td>Herstellername; für herstellerneutrale Vorlagen „Generic“ verwenden</td></tr>
          <tr><td><code>modelNumber</code></td><td>string</td><td>Pflicht, außer wenn manufacturer „Generic“ ist</td></tr>
          <tr><td><code>referenceUrl</code></td><td>string</td><td>Empfohlen; muss mit http:// oder https:// beginnen</td></tr>
          <tr><td><code>ports</code></td><td>array</td><td>Jeder Port braucht <code>label</code>, <code>signalType</code>, <code>direction</code>; <code>connectorType</code> wird empfohlen</td></tr>
        </tbody>
      </table>

      <h2>Optionale Felder</h2>
      <table>
        <thead>
          <tr><th>Feld</th><th>Typ</th><th>Hinweise</th></tr>
        </thead>
        <tbody>
          <tr><td><code>category</code></td><td>string</td><td>Wird automatisch aus <code>deviceType</code> abgeleitet, wenn das Feld fehlt</td></tr>
          <tr><td><code>heightMm</code> / <code>widthMm</code> / <code>depthMm</code></td><td>number</td><td>Physische Abmessungen in Millimetern. Sie bestimmen die automatische Rack-Einstufung, Tiefenkonflikte in der Seitenansicht und die Rack-Statistik — siehe <a href="/racks">Rack-Editor</a></td></tr>
          <tr><td><code>weightKg</code></td><td>number</td><td>Gewicht in Kilogramm; fließt in die Statistik des Gesamtgewichts je Rack ein</td></tr>
          <tr><td><code>installCable</code></td><td>string</td><td>Fest verlegtes Installationskabel des Modells, so wie es in einer Planlegende stehen soll, z. B. <code>"Kabel aus Decke: 2x2,5 mm²"</code>. Wird auf platzierte Geräte kopiert; Legendenzeilen im <a href="/floorplans">Grundriss</a>, die an das Modell gebunden sind, zeigen es hinter dem Modellnamen</td></tr>
          <tr><td><code>planSymbol</code></td><td>object</td><td>Wie das Modell in einem <a href="/floorplans">Grundriss</a> gezeichnet wird: <code>{"{ shape, color?, glyph? }"}</code> mit der Form <code>circle</code> / <code>square</code> / <code>triangle</code> / <code>diamond</code> oder einem Piktogramm in Draufsicht <code>projector</code> / <code>rack</code> / <code>display</code> / <code>camera</code>, einer Farbe als <code>#rrggbb</code>, bis zu zwei Zeichen, die in das Symbol gedruckt werden, einem optionalen <code>imageSrc</code> (eine Data-URL), das alle drei durch ein eigenes hochgeladenes Bild ersetzt, sowie <code>outlineColor</code> / <code>outlineWidthMm</code> für die Linie um den Körper (0 = keine). Ohne das Feld richtet sich die Form nach dem Gerätetyp (Lautsprecher rund, Subwoofer quadratisch, Mikrofone als Dreiecke, Projektoren / Kameras / Racks / Displays als Piktogramme, übrige Videogeräte als Rauten), und die Farbe wird aus der id abgeleitet</td></tr>
          <tr><td><code>speakerLoad</code></td><td>object</td><td>Lastdaten des Lautsprechers für die <a href="/floorplans">Prüfung der Leitungslast</a>: <code>{"{ impedanceOhm, rmsPowerW, tapsW?, profile? }"}</code> — Nennimpedanz, Dauerleistung (RMS), die Übertrageranzapfungen für 70&nbsp;V / 100&nbsp;V in Watt (höchste zuerst) und das Spektralprofil <code>FR</code> / <code>LF</code> / <code>MF</code> / <code>HF</code> / <code>SW</code>. Wird auf platzierte Geräte kopiert</td></tr>
          <tr><td><code>ampLoad</code></td><td>object</td><td>Ausgangsleistung des Verstärkers: <code>{"{ channels?, ratedW: { ohm2?, ohm4?, ohm8?, v70?, v100? }, totalRatedW?, maxBurstPerChannelW?, maxBurstTotalW?, maxAvgTotalW?, peakVoltageV?, peakCurrentA?, minImpedanceOhm? }"}</code>. Nennleistung je Kanal nach Last, die gemeinsame Gesamtleistung und die Spitzengrenzen; alles, was fehlt, wird aus den Nennwerten abgeleitet. <code>v70</code> / <code>v100</code> weglassen, wenn der Verstärker keinen Konstantspannungsbetrieb hat</td></tr>
          <tr><td><code>installNotes</code></td><td>string</td><td>Dauerhafter Installationshinweis zum Modell (Montageart, Freiraum). Grundriss-Legenden führen ihn unter ihren Installationshinweisen als <code>Model: note</code> auf</td></tr>
          <tr><td><code>rackForm</code></td><td>string</td><td>Überschreibt die Rack-Bauform — <code>"full"</code>, <code>"half"</code> oder <code>"shelf-only"</code>. Umgeht die Größenheuristik in Sonderfällen wie Tischgeräten mit optionalen Rackwinkeln</td></tr>
          <tr><td><code>facePlateLayout</code></td><td>object</td><td>Eigenes Layout der Steckverbinder auf der Frontblende (in der App über den Frontblenden-Editor festgelegt); bleibt mit der Vorlage gespeichert, sodass spätere Platzierungen es übernehmen</td></tr>
          <tr><td><code>powerDrawW</code></td><td>number</td><td>Maximale Leistungsaufnahme in Watt</td></tr>
          <tr><td><code>powerCapacityW</code></td><td>number</td><td>Für Stromverteilungen, Hausanschlüsse (Company Switches) und Netzteile: gesamte Versorgungs- bzw. Ausgangsleistung in Watt</td></tr>
          <tr><td><code>poeBudgetW</code></td><td>number</td><td>Für PoE-Switches: gesamtes PoE-Budget in Watt</td></tr>
          <tr><td><code>voltage</code></td><td>string</td><td>z. B. „100-240V“ oder „12V DC“</td></tr>
          <tr><td><code>thermalBtuh</code></td><td>number</td><td>Wärmelast in BTU/h für die Klimaauslegung. Wird automatisch aus <code>powerDrawW × 3.412</code> abgeleitet, wenn das Feld fehlt; nur angeben, wenn der gemessene Wert abweicht (z. B. bei Geräten mit geringer Verlustleistung im Standby).</td></tr>
          <tr><td><code>unitCost</code></td><td>number</td><td>Listenpreis (UVP) / üblicher Stückpreis in USD</td></tr>
          <tr><td><code>searchTerms</code></td><td>string[]</td><td>Zusätzliche Stichwörter für die Suche in der Gerätebibliothek</td></tr>
          <tr><td><code>color</code></td><td>string</td><td>Hex-Farbe (z. B. „#3b82f6“) für die Gerätekarte</td></tr>
          <tr><td><code>headerColor</code></td><td>string</td><td>Hex-Farbe für die Kopfzeile des Geräts. Wird an einer eigenen Vorlage gesetzt, indem ein Gerät gespeichert wird, dessen Kopfzeilenfarbe selbst gewählt wurde; Geräte, die aus der Vorlage platziert werden, übernehmen sie mit Vorrang vor den Standard-Kopfzeilenfarben des Projekts und der App. Weglassen, damit diese Standards gelten.</td></tr>
        </tbody>
      </table>

      <h2>Felder auf Port-Ebene</h2>
      <p>
        Jedes Objekt im Array <code>ports</code> unterstützt über die Pflichtfelder
        {" "}<code>label</code>, <code>signalType</code> und <code>direction</code> hinaus weitere Felder je Port.
      </p>

      <h3><code>networkConfig</code> — Vorkonfiguration von Netzwerk-Ports</h3>
      <p>
        Für Ethernet- und Glasfaser-Ports an adressierbaren Geräten (Switches, NVX-Endpunkte,
        Dante-Interfaces usw.) lässt sich eine IP-Konfiguration vorbelegen, die im Port-Inspektor
        erscheint, sobald das Gerät in einem Schaltplan platziert wird.
      </p>
      <table>
        <thead>
          <tr><th>Feld</th><th>Typ</th><th>Hinweise</th></tr>
        </thead>
        <tbody>
          <tr><td><code>ip</code></td><td>string</td><td>Statische IP-Adresse, z. B. „192.168.1.10“</td></tr>
          <tr><td><code>subnetMask</code></td><td>string</td><td>z. B. „255.255.255.0“</td></tr>
          <tr><td><code>gateway</code></td><td>string</td><td>z. B. „192.168.1.1“</td></tr>
          <tr><td><code>vlan</code></td><td>integer 0–4094</td><td>VLAN-ID</td></tr>
          <tr><td><code>dhcp</code></td><td>boolean</td><td>true, wenn der Port seine Adresse per DHCP bezieht</td></tr>
        </tbody>
      </table>
      <p>Beispiel — ein Switch mit vorkonfiguriertem Management-Port:</p>
      <pre><code>{`{
  "label": "Cisco SG350-10",
  "manufacturer": "Cisco",
  "modelNumber": "SG350-10",
  "deviceType": "network-switch",
  "referenceUrl": "https://www.cisco.com/c/en/us/products/switches/sg350-10-10-port-gigabit-managed-switch",
  "ports": [
    {
      "label": "MGMT",
      "signalType": "ethernet",
      "connectorType": "rj45",
      "direction": "bidirectional",
      "networkConfig": { "ip": "192.168.1.1", "subnetMask": "255.255.255.0", "vlan": 1 }
    }
  ]
}`}</code></pre>

      <h3><code>capabilities</code> — Fähigkeiten von Video-Ports</h3>
      <p>
        Für HDMI-, DisplayPort-, SDI- und andere Video-Ports lässt sich festhalten, welche
        Signalfähigkeiten der Port unterstützt. Sie erscheinen im Port-Inspektor und helfen,
        die Grenzen bei maximaler Auflösung, Bildrate und Farbraum zu dokumentieren.
      </p>
      <table>
        <thead>
          <tr><th>Feld</th><th>Typ</th><th>Hinweise</th></tr>
        </thead>
        <tbody>
          <tr><td><code>maxResolution</code></td><td>string</td><td>z. B. „4K“, „1080p“, „8K“</td></tr>
          <tr><td><code>maxFrameRate</code></td><td>number</td><td>Bilder pro Sekunde, z. B. 60</td></tr>
          <tr><td><code>maxBitDepth</code></td><td>number</td><td>Bit pro Kanal, z. B. 10</td></tr>
          <tr><td><code>colorSpaces</code></td><td>string[]</td><td>Unterstützte Farbräume, z. B. ["Rec.709", "Rec.2020", "DCI-P3"] (höchstens 20)</td></tr>
        </tbody>
      </table>
      <p>Beispiel — ein 4K-HDMI-Ausgang:</p>
      <pre><code>{`{
  "label": "HDMI OUT",
  "signalType": "hdmi",
  "connectorType": "hdmi",
  "direction": "output",
  "capabilities": {
    "maxResolution": "4K",
    "maxFrameRate": 60,
    "maxBitDepth": 10,
    "colorSpaces": ["Rec.709", "Rec.2020"]
  }
}`}</code></pre>

      <h3><code>multiConnect</code> — mehrere Verbindungen je Port zulassen</h3>
      <p>
        Standardmäßig lässt jeder Port eine Verbindung zu. Mit <code>multiConnect: true</code> kann ein Port viele aufnehmen —
        nützlich für SRT-Empfänger/-Encoder, Funkmikrofon-Empfänger oder jedes logische Signal, bei dem Fan-in oder Fan-out
        die Regel ist. Der Wert wird automatisch auf <code>true</code> vorbelegt, wenn ein neuer Port mit der Signalart
        <code> srt</code> oder <code> custom</code> oder mit dem Steckverbinder-Typ <code>wireless</code> angelegt wird.
      </p>
      <pre><code>{`{
  "label": "SRT Source",
  "signalType": "srt",
  "connectorType": "none",
  "direction": "input",
  "multiConnect": true
}`}</code></pre>

      <h2>Werte für die Port-Richtung</h2>
      <ul>
        <li><code>input</code> — nimmt ein ankommendes Signal auf</li>
        <li><code>output</code> — gibt ein Signal aus</li>
        <li><code>bidirectional</code> — beides (z. B. Ethernet, USB, RS-232)</li>
      </ul>

      <h2>CSV-Format (Alternative)</h2>
      <p>
        Für die gesammelte Eingabe in einer Tabellenkalkulation dient eine <strong>CSV mit einer Zeile je Port</strong>:
        Jeder Port ist eine Zeile, die Felder auf Geräteebene werden wiederholt. Der Import gruppiert
        die Zeilen nach <code>(manufacturer, model_number)</code>.
      </p>
      <p><strong>Pflichtspalten:</strong> <code>model_number</code>, <code>label</code>, <code>device_type</code>, <code>port_label</code>, <code>port_signal_type</code>, <code>port_direction</code></p>
      <p><strong>Optionale Spalten:</strong> <code>manufacturer</code>, <code>category</code>, <code>reference_url</code>, <code>height_mm</code>, <code>width_mm</code>, <code>depth_mm</code>, <code>weight_kg</code>, <code>power_draw_w</code>, <code>voltage</code>, <code>thermal_btuh</code>, <code>port_connector_type</code>, <code>port_section</code></p>
      <pre style={{ fontSize: "11px" }}><code>{SAMPLE_CSV}</code></pre>

      <hr />

      <h2>Gültige Werte für <code>signalType</code></h2>
      <p>Der <code>signalType</code> beschreibt, was über einen Port läuft — Videoformat, Audioprotokoll, Netzwerk, Steuerung oder Strom.</p>
      {Object.entries(SIGNAL_GROUPS).map(([group, types]) => (
        <div key={group}>
          <h3>{group}</h3>
          <table>
            <thead>
              <tr><th>Wert</th><th>Anzeigename</th></tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t}>
                  <td><code>{t}</code></td>
                  <td>{SIGNAL_LABELS[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Gültige Werte für <code>connectorType</code></h2>
      <p>Der <code>connectorType</code> ist der physische Steckverbinder am Port (XLR, HDMI, RJ45 usw.).</p>
      {Object.entries(CONNECTOR_GROUPS).map(([group, types]) => (
        <div key={group}>
          <h3>{group}</h3>
          <table>
            <thead>
              <tr><th>Wert</th><th>Anzeigename</th></tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t}>
                  <td><code>{t}</code></td>
                  <td>{CONNECTOR_LABELS[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Gültige Werte für <code>deviceType</code></h2>
      <p>Jeder Gerätetyp gehört zu einer Kategorie in der Seitenleiste der Bibliothek. Die Kategorie wird automatisch abgeleitet, wenn keine angegeben ist.</p>
      {sortedCategories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          <table>
            <thead>
              <tr><th>Wert</th></tr>
            </thead>
            <tbody>
              {dtByCat[cat].map((t) => (
                <tr key={t}><td><code>{t}</code></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <hr />

      <h2>Wo Importe landen</h2>
      <p>
        Importierte Geräte landen in den <strong>eigenen Vorlagen</strong> (Abschnitt „Eigene Vorlagen“
        der Gerätebibliothek). Sie werden im Browser gespeichert und gelten nur für den eigenen Rechner.
        Von dort lassen sie sich wie jedes andere Gerät in Schaltpläne ziehen.
      </p>
      <p>
        Wahlweise lassen sich aus dem Importdialog auch <strong>einzelne Vorlagen in der Community-Bibliothek einreichen</strong>.
        Einreichungen kommen in eine Moderationswarteschlange und stehen nach der Freigabe allen
        Benutzern zur Verfügung.
      </p>
    </>
  );
}
