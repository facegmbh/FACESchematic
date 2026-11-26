export default function EdgeRoutingPage() {
  return (
    <>
      <h1>Verbindungs-Routing</h1>

      <h2>Intelligentes Routing</h2>
      <p>
        FACESchematic verwendet einen <strong>A*-Pfadsuchalgorithmus</strong>, um Verbindungen um
        Geräte herumzuführen. Statt einfacher gerader Linien oder schlichter Stufenpfade finden die Verbindungen intelligente Wege, die:
      </p>
      <ul>
        <li><strong>Überlappungen</strong> mit Geräten <strong>vermeiden</strong></li>
        <li><strong>Parallele Verbindungen ineinanderschachteln</strong>, wenn mehrere Verbindungen zwischen demselben Gerätepaar verlaufen</li>
        <li><strong>Kreuzungen</strong> mit anderen Verbindungen <strong>minimieren</strong></li>
        <li>
          <strong>Orthogonale Pfade verwenden</strong> (nur waagerechte und senkrechte Abschnitte) für ein sauberes, professionelles Bild
        </li>
      </ul>

      <h2>So funktioniert es</h2>
      <ol>
        <li>
          <strong>Hinderniskarte</strong> — Alle Geräte werden in rechteckige Hinderniszonen umgewandelt, mit einem Abstand
          für die Port-Stummel
        </li>
        <li>
          <strong>A*-Pfadsuche</strong> — Für jede Verbindung läuft A* von ihrem Quellport zu ihrem Zielport und weicht dabei
          Hindernissen aus
        </li>
        <li>
          <strong>Schachtelung paralleler Verbindungen</strong> — Verbindungen mit gemeinsamen Endpunkten werden gruppiert und versetzt, sodass sie sich
          ohne Überlappung ineinanderschachteln
        </li>
        <li>
          <strong>Iterative Verfeinerung</strong> — Die Routen werden zentral berechnet, sodass alle Verbindungen voneinander wissen
        </li>
      </ol>

      <h3>Routing-Prioritäten</h3>
      <p>Der Algorithmus optimiert nach diesen Gestaltungskriterien (in dieser Reihenfolge):</p>
      <ol>
        <li>Keine Verbindung läuft durch ein Gerät</li>
        <li>Möglichst geringe Gesamtlänge des Pfads</li>
        <li>Möglichst wenige Richtungswechsel</li>
        <li>Parallele Verbindungen schachteln sich sauber (die äußerste Verbindung hat die größte Spannweite)</li>
        <li>Einheitlicher waagerechter Fluss (bevorzugt von links nach rechts)</li>
      </ol>

      <h2>Manuelles Routing</h2>
      <p>
        Manchmal liefert der Auto-Router nicht genau den gewünschten Weg. Das Routing jeder
        Verbindung lässt sich übersteuern, indem <strong>manuelle Stützpunkte</strong> hinzugefügt werden — Punkte, durch die die
        Verbindung laufen muss.
      </p>

      <h3>Einen Stützpunkt hinzufügen</h3>
      <ol>
        <li>Ein <strong>Rechtsklick</strong> auf eine beliebige Verbindung öffnet das Kontextmenü</li>
        <li><strong>Stützpunkt hinzufügen</strong> wählen</li>
        <li>An der Klickposition erscheint ein Stützpunkt auf der Verbindung</li>
      </ol>
      <p>
        Zur Erinnerung zeigt eine ausgewählte Verbindung, die noch keine Stützpunkte hat, in ihrer Mitte den Hinweis{" "}
        <strong>„Rechtsklick auf das Kabel, um einen Stützpunkt hinzuzufügen“</strong>.
      </p>
      <p>
        Die Verbindung wird zwischen je zwei Stützpunkten per A*-Pfadsuche neu geroutet,
        sie weicht also weiterhin Geräten aus und behält saubere orthogonale Richtungswechsel — sie läuft dabei lediglich
        durch die gewählten Punkte.
      </p>

      <h3>Stützpunkte verschieben</h3>
      <p>
        Die Verbindung anklicken, um sie auszuwählen, dann <strong>einen beliebigen Stützpunkt ziehen</strong>, um ihn zu versetzen.
        Stützpunkte rasten am 20px-Raster ein (demselben Raster, an dem Geräte einrasten), sodass Verbindungen
        sauber mit den Ports fluchten.
      </p>

      <h3>Stützpunkte entfernen</h3>
      <p>
        Ein Rechtsklick in der Nähe eines vorhandenen Stützpunkts und <strong>Stützpunkt entfernen</strong> löscht ihn.
        Die Verbindung wird automatisch um die verbleibenden Stützpunkte neu geroutet (oder vollständig
        automatisch, wenn keine Stützpunkte übrig sind).
      </p>

      <h3>Auf automatisches Routing zurücksetzen</h3>
      <p>
        Ein Rechtsklick auf eine manuell geroutete Verbindung und <strong>Route zurücksetzen</strong> entfernt
        alle Stützpunkte und gibt die Verbindung wieder an das vollautomatische Routing zurück.
      </p>

      <h3>Wie manuelles und automatisches Routing zusammenspielen</h3>
      <ul>
        <li>
          <strong>Manuelle Verbindungen werden zuerst geroutet</strong> — sie haben beim Belegen von Korridoren Vorrang
          vor automatisch gerouteten Verbindungen
        </li>
        <li>
          <strong>Andere Verbindungen weichen aus</strong> — automatisch geroutete Verbindungen sehen den Pfad der manuellen
          Verbindung und laufen um ihn herum
        </li>
        <li>
          <strong>A* arbeitet weiter</strong> — jedes Teilstück zwischen Stützpunkten nutzt die vollständige A*-Pfadsuche
          mit Hindernisvermeidung, nur eben mit der Vorgabe, durch die Stützpunkte zu laufen
        </li>
        <li>
          <strong>Rückgängig/Wiederholen</strong> — alle Stützpunkt-Aktionen lassen sich mit Ctrl+Z rückgängig machen
        </li>
      </ul>

      <h2>Auto-Routing umschalten</h2>
      <p>
        Ein Status-Chip in der <strong>rechten oberen Ecke</strong> der Zeichenfläche zeigt den aktuellen
        Routing-Modus. Ein Klick auf den Chip schaltet das Auto-Routing ein oder aus.
      </p>
      <ul>
        <li>
          <strong>Ein</strong> (Standard) — Verbindungen werden per A*-Pfadsuche um Geräte herumgeführt
        </li>
        <li>
          <strong>Aus</strong> — Verbindungen nutzen einfache direkte Pfade, nützlich bei{" "}
          <strong>großen Schaltplänen</strong>, in denen das A*-Routing zu Verzögerungen führt
        </li>
      </ul>
      <p>
        Der Schaltzustand wird mit dem Schaltplan gespeichert. Auch bei ausgeschaltetem Auto-Routing lassen sich
        einzelnen Verbindungen manuelle Stützpunkte hinzufügen.
      </p>

      <h2>Performance</h2>
      <p>
        Routen werden neu berechnet, wenn Geräte bewegt werden oder sich Verbindungen ändern, bleiben aber <strong>während des Ziehens eingefroren</strong>,
        damit die Bedienung flüssig bleibt. Eine kurze Verzögerung nach dem Loslassen gibt der Zeichenfläche Zeit, die Port-Positionen zu messen, bevor das Routing
        einsetzt.
      </p>

      <h2>Debug-Modus</h2>
      <p>
        <strong>Ctrl+B</strong> schaltet die Debug-Überlagerung für Verbindungen um; sie zeigt an
        beiden Endpunkten jeder Verbindung die Verbindungs-IDs und Routing-Metadaten.
      </p>
    </>
  );
}
