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
      <p>Eigene Vorlagen bleiben im localStorage des Browsers gespeichert.</p>

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
        Werden mehrere Exemplare derselben Gerätevorlage platziert, nummeriert EasySchematic sie automatisch:
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
        In der <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">Community-Gerätedatenbank</a> kann
        jeder Gerätevorlagen durchstöbern, durchsuchen und beitragen.
      </p>
      <ul>
        <li><strong>Neue Geräte einreichen</strong> — mit der E-Mail-Adresse anmelden, das Geräteformular mit Ports und technischen Daten ausfüllen
          und eine Referenz-URL zur Produktseite des Herstellers angeben. Eine Live-Vorschau über dem Formular zeigt das
          Gerät genau so, wie es auf der Zeichenfläche des Schaltplans erscheinen wird — samt Port-Farben und Abschnittsgruppen —,
          sodass sich das Layout vor dem Einreichen prüfen lässt. Ports lassen sich durch Ziehen an ihrem Griff
          (oder mit den Auf-/Ab-Schaltflächen) umsortieren, und das Ziehen eines Ports in eine andere Gruppe ändert seine Richtung</li>
        <li><strong>Änderungen vorschlagen</strong> — ein Fehler oder ein fehlender Port entdeckt? Änderungen lassen sich zu jeder bestehenden Vorlage vorschlagen</li>
        <li><strong>Moderation</strong> — Einreichungen werden vor der Veröffentlichung von Moderatoren geprüft, um die Richtigkeit sicherzustellen</li>
        <li><strong>Referenz-URLs</strong> — Markengeräte verlinken direkt auf die Produktseite des Herstellers, sodass
          Moderatoren (und du) die technischen Daten prüfen können</li>
        <li><strong>Nennung der Beitragenden</strong> — freigegebene Einreichungen werden dir auf der Geräteseite und in der
          Ruhmeshalle der Beitragenden zugeschrieben</li>
        <li><strong>Aus der App einreichen</strong> — Rechtsklick auf ein beliebiges eigenes Gerät auf der Zeichenfläche und
          „An die Community senden“ wählen, um es direkt einzureichen, ohne die Angaben auf der Geräte-Website erneut einzugeben.
          Das funktioniert auch für Verbesserungen an bestehenden Bibliotheksgeräten: Ein platziertes Gerät bearbeiten (einen Port korrigieren,
          einen fehlenden Steckverbinder ergänzen), und dieselbe Aktion erscheint im Speichern-Menü des Geräte-Editors, sobald Änderungen vorgenommen wurden</li>
        <li><strong>Von einem bestehenden Gerät klonen</strong> — auf der Geräte-Website hat das Formular „Submit a device“ eine
          Option <em>Clone existing device</em>; eine beliebige vorhandene Vorlage wählen, und das Formular wird mit deren Ports,
          Steckverbindern und Metadaten vorausgefüllt. Anpassen, was abweicht (ein Schwestermodell, eine regionale Variante), und einreichen — die
          Moderationswarteschlange erhält so einen deutlich saubereren Diff als bei einem frisch abgetippten Formular</li>
        <li><strong>Funktioniert offline</strong> — die Geräte-Website einmal online besuchen, und sie funktioniert auch ohne
          Verbindung weiter: Durchstöbern, Suche, Filter und jede Geräteseite werden aus einer lokal gespeicherten Kopie der
          Bibliothek bedient. Ein Banner „offline“ zeigt an, wenn die gespeicherte Kopie zu sehen ist, und sie aktualisiert sich automatisch,
          sobald wieder eine Verbindung besteht. Die Website lässt sich außerdem aus dem Browser als App installieren, genauso wie die
          eigentliche EasySchematic-App</li>
      </ul>
    </>
  );
}
