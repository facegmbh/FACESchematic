/** German dictionary — floorplan surface. Keys are the English source strings. */
export const DE_FLOORPLAN: Record<string, string> = {
  // Right-click menu on a plan symbol (FloorplanSymbolContextMenu).
  "90° clockwise": "90° im Uhrzeigersinn",
  "90° counter-clockwise": "90° gegen den Uhrzeigersinn",
  "Upright again": "Wieder aufrecht",
  "Move to group": "In Gruppe verschieben",
  "this group": "diese Gruppe",
  "Hide “{group}”": "„{group}“ ausblenden",
  "Takes this group off the sheet, the export and the legend. It stays in the project — switch it back on in the panel on the right.":
    "Nimmt diese Gruppe vom Blatt, aus dem Export und aus der Legende. Sie bleibt im Projekt — im rechten Panel wieder einschalten.",
  "Hide every other group": "Alle anderen Gruppen ausblenden",
  "Leaves only this group on the sheet — one export per trade from the same drawing.":
    "Lässt nur diese Gruppe auf dem Blatt — ein Export je Gewerk aus derselben Zeichnung.",
  "Show the 1 hidden group": "Die eine ausgeblendete Gruppe einblenden",
  "Show all {n} hidden groups": "Alle {n} ausgeblendeten Gruppen einblenden",
  "Remove {n} symbols from the plan": "{n} Symbole aus dem Plan entfernen",
  "{n} symbols": "{n} Symbole",
  // Legend line table — the same four headings are drawn on screen and in the PDF.
  "LINES / AMPLIFIER CHANNELS": "LINIEN / ENDSTUFENKANÄLE",
  // ─── Toolbar: plan type, paper, scale ──────────────────────────
  "Paper": "Papier",
  "Generic plan": "Allgemeiner Plan",
  "Loudspeaker plan": "Beschallungsplan",
  "Loudspeaker plans number symbols per amplifier line (4.1, 4.2 …) and carry the Beschallungsplan presets":
    "Beschallungspläne nummerieren die Symbole je Endstufenlinie (4.1, 4.2 …) und bringen die Voreinstellungen des Beschallungsplans mit",
  "Switch to a loudspeaker plan? Legend title, notes heading, revision headers and drawing block field labels are reset to that type's preset.":
    "Zum Beschallungsplan wechseln? Legendentitel, Hinweisüberschrift, Revisionsspalten und die Feldbeschriftungen im Schriftfeld werden auf die Voreinstellung dieses Typs zurückgesetzt.",
  "Switch to a generic plan? Legend title, notes heading, revision headers and drawing block field labels are reset to that type's preset.":
    "Zum allgemeinen Plan wechseln? Legendentitel, Hinweisüberschrift, Revisionsspalten und die Feldbeschriftungen im Schriftfeld werden auf die Voreinstellung dieses Typs zurückgesetzt.",
  "Drawing scale — 1:50 means 1 mm on paper is 50 mm on site":
    "Zeichnungsmaßstab — 1:50 heißt: 1 mm auf dem Papier sind 50 mm vor Ort",
  "Custom scale denominator": "Eigener Maßstabsnenner",
  "Drawing scale": "Zeichnungsmaßstab",

  // ─── Toolbar: underlay ─────────────────────────────────────────
  "Import an architect's drawing (PDF or image) as the underlay":
    "Eine Architektenzeichnung (PDF oder Bild) als Planhintergrund importieren",
  "Importing…": "Wird importiert…",
  "Import Plan…": "Plan importieren…",
  "Replace Plan…": "Plan ersetzen…",
  "How finely the PDF is rasterized, in dots per inch of the real sheet. Higher keeps room labels and dimension text readable when zoomed, at the cost of project size. Above roughly 300 dpi an A1 plan outgrows the browser autosave, so save the project to a file. The value shown is what was actually achieved — a big sheet caps it.":
    "Wie fein das PDF gerastert wird, in Punkten pro Zoll des realen Blatts. Höhere Werte halten Raumbeschriftungen und Maßtexte beim Zoomen lesbar, kosten aber Projektgröße. Ab etwa 300 dpi sprengt ein A1-Plan die automatische Browser-Sicherung — dann das Projekt in eine Datei speichern. Angezeigt wird der tatsächlich erreichte Wert; ein großes Blatt deckelt ihn.",
  "QUALITY": "QUALITÄT",
  "Layers of the source PDF — pick what gets drawn into the plan":
    "Ebenen des Quell-PDFs — auswählen, was in den Plan gezeichnet wird",
  "PDF layers": "PDF-Ebenen",
  "Ticking redraws the plan from the PDF, so the source file has to still be open in this session. The placement and the calibration stay as they are.":
    "Ein Häkchen zeichnet den Plan neu aus dem PDF — die Quelldatei muss in dieser Sitzung noch geöffnet sein. Platzierung und Kalibrierung bleiben erhalten.",
  "Underlay opacity": "Deckkraft des Planhintergrunds",
  "OPACITY": "DECKKRAFT",
  "Underlay is locked — click to unlock": "Planhintergrund ist gesperrt — zum Entsperren klicken",
  "Lock the underlay so it can't be dragged while placing symbols":
    "Den Planhintergrund sperren, damit er beim Setzen von Symbolen nicht verrutscht",
  "Locked": "Gesperrt",
  "Unlocked": "Entsperrt",
  "Lay the plan over the whole sheet again (edge to edge, aspect kept)":
    "Den Plan wieder über das ganze Blatt legen (randlos, Seitenverhältnis bleibt)",
  "Fill Sheet": "Blatt füllen",
  "Click two points a known distance apart, then enter that distance":
    "Zwei Punkte mit bekanntem Abstand anklicken, dann diesen Abstand eintragen",
  "Calibrate": "Kalibrieren",
  "Real-world size of one pixel of the imported drawing":
    "Reale Größe eines Pixels der importierten Zeichnung",
  "not calibrated": "nicht kalibriert",
  "Remove the underlay? Symbols stay where they are.":
    "Planhintergrund entfernen? Die Symbole bleiben, wo sie sind.",

  // ─── Toolbar: symbol size, sheet, export ───────────────────────
  "Symbol diameter on paper (mm)": "Symboldurchmesser auf dem Papier (mm)",
  "SYMBOL": "SYMBOL",
  "Height of the number next to a symbol on paper (mm)":
    "Höhe der Nummer neben einem Symbol auf dem Papier (mm)",
  "LABEL": "BESCHRIFTUNG",
  "Export PDF": "PDF exportieren",

  // ─── Toolbar: import toasts ────────────────────────────────────
  "The plan is too large to keep in the browser (over {mb} MB). Changing its page, layers or resolution will need a re-import after a reload.":
    "Der Plan ist zu groß, um im Browser gehalten zu werden (über {mb} MB). Seite, Ebenen oder Auflösung zu ändern verlangt nach einem Neuladen einen erneuten Import.",
  "Rasterized at {actual} dpi — {wanted} dpi would need a bigger image than the browser can build for this sheet size.":
    "Mit {actual} dpi gerastert — {wanted} dpi bräuchten ein größeres Bild, als der Browser für dieses Blattformat bauen kann.",
  "The plan is {mb} MB — autosave to browser storage may fail. Save the project to a file.":
    "Der Plan hat {mb} MB — die automatische Sicherung im Browser kann fehlschlagen. Das Projekt in eine Datei speichern.",
  "Plan imported — the sheet now has the plan's format. Calibrate it against a known dimension next.":
    "Plan importiert — das Blatt hat jetzt das Format des Plans. Als Nächstes an einem bekannten Maß kalibrieren.",
  "Plan imported — calibrate it against a known dimension next.":
    "Plan importiert — als Nächstes an einem bekannten Maß kalibrieren.",
  "Could not import that file.": "Diese Datei ließ sich nicht importieren.",
  "Re-import the PDF to change this — its source file isn't available any more.":
    "Das PDF erneut importieren, um das zu ändern — die Quelldatei steht nicht mehr zur Verfügung.",

  // ─── Sidebar (left): what is on the plan ───────────────────────
  "Plan": "Plan",
  "Collapse": "Einklappen",
  "Show what is on the plan and the devices to place":
    "Anzeigen, was auf dem Plan liegt und welche Geräte noch zu setzen sind",
  "Search plan and devices…": "Plan und Geräte durchsuchen…",
  "On the plan ({n})": "Auf dem Plan ({n})",
  "Nothing placed yet. Drag a device from the list below onto the sheet, or use the Place tool.":
    "Noch nichts gesetzt. Ein Gerät aus der Liste unten auf das Blatt ziehen oder das Werkzeug Setzen benutzen.",
  "No symbol matches the search.": "Kein Symbol passt zur Suche.",
  "group switched off": "Gruppe ausgeschaltet",
  "Its group is switched off — not on the sheet, not in the export":
    "Seine Gruppe ist ausgeschaltet — weder auf dem Blatt noch im Export",
  "hidden": "ausgeblendet",
  "Devices — drag onto the plan": "Geräte — auf den Plan ziehen",
  "No devices on the schematic yet.": "Noch keine Geräte im Schaltplan.",
  "Already on this plan as {label} — drag to place a second symbol":
    "Schon auf diesem Plan als {label} — ziehen, um ein zweites Symbol zu setzen",

  // ─── Sheet: tools, calibration, empty state ────────────────────
  "Select and move (Esc)": "Auswählen und verschieben (Esc)",
  "Click the plan to drop symbols of the active group":
    "In den Plan klicken, um Symbole der aktiven Gruppe zu setzen",
  "Place": "Setzen",
  "Click the plan to add a text note (installation hint, remark)":
    "In den Plan klicken, um einen Texthinweis zu setzen (Montagehinweis, Bemerkung)",
  "Drag a white cover over part of the architect's plan to take it out (legend, notes, title block)":
    "Eine weiße Abdeckung über einen Teil des Architektenplans ziehen, um ihn verschwinden zu lassen (Legende, Hinweise, Schriftfeld)",
  "Erase": "Abdecken",
  "Fit": "Einpassen",
  "Add a symbol group first — it defines the color and legend row.":
    "Zuerst eine Symbolgruppe anlegen — sie bestimmt Farbe und Legendenzeile.",
  "Enter the real distance in metres.": "Den realen Abstand in Metern eintragen.",
  "Plan calibrated at {scale}.": "Plan auf {scale} kalibriert.",
  "Could not calibrate from those two points.": "Aus diesen beiden Punkten ließ sich nicht kalibrieren.",
  "Click the first end of a known dimension on the plan.":
    "Das erste Ende eines bekannten Maßes im Plan anklicken.",
  "Click the other end.": "Das andere Ende anklicken.",
  "That distance is": "Dieser Abstand beträgt",
  "Floorplan underlay": "Planhintergrund des Grundrisses",
  "Resize the underlay (aspect locked)": "Planhintergrund skalieren (Seitenverhältnis fest)",
  "Cover — hides the underlay beneath it. Drag to move, corner to resize, Delete to remove.":
    "Abdeckung — verdeckt den Planhintergrund darunter. Ziehen zum Verschieben, Ecke zum Skalieren, Entf zum Entfernen.",
  "Resize the legend box": "Breite des Legendenkastens ändern",
  "Stretch the legend box downwards (to cover what lies beneath)":
    "Den Legendenkasten nach unten ziehen (um zu verdecken, was darunter liegt)",
  "Change the note's wrap width": "Umbruchbreite des Hinweises ändern",
  "Resize the drawing block": "Breite des Schriftfelds ändern",
  "Stretch the drawing block downwards (the title band grows)":
    "Das Schriftfeld nach unten ziehen (das Titelband wächst mit)",
  "Import the architect's drawing from the toolbar, then drag devices onto it.":
    "Die Architektenzeichnung über die Werkzeugleiste importieren, dann Geräte darauf ziehen.",

  // ─── Legend on the sheet ───────────────────────────────────────
  "Amplifier · channel": "Endstufe · Kanal",
  "Load": "Last",

  // ─── Options panel (right): frame ──────────────────────────────
  "Plan options": "Planoptionen",
  "Plan options — lines, legend, drawing block, notes":
    "Planoptionen — Linien, Legende, Schriftfeld, Hinweise",

  // ─── Selected symbol ───────────────────────────────────────────
  "Selected symbol": "Ausgewähltes Symbol",
  "{n} symbols selected": "{n} Symbole ausgewählt",
  "no device linked": "kein Gerät verknüpft",
  "Number": "Nummer",
  "The number printed next to the symbol": "Die Nummer, die neben dem Symbol gedruckt wird",
  "The group decides how the symbol is drawn and which legend row it belongs to. Moving it here changes the symbol.":
    "Die Gruppe bestimmt, wie das Symbol gezeichnet wird und zu welcher Legendenzeile es gehört. Ein Wechsel hier ändert das Symbol.",
  "— mixed —": "— gemischt —",
  "(unnamed)": "(ohne Namen)",
  "Amplifier line this speaker hangs on. Renumbering happens from the Lines section.":
    "Endstufenlinie, an der dieser Lautsprecher hängt. Neu nummeriert wird im Abschnitt Linien.",
  "e.g. 4": "z. B. 4",
  "Turn": "Drehen",
  "Turn the symbol; the number beside it stays upright.":
    "Das Symbol drehen; die Nummer daneben bleibt aufrecht.",
  "Turn 45° counter-clockwise": "45° gegen den Uhrzeigersinn drehen",
  "Turn 45° clockwise": "45° im Uhrzeigersinn drehen",
  "Symbol rotation in degrees clockwise": "Symboldrehung in Grad im Uhrzeigersinn",
  "Put the number {dir} of the symbol": "Die Nummer {dir} vom Symbol setzen",
  "Number rotation in degrees (clockwise)": "Drehung der Nummer in Grad (im Uhrzeigersinn)",
  "Reset the turn and the number placement": "Drehung und Platzierung der Nummer zurücksetzen",
  "Apply to": "Übernehmen für",
  "Copy this turn and number placement to every symbol on line {line}":
    "Diese Drehung und Nummernplatzierung auf jedes Symbol der Linie {line} übertragen",
  "line": "Linie",
  "Copy this turn and number placement to every symbol of the group":
    "Diese Drehung und Nummernplatzierung auf jedes Symbol der Gruppe übertragen",
  "group": "Gruppe",
  "Note for this symbol (appears in the plan schedule)":
    "Hinweis zu diesem Symbol (erscheint in der Planliste)",
  "Its layer is switched off.": "Seine Ebene ist ausgeschaltet.",
  "Draw this group again": "Diese Gruppe wieder zeichnen",
  "Open this group below to change the shape, the color or the uploaded picture — that applies to every symbol of the group":
    "Diese Gruppe unten öffnen, um Form, Farbe oder das hochgeladene Bild zu ändern — das gilt für jedes Symbol der Gruppe",
  "Edit symbol…": "Symbol bearbeiten…",
  "Remove from the plan": "Vom Plan entfernen",

  // ─── Symbol groups ─────────────────────────────────────────────
  "Symbol Groups": "Symbolgruppen",
  "Add a symbol group": "Eine Symbolgruppe hinzufügen",
  "A group is one legend row — a color, a shape and the model it stands for. Add one, then drag devices onto the plan.":
    "Eine Gruppe ist eine Legendenzeile — eine Farbe, eine Form und das Modell, für das sie steht. Eine anlegen, dann Geräte auf den Plan ziehen.",
  "Make this the active group for placing symbols":
    "Diese Gruppe zur aktiven Gruppe für das Setzen von Symbolen machen",
  "Symbols on this plan": "Symbole auf diesem Plan",
  "Switched off — click to draw it again": "Ausgeschaltet — klicken, um sie wieder zu zeichnen",
  "On the sheet — click to switch this layer off":
    "Auf dem Blatt — klicken, um diese Ebene auszuschalten",
  "Edit group": "Gruppe bearbeiten",
  "Legend title, e.g. Ceiling speakers": "Legendentitel, z. B. Deckenlautsprecher",
  "Model | cable spec": "Modell | Kabeltyp",
  "Symbol color": "Symbolfarbe",
  "Symbol shape — abstract or a top-view pictogram":
    "Symbolform — abstrakt oder Piktogramm in der Draufsicht",
  "An uploaded symbol carries no glyph — the picture is the symbol":
    "Ein hochgeladenes Symbol trägt kein Zeichen — das Bild ist das Symbol",
  "Up to two characters drawn inside the symbol": "Bis zu zwei Zeichen im Symbol",
  "Outline": "Kontur",
  "Outline color around the symbol body": "Konturfarbe um den Symbolkörper",
  "Outline thickness on paper in mm. 0 draws no outline.":
    "Konturstärke auf dem Papier in mm. 0 zeichnet keine Kontur.",
  "Back to the default outline": "Zurück zur Standardkontur",
  "Upload your own symbol (PNG, JPG, WebP or SVG). It replaces the shape, the color and the glyph, and prints on the plan and in the legend.":
    "Ein eigenes Symbol hochladen (PNG, JPG, WebP oder SVG). Es ersetzt Form, Farbe und Zeichen und wird im Plan und in der Legende gedruckt.",
  "Upload symbol…": "Symbol hochladen…",
  "Replace symbol…": "Symbol ersetzen…",
  "Back to the drawn shape": "Zurück zur gezeichneten Form",
  "Direction new symbols of this group start at, in degrees clockwise. Turn a placed symbol with the Symbol control on the sheet.":
    "Ausrichtung, mit der neue Symbole dieser Gruppe starten, in Grad im Uhrzeigersinn. Ein gesetztes Symbol wird über die Symbolangaben auf dem Blatt gedreht.",
  "No. prefix": "Nummernpräfix",
  "Seed for auto-numbering, e.g. “SB.” or “4.1”":
    "Startwert der automatischen Nummerierung, z. B. „SB.“ oder „4.1“",
  "Upload a product shot (stored in the project, always printed)":
    "Ein Produktbild hochladen (im Projekt gespeichert, wird immer gedruckt)",
  "Upload image…": "Bild hochladen…",
  "Replace image": "Bild ersetzen",
  "Use the device template's image": "Das Bild der Gerätevorlage verwenden",
  "Template image": "Vorlagenbild",
  "Remove image": "Bild entfernen",
  "Image URL (template today, Odoo product later)": "Bild-URL (heute Vorlage, später Odoo-Produkt)",
  "A remote image reference. Shown on screen; the PDF embeds it when the host allows — an uploaded image always wins.":
    "Ein Verweis auf ein externes Bild. Am Bildschirm sichtbar; das PDF bettet es ein, wenn der Server es zulässt — ein hochgeladenes Bild gewinnt immer.",
  "Image caption, e.g. DM6SE": "Bildunterschrift, z. B. DM6SE",
  "Show in legend": "In der Legende zeigen",
  "Renumber": "Neu nummerieren",
  "Renumber this group starting at:": "Diese Gruppe neu nummerieren, beginnend bei:",
  "Renumber every symbol of this group in placement order":
    "Jedes Symbol dieser Gruppe in der Reihenfolge des Setzens neu nummerieren",
  "Delete “{group}” and its 1 symbol on this plan?":
    "„{group}“ mit 1 Symbol auf diesem Plan löschen?",
  "Delete “{group}” and its {n} symbols on this plan?":
    "„{group}“ mit {n} Symbolen auf diesem Plan löschen?",

  // ─── Numbering ─────────────────────────────────────────────────
  "Numbering": "Nummerierung",
  "Amplifier line / circuit the next symbols hang on. Speakers are numbered per line: 4.1, 4.2 …":
    "Endstufenlinie / Stromkreis, an der die nächsten Symbole hängen. Lautsprecher werden je Linie nummeriert: 4.1, 4.2 …",
  "e.g. 4 or SB": "z. B. 4 oder SB",
  "optional": "optional",
  "How labels are composed: {{line}}, {{n}}, {{group}}, {{device}}":
    "Wie Beschriftungen gebildet werden: {{line}}, {{n}}, {{group}}, {{device}}",
  "Leave the line empty to continue each group's own numbering (1.1 → 1.2). Set a line to number per amplifier line instead.":
    "Die Linie leer lassen, um die eigene Nummerierung jeder Gruppe fortzuführen (1.1 → 1.2). Mit einer Linie wird stattdessen je Endstufenlinie nummeriert.",

  // ─── Lines & load ──────────────────────────────────────────────
  "Lines & load": "Linien & Last",
  "Read the amplifier channels off the schematic: one line per channel with speakers, placed symbols moved onto their channel's line":
    "Die Endstufenkanäle aus dem Schaltplan lesen: eine Linie je Kanal mit Lautsprechern, gesetzte Symbole wandern auf die Linie ihres Kanals",
  "Sync from schematic": "Aus dem Schaltplan übernehmen",
  "No lines yet. Drop speakers that are wired to an amplifier on the schematic — they take their channel's line automatically on a loudspeaker plan — or press Sync.":
    "Noch keine Linien. Lautsprecher setzen, die im Schaltplan an einer Endstufe hängen — im Beschallungsplan übernehmen sie die Linie ihres Kanals automatisch — oder die Übernahme anstoßen.",
  "No amplifier with speaker-level outputs on the schematic.":
    "Keine Endstufe mit Lautsprecherausgängen im Schaltplan.",
  "Lines already match the schematic.": "Die Linien stimmen bereits mit dem Schaltplan überein.",
  "1 line added": "1 Linie hinzugefügt",
  "{n} lines added": "{n} Linien hinzugefügt",
  "1 symbol renumbered": "1 Symbol neu nummeriert",
  "{n} symbols renumbered": "{n} Symbole neu nummeriert",
  "Burst pool {burst} of {maxBurst} · average {avg} of {maxAvg}":
    "Burst-Reserve {burst} von {maxBurst} · Durchschnitt {avg} von {maxAvg}",
  "No amplifier load data on the template — open the device and fill in its ratings":
    "Keine Lastdaten der Endstufe in der Vorlage — das Gerät öffnen und seine Kennwerte eintragen",
  "Make this the active line for the next symbols":
    "Diese Linie zur aktiven Linie für die nächsten Symbole machen",
  "{n} placed": "{n} gesetzt",
  "{n} wired": "{n} verdrahtet",
  "{n} without load data": "{n} ohne Lastdaten",
  "Wiring, mode and load": "Verdrahtung, Betriebsart und Last",
  "not wired to an amplifier channel": "nicht mit einem Endstufenkanal verdrahtet",
  "Renaming the line relabels its symbols": "Die Linie umzubenennen beschriftet ihre Symbole neu",
  "Channel": "Kanal",
  "Amplifier channel feeding this line (speaker-level output on the schematic)":
    "Endstufenkanal, der diese Linie speist (Lautsprecherausgang im Schaltplan)",
  "— not wired —": "— nicht verdrahtet —",
  "Mode": "Betriebsart",
  "Low impedance or 70 V / 100 V constant-voltage line":
    "Niederohmig oder 70-V-/100-V-Konstantspannungslinie",
  "(amp: n/a)": "(Endstufe: n. v.)",
  "Tap": "Abgriff",
  "max ({w} W)": "max. ({w} W)",
  "W per speaker": "W je Lautsprecher",
  "Transformer tap per speaker in watts; empty = each speaker's highest tap":
    "Übertragerabgriff je Lautsprecher in Watt; leer = der höchste Abgriff jedes Lautsprechers",
  "e.g. Terrasse": "z. B. Terrasse",
  "Printed in the legend's line table": "Wird in der Linientabelle der Legende gedruckt",
  "Amp limits: {perCh}/ch · Σ {total} burst · {v} V / {a} A peak · min {z}":
    "Grenzwerte der Endstufe: {perCh}/Kanal · Σ {total} Burst · {v} V / {a} A Spitze · min. {z}",
  "The amplifier has no load data — fill in its ratings on the device (Load section) to get a verdict.":
    "Die Endstufe hat keine Lastdaten — die Kennwerte am Gerät (Abschnitt Last) eintragen, um eine Bewertung zu erhalten.",
  "Renumber this line 1…n in placement order":
    "Diese Linie in der Reihenfolge des Setzens von 1…n neu nummerieren",
  "Drop the wiring / mode of this line; its symbols keep their numbers":
    "Verdrahtung und Betriebsart dieser Linie verwerfen; ihre Symbole behalten die Nummern",
  "Forget wiring": "Verdrahtung verwerfen",

  // ─── Legend box ────────────────────────────────────────────────
  "Legend Box": "Legendenkasten",
  "Show legend on the sheet": "Legende auf dem Blatt zeigen",
  "Legend title": "Legendentitel",
  "Product images": "Produktbilder",
  "Only groups used on this plan": "Nur Gruppen, die auf diesem Plan vorkommen",
  "Logo, name, address and contact from Preferences → Company":
    "Logo, Name, Anschrift und Kontakt aus Einstellungen → Firma",
  "Company block (logo, address)": "Firmenblock (Logo, Anschrift)",
  "Print the line table (line → amplifier channel, quantity, load) under the legend rows":
    "Die Linientabelle (Linie → Endstufenkanal, Menge, Last) unter den Legendenzeilen drucken",
  "Show line table": "Linientabelle zeigen",
  "Heading of the line table": "Überschrift der Linientabelle",
  "Notes heading": "Überschrift der Hinweise",
  "One installation note per line": "Ein Montagehinweis je Zeile",

  // ─── Drawing block (Schriftfeld) ───────────────────────────────
  "Drawing Block": "Schriftfeld",
  "Show drawing block on the sheet": "Schriftfeld auf dem Blatt zeigen",
  "Drawing title, e.g. Ground floor": "Plantitel, z. B. Erdgeschoss",
  "Tokens: {{pageLabel}}, {{showName}}, {{scale}} …":
    "Platzhalter: {{pageLabel}}, {{showName}}, {{scale}} …",
  "Subtitle, e.g. Loudspeaker layout": "Untertitel, z. B. Lautsprecheranordnung",
  "Fields": "Felder",
  "Field": "Feld",
  "Value or {{token}}": "Wert oder {{token}}",
  "Multi-line values (addresses) wrap onto several lines in the block":
    "Mehrzeilige Werte (Anschriften) laufen im Schriftfeld über mehrere Zeilen",
  "Span both columns": "Über beide Spalten",
  "Remove field": "Feld entfernen",
  "Tokens: {tokens} — resolved from the project title block and the page.":
    "Platzhalter: {tokens} — werden aus dem Schriftfeld des Projekts und der Seite aufgelöst.",
  "Revisions": "Revisionen",
  "Revision": "Revision",
  "Column header": "Spaltenkopf",
  "Index": "Index",
  "By": "Von",
  "Drawn by": "Gezeichnet von",
  "Chk": "Gepr.",
  "Checked by": "Geprüft von",
  "Remove revision": "Revision entfernen",
  "Small print above the title, e.g. “All dimensions to be verified on site …”":
    "Kleingedrucktes über dem Titel, z. B. „Alle Maße sind vor Ort zu prüfen …“",
  "Logo": "Logo",
  "North arrow": "Nordpfeil",
  "North arrow rotation (° clockwise)": "Drehung des Nordpfeils (° im Uhrzeigersinn)",

  // ─── Covers (erased areas) ─────────────────────────────────────
  "Erased areas ({n})": "Abgedeckte Bereiche ({n})",
  "White covers over the architect's plan — use": "Weiße Abdeckungen über dem Architektenplan — mit",
  "on the sheet to drag one out over a legend, a note or a title block you want gone. Drag to move, corner to resize,":
    "auf dem Blatt eine über eine Legende, einen Hinweis oder ein Schriftfeld ziehen, das verschwinden soll. Ziehen zum Verschieben, Ecke zum Skalieren,",
  "Delete::key": "Entf",
  "to remove. Turn one when the block underneath is not square to the sheet, and fade it to quiet the linework instead of erasing it.":
    "zum Entfernen. Eine Abdeckung drehen, wenn der Block darunter nicht parallel zum Blatt liegt, und abschwächen, um die Linien zu beruhigen statt sie zu tilgen.",
  "Cover {n}": "Abdeckung {n}",
  "Remove cover": "Abdeckung entfernen",
  "Turn 15° counter-clockwise": "15° gegen den Uhrzeigersinn drehen",
  "Turn 15° clockwise": "15° im Uhrzeigersinn drehen",
  "Rotation in degrees clockwise — an architect's title block is not always square to the sheet. Resize the cover before turning it: the corner handle measures in the cover's unturned frame.":
    "Drehung in Grad im Uhrzeigersinn — das Schriftfeld eines Architekten liegt nicht immer parallel zum Blatt. Die Abdeckung vor dem Drehen skalieren: der Eckgriff misst im ungedrehten Rahmen der Abdeckung.",
  "Below 1 the cover fades what is underneath instead of erasing it — a way to quiet the architect's linework without losing it.":
    "Unter 1 schwächt die Abdeckung ab, was darunter liegt, statt es zu tilgen — so lassen sich die Linien des Architekten beruhigen, ohne sie zu verlieren.",
  "Opacity": "Deckkraft",

  // ─── Notes on the plan ─────────────────────────────────────────
  "Notes on the plan ({n})": "Hinweise auf dem Plan ({n})",
  "Adds a note at the sheet center — or use the ✎ Note tool to click it into place":
    "Setzt einen Hinweis in die Blattmitte — oder mit dem Werkzeug ✎ Notiz an die gewünschte Stelle klicken",
  "Font size (mm)": "Schriftgröße (mm)",
  "Text color": "Textfarbe",
  "Box": "Rahmen",
  "Delete note": "Hinweis löschen",

  // ─── Symbol shapes (FLOORPLAN_SYMBOL_SHAPE_LABELS) ─────────────
  "Circle": "Kreis",
  "Square": "Quadrat",
  "Triangle": "Dreieck",
  "Diamond": "Raute",
  "Projector (top view)": "Projektor (Draufsicht)",
  "Rack (top view)": "Rack (Draufsicht)",
  "Display (top view)": "Display (Draufsicht)",
  "Camera (top view)": "Kamera (Draufsicht)",

  // ─── Load verdicts (LOAD_STATUS_LABELS / LOAD_LIMITER_LABELS) ──
  "Nearing limit": "Nahe am Limit",
  "Exceeds": "Überschritten",
  "No speakers": "Keine Lautsprecher",
  "No load data": "Keine Lastdaten",
  "Mode not supported": "Betriebsart nicht unterstützt",
  "peak voltage": "Spitzenspannung",
  "peak current": "Spitzenstrom",
  "channel power": "Kanalleistung",
  "shared power": "gemeinsame Leistung",
  "70/100 V total": "70/100 V gesamt",
  "average power": "Durchschnittsleistung",
  "minimum impedance": "Mindestimpedanz",
  "operating mode": "Betriebsart",

  // Covers (the white patches over the architect's own boxes) and their menu
  "Cover": "Abdeckung",
  "Cover — hides the underlay beneath it. Drag to move, corner to resize, Delete to remove. Right-click for turn, fade and lock.":
    "Abdeckung — verdeckt den Plan darunter. Ziehen zum Verschieben, Ecke zum Ändern der Größe, Entf zum Entfernen. Rechtsklick für Drehen, Transparenz und Sperren.",
  "Cover (locked) — right-click to turn, fade or unlock it.":
    "Abdeckung (gesperrt) — Rechtsklick zum Drehen, Faden oder Entsperren.",
  "15° clockwise": "15° im Uhrzeigersinn",
  "15° counter-clockwise": "15° gegen den Uhrzeigersinn",
  "Square to the sheet again": "Wieder im Winkel zum Blatt",
  "Fade": "Transparenz",
  "Opaque — erases what is under it": "Deckend — löscht, was darunter liegt",
  "Lock in place": "An Ort und Stelle sperren",
  "Unlock": "Entsperren",
  "Pin it, so placing symbols on top of it cannot nudge it. It stays editable from here.":
    "Festsetzen, damit das Platzieren von Symbolen darüber sie nicht verschiebt. Bearbeiten geht weiterhin von hier.",
  "Let it be dragged and resized again.": "Wieder verschiebbar und in der Größe änderbar machen.",
  "Locked — click to let it be dragged again": "Gesperrt — klicken, um sie wieder verschiebbar zu machen",
  "Lock it so placing symbols cannot nudge it": "Sperren, damit das Platzieren von Symbolen sie nicht verschiebt",

  // ─── Abdeckungsbereiche (Kameras, Melder) ──────────────────────
  "Coverage": "Abdeckung",
  "Coverage areas ({n})": "Abdeckungsbereiche ({n})",
  "Selected coverage": "Ausgewählte Abdeckung",
  "Click the plan to drop a detection area — what a camera sees, what a motion detector reaches. Drag its edge to aim it.":
    "In den Plan klicken, um einen Erfassungsbereich zu setzen — was eine Kamera sieht, was ein Bewegungsmelder erreicht. Am Rand ziehen, um ihn auszurichten.",
  "Drag to set range and direction": "Reichweite und Richtung ziehen",
  "Remove coverage": "Abdeckung entfernen",
  "Add a coverage area": "Abdeckungsbereich hinzufügen",
  "Add a coverage area to each": "Je Symbol einen Abdeckungsbereich hinzufügen",
  "Draw what the device covers — a camera's field of view, a detector's reach. Adjust the reach and the angle in the panel on the right.":
    "Zeichnet, was das Gerät abdeckt — das Blickfeld einer Kamera, die Reichweite eines Melders. Reichweite und Winkel rechts im Panel einstellen.",
  "Draw what this device covers — a camera's field of view, a detector's reach. It follows the device and turns with it.":
    "Zeichnet, was dieses Gerät abdeckt — das Blickfeld einer Kamera, die Reichweite eines Melders. Der Bereich folgt dem Gerät und dreht mit.",

  // Formen
  "Sector": "Sektor",
  "Corridor": "Korridor",
  "Sector — detector or lens wedge": "Sektor — Melder- oder Objektivkeil",
  "Circle — all-round, ceiling mounted": "Kreis — Rundumsicht, Deckenmontage",
  "Corridor — rectangular field": "Korridor — rechteckiges Feld",

  // Maße und Ausrichtung
  "Range": "Reichweite",
  "Reach on site, in metres — the number off the datasheet. It is converted through the drawing scale, so it stays true when the plan is re-scaled.":
    "Reichweite am Bau, in Metern — die Zahl aus dem Datenblatt. Sie wird über den Zeichnungsmaßstab umgerechnet und bleibt darum richtig, wenn der Plan umskaliert wird.",
  "Angle": "Winkel",
  "Opening angle": "Öffnungswinkel",
  "Opening angle — a wide-angle PIR's 90°, a lens's horizontal field of view. 360° covers the full circle.":
    "Öffnungswinkel — die 90° eines Weitwinkel-PIR, das horizontale Blickfeld eines Objektivs. 360° deckt den Vollkreis ab.",
  "Width": "Breite",
  "How wide the corridor is, in metres on site.": "Wie breit der Korridor ist, in Metern am Bau.",
  "Facing": "Richtung",
  "Offset": "Versatz",
  "Direction the area faces, in degrees clockwise. 0° points to the right of the sheet.":
    "Richtung, in die der Bereich zeigt, in Grad im Uhrzeigersinn. 0° zeigt nach rechts auf dem Blatt.",
  "Offset on top of the device's own rotation — 0° means the area faces exactly where the device faces.":
    "Versatz zur Drehung des Geräts — bei 0° zeigt der Bereich genau dorthin, wohin das Gerät zeigt.",
  "Aim it with the device again": "Wieder mit dem Gerät ausrichten",
  "Drop the offset — the area then faces wherever the device faces.":
    "Versatz aufheben — der Bereich zeigt dann dorthin, wohin das Gerät zeigt.",

  // Darstellung
  "Caption": "Beschriftung",
  "e.g. BM 1": "z. B. BM 1",
  "Printed just past the area's far edge. Leave empty for an unlabelled area.":
    "Wird knapp hinter der Außenkante gedruckt. Leer lassen für einen Bereich ohne Beschriftung.",
  "Areas overlap constantly — two detectors on one room is normal. A light fill keeps the overlap readable.":
    "Bereiche überlappen ständig — zwei Melder auf einen Raum sind der Normalfall. Eine leichte Füllung hält die Überlappung lesbar.",
  "Back to the group's color": "Zurück zur Farbe der Gruppe",
  "Its own color, or the group's when left on automatic — that keeps the detector plan and the camera plan telling themselves apart.":
    "Eigene Farbe, oder die der Gruppe bei Automatik — so bleiben Melderplan und Kameraplan unterscheidbar.",
  "Draw the boundary line": "Umrisslinie zeichnen",
  "Show the boundary line": "Umrisslinie zeigen",
  "Hide the boundary line": "Umrisslinie ausblenden",

  // Ebenen, Sperren, Verknüpfung
  "Layer": "Ebene",
  "— always shown —": "— immer sichtbar —",
  "Filing the area under a group makes it switch off with that group's layer, so one drawing yields a detector sheet and a camera sheet.":
    "Einer Gruppe zugeordnet schaltet sich der Bereich mit deren Ebene ab — so werden aus einer Zeichnung ein Melderblatt und ein Kamerablatt.",
  "follows": "folgt",
  "free-standing": "freistehend",
  "on": "an",
  "Detach": "Lösen",
  "Detach from the device": "Vom Gerät lösen",
  "The area stays where it is but stops following the device.":
    "Der Bereich bleibt, wo er ist, folgt dem Gerät aber nicht mehr.",
  "Let it be dragged and aimed again.": "Wieder verschiebbar und ausrichtbar machen.",
  "Locked — click to let it be dragged and aimed again":
    "Gesperrt — klicken, um sie wieder verschieb- und ausrichtbar zu machen",
  "Lock it so placing symbols inside it cannot nudge it":
    "Sperren, damit das Platzieren von Symbolen darin sie nicht verschiebt",
  "Pin it, so placing symbols inside it cannot nudge it. It stays editable from here.":
    "Festsetzen, damit das Platzieren von Symbolen darin sie nicht verschiebt. Bearbeiten geht weiterhin von hier.",
  "Hide on this sheet": "Auf diesem Blatt ausblenden",
  "Hidden — click to draw it again": "Ausgeblendet — klicken, um sie wieder zu zeichnen",
  "Hide it on this sheet": "Auf diesem Blatt ausblenden",
  "Show again": "Wieder einblenden",

  // Erklärtext im Panel
  "What the cameras see and the detectors reach. Select a device above and hit":
    "Was die Kameras sehen und die Melder erreichen. Oben ein Gerät auswählen und",
  "to give it an area that follows and turns with it, or use":
    "drücken für einen Bereich, der mitfolgt und mitdreht, oder",
  "on the sheet for a free-standing one. Drag the dot on its far edge to aim it and set the reach; ranges are metres on site.":
    "auf dem Blatt für einen freistehenden. Den Punkt an der Außenkante ziehen, um Richtung und Reichweite zu setzen; Reichweiten sind Meter am Bau.",

  // ─── Kamera-Optik: Reichweite aus Objektiv und Sensor (DORI) ───
  "Camera — compute the reach from the lens": "Kamera — Reichweite aus dem Objektiv rechnen",
  "It is a camera — compute the reach": "Ist eine Kamera — Reichweite rechnen",
  "Not a camera — set the reach by hand": "Keine Kamera — Reichweite selbst setzen",
  "A camera has no range of its own — it has pixels spread over an angle. Switch this on and the reach is computed from the megapixels, the opening angle and the DORI level you need.":
    "Eine Kamera hat keine eigene Reichweite — sie hat Pixel, verteilt über einen Winkel. Eingeschaltet wird die Reichweite aus Megapixeln, Öffnungswinkel und der benötigten DORI-Stufe gerechnet.",
  "A camera has no range of its own: it has pixels spread over an angle. Computed from the megapixels, the opening angle and the level you need.":
    "Eine Kamera hat keine eigene Reichweite: sie hat Pixel, verteilt über einen Winkel. Gerechnet aus Megapixeln, Öffnungswinkel und der benötigten Stufe.",
  "Drag to aim it — the reach follows the lens": "Zum Ausrichten ziehen — die Reichweite folgt dem Objektiv",
  "Lens": "Objektiv",
  "Sensor": "Sensor",
  "Sensor resolution as the datasheet states it. More megapixels spread over the same angle reach further.":
    "Sensorauflösung wie im Datenblatt. Mehr Megapixel über denselben Winkel reichen weiter.",
  "Sensor aspect ratio — it decides how the megapixels split into width and height.":
    "Seitenverhältnis des Sensors — es entscheidet, wie sich die Megapixel auf Breite und Höhe verteilen.",
  "Purpose": "Zweck",
  "How much of the picture a person has to fill. Identify needs four times the pixel density of Observe, so it reaches half as far.":
    "Wie viel vom Bild eine Person ausfüllen muss. Identifizieren braucht die vierfache Pixeldichte von Beobachten und reicht darum halb so weit.",
  // DORI-Stufen nach EN 62676-4 — die deutschen Begriffe der Norm.
  "Detect": "Entdecken",
  "Observe": "Beobachten",
  "Recognise": "Erkennen",
  "Identify": "Identifizieren",
  "at": "bei",
  "{n} px/m at 5 m": "{n} px/m bei 5 m",
  "{n} px/m at 10 m": "{n} px/m bei 10 m",

  // Vorhandene Abdeckung öffnen statt eine zweite zu stapeln
  "Edit coverage": "Abdeckung bearbeiten",
  "Edit its coverage area": "Abdeckungsbereich bearbeiten",
  "Add another coverage area": "Weiteren Abdeckungsbereich hinzufügen",
  "Open the area this device already has. To give it a second one, right-click the symbol.":
    "Öffnet den Bereich, den dieses Gerät schon hat. Für einen zweiten: Rechtsklick auf das Symbol.",
  "Opens the area this device already has, in the panel on the right.":
    "Öffnet den vorhandenen Bereich rechts im Panel.",
  "A second area on the same device — a corridor lens beside a wide one, say.":
    "Ein zweiter Bereich am selben Gerät — etwa eine Vorhanglinse neben einer Weitwinkel-Erfassung.",
};
