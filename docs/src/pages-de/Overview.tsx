export default function OverviewPage() {
  return (
    <>
      <h1>EasySchematic</h1>

      <p>
        EasySchematic ist ein browserbasiertes Werkzeug zum Entwerfen von <strong>AV-Signalflussdiagrammen</strong>
        (Verkabelungsplänen). Es ist für Broadcast-Ingenieure, Live-Produktionsteams und AV-Integratoren gemacht, die schnell
        darstellen müssen, wie Geräte verbunden sind.
      </p>
      <p>
        Alles läuft im Browser — keine Installation nötig. Die Arbeit wird automatisch im localStorage gespeichert; mit einem
        kostenlosen Konto lassen sich Schaltpläne in der Cloud speichern und von jedem Browser aus öffnen.
      </p>
      <p>
        <strong>
          <a href="https://easyschematic.live/">EasySchematic öffnen &rarr;</a>
        </strong>
      </p>

      <h2>Die wichtigsten Funktionen</h2>
      <ul>
        <li>
          <strong>Geräte</strong> mit typisierten Ein- und Ausgangs-Ports (SDI, HDMI, NDI, Dante, AVB, DMX, MADI und insgesamt 68 Signalarten)
        </li>
        <li>
          <strong>Färbung nach Signalart</strong> — Verbindungen sind nach Signalart farbcodiert, die Farben sind anpassbar
        </li>
        <li>
          <strong>Intelligentes Verbindungs-Routing</strong> — A*-Wegsuche führt Verbindungen um Geräte herum und legt parallele Verbindungen ineinander
        </li>
        <li>
          <strong>Gruppierung in Räumen</strong> — Geräte in Raum-Container ziehen, um sie nach physischem Ort zu ordnen; Sperren/Entsperren schützt vor versehentlichem Verschieben
        </li>
        <li>
          <strong>Notizen &amp; Anmerkungen</strong> — Anmerkungen mit formatiertem Text, Rechteck- und Ellipsenformen sowie Formatierung (fett, kursiv, Aufzählungen, Schriftgrößen)
        </li>
        <li>
          <strong>Kabel-ID-Beschriftungen</strong> — automatisch vergebene Beschriftungen für Verbindungen, mit denen sich einzelne Kabelwege leicht benennen lassen
        </li>
        <li>
          <strong>Leitungssprünge</strong> — Bogenmarkierungen an Verbindungskreuzungen für bessere Lesbarkeit
        </li>
        <li>
          <strong>Gerätebibliothek</strong> — über 2.000 Vorlagen realer Geräte aus der Community-Bibliothek — Kameras,
          Bildmischer, Tonpulte, Lichtpulte, LED-Prozessoren, Medienserver und mehr — live abgerufen, mit einem
          mitgelieferten Offline-Bestand als Rückfallebene
        </li>
        <li>
          <strong>Erweiterungs-Slots</strong> — Geräte mit wechselbaren Kartenschächten; per Rechtsklick auf einen Slot lassen sich I/O-Karten ein- oder ausbauen
        </li>
        <li>
          <strong>Eigene Vorlagen &amp; Presets</strong> — Gerätekonfigurationen speichern oder projektweite Standards für jede Vorlage festlegen
        </li>
        <li>
          <strong>Favoriten</strong> — häufig verwendete Geräte mit einem Stern markieren, um sofort darauf zuzugreifen
        </li>
        <li>
          <strong>Schnelles Hinzufügen</strong> — Doppelklick auf die Zeichenfläche, um ein Gerät in einem Schritt zu suchen und zu platzieren
        </li>
        <li>
          <strong>Raumgestaltung</strong> — Hintergrundfarbe, Rahmenstil und Schriftgröße über das Rechtsklick-Kontextmenü anpassen
        </li>
        <li>
          <strong>Cloud-Speicher</strong> — mit einem kostenlosen Konto bis zu 10 Schaltpläne in der Cloud speichern; Zugriff von jedem Browser aus
        </li>
        <li>
          <strong>Freigabe</strong> — einen Link erzeugen, um einen in der Cloud gespeicherten Schaltplan mit beliebigen Personen zu teilen
        </li>
        <li>
          <strong>Dunkler Modus</strong> — in der Menüleiste zwischen hellem und dunklem Design wechseln; die Einstellung wird automatisch gespeichert und folgt beim ersten Besuch der Einstellung des Betriebssystems
        </li>
        <li>
          <strong>Trackpad-Unterstützung</strong> — Zoomen mit zwei Fingern (Pinch) und Verschieben mit zwei Fingern bei einstellbarer Empfindlichkeit
        </li>
        <li>
          <strong>Ausrichtwerkzeuge</strong> — ausgewählte Geräte horizontal oder vertikal ausrichten und verteilen
        </li>
        <li>
          <strong>Export</strong> — PNG, SVG, PDF, DXF (für CAD/Vectorworks) und JSON zum Weitergeben
        </li>
        <li>
          <strong>Druckansicht</strong> — Überlagerung der Seitengrenzen mit einstellbarem Papierformat, Ausrichtung und Maßstab
        </li>
        <li>
          <strong>Schriftfeld-Editor</strong> — anpassbares Rasterlayout mit Logo-Upload für eine professionelle Druckausgabe
        </li>
        <li>
          <strong>Netzwerk- &amp; Stromberichte</strong> — IP-Adresslisten, VLAN-Zuordnungen, PoE-Budgets und Analyse der Stromverteilung
        </li>
        <li>
          <strong>Patchfeld-Belegung</strong> — Bericht je Port über jedes Patchfeld im Schaltplan, einschließlich
          nicht belegter Ports, mit Belegungs-Badges und Gruppierung nach Panel / Raum / Signal / Seite
        </li>
        <li>
          <strong>Stecker-Ausführung</strong> — je Port automatisch abgeleitet, mit den Zusätzen M-M / F-F an Kabeln, die
          Stecker gleicher Ausführung brauchen, damit die Packliste dem entspricht, was tatsächlich gekauft wird
        </li>
        <li>
          <strong>Geschätzte Kabellänge</strong> — automatisch aus den Abständen von Raum zu Raum befüllt, wenn beide Endpunkte
          in platzierten Räumen liegen
        </li>
        <li>
          <strong>Bibliothek „Eigener Bestand“</strong> — ein Inventar der eigenen Geräte pflegen; die Packliste stellt verwendete
          und benötigte Stückzahlen gegenüber, sodass klar ist, was aus dem Lager kommt und was zu mieten ist
        </li>
        <li>
          <strong>Sammelimport von Gerätevorlagen</strong> — viele eigene Vorlagen auf einmal aus einer JSON- oder CSV-Datei importieren
          (z. B. aus dem Katalogauszug eines Herstellers)
        </li>
        <li>
          <strong>Schreibweise der Beschriftungen</strong> — Anzeige-Einstellung (Wie eingegeben / GROSSBUCHSTABEN / kleinbuchstaben / Wortanfänge Groß),
          mit dem Schaltplan gespeichert
        </li>
        <li>
          <strong>Signalart-Filter</strong> — die Gerätesuche auf Vorlagen eingrenzen, die eine gewählte Signalart anbieten
        </li>
        <li>
          <strong>IO-Anzahl</strong> — optionale Badges an Geräten, die belegte und vorhandene Ports je Richtung zeigen
        </li>
        <li>
          <strong>Platzhalter in eigenen Beschriftungen</strong> — <code>{"{{cableId}}"}</code> und andere Tokens in
          Gerätebeschriftungen einbetten, um Kabel direkt im Text zu referenzieren
        </li>
        <li>
          <strong>CSV-Import</strong> — Kabellisten-Tabellen importieren, um daraus automatisch Schaltpläne zu erzeugen
        </li>
        <li>
          <strong>Auto-Routing abschaltbar</strong> — das intelligente Routing deaktivieren, um große Schaltpläne verzögerungsfrei zu bearbeiten
        </li>
        <li>
          <strong>Router schnell anlegen</strong> — Matrix-Router mit einstellbarer Anzahl von Ein- und Ausgängen und einstellbarer Signalart erzeugen
        </li>
        <li>
          <strong>Adapter</strong> — automatisches Einfügen von Adaptern zwischen nicht kompatiblen Ports, mit Direktanschluss,
          Kupplungen, Kennzeichnung der Ausführung und Ein-/Ausblenden je Adapter
        </li>
        <li>
          <strong>Linienstile für Verbindungen</strong> — durchgezogen, gestrichelt, gepunktet oder Strich-Punkt je Verbindung oder je Signalart
        </li>
        <li>
          <strong>Unterräume</strong> — geschachtelte Raum-Container für Orte innerhalb von Orten
        </li>
        <li>
          <strong>Rack-Editor</strong> — eigene Rack-Ansichtsseiten mit 2-Holm- / 4-Holm-Racks in Standardhöhen, Ziehen ins Rack mit Einrasten auf Höheneinheiten, Unterstützung für halbe Rackbreite, Zubehör (Fachböden, Lüftungsblenden, Blindblenden, Schubladen, Kabelführungen) und Ansichten von vorn / hinten / von der Seite — siehe die <a href="/racks">Anleitung zum Rack-Editor</a>
        </li>
        <li>
          <strong>Automatischer Fachboden</strong> — kleine, nicht rackmontierbare Geräte (DI-Boxen, DSPs in halber Breite, Tischgeräte) werden auf einer Höheneinheit abgelegt und erzeugen automatisch einen 1-HE-Fachboden in natürlicher Breite; zu große Geräte werden mit einer klaren Fehlermeldung abgewiesen
        </li>
        <li>
          <strong>Frontblenden-Editor</strong> — Steckverbinder auf der Frontplatte eines Geräts an eigene Positionen ziehen, mit Einrasten am Raster, Ausrichten / Verteilen bei Mehrfachauswahl, eigenen Beschriftungen und Rückgängig / Wiederholen. 59 Steckertypen werden millimetergenau in drei Zoomstufen dargestellt
        </li>
        <li>
          <strong>Verknüpfung Raum ↔ Rack</strong> — einen Raum im Schaltplan mit einem Rack verknüpfen, damit „Auto-Belegen“ Positionen für jedes Gerät im Raum vorschlagen kann; der Rack-Kopf zeigt ein Verknüpfungs-Badge, das per Klick zum Raum springt
        </li>
        <li>
          <strong>Druckbögen</strong> — Layoutseiten im Papierformat (Letter, Tabloid, A3, A4, benutzerdefiniert), auf denen Rack-Ansichtsfenster zu einer druckbaren Zeichnung zusammengestellt werden; Größenänderung von Gruppen bei Mehrfachauswahl, Ausrichtungshilfslinien, Vektor-PDF-Export — siehe die <a href="/print-sheets">Anleitung zu Druckbögen</a>
        </li>
        <li>
          <strong>Equipment-Rack-Räume</strong> — einen Raum im Schaltplan als Equipment-Rack markieren, um ihn direkt im Schaltplan im Rack-Stil darzustellen (unabhängig von den oben genannten eigenen Rack-Editor-Seiten)
        </li>
        <li>
          <strong>Kostenerfassung in der Stückliste</strong> — Felder für Stückkosten an Geräten und Kabeln für die Budgetplanung
        </li>
        <li>
          <strong>Mobile Nutzung</strong> — Erkennung von Mobilgeräten mit Hamburger-Menü und touchfreundlicher Bedienung
        </li>
        <li>
          <strong>Google OAuth</strong> — Anmeldung mit Google oder per Magic-Link-E-Mail
        </li>
        <li>
          <strong>Offline-Cache für die Cloud</strong> — Cloud-Schaltpläne werden für den Offline-Zugriff in IndexedDB zwischengespeichert
        </li>
        <li>
          <strong>Physische Abmessungen</strong> — Höhe, Breite, Tiefe (mm) und Gewicht (kg) eines Geräts bestimmen die Einstufung für den automatischen Fachboden, Tiefenkonflikte in der Seitenansicht und die Kennzahlen je Rack (belegte HE, Gesamtgewicht, Leistung)
        </li>
        <li>
          <strong>Hostname</strong> — Hostname-Feld je Gerät, das in den Netzwerkbericht einfließt
        </li>
        <li>
          <strong>Zusatzdaten</strong> — anpassbare Textzeilen am unteren Rand jedes Geräts
        </li>
        <li>
          <strong>Vom Veranstaltungsort gestellte Geräte</strong> — Geräte als vom Veranstaltungsort gestellt kennzeichnen, damit die Packliste sie unterscheidet
        </li>
        <li>
          <strong>Verschachtelte Slots</strong> — Erweiterungskarten mit Unter-Slots (z. B. SFP-Transceiver in Netzwerkkarten)
        </li>
        <li>
          <strong>Ports umlegen</strong> — jeden Port auf die gegenüberliegende Seite des Geräts legen
        </li>
        <li>
          <strong>Port-Notizen</strong> — Notizfeld je Port für die Dokumentation
        </li>
      </ul>
    </>
  );
}
