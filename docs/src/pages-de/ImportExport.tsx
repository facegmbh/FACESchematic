export default function ImportExportPage() {
  return (
    <>
      <h1>Dateien & Exporte</h1>

      <h2>Cloud-Speicher</h2>
      <p>
        Der Cloud-Speicher ist vom Dateiexport getrennt — er legt den vollständigen Schaltplan auf den Servern von EasySchematic ab, sodass
        er aus jedem Browser erreichbar ist.
      </p>
      <ul>
        <li>Ein kostenloses Konto per Magic-Link-E-Mail oder Google-Anmeldung anlegen (kein Passwort nötig)</li>
        <li>Über <strong>Datei → In Cloud speichern</strong> speichern oder alle gespeicherten Schaltpläne über <strong>Datei → Meine Schaltpläne</strong> verwalten</li>
        <li>Bis zu 10 Schaltpläne je Konto</li>
        <li>Cloud-Schaltpläne werden für den <strong>Offline-Zugriff</strong> in IndexedDB zwischengespeichert — zuletzt geöffnete Cloud-Dateien stehen auch ohne Internet zur Verfügung</li>
        <li>In „Meine Schaltpläne“ lässt sich für jeden gespeicherten Schaltplan die Freigabe einschalten; das erzeugt einen Link, den jeder öffnen kann</li>
      </ul>

      <h3>Vorlage für neue Dateien</h3>
      <p>
        Jeder in der Cloud gespeicherte Schaltplan kann als <strong>Vorlage für neue Dateien</strong> festgelegt werden. Bei einem
        Klick auf <strong>Datei → Neu</strong> wird die Vorlage mit allen Geräten, den Einstellungen des Schriftfelds,
        dem Drucklayout und den eigenen Geräten vorausgefüllt geladen — dieselben Angaben müssen also nicht jedes Mal neu eingegeben werden.
      </p>
      <ul>
        <li><strong>Datei → Meine Schaltpläne</strong> öffnen und bei einem beliebigen Schaltplan auf das <strong>Sternsymbol</strong> klicken, um ihn als Vorlage festzulegen</li>
        <li>Ein erneuter Klick auf den Stern hebt die Festlegung als Vorlage wieder auf</li>
        <li>Es kann immer nur eine Vorlage aktiv sein — eine neue ersetzt die bisherige</li>
        <li>Der Vorlagen-Schaltplan selbst bleibt unberührt — er steht weiterhin als normal gespeicherte Datei in der Dateiliste</li>
        <li>Ist keine Vorlage festgelegt, legt <strong>Datei → Neu</strong> wie gewohnt einen leeren Schaltplan an</li>
      </ul>

      <h2>JSON (eigenes Format)</h2>
      <p>
        Das JSON-Format ist das eigene Dateiformat von EasySchematic. Es enthält den vollständigen Schaltplan — alle Geräte,
        Verbindungen, Räume und die Konfiguration.
      </p>

      <h3>Export</h3>
      <p>
        Ein Klick auf <strong>Speichern</strong> in der Menüleiste exportiert eine <code>.json</code>-Datei mit:
      </p>
      <ul>
        <li>Schemaversion (für die Vorwärtskompatibilität)</li>
        <li>Name des Schaltplans</li>
        <li>Alle Geräte, Räume und Notizen</li>
        <li>Alle Verbindungen (mit den Metadaten zur Signalart)</li>
        <li>Alle <a href="/racks">Rack-Seiten</a> — Racks, Geräteplatzierungen (per ID referenziert, nicht dupliziert) und Zubehör</li>
        <li>Alle <a href="/print-sheets">Druckbögen</a> — Papierformat, Ausrichtung und Rack-Ansichtsfenster</li>
        <li>Eigene Vorlagen (falls vorhanden)</li>
        <li>Anpassungen der Signalfarben (falls vorhanden)</li>
        <li>Druckeinstellungen (Papierformat, Ausrichtung, Maßstab)</li>
        <li>Daten und Layout des Schriftfelds</li>
        <li>Einstellungen zum Berichtslayout (Sichtbarkeit der Packlisten-Spalten, Sortierung, Layout von Kopf- und Fußzeile)</li>
      </ul>

      <h3>Import</h3>
      <p>
        Ein Klick auf <strong>Öffnen...</strong> in der Menüleiste importiert eine zuvor exportierte Datei. Schema-Migrationen laufen automatisch, wenn
        die Datei mit einer älteren Version gespeichert wurde.
      </p>

      <h2>Gerätevorlagen</h2>
      <p>
        Die eigenen Gerätevorlagen lassen sich getrennt von vollständigen Schaltplänen exportieren und importieren.
        Das ist nützlich, um die eigene Gerätebibliothek mit Kollegen zu teilen oder zu sichern.
      </p>
      <ul>
        <li>
          <strong>Gerätearchiv speichern</strong> — speichert die eigenen Gerätevorlagen als <code>.json</code>-Datei
        </li>
        <li>
          <strong>Gerätearchiv importieren...</strong> — lädt Vorlagen aus einer Datei und führt sie mit den vorhandenen eigenen Vorlagen zusammen
        </li>
      </ul>
      <p>
        Das ist getrennt vom <strong>Speichern / Öffnen</strong> eines Schaltplans, das vollständige Schaltpläne behandelt
        (Geräte, Verbindungen, Räume und die gesamte Konfiguration).
      </p>
      <p>
        Sollen Geräte gesammelt aus einem Herstellerkatalog, einer Tabelle oder einer anderen externen Quelle importiert werden?
        Den Arbeitsablauf für den JSON- / CSV-Import beschreibt <a href="/import-devices">Geräte importieren</a>.
      </p>

      <h2>CSV-Import (Kabelliste)</h2>
      <p>
        Aus einer Kabelliste in Tabellenform lässt sich automatisch ein Schaltplan mit Geräten, Räumen und Verbindungen erzeugen.
        Der Import ist über das Menü <strong>Datei</strong> → <strong>Kabelliste importieren...</strong> erreichbar.
      </p>
      <p>
        <a href="/examples/cable-schedule-sample.csv" download>cable-schedule-sample.csv</a> —
        eine kleine Kabelliste mit einer Handvoll realistischer Zeilen, einschließlich der unten beschriebenen Pfadsyntax
        {" "}<code>Room &gt; Subroom</code>. Herunterladen, oder den Link öffnen, um den Spaltenaufbau anzusehen.
      </p>
      <p>Der Import-Assistent hat zwei Schritte:</p>
      <ol>
        <li>
          <strong>Hochladen &amp; Spalten zuordnen</strong> — CSV-Daten einfügen oder eine Datei hochladen. Die Spalten der Tabelle
          werden Rollen zugeordnet: Quellgerät, Quell-Port, Zielgerät, Ziel-Port, Signalart, Quellraum und
          Zielraum. Der Assistent erkennt gängige Spaltennamen automatisch, sodass die meisten Tabellen mit geringer
          Anpassung funktionieren. Pflicht sind nur Quellgerät und Zielgerät.
        </li>
        <li>
          <strong>Gerätezuordnung prüfen</strong> — jeder eindeutige Gerätename aus der Tabelle wird mit
          der Gerätebibliothek abgeglichen. Die Zuordnungen prüfen und bei Bedarf anpassen; für nicht zugeordnete Geräte entstehen generische Platzhalter,
          deren Ports aus den Daten der Kabelliste abgeleitet werden.
        </li>
      </ol>
      <p>
        Nach dem Import liegen die Geräte nach Räumen geordnet auf der Zeichenfläche (sofern Raumspalten zugeordnet sind), und alle
        Verbindungen sind gezeichnet. So lassen sich vorhandene Kabellisten aus Excel, Google Sheets oder
        jedem anderen Werkzeug, das CSV exportieren kann, in einen grafischen Schaltplan umwandeln.
      </p>

      <h3>Verschachtelte Unterräume über Raumpfade</h3>
      <p>
        Raumspalten nehmen einen <strong>Raumpfad</strong> mit <code>&gt;</code> als Trennzeichen an, sodass eine
        Kabelliste <a href="/rooms-and-grouping">Unterräume</a> in einem Zug anlegen kann:
      </p>
      <table>
        <thead>
          <tr>
            <th>Wert in der Raumspalte</th>
            <th>Ergebnis</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>Sanctuary</code></td><td>Das Gerät wird in einen Raum „Sanctuary“ der obersten Ebene gesetzt</td></tr>
          <tr><td><code>Sanctuary &gt; FOH</code></td><td>Das Gerät wird in einen Unterraum „FOH“ gesetzt, der in „Sanctuary“ verschachtelt ist</td></tr>
        </tbody>
      </table>
      <ul>
        <li>Leerraum um das <code>&gt;</code> wird ignoriert — <code>Sanctuary&gt;FOH</code> und <code>Sanctuary &gt; FOH</code> sind derselbe Unterraum — und leere Pfadabschnitte werden übersprungen</li>
        <li>Pfade können beliebig tief verschachtelt sein, z. B. <code>Campus &gt; Sanctuary &gt; FOH</code></li>
        <li>Jeder Raum entlang des Pfads wird automatisch angelegt, auch wenn kein Gerät direkt darin sitzt</li>
        <li>Der CSV-Export der Kabelliste schreibt seine Spalten Src Room / Tgt Room in derselben Pfadsyntax, sodass eine exportierte Kabelliste beim erneuten Import ihre Unterraum-Verschachtelung behält</li>
        <li>Das Trennzeichen lässt sich nicht maskieren: Ein Raum, dessen Name tatsächlich ein <code>&gt;</code> enthält (z. B. <code>A &gt; B</code>), wird beim erneuten Import zu einem Unterraum „B“, der in „A“ verschachtelt ist</li>
      </ul>

      <h2>PNG / SVG (Bildexport)</h2>
      <ul>
        <li><strong>Als PNG exportieren</strong> — hochauflösendes Rasterbild, mit 4-facher Pixeldichte gerendert, geeignet für Dokumente und Präsentationen</li>
        <li><strong>Als SVG exportieren</strong> — Vektorbild, ohne Qualitätsverlust auf jede Größe skalierbar</li>
      </ul>
      <p>
        Beide erfassen den gesamten Schaltplan — jedes Gerät auf der Zeichenfläche, auf seine Ausdehnung zugeschnitten mit einem kleinen
        Rand — unabhängig davon, wie die Zeichenfläche gerade verschoben oder gezoomt ist.
      </p>

      <h2>DXF (CAD-Export)</h2>
      <p>
        <strong>Als DXF exportieren</strong> erzeugt eine DXF-Datei im Format AutoCAD R2000 (AC1015) mit einer Darstellung, die der Zeichenfläche entspricht —
        Geräteformen, Port-Anfasser, Verbindungen in Signalfarbe, Linienstile und Beschriftungen gelangen mit der Geometrie, die auf dem Bildschirm zu sehen war,
        in das CAD-Programm. Kompatibel mit:
      </p>
      <ul>
        <li><strong>Vectorworks</strong> (Hauptziel)</li>
        <li>AutoCAD</li>
        <li>Den meisten CAD-Programmen, die DXF lesen</li>
      </ul>

      <h3>DXF-Layerstruktur</h3>
      <p>
        Die Layer verwenden ein <code>-</code> als Trennzeichen für die Klassenhierarchie in Vectorworks:
      </p>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Inhalt</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>EasySchematic-Devices</code></td><td>Geräterechtecke und Beschriftungen</td></tr>
          <tr><td><code>EasySchematic-Rooms</code></td><td>Umrisse und Beschriftungen der Raum-Container</td></tr>
          <tr><td><code>EasySchematic-Connections-SDI</code></td><td>SDI-Verbindungen (ein Layer je Signalart)</td></tr>
          <tr><td><code>EasySchematic-Connections-HDMI</code></td><td>HDMI-Verbindungen</td></tr>
          <tr><td>...</td><td>Ein Layer je verwendeter Signalart</td></tr>
        </tbody>
      </table>

      <h3>DXF-Farben</h3>
      <p>
        Jede Signalart wird auf eine Farbe des AutoCAD Color Index (ACI) abgebildet, die der Signalfarbe auf dem Bildschirm nahekommt.
      </p>

      <h2>PDF</h2>
      <p>
        <strong>Als PDF exportieren</strong> erzeugt ein mehrseitiges Dokument entsprechend den Einstellungen der Druckansicht. Jede Seite enthält
        das Schriftfeld. Einzelheiten zur Seiteneinrichtung stehen unter <a href="/printing">Drucken &amp; Schriftfeld</a>.
      </p>

      <p>
        Alle Einzelheiten zu Seiteneinrichtung, Konfiguration des Schriftfelds und PDF-Export
        stehen unter <a href="/printing">Drucken &amp; Schriftfeld</a>.
      </p>
    </>
  );
}
