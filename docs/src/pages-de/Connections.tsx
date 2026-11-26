export default function ConnectionsPage() {
  return (
    <>
      <h1>Verbindungen</h1>

      <h2>Verbindungen zeichnen</h2>
      <p>Geräte lassen sich auf zwei Arten verbinden:</p>

      <h3>Klicken zum Verbinden</h3>
      <ol>
        <li>Einen Ausgangs-Port <strong>anklicken</strong> (rechte Seite eines Geräts)</li>
        <li>Eine Vorschaulinie folgt dem Mauszeiger</li>
        <li>Einen kompatiblen Eingangs-Port an einem anderen Gerät <strong>anklicken</strong></li>
        <li>Mit <strong>Escape</strong> abbrechen</li>
      </ol>

      <h3>Ziehen zum Verbinden</h3>
      <ol>
        <li>Von einem Ausgangs-Port aus <strong>klicken und ziehen</strong></li>
        <li>Auf einen kompatiblen Eingangs-Port ziehen</li>
        <li>Loslassen, um die Verbindung herzustellen</li>
      </ol>

      <h2>Verbindungsregeln</h2>
      <ul>
        <li>Verbindungen laufen von <strong>Ausgang → Eingang</strong> (von links nach rechts)</li>
        <li>Ports mit <strong>gleicher Signalart</strong> werden direkt verbunden. Unterschiedliche Signalarten lassen sich über einen <strong>Adapter</strong> verbinden (siehe unten)</li>
        <li>
          Jeder Port — Eingang <em>oder</em> Ausgang — nimmt standardmäßig <strong>eine</strong> Verbindung an. Soll ein
          einzelner Port mehrere Verbindungen tragen (eine Quelle speist viele Ziele oder umgekehrt), wird er als{" "}
          <strong>Multi-Connect</strong> markiert — siehe <em>Multi-Connect-Ports (1:n)</em> weiter unten
        </li>
        <li>
          <strong>Bidirektionale</strong> Ports werden jeweils nur auf einer Seite verbunden — eine Verbindung auf der einen Seite sperrt die andere
        </li>
        <li>
          <strong>Netzwerk-Signalarten</strong> (Ethernet, Dante, AVB, NDI, SRT, HDBaseT, AES67, ST 2110) lassen sich
          in <strong>jeder Richtung</strong> verbinden — Eingang zu Eingang, Ausgang zu Ausgang oder in beliebiger Kombination
        </li>
      </ul>

      <h2>Umstecken</h2>
      <p>Um eine bestehende Verbindung auf einen anderen Port zu <strong>verlegen</strong>:</p>
      <ol>
        <li>Mit dem Mauszeiger über den belegten Port fahren, bis er blau leuchtet</li>
        <li>Vom Port aus <strong>ziehen</strong> — die alte Verbindung löst sich</li>
        <li>Auf einem neuen kompatiblen Port ablegen</li>
      </ol>

      <h2>Trennen</h2>
      <p>Um eine Verbindung zu <strong>entfernen</strong>:</p>
      <ul>
        <li>Von einem belegten Port aus <strong>ziehen</strong> und über einer leeren Fläche loslassen</li>
        <li>Oder die Verbindung <strong>anklicken</strong>, um sie auszuwählen, und dann <strong>Delete</strong> drücken</li>
      </ul>

      <h2>Kabelweg formen</h2>
      <p>
        Verbindungen werden automatisch um Geräte herum geroutet, jeder Verlauf lässt sich aber
        mit <strong>Stützpunkten</strong> von Hand formen:
      </p>
      <ul>
        <li><strong>Rechtsklick</strong> auf eine Verbindung und <strong>Stützpunkt hinzufügen</strong> wählen — an der Klickstelle erscheint ein Stützpunkt</li>
        <li>Die Verbindung <strong>anklicken</strong>, um sie auszuwählen, dann einen Stützpunkt <strong>ziehen</strong>, um den Verlauf zu ändern (Stützpunkte rasten am Raster ein)</li>
        <li>Rechtsklick <strong>nahe an einem Stützpunkt</strong> und <strong>Stützpunkt entfernen</strong> wählen, um ihn zu löschen</li>
        <li>Rechtsklick und <strong>Route zurücksetzen</strong> wählen, um alle Stützpunkte zu verwerfen und zum automatischen Routing zurückzukehren</li>
      </ul>
      <p>
        Wird eine Verbindung ausgewählt, die noch keine Stützpunkte hat, erscheint an ihrer Mitte der kleine Hinweis{" "}
        <strong>„Rechtsklick auf das Kabel, um einen Stützpunkt hinzuzufügen“</strong>. Wie manuelle
        Stützpunkte und automatisches Routing im Einzelnen zusammenspielen, beschreibt die{" "}
        <a href="/connection-routing">Anleitung zum Verbindungs-Routing</a>.
      </p>

      <h2>Kabellänge</h2>
      <p>
        Jede Verbindung hat ein optionales Feld <strong>Kabellänge</strong>. Es wird im Bericht Kabelliste
        gesetzt — Längen werden je Verbindung gespeichert und erscheinen sowohl in der Kabelliste als auch in der Packliste.
        Die Packliste fasst Kabel in der Zusammenfassung nach Länge zusammen.
      </p>

      <h3>Geschätzte Kabellänge</h3>
      <p>
        Liegen beide Endpunkte einer Verbindung in <strong>platzierten Räumen</strong>, schätzt FACESchematic eine
        Kabellänge aus der Geometrie zwischen den beiden Räumen (Abstand von Raum zu Raum plus eine kleine Reserve). Die
        Schätzung steht in einer eigenen Spalte <strong>Gesch. Länge</strong> in der Kabelliste und in der
        Patchfeld-Belegung. So lässt sie sich mit der manuellen Spalte <strong>Kabellänge</strong> vergleichen oder als
        Ausgangspunkt für die endgültigen Längen verwenden. Geräte außerhalb jedes Raums erhalten keine Schätzung — für
        die Berechnung müssen beide Endpunkte im realen Raum verankert sein.
      </p>

      <h2>Linienstile</h2>
      <p>
        Jede Verbindung kann einen eigenen <strong>Linienstil</strong> haben — durchgezogen (Standard),
        gestrichelt, gepunktet oder Strich-Punkt. Je Verbindung wird er per Rechtsklick auf die Verbindung
        über das Untermenü <strong>Linienstil</strong> gesetzt, das jede Option vor der Auswahl als
        Muster zeigt. Alternativ lässt sich im Panel{" "}
        <strong>Signalfarben</strong> ein Standard-Linienstil je Signalart festlegen.
      </p>

      <h2>Multicable-Verbindungen</h2>
      <p>
        FACESchematic unterstützt <strong>Multicable-Zubehör</strong> — Kabel-Snakes, Socapex und ähnliche gebündelte
        Kabelsysteme. Dafür gibt es besondere Gerätevorlagen mit <strong>Trunk-Ports</strong>, die mehrere
        Signale über ein einziges physisches Kabel führen.
      </p>
      <ul>
        <li><strong>Break-in-Geräte</strong> führen einzelne Verbindungen zu einem Trunk zusammen</li>
        <li><strong>Break-out-Geräte</strong> teilen einen Trunk wieder in einzelne Verbindungen auf</li>
        <li>Trunk-Ports lassen sich nur mit anderen Trunk-Ports verbinden — ein Trunk kann nicht an einem normalen Geräte-Port enden</li>
        <li>Per Rechtsklick auf eine Trunk-Verbindung lässt sich eine <strong>Kabelbeschriftung</strong> setzen</li>
      </ul>

      <h2>Verbindungen bündeln</h2>
      <p>
        Mit dem <strong>Bündeln</strong> lassen sich mehrere Verbindungen über einen gemeinsamen <strong>Trunk</strong> führen — so,
        wie in der Praxis ein Multicore, eine Snake oder ein zusammengetaptes Kabelbündel über einen einzigen Weg verlegt wird. Anders als
        ein <strong>Multicable-Zubehör</strong> (ein physisches Gerät mit Trunk-Ports) ist ein Bündel eine Routing-Entscheidung
        über bereits bestehende Verbindungen: Es ändert, wie sie gezeichnet werden, nicht was sie sind. Jede
        gebündelte Verbindung bleibt ein eigenes Kabel.
      </p>
      <ul>
        <li>
          <strong>2 oder mehr Verbindungen</strong> auswählen, dann im Panel <strong>Verbindungen bearbeiten</strong> auf{" "}
          <strong>Auf einen Trunk bündeln</strong> klicken. Die Verbindungen laufen an einem Ende zusammen, verlaufen gemeinsam über einen einzigen
          Trunk und fächern am anderen Ende wieder auf.
        </li>
        <li>
          Auch Verbindungen mit <strong>gemischten Signalarten</strong> lassen sich bündeln. Der Trunk wird in einem
          neutralen Grau gezeichnet und trägt ein <strong>N×</strong>-Badge mit der Anzahl der geführten Verbindungen, während jede
          Verbindung an den Sammel- und Fächerenden ihre eigene Signalfarbe behält.
        </li>
        <li>
          Im selben Panel lässt sich dem Bündel eine <strong>Beschriftung</strong> geben (z. B. „Stage Snake A“) — sie erscheint in der
          optionalen Spalte <strong>Bündel</strong> der Kabelliste.
        </li>
        <li>
          <strong>Ein Klick auf den Trunk</strong> wählt alle seine Verbindungen auf einmal aus.
        </li>
        <li>
          Ein <strong>Rechtsklick</strong> auf eine gebündelte Verbindung bietet <strong>Bündel-Mitglieder auswählen</strong>,
          <strong> Aus Bündel entfernen</strong> und <strong>Bündel auflösen</strong>.
        </li>
      </ul>
      <p>
        Bündeln ändert nie die <strong>Kabelanzahl</strong>: Jede Verbindung in einem Bündel bleibt eine eigene Zeile in
        der Kabelliste und ein eigenes Kabel in der Packliste. Wird eine gebündelte Verbindung in einen{" "}
        <strong>Stub</strong> umgewandelt, verlässt sie das Bündel, und ein Bündel löst sich automatisch wieder in normale
        Verbindungen auf, sobald weniger als zwei Mitglieder übrig sind. Die Kabelliste kann außerdem <strong>nach Bündel gruppieren</strong>,
        wenn alle Kabel eines Bündels zusammen aufgeführt werden sollen.
      </p>
      <p>
        Bündeln ist das bewusste Gegenteil der üblichen Aufgabe des Auto-Routers: Statt Verbindungen unterscheidbar zu halten,
        wird FACESchematic damit mitgeteilt, dass genau diese Kabel einen gemeinsamen physischen Weg nehmen <em>sollen</em>.
      </p>

      <h2>Multi-Connect-Ports (1:n)</h2>
      <p>
        Standardmäßig nimmt jeder Port <strong>eine Verbindung</strong> an. Manche Signale funktionieren in der Praxis anders —
        ein Dante-Flow kann viele Ziele speisen, ein SRT-Decoder kann auf einem einzigen UDP-Port auf viele Sender-Streams
        lauschen, ein Funkmikrofon-Empfänger wird mit mehreren Sendern gekoppelt, und ein Streaming-Encoder kann einen
        Feed an viele Ziele ausspielen. Für solche Fälle lässt sich ein Port als <strong>Multi-Connect</strong> markieren, sodass N
        Verbindungen zu oder von einem einzelnen Port möglich sind — 1:n-Verteilung von einer Quelle oder n:1-Zusammenführung an einem Ziel.
      </p>
      <ul>
        <li>
          Multi-Connect wird je Port im <strong>Geräte-Editor</strong> umgeschaltet (Doppelklick auf das Gerät) — dazu das Badge
          <strong> M</strong> in der Badge-Zeile unter dem Port anklicken (neben dem Multicable-Schalter <strong>T</strong>).{" "}
          Es leuchtet bernsteinfarben, wenn der Port Multi-Connect ist
        </li>
        <li>
          Neue Ports sind standardmäßig Multi-Connect, wenn ihre Signalart <strong>SRT</strong> oder <strong>Custom</strong> ist
          oder wenn ihr Steckertyp <strong>Wireless</strong> ist
        </li>
        <li>
          Multi-Connect-Ports zeigen beim Überfahren einen <strong>bernsteinfarbenen Ring</strong> und einen Fadenkreuz-Cursor. Daran ist
          zu erkennen, dass sich von einem bereits belegten Port weitere Verbindungen ziehen lassen
        </li>
        <li>
          Jede Verbindung erscheint weiterhin als eigene Linie auf der Zeichenfläche und als eigene Zeile in der Kabelliste —
          Multi-Connect lockert nur die Regel zur Anzahl der Verbindungen
        </li>
      </ul>

      <h3>Beispiel: eine Dante-Quelle, viele Ziele</h3>
      <p>Um einen Dante-Flow darzustellen, der von einem Pult-Ausgang aus mehrere Empfänger speist:</p>
      <ol>
        <li><strong>Doppelklick</strong> auf das Quellgerät öffnet den Geräte-Editor</li>
        <li>Das Badge <strong>M</strong> unter dem Dante-Port anklicken, sodass es bernsteinfarben leuchtet</li>
        <li>
          Von diesem Port aus eine Verbindung zu jedem Ziel zeichnen — jedes Ziel erhält eine eigene Linie auf der
          Zeichenfläche und eine eigene Zeile in der Kabelliste
        </li>
      </ol>
      <p>
        Soll auch ein Ziel mehrere Flows an einem Port annehmen, wird dieser Port ebenfalls als Multi-Connect markiert.
      </p>

      <h2>Adapter</h2>
      <p>
        Werden Ports mit unverträglichen Signalarten oder unterschiedlichen Steckertypen verbunden, kann FACESchematic
        automatisch ein <strong>Adapter</strong>-Gerät dazwischen einfügen. Eine eigene Aktion
        „Adapter hinzufügen“ gibt es nicht — es genügt, die Verbindung zwischen den beiden nicht passenden Ports zu zeichnen. Enthält
        die Gerätebibliothek einen passenden Adapter, wird er eingefügt (oder in einem Dialog angeboten, wenn
        mehrere passen). Wird zum Beispiel der
        <strong> USB-A</strong>-Port eines Laptops mit einem <strong>RJ45</strong>-Port an einem Netzwerk-Switch verbunden,
        wird automatisch ein <strong>USB-A (M) → RJ45 (F) Adapter</strong> eingefügt und mit beiden Geräten verbunden.
      </p>

      <h3>Farben der Verbindungsvorschau</h3>
      <p>Beim Ziehen einer Verbindung zeigt die Farbe der Vorschaulinie, was geschehen wird:</p>
      <ul>
        <li><strong style={{ color: "#22c55e" }}>Grün</strong> — kompatibel, die Verbindung wird direkt hergestellt</li>
        <li><strong style={{ color: "#eab308" }}>Gelb</strong> — nicht kompatibel, aber ein Adapter ist verfügbar und wird eingefügt</li>
        <li><strong style={{ color: "#ef4444" }}>Rot</strong> — nicht kompatibel, kein Adapter verfügbar</li>
      </ul>

      <h3>Automatisches Einfügen</h3>
      <p>Beim Abschließen einer nicht kompatiblen Verbindung gilt:</p>
      <ul>
        <li>Passt genau <strong>eine</strong> Adapter-Vorlage, wird sie automatisch zwischen den beiden Geräten eingefügt</li>
        <li>
          Passen <strong>mehrere</strong> Adapter, lässt sich in einem Dialog wählen, welcher eingefügt wird —
          <strong> Trotzdem verbinden</strong> steht dort ebenfalls zur Verfügung, um den Adapter zu überspringen
        </li>
        <li>
          Passt <strong>kein</strong> Adapter, meldet der Dialog, dass keine passenden Adapter gefunden wurden —
          dann lässt sich <strong>Abbrechen</strong> wählen oder mit <strong>Trotzdem verbinden</strong> die
          Verbindung ohne Adapter erzwingen
        </li>
      </ul>
      <p>
        Die Suche funktioniert in <strong>beiden Ziehrichtungen</strong> — ein USB-A → RJ45-Dongle wird gefunden, gleich ob
        die Verbindung am USB-A-Port oder am RJ45-Port begonnen wird.
      </p>
      <p>
        Das automatische Einfügen greift auf die <strong>in der App mitgelieferten</strong> Adapter zurück sowie auf alle{" "}
        <strong>eigenen Adapter-Geräte</strong>, die selbst angelegt wurden. Adapter aus der Online-Community-Bibliothek
        werden erst automatisch eingefügt, wenn sie mit einem App-Update mitgeliefert werden — sie lassen sich aber
        jederzeit von Hand aus der <strong>Gerätebibliothek</strong> platzieren und wie jedes andere Gerät
        verbinden.
      </p>

      <h3>Adapter und Konverter</h3>
      <ul>
        <li>
          <strong>Adapter</strong> sind passive Geräte (Dongles, Kabeladapter, Kupplungen) — sie erscheinen
          im Abschnitt <strong>Kabel</strong> der Packliste
        </li>
        <li>
          <strong>Konverter</strong> sind aktive Geräte (z. B. Decimator, BMD Mini Converter) — sie erscheinen
          im Abschnitt <strong>Geräte</strong> und müssen von Hand aus der Gerätebibliothek platziert werden
        </li>
      </ul>

      <h3>Kennzeichnung der Ausführung (M/F)</h3>
      <p>
        Adapter-Vorlagen tragen eine Kennzeichnung der Ausführung — z. B. „USB-C (M) → HDMI (F) Adapter“.
        <strong> M</strong> = Stecker (male), <strong>F</strong> = Buchse (female). Diese Unterscheidung ist für
        Packlisten wichtig, damit klar ist, welcher Adapter genau einzupacken ist.
      </p>

      <h3>Direktanschluss</h3>
      <p>
        Manche Adapter-Ports sind <strong>Direktanschlüsse</strong> — sie werden direkt in ein Gerät gesteckt, ohne dass
        ein eigenes Kabel nötig ist. Das USB-C-Ende eines USB-C-Dongles steckt zum Beispiel direkt im Laptop.
      </p>
      <ul>
        <li>Direktanschluss-Verbindungen werden als <strong>dünne graue Linien</strong> statt als farbige Kabellinien gezeichnet</li>
        <li>Sie erscheinen nicht in der Kabelliste und erhalten keine Kabel-ID</li>
        <li>Sie zählen in der Packliste nicht zur Kabelanzahl</li>
        <li>
          Der Direktanschluss wird je Port im <strong>Geräte-Editor</strong> umgeschaltet — über das Badge
          <strong> DA</strong> unter jeder Port-Zeile (nur bei Adapter-Geräten sichtbar)
        </li>
      </ul>

      <h3>Kupplungen</h3>
      <p>
        Kupplungen (F↔F, englisch „Barrel“) verbinden zwei Kabel Ende an Ende — eine HDMI-Kupplung verbindet zum Beispiel zwei
        HDMI-Kabel. Sie haben keine Direktanschluss-Ports, weil beide Seiten ein Kabel brauchen. Zu finden sind sie über die Suche nach „barrel“ in der
        Gerätebibliothek.
      </p>

      <h3>Adapter ausblenden</h3>
      <p>Für übersichtlichere Schaltpläne lassen sich Adapter-Geräte auf der Zeichenfläche ausblenden:</p>
      <ul>
        <li>
          <strong>Alle Adapter ausblenden</strong> — das Panel <strong>Ansichtsoptionen</strong> öffnen (rechte Seitenleiste)
          → Abschnitt <strong>Adapter</strong> → <strong>Alle Adapter ausblenden</strong> aktivieren
        </li>
        <li>
          <strong>Einen Adapter ausblenden</strong> — Rechtsklick auf eine beliebige Verbindung zu einem Adapter und{" "}
          <strong>Adapter ausblenden</strong> wählen
        </li>
        <li>
          <strong>Einen ausgeblendeten Adapter zeigen</strong> — Rechtsklick auf die zusammengeführte Verbindungslinie an der Stelle des
          Adapters und <strong>Adapter zeigen</strong> wählen
        </li>
        <li>Ausgeblendete Adapter fallen zu einer einzigen Verbindungslinie zwischen den eigentlichen Geräten zusammen</li>
        <li>Überbrückt ein ausgeblendeter Adapter unterschiedliche Signalarten, wird die Linie als <strong>Farbverlauf</strong> gezeichnet</li>
      </ul>
      <p>
        Für feinere Steuerung: Doppelklick auf einen Adapter → <strong>Erweitert</strong> →
        Dropdown <strong>Sichtbarkeit</strong>:
      </p>
      <ul>
        <li><strong>Standard</strong> — folgt dem globalen Schalter „Alle Adapter ausblenden“</li>
        <li><strong>Immer zeigen</strong> — bleibt sichtbar, auch wenn „Alle Adapter ausblenden“ eingeschaltet ist</li>
        <li><strong>Immer ausblenden</strong> — ausgeblendet, auch wenn „Alle Adapter ausblenden“ ausgeschaltet ist</li>
      </ul>
      <p>
        Ausgeblendete Adapter <strong>erscheinen weiterhin in der Packliste</strong> — die Packliste ist immer die
        vollständige Stückliste, unabhängig davon, was auf der Zeichenfläche sichtbar ist.
      </p>

      <h2>Signalfarben</h2>
      <p>
        Verbindungen übernehmen die <strong>Farbe der Signalart</strong> vom Quell-Port. So lässt sich der Signalfluss
        auch in einem komplexen Schaltplan leicht mit dem Auge verfolgen — alle SDI-Wege sind blau, alle HDMI-Wege rot usw.
      </p>

      <h3>Farben anpassen</h3>
      <p>
        Das Panel <strong>Signalfarben</strong> in der rechten Seitenleiste öffnen, um die Verbindungsfarben anzupassen:
      </p>
      <ul>
        <li>Jede Signalart hat einen eigenen <strong>Farbwähler</strong> — anklicken, um eine neue Farbe zu wählen</li>
        <li>Änderungen gelten sofort für alle Verbindungen dieser Signalart auf der Zeichenfläche</li>
        <li>Mit <strong>Auf Standard zurücksetzen</strong> wird das ursprüngliche Farbschema wiederhergestellt</li>
        <li>Eigene Farben werden mit dem Schaltplan gespeichert und bleiben über Sitzungen hinweg erhalten</li>
      </ul>

      <h2>Kabel-IDs &amp; Beschriftungen</h2>
      <p>
        Jede Verbindung kann eine <strong>Kabel-ID</strong> als Beschriftung auf der Zeichenfläche tragen. FACESchematic bietet zwei
        Benennungsschemata:
      </p>
      <ul>
        <li>
          <strong>Type-prefix</strong> (Standard) — IDs auf Basis der Signalart, z. B. „SDI-1“, „HDMI-2“
        </li>
        <li>
          <strong>Sequential</strong> — einfach durchnummerierte IDs wie „Cable 1“, „Cable 2“
        </li>
      </ul>
      <p>
        Kabel-IDs sind <strong>dauerhaft</strong>: Die ID jeder Verbindung wird einmal vergeben, in der Schaltplandatei
        gespeichert und nie neu nummeriert — gedruckte Etiketten und Verlegelisten bleiben also gültig, während sich die Zeichnung weiterentwickelt. Ein Wechsel
        des Benennungsschemas betrifft nur Verbindungen, die noch keine ID haben; neue Verbindungen zählen
        ab der höchsten gespeicherten ID weiter. Eine duplizierte oder eingefügte Verbindung erhält eine neue ID (sie ist ein neues physisches Kabel).
      </p>
      <p>
        Über das Menü <strong>Ansicht</strong> lassen sich die Kabelbeschriftungen auf der gesamten Zeichenfläche ein- oder ausschalten. Die
        Beschriftung einer einzelnen Verbindung lässt sich außerdem per Rechtsklick und <strong>Kabel-ID ausblenden</strong> verbergen.
      </p>

      <h2>Leitungssprünge</h2>
      <p>
        Wo sich Verbindungen kreuzen, kann FACESchematic an jedem Kreuzungspunkt kleine <strong>Bogenmarkierungen</strong>
        zeichnen. Einzelne Wege lassen sich damit in einem dichten Schaltplan deutlich leichter verfolgen. Die
        Leitungssprünge werden im Menü <strong>Ansicht</strong> ein- oder ausgeschaltet.
      </p>

      <h2>Verbindungen gesammelt bearbeiten</h2>
      <p>
        Mehrere Verbindungen lassen sich auswählen und in ihren Eigenschaften auf einmal bearbeiten. Die Auswahl wird mit dem Auswahlrahmen oder per Shift+Klick
        aufgebaut — die Kreuzungsauswahl (Ziehen von rechts nach links) erfasst jede Verbindung, deren Weg den Rahmen kreuzt,
        nicht nur solche, deren beide Endpunkte darin liegen.
      </p>
      <p>
        Sobald 2 oder mehr Elemente ausgewählt sind, erscheint unten in der Mitte der
        Zeichenfläche eine <strong>Auswahlleiste</strong> mit einem Chip für jede Art von Element in der Auswahl. Ein Klick auf einen Chip stellt diese
        Art <strong>frei</strong> (nur diese Elemente bleiben ausgewählt). Ctrl/⌘+Klick <strong>hebt</strong> stattdessen die Auswahl dieser Art <strong>auf</strong>.
      </p>
      <p>
        Sind Verbindungen unter den ausgewählten Elementen, erscheint in der Auswahlleiste die Schaltfläche{" "}
        <strong>N Verbindungen bearbeiten…</strong>. Ein Klick darauf öffnet das Panel zur Sammelbearbeitung, mit dem sich Änderungen auf alle ausgewählten Verbindungen
        in einem einzigen Rückgängig-Schritt anwenden lassen:
      </p>
      <ul>
        <li><strong>Beschriftung</strong> — alle Beschriftungen mit neuem Text überschreiben oder Text an jede vorhandene Beschriftung anhängen. Die Schaltfläche zum Leeren entfernt die Beschriftungen aller ausgewählten Verbindungen.</li>
        <li><strong>Linienstil</strong> — durchgezogen, gestrichelt, gepunktet oder Strich-Punkt für die gesamte Auswahl setzen. Eine hervorgehobene Schaltfläche zeigt den aktuellen Stil, wenn alle Verbindungen übereinstimmen; weichen sie voneinander ab, steht dort „(gemischt)“.</li>
        <li><strong>Direktanschluss</strong> — schaltet das Direktanschluss-Kennzeichen um (dünne graue Linie, nicht in der Kabelliste).</li>
        <li><strong>Kabel-ID ausblenden</strong> — blendet die automatisch erzeugte Kabel-ID aus oder ein.</li>
        <li><strong>Hide Custom Label</strong> — blendet die eigene Beschriftung unabhängig von der Kabel-ID aus oder ein.</li>
      </ul>
      <p>
        Das Panel bleibt geöffnet, auch wenn versehentlich auf die Zeichenfläche geklickt und die gesamte Auswahl aufgehoben wird — sobald wieder
        Verbindungen ausgewählt sind, werden die Bedienelemente erneut aktiv.
      </p>

      <h2>Verbindungen als Stub</h2>
      <p>
        Verbindungen lassen sich statt als vollständig geroutete Linien als kurze <strong>Stubs</strong> an jedem Port darstellen. Das
        verringert die Unruhe in vollen Schaltplänen, in denen der Verlauf selbst nicht wichtig ist. Per Rechtsklick
        auf eine Verbindung und <strong>Als Stub darstellen</strong> wird zwischen Stub und voll gerouteter Darstellung umgeschaltet.
      </p>
      <p>
        Jedes Stub-Ende trägt eine <strong>Beschriftung</strong>, die zeigt, wohin die Verbindung führt — den Namen des
        Zielgeräts, dessen Port am anderen Ende (standardmäßig an beiden Enden gezeigt), den Raum (falls vorhanden) und die Seitenzahl (in der
        Druckansicht). Die Beschriftungen sind <strong>verschiebbar</strong> — durch Greifen und Ziehen wird der Stub-Endpunkt neu positioniert.
      </p>
      <p>
        Auch ganze Auswahlen lassen sich auf einmal als Stub darstellen. Dazu mehrere Verbindungen auswählen und dann entweder per Rechtsklick auf eine davon{" "}
        <strong>N ausgewählte Verbindungen als Stub darstellen</strong> wählen oder den Abschnitt <strong>Stubs</strong> im Panel zur Sammelbearbeitung verwenden
        (Schaltfläche <strong>N Verbindungen als Stub darstellen</strong>). Verbindungen, die bereits Stubs sind, bleiben unberührt, und{" "}
        <strong>N ausgewählte Verbindungen voll zeigen</strong> — im Panel zur Sammelbearbeitung <strong>N Verbindungen voll zeigen</strong> —
        macht es für die als Stub dargestellten wieder rückgängig. In beiden Fällen ist der gesamte Stapel ein einziger Rückgängig-Schritt.
      </p>
      <ul>
        <li>Stub-Linien folgen wie normale Verbindungen dem <strong>orthogonalen Routing</strong> mit abgerundeten Ecken</li>
        <li>Per Rechtsklick auf einen Stub und <strong>Stützpunkt hinzufügen</strong> lassen sich wie bei normalen Verbindungen Zwischenpunkte setzen</li>
        <li>Als Stub dargestellte Verbindungen sind von der Erkennung der <strong>Leitungssprünge</strong> ausgenommen — sie erzeugen keine Bogenmarkierungen auf anderen Verbindungen</li>
        <li>Als Stub dargestellte Verbindungen erzeugen keine <strong>Übergangsbeschriftungen an Seitenumbrüchen</strong></li>
      </ul>

      <h3>Stub-Beschriftungen anpassen</h3>
      <p>
        Diese Optionen unter <strong>Einstellungen → Darstellung → Stub-Beschriftungen</strong> steuern, was im gesamten
        Schaltplan auf den Stub-Beschriftungen steht:
      </p>
      <ul>
        <li>
          <strong>Richtungspfeil auf Stub-Beschriftungen</strong> — stellt der Beschriftung einen Pfeil voran, der zur
          Gegenseite zeigt, z. B. <code>→ Projector</code>. Standardmäßig aus: Der Zielname sagt bereits, wohin die
          Verbindung führt, und der Pfeil kostet Breite in einem ohnehin knappen Feld.
        </li>
        <li>
          <strong>Portname auf Stub-Beschriftungen</strong> — ergänzt den Ziel-Port in eckigen Klammern hinter dem Gerät,
          z. B. <code>Projector [HDMI In 1] (Main Hall) Pg 3</code>. Nützlich, wenn ein Gerät viele Ports derselben
          Signalart hat.
        </li>
        <li>
          <strong>Raumname auf Stub-Beschriftungen</strong> — ergänzt den Zielraum in runden Klammern, z. B.{" "}
          <code>Projector (Main Hall)</code>. Der Raum erscheint nur, wenn das Gegengerät in einem{" "}
          <em>anderen</em> Raum steht als das Gerät am eigenen Ende des Stubs. Ein Stub zwischen zwei Geräten im selben
          Raum lässt den Raum weg, weil er dem Leser nichts sagt.
        </li>
        <li>
          <strong>Seitenzahl auf Stub-Beschriftungen</strong> — zur Wahl stehen <em>Nur seitenübergreifend</em> (Standard), <em>Immer</em>{" "}
          oder <em>Nie</em>. „Nur seitenübergreifend“ unterdrückt die Angabe <code>Pg N</code>, wenn beide Enden eines Stubs
          auf derselben Druckseite liegen — dort ist sie meist nur Ballast.
        </li>
      </ul>
      <p>
        All das lässt sich auch für einen einzelnen Stub überschreiben. Dazu die <strong>Stub-Beschriftung</strong> selbst mit der rechten Maustaste anklicken
        und <strong>Pfeil zeigen</strong>, <strong>Port zeigen</strong>, <strong>Raum zeigen</strong> oder{" "}
        <strong>Seitenmodus</strong> verwenden — jeder Eintrag wechselt zwischen <em>Standard</em> (globale Einstellung verwenden) und ausdrücklichen
        Werten, sodass ein einzelner Stub unabhängig davon ein- oder ausgeschlossen werden kann. Steht <strong>Raum zeigen</strong> bei einem
        einzelnen Stub auf <em>Ein</em>, wird der Raum auch dann gezeigt, wenn beide Geräte im selben Raum stehen.
      </p>

      <h3>Beschriftungen nur mit Kabel-ID</h3>
      <p>
        Manchmal soll ein Stub rein als <strong>Kabelkennzeichen</strong> dienen — die Kabel-ID am Port und keinerlei
        Angabe zum Ziel. Dazu die Stub-Beschriftung mit der rechten Maustaste anklicken und <strong>Beschriftung</strong> auf{" "}
        <em>Nur Kabel-ID</em> stellen: Das Feld zeigt dann allein die Kabel-ID, z. B. <code>HDMI-001</code>. Die Optionen für Pfeil, Port,
        Raum und Seite gelten dann nicht mehr und verschwinden aus dem Menü; wird <strong>Beschriftung</strong> wieder auf{" "}
        <em>Ziel</em> gestellt, sind sie zurück.
      </p>
      <p>
        Beide Stub-Beschriftungen einer Verbindung gehören zum selben Kabel. Wird <strong>Beschriftung</strong> an einem Ende umgestellt,
        stellt sich deshalb das andere Ende mit um, und ein einziges Rückgängig setzt beide zurück. Das gilt gleichermaßen für die Zeichenfläche, den PDF-Export und
        den DXF-Export. Eine Verbindung ohne Kabel-ID — etwa ein Direktanschluss — zeigt stattdessen einen Strich.
      </p>
      <p>
        Womit neu als Stub dargestellte Verbindungen beginnen, legt <strong>Einstellungen → Darstellung → Stub-Beschriftungen →
        Beschriftung neuer Stubs</strong> fest. Der Standard ist <em>Ziel</em> und gilt für jedes Projekt auf diesem
        Rechner. <strong>Nur dieses Projekt</strong> direkt darunter überschreibt das für den geöffneten Schaltplan und wird
        in der Schaltplandatei gespeichert. Keine der beiden Einstellungen ändert Stub-Beschriftungen, die bereits auf der Zeichenfläche liegen.
      </p>

      <h3>Neue Verbindungen als Stub zeichnen</h3>
      <p>
        Wer überwiegend mit Stubs zeichnet, stellt <strong>Einstellungen → Zeichenfläche → Neue Verbindungen →
        Neue Verbindungen zeichnen als</strong> auf <em>Stub</em>. Von da an gezeichnete Verbindungen entstehen bereits an beiden Enden
        als Stub — genau so, als würde eine Verbindung gezeichnet und dann im Rechtsklick-Menü <strong>Als Stub darstellen</strong>
        gewählt —, und ein einziges Rückgängig entfernt weiterhin die ganze Verbindung. Bereits bestehende Verbindungen bleiben
        beim Ändern der Einstellung unberührt. Die einzige Ausnahme ist eine Verbindung, die einen Adapter braucht: Fügt
        FACESchematic einen ein, bleiben die beiden Hälften links und rechts des Adapters Leitungen, denn als Stubs
        würden sie vier Stub-Beschriftungen um ein Gerät verstreuen, das gar nicht selbst platziert wurde. Wird eine solche Verbindung mit{" "}
        <strong>Trotzdem verbinden</strong> erzwungen, wird sie wie jede andere als Stub dargestellt.
      </p>

      <h2>Stecker-Kompatibilität</h2>
      <p>
        Ports haben zusätzlich zu ihrer Signalart einen <strong>Steckertyp</strong> (XLR-3, RJ45, HDMI usw.).
        FACESchematic berücksichtigt die Stecker-Kompatibilität automatisch:
      </p>
      <ul>
        <li>
          <strong>Passt von Haus aus</strong> — manche Anschlüsse nehmen physisch auch andere Steckertypen ohne Adapter auf.
          EtherCon nimmt RJ45 auf, opticalCON nimmt LC auf, und XLR/TRS-Combo-Buchsen nehmen sowohl XLR-3 als auch 1/4" TRS auf.
        </li>
        <li>
          <strong>Adapter erforderlich</strong> — haben zwei Ports dieselbe Signalart, aber unterschiedliche Stecker
          (z. B. IEC auf Edison, USB-C auf USB-A), fordert FACESchematic dazu auf, ein Adapter-Gerät einzufügen,
          oder fügt es automatisch ein, wenn genau eines passt.
        </li>
        <li>
          <strong>Anschlüsse für blanke Adern</strong> — Phoenix- und Klemmleisten-Anschlüsse sind mit jedem anderen
          Steckertyp kompatibel, weil es keinen physischen Stecker gibt — das Kabel geht direkt in die Klemme.
        </li>
      </ul>

      <h2>Nicht kompatible Ports zwangsweise verbinden</h2>
      <p>
        Gibt es für eine Abweichung bei Stecker oder Signal keine Adapter-Vorlage, lässt sich die Verbindung trotzdem erzwingen.
        Der Dialog bietet die Schaltfläche <strong>Trotzdem verbinden</strong>, oder es wird per Rechtsklick auf eine bestehende
        Verbindung <strong>Inkompatibel erlauben</strong> gewählt. Das sollte sparsam eingesetzt werden — erzwungene
        Verbindungen bilden den Kabelbedarf in der Packliste nicht korrekt ab.
      </p>
    </>
  );
}
