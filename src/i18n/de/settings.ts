/**
 * German dictionary — the Preferences dialog (File > Preferences), including the
 * language switch itself.
 *
 * Kept apart from `preferences.ts` (the view/show panels) so the two can be
 * edited independently.
 */
export const DE_SETTINGS: Record<string, string> = {
  // ─── Tabs ──────────────────────────────────────────────────────
  "Canvas": "Zeichenfläche",
  "Display": "Darstellung",
  "Company": "Firma",
  "AI (Beta)": "KI (Beta)",

  // ─── Canvas › Navigation ───────────────────────────────────────
  "Navigation": "Navigation",
  "Left drag": "Ziehen mit links",
  "Shift + left drag": "Umschalt + Ziehen mit links",
  "Middle drag": "Ziehen mit der mittleren Taste",
  "Space + drag": "Leertaste + Ziehen",
  "Selection box": "Auswahlrahmen",
  "Pan canvas": "Ansicht verschieben",
  "Add to selection": "Zur Auswahl hinzufügen",

  // ─── Canvas › Scroll wheel & sensitivity ───────────────────────
  "Scroll Wheel": "Mausrad",
  "Scroll": "Scrollen",
  "Shift + Scroll": "Umschalt + Scrollen",
  "Ctrl + Scroll": "Strg + Scrollen",
  "Zoom": "Zoom",
  "Pan left / right": "Nach links / rechts",
  "Pan up / down": "Nach oben / unten",
  "Sensitivity": "Empfindlichkeit",
  "Zoom speed": "Zoomgeschwindigkeit",
  "Pan speed": "Verschiebegeschwindigkeit",
  "Trackpad": "Trackpad",
  "Auto-detect trackpad": "Trackpad automatisch erkennen",
  "When off, all scroll input uses the scroll wheel settings above":
    "Ist das aus, gelten für jede Scroll-Eingabe die Mausrad-Einstellungen oben.",

  // ─── Canvas › Edges & auto-route ───────────────────────────────
  "Edge Interaction": "Verbindungen anklicken",
  "Connection hitbox width": "Breite des Klickbereichs",
  "Smaller = easier to create new connections without selecting existing ones":
    "Schmaler heißt: neue Verbindungen ziehen, ohne bestehende zu treffen.",
  "When disabling auto-route": "Beim Abschalten des Auto-Routings",
  "Ask me": "Nachfragen",
  "Always keep routes": "Routen immer behalten",
  "Always restore previous": "Immer die vorherigen wiederherstellen",
  "Choose whether to keep auto-routed paths or revert to your previous routing":
    "Legt fest, ob automatisch verlegte Wege bleiben oder die vorherige Führung zurückkommt.",

  // ─── Display › Language ────────────────────────────────────────
  "Interface language": "Sprache der Oberfläche",
  "Applies to the whole editor and takes effect right away. Kept in this browser, so it survives a reload. Your own text — device names, room names, notes — is never translated.":
    "Gilt für den ganzen Editor und greift sofort. Wird in diesem Browser gespeichert und übersteht einen Neuladen. Eigene Texte — Gerätenamen, Raumnamen, Notizen — werden nie übersetzt.",

  // ─── Display › Labels ──────────────────────────────────────────
  "Labels": "Beschriftungen",
  "Display label case": "Schreibweise der Beschriftungen",
  "As-typed": "Wie eingegeben",
  "UPPERCASE": "GROSSBUCHSTABEN",
  "lowercase": "kleinbuchstaben",
  "Capitalize Words": "Wortanfänge Groß",
  "Display style for device, port, room, slot, and card labels on the canvas and in exports. Doesn't modify your data — switch back to As-typed any time to see original casing.":
    "Darstellung von Geräte-, Port-, Raum-, Slot- und Kartenbeschriftungen auf der Zeichenfläche und im Export. Die Daten selbst bleiben unangetastet — zurück auf „Wie eingegeben“ zeigt jederzeit die Originalschreibweise.",
  "Use short device names": "Kurze Gerätenamen verwenden",
  "Render device labels using a more compact identifier when available — curated short name first, then model number, falling back to the full label. Per-device override available in the device editor.":
    "Zeigt Geräte mit der kompakteren Bezeichnung, sofern vorhanden — zuerst der gepflegte Kurzname, dann die Modellnummer, sonst die volle Beschriftung. Pro Gerät im Geräteeditor überschreibbar.",
  "Wrap device labels": "Gerätebeschriftungen umbrechen",
  "Allow long device labels to wrap onto a second line on the schematic and rack views, instead of truncating with an ellipsis.":
    "Lange Gerätebeschriftungen dürfen im Schaltplan und in der Rackansicht auf eine zweite Zeile umbrechen, statt mit Auslassungspunkten abgeschnitten zu werden.",

  // ─── Display › Stub labels ─────────────────────────────────────
  "Stub labels": "Stub-Beschriftungen",
  "Show port name on stub labels": "Portname auf Stub-Beschriftungen",
  "Adds the destination port (e.g.": "Ergänzt den Zielport (z. B.",
  ") after the device name on stubbed connections.":
    ") hinter dem Gerätenamen bei gestubbten Verbindungen.",
  "Show room name on stub labels": "Raumname auf Stub-Beschriftungen",
  "Adds the destination room (e.g.": "Ergänzt den Zielraum (z. B.",
  ") after the device name on stubbed connections, when the far device is in a different room. A tag between two devices in the same room leaves the room off unless you right-click it and set Show room to On.":
    ") hinter dem Gerätenamen bei gestubbten Verbindungen, wenn das Gegengerät in einem anderen Raum steht. Zwischen zwei Geräten im selben Raum bleibt der Raum weg — außer die Beschriftung wird per Rechtsklick auf „Raum zeigen: Ein“ gestellt.",
  "Page number on stub labels": "Seitenzahl auf Stub-Beschriftungen",
  "Cross-page only": "Nur seitenübergreifend",
  "When to display the destination page on stub labels. Cross-page only suppresses the tag when both ends are on the same printed page.":
    "Wann die Zielseite auf Stub-Beschriftungen steht. „Nur seitenübergreifend“ lässt die Angabe weg, wenn beide Enden auf derselben Druckseite liegen.",

  // ─── Display › Project ─────────────────────────────────────────
  "Active (default)": "Aktiv (Standard)",
  "Dormant": "Ruhend",
  "Pending": "Ausstehend",
  "Lifecycle status for this project. Stored in the file and shown in project metadata.":
    "Bearbeitungsstand dieses Projekts. Wird in der Datei gespeichert und in den Projektdaten angezeigt.",

  // ─── Display › Costs ───────────────────────────────────────────
  "Costs": "Kosten",
  "Currency": "Währung",
  "USD — US Dollar ($)": "USD — US-Dollar ($)",
  "GBP — British Pound (£)": "GBP — Britisches Pfund (£)",
  "EUR — Euro (€)": "EUR — Euro (€)",
  "CAD — Canadian Dollar (CA$)": "CAD — Kanadischer Dollar (CA$)",
  "AUD — Australian Dollar (A$)": "AUD — Australischer Dollar (A$)",
  "JPY — Japanese Yen (¥)": "JPY — Japanischer Yen (¥)",
  "NZD — New Zealand Dollar (NZ$)": "NZD — Neuseeland-Dollar (NZ$)",
  "CHF — Swiss Franc (CHF)": "CHF — Schweizer Franken (CHF)",
  "SEK — Swedish Krona (kr)": "SEK — Schwedische Krone (kr)",
  "NOK — Norwegian Krone (kr)": "NOK — Norwegische Krone (kr)",
  "DKK — Danish Krone (kr.)": "DKK — Dänische Krone (kr.)",
  "CNY — Chinese Yuan (¥)": "CNY — Chinesischer Yuan (¥)",
  "INR — Indian Rupee (₹)": "INR — Indische Rupie (₹)",
  "AED — United Arab Emirates Dirham (د.إ)": "AED — VAE-Dirham (د.إ)",
  "Symbol used for cost fields in reports. All entered costs are assumed to be in this currency — no conversion is applied.":
    "Zeichen für die Kostenfelder in den Berichten. Alle eingetragenen Kosten gelten als in dieser Währung — es wird nicht umgerechnet.",

  // ─── Company ───────────────────────────────────────────────────
  "Planning company": "Planendes Unternehmen",
  "Printed at the foot of every floorplan legend and used for the drawing block's logo and the":
    "Steht unter jeder Grundriss-Legende, liefert das Logo fürs Schriftfeld und füllt die Platzhalter",
  "tokens. Saved in this browser and snapshotted into each project file.":
    ". Wird in diesem Browser gespeichert und in jede Projektdatei übernommen.",
  "Company name": "Firmenname",
  "Address (one line per row)": "Adresse (je Zeile ein Eintrag)",
  "Phone": "Telefon",
  "E-mail": "E-Mail",
  "Web": "Web",
  "Company logo": "Firmenlogo",
  "No logo": "Kein Logo",
  "Replace logo…": "Logo ersetzen…",
  "Upload logo…": "Logo hochladen…",

  // ─── AI (Beta) ─────────────────────────────────────────────────
  "AI Assistant (MCP) — Beta": "KI-Assistent (MCP) — Beta",
  "Let Claude read & edit this schematic": "Claude diesen Schaltplan lesen und bearbeiten lassen",
  "Connects this tab to the EasySchematic MCP server running on your computer, so an AI assistant (Claude) can add devices, set properties, and make connections live. Off by default; your drawing is only reachable while this is on.":
    "Verbindet diesen Tab mit dem EasySchematic-MCP-Server auf dem eigenen Rechner, damit ein KI-Assistent (Claude) live Geräte anlegen, Eigenschaften setzen und Verbindungen ziehen kann. Standardmäßig aus; die Zeichnung ist nur erreichbar, solange das an ist.",
  "Pairing token": "Kopplungs-Token",
  "Paste from the server": "Aus dem Server einfügen",
  "Copy the token the MCP server prints on startup and paste it here. This stops other programs on your computer from reaching the bridge.":
    "Das Token, das der MCP-Server beim Start ausgibt, hier einfügen. Damit kommen andere Programme auf dem Rechner nicht an die Brücke.",
  "Server port": "Server-Port",
  "Connecting…": "Verbindung wird aufgebaut…",
  "Connected": "Verbunden",
  "Not connected": "Nicht verbunden",
  // Status details from the bridge (src/mcpBridge.ts) and reasons sent by the MCP server
  "Waiting for the browser’s permission to reach this computer…":
    "Wartet auf die Erlaubnis des Browsers, den eigenen Rechner zu erreichen…",
  "The browser blocks this page from reaching your computer. Allow “Local network access” in the site settings (icon left of the address), then reload.":
    "Der Browser lässt diese Seite nicht an den eigenen Rechner. In den Website-Einstellungen (Symbol links neben der Adresse) „Lokales Netzwerk“ erlauben und die Seite neu laden.",
  "Could not open a connection.": "Verbindung ließ sich nicht öffnen.",
  "Connection error — is the MCP server running?": "Verbindungsfehler — läuft der MCP-Server (Claude Desktop gestartet)?",
  "Reconnecting…": "Neuer Verbindungsversuch…",
  "Pairing refused.": "Kopplung abgelehnt.",
  "Invalid pairing token.": "Kopplungs-Token passt nicht.",
  "Protocol version mismatch — update the MCP server.": "Protokollversion passt nicht — MCP-Server aktualisieren.",
  "Another tab took the AI connection.": "Ein anderer Tab hat die KI-Verbindung übernommen.",
  "Another EasySchematic tab took the AI connection.": "Ein anderer Tab hat die KI-Verbindung übernommen.",
  "Setup help is in the docs under “AI Assistant (MCP)”. This is an early Beta — only a core set of actions is supported.":
    "Die Einrichtung steht in der Dokumentation unter „AI Assistant (MCP)“. Das ist eine frühe Beta — bisher wird nur ein Grundstock an Aktionen unterstützt.",

  // ─── FACE-Anmeldung (Odoo) ─────────────────────────────────────
  "Sign in with Odoo": "Mit Odoo anmelden",
  "Your drawings are stored on Odoo projects, with your Odoo rights.":
    "Zeichnungen liegen an Odoo-Projekten — es gelten deine Odoo-Rechte.",
  "Odoo e-mail": "Odoo-E-Mail",
  "Odoo API key": "Odoo-API-Schlüssel",
  "Not your password: create one in Odoo under your avatar → My Profile → Account Security → New API Key.":
    "Nicht das Passwort: in Odoo erstellen unter Avatar → Mein Profil → Kontosicherheit → Neuer API-Schlüssel.",
  "Enter your Odoo e-mail and API key.": "Odoo-E-Mail und API-Schlüssel eingeben.",
  "Sign-in failed.": "Anmeldung fehlgeschlagen.",
  "Sign-out failed.": "Abmelden fehlgeschlagen.",
  "Signing in…": "Anmelden…",
  "Sign in": "Anmelden",
  "Signed in with Odoo as {login}": "Mit Odoo angemeldet als {login}",

  // ─── Footer ────────────────────────────────────────────────────
  "Reset to defaults": "Auf Standard zurücksetzen",

  // ─── Upstream-Merge 2026-10 ───
  // Canvas › New Connections
  "New Connections": "Neue Verbindungen",
  "Draw new connections as": "Neue Verbindungen zeichnen als",
  "Wire": "Leitung",
  "Stub": "Stub",
  "Stub creates each new connection already stubbed at both ends, the same as right-clicking it and choosing Stub Connection. Existing connections are left alone, and connections through an auto-inserted adapter stay wires.":
    "„Stub“ legt jede neue Verbindung gleich an beiden Enden als Stub an — wie Rechtsklick darauf und „Als Stub darstellen“. Bestehende Verbindungen bleiben unberührt, und Verbindungen über einen automatisch eingefügten Adapter bleiben Leitungen.",

  // Display › Device header color
  "Device header color": "Kopfzeilenfarbe der Geräte",
  "Default for new devices": "Standard für neue Geräte",
  "Not set": "Nicht gesetzt",
  "Header bar color given to every device you place from here on, in this and every other project on this computer. Not set = the standard header color.":
    "Kopfzeilenfarbe für jedes Gerät, das ab jetzt platziert wird — in diesem und jedem anderen Projekt auf diesem Rechner. Nicht gesetzt = die Standard-Kopfzeilenfarbe.",
  "This is the device's header color everywhere it is drawn, not just on the canvas: it also overrides the device's own color in the rack elevation, the rack SVG and PDF, the face plate editor, and the DXF export. Set it and every new device shares one color in those views instead of being colored by device type — leave it unset, or clear a device's header color in the device editor, to keep that color coding.":
    "Das ist die Kopfzeilenfarbe des Geräts überall, wo es gezeichnet wird, nicht nur auf der Zeichenfläche: Die Farbe ersetzt auch die eigene Gerätefarbe in der Rackansicht, im Rack-SVG und -PDF, im Frontblenden-Editor und im DXF-Export. Ist sie gesetzt, teilen sich alle neuen Geräte in diesen Ansichten eine Farbe, statt nach Gerätetyp eingefärbt zu werden — wer diese Farbcodierung behalten will, lässt sie leer oder löscht die Kopfzeilenfarbe eines Geräts im Geräteeditor.",
  "This project only": "Nur dieses Projekt",
  "Overrides the default above for this schematic, and is saved in the schematic file so it travels with it. Devices already on the canvas keep their own colors either way — change one from the device editor's header color picker.":
    "Ersetzt den Standard oben für diesen Schaltplan und wird in der Schaltplandatei gespeichert, reist also mit. Geräte, die schon auf der Zeichenfläche liegen, behalten ihre Farben so oder so — einzelne über die Kopfzeilenfarbe im Geräteeditor ändern.",
  "New devices here get": "Neue Geräte bekommen hier",
  "{color} (this project)": "{color} (dieses Projekt)",
  "{color} (app default)": "{color} (App-Standard)",
  "the standard header color": "die Standard-Kopfzeilenfarbe",

  // Display › Stub labels
  "Show direction arrow on stub labels": "Richtungspfeil auf Stub-Beschriftungen",
  "Prefixes each stub label with an arrow pointing toward the far end (e.g.":
    "Stellt jeder Stub-Beschriftung einen Pfeil zur Gegenseite voran (z. B.",
  "). Off by default — the destination name already says where the connection goes.":
    "). Standardmäßig aus — der Zielname sagt schon, wohin die Verbindung führt.",
  "Tag text for new stubs": "Beschriftung neuer Stubs",
  "Use default": "Standard verwenden",
  "What both tags of a connection show when you stub it, in this and every other project on this computer. Destination names the far device; Cable ID only shows just the cable ID.":
    "Was beide Beschriftungen einer Verbindung zeigen, wenn sie als Stub dargestellt wird — in diesem und jedem anderen Projekt auf diesem Rechner. „Ziel“ nennt das Gegengerät, „Nur Kabel-ID“ zeigt allein die Kabel-ID.",
  "Overrides the default above for this schematic, and is saved in the schematic file. Stub tags already on the canvas keep their tag text either way; right-click a tag to switch it, and its partner tag at the other end switches with it.":
    "Ersetzt den Standard oben für diesen Schaltplan und wird in der Schaltplandatei gespeichert. Stub-Beschriftungen, die schon auf der Zeichenfläche liegen, behalten ihren Text so oder so; per Rechtsklick lässt sich eine umschalten, die Partner-Beschriftung am anderen Ende schaltet mit.",
};
