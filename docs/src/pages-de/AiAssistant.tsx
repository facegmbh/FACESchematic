export default function AiAssistantPage() {
  return (
    <>
      <h1>KI-Assistent (MCP)</h1>

      <p>
        EasySchematic lässt sich mit einem KI-Assistenten (etwa Claude) verbinden, der dann{" "}
        <strong>den Schaltplan live lesen und bearbeiten</strong> kann — die
        Gerätebibliothek durchsuchen, Geräte hinzufügen, Geräteeigenschaften setzen
        und Verbindungen ziehen; die Ergebnisse erscheinen während der Arbeit auf
        der Zeichenfläche. Die Funktion ist eine frühe <strong>Beta</strong> und
        standardmäßig ausgeschaltet.
      </p>

      <div
        className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r my-4"
        role="note"
      >
        <strong>So funktioniert es:</strong> Ein kleines Programm, der{" "}
        <em>MCP-Server</em>, läuft auf dem eigenen Rechner. Der Assistent spricht
        mit diesem Server, und der Server spricht mit dem offenen
        EasySchematic-Tab über eine Verbindung, die den Rechner nicht verlässt
        (nur <code>127.0.0.1</code>). Die Zeichnung ist nur erreichbar, solange
        die Einstellung eingeschaltet ist, und erst, nachdem ein einmaliges{" "}
        <strong>Kopplungs-Token</strong> abgeglichen wurde.
      </div>

      <h2>Bei FACE: über den Odoo-Connector (nichts zu installieren)</h2>

      <p>
        Auf <strong>schematic.face-gmbh.com</strong> erreicht Claude den Tab über den{" "}
        <strong>FACE-Odoo-Connector</strong>, der ohnehin schon in claude.ai, Claude Desktop, am
        Handy und mit Jarvis genutzt wird — kein MCP-Server, kein Token, kein Port.
      </p>

      <ol>
        <li>
          Oben rechts im Editor mit Odoo anmelden.
        </li>
        <li>
          <strong>Einstellungen → KI (Beta)</strong> öffnen,{" "}
          <strong>„Über den Odoo-Connector“</strong> wählen und{" "}
          <strong>„Claude diesen Schaltplan lesen und bearbeiten lassen“</strong> einschalten. Der Status wechselt auf{" "}
          <em>Verbunden</em>.
        </li>
        <li>
          In einem Chat mit dem FACE-Odoo-Connector nach dem Schaltplan fragen — zum Beispiel{" "}
          <em>„Welche Zeichnung habe ich offen?“</em>, <em>„Öffne ‚Beschallung EG‘ im Projekt
          Soccerbeat und schließe zwei Deckenlautsprecher an den Verstärker an“</em> oder{" "}
          <em>„Speichere die Zeichnung.“</em>
        </li>
      </ol>

      <p>
        Claude arbeitet immer nur im <strong>eigenen</strong> Tab, als der dort angemeldete
        Odoo-Nutzer, und nur, solange der Schalter an und der Tab offen ist. Wird der Schalter in
        einem zweiten Tab eingeschaltet, übernimmt dieser Tab. Claude öffnet, erstellt und speichert
        Zeichnungen an Odoo-Projekten, verwirft aber nie ungespeicherte Arbeit und überschreibt nie
        eine Version, die jemand anderes gespeichert hat, ohne dass du es ausdrücklich sagst —
        es fragt vorher nach. Ist nichts verbunden, sagt Claude, was einzuschalten ist.
      </p>

      <p>
        Der lokale Weg weiter unten (Claude Desktop mit dem MCP-Server auf dem eigenen Rechner)
        funktioniert weiterhin; dazu an derselben Stelle{" "}
        <strong>„Lokal (Claude Desktop)“</strong> wählen.
      </p>

      <h2>1. MCP-Server starten</h2>

      <p>
        Der Server liegt im Ordner <code>mcp-server</code> des Projekts. Einmal
        bauen, dann starten:
      </p>

      <pre>
        <code>{`cd mcp-server
npm install
npm run build

node dist/index.js`}</code>
      </pre>

      <p>
        Beim Start gibt er ein <strong>Kopplungs-Token</strong> und den Port aus,
        auf dem er lauscht (Standard: <code>8765</code>).
      </p>

      <h2>2. In EasySchematic einschalten</h2>

      <ol>
        <li>
          <strong>Einstellungen → KI (Beta)</strong> öffnen.
        </li>
        <li>Das <strong>Kopplungs-Token</strong> einfügen, das der Server ausgegeben hat.</li>
        <li>
          Prüfen, dass der <strong>Server-Port</strong> zum Server passt (Standard: 8765).
        </li>
        <li>
          <strong>„Claude diesen Schaltplan lesen und bearbeiten lassen“</strong> einschalten. Der
          Status sollte auf <em>Verbunden</em> wechseln.
        </li>
      </ol>

      <p>
        Es ist immer nur ein Tab verbunden — der Tab, in dem die Einstellung
        zuletzt eingeschaltet wurde, übernimmt, und jeder frühere Tab zeigt{" "}
        <em>Nicht verbunden</em>.
      </p>

      <h2>3. Server beim Assistenten registrieren</h2>

      <p>
        Die MCP-Konfiguration des Assistenten auf den Server zeigen lassen. Mit
        Claude Code zum Beispiel:
      </p>

      <pre>
        <code>{`claude mcp add easyschematic -- node /absolute/path/to/EasySchematic/mcp-server/dist/index.js`}</code>
      </pre>

      <p>
        Danach sind Anfragen möglich wie <em>„Suche ein 4K-Display, füge es hinzu
        und verbinde den HDMI-Ausgang des Laptops damit.“</em>
      </p>

      <h2>Was in der Beta möglich ist</h2>

      <p>Der Assistent hat einen Grundbestand an Werkzeugen:</p>

      <ul>
        <li>
          <strong>Lesen</strong> — den Schaltplan ansehen (seine Geräte,
          Verbindungen, Räume und Notizen), Geräte auflisten, ein einzelnes Gerät
          untersuchen und die Gerätebibliothek durchsuchen.
        </li>
        <li>
          <strong>Ein Gerät hinzufügen</strong>, ausgehend von einer Vorlage aus der Bibliothek.
        </li>
        <li>
          <strong>Geräteeigenschaften setzen</strong> — eine sichere Auswahl wie
          Beschriftung, Kurzname, Hersteller, Modellnummer, Notiz, Seriennummer,
          Stückpreis und Leistungswerte. Strukturfelder (Ports, Slots) sind noch
          nicht bearbeitbar und werden abgelehnt.
        </li>
        <li>
          <strong>Zwei Geräte verbinden</strong>. Bei zweiseitigen Ports gibt der
          Assistent eine Seite an — bidirektionale Ports verwenden <code>in</code>/<code>out</code>,
          Passthrough-Ports <code>rear</code>/<code>front</code>. Jede Verbindung
          wird geprüft, bevor sie angelegt wird.
        </li>
        <li>
          <strong>Ein Gerät verschieben</strong>, an eine neue Position. Das Gerät
          bleibt in seinem bisherigen Raum oder Rack — es wird dadurch weder
          hinein- noch herausbewegt.
        </li>
        <li>
          <strong>Einen Raum anlegen</strong> — einen beschrifteten Container, in
          dem Geräte liegen können. Die Größe ist optional (Standard: 400×300).
          Geräte, die bereits innerhalb des Umrisses des neuen Raums liegen,
          werden in ihn aufgenommen.
        </li>
        <li>
          <strong>Ein Gerät in einem Raum platzieren.</strong> Die Position wird
          relativ zur oberen linken Ecke des Raums angegeben. Liegt die Stelle
          außerhalb des Raums, wird die Anfrage abgelehnt und nichts ändert sich;
          ein Gerät wird also nie als platziert gemeldet, wenn es das nicht ist.
          Um ein Gerät zu versetzen, das bereits in einem Raum liegt, stattdessen
          das Verschieben eines Geräts verwenden.
        </li>
        <li>
          <strong>Notizen hinzufügen, bearbeiten und löschen</strong> —
          Textkarten, die auf der Zeichenfläche liegen und den Schaltplan
          kommentieren oder erklären. Der Text wird wörtlich angezeigt,
          Zeilenumbrüche bleiben erhalten. Vorhandene Notizen erscheinen, wenn der
          Assistent den Schaltplan liest; er kann also den Text einer Notiz neu
          schreiben oder sie entfernen. Das Bearbeiten ersetzt die ganze Notiz:
          Eine Notiz, die im Editor formatiert wurde (fett, Listen), wird zu
          reinem Text, wenn der Assistent sie neu schreibt.
        </li>
        <li>
          <strong>Eine einzelne Verbindung entfernen.</strong> Als Stub
          dargestellte Verbindungen lassen sich auf diesem Weg noch nicht
          entfernen — dazu eines ihrer Geräte löschen oder sie im Editor
          entfernen.
        </li>
        <li>
          <strong>Ein Gerät löschen.</strong>
        </li>
        <li>
          <strong>Ein modulares Chassis bestücken</strong> — bei einem Gerät mit
          Slots kann der Assistent dessen Slots sehen (über die Gerätedetails),
          die Erweiterungskarten auflisten, die in einen Slot passen, eine Karte
          in einen leeren Slot einbauen und eine Karte ausbauen, um einen Slot zu
          leeren. Eine Karte wird nur eingebaut, wenn ihre Slot-Familie zu der des
          Slots passt, und der Einbau ersetzt nie stillschweigend eine Karte, die
          schon in einem Slot steckt. (Neue Slots werden weiterhin im Editor
          definiert.)
        </li>
        <li>
          <strong>Eine Rack-Ansicht aufbauen</strong> — der Assistent kann die
          vorhandenen Rack-Ansichten sehen, ein Rack anlegen (er legt eine Seite
          für Rack-Ansichten an, falls es noch keine gibt), ein Gerät an einer
          bestimmten HE-Position in ein Rack einbauen (vorn oder hinten) und ein
          Gerät aus einem Rack ausbauen. Er stapelt keine zwei Geräte auf
          denselben Platz, platziert kein Gerät, das schon in einem anderen Rack
          sitzt, und nutzt nicht die Rückseite eines 2-Pfosten-Rahmens. Geräte in
          voller und halber Rackbreite werden anhand der Abmessungen des
          jeweiligen Geräts automatisch platziert; sehr kleine Geräte, die einen
          Fachboden brauchen, kommen auf einen Fachboden, den der Assistent dafür
          hinzufügt, und wird dieses Gerät später ausgebaut, verschwindet auch der
          Fachboden — es sei denn, du hast dir den Fachboden zu eigen gemacht
          (umbenannt, in der Größe geändert, verschoben oder ein weiteres Gerät
          daraufgestellt); dann lässt der Assistent ihn in Ruhe. Wird das Gerät
          auf anderem Weg entfernt (gelöscht oder im Editor aus dem Rack
          genommen), bleibt der leere Fachboden stehen, so wie es der Editor schon
          immer gehalten hat. Anderes Rack-Zubehör wie Blindplatten wird weiterhin
          im Editor hinzugefügt.
        </li>
        <li>
          <strong>In Stapeln arbeiten</strong> — viele Geräte hinzufügen, viele
          Verbindungen ziehen, viele Chassis-Karten einbauen oder viele Geräte in
          Racks einbauen, jeweils in einer einzigen Anfrage. Jeder Eintrag wird
          für sich behandelt: Schlägt einer fehl, gehen die übrigen trotzdem
          durch, und der Assistent erhält eine Liste zurück, die für jeden Eintrag
          zeigt, was gelungen ist und was nicht. Die Einträge werden der Reihe
          nach angewendet, ein früherer kann sich also auf einen späteren
          auswirken (zum Beispiel, indem er einen Slot oder eine Rack-Position
          belegt, die der nächste Eintrag haben wollte). Rückgängig funktioniert
          genauso, als wäre jede Aktion einzeln ausgeführt worden (ein Stapel
          braucht also mehrere Rückgängig-Schritte, um ihn vollständig
          zurückzunehmen, nicht nur einen).
        </li>
      </ul>

      <div
        className="border-l-4 border-amber-400 bg-amber-50 p-4 rounded-r my-4"
        role="note"
      >
        <strong>Sicherheit:</strong> Die Verbindung verlässt den eigenen Rechner
        nie, ist aus, bis du sie einschaltest, und verlangt das Kopplungs-Token.
        Wird EasySchematic unter einer Adresse betrieben, die nicht localhost
        ist, auf dem Server{" "}
        <code>EASYSCHEMATIC_MCP_ORIGINS</code> setzen, um diesen Origin zuzulassen.
      </div>
    </>
  );
}
