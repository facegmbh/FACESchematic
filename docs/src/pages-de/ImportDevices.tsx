const MINIMAL_JSON = `{
  "label": "Generic 4×1 HDMI Switcher",
  "manufacturer": "Generic",
  "deviceType": "switcher",
  "ports": [
    { "label": "IN 1", "signalType": "hdmi", "direction": "input" },
    { "label": "IN 2", "signalType": "hdmi", "direction": "input" },
    { "label": "IN 3", "signalType": "hdmi", "direction": "input" },
    { "label": "IN 4", "signalType": "hdmi", "direction": "input" },
    { "label": "OUT",  "signalType": "hdmi", "direction": "output" }
  ]
}`;

const CSV_SNIPPET = `model_number,manufacturer,label,device_type,port_label,port_direction,port_signal_type,port_connector_type
HD-MD-4X1,Crestron,Crestron 4x1 Switcher,switcher,IN 1,input,hdmi,hdmi
HD-MD-4X1,Crestron,Crestron 4x1 Switcher,switcher,IN 2,input,hdmi,hdmi
HD-MD-4X1,Crestron,Crestron 4x1 Switcher,switcher,IN 3,input,hdmi,hdmi
HD-MD-4X1,Crestron,Crestron 4x1 Switcher,switcher,IN 4,input,hdmi,hdmi
HD-MD-4X1,Crestron,Crestron 4x1 Switcher,switcher,OUT,output,hdmi,hdmi`;

