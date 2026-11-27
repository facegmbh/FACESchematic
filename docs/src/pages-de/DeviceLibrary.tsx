export default function DeviceLibraryPage() {
  return (
    <>
      <h1>Gerätebibliothek</h1>

      <h2>Eingebaute Vorlagen</h2>
      <p>
        Die Sidebar der Gerätebibliothek enthält <strong>über 2.000 Vorlagen echter Geräte</strong> aus der
        Community-Gerätebibliothek — Bildmischer, Kreuzschienen, Audiokonsolen, Mischpulte, Mikrofone, Intercom, KVM-Extender,
        Licht, LED-Prozessoren, Medienserver und vieles mehr. Die Vorlagen werden bei bestehender Internetverbindung live aus der
        Community-Datenbank geladen; eine mitgelieferte Auswahl steckt in der App für den Offline-Betrieb.
      </p>
      <p>
        Die vollständige Live-Bibliothek — samt Aufschlüsselung nach Kategorien und Suche — lässt sich unter{" "}
        <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">
          devices.easyschematic.live
        </a>
        {" "}durchstöbern.
      </p>

      <h2>Vorlagen verwenden</h2>
      <ol>
        <li><strong>Suchen</strong> durch Tippen im Suchfeld — Anfragen aus mehreren Wörtern werden bewertet und gereiht, Favoriten rücken dabei nach oben</li>
        <li>Eine Vorlage aus der Bibliothek auf die Zeichenfläche <strong>ziehen</strong></li>
        <li>Das Gerät erscheint mit vorkonfigurierten Ports, die der echten Hardware entsprechen</li>
      </ol>
      <p>
        Vorlagen liefern sinnvolle Vorgaben — die richtigen Signalarten, Port-Namen und die I/O-Konfiguration für jeden
        Gerätetyp.
      </p>

      <h2>Eigene Vorlagen</h2>
      <p>Nach dem Bearbeiten der Ports und der Konfiguration eines Geräts:</p>
      <ol>
        <li>Mit einem <strong>Doppelklick</strong> auf das Gerät den Editor öffnen</li>
        <li>Ports, Namen und Signalarten nach Bedarf einrichten</li>
        <li>Unten im Editor auf <strong>Als eigene Vorlage speichern</strong> klicken</li>
        <li>Die Vorlage erscheint in der Bibliothek in einer Kategorie „Eigene Vorlagen“</li>
      </ol>
      <p>
        Wer mit Odoo angemeldet ist, speichert eigene Vorlagen in der zentralen Bibliothek (siehe
        unten). Ohne Anmeldung bleiben sie im localStorage des Browsers.
      </p>

      <h2>Eine Vorlage aktualisieren</h2>
      <p>
        Eine Vorlage lässt sich nachträglich ändern, und die Änderung kann auf jedes Exemplar durchschlagen,
        das bereits im aktuellen Schaltplan platziert ist:
      </p>
      <ul>
        <li>
          <strong>Eigene Vorlagen</strong> — beim Bearbeiten eines Geräts, das aus einer eigenen
          Vorlage stammt, erscheint die Schaltfläche <strong>Eigene Vorlage aktualisieren</strong>. Sie überschreibt die gespeicherte
          Vorlage mit der aktuellen Konfiguration. Ist das Gerät an anderer Stelle im
          Schaltplan platziert, wird eine Bestätigung abgefragt; danach werden diese anderen Exemplare an die neue
          Definition angeglichen — neue Ports kommen hinzu, und bestehende Verbindungen bleiben überall dort erhalten, wo es den
          Port noch gibt.
        </li>
        <li>
          <strong>Eingebaute Geräte</strong> — beim Bearbeiten eines eingebauten Bibliotheksgeräts bietet das Speichern-Menü{" "}
          <strong>Als eigene Vorlage aktualisieren</strong> an (der Pfeil neben{" "}
          <strong>Als eigene Vorlage speichern</strong>). Das legt eine eigene Vorlage an, deren Name um{" "}
          <em>(Custom)</em> ergänzt ist (später umbenennbar wie jede eigene Vorlage), hängt dieses Gerät
          daran um und wendet die Änderung auf die anderen Exemplare dieses eingebauten Geräts im Schaltplan an.
        </li>
      </ul>
      <p>
        Entfernte Ports, deren Verbindungen noch in Gebrauch sind, bleiben als verwaiste Ports erhalten, damit keine Verkabelung
        stillschweigend verloren geht; sie lassen sich von Hand aufräumen.
      </p>

      <h2>Zentrale Bibliothek in Odoo</h2>
      <p>
        Eigene Vorlagen liegen in Odoo, für alle gleich. Was jemand anlegt oder ändert, sehen die anderen
        beim nächsten Anmelden oder spätestens, wenn ihr Fenster nach fünf Minuten wieder in den
        Vordergrund kommt. In Odoo stehen die Vorlagen unter <strong>FACESchematic → Gerätevorlagen</strong>,
        dort zeigt der Verlauf, wer was geändert hat.
      </p>
      <ul>
        <li>
          <strong>Ändern:</strong> Jede Änderung an einer Vorlage erhöht ihre Version. Zeichnungen mit einem
          älteren Stand zeigen das am Gerät an und bieten die Aktualisierung an. Geräte in Zeichnungen
          ändern sich nie von selbst.
        </li>
        <li>
          <strong>Gleichzeitig ändern:</strong> Hat ein Kollege dieselbe Vorlage inzwischen geändert, wird die
          eigene Änderung nicht gespeichert. Eine Meldung nennt ihn, und seine Fassung wird geladen.
        </li>
        <li>
          <strong>Entfernen:</strong> Eine Vorlage aus der Bibliothek zu entfernen, archiviert sie in Odoo.
          „Alle eigenen Vorlagen löschen“ leert dagegen nur den eigenen Browser; die Vorlagen aus Odoo kommen
          beim nächsten Laden wieder.
        </li>
        <li>
          <strong>Ohne Netz:</strong> Der Browser behält den letzten Stand. Neue Vorlagen, die Odoo nicht
          erreichen, bleiben im Browser und tragen das Kennzeichen <em>lokal</em>.
        </li>
        <li>
          <strong>Hochladen:</strong> Vorlagen mit dem Kennzeichen <em>lokal</em> – ältere aus dem Browser oder
          welche, die eine Zeichnung mitgebracht hat – lädt <strong>Nach Odoo hochladen</strong> im Abschnitt
          der eigenen Vorlagen einmal hoch. Was es in Odoo schon gibt, wird nicht verdoppelt; liegt dort eine
          andere Fassung, bleibt die eigene im Browser und wird gemeldet.
        </li>
        <li>
          <strong>Odoo-Artikel:</strong> Im Geräte-Editor verknüpft das Feld <strong>Odoo-Artikel (Vorlage)</strong>{" "}
          die Vorlage mit einem Artikel aus Odoo. Das gilt für das Modell, nicht für ein einzelnes Gerät, und
          wird sofort gespeichert. Der Artikel steht danach in der Bibliothek an der Vorlage.
        </li>
        <li>
          <strong>Claude:</strong> Über den Odoo-Connector legt Claude eigene Vorlagen an und ändert sie, zum
          Beispiel „Leg den Ajax MotionCam Outdoor als Vorlage an, Reichweite laut Datenblatt“. Claude sucht
          zuerst in der Bibliothek, leitet möglichst von einem ähnlichen Gerät ab und nennt Ports und Werte,
          bevor es speichert. Die Vorlage landet in Odoo mit der Herkunft <em>Claude</em>, Änderungen laufen
          unter dem eigenen Odoo-Namen. Mitgelieferte Vorlagen ändert Claude nicht, es leitet eine eigene ab.
          Archivieren und Löschen bleiben beim Nutzer.
        </li>
      </ul>

      <h2>Favoriten</h2>
      <p>
        Jede Gerätevorlage in der Bibliothek lässt sich mit einem Stern als Favorit markieren. Favoriten sind
        oben in der Sidebar in einer eigenen Kategorie <strong>Favoriten</strong> angeheftet und rücken in den
        Suchergebnissen nach oben.
      </p>
      <ul>
        <li>Ein Klick auf das <strong>Stern-Symbol</strong> an einem Bibliothekseintrag schaltet den Favoritenstatus um</li>
        <li>Favoriten werden in der Schaltplandatei gespeichert und bleiben über Sitzungen hinweg erhalten</li>
      </ul>

      <h2>Vorlagen-Presets</h2>
      <p>
        Mit Presets lässt sich eine Gerätekonfiguration als <strong>projektweite Vorgabe</strong> für
        die jeweilige Vorlage speichern. Bei jedem neuen Platzieren dieses Geräts wird die Preset-Konfiguration
        automatisch angewendet.
      </p>
      <ol>
        <li>Ports, Namen oder Signalarten eines Geräts bearbeiten</li>
        <li>Im Speichern-Menü des Geräte-Editors <strong>Als Preset speichern</strong> wählen</li>
        <li>Die Bibliothek zeigt an dieser Vorlage eine <strong>Preset-Marke</strong></li>
      </ol>
      <p>
        Beim Bearbeiten eines Geräts, das ein Preset hat, zeigt ein blaues Banner das aktive Preset mit
        einer Schaltfläche <strong>Leeren</strong>. Ist die Konfiguration des Geräts vom Preset abgewichen,
        erscheinen die Schaltflächen <strong>Auf Preset zurücksetzen</strong> und <strong>Auf Vorlage zurücksetzen</strong>,
        um einen der beiden Ausgangsstände wiederherzustellen. Das Zurücksetzen setzt auch die Kopfzeilenfarbe des Geräts auf das zurück, was ein neu platziertes
        Gerät von diesem Preset oder dieser Vorlage und danach von der Standard-Kopfzeilenfarbe bekäme; eine Farbe, die
        am Gerät selbst gewählt wurde, geht also verloren.
      </p>

      <h2>Automatische Nummerierung</h2>
      <p>
        Werden mehrere Exemplare derselben Gerätevorlage platziert, nummeriert FACESchematic sie automatisch:
        „Camera 1“, „Camera 2“ usw. Wird ein Gerät von Hand umbenannt, fällt es aus der automatischen Nummerierung heraus.
      </p>

      <h2>Router schnell anlegen</h2>
      <p>
        Wird eine Kreuzschiene mit bestimmten I/O-Anzahlen gebraucht? Die Eingabe von <strong>„router“</strong> in der Suche der Gerätebibliothek
        blendet die Schaltfläche <strong>Create Custom Router</strong> ein. Sie öffnet einen Dialog, in dem sich Folgendes tun lässt:
      </p>
      <ul>
        <li>Einen <strong>Gerätenamen</strong> und den Gerätetyp setzen</li>
        <li><strong>Eingangs- und Ausgangsabschnitte</strong> festlegen — jeder Abschnitt hat einen Namen, ein Port-Präfix, eine Anzahl und eine Signalart</li>
        <li>Mehrere Abschnitte pro Seite anlegen (z. B. 16 SDI-Eingänge + 4 HDMI-Eingänge + 16 SDI-Ausgänge + 4 HDMI-Ausgänge)</li>
        <li>Der Router wird auf der Zeichenfläche platziert und als eigene Vorlage gespeichert</li>
      </ul>

      <h2>Erweiterungs-Slots</h2>
      <p>
        Manche Geräte haben <strong>Erweiterungs-Slots</strong> — wechselbare Kartenschächte, die verschiedene I/O-Karten aufnehmen.
        Das bildet ab, wie echte Hardware funktioniert: Ein Videokreuzschienen-Chassis wird womöglich mit leeren Slots geliefert, die je nach Auftrag
        mit SDI-, HDMI- oder Glasfaserkarten bestückt werden.
      </p>
      <ul>
        <li><strong>Rechtsklick auf einen Slot</strong> an einem Gerät zeigt die verfügbaren Karten und setzt eine ein</li>
        <li>Jede Karte bringt ihre eigenen Ports in das übergeordnete Gerät ein</li>
        <li>Slots zeigen den Namen der aktuell eingebauten Karte (oder „Empty“, wenn sie unbelegt sind)</li>
        <li>Beim Tausch einer Karte werden die Ports der alten Karte entfernt und die der neuen hinzugefügt</li>
      </ul>

      <h2>Community-Gerätedatenbank</h2>
      <p>
        Die Vorlagen stammen aus der <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">Community-Gerätedatenbank</a>{" "}
        des ursprünglichen EasySchematic. FACESchematic liest sie nur: Aus der App heraus lässt sich nichts dorthin einreichen,
        und Zeichnungen oder eigene Vorlagen werden nie dorthin übertragen.
      </p>
      <p>
        Fehlt ein Gerät, wird es als eigene Vorlage angelegt (siehe oben) oder über{" "}
        <a href="/import-devices">Geräte importieren</a> eingelesen. An Kolleginnen und Kollegen weitergeben lassen sich eigene
        Vorlagen als Gerätearchiv — siehe <a href="/import-export">Dateien &amp; Exporte</a>.
      </p>
    </>
  );
}
