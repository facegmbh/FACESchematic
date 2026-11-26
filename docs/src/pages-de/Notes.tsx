export default function NotesPage() {
  return (
    <>
      <h1>Notizen &amp; Anmerkungen</h1>

      <p>
        Mit Notizen lassen sich formatierte Textanmerkungen direkt auf der Zeichenfläche ablegen — Beschriftungen,
        Beschreibungen, Revisionshinweise oder alles andere, was neben dem Signalfluss stehen soll.
      </p>

      <h2>Notizen hinzufügen</h2>
      <p>
        <strong>Notiz</strong> aus der Seitenleiste der Gerätebibliothek auf die Zeichenfläche ziehen, genau wie beim
        Platzieren eines Geräts.
      </p>

      <h2>Bearbeiten</h2>
      <p>
        Ein <strong>Doppelklick</strong> auf eine Notiz startet den Bearbeitungsmodus. Über der Notiz erscheint eine
        Formatierungsleiste mit folgenden Optionen:
      </p>
      <ul>
        <li><strong>Fett</strong>, <strong>Kursiv</strong>, <strong>Unterstrichen</strong> — übliche Textformatierung</li>
        <li><strong>Schriftgröße</strong> — Small, Medium oder Large</li>
        <li><strong>Aufzählung</strong> — schaltet die Formatierung als Aufzählungsliste ein und aus</li>
      </ul>
      <p>Ein Klick außerhalb der Notiz beendet den Bearbeitungsmodus.</p>

      <h2>Einrückung</h2>
      <p>
        Beim Bearbeiten rückt <strong>Tab</strong> eine Zeile ein, <strong>Shift+Tab</strong> rückt sie wieder aus. Das
        funktioniert sowohl bei einfachem Text als auch bei Aufzählungen.
      </p>

      <h2>Größe ändern</h2>
      <p>
        Eine Notiz auswählen (einfacher Klick) und an den Eck- oder Kantengriffen ziehen, um ihre Größe zu ändern. Der
        Text bricht passend zu den neuen Abmessungen um.
      </p>

      <h2>Löschen</h2>
      <p>
        Die Notiz auswählen und <strong>Delete</strong> oder <strong>Backspace</strong> drücken.
      </p>

      <h2>Anmerkungsformen</h2>
      <p>
        Zusätzlich zu Textnotizen lassen sich die Anmerkungsformen <strong>Rechteck</strong> und{" "}
        <strong>Ellipse</strong> auf der Zeichenfläche platzieren. Hinzugefügt werden sie über das Menü{" "}
        <strong>Einfügen</strong> (Einfügen → Rechteck hinzufügen / Ellipse hinzufügen).
      </p>
      <ul>
        <li>Einstellbare <strong>Füllfarbe</strong>, <strong>Rahmenfarbe</strong> und optionale <strong>Textbeschriftung</strong></li>
        <li>Größe durch Ziehen an den Eck- oder Kantengriffen ändern</li>
        <li>Löschen mit <strong>Delete</strong> oder <strong>Backspace</strong></li>
      </ul>
    </>
  );
}
