export default function GettingStartedPage() {
  return (
    <>
      <h1>Erste Schritte</h1>

      <h2>Schnellstart</h2>
      <ol>
        <li>
          <a href="https://easyschematic.live/">EasySchematic</a> im Browser <strong>öffnen</strong>
        </li>
        <li>
          <strong>Ein Gerät</strong> aus der Bibliothek in der linken Seitenleiste auf die Zeichenfläche <strong>ziehen</strong>
        </li>
        <li>
          Oder auf die Zeichenfläche <strong>doppelklicken</strong>, um ein Gerät ohne Ziehen zu suchen und zu platzieren
        </li>
        <li>
          <strong>Ports verbinden</strong>: einen Ausgangs-Port anklicken, dann einen passenden Eingangs-Port anklicken
        </li>
        <li>
          <strong>Gespeichert</strong> wird automatisch im localStorage des Browsers. Wahlweise lässt sich ein kostenloses
          Konto anlegen, um in der Cloud zu speichern
        </li>
      </ol>

      <h2>Bedienung</h2>
      <table>
        <thead>
          <tr>
            <th>Aktion</th>
            <th>So geht es</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><strong>Ansicht verschieben</strong></td><td>Leertaste halten + ziehen oder mit der mittleren Maustaste ziehen (immer verfügbar). Steht „Ziehen mit links“ auf „Ansicht verschieben“, verschiebt auch das Ziehen mit der linken Taste.</td></tr>
          <tr><td><strong>Zoomen</strong></td><td>Mausrad</td></tr>
          <tr><td><strong>Auswählen</strong></td><td>Ein Gerät oder eine Verbindung anklicken</td></tr>
          <tr><td><strong>Auswahl umschalten</strong></td><td>Shift+Klick fügt Elemente zur aktuellen Auswahl hinzu oder entfernt sie daraus</td></tr>
          <tr><td><strong>Auswahlrahmen</strong></td><td>Auf leerer Zeichenfläche klicken und ziehen (Standardmodus). Steht „Ziehen mit links“ auf „Ansicht verschieben“, stattdessen Shift halten und ziehen.</td></tr>
          <tr><td><strong>Richtungsabhängige Auswahl</strong></td><td>Nach rechts ziehen zum Einschließen (nur Elemente, die vollständig im Rahmen liegen), nach links ziehen für die Kreuzungsauswahl (alles, was der Rahmen berührt) — wie in AutoCAD. Die Kreuzungsauswahl erfasst auch Verbindungen, deren gerouteter Weg den Rahmen kreuzt.</td></tr>
          <tr><td><strong>Auswahlleiste</strong></td><td>Erscheint unten auf der Zeichenfläche, sobald 2 oder mehr Elemente ausgewählt sind. Zeigt einen Chip je Elementart — ein Klick stellt diese Art frei, Ctrl/⌘+Klick hebt ihre Auswahl auf. Sind Verbindungen ausgewählt, öffnet die Schaltfläche <strong>N Verbindungen bearbeiten…</strong> das Panel zur Sammelbearbeitung.</td></tr>
          <tr><td><strong>Löschen</strong></td><td>Elemente auswählen, dann Delete oder Backspace drücken</td></tr>
          <tr><td><strong>Verbinden</strong></td><td>Einen Ausgangs-Port anklicken, dann einen kompatiblen Eingang anklicken</td></tr>
          <tr><td><strong>Umstecken</strong></td><td>Von einem belegten Port aus ziehen, um die Verbindung zu verlegen</td></tr>
          <tr><td><strong>Trennen</strong></td><td>Von einem belegten Port aus ziehen und über einer leeren Fläche loslassen</td></tr>
          <tr><td><strong>Kopieren/Einfügen</strong></td><td>Ctrl+C / Ctrl+V</td></tr>
          <tr><td><strong>Rückgängig/Wiederholen</strong></td><td>Ctrl+Z / Ctrl+Shift+Z (oder Ctrl+Y)</td></tr>
          <tr><td><strong>Ausrichten</strong></td><td>Mehrere Elemente auswählen, dann das Menü Ausrichten in der Menüleiste verwenden</td></tr>
          <tr><td><strong>Gerät schnell hinzufügen</strong></td><td>Doppelklick auf leere Zeichenfläche oder auf den Hintergrund eines Raums</td></tr>
          <tr><td><strong>Raum-Eigenschaften</strong></td><td>Rechtsklick auf einen Raum</td></tr>
          <tr><td><strong>Verbindungsmenü</strong></td><td>Rechtsklick auf eine Verbindung — Stützpunkte hinzufügen, Stub umschalten, Stecker-Abweichung übergehen, Beschriftung ausblenden, Route zurücksetzen</td></tr>
          <tr><td><strong>Druckansicht</strong></td><td>F9 drücken</td></tr>
          <tr><td><strong>Dunkler Modus</strong></td><td>Sonne/Mond-Symbol in der Menüleiste (rechts)</td></tr>
        </tbody>
      </table>

      <h2>Seiten</h2>
      <p>
        Eine Schaltplandatei kann mehrere Seiten enthalten, die als Tabs am unteren Rand der Zeichenfläche erscheinen:
      </p>
      <ul>
        <li>
          <strong>Schaltplan</strong> — das Signalflussdiagramm (immer vorhanden, immer an erster Stelle)
        </li>
        <li>
          <strong>Rack-Seiten</strong> — Rack-Ansichtszeichnungen: Geräte ins Rack ziehen mit Einrasten auf Höheneinheiten,
          Ansichten von vorn / hinten / von der Seite und Zubehör. Hinzufügen über die Schaltfläche <strong>+</strong> am
          rechten Ende der Tab-Leiste. Siehe die <a href="/racks">Anleitung zum Rack-Editor</a>.
        </li>
        <li>
          <strong>Druckbögen</strong> — Layoutseiten im Papierformat, auf denen Rack-Ansichtsfenster
          zu einer druckbaren Zeichnung mit Vektor-PDF-Export zusammengestellt werden. Hinzufügen über die Schaltfläche <strong>📄+</strong>.
          Siehe <a href="/print-sheets">Druckbögen</a>.
        </li>
      </ul>
      <p>
        Ein Rechtsklick auf einen Tab erlaubt, die Seite umzubenennen, zu duplizieren oder zu löschen. Geräte werden seitenübergreifend
        per Referenz geteilt — ein Gerät in ein Rack zu setzen dupliziert es nicht; die Rack-Seite verweist
        lediglich über die ID auf das Gerät im Schaltplan. Wird es an einer der beiden Stellen bearbeitet, bleiben beide synchron.
      </p>

      <h2>Dunkler Modus</h2>
      <p>
        Ein Klick auf das <strong>Sonne/Mond-Symbol</strong> rechts in der Menüleiste wechselt zwischen hellem und dunklem
        Design. Die Einstellung wird im Browser gespeichert und bei späteren Besuchen automatisch angewendet. Beim ersten Besuch
        folgt EasySchematic der Dunkelmodus-Einstellung des Betriebssystems.
      </p>
      <p>
        Der Umschalter für den dunklen Modus steht auch in der <strong>Gerätedatenbank</strong> (devices.easyschematic.live)
        über dasselbe Symbol in der oberen Navigationsleiste zur Verfügung.
      </p>

      <h2>Einstellungen</h2>
      <p>
        Über <strong>Bearbeiten → Einstellungen</strong> lässt sich das Verhalten der Anwendung anpassen.
      </p>

      <h3>Navigation (Verhalten beim Ziehen mit links)</h3>
      <p>
        Legt fest, was das Ziehen mit der linken Maustaste auf dem Hintergrund der Zeichenfläche bewirkt. Die vollständige Tastenbelegung wird
        in den Einstellungen immer angezeigt, sodass auf einen Blick zu sehen ist, was jede Eingabe bewirkt:
      </p>
      <table>
        <thead>
          <tr>
            <th>Eingabe</th>
            <th>Auswahlrahmen (Standard)</th>
            <th>Ansicht verschieben</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><strong>Ziehen mit links</strong></td><td>Auswahlrahmen</td><td>Ansicht verschieben</td></tr>
          <tr><td><strong>Umschalt + Ziehen mit links</strong></td><td>Zur Auswahl hinzufügen</td><td>Auswahlrahmen</td></tr>
          <tr><td><strong>Ziehen mit der mittleren Taste</strong></td><td colSpan={2}>Ansicht verschieben (immer)</td></tr>
          <tr><td><strong>Leertaste + Ziehen</strong></td><td colSpan={2}>Ansicht verschieben (immer)</td></tr>
        </tbody>
      </table>
      <p>
        „Ansicht verschieben“ ist nützlich für alle, die von Figma, Miro oder draw.io kommen und mit der linken Maustaste
        lieber navigieren als auswählen.
      </p>

      <h3>Mausrad-Konfiguration</h3>
      <p>
        Jeder Kombination aus Scrollen und Zusatztaste lässt sich eine Aktion zuweisen:
      </p>
      <table>
        <thead>
          <tr>
            <th>Eingabe</th>
            <th>Standardaktion</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><strong>Scrollen</strong></td><td>Zoom</td></tr>
          <tr><td><strong>Umschalt + Scrollen</strong></td><td>Nach links / rechts</td></tr>
          <tr><td><strong>Strg + Scrollen</strong></td><td>Nach oben / unten</td></tr>
        </tbody>
      </table>
      <p>
        Verfügbare Aktionen: <strong>Zoom</strong>, <strong>Nach links / rechts</strong> und <strong>Nach oben / unten</strong>.
        Die Schaltfläche <strong>Auf Standard zurücksetzen</strong> stellt die Standardbelegung wieder her.
      </p>

      <h3>Trackpad-Unterstützung</h3>
      <ul>
        <li>
          <strong>Trackpad-Modus</strong> — aktiviert die Trackpad-Erkennung für Zoomen mit zwei Fingern (Pinch) und Verschieben mit zwei Fingern
        </li>
        <li>
          <strong>Empfindlichkeit</strong> — Schieberegler für Zoomgeschwindigkeit und Verschiebegeschwindigkeit (0.25x–3x) zur Feinabstimmung des Trackpad-Verhaltens
        </li>
      </ul>

      <h3>Klickbereich der Verbindungen</h3>
      <p>
        Stellt ein, wie nah der Mauszeiger an einer Verbindung sein muss, um sie auszuwählen. Der Klickbereich
        lässt sich vergrößern, wenn Verbindungen schwer zu treffen sind. Zu finden unter{" "}
        <strong>Bearbeiten → Einstellungen</strong>.
      </p>

      <h3>Schreibweise der Beschriftungen</h3>
      <p>
        Erzwingt die Groß-/Kleinschreibung in der Anzeige von Gerätenamen, Port-Beschriftungen, Slot-Beschriftungen und Karten-Beschriftungen auf
        der Zeichenfläche und in allen Exporten (PDF, DXF, Packliste, Kabelliste, Patchfeld-Belegung,
        Netzwerk- / Stromberichte):
      </p>
      <ul>
        <li><strong>Wie eingegeben</strong> — Standard; Beschriftungen erscheinen genau so, wie sie eingegeben wurden</li>
        <li><strong>GROSSBUCHSTABEN</strong> — setzt alles in Großbuchstaben</li>
        <li><strong>kleinbuchstaben</strong> — setzt alles in Kleinbuchstaben</li>
        <li>
          <strong>Wortanfänge Groß</strong> — schreibt den ersten Buchstaben jedes Worts groß; vorhandene
          Großbuchstaben bleiben unangetastet, sodass Abkürzungen wie HDMI und SDI erhalten bleiben
        </li>
      </ul>
      <p>
        Die Einstellung betrifft nur die Anzeige — die zugrunde liegenden Beschriftungsdaten werden nie verändert. Es lässt sich also
        jederzeit auf <strong>Wie eingegeben</strong> zurückschalten, um die ursprüngliche Schreibweise zu sehen. Die
        Einstellung wird mit dem Schaltplan gespeichert, weitergegebene Dateien kommen also mit derselben Einstellung an.
      </p>

      <h2>Ansichtsoptionen</h2>
      <p>
        Das Panel <strong>Ansichtsoptionen</strong> in der rechten Seitenleiste (oder über das Menü{" "}
        <strong>Ansicht</strong>) steuert, was auf der Zeichenfläche sichtbar ist:
      </p>
      <ul>
        <li>
          <strong>Sichtbarkeit der Signalarten</strong> — einzelne Signalarten ein- und ausschalten, um sich auf
          bestimmte Signalflüsse zu konzentrieren. Die Schaltfläche „Alle zeigen“ setzt das zurück.
        </li>
        <li>
          <strong>Nicht belegte Ports ausblenden</strong> — blendet Ports ohne Verbindungen aus, für ein aufgeräumteres Bild
        </li>
        <li>
          <strong>Show device types</strong> — schaltet die Gerätetyp-Beschriftungen unter den Gerätenamen um
        </li>
        <li>
          <strong>Leitungssprünge an Kreuzungen anzeigen</strong> — Bogenmarkierungen an Verbindungskreuzungen für bessere Lesbarkeit
        </li>
        <li>
          <strong>Kabel-IDs anzeigen</strong> — zeigt die Kabel-ID-Beschriftungen an den Verbindungen
        </li>
        <li>
          <strong>Alle Adapter ausblenden</strong> — lässt Adapter-Geräte zu einzelnen Verbindungslinien zusammenfallen (Einzelheiten
          in der Anleitung zu Verbindungen)
        </li>
        <li>
          <strong>Minimap</strong> — blendet die Minimap der Zeichenfläche ein oder aus. Sie lässt sich auch mit dem{" "}
          <strong>✕</strong> in ihrer Ecke schließen und über das Menü <strong>Ansicht</strong> zurückholen; die
          Wahl bleibt über Sitzungen hinweg erhalten
        </li>
      </ul>

      <h2>Arbeit speichern</h2>
      <ul>
        <li>
          <strong>Automatisches Speichern</strong> — speichert nach jeder Änderung im localStorage (immer aktiv, kein Konto nötig)
        </li>
        <li>
          <strong>Cloud-Speicher</strong> — mit einem kostenlosen Konto (Magic-Link per E-Mail oder Google-Anmeldung, kein Passwort nötig) lassen sich bis zu
          10 Schaltpläne in der Cloud speichern. Der Zugriff ist von jedem Browser aus über <strong>Datei → Meine Schaltpläne</strong> möglich
        </li>
        <li>
          <strong>Freigeben</strong> — die Freigabe eines in der Cloud gespeicherten Schaltplans einschalten, um einen Link zu erzeugen, den jeder öffnen kann
        </li>
        <li>
          <strong>Als Datei speichern</strong> — exportiert eine <code>.json</code>-Datei, die sich später wieder importieren lässt
        </li>
        <li>
          <strong>Export → PNG/SVG</strong> — Bildexport für die Dokumentation
        </li>
        <li>
          <strong>Export → DXF</strong> — CAD-kompatibler Export für Vectorworks und andere Programme
        </li>
        <li>
          <strong>Export → PDF</strong> — mehrseitiges Dokument entsprechend den Einstellungen der Druckansicht
        </li>
      </ul>
    </>
  );
}
