export default function PrintSheetsPage() {
  return (
    <>
      <h1>Druckbögen</h1>

      <p>
        Druckbögen sind Layoutseiten in Papiergröße, auf denen Rackansichten zu einer druckbaren
        Zeichnung zusammengestellt werden. Eine oder mehrere Rackansichten auf einen Bogen ziehen, sie auf
        einem echten Papierraster anordnen und skalieren und das Ganze als Vektor-PDF exportieren. Der Druckbogen ist
        die Rack-Unterlage zur Übergabe — an das Montageteam, den Veranstaltungsort oder das Projektarchiv.
      </p>
      <p>
        Das ist etwas anderes als die <a href="/printing">Druckansicht</a> des Schaltplans, die das
        Signalflussdiagramm selbst druckt. Druckbögen sind für Racks da.
      </p>

      <h2>Einen Druckbogen anlegen</h2>
      <p>
        Die Schaltfläche <strong>📄+</strong> am rechten Ende der Seitenreiter-Leiste fügt einen Druckbogen
        hinzu. Der neue Reiter öffnet eine leere Papierseite mit der Seitenleiste der Rackansichten links.
      </p>
      <p>
        Ein Rechtsklick auf einen beliebigen Reiter bietet Umbenennen / Duplizieren / Löschen.
      </p>

      <h2>Papierformat und Ausrichtung</h2>
      <p>
        Papierformat und Ausrichtung werden in der Toolbar oben am Druckbogen gewählt.
      </p>
      <ul>
        <li><strong>Letter</strong> (8,5 × 11&quot;)</li>
        <li><strong>Tabloid</strong> (11 × 17&quot;)</li>
        <li><strong>A4</strong> (210 × 297 mm)</li>
        <li><strong>A3</strong> (297 × 420 mm)</li>
        <li><strong>Benutzerdefiniert</strong> — beliebige Breite und Höhe in Zoll eingeben</li>
      </ul>
      <p>
        Zwischen <strong>Querformat</strong> und <strong>Hochformat</strong> umschalten. Ein Wechsel von Papier oder
        Ausrichtung legt einen Rückgängig-Schritt an, sodass sich die Änderung zurücknehmen lässt, wenn die neue
        Anordnung nicht gefällt.
      </p>

      <h2>Rackansichten hinzufügen</h2>
      <p>
        Die Seitenleiste führt jedes Rack der Rack-Seiten auf. Ein Rack auf den Bogen ziehen, um eine
        Ansicht abzulegen — standardmäßig die Frontansicht, Rück- und Seitenansicht stehen ebenfalls zur Wahl. Jede Ansicht ist ein
        lebendiges Fenster auf dieses Rack: Wird das Rack auf seiner Rack-Seite bearbeitet, aktualisiert sich die Ansicht.
      </p>
      <p>
        Mehrere Ansichten auf einem Bogen ergeben eine Zeichnung mit mehreren Racks. Dasselbe
        Rack zweimal abgelegt zeigt Front und Rückseite nebeneinander.
      </p>

      <h2>Positionieren und Skalieren</h2>
      <ul>
        <li>
          Eine Ansicht <strong>ziehen</strong>, um sie zu verschieben. Ausrichtungshilfen erscheinen, sobald eine Kante
          näher als 3 mm an die Kante einer anderen Ansicht oder an einen Seitenrand kommt — blaue gestrichelte Linien rasten bei
          Berührung ein.
        </li>
        <li>
          Die <strong>Größe</strong> an der Ecke unten rechts ändern. Das Seitenverhältnis ist standardmäßig auf die
          natürlichen Abmessungen des Racks festgelegt. <strong>Shift</strong> halten, um die Bindung aufzuheben und
          frei zu strecken (nützlich für optische Gruppierung).
        </li>
        <li>
          <strong>R</strong> drücken, während eine oder mehrere Ansichten ausgewählt sind, um die <strong>Größe</strong>{" "}
          auf das natürliche Verhältnis von Breite zu Höhe <strong>zurückzusetzen</strong>.
        </li>
        <li>
          <strong>Mehrfachauswahl</strong> mit Shift+Klick, Auswahlrahmen oder Ctrl+A. Ausgewählte
          Ansichten werden gemeinsam als Gruppe gezogen. Beim Skalieren der Gruppe bleibt die relative Position
          jeder Ansicht erhalten, und alle werden gleichmäßig skaliert.
        </li>
        <li>
          <strong>Delete</strong> oder <strong>Backspace</strong> entfernt die ausgewählten Ansichten.
        </li>
      </ul>

      <h2>Schriftfeld, Ansichtsbezeichnung, Kennwerte</h2>
      <p>
        Jede Ansicht zeichnet unter der Rackzeichnung einen Beschriftungsstreifen:
      </p>
      <ul>
        <li><strong>Kursive Ansichtsbezeichnung</strong> — „Front“, „Rückseite“ oder „Seite“, je nach Ansicht</li>
        <li><strong>Kennwertzeile</strong> — Rackname, belegte HE / HE gesamt, Gewicht, Leistungsaufnahme</li>
        <li><strong>Hinweiszeile</strong> — optionale Anmerkungen oder Warnungen (z. B. Tiefenkonflikte, Paarung von Halb-Rack-Geräten)</li>
      </ul>
      <p>
        Die Kennwertzeile lässt sich je Ansicht im Rechtsklick-Menü ein- und ausschalten. Die Typografie entspricht exakt der
        Rack-Seite — Inter für Fließtext, Inter Italic für die Ansichtsbezeichnungen —, sodass Druckbogen
        und Live-Rackansicht gleich aussehen.
      </p>

      <h2>Verschieben und Zoomen</h2>
      <p>
        Druckbögen folgen den <strong>Scroll-Einstellungen</strong> (Bearbeiten → Einstellungen →
        Navigation Mode). Pinch-Zoom auf dem Trackpad, Verschieben mit zwei Fingern, Ziehen mit der mittleren Maustaste, Leertaste+Ziehen —
        dieselben Gesten wie auf der Zeichenfläche des Schaltplans.
      </p>

      <h2>Vektor-PDF-Export</h2>
      <p>
        <strong>PDF exportieren</strong> in der Toolbar gibt den Bogen als Vektor-PDF aus. Der
        Export deckt sich pixelgenau mit der Live-Vorschau:
      </p>
      <ul>
        <li>Rackrahmen mit Montagelöchern und angedeuteten inneren Holmen</li>
        <li>Frontblenden der Geräte mit Steckersymbolen, Port-Beschriftungen und Abschnittstrennern</li>
        <li>Belegungsschatten (echtes diagonales Streifenmuster, auf die Grenzen der Ansicht beschnitten)</li>
        <li>Schraffur der Lüftungsblenden, Blindplatten, Schubladen, Kabelführungen</li>
        <li>HE-Rasterlinien und Tiefenanzeigen in der Seitenansicht</li>
        <li>Geräte auf Fachböden an der richtigen Position auf dem Fachboden und mit der richtigen Drehung</li>
        <li>Halb-Rack-Geräte auf der richtigen Seite</li>
        <li>Mehrzeilige Gerätebeschriftungen mit sauberem Zeilenumbruch</li>
        <li>Höhenangaben (1U, 2U, …) neben den Gerätenamen</li>
        <li>Kursive Ansichtsbezeichnung und Kennwertzeile unter jeder Ansicht</li>
        <li>Mehrere Bögen werden zu mehreren PDF-Seiten</li>
      </ul>
      <p>
        Schriftgrößen und Strichstärken werden von SVG-px in pt umgerechnet, sodass die sichtbaren Größen dem Bogen
        auf dem Bildschirm entsprechen. Inter Italic ist eingebettet (lateinischer Zeichensatz, ~70 KB), damit die Ansichtsbezeichnung im
        PDF kursiv erscheint, ohne von Systemschriften abzuhängen.
      </p>

      <h2>Tipps</h2>
      <ul>
        <li>
          Beim Ziehen an einer Ecke <strong>Shift</strong> halten, um die Bindung des Seitenverhältnisses aufzuheben, wenn eine
          gestreckte Ansicht gebraucht wird (z. B. ein hohes Rack, zur optischen Betonung besonders hoch gezeichnet).
        </li>
        <li>
          Mit <strong>Ctrl+A</strong> und anschließend <strong>R</strong> jede Ansicht auf dem Bogen
          auf das natürliche Seitenverhältnis zurücksetzen.
        </li>
        <li>
          Einen Druckbogen über das Rechtsklick-Menü des Reiters duplizieren, wenn eine zweite Variante gebraucht wird —
          Papierformat A gegen B, Quer- gegen Hochformat oder nur Front gegen Front und Rückseite.
        </li>
        <li>
          Änderungen auf einer Rack-Seite erscheinen sofort in jedem Druckbogen, der dieses Rack zeigt — ohne
          erneuten Import und ohne Aktualisieren.
        </li>
      </ul>
    </>
  );
}
