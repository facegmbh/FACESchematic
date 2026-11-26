export default function FloorplansPage() {
  return (
    <>
      <h1>Grundrisse</h1>

      <p>
        Ein Grundriss ist eine maßstäbliche Planzeichnung, die auf der Zeichnung des Architekten aufbaut: das
        PDF oder Bild des Architekten als Planhintergrund importieren, an einem bekannten Maß kalibrieren und dann
        die Gerätesymbole dort setzen, wo die Technik tatsächlich hinkommt. Die Legende schreibt sich aus den verwendeten
        Symbolgruppen von selbst, das Schriftfeld des Projekts sitzt in der Ecke, und das ganze Blatt wird als
        maßstabsgetreues PDF exportiert — die Zeichnung, nach der das Montageteam vor Ort arbeitet.
      </p>
      <p>
        Der Grundriss ist das räumliche Gegenstück zum Schaltplan: Der Schaltplan sagt, was womit verbunden
        ist, der Grundriss sagt, wo es hängt.
      </p>

      <h2>Einen Grundriss anlegen</h2>
      <p>
        Die Schaltfläche <strong>🗺+</strong> am rechten Ende der Seitenreiter-Leiste anklicken. Die neue Seite
        öffnet sich als A1-Blatt im Querformat im Maßstab 1:50 zwischen zwei Panels: links, was auf dem Plan liegt
        und welche Geräte noch zu setzen sind, rechts alles dazu, wie sich der Plan liest. Ein Rechtsklick auf den
        Reiter bietet Umbenennen / Duplizieren / Löschen — das Löschen eines Grundrisses entfernt seinen Planhintergrund und seine Symbole,
        nie die Geräte selbst.
      </p>

      <h2>Die Zeichnung des Architekten importieren</h2>
      <p>
        <strong>Plan importieren…</strong> in der Toolbar nimmt ein <strong>PDF</strong> (eine beliebige Seite daraus)
        oder ein Bild (PNG, JPEG, WebP, SVG) an. Eine PDF-Seite bringt ihre physische Größe mit, deshalb
        <em> übernimmt das Blatt das Format des Plans</em> — aus einer A1-Zeichnung im Hochformat wird ein A1-Blatt im Hochformat,
        aus einem ungewöhnlichen Plotterformat ein benutzerdefiniertes Blatt in genau dieser Größe —, und die Zeichnung füllt das
        Blatt von Rand zu Rand. Die eigene Legende und das eigene Schriftfeld liegen dann über den Kästen des
        Architekten und verdecken sie, statt dass der Plan auf einem anders geschnittenen Blatt neben einer
        zweiten Legende abgestellt wird. Bilder haben keine physische Größe und werden in das aktuelle Blatt eingepasst;{" "}
        <strong>⤢ Blatt füllen</strong> legt jeden Planhintergrund neu über das ganze Blatt. Mehrseitige Plansätze erhalten
        neben dem Dateinamen eine Seitenauswahl, sodass sich das Geschoss ohne erneuten Import wechseln lässt.
      </p>
      <p>
        Ein <strong>DXF</strong> ist die bessere Quelle, wenn der Architekt eines liefern kann. Es kommt{" "}
        <em>bereits maßstäblich</em> herein: Ein DXF nennt die Einheit, in der es gezeichnet ist, sodass der Plan in
        seiner echten Größe auf dem Blatt landet und keine Kalibrierung braucht. Passt die Zeichnung zum Maßstab der Seite,
        bleibt sie in diesem Maßstab; passt sie nicht, wechselt eine leere Seite auf den ersten Standardmaßstab, in den sie
        passt (bis 1:5000 für Lagepläne) — eine Seite, auf der bereits Geräte liegen, behält ihren Maßstab, weil
        eine Änderung jedes Symbol verschieben würde. Die <strong>Ebenen</strong> werden direkt nach
        dem Import angeboten, und das DXF wird als Linien statt als Pixel gezeichnet, bleibt also bei jedem Zoom scharf. Eine
        Zeichnung, die ihre Einheit nicht nennt, wird als Millimeter gelesen, und die Toolbar zeigt diese
        Annahme mit einer Auswahl <strong>Einheit</strong>, um sie zu korrigieren. Für den PDF-Export wird die Zeichnung
        mit 300 dpi des Blatts gerastert. Schraffuren werden weggelassen, und Punktobjekte werden übersprungen,
        weil sie fast immer Konstruktionspunkte sind.
      </p>
      <p>
        <strong>DWG wird nicht unterstützt</strong> — es ist ein proprietäres Binärformat, für das es keinen brauchbaren
        Parser im Browser gibt. Die Zeichnung in AutoCAD oder BricsCAD als DXF speichern (am besten — sie bleibt maßstäblich
        und behält ihre Ebenen) oder als PDF plotten und dieses importieren.
      </p>
      <p>
        Der Planhintergrund wird als gerastertes Bild in der Projektdatei gespeichert, der Plan reist also
        mit dem Schaltplan mit und funktioniert auch offline. Sehr große Zeichnungen können das
        Autosave-Budget des Browsers sprengen — die App warnt in diesem Fall, und das Speichern des Projekts in
        eine Datei funktioniert immer.
      </p>
      <p>
        Ein PDF wird mit einer <strong>Auflösung in dpi des echten Blatts</strong> gerastert, nicht mit einer
        festen Pixelzahl: 2400 px sind auf A4 203 dpi, auf A1 aber nur 72 dpi, eine Pixelgrenze ließ also
        ausgerechnet die großen Zeichnungen — die mit den meisten Details — am gröbsten herauskommen.
        Der Standard sind 150 dpi, die übliche Plotauflösung, bei der Raumbezeichnungen und
        Maßtexte auch im Zoom lesbar bleiben. <em>Qualität</em> in der Toolbar reicht von 100 bis
        500 dpi. Eine Änderung zeichnet den Plan neu aus dem PDF, das die App aufbewahrt (siehe unten).
      </p>
      <p>
        Was jede Stufe kostet, gemessen an einem dichten A1-Plan: 0,36 MB bei 100 dpi, 0,57 bei 150,
        0,98 bei 200, 1,8 bei 300, 3,0 bei 400 und 4,5 bei 500. Strichzeichnungen lassen sich als PNG gut komprimieren,
        es gelten aber zwei Obergrenzen. Oberhalb von etwa 300 dpi sprengt ein A1-Plan das
        Autosave-Budget des Browsers, das Projekt muss dann in eine Datei gespeichert werden. Und das Raster selbst kann
        nicht größer werden, als ein Browser an Speicher bereitstellt: etwa 16384 px an der langen Kante und 260
        Megapixel, was auf A1 rund 495 dpi und auf A0 rund 350 dpi ergibt. Die Toolbar zeigt
        die tatsächlich erreichte Auflösung und sagt es, wenn die Blattgröße die Auswahl begrenzt hat.
        Für Details darüber hinaus ist ein Vektor-Export die Antwort, nicht ein größeres Bild.
      </p>
      <ul>
        <li>
          <strong>Ebenen</strong> — ein PDF aus AutoCAD oder Revit bringt meist eigene Ebenen mit
          (Möblierung, Elektro, Bemaßung). Hat der importierte Plan welche, öffnet sich die
          Auswahl <em>Ebenen</em> mit der Liste, und angehakt wird, was gezeichnet werden soll. Ein
          Lautsprecherblatt braucht einen ruhigeren Hintergrund als ein Kabelblatt, und wer
          denselben Plan zweimal mit unterschiedlichen Ebenen importiert, erhält zwei Hintergründe zum Arbeiten. Die Auswahl
          ist in das Raster eingebrannt, eine spätere Änderung zeichnet den Plan also neu aus dem PDF, das die App
          aufbewahrt (siehe unten). Platzierung und Kalibrierung bleiben erhalten.
        </li>
        <li><strong>Deckkraft</strong> blendet die Zeichnung zurück, damit Symbole über dichten Linien lesbar bleiben.</li>
        <li><strong>Sperren</strong> fixiert den Planhintergrund, damit er beim Setzen von Symbolen nicht verrutscht.</li>
        <li>Entsperrt lässt sich der Planhintergrund durch Ziehen verschieben; der Eckgriff ändert seine Größe bei festem Seitenverhältnis.</li>
      </ul>

      <h3>Die Quelldatei wird aufbewahrt</h3>
      <p>
        Seitenwechsel, Ebenenwechsel und eine geänderte Auflösung zeichnen den Plan jeweils neu aus
        dem Original-PDF. Deshalb bewahrt die App diese Datei im eigenen Speicher des Browsers
        (IndexedDB) auf und nicht nur für die Sitzung. Ein Neuladen des Tabs kostet keinen
        erneuten Import mehr. Die Bytes bleiben bewusst aus dem Autosave des Projekts heraus, das
        für das ganze Dokument ein Budget von rund 5 MB hat — das PDF eines Architekten kann allein
        ein Vielfaches davon haben.
      </p>
      <p>
        Das Speichern des Projekts <strong>in eine Datei</strong> schreibt diese Bytes hinein, sodass auch eine Kollegin
        oder ein Kollege, der die Datei öffnet, den Plan neu zeichnen kann — die Seite wechseln, die Ebenen ändern, die
        Auflösung erhöhen. Die Datei wächst entsprechend, und ein Speichern über 20 MB weist darauf hin.
      </p>
      <p>
        Eine Grenze sollte man kennen: Eine Quelle über 25 MB wird gar nicht aufbewahrt, und die App sagt das beim
        Import. Der Plan funktioniert, aber ein späteres Neuzeichnen braucht die Datei erneut.
      </p>

      <h2>Maßstab und Kalibrierung</h2>
      <p>
        Der Seitenmaßstab (1:50, 1:100, …) macht aus dem Blatt eine Zeichnung statt eines Bildes: Bei
        1:50 entspricht ein Millimeter auf dem Papier 50 mm im Gebäude. Eine Änderung des Maßstabs passt den
        Planhintergrund neu ein, sodass das Gebäude auf dem Blatt seine echte Größe behält.
      </p>
      <p>
        Das PDF eines Architekten ist die Ausnahme, denn es <em>ist</em> das Blatt. Der Import liest
        den Maßstab, den der Plan in seinem Text nennt („M 1:50“), und stellt ihn ein; nennt der Plan
        mehrere Maßstäbe oder keinen, gibt es einen Hinweis, und der Maßstab wird von Hand gewählt. Solange das PDF in
        seiner geplotteten Größe auf dem Blatt liegt, sagt die Wahl eines anderen Maßstabs nur aus, in welchem Maßstab der Plan gezeichnet ist —
        die Zeichnung bleibt, wo sie ist, und füllt weiterhin das Blatt, und nur die daraus abgegriffenen
        Strecken ändern sich. Sobald der Planhintergrund verschoben oder in der Größe geändert wurde, passt der Maßstab ihn wie
        oben beschrieben neu ein.
      </p>
      <p>
        <strong>📏 Kalibrieren</strong> macht den Planhintergrund maßhaltig. Die beiden Enden eines bekannten
        Maßes anklicken — eine Raumbreite, einen Achsabstand, eine Maßlinie in der Zeichnung — und
        diese Strecke in Metern eintippen. Der Planhintergrund wird so skaliert, dass die Referenz im
        Seitenmaßstab stimmt, und die Toolbar nennt danach die Auflösung der Zeichnung in mm je Pixel.
        Bis zur Kalibrierung liegt der Plan in seiner Nenngröße, und daraus abgegriffene Strecken sind
        nur so gut wie die Quelle.
      </p>

      <h2>Messen und Maßlinien</h2>
      <p>
        <strong>📐 Messen</strong> liest eine Strecke aus dem Plan ab: Zwei Punkte anklicken, und die Leiste
        oben zeigt die Strecke in Metern im Maßstab der Seite, mit ihrem waagerechten und
        senkrechten Anteil. Ein dritter Klick beginnt die nächste Messung. In den Plan wird nichts gezeichnet
        — es ist die schnelle Probe, ob ein importierter Plan wirklich den Maßstab hat, den er angibt: ein
        Maß nachmessen, das der Architekt eingetragen hat.
      </p>
      <p>
        Die Punkte fangen, was gezeichnet ist, im Umkreis von etwa zehn Bildschirmpixeln bei jedem Zoom: die Ecken
        einer Wand, die Flächen einer Wand (gemessen wird also die lichte Weite, nicht von Achse zu Achse) und die Enden
        vorhandener Maßlinien. Der zweite Punkt hält außerdem die Waagerechte oder Senkrechte durch
        den ersten; wo diese Linie eine Wandfläche kreuzt, landet er auf der Fläche, auf Höhe des ersten
        Punkts. Eine orangefarbene Markierung zeigt vor dem Klick, was gefangen wurde — ein Quadrat für eine Ecke, eine
        Raute für eine Wandfläche, ein Ring für die Flucht allein. <kbd>Alt</kbd> halten, um einen Punkt
        frei zu setzen. Die Linien der Architektenzeichnung selbst sind ein Bild und werden nicht gefangen;
        wer sie braucht, übernimmt zuerst die Wände aus dem PDF.
      </p>
      <p>
        <strong>Maß einzeichnen</strong>, angeboten, sobald beide Punkte gesetzt sind, hält die Messung als
        Maßlinie mit Endstrichen und der Maßzahl darüber im Plan fest. Gespeichert werden nur die beiden
        Punkte: Die Maßzahl wird jedes Mal aus dem Maßstab errechnet, eine Korrektur des Maßstabs
        korrigiert also jedes Maß. Maßlinien werden in das PDF exportiert und beim Duplizieren der Seite
        mitkopiert. Zum Entfernen eine Maßlinie mit dem Werkzeug „Auswählen“ anklicken und <kbd>Delete</kbd> drücken;
        verschieben lassen sie sich noch nicht — löschen und neu messen.
      </p>

      <h2>Die beiden Panels</h2>
      <p>
        Das <strong>linke Panel</strong> ist der Inhalt des Plans: <em>Auf dem Plan</em> führt jedes
        gesetzte Symbol mit seiner Nummer, seinem Bild und dem Gerät dahinter auf — ein Klick auf eine Zeile wählt
        dieses Symbol auf dem Blatt aus, Shift-Klick fügt es der Auswahl hinzu. Darunter stehen die Geräte des
        Schaltplans; eines auf das Blatt ziehen, um es zu setzen. Ein Suchfeld filtert beide Listen.
      </p>
      <p>
        Im <strong>rechten Panel</strong> wird bearbeitet. Ein Symbol auswählen — auf dem Blatt oder in der linken Liste —,
        und oben öffnet sich <em>Ausgewähltes Symbol</em> mit seiner Nummer, der <strong>Gruppe</strong>, zu der es
        gehört (ein Wechsel ändert das Symbol), der Linie, an der es hängt, seiner Blickrichtung, der Lage
        seiner Nummer und einem Hinweis. <em>Symbol bearbeiten…</em> springt zu dieser Gruppe weiter unten, wo
        Form, Farbe und das hochgeladene Bild liegen — sie gelten für jedes Symbol der Gruppe.
        Darunter folgen die Symbolgruppen, die Nummerierung, die Endstufenlinien, der Legendenkasten, das
        Schriftfeld, die abgedeckten Bereiche und die Hinweise. Beide Panels lassen sich zu einer schmalen Leiste einklappen.
      </p>

      <h2>Ebenen</h2>
      <p>
        Eine Symbolgruppe ist zugleich eine Ebene. Das Auge neben einer Gruppe im rechten Panel schaltet
        sie aus: Ihre Symbole verschwinden vom Blatt, aus dem Export und aus der Legende, bleiben aber im
        Projekt. So entstehen aus einer Architektenzeichnung mehrere Blätter — ein Lautsprecherplan
        und ein Videoplan aus demselben Planhintergrund, jeweils mit ausgeschaltetem anderem Gewerk
        exportiert.
      </p>
      <p>
        Ein <strong>Rechtsklick auf ein Symbol</strong> ist der kurze Weg: um 90° drehen, in eine
        andere Gruppe verschieben, seine Ebene ausblenden, alle anderen Ebenen ausblenden (sodass nur diese bleibt),
        ausgeblendete zurückholen oder es entfernen. Ein ausgeblendetes Symbol lässt sich nicht mehr rechtsklicken, deshalb
        funktioniert das Wiedereinschalten einer Ebene immer auch aus dem Panel. Symbole einer ausgeschalteten
        Gruppe bleiben links aufgeführt, markiert als <em>ausgeblendet</em>.
      </p>

      <h2>Symbolgruppen</h2>
      <p>
        Eine Symbolgruppe ist eine Legendenzeile: eine Farbe, eine Form und das Modell, für das sie steht. Gruppen
        werden in der Seitenleiste hinzugefügt und erhalten jeweils einen Titel („Deckenlautsprecher“), eine Beschreibungszeile
        („Bose DM6SE schwarz | Kabel 2×2,5 mm²“) und optional ein Produktbild für die
        Legende.
      </p>
      <p>
        Die Beschreibungszeile muss nicht für jeden Plan getippt werden. Eine Gerätevorlage kann ein
        festes <strong>Installationskabel</strong> („Kabel aus Decke: 2x2,5 mm²“) und einen dauerhaften{" "}
        <strong>Installationshinweis</strong> tragen — beides im Geräte-Editor bearbeitbar und mit der
        Vorlage gespeichert. Eine Gruppe, die aus einem solchen Modell entsteht (durch Ablegen des Geräts auf dem Plan oder
        mit <code>add_floorplan_group</code> und einer templateId), erhält{" "}
        <em>Hersteller Modell | Installationskabel</em> als Beschreibung, und der Hinweis wird als <em>Modell: Hinweis</em> an
        die Installationshinweise der Legende angehängt. Das Kabel einmal am
        Lautsprecher in der Bibliothek eintragen, und die Legende jedes Plans lautet gleich.
      </p>
      <p>
        Produktbilder kommen aus drei Quellen, in dieser Reihenfolge: ein Bild, das <strong>hochgeladen</strong>{" "}
        wird (im Projekt gespeichert, immer gedruckt), das <strong>Bild der Gerätevorlage</strong>, wenn die
        Gruppe an eine gebunden ist (als Schaltfläche angeboten oder automatisch übernommen, wenn ein Gerät
        auf dem Plan abgelegt wird), oder eine beliebige eingefügte <strong>Bild-URL</strong> — der Platz, den später das
        Odoo-Produktbild füllt. Entfernte Bilder erscheinen sofort auf dem Bildschirm; der PDF-Export bettet sie ein,
        wenn der Bildserver Cross-Origin-Zugriff erlaubt, und druckt die Zeile andernfalls ohne
        ihr Bild. Die Legende führt standardmäßig jede Gruppe auf; für eine gemeinsame Legende über einen Plansatz hinweg auf
        „Nur Gruppen, die auf diesem Plan vorkommen“ umschalten.
      </p>
      <p>
        Woher das Symbol kommt: Eine Gruppe, die aus einem Modell der Bibliothek entsteht, übernimmt dessen{" "}
        <strong>Plansymbol</strong> — Form, Farbe und ein optionales Zeichen aus einem oder zwei Buchstaben im
        Symbol —, einmal im Geräte-Editor festgelegt und mit der Vorlage gespeichert. Ein Modell ohne
        Plansymbol wird nach Typ gezeichnet: Lautsprecher rund, Subwoofer quadratisch, Mikrofone als Dreiecke,
        Projektoren, Kameras, Racks und Displays als Piktogramme in der Draufsicht, übriges Video als Rauten,
        mit einer aus dem Modell abgeleiteten Farbe, die sich deshalb zwischen Plänen nie ändert. Jeder Wert bleibt
        danach an der Gruppe bearbeitbar.
      </p>
      <ul>
        <li><strong>Farbe</strong> — aus der Farbfeldreihe oder eine beliebige eigene Farbe.</li>
        <li>
          <strong>Form</strong> — Kreis, Quadrat, Raute oder Dreieck, damit die Gruppen auch auf einem
          Schwarz-Weiß-Druck unterscheidbar bleiben; oder ein Piktogramm — <em>Projektor</em>, <em>Rack</em>, <em>Display</em>,{" "}
          <em>Kamera</em> —, gezeichnet als die Draufsicht, die ein Monteur auf einem Architektenplan liest.
          Piktogramme nehmen die Gruppenfarbe für den Körper und drucken ihre Details (Objektiv, Schrankdiagonalen,
          Bildschirmfront) in der Zeichenfarbe.
        </li>
        <li>
          <strong>Eigenes Symbol</strong> — <em>Symbol hochladen…</em> setzt ein PNG, JPG, WebP oder SVG
          an die Stelle der gezeichneten Form. Es wird beim Import auf ein Quadrat gerastert und im
          Projekt gespeichert, sodass Plan, Legende und PDF dasselbe Bild zeigen und nichts
          davon abhängt, dass ein Server erreichbar ist. Ein hochgeladenes Symbol ersetzt Form, Farbe
          und Zeichen — das Bild ist das Symbol. Wird es stattdessen am Gerät hochgeladen (Geräte-Editor
          → <em>Plansymbol</em>), erhält es jeder Plan, der das Modell verwendet.
        </li>
        <li>
          <strong>Kontur</strong> — die Linie um den Symbolkörper, in Farbe und
          Stärke. Die Stärke wird in Papier-mm angegeben, sie druckt also unabhängig von der Symbolgröße
          gleich kräftig; <code>0</code> lässt die Kontur ganz weg und ergibt ein flaches, gefülltes Symbol.
          Bleibt das Feld leer, skaliert sie mit dem Symbol. Die Details der Piktogramme (Objektiv, Schrankdiagonalen,
          Bildschirmfront) behalten ihre eigene dunkle Farbe, damit sie auf weißem Papier lesbar sind.
        </li>
        <li>
          <strong>Drehen</strong> — ein Projektor, ein Display oder eine Kamera blickt in eine Richtung. Symbole
          auf dem Blatt auswählen und das Bild mit <em>Symbol ⟲ ⟳</em> drehen; die Nummer daneben
          bleibt aufrecht. <em>Übernehmen für Linie / Gruppe</em> kopiert die Drehung auf die übrigen, und das
          Feld <em>Drehen</em> einer Gruppe legt die Richtung fest, in der neue Symbole starten.
        </li>
        <li>
          <strong>Nummernpräfix</strong> — gibt der automatischen Nummerierung den Anfang vor. Mit <code>1.1</code> zählt
          die Gruppe 1.1, 1.2, 1.3…; mit <code>SB.</code> läuft sie SB.1, SB.2, …
        </li>
      </ul>

      <h2>Beschallungspläne: Linien und Beschriftungen</h2>
      <p>
        <strong>Typ</strong> in der Toolbar schaltet eine Seite auf einen <strong>Beschallungsplan</strong> um. Das
        wendet die Voreinstellungen des Beschallungsplans an — deutscher Legendentitel und deutsche Hinweisüberschrift, die
        Revisionsspalten <em>Index · Datum · Änderungen · Bearb. · Gepr.</em>, die Schriftfeld-Felder Bauvorhaben,
        Bauherr, Maßstab, Blattgröße, Datum, Planersteller:in — und ändert, wie Symbole nummeriert werden:
        je <strong>Endstufenlinie</strong>. Die aktive <strong>Linie</strong> in der Seitenleiste setzen
        („4“, „SB“), und jedes abgelegte Symbol lautet <em>Linie.Lautsprecher</em>: 4.1, 4.2, …
        Die Seitenleiste führt die Linien des Plans mit ihren Stückzahlen auf und nummeriert eine Linie in der
        Reihenfolge der Platzierung neu. Die Beschriftungsvorlage (standardmäßig <code>{"{{line}}.{{n}}"}</code>, außerdem{" "}
        <code>{"{{group}}"}</code> und <code>{"{{device}}"}</code>) ist je Seite bearbeitbar.
      </p>
      <p>
        Jede Beschriftung lässt sich <strong>um ihr Symbol herum platzieren und drehen</strong>: Ein oder mehrere
        Symbole auswählen, und es erscheint ein Panel mit den acht Kompasspositionen, einem Drehfeld und Schaltflächen für
        ±45° sowie „Übernehmen für Linie / Gruppe“, um die Platzierung auf alle Lautsprecher dieser
        Linie oder dieser Gruppe zu kopieren. Das Ziehen der Nummer selbst funktioniert weiterhin für freie Platzierung. Das PDF
        gibt Ausrichtung und Drehung exakt wieder.
      </p>

      <h2>Linien, Endstufenkanäle und Last</h2>
      <p>
        Eine Linie ist der Stromkreis eines Endstufenkanals. Auf einem Beschallungsplan werden die Linien{" "}
        <strong>aus dem Schaltplan gelesen</strong>: Jeder Lautsprecherausgang einer Endstufe (oder eines beliebigen
        Geräts, das kein Lautsprecher ist und solche Ausgänge hat) ist ein Kanal, und die daran verdrahteten
        Lautsprecher — einschließlich Durchschleifen von Lautsprecher zu Lautsprecher — sind die Last des Kanals. Ein
        verdrahteter Lautsprecher, der auf dem Plan abgelegt wird, landet automatisch auf der Linie seines Kanals; hat der
        Kanal noch keine, wird die Linie mit der nächsten freien Nummer angelegt. <strong>Aus dem Schaltplan
        übernehmen</strong> im Panel <em>Linien &amp; Last</em> der Seitenleiste erledigt dasselbe für
        alles auf einmal und nummeriert die gesetzten Symbole je Kanal neu. Von da an folgt der Plan
        dem Schaltplan <strong>live</strong>: Wird ein Lautsprecher auf einen anderen Kanal umverdrahtet, wechselt sein
        Symbol sofort auf die Linie dieses Kanals, auf jedem Beschallungsplan, ohne dass eine
        Schaltfläche zu drücken wäre (das Rückgängigmachen der Verdrahtung macht auch den Wechsel rückgängig). Linien, die noch nicht
        verdrahtet sind (eine in das Feld <em>Linie</em> getippte Nummer), bleiben, wie sie sind; auf jeder Linienkarte lässt sich
        der Kanal wählen, die Linie umbenennen (ihre Symbole werden neu beschriftet), für die Legende benennen und
        festlegen, wie der Kanal läuft: <strong>Lo-Z</strong>, <strong>70 V</strong> oder{" "}
        <strong>100 V</strong> mit dem Übertragerabgriff je Lautsprecher.
      </p>
      <p>
        Ist der Kanal bekannt, zeigt jede Linie ihre <strong>Lastprüfung</strong>, angelehnt an das
        Bose PowerShareX Design Tool und nutzbar für jede Marke, deren Vorlagen die Daten tragen
        (Audac, JBL, Voice-Acoustic, Tennax …): <code>speakerLoad</code> der Lautsprecher{" "}
        (Impedanz, Dauerleistung, Abgriffe, Profil) und <code>ampLoad</code> der Endstufe{" "}
        (Nennleistung je Kanal nach Last, gemeinsame Gesamtleistung, Spitzenspannung / Spitzenstrom) — siehe das{" "}
        <a href="/device-template-schema">Vorlagenschema</a>; beides wird am Gerät unter{" "}
        <em>Last</em> bearbeitet. Je Kanal berechnet das Modell die angeforderte Burst-Leistung (das Doppelte der
        Dauerleistung bei Lo-Z, die Summe der Abgriffe auf einer 70/100-V-Linie), die Lastimpedanz und ihr
        erwartetes Minimum, Spitzenspannung und Spitzenstrom sowie die mittlere Leistung nach dem Crestfaktor des
        Profils; anschließend vergleicht es mit Spitzenspannung, Spitzenstrom,
        Kanalleistung und gemeinsamer Leistung (nach Art von PowerShare) der Endstufe und meldet die kleinste Reserve in dB
        samt dem, was sie begrenzt. <strong>OK</strong> oberhalb von +1 dB, <strong>Nahe am Limit</strong> bis hinunter
        zu −2 dB, <strong>Überschritten</strong> darunter — oder bei einer Last unterhalb der Mindestimpedanz
        der Endstufe. Lautsprecher oder Endstufen ohne Daten werden als solche gemeldet und nicht geschätzt.
        Die Legende druckt auf Beschallungsplänen eine <strong>Linientabelle</strong> (Linie → Endstufe · Kanal, Menge,
        Last); sie lässt sich in den Legendeneinstellungen ausschalten oder umbenennen.
      </p>

      <h2>Symbole setzen</h2>
      <p>
        Ein Gerät aus der Seitenleiste auf den Plan ziehen — das Symbol bleibt mit diesem Gerät im
        Schaltplan verknüpft, sein Modell und seine Kabelangaben sind also dasselbe, was Packliste und
        Kabelliste ausweisen. Geräte, die bereits auf dem Plan liegen, zeigen ihre Symbolnummer neben sich.
      </p>
      <p>
        Das Werkzeug <strong>✚ Setzen</strong> legt Symbole der aktiven Gruppe überall dort ab, wo geklickt wird,
        nützlich für Positionen, die noch kein Gerät haben.
      </p>
      <ul>
        <li>Jedes neue Symbol führt die Nummerierung seiner Gruppe fort (4.1 → 4.2, SB.09 → SB.10).</li>
        <li>Ein Doppelklick auf ein Symbol oder seine Nummer benennt es um.</li>
        <li>Die Nummer selbst ziehen, um die Beschriftung von den Linien der Zeichnung freizustellen.</li>
        <li>Shift-Klick für Mehrfachauswahl; <kbd>Delete</kbd> entfernt die ausgewählten Symbole.</li>
        <li>Positionen rasten auf 0,5 mm auf dem Papier ein — <kbd>Alt</kbd> halten für freie Platzierung.</li>
        <li><strong>Neu nummerieren</strong> im Gruppeneditor vergibt die Nummern einer Gruppe neu in der Reihenfolge der Platzierung.</li>
      </ul>
      <p>
        Das Löschen eines Geräts im Schaltplan entfernt seine Symbole aus jedem Grundriss, so wie es auch
        seine Einbauplätze im Rack entfernt.
      </p>

      <h2>Einen Projektor planen</h2>
      <p>
        Einen Projektor auf dem Plan auswählen und im rechten Panel <strong>▷ Projektion planen</strong>{" "}
        drücken. Das Bild erscheint vor dem Projektor als Linie in seiner echten Breite, mit dem Lichtkegel
        dorthin. Diese Linie an die Wand ziehen, an der das Bild hängt; der runde Griff an ihrem Ende dreht sie. Von
        da an <em>bleibt das Bild, wo es ist, und der Projektor ist das, was sich bewegt</em>.
      </p>
      <p>
        Das <strong>Modell</strong> durch Tippen eines Teils seines Namens wählen (Epson; bei anderen Fabrikaten das Feld
        leer lassen und Projektionsverhältnis und Lichtstrom aus dem Datenblatt eintragen), das{" "}
        <strong>Format</strong> wählen und dem Bild seine Größe als Diagonale, Breite oder Höhe geben. Die
        Schlösser fixieren eine Seite, sodass sie einen Formatwechsel übersteht. Der Schieberegler <strong>Abstand</strong>{" "}
        läuft genau von der nächsten bis zur fernsten Position, die das Objektiv erlaubt, und schiebt den
        Projektor entlang seiner Linie — der Projektor lässt sich auch einfach ziehen. Die gestrichelte Linie auf dem Plan
        markiert dieselbe Strecke.
      </p>
      <p>
        Zoom und horizontaler Lens-Shift ergeben sich daraus, wo der Projektor steht; außerhalb der Grenzen
        wird der Lichtkegel rot, und das Panel sagt, um wie viel. Die <strong>Helligkeit</strong> wird als
        Lumen ÷ Bildfläche = Lux ausgeschrieben. Unter <strong>Mehr</strong> liegen das Objektiv eines
        Modells mit Wechselobjektiv, die beiden Höhen, die auch den vertikalen Shift prüfen und die
        zulässige Montagehöhe ergeben, sowie der Gain der Leinwand.
      </p>

      <h3>Der Schnitt: Wer im Bild steht</h3>
      <p>
        Ein Grundriss kann nicht zeigen, ob jemand, der im Raum steht, einen Schatten wirft. Unter{" "}
        <strong>Mehr</strong> die Unterkante des Bildes und die Objektivhöhe eintragen, optional die
        Raumhöhe, und die Größe der zu prüfenden Person (<em>stehend</em> 1,80 m oder{" "}
        <em>sitzend</em> 1,30 m). Das Panel zeichnet dann den senkrechten Schnitt durch Objektiv und Bild
        und meldet zum Beispiel „bis 1.78 m vor der Bildfläche im Bild“. Auf dem Plan
        ist dieser Abschnitt des Lichtkegels schraffiert. <strong>Schnitt auf dem Blatt zeigen</strong> legt den
        Schnitt als Kasten auf den Plan, der sich verschieben und in der Breite ziehen lässt, sodass er mit dem Blatt exportiert wird.
      </p>
      <p>
        Hat der Architekt einen Schnitt gezeichnet, wird stattdessen dieser verwendet: <strong>Schnittzeichnung anfügen…</strong>{" "}
        nimmt ein PDF oder ein Bild an und verlangt dann zwei Klicks auf dessen Bodenlinie — unter dem Bild und
        unter dem Objektiv des Projektors. Das legt Lage und Maßstab fest (der Abstand dazwischen ist
        der Projektionsabstand, den der Plan bereits kennt), und Lichtkegel, Bild und Person werden über die
        Linien des Architekten gezeichnet.
      </p>

      <h2>Der Legendenkasten</h2>
      <p>
        Die Legende wird aus den verwendeten Gruppen erzeugt: Farbfeld, Titel, Beschreibung und
        Produktbild, gefolgt von den frei geschriebenen Installationshinweisen (eine Zeile je Hinweis — Montagedetails,
        Kabelangaben, alles, was der Monteur braucht). Der Kasten lässt sich an jede Stelle des Blatts ziehen; der Griff an
        seiner rechten Kante legt die Breite fest, und die Höhe folgt dem Inhalt.
      </p>
      <p>
        Die Legende so umschalten, dass sie jede Gruppe aufführt und nicht nur die gesetzten, wenn der Plan ein Blatt eines
        Satzes ist, der sich eine Legende teilt.
      </p>

      <h3>Die eigene Firma auf jedem Plan</h3>
      <p>
        <strong>Einstellungen → Firma</strong> enthält die Angaben des planenden Unternehmens: Logo, Name,
        Anschriftzeilen, Telefon, E-Mail, Web. Sie werden im Browser gespeichert und als Momentaufnahme in jede
        Projektdatei übernommen und stehen am Fuß jeder Grundrisslegende, ohne dass jemand sie tippt — je Legende
        ausschalten, wenn ein Blatt sie nicht tragen darf. Das Schriftfeld greift auf das Firmenlogo zurück,
        wenn das Schriftfeld des Projekts keines hat, und seine Felder können{" "}
        <code>{"{{companyName}}"}</code>, <code>{"{{companyAddress}}"}</code> und{" "}
        <code>{"{{companyContact}}"}</code> verwenden.
      </p>

      <h2>Inhalte aus dem Architektenplan herausnehmen</h2>
      <p>
        Der Planhintergrund ist ein Rasterbild, darin lässt sich also nichts löschen — aber abdecken. Das Werkzeug{" "}
        <strong>▭ Abdecken</strong> zieht eine weiße Abdeckung über einen beliebigen Teil des Plans: die
        Symbollegende des Architekten, die Revisionstabelle, das Schriftfeld, einen Hinweis, der nicht mehr gilt.
        Abdeckungen lassen sich verschieben, an der Ecke in der Größe ändern und mit <kbd>Delete</kbd> entfernen; das Panel führt sie auf.
        Die eigene Legende und das eigene Schriftfeld liegen darüber, sodass das gedruckte Blatt nur einen Satz Kästen trägt.
      </p>
      <p>
        Ein <strong>Rechtsklick auf eine Abdeckung</strong> bietet alles Weitere: sie um 15° oder 90° drehen,
        wenn der Block darunter nicht im Winkel zum Blatt steht, sie auf 75, 50 oder 25 % zurückblenden, sodass die
        Linien leiser werden statt zu verschwinden, sie an Ort und Stelle <strong>sperren</strong> oder sie
        entfernen. Drehung und Zurückblenden werden beide gedruckt. Eine Abdeckung sperren, sobald sie richtig sitzt — danach werden
        Symbole auf ihr gesetzt, und jeder dieser Klicks könnte sie sonst verschieben. Die Größe
        vor dem Drehen festlegen: Der Eckgriff misst im ungedrehten Rahmen der Abdeckung.
      </p>
      <p>
        Beide Kästen lassen sich außerdem strecken: Der untere Griff an der Legende und am Schriftfeld legt eine
        Mindesthöhe fest, sodass sich jeder der beiden so weit herunterziehen lässt, dass er den Block des Architekten genau abdeckt
        (das Schriftfeld gibt den zusätzlichen Platz seinem Titelband, wie es Architektenschriftfelder tun).
      </p>

      <h2>Hinweise auf dem Plan</h2>
      <p>
        Freier Text lässt sich überall auf dem Blatt ablegen: das Werkzeug <strong>✎ Notiz</strong> wählen und klicken oder
        einen Hinweis aus der Seitenleiste hinzufügen. Hinweise brechen an ihrer Breite um (den Griff an der rechten Kante ziehen),
        werden in der in Papier-mm eingestellten Größe gedruckt und können in einem weißen Kasten stehen, damit sie
        über den Linien des Architekten lesbar bleiben. Doppelklick zum Bearbeiten an Ort und Stelle, <kbd>Delete</kbd> entfernt.
        Sie eignen sich für die Anmerkungen, die ein Monteur neben dem betreffenden Symbol braucht —
        Kabelreserve, Deckenverstärkung, eine Tür, die frei bleiben muss.
      </p>

      <h2>Das Schriftfeld</h2>
      <p>
        Jeder ausgegebene Plan trägt ein Schriftfeld — den <em>Plankopf</em>. Auf einem Grundriss ist es ein
        bewegliches Objekt, das an seinen Platz gezogen und in der Seitenleiste bearbeitet wird. Von oben nach unten enthält es:
      </p>
      <ul>
        <li>
          <strong>Revisionstabelle</strong> — Index, Datum, Änderung, gezeichnet von, geprüft von. Die
          Spaltenüberschriften sind bearbeitbar (<em>Index · Datum · Änderungen · Bearb. · Gepr.</em> ist also nur eine
          Bearbeitung entfernt). <strong>+ Revision</strong> hängt eine Zeile mit dem nächsten Index und dem heutigen
          Datum an; der neueste Stand wird oben gedruckt.
        </li>
        <li><strong>Hinweistext (Disclaimer)</strong> — Kleingedrucktes wie die Klausel zur Prüfung der Maße vor Ort.</li>
        <li><strong>Titel</strong> und Untertitel — das Geschoss und was die Zeichnung zeigt.</li>
        <li>
          <strong>Felder</strong> — ein zweispaltiges Raster aus Paaren von Beschriftung und Wert (Projekt, Bauherr,
          Maßstab, Blatt, Datum, gezeichnet von …). Ein Feld als <em>breit</em> markieren (<em>Über beide Spalten</em>), damit es für eine
          Anschrift beide Spalten einnimmt. Werte dürfen Platzhalter verwenden, die aus dem Schriftfeld des Projekts und der Seite aufgelöst werden:
          <code>{"{{showName}}"}</code>, <code>{"{{venue}}"}</code>, <code>{"{{designer}}"}</code>,
          <code>{"{{engineer}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{drawingTitle}}"}</code>,
          <code>{"{{company}}"}</code>, <code>{"{{revision}}"}</code>, <code>{"{{scale}}"}</code>,
          <code>{"{{sheetSize}}"}</code>, <code>{"{{pageLabel}}"}</code>, <code>{"{{projectName}}"}</code>.
          Maßstab und Blattgröße veralten deshalb nie, wenn sich die Seite ändert.
        </li>
        <li><strong>Logo und Nordpfeil</strong> — das Projektlogo aus dem Schriftfeld und ein drehbarer Nordpfeil.</li>
      </ul>
      <p>
        Das feste Schriftfeld in der Blattecke, das die Druckbögen verwenden, ist auf Grundrissen standardmäßig ausgeschaltet (das
        Schriftfeld des Grundrisses trägt dieselben Daten) und lässt sich in der Toolbar wieder einschalten.
      </p>

      <h2>Einen Plan vom KI-Assistenten füllen lassen</h2>
      <p>
        Alles oben Beschriebene außer dem Planhintergrund lässt sich über die{" "}
        <a href="/ai-assistant">MCP-Brücke</a> erzeugen: <code>create_floorplan</code>,{" "}
        <code>add_floorplan_group</code>, <code>place_floorplan_symbols</code> (Positionen in
        realen Metern ab der Ecke der Zeichenfläche), <code>set_floorplan_legend</code>{" "}
        (Überschrift und Installationshinweise), <code>set_floorplan_drawing_block</code> und{" "}
        <code>add_floorplan_revision</code> (Titel, Felder, Revisionstabelle, Hinweistext) sowie{" "}
        <code>add_floorplan_notes</code>. Linien und Last decken{" "}
        <code>sync_floorplan_lines</code>, <code>list_floorplan_lines</code>,{" "}
        <code>update_floorplan_line</code> (Kanal, Betriebsart, Abgriff, Name, Umbenennen) und{" "}
        <code>speaker_load_report</code> (jede Endstufe im Schaltplan, Kanal für Kanal) ab.
        Der Server liefert ein Playbook <em>floorplan</em> mit, das
        den Assistenten durch die richtige Reihenfolge führt. Die Zeichnung des Architekten selbst wird im Editor importiert und
        kalibriert — der Assistent erfährt es, wenn sie fehlt.
      </p>

      <h2>Export</h2>
      <p>
        <strong>PDF exportieren</strong> (Toolbar oder <strong>Datei → Export → Grundrisse exportieren</strong>)
        schreibt jede Grundrissseite in echter Papiergröße, je eine PDF-Seite. Bei 100 % gedruckt ist das
        Ergebnis eine maßstäbliche Zeichnung: Auf dem Papier gemessene Strecken sind die Strecken vor Ort.
      </p>
    </>
  );
}
