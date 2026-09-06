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
  "Display style for device, port, slot, and card labels on the canvas and in exports. Doesn't modify your data — switch back to As-typed any time to see original casing.":
    "Darstellung von Geräte-, Port-, Slot- und Kartenbeschriftungen auf der Zeichenfläche und im Export. Die Daten selbst bleiben unangetastet — zurück auf „Wie eingegeben“ zeigt jederzeit die Originalschreibweise.",
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
  ") after the device name on stubbed connections. Per-stub overrides via right-click on the label.":
    ") hinter dem Gerätenamen bei gestubbten Verbindungen. Pro Stub per Rechtsklick auf die Beschriftung anpassbar.",
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
  "Setup help is in the docs under “AI Assistant (MCP)”. This is an early Beta — only a core set of actions is supported.":
    "Die Einrichtung steht in der Dokumentation unter „AI Assistant (MCP)“. Das ist eine frühe Beta — bisher wird nur ein Grundstock an Aktionen unterstützt.",

  // ─── Footer ────────────────────────────────────────────────────
  "Reset to defaults": "Auf Standard zurücksetzen",
};