export default function ImportDevicesPage() {
  return (
    <>
      <h1>Geräte importieren</h1>

      <p>
        FACESchematic kann Gerätevorlagen gesammelt aus JSON oder CSV importieren. Das lohnt sich,
        sobald mehr als zwei oder drei Geräte hinzukommen sollen — ein Herstellerkatalog, die Preisliste
        eines Lieferanten, eine Tabelle mit dem gesamten Gerätebestand eines Veranstaltungsorts oder alles andere,
        was sich nur mühsam Gerät für Gerät über den Geräte-Editor eingeben ließe.
      </p>

      <p>
        Die Referenz Feld für Feld (jeder gültige <code>signalType</code>, <code>connectorType</code>,
        <code>deviceType</code> usw.) steht im{" "}
        <a href="/device-template-schema">Schema der Gerätevorlagen</a>. Diese Seite beschreibt den Arbeitsablauf.
      </p>

      <h2>Wo der Import zu finden ist</h2>

      <p>
        In der Seitenleiste der Gerätebibliothek auf <strong>Neues Gerät anlegen</strong> klicken. Die Auswahl, die sich öffnet,
        bietet drei Möglichkeiten:
      </p>
      <ol>
        <li><strong>Leer beginnen</strong> — öffnet den Geräte-Editor mit einer leeren Vorlage</li>
        <li><strong>Aus JSON oder CSV importieren</strong> — öffnet den Dialog für den Sammelimport (das Thema dieser Seite)</li>
        <li><strong>Oder ein Gerät aus der Bibliothek klonen</strong> — die vorhandene Bibliothek durchsuchen und ein Gerät als Ausgangspunkt verwenden</li>
      </ol>

      <h2>Format wählen</h2>

      <p>Beide Formate führen zum selben Ergebnis. Gewählt wird das, was zu den Quelldaten passt:</p>

      <table>
        <thead>
          <tr><th>JSON verwenden, wenn …</th><th>CSV verwenden, wenn …</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>die Daten aus Code oder einem strukturierten Werkzeug kommen (Hersteller-API, Scraping-Skript, eigene Datenbank)</td>
            <td>die Daten in einer Tabellenkalkulation liegen (Excel, Google Sheets, Numbers)</td>
          </tr>
          <tr>
            <td>verschachtelte Daten wie Suchbegriffe oder die Gerätefarbe angegeben werden sollen</td>
            <td>von Hand in einer Tabelle ohne verschachtelte Strukturen gearbeitet werden soll</td>
          </tr>
          <tr>
            <td>der Hersteller bereits eine JSON-Datei geliefert hat</td>
            <td>der Hersteller eine Tabelle oder kommagetrennten Text geliefert hat</td>
          </tr>
        </tbody>
      </table>

      <p>
        Im Zweifel JSON verwenden — es ist strenger und lässt sich vor dem Hochladen leichter prüfen.
      </p>

      <h2>Ein Import Schritt für Schritt</h2>

      <ol>
        <li>Dialog öffnen: <strong>Neues Gerät anlegen → Aus JSON oder CSV importieren</strong></li>
        <li>Den Tab <strong>JSON</strong> oder <strong>CSV</strong> wählen</li>
        <li>
          Entweder auf <strong>JSON-Datei hochladen</strong> bzw. <strong>CSV-Datei hochladen</strong> klicken und eine Datei vom Datenträger wählen oder die Daten direkt
          in das Textfeld einfügen. (Ein Klick auf <strong>Beispiel laden</strong> zeigt, wie das Format aussieht.)
        </li>
        <li>
          Die Vorschauliste füllt sich automatisch. Jedes erkannte Gerät erhält eine Zeile mit Beschriftung,
          Hersteller, Modell, Gerätetyp, Anzahl der Ports und Prüfstatus.
        </li>
        <li>
          Bei Zeilen, die nicht importiert werden sollen, den Haken entfernen. Zeilen mit Fehlern sind von vornherein gesperrt.
        </li>
        <li>
          Auf <strong>Zur Bibliothek hinzufügen</strong> klicken, um die gewählten Vorlagen in der Bibliothek der eigenen Vorlagen zu speichern.
        </li>
      </ol>

      <h2>Die Vorschau lesen</h2>

      <p>Der Kopf der Vorschau zeigt die Summen auf einen Blick:</p>
      <ul>
        <li>
          <strong>X Vorlagen gelesen</strong> — jedes Gerät, das der Parser erfolgreich zusammengesetzt hat.
          Das heißt nicht, dass sie gültig sind, sondern nur, dass die Eingabe strukturell lesbar war.
        </li>
        <li>
          <strong>Y gültig</strong> (grün) — Prüfung bestanden und bereit zum Import.
        </li>
        <li>
          <strong>Z mit Fehlern</strong> (rot) — Prüfung nicht bestanden. Die Zeile ist hervorgehoben, das
          Kontrollkästchen gesperrt, und die ersten drei Fehler stehen direkt in der Zeile. Häufige Ursachen:
          unbekannte Signalart, unbekannter Gerätetyp oder fehlende Pflichtfelder.
        </li>
      </ul>

      <p>
        Ist die Eingabe schon auf Dateiebene fehlerhaft (defektes JSON, CSV ohne Pflichtspalten),
        erscheint über der Vorschau ein rotes Banner, das das Problem beschreibt. Gerätezeilen erscheinen
        erst, wenn der Fehler auf Dateiebene behoben ist.
      </p>

      <h2>Beispieldateien</h2>

      <p>Rechtsklick → speichern, oder den Link öffnen, um das Format anzusehen:</p>

      <ul>
        <li>
          <a href="/examples/import-minimal.json" download>import-minimal.json</a> —
          ein einzelnes Gerät nur mit den Pflichtfeldern. Ein guter Ausgangspunkt.
        </li>
        <li>
          <a href="/examples/import-complete.json" download>import-complete.json</a> —
          ein einzelnes Gerät, bei dem jedes optionale Feld ausgefüllt ist. Zeigt, was möglich ist.
        </li>
        <li>
          <a href="/examples/import-array.json" download>import-array.json</a> —
          drei Geräte in einem Array. Zeigt den Sammelimport.
        </li>
        <li>
          <a href="/examples/import-sample.csv" download>import-sample.csv</a> —
          drei Geräte, verteilt über mehrere Zeilen. Zeigt den CSV-Aufbau mit einer Zeile je Port.
        </li>
      </ul>

      <h2>JSON-Format</h2>

      <p>Das Minimum, um ein einzelnes Gerät zu definieren:</p>

      <pre><code>{MINIMAL_JSON}</code></pre>

      <p>Das Wichtigste:</p>
      <ul>
        <li>Es kann ein <strong>einzelnes Objekt</strong> oder ein <strong>Array von Objekten</strong> übergeben werden. Beides funktioniert.</li>
        <li>
          Unbekannte Felder werden <strong>stillschweigend ignoriert</strong>. Zusätzliche Metadaten, die die eigenen Werkzeuge
          mitführen und die FACESchematic nicht kennt, dürfen also gefahrlos enthalten sein.
        </li>
        <li><code>id</code>-Felder (Vorlage und Port) werden <strong>automatisch erzeugt</strong>, wenn sie fehlen.</li>
        <li>
          <code>category</code> wird automatisch aus <code>deviceType</code> abgeleitet, wenn keine angegeben ist.
        </li>
        <li>
          Ist <code>manufacturer</code> gleich <code>"Generic"</code>, werden <code>modelNumber</code> und{" "}
          <code>referenceUrl</code> optional.
        </li>
      </ul>

      <p>
        Vollständige Feldliste, alle gültigen Enum-Werte und die Prüfregeln:{" "}
        <a href="/device-template-schema">Schema der Gerätevorlagen</a>.
      </p>

      <h2>CSV-Format</h2>

      <p>
        CSV verwendet einen Aufbau mit <strong>einer Zeile je Port</strong>: eine Zeile für jeden physischen Port eines Geräts,
        wobei die Felder auf Geräteebene (Hersteller, Modell, Abmessungen usw.) in allen Zeilen
        dieses Geräts wiederholt werden. Der Import gruppiert die Zeilen nach <code>(manufacturer, model_number)</code>, um
        jedes Gerät wieder zusammenzusetzen.
      </p>

      <pre style={{ fontSize: "11px" }}><code>{CSV_SNIPPET}</code></pre>

      <p>
        Das Beispiel oben definiert ein Gerät (Crestron 4×1 Switcher) mit fünf Ports. Für ein
        zweites Gerät werden einfach weitere Zeilen angehängt — wo ein Gerät endet und
        das nächste beginnt, erkennt der Import an <code>model_number</code>.
      </p>

      <p>
        <strong>Pflichtspalten:</strong>{" "}
        <code>model_number</code>, <code>label</code>, <code>device_type</code>,{" "}
        <code>port_label</code>, <code>port_direction</code>, <code>port_signal_type</code>
      </p>

      <p>
        <strong>Optionale Spalten:</strong>{" "}
        <code>manufacturer</code>, <code>category</code>, <code>reference_url</code>,{" "}
        <code>height_mm</code>, <code>width_mm</code>, <code>depth_mm</code>, <code>weight_kg</code>,{" "}
        <code>power_draw_w</code>, <code>voltage</code>, <code>port_connector_type</code>,{" "}
        <code>port_section</code>
      </p>

      <p>
        Tipp für die Tabellenkalkulation: In Excel oder Google Sheets die Gerätezeile einmal ausfüllen und dann die
        Gerätespalten nach unten ziehen, um sie in jeder Port-Zeile zu wiederholen. Die portspezifischen Werte je Zeile ergänzen. Als CSV speichern.
      </p>

      <h2>Wo importierte Geräte landen</h2>

      <p>
        Erfolgreich importierte Geräte landen im Abschnitt <strong>Eigene Vorlagen</strong> in der Seitenleiste der
        Gerätebibliothek — dort, wo auch <strong>Neues Gerät anlegen</strong> speichert. Von dort lassen sie sich
        wie jedes andere Bibliotheksgerät in Schaltpläne ziehen.
      </p>

      <p>
        Eigene Vorlagen liegen im lokalen Speicher des Browsers und gelten nur für diesen Rechner und diese Domain.
        Sie werden <strong>nicht</strong> automatisch mit jemandem geteilt — weder mit anderen Benutzern noch mit anderen
        Geräten, auf denen du dich anmeldest. Zum Sichern oder Umziehen dient{" "}
        <a href="/import-export">Datei → Gerätearchiv speichern</a>. Das Gerätearchiv ist auch der Weg,
        Vorlagen an Kolleginnen und Kollegen weiterzugeben.
      </p>

      <h2>Einreichen in der Community-Bibliothek</h2>

      <p>
        Die Schaltfläche <strong>Hinzufügen &amp; einreichen</strong> des Importdialogs übergibt Vorlagen an die
        Community-Bibliothek des ursprünglichen EasySchematic. In FACESchematic ist dieser Weg gesperrt — von hier aus wird nichts
        nach außen übertragen. Vorlagen bleiben in der eigenen Bibliothek.
      </p>

      <h2>Häufige Fehler und ihre Behebung</h2>

      <table>
        <thead>
          <tr><th>Fehlermeldung</th><th>Ursache</th><th>Behebung</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>Not valid JSON: …</code></td>
            <td>Unausgeglichene Klammern, abschließendes Komma, falsche Anführungszeichen</td>
            <td>Die Quelle durch einen JSON-Validator schicken. Die meisten Editoren markieren die Zeile.</td>
          </tr>
          <tr>
            <td><code>CSV missing required columns: …</code></td>
            <td>Im CSV-Kopf fehlen eine oder mehrere Pflichtspalten</td>
            <td>Die fehlenden Spalten ergänzen. Die Kopfzeile muss exakt die klein geschriebenen snake_case-Namen verwenden — siehe Abschnitt „CSV-Format“ oben.</td>
          </tr>
          <tr>
            <td><code>Unknown deviceType "X"</code></td>
            <td>Der deviceType kommt in unserer Taxonomie nicht vor</td>
            <td>Den nächstliegenden Wert aus der <a href="/device-template-schema">Schema-Referenz</a> wählen (unter „Gültige Werte für deviceType“).</td>
          </tr>
          <tr>
            <td><code>Unknown signalType "X"</code></td>
            <td>Die Signalart ist kein bekannter Wert</td>
            <td>Einen Wert aus der <a href="/device-template-schema">Schema-Referenz</a> verwenden. Fehlt dort eine tatsächlich existierende Signalart, ein Issue anlegen — wir ergänzen sie.</td>
          </tr>
          <tr>
            <td><code>Unknown connectorType "X"</code></td>
            <td>Wie oben, nur für den physischen Steckverbinder</td>
            <td>Den nächstliegenden Wert wählen. Abweichende Steckverbinder blockieren den Import nicht — sie sind rein visuell.</td>
          </tr>
          <tr>
            <td><code>manufacturer is required</code></td>
            <td>Kein Feld manufacturer, oder es ist leer</td>
            <td>Einen Hersteller ergänzen. <code>"Generic"</code> verwenden, wenn das Gerät wirklich herstellerneutral ist — das lockert auch die Pflicht zur modelNumber.</td>
          </tr>
          <tr>
            <td><code>modelNumber is required</code></td>
            <td>Fehlende Modellnummer bei einem Herstellergerät</td>
            <td>Die Modellnummer ergänzen. Oder, bei einem generischen Teil, manufacturer auf <code>"Generic"</code> setzen.</td>
          </tr>
          <tr>
            <td><code>referenceUrl must start with http:// or https://</code></td>
            <td>Die URL ist fehlerhaft aufgebaut</td>
            <td>Das Protokoll mit angeben. <code>www.foo.com</code> allein genügt nicht.</td>
          </tr>
          <tr>
            <td><code>Row N: missing model_number</code></td>
            <td>Eine CSV-Zeile hat bei einem Gerät, das nicht „Generic“ ist, keine model_number</td>
            <td>Die Modellnummer für diese Zeile eintragen.</td>
          </tr>
        </tbody>
      </table>

      <h2>Aus gängigen Quellen umwandeln</h2>

      <h3>Aus Excel oder Google Sheets</h3>
      <p>
        Die CSV mit einer Zeile je Port direkt in der Tabelle aufbauen. Dazu die oben genannten Spaltennamen verwenden und
        die Spalten auf Geräteebene in jeder Port-Zeile wiederholen. Als CSV exportieren (<strong>Datei → Herunterladen → Kommagetrennte Werte (.csv)</strong>{" "}
        in Sheets, <strong>Speichern unter → CSV UTF-8</strong> in Excel) und hochladen.
      </p>

      <h3>Aus einem Hersteller-PDF oder einem Datenblatt im Web</h3>
      <p>
        Die I/O-Tabelle auf Seite zwei oder drei des Datenblatts überfliegen — jedes ernst zu nehmende Gerät dokumentiert
        die Anzahl seiner Ports je Signalart. Das JSON von Hand aufbauen; bei &lt;10 Geräten ist die Minimalform
        am schnellsten getippt.
      </p>

      <h3>Aus einer Visio-Schablone (.vsdx) des Herstellers</h3>
      <p>
        Visio-Schablonen sind ZIP-Archive mit XML. Die meisten großen AV-Hersteller (Extron, Crestron, Biamp, QSC,
        AMX, Shure) veröffentlichen sie mit Shape-Daten, die Modellnummern, Port-Anzahlen und physische
        Abmessungen enthalten. Derzeit werden sie nicht automatisch ausgelesen — die Daten lassen sich aber von Hand herausholen:
      </p>
      <ol>
        <li>Die <code>.vsdx</code> in <code>.zip</code> umbenennen und entpacken</li>
        <li>In <code>visio/masters/</code> nach den Shape-Definitionen suchen; jede Master-XML hat Prop- / User-Zellen mit Port-Anzahlen und Metadaten</li>
        <li>Die Prop-Namen in unser Schema übersetzen (<code>Prop.HDMI_Inputs</code> → 4 Ports mit <code>signalType: "hdmi"</code> und <code>direction: "input"</code> usw.)</li>
        <li>Daraus das JSON oder die CSV aufbauen</li>
      </ol>
      <p>
        Ein direkter Visio-Import steht auf der Roadmap. Bis dahin funktioniert dieser Weg von Hand.
      </p>

      <h3>Aus ausgelesenen Katalogdaten</h3>
      <p>
        Ein kurzes Skript schreiben, das das Quellschema auf unseres abbildet, ein Array von Geräteobjekten ausgibt
        und es in die Zwischenablage oder eine Datei leitet. Das Ergebnis in den JSON-Tab einfügen. Das Format ist bewusst vorwärtskompatibel:
        Alle zusätzlichen Felder, mit denen das Skript Geräte versieht (Kostenstelle, Inventarnummer, Quell-URL), werden
        stillschweigend ignoriert, sodass sich eine einheitliche Exportform für mehrere nachgelagerte Werkzeuge beibehalten lässt.
      </p>

      <h2>Für Entwickler, die Konverter schreiben</h2>

      <ul>
        <li>Das Schema ist vorwärtskompatibel: <strong>Unbekannte Felder werden stillschweigend verworfen</strong> und nie als Fehler gemeldet</li>
        <li>Auf oberster Ebene werden sowohl einzelne Objekte als auch Arrays angenommen — gewählt wird, was der Generator von sich aus ausgibt</li>
        <li>Die <code>id</code> der Vorlage und die <code>id</code> der Ports werden automatisch erzeugt, wenn sie fehlen; eigene nur angeben, wenn ein Abgleich in beide Richtungen mit einem externen System nötig ist</li>
        <li>Die Prüfung läuft vollständig im Browser, bevor irgendetwas gespeichert oder eingereicht wird — die eigene CI darf also gern auf den Importdialog zeigen und während der Entwicklung Daten darüber einspielen</li>
        <li>
          Die vollständige Liste der zulässigen Enum-Werte ist als Daten auf der{" "}
          <a href="/device-template-schema">Seite der Schema-Referenz</a> veröffentlicht — sie wird automatisch aus dem Quellcode abgeleitet
          und bleibt deshalb aktuell, wenn neue Typen hinzukommen
        </li>
      </ul>
    </>
  );
}
