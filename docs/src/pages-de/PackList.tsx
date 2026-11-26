export default function PackListPage() {
  return (
    <>
      <h1>Packliste &amp; Berichte</h1>

      <p>
        Die <strong>Packliste</strong> erzeugt aus dem Schaltplan eine Stückliste — eine Übersicht über jedes Gerät
        und jedes Kabel, das benötigt wird. Geöffnet wird sie über das Menü <strong>Berichte</strong> in der Menüleiste.
      </p>

      <h2>Die Packliste durchsehen</h2>
      <p>
        Der Dialog der Packliste hat zwei Tabs:
      </p>
      <ul>
        <li><strong>Geräte</strong> — jedes Gerät im Schaltplan mit Menge, Hersteller, Modellnummer, Modell, Typ und Raum</li>
        <li>
          <strong>Kabel</strong> — Kabelmengen, zusammengefasst nach Kabeltyp, Signalart und Weg.
          <strong> Adapter</strong> (passive Dongles, Kabeladapter, Kupplungen) stehen am Ende des
          Kabel-Tabs unter einer eigenen Abschnittsüberschrift. Aktive Konverter erscheinen dagegen im Geräte-Tab.
        </li>
      </ul>
      <p>
        Beide Tabs haben einen Umschalter <strong>Gruppieren nach</strong> — Geräte lassen sich nach Raum gruppieren, Kabel nach Signalweg.
        Ist die Gruppierung aus, werden gleiche Posten zu einer Zeile mit summierter Anzahl zusammengefasst.
      </p>
      <p>
        Adapter erscheinen immer in der Packliste, auch wenn sie im Schaltplan <strong>ausgeblendet</strong> sind — die
        Packliste ist die vollständige Stückliste. Verbindungen, die als <strong>Direktanschluss</strong> markiert sind (der
        Adapter steckt direkt am Gerät), werden bei den Kabelmengen nicht mitgezählt, weil kein eigenes Kabel nötig ist.
      </p>

      <h2>Kostenerfassung</h2>
      <p>
        Geräte und Kabel können ein optionales Feld <strong>Stückpreis</strong> haben. Der Stückpreis wird
        im Geräte-Editor oder in der Kabelliste eingetragen. Die Kosten erscheinen in der Packliste und
        lassen sich für Budgetierung und Angebote als CSV exportieren. Geräte, die als
        {" "}<strong>vom Veranstaltungsort gestellt</strong> markiert sind, werden in der Packliste gesondert ausgewiesen, sodass sich
        Hausmaterial von Mietmaterial trennen lässt.
      </p>

      <h2>Kabelliste</h2>
      <p>
        Die <strong>Kabelliste</strong> ist ein Verdrahtungsbericht je Verbindung und steht im selben
        Menü „Berichte“ zur Verfügung. Sie führt jede Verbindung im Schaltplan auf, mit:
      </p>
      <ul>
        <li><strong>Kabel-ID</strong> — bearbeitbare Kennung für jedes Kabel</li>
        <li><strong>Quelle und Ziel</strong> — Gerätenamen, Port-Namen und Räume</li>
        <li><strong>Signalart</strong> und <strong>Kabeltyp</strong></li>
        <li><strong>Steckverbinder-Typen</strong> an beiden Enden (mit den Zusätzen M-M / F-F, wenn beide Enden dieselbe Ausführung haben)</li>
        <li><strong>Kabellänge</strong> — je Verbindung bearbeitbar</li>
        <li>
          <strong>Gesch. Länge</strong> — wird automatisch aus den Raum-zu-Raum-Abständen berechnet, wenn beide Endpunkte in
          platzierten Räumen liegen. Sie dient als Ausgangswert für das Ausfüllen der <em>Kabellänge</em> oder einfach
          für eine grobe Budgetierung
        </li>
      </ul>
      <p>
        Kabel-IDs unterstützen das <strong>Füllen von Reihen</strong> — mehrere Zellen auswählen, einen Wert mit einer Zahl eingeben
        (z. B. „SDI-001“), und das Programm zählt für jede ausgewählte Zeile automatisch hoch. Das funktioniert genauso
        wie die automatische Nummerierung von Geräten.
      </p>
      <p>
        Die Kabelliste unterstützt denselben PDF-Export, CSV-Export und dasselbe Layout der Druckvorschau wie die Packliste.
      </p>

      <h2>Patchfeld-Belegung</h2>
      <p>
        Die <strong>Patchfeld-Belegung</strong> (Menü „Berichte“ → Patchfelder) ist ein eigener Verdrahtungsbericht für
        jedes Patchpanel im Schaltplan. Anders als die Kabelliste führt sie <strong>jeden Port jedes Panels</strong> auf
        — auch die unbelegten —, sodass die freie Kapazität auf einen Blick zu sehen ist.
      </p>
      <p>Jede Zeile zeigt Panel, Raum, Seite (Front / Rückseite), Position, Steckverbinder, Ausführung und was an der Gegenseite hängt:</p>
      <ul>
        <li><strong>Gegenstelle</strong>, <strong>Port</strong> und <strong>Raum</strong>, mit denen der Panel-Port verbunden ist (leer bei unbenutzten Ports)</li>
        <li><strong>Kabel-ID</strong> — derselbe Wert, den die Kabelliste verwendet, sodass beide Berichte übereinstimmen</li>
        <li><strong>Kabeltyp</strong> und <strong>Signalart</strong></li>
        <li><strong>Kabellänge</strong> und <strong>Gesch. Länge</strong> — dieselbe aus den Räumen abgeleitete Schätzung wie in der Kabelliste</li>
      </ul>
      <p>
        Eine <strong>Belegungsanzeige</strong> am Kopf des Berichts fasst zusammen, wie viele Ports jedes Panels belegt sind
        und wie viele es insgesamt hat. Über die Auswahlliste „Gruppieren nach“ lassen sich die Zeilen nach <strong>Panel</strong>, <strong>Panel-Raum</strong>, <strong>Signalart</strong>
        {" "}oder <strong>Seite</strong> gruppieren. Wie die anderen Berichte unterstützt auch dieser PDF, CSV und Druckvorschau.
      </p>

      <h2>Eigener Bestand &amp; Mengen in der Packliste</h2>
      <p>
        Die Bibliothek <strong>Eigener Bestand</strong> führt ein Inventar der Geräte, die dir gehören. Beim Aufbau eines Schaltplans
        vergleicht die Packliste die platzierten Geräte mit dem Inventar und weist
        <strong> Bestand und Bedarf</strong> aus — ein einziges Dokument zeigt also, was aus dem Regal genommen und was
        gemietet oder gekauft werden muss.
      </p>
      <ul>
        <li>Den Tab <strong>Eigener Bestand</strong> in der Seitenleiste der Gerätebibliothek öffnen, um das Inventar zu verwalten</li>
        <li>Per Rechtsklick auf eine beliebige Vorlage in der Gerätebibliothek <strong>Zum Bestand hinzufügen</strong> wählen, um sie mit einer Menge aufzunehmen</li>
        <li>Mengen direkt an Ort und Stelle bearbeiten oder einen Eintrag löschen, um ihn aus dem Inventar zu entfernen</li>
        <li>Das Inventar in eine JSON-Datei <strong>exportieren</strong> oder das eines anderen <strong>importieren</strong> — nützlich, wenn mehrere Techniker dasselbe Lager nutzen</li>
        <li>Der Abgleich läuft über einen stabilen Inventarschlüssel (Hersteller + Modellnummer + wesentliche Port-Daten), sodass Kopien derselben Vorlage über mehrere Schaltpläne hinweg auch nach einer Umbenennung erkannt werden</li>
      </ul>

      <h2>Netzwerkbericht</h2>
      <p>
        Der <strong>Netzwerkbericht</strong> steht im Menü <strong>Berichte</strong> zur Verfügung.
        Er führt alle netzwerkadressierbaren Ports im Schaltplan auf — Ethernet, NDI, Dante, AVB, SRT,
        HDBaseT, AES67 und ST 2110 — mit ihrer vollständigen Netzwerkkonfiguration.
      </p>
      <p>Die Spalten umfassen:</p>
      <ul>
        <li><strong>Gerätename</strong> und <strong>Port-Beschriftung</strong></li>
        <li><strong>Raum</strong> und <strong>Signalart</strong></li>
        <li><strong>Hostname</strong>, <strong>IP-Adresse</strong>, <strong>Subnetzmaske</strong> und <strong>Gateway</strong></li>
        <li><strong>VLAN</strong>, <strong>DHCP-Status</strong> und <strong>DHCP-Server</strong> — zeigt, welcher DHCP-Server den jeweiligen Port versorgt</li>
        <li><strong>Link-Geschwindigkeit</strong> und <strong>PoE-Aufnahme</strong></li>
      </ul>
      <h3>PoE-Budget</h3>
      <p>
        Jedes Gerät mit einem Budget als <strong>PoE-Quelle</strong> erhält eine Zeile in der Übersicht des PoE-Budgets,
        mit seinem Budget, der daran angeschlossenen Last und dem verbleibenden Rest. Die Aufnahme eines versorgten Geräts
        kann an zwei Stellen eingetragen werden und wird dennoch immer nur einmal gezählt:
      </p>
      <ul>
        <li>
          <strong>PoE-Aufnahme je Port</strong> — das Feld PoE (W) an einem Netzwerk-Port. Hat irgendein Port
          eines Geräts einen solchen Wert, zählen nur diese Port-Werte, und zwar jeweils bei der PoE-Quelle, an der die
          Verbindung des Ports ankommt.
        </li>
        <li>
          <strong>Über PoE versorgt</strong> — die Aufnahme auf Geräteebene im Geräte-Editor. Sie wird
          nur verwendet, wenn keiner der Ports des Geräts einen PoE-Wert hat, und wird einer einzigen
          PoE-Quelle angerechnet. Ist ein Gerät mit mehr als einer verkabelt, wird eine Quelle bevorzugt, die nicht selbst über PoE
          versorgt ist, sodass ein über PoE versorgter Switch bei dem Switch zählt, der ihn speist.
        </li>
      </ul>
      <p>
        Ein Gerät, dessen Stromeingang mit einem Netzteil verbunden ist, wird über seine Aufnahme auf Geräteebene
        keinem PoE-Budget angerechnet, weil es nicht aus PoE versorgt wird. Abgesetzte
        Verbindungen (Stubs) zählen genauso wie gezeichnete.
      </p>
      <p>
        Das ist nützlich, um IP-Adresslisten zu erstellen und die Netzwerkkonfiguration
        vor einer Show zu prüfen. Der Netzwerkbericht unterstützt denselben PDF-Export, CSV-Export und dasselbe Layout der
        Druckvorschau wie die Packliste.
      </p>

      <h2>Strombericht</h2>
      <p>
        Der <strong>Strombericht</strong> steht im Menü <strong>Berichte</strong> zur Verfügung.
        Er hat zwei Abschnitte:
      </p>
      <ul>
        <li>
          <strong>Stromaufnahme der Geräte</strong> — führt jedes Gerät mit Angaben zur Leistungsaufnahme auf: Modell, Gerätetyp,
          Raum, Leistungsaufnahme (Watt), Spannung und Menge. Gleiche Geräte im selben Raum werden
          zu einer Zeile mit summierter Anzahl zusammengefasst.
        </li>
        <li>
          <strong>Distro-Auslastung</strong> — führt die Geräte der Stromverteilung auf, mit: Beschriftung, Raum,
          Kapazität (Watt), aktueller Last, Auslastung in Prozent und Status. Der Status ergibt sich aus der
          Auslastung in Prozent: <strong>OK</strong>, wenn die Last sicher innerhalb der Kapazität liegt (unter 80 %),
          {" "}<strong>Warnung</strong>, wenn sie sich der Grenze nähert (80–100 %),
          und <strong>Überlastet</strong>, wenn sie die Kapazität überschreitet.
        </li>
      </ul>
      <p>
        Das ist nützlich, um den Strombedarf zu planen und zu prüfen, ob die Distros
        genug Kapazität haben. Der Strombericht unterstützt denselben PDF-Export, CSV-Export und dasselbe Layout der
        Druckvorschau wie die anderen Berichte.
      </p>

      <h2>CSV-Export</h2>
      <p>
        Ein Klick auf <strong>CSV</strong> lädt eine für Tabellenkalkulationen geeignete Datei mit der Geräte- und der Kabeltabelle herunter.
        Sie lässt sich in Excel, Google Sheets oder jeder anderen Tabellenkalkulation öffnen.
      </p>

      <h2>PDF-Export &amp; Druckvorschau</h2>
      <p>
        Ein Klick auf <strong>PDF</strong> öffnet die Druckvorschau. Sie ist ein vollwertiger Layout-Editor für Berichte — was
        in der Vorschau zu sehen ist, entspricht dem exportierten PDF.
      </p>

      <h3>Seite einrichten</h3>
      <ul>
        <li><strong>Papierformat</strong> — Letter, Legal, A4 oder Tabloid</li>
        <li><strong>Ausrichtung</strong> — Hochformat oder Querformat</li>
      </ul>

      <h3>Kopf- &amp; Fußzeile</h3>
      <p>
        Kopf- und Fußzeile sind interaktive Raster-Editoren, genau wie der Schriftfeld-Editor.
        Eine Zelle in der Vorschau anklicken, um sie auszuwählen, und dann ihren Inhalt in der Seitenleiste ändern.
      </p>
      <p>Jede Zelle kann Folgendes anzeigen:</p>
      <ul>
        <li><strong>Feld</strong> — einen Wert aus den Show-Infos (Show-Name, Veranstaltungsort, Planer, Datum usw.)</li>
        <li><strong>Fester Text</strong> — beliebigen eigenen Text (z. B. „Packliste“)</li>
        <li><strong>Logo</strong> — das hochgeladene Logo</li>
        <li><strong>Seitenzahl</strong> — automatisch ausgefüllt als „Seite X von Y“</li>
      </ul>
      <p>
        Ein Rechtsklick auf Zellen bietet weitere Optionen: Zeilen und Spalten einfügen oder löschen, Zellen verbinden
        oder die Art des Zelleninhalts ändern. Die Ränder zwischen den Zellen ziehen, um Spalten und Zeilen in der Größe zu ändern.
      </p>

      <h3>Tabellenspalten</h3>
      <p>
        Die Seitenleiste enthält Kontrollkästchen für jede Spalte jeder Tabelle. Wird der Haken einer Spalte entfernt, verschwindet sie
        aus dem Bericht. Die Ränder zwischen den Spaltenköpfen in der Vorschau ziehen, um die Spaltenbreite zu ändern.
      </p>

      <h3>Gruppierung</h3>
      <p>
        Jede Tabelle hat eine Auswahlliste <strong>Gruppieren nach</strong>. Geräte lassen sich nach Raum gruppieren,
        Kabel nach Signalweg. Gruppenüberschriften erscheinen im Bericht als schattierte Zeilen.
      </p>

      <h3>Sortierung</h3>
      <p>
        Jede Tabelle hat eine Auswahlliste <strong>Sortieren nach</strong> — eine beliebige sichtbare Spalte als Sortierspalte wählen
        und dann mit der Pfeilschaltfläche zwischen aufsteigend und absteigend umschalten.
      </p>

      <h3>Mehrseitige Vorschau</h3>
      <p>
        Erstrecken sich die Daten über mehrere Seiten, lässt sich mit den <strong>Pfeilen zur Seitennavigation</strong> in der
        Werkzeugleiste jede Seite ansehen. Die Vorschau berücksichtigt die Seitenränder und zeigt die Seitenumbrüche so, wie sie ausfallen.
        Wird eine Tabelle auf der nächsten Seite fortgesetzt, werden die Spaltenköpfe mit
        dem Zusatz „(Cont'd)“ wiederholt.
      </p>

      <h3>Zoom</h3>
      <p>
        Mit den Schaltflächen <strong>+</strong> / <strong>&minus;</strong> oder mit <strong>Zurücksetzen</strong> in
        der Werkzeugleiste lässt sich die Vorschau vergrößern oder verkleinern.
      </p>

      <h2>Layout speichern</h2>
      <p>
        Alle Einstellungen zum Berichtslayout — Papierformat, Ausrichtung, Layout von Kopf- und Fußzeile, Sichtbarkeit der Spalten,
        Gruppierung und Sortierung — werden mit der Schaltplandatei gespeichert. Wird ein Schaltplan exportiert und wieder
        importiert, kommt das Layout der Packliste mit.
      </p>
    </>
  );
}
