export default function PatchPanelsPage() {
  return (
    <>
      <h1>Patchpanels &amp; das Patchfeld</h1>

      <p>
        In einer echten Installation läuft ein Kabel selten direkt von Gerät zu Gerät — es wird auf einem
        Patchpanel aufgelegt, geht über ein Patchkabel weiter und führt dann zu seinem Ziel. Die Seite <strong>Patchfeld </strong>
        dokumentiert diesen Weg, <em>ohne</em> das Panel in den Schaltplan zu zeichnen: Die
        Zeichnung bleibt ein übersichtliches Einstrich-Schema, während das Patchfeld genau festhält, auf welchem Panel-Port
        jedes Kabel landet.
      </p>

      <h2>Die Patchfeld-Seite hinzufügen</h2>
      <p>
        Auf die Schaltfläche <strong>🔌+</strong> in der Leiste der Seitenreiter klicken (neben den Schaltflächen für Rack und
        Druckbogen). Das Patchfeld ist eine einzige, projektweite Seite — sie zeigt jedes Patchpanel im
        Projekt, ob das Panel im Schaltplan platziert oder <em>virtuell</em> ist.
      </p>

      <h2>Virtuelle Panels</h2>
      <p>
        Über <strong>+ Panel hinzufügen</strong> in der Sidebar des Patchfelds wird ein <strong>virtuelles Panel </strong>
        aus der Gerätebibliothek angelegt. Virtuelle Panels erscheinen nie im Schaltplan und beeinflussen nie das
        Routing der Verbindungen, sind aber echte Projektgeräte: Sie tauchen in der Packliste und in der
        Patchfeld-Belegung auf und lassen sich in Rack-Ansichten platzieren. Ein virtuelles Panel lässt sich
        von der Sidebar aus in ein Gerät im Schaltplan umwandeln (und zurück) — das Umwandeln in ein virtuelles Panel ist nur
        möglich, solange das Panel keine gezeichneten Verbindungen hat.
      </p>

      <h2>Eine Verbindung patchen</h2>
      <p>
        Es gibt zwei Wege, eine Verbindung über einen Panel-Port zu führen:
      </p>
      <ul>
        <li>
          Auf der Patchfeld-Seite die Verbindung in der Kabelliste der Sidebar suchen und auf
          <strong> Patchen…</strong> klicken — freie Ports leuchten auf; ein Klick auf einen davon ordnet ihn zu. Ein Klick auf einen Port an einem
          zweiten Panel fügt einen weiteren Hop hinzu (Gerät → Panel → Panel → Gerät), danach
          <strong> Fertig</strong> oder <kbd>Esc</kbd> drücken.
        </li>
        <li>
          Im Schaltplan mit der rechten Maustaste auf eine beliebige Verbindung klicken und <strong>Über Panel patchen...</strong> wählen —
          das führt auf das Patchfeld, der Zuordnungsmodus ist dann bereits aktiv.
        </li>
      </ul>
      <p>
        <strong>Patch lösen</strong> (Sidebar) entfernt alle Hops einer Verbindung. Das Löschen eines Panels
        entfernt dessen Zuordnungen, löscht aber nie die Verbindungen selbst.
      </p>

      <h2>Kabelnummerierung: ein Signal, mehrere physische Kabel</h2>
      <p>
        Eine gepatchte Verbindung ist ein Signal, aber zwei oder drei physische Kabel, und die Berichte behandeln sie
        auch so. Jedes Teilstück erbt die Kabel-ID der Verbindung mit einem angehängten Buchstaben:
        Aus <code> E001</code> wird <code>E001-A</code> (Gerät → Panel), <code>E001-B</code> (Panel →
        Panel oder Panel → Gerät) und so weiter. Der Schaltplan zeigt weiterhin die Basis-ID.
      </p>
      <p>
        Ein Doppelklick auf einen Teilstück-Chip im Patchfeld <strong>überschreibt dessen Bezeichnung</strong> (markiert
        mit ✏️) — nützlich, wenn die festen Verbindungsleitungen ein eigenes Nummernschema haben. Überschreibungen wirken sich auf
        jeden Bericht aus.
      </p>

      <h2>Die Panel-Ansicht lesen</h2>
      <p>
        Jedes Panel wird als Frontansicht mit einer Buchse pro Port dargestellt. Unter jedem belegten Port zeigen zwei
        Chips den Signalweg: <strong>◀</strong> das Kabel, das auf der Rückseite (Feldseite) ankommt, und
        <strong> ▶</strong> das Kabel, das auf der Vorderseite (Patchseite) abgeht, jeweils mit Kabel-ID und
        dem Gerät am anderen Ende. Beim Überfahren eines Chips, einer Buchse oder einer Kabelzeile in der Sidebar wird der gesamte Signalweg
        über alle Panels hervorgehoben, durch die er läuft. Ports, die durch gezeichnete Verbindungen zu einem Panel im Schaltplan
        beschaltet sind, erscheinen ebenfalls, allerdings schreibgeschützt — sie werden auf der Zeichenfläche verwaltet.
      </p>

      <h2>Drucken</h2>
      <ul>
        <li>
          <strong>Streifen drucken (PDF)</strong> — Beschriftungsstreifen in Originalgröße (100 %), bemessen auf
          die 19″-Racköffnung (450.85&nbsp;mm). Streifen, die breiter als die Seite sind, werden in Abschnitte mit
          Schnittmarken geteilt: mit 100 % drucken (nicht an die Seite anpassen), ausschneiden, zusammenfügen und in die Beschriftungsleiste des Panels
          schieben. Jeder Port zeigt seine ankommende Quelle über seinem abgehenden Ziel.
        </li>
        <li>
          <strong>Belegungsbericht…</strong> — öffnet die Patchfeld-Belegung: eine Zeile pro Port mit
          den Kabel-IDs hinten/vorn, Gegenstellen, Räumen und Längen. Gepatchte (virtuelle) Zuordnungen und
          physisch gezeichnete Verbindungen stehen nebeneinander, mit denselben Kabelnummern wie im
          Schaltplan. Der Export als CSV oder PDF erfolgt aus dem Dialog Berichte. Das PDF bildet die Tabelle auf dem
          Bildschirm ab — dieselben Spalten in derselben Reihenfolge, derselbe Filter, dieselbe Gruppierung und Sortierung —, über
          das Menü <strong>Spalten</strong> des Reiters wird also festgelegt, was eine gedruckte Belegung zeigt. Die CSV
          exportiert immer jede Spalte und jede Zeile, sodass einer Tabellenkalkulation die vollständigen Daten zur Verfügung
          stehen.
        </li>
      </ul>

      <h2>Gut zu wissen</h2>
      <ul>
        <li>Beim Kopieren und Einfügen wird eine gepatchte Verbindung <em>ungepatcht</em> eingefügt — zwei Kabel können sich keinen physischen Port teilen.</li>
        <li>
          Eine Verbindung lässt sich nur über einen Port patchen, dessen Steckverbinder tatsächlich zu ihr passt —
          eine SDI-Strecke auf BNC landet nicht in einem RJ45-Panel. Die Signalart wird nicht geprüft, da ein Panel ein
          signalneutraler Durchgang ist: AES3 über ein analoges XLR-Panel zu führen ist in Ordnung.
        </li>
        <li>Geschätzte Längen (aus den Raumabständen) gelten für ganze Strecken, nicht pro Teilstück; Längen der Teilstücke werden über den Editor zum Überschreiben der Bezeichnung oder über die Kabelliste eingetragen.</li>
        <li>Die Normalisierung von Audio-Patchbays (voll/halb normalisiert) wird noch nicht abgebildet — die Belegung weist sie als „Keine“ aus.</li>
      </ul>
    </>
  );
}
