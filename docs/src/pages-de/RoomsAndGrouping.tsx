export default function RoomsAndGroupingPage() {
  return (
    <>
      <h1>Räume &amp; Gruppierung</h1>

      <h2>Räume</h2>
      <p>
        Räume sind <strong>Container</strong>, die physische Orte darstellen — eine Regie, eine Bühne, einen
        Rackraum usw. Geräte in einem Raum bewegen sich mit, wenn der Raum gezogen wird.
      </p>

      <h2>Räume anlegen</h2>
      <ol>
        <li>„Raum“ in der Seitenleiste der Gerätebibliothek suchen</li>
        <li>Auf die Zeichenfläche ziehen</li>
        <li>Oder auf die Zeichenfläche <strong>doppelklicken</strong>, „room“ eintippen und Enter drücken</li>
        <li>Doppelklick auf die Raumbeschriftung, um den Raum umzubenennen</li>
      </ol>

      <h2>Geräte zuordnen</h2>
      <ul>
        <li><strong>Ein Gerät auf einen Raum ziehen</strong> — das Gerät wird diesem Raum untergeordnet</li>
        <li><strong>Ein Gerät aus einem Raum herausziehen</strong> — das Gerät löst sich und wird eigenständig</li>
        <li>Für die Zuordnung zählt, wo die <strong>Mitte</strong> des Geräts landet</li>
      </ul>
      <p>Ist ein Gerät einem Raum untergeordnet:</p>
      <ul>
        <li>Seine Position wird <strong>relativ</strong> zum Raum gespeichert</li>
        <li>Wird der Raum bewegt, bewegen sich alle untergeordneten Elemente mit</li>
        <li>Das Gerät bleibt sichtbar innerhalb des gestrichelten Rahmens des Raums</li>
      </ul>

      <h2>Unterräume</h2>
      <p>
        Räume lassen sich in andere Räume schachteln, um <strong>Gerätestandorte innerhalb eines physischen Raums</strong> darzustellen —
        zum Beispiel ein Rackfeld oder eine Stagebox in einem größeren Studioraum.
      </p>
      <ul>
        <li><strong>Einen Raum auf einen anderen Raum ziehen</strong> — der innere Raum wird Unterraum des äußeren</li>
        <li><strong>Einen Unterraum herausziehen</strong> — er löst sich und wird wieder ein Raum der obersten Ebene</li>
        <li>Die Schachtelung ist <strong>beliebig tief</strong> — Unterräume können eigene Unterräume enthalten</li>
        <li>Ein Raum <strong>lässt sich nicht in einem seiner eigenen Nachfahren ablegen</strong> (zirkuläre Schachtelung wird verhindert)</li>
      </ul>
      <p>
        Unterräume unterscheiden sich optisch von Räumen der obersten Ebene: Sie haben standardmäßig einen <strong>durchgezogenen Rahmen</strong> und
        einen etwas deckenderen Hintergrund. Über die Raum-Eigenschaften lässt sich das weiterhin anpassen.
      </p>
      <p>
        Wird ein übergeordneter Raum gelöscht, werden seine Unterräume und Geräte <strong>aus der Zuordnung gelöst</strong> statt gelöscht;
        ihr Inhalt bleibt an der richtigen absoluten Position auf der Zeichenfläche erhalten.
      </p>
      <p>
        Unterräume lassen sich auch in großer Zahl beim CSV-Import anlegen, indem in einer Raumspalte ein Raumpfad wie{" "}
        <code>Sanctuary &gt; FOH</code> verwendet wird — siehe{" "}
        <a href="/import-export">Dateien &amp; Exporte</a>.
      </p>

      <h2>Raumgröße ändern</h2>
      <p>
        Wird ein Raum ausgewählt, erscheinen Anfasser an seinen Ecken und Kanten. Durch Ziehen wird der Raum größer oder kleiner.
        Die Anfasser rasten an den Kanten anderer Räume ein; blaue Hilfslinien helfen beim genauen Ausrichten.
      </p>

      <h2>Kontextmenü des Raums</h2>
      <p>
        Ein <strong>Rechtsklick</strong> auf einen Raum öffnet ein Kontextmenü mit zwei Optionen:
      </p>
      <ul>
        <li><strong>Eigenschaften bearbeiten...</strong> — öffnet den Editor Raum-Eigenschaften (siehe unten)</li>
        <li><strong>Raum sperren / Raum entsperren</strong> — schaltet um, ob sich der Raum ziehen lässt</li>
        <li><strong>Als Equipment-Rack markieren / Equipment-Rack-Markierung entfernen</strong> — schaltet die Darstellung im Rack-Stil um</li>
      </ul>

      <h2>Räume sperren</h2>
      <p>
        Ein gesperrter Raum ist <strong>vor versehentlichem Verschieben geschützt</strong>. Gesperrte Räume zeigen ein Schloss-Symbol an ihrer
        Beschriftung und lassen sich nicht bewegen, bis sie entsperrt werden. Untergeordnete Geräte in einem gesperrten Raum lassen sich weiterhin
        verschieben. Die Sperre wird im Rechtsklick-Kontextmenü umgeschaltet.
      </p>

      <h2>Räume gestalten</h2>
      <p>
        Der Editor Raum-Eigenschaften wird über das Rechtsklick-Kontextmenü geöffnet. Anpassen lassen sich:
      </p>
      <ul>
        <li><strong>Beschriftung</strong> — der Anzeigename des Raums</li>
        <li><strong>Schriftgröße</strong> — einstellbar von 9px bis 24px</li>
        <li><strong>Hintergrundfarbe</strong> — Füllfarbe der Raumfläche</li>
        <li><strong>Rahmenstil</strong> — durchgezogen, gestrichelt oder gepunktet</li>
        <li><strong>Rahmenfarbe</strong> — Farbe der Umrisslinie des Raums</li>
      </ul>

      <h2>Equipment-Racks</h2>
      <p>
        Ein Raum lässt sich über das Rechtsklick-Kontextmenü oder den Editor Raum-Eigenschaften
        als <strong>Equipment-Rack</strong> markieren. So markierte Räume werden im Schaltplan
        im Rack-Stil dargestellt und in Berichten als Geräte-Container behandelt.
      </p>
      <p>
        Für eigene Rack-Ansichtszeichnungen — Ziehen ins Rack mit Einrasten auf Höheneinheiten, Ansichten von vorn / hinten / von der
        Seite, Zubehör, Frontblenden-Bearbeitung und PDF-Export — gibt es den eigenen{" "}
        <a href="/racks">Rack-Editor</a> auf einem eigenen Seiten-Tab. Die beiden Funktionen ergänzen sich:
        Equipment-Rack-Räume ordnen Geräte im Schaltplan nach ihrem physischen Container, während Rack-Seiten
        die Ansichtszeichnung als Planungsunterlage liefern.
      </p>

      <h2>Einen Raum mit einem Rack verknüpfen</h2>
      <p>
        Ein Raum im Schaltplan lässt sich mit einem Rack auf einer Rack-Seite verknüpfen, damit das Rack weiß, welche
        Geräte hineingehören. Dazu den Editor Raum-Eigenschaften öffnen (Rechtsklick → <strong>Eigenschaften
        bearbeiten</strong>) und im Dropdown <strong>Verknüpftes Rack</strong> ein Ziel-Rack wählen.
      </p>
      <p>Nach dem Verknüpfen:</p>
      <ul>
        <li>
          Der Rack-Kopf auf der Rack-Seite zeigt ein <strong>Verknüpfungs-Badge</strong> mit dem Raumnamen —
          ein Klick darauf springt zurück zum Raum im Schaltplan.
        </li>
        <li>
          Die Seitenleiste der Rack-Seite gruppiert Geräte ohne Rack nach verknüpftem Raum. Eine Schaltfläche{" "}
          <strong>Auto-Belegen</strong> schlägt in einem Zug Positionen für jedes Gerät im verknüpften
          Raum vor.
        </li>
        <li>
          Geräte, die in keinem verknüpften Raum liegen, landen in einer Gruppe <strong>Sonstige</strong> am
          unteren Ende der Seitenleiste.
        </li>
      </ul>

      <h2>Hilfslinien zum Einrasten</h2>
      <p>
        Werden Räume in die Nähe anderer Räume gezogen, erscheinen <strong>blaue gestrichelte Hilfslinien</strong>, die
        beim Ausrichten von Kanten und Mitten helfen. Dieselben Hilfslinien erscheinen beim Ändern der Raumgröße. Auch Geräte rasten
        an Raumkanten ein, wenn sie in deren Nähe gezogen werden.
      </p>

      <h2>Räume löschen</h2>
      <p>
        Wird ein Raum gelöscht, werden seine untergeordneten Elemente (Geräte und Unterräume) <strong>aus der Zuordnung gelöst</strong> (in
        absolute Positionen umgerechnet) statt gelöscht. Das verhindert, dass Gerätekonfigurationen versehentlich verloren gehen.
        Mit <strong>Raum &amp; Inhalt löschen</strong> im Kontextmenü werden ein Raum und alles darin entfernt
        — einschließlich geschachtelter Unterräume in beliebiger Tiefe.
      </p>
    </>
  );
}
