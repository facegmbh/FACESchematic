export default function RacksPage() {
  return (
    <>
      <h1>Rack-Editor</h1>

      <p>
        Rack-Seiten bieten eine eigene Zeichenfläche, um Rackansichten neben dem Signalfluss zu
        planen. Geräte gibt es nur an einer Stelle — sie werden im Schaltplan abgelegt und in ein Rack eingebaut,
        und Änderungen auf einer der beiden Seiten bleiben synchron. Verbindungen, Port-Zuordnungen und Gerätedaten
        werden per Verweis geteilt; nichts wird dupliziert.
      </p>

      <h2>Seiten und Reiter</h2>
      <p>
        Eine Schaltplandatei kann mehrere Seiten enthalten. Die Reiterleiste am unteren Rand der Zeichenfläche zeigt den
        Hauptschaltplan sowie alle hinzugefügten Rack-Seiten und Druckbögen. Ein Klick auf einen Reiter wechselt
        die Ansicht, Ziehen ordnet die Reiter um, und ein Rechtsklick bietet Umbenennen / Duplizieren / Löschen.
      </p>
      <ul>
        <li><strong>Schaltplan</strong> — die Signalfluss-Seite (immer vorhanden, immer an erster Stelle)</li>
        <li><strong>Rack-Seite</strong> — enthält eine oder mehrere Rackansichten nebeneinander</li>
        <li><strong>Druckbogen</strong> — Layoutseite in Papiergröße, auf der Rackansichten zu einer druckbaren Zeichnung zusammengestellt werden (siehe <a href="/print-sheets">Druckbögen</a>)</li>
      </ul>
      <p>
        Eine Rack-Seite wird mit der Schaltfläche <strong>+</strong> am rechten Ende der Reiterleiste hinzugefügt, ein
        Druckbogen mit der Schaltfläche <strong>📄+</strong> daneben.
      </p>

      <h2>Ein Rack anlegen</h2>
      <p>
        Auf einer Rack-Seite öffnet <strong>Rack hinzufügen</strong> in der Seitenleiste den Rack-Assistenten.
        Dort ein Preset wählen oder ein eigenes Rack zusammenstellen:
      </p>
      <ul>
        <li><strong>42U Standrack</strong> — Standard-AV-Rack in voller Höhe</li>
        <li><strong>25U / 16U Standrack</strong> — Standrack in halber Höhe und niedriges Standrack</li>
        <li><strong>12U / 6U Wandmontage</strong> — Wandgehäuse</li>
        <li><strong>4U / 8U Desktop</strong> — Tischrack oder tragbar</li>
        <li><strong>45U / 12U offen, 2 Holme</strong> — Relayracks (offener Rahmen, keine hinteren Holme)</li>
        <li><strong>42U offen, 4 Holme</strong> — offenes Rack mit vier Holmen</li>
      </ul>
      <p>
        Im benutzerdefinierten Modus lassen sich Racktyp, Höhe in HE und Tiefe in mm direkt festlegen. Auf einer
        Seite können mehrere Racks stehen — nützlich, um einen Technikraum zu planen.
      </p>
      <p>
        Ein Doppelklick auf die Beschriftung eines Racks benennt es um, entweder am Rack selbst oder in der Seitenleiste.
      </p>

      <h2>Geräte einbauen</h2>
      <p>
        Die Seitenleiste der Rack-Seite zeigt alle Geräte des Schaltplans, die noch in keinem Rack
        eingebaut sind. Ein Gerät aus der Seitenleiste auf ein Rack ziehen, um es einzubauen. Die Ablagevorschau zeigt genau,
        wo das Gerät landet — grün für gültig, rot für blockiert.
      </p>
      <p>
        EasySchematic entscheidet anhand der physischen Abmessungen jedes Geräts (<strong>widthMm</strong>,{" "}
        <strong>heightMm</strong>, <strong>depthMm</strong>, gesetzt im Geräte-Editor oder in der
        Community-Vorlage), wie es passt:
      </p>
      <ul>
        <li>
          <strong>Geräte in voller Rackbreite</strong> (Frontplatte ≈482 mm, Höhe in ganzen HE) rasten direkt in die
          Rackplätze ein und belegen die Front von Holm zu Holm.
        </li>
        <li>
          <strong>Halb-Rack-Geräte</strong> (Frontplatte ≈220 mm) rasten standardmäßig auf der linken Seite ein; ein
          zweites Halb-Rack-Gerät in derselben Reihe landet rechts. Kollisionen zwischen Halb-Rack-Geräten werden
          automatisch erkannt.
        </li>
        <li>
          <strong>Geräte nur für den Fachboden</strong> (kleine DI-Boxen, DSPs in halber Breite, Tischgeräte, die
          sich nicht ins Rack schrauben lassen) legen automatisch einen 1-HE-Fachboden an und stehen in ihrer natürlichen Breite darauf.
          Die Ablagevorschau zeigt einen schmalen Fachbodenbalken, damit sichtbar ist, was gleich passiert.
        </li>
        <li>
          <strong>Übergroße Geräte</strong> (alles, was breiter ist als eine 19&quot;-Frontplatte — Lautsprecher, große
          Pulte) werden mit einer Meldung abgelehnt. Sie passen nicht.
        </li>
        <li>
          <strong>Unbekannt</strong> (keine Abmessungen in der Vorlage) fällt auf den normalen Einbau in
          voller Breite zurück, so wie Racks vor dieser Funktion gearbeitet haben.
        </li>
      </ul>
      <p>
        Die Heuristik lässt sich je Gerät mit der Auswahlliste <strong>Rack-Form</strong> im Abschnitt
        „Abmessungen“ des Geräte-Editors übersteuern (<strong>Automatisch</strong> /{' '}
        <strong>Volle Breite</strong> / <strong>Halbe Breite</strong> / <strong>Nur Fachboden</strong>) —
        nützlich für Grenzfälle wie Tischgeräte mit optionalen Rackwinkeln.
      </p>
      <p>
        Ein Rechtsklick auf ein Gerät im Schaltplan und <strong>Ins Rack einbauen</strong> schickt es
        vom Schaltplan aus direkt in ein Zielrack; <strong>Im Rack zeigen</strong> springt
        zu seinem aktuellen Einbauplatz.
      </p>

      <h2>Front-, Rück- und Seitenansicht</h2>
      <p>
        In der Rack-Toolbar zwischen den Ansichten <strong>Front</strong>, <strong>Rückseite</strong> und <strong>Seite</strong>{" "}
        umschalten.
      </p>
      <ul>
        <li>
          Die <strong>Frontansicht</strong> zeichnet die Geräte mit Frontblenden, Steckersymbolen und
          Montagelöchern.
        </li>
        <li>
          Die <strong>Rückansicht</strong> zeigt die Rückseite jedes Geräts. Vorn eingebaute Geräte erscheinen als
          gestreifter Belegungsschatten, damit sichtbar ist, was auf der anderen Seite sitzt. Der rückseitige Einbau ist
          bei 2-Holm-Racks gesperrt (keine hinteren Holme zum Befestigen).
        </li>
        <li>
          Die <strong>Seitenansicht</strong> zeigt einen Querschnitt: die Gerätetiefe ab den vorderen und hinteren Holmen,
          Geräte auf Fachböden in ihrer echten Tiefe und alle Tiefenkonflikte, die das Schließen der Racktür
          verhindern würden.
        </li>
      </ul>

      <h2>Zubehör</h2>
      <p>
        Ein Rechtsklick auf einen leeren Rackplatz fügt Rack-Zubehör hinzu:
      </p>
      <ul>
        <li><strong>Fachboden</strong> — Ablagefläche für Geräte ohne Rackmontage (wird automatisch angelegt, wenn ein Gerät nur für den Fachboden abgelegt wird)</li>
        <li><strong>Lüftungsblende</strong> — passive Belüftung, mit Schraffur gezeichnet</li>
        <li><strong>Blindplatte</strong> — geschlossene Abdeckung</li>
        <li><strong>Schublade</strong> — ausziehbare Schublade</li>
        <li><strong>Kabelführung</strong> — horizontale Kabelführung</li>
        <li><strong>Lüftereinheit</strong> — aktive Kühlung</li>
      </ul>
      <p>
        Zubehör liegt zusammen mit den Einbauplätzen in der Schaltplandatei und übersteht das Verschieben von Racks
        und das Duplizieren von Seiten.
      </p>

      <h2>Geräte auf Fachböden</h2>
      <p>
        Geräte auf einem Fachboden lassen sich waagerecht ziehen, um sie auf dem Fachboden zu positionieren, oder
        auf einen anderen Fachboden hinüberziehen. Beim Ziehen erscheinen Einrasthilfen — das Gerät fällt auf den
        Fachboden oder stapelt sich auf ein anderes Gerät. Bei gedrehten Geräten wird die Beschriftung umbrochen und
        bei Bedarf neu gekürzt.
      </p>

      <h2>Räume mit Racks verknüpfen</h2>
      <p>
        Ein Raum im Schaltplan lässt sich mit einem Rack verknüpfen, damit die Rack-Seite weiß, welche Geräte hineingehören.
        Den Raum-Editor öffnen (Rechtsklick → <strong>Eigenschaften bearbeiten...</strong>) und in der Auswahlliste{" "}
        <strong>Verknüpftes Rack</strong> ein Rack wählen.
      </p>
      <p>Nach dem Verknüpfen:</p>
      <ul>
        <li>
          Der Rack-Kopf zeigt ein <strong>Verknüpfungsabzeichen</strong> mit dem Raumnamen. Ein Klick darauf springt
          zurück zum Raum im Schaltplan.
        </li>
        <li>
          Die Rack-Seitenleiste gruppiert Geräte ohne Rack nach verknüpftem Raum. Die Schaltfläche <strong>Auto-Belegen</strong>{" "}
          schlägt Einbauplätze für jedes Gerät des verknüpften Raums vor — den Vorschlag prüfen und
          vollständig übernehmen oder einzelne Geräte zum Einbauen auswählen.
        </li>
        <li>
          Geräte außerhalb aller verknüpften Räume landen in einer Gruppe <strong>Sonstige</strong> am unteren Ende
          der Seitenleiste.
        </li>
      </ul>

      <h2>Kontextmenüs</h2>
      <p>Ein Rechtsklick an beliebiger Stelle auf einem Rack bietet passende Optionen:</p>
      <ul>
        <li>
          <strong>Leerer Rackplatz</strong> — Zubehör hinzufügen, Gerät einfügen (wenn eines in der Zwischenablage liegt).
        </li>
        <li>
          <strong>Gerät</strong> — Frontblenden-Layout bearbeiten, Gerät bearbeiten, Im Schaltplan zeigen, Aus dem Rack entfernen.
        </li>
        <li>
          <strong>Zubehör</strong> — Größe ändern, Entfernen.
        </li>
        <li>
          <strong>Rackrahmen</strong> — Umbenennen, Löschen, Duplizieren, Auf Seite verschieben.
        </li>
      </ul>

      <h2>Frontblenden-Editor</h2>
      <p>
        Ein Doppelklick auf ein eingebautes Gerät oder <strong>Frontblenden-Layout bearbeiten</strong> in seinem
        Kontextmenü öffnet den Frontblenden-Editor — ein WYSIWYG-Layoutwerkzeug, mit dem die Stecker auf der
        Frontplatte des Geräts angeordnet werden.
      </p>
      <ul>
        <li>Ports an eigene Positionen ziehen; Einrasten am Raster für saubere Ausrichtung</li>
        <li>Shift+Klick und Ctrl+A für Mehrfachauswahl; Werkzeuge zum Ausrichten (links/zentriert/rechts/oben/mittig/unten) und Verteilen (horizontal/vertikal)</li>
        <li>Eigene Beschriftungen hinzufügen — ziehen, skalieren, Text bearbeiten, Typografie einstellen</li>
        <li>Auf das Auto-Layout zurücksetzen, um neu zu beginnen</li>
        <li>Rückgängig und Wiederherstellen (Ctrl+Z / Ctrl+Shift+Z) innerhalb des Dialogs</li>
        <li>Darstellung in den maßgeblichen Rackabmessungen — was im Editor zu sehen ist, entspricht dem, was die Rack-Seite zeichnet</li>
      </ul>
      <p>
        Steckersymbole werden nach Herstellerangaben in realen Millimetermaßen gezeichnet. Die
        Rackansicht wählt je nach Zoom einen passenden Detailgrad: Punkte bei weiter Entfernung, Silhouetten bei
        mittlerem Zoom und detaillierte Symbole (mit Pinbildern, Ausrichtung der Schlitze usw.) bei starker
        Vergrößerung. EasySchematic bringt 59 Steckertypen mit, die praktisch jeden Stecker abdecken,
        der an AV-Geräten vorkommt.
      </p>

      <h2>Der automatische Fachboden auf einen Blick</h2>
      <p>
        Wer bisher an der Hürde „aber dieses Gerät lässt sich nicht ins Rack schrauben“ hängen geblieben ist —
        DI-Boxen, DSPs in halber Breite, Leitungstreiber, Ansteckmikrofon-Empfänger, alles in Tischgerätegröße —, legt
        das Gerät trotzdem auf einem leeren Rackplatz ab. EasySchematic legt einen 1-HE-Fachboden an und zentriert das Gerät darauf
        in seiner echten Breite. Keine 90-mm-Kästchen mehr, die als volle 19&quot;-Frontplatten gezeichnet werden.
      </p>

      <h2>Kaskadierendes Löschen</h2>
      <p>
        Wird ein Gerät aus dem Schaltplan entfernt, verschwindet auch sein Einbauplatz im Rack (und die Meldung
        nennt das betroffene Rack). Das Löschen eines Racks entfernt alle Einbauplätze und das Zubehör darin, lässt
        die zugrunde liegenden Geräte des Schaltplans aber unberührt — sie kehren in die Seitenleiste der Geräte ohne Rack zurück.
        Das Löschen einer Rack-Seite fragt nach einer Bestätigung, wenn Racks mit Räumen verknüpft sind.
      </p>

      <h2>Speichern und Rückgängig</h2>
      <p>
        Rack-Seiten, Racks, Einbauplätze und Zubehör werden zusammen mit dem Schaltplan in
        derselben Datei gespeichert (und im Cloud-Speicher). Jede wesentliche Änderung legt einen Rückgängig-Schritt an —
        Ctrl+Z funktioniert wie auf der Schaltplanseite, auch über Seitengrenzen hinweg.
      </p>
    </>
  );
}
