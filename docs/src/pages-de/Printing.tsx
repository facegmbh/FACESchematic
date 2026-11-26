export default function PrintingPage() {
  return (
    <>
      <h1>Drucken &amp; Schriftfeld</h1>

      <p>
        EasySchematic bringt einen vollständigen Druckablauf mit: Seiteneinrichtung, ein konfigurierbares Schriftfeld und mehrseitigen PDF-Export.
        Diese Seite behandelt den Druck des <strong>Signalfluss-Schaltplans</strong>. Papierbasierte
        Rack-Ansichtszeichnungen — mehrere Rackansichten auf einem Bogen angeordnet, Vektor-PDF-Export — beschreibt die Seite{" "}
        <a href="/print-sheets">Druckbögen</a>.
      </p>

      <h2>Druckansicht</h2>
      <p>
        Die <strong>Druckansicht</strong> wird im Menü <strong>Ansicht</strong> oder mit <strong>F9</strong> ein- und ausgeschaltet. In der Druckansicht:
      </p>
      <ul>
        <li>Die Seitengrenzen liegen als Überlagerung auf der Zeichenfläche</li>
        <li>Bereiche außerhalb des Ursprungs der Zeichenfläche sind abgedunkelt</li>
        <li>Geräte und Verbindungen innerhalb der Seitengrenzen werden so gedruckt, wie sie sind</li>
      </ul>

      <h2>Seiteneinrichtung</h2>
      <p>Über die Bedienelemente in der Toolbar der Druckansicht lässt sich einstellen:</p>
      <ul>
        <li>
          <strong>Papierformat</strong> — Standard (Letter, Legal, Tabloid), ISO (A0–A4), ANSI (C/D/E), Architektur (A–E) oder benutzerdefinierte Abmessungen
        </li>
        <li><strong>Ausrichtung</strong> — Querformat oder Hochformat</li>
        <li><strong>Maßstab</strong> — 0.25x bis 2.0x; bestimmt, wie viel von der Zeichenfläche auf jede Seite passt</li>
        <li>
          <strong>Schriftfeld</strong> — blendet das Schriftfeld auf jeder Seite ein oder aus. Ausgeblendet gibt es seine
          Höhe an die Zeichnung zurück, sodass jede Seite mehr vom Schaltplan fasst und die Seitenzahl sinken kann.
          Die Einstellung wird mit der Datei gespeichert, neben dem Schalter <strong>Signallegende</strong>.
        </li>
      </ul>

      <h2>Panel „Show-Infos“</h2>
      <p>
        Das Panel <strong>Show-Infos</strong> in der rechten Seitenleiste öffnen, um die Projekt-Metadaten auszufüllen. Diese Felder
        füllen das Schriftfeld:
      </p>
      <ul>
        <li>Show-/Projektname</li>
        <li>Veranstaltungsort</li>
        <li>Planer</li>
        <li>Techniker</li>
        <li>Datum</li>
        <li>Zeichnungstitel</li>
      </ul>

      <h2>Schriftfeld</h2>
      <p>
        Das Schriftfeld erscheint am unteren Rand jeder gedruckten Seite, sofern es nicht mit dem Schalter
        <strong> Schriftfeld</strong> in der Toolbar der Druckansicht ausgeschaltet wird. Es hat zwei Reiter zur Konfiguration:
      </p>

      <h3>Reiter „Daten“</h3>
      <p>Hier werden die Feldwerte bearbeitet, die im Schriftfeld erscheinen; außerdem lässt sich ein <strong>Logo</strong> (PNG oder SVG) hochladen.</p>

      <h3>Reiter „Layout“</h3>
      <p>
        Ein interaktiver Raster-Editor zum Anpassen des Schriftfeld-Layouts:
      </p>
      <ul>
        <li>Zeilen und Spalten hinzufügen oder entfernen</li>
        <li>Zellgrenzen ziehen, um die Größe zu ändern</li>
        <li>Inhaltstyp jeder Zelle festlegen (Textfeld, Logo, fester Beschriftungstext)</li>
        <li>Schriftgröße, Schriftstärke, Schriftfamilie, Textausrichtung und Textfarbe je Zelle einstellen</li>
        <li>Zellen über mehrere Zeilen und Spalten verbinden</li>
      </ul>

      <h2>PDF-Export</h2>
      <p>
        Das Menü <strong>Export</strong> in der Menüleiste öffnen und <strong>PDF exportieren</strong> wählen, um ein mehrseitiges PDF-Dokument
        zu erzeugen, das den Einstellungen der Druckansicht entspricht. Jede Seite enthält das Schriftfeld, sofern es
        in der Druckansicht nicht ausgeblendet ist.
      </p>
      <p>
        <strong>Rack-PDF exportieren</strong> druckt je Rack ein Blatt im Querformat auf dem Papierformat, das in der
        Druckansicht gewählt ist.
      </p>
    </>
  );
}
