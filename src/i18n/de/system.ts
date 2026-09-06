/** German dictionary — system surface. Keys are the English source strings.
 *
 * Everything the app says *about itself*: crash screen, mobile notice, sign-in,
 * the cloud schematic browser, both import wizards, template sync, connection
 * warnings, store toasts, and the API / underlay error messages that end up in a
 * toast. Words shared with the rest of the app (Cancel, Close, Open, Delete,
 * Rename, Update, Back, Next, Loading..., Ports, Manufacturer, Model) live in
 * common.ts and are deliberately absent here.
 */
export const DE_SYSTEM: Record<string, string> = {
  // "Change" as a button verb, not the revision-description noun.
  "Change::button": "Ändern",
  // ─── ErrorBoundary ─────────────────────────────────────────────
  "Something went wrong": "Etwas ist schiefgelaufen",
  "FACESchematic hit an unexpected error. Your schematic is saved in your browser and will be restored when you reload.":
    "In FACESchematic ist ein unerwarteter Fehler aufgetreten. Der Schaltplan ist im Browser gespeichert und wird beim Neuladen wiederhergestellt.",
  "Reload": "Neu laden",

  // ─── MobileGate ────────────────────────────────────────────────
  "FACESchematic is designed for desktop browsers.": "FACESchematic ist für Desktop-Browser gemacht.",
  "This tool works best with a keyboard, mouse, and a screen wide enough to see your signal flow. For the full experience, open this on a laptop or desktop.":
    "Das Werkzeug funktioniert am besten mit Tastatur, Maus und einem Bildschirm, der breit genug für den Signalfluss ist. Für den vollen Funktionsumfang am Laptop oder Desktop öffnen.",
  "Continue Anyway": "Trotzdem fortfahren",

  // ─── LandingPage (FACE-Branding bleibt unübersetzt) ─────────────
  "Open editor": "Editor öffnen",

  // ─── Anmeldung ─────────────────────────────────────────────────
  "Log in to submit": "Zum Einreichen anmelden",
  "Enter a valid email address": "Gültige E-Mail-Adresse eingeben",
  "Sign in with Google": "Mit Google anmelden",
  "or": "oder",
  "Send login link": "Anmeldelink schicken",
  "Sending...": "Wird verschickt...",
  "Failed to send login link": "Anmeldelink konnte nicht verschickt werden",
  "Check your email": "E-Mail prüfen",
  // Satzteile um die <strong>-Adresse herum — zusammen ergeben sie
  // „Anmeldelink verschickt an <adresse>. Zum Anmelden anklicken ...“
  "We sent a login link to": "Anmeldelink verschickt an",
  "Click it to log in, then come back here.": "Zum Anmelden anklicken und dann hierher zurückkommen.",
  "Don't see it? Check your spam folder. Some corporate email systems may block it":
    "Nichts angekommen? Spam-Ordner prüfen. Manche Firmen-Mailsysteme blockieren die Nachricht",
  "try Google sign-in instead": "stattdessen mit Google anmelden",

  // ─── Schaltplan-Browser (Cloud) ────────────────────────────────
  "My Schematics": "Meine Schaltpläne",
  "You're offline — showing cached schematics. Changes will sync when you reconnect.":
    "Offline — es werden zwischengespeicherte Schaltpläne gezeigt. Änderungen werden bei der nächsten Verbindung synchronisiert.",
  "No saved schematics yet. Use File → Save to Cloud to save your first schematic.":
    "Noch keine gespeicherten Schaltpläne. Über Datei → In der Cloud speichern den ersten Schaltplan sichern.",
  "No cached schematics available offline.": "Offline sind keine zwischengespeicherten Schaltpläne verfügbar.",
  "Shared": "Freigegeben",
  "New File Template": "Vorlage für neue Dateien",
  "Set as New File Template": "Als Vorlage für neue Dateien festlegen",
  "Remove as New File Template": "Nicht mehr als Vorlage für neue Dateien",
  "Not cached — open when online": "Nicht zwischengespeichert — online öffnen",
  "Requires internet connection": "Erfordert eine Internetverbindung",
  "Enable sharing": "Freigeben",
  "Disable sharing": "Freigabe aufheben",
  "Copy share link": "Freigabelink kopieren",
  'Delete "{name}"? This cannot be undone.': "„{name}“ löschen? Das lässt sich nicht rückgängig machen.",
  "Failed to load schematics": "Schaltpläne konnten nicht geladen werden",
  "Failed to open schematic": "Schaltplan konnte nicht geöffnet werden",
  "Failed to delete": "Löschen fehlgeschlagen",
  "Failed to rename": "Umbenennen fehlgeschlagen",
  "Failed to toggle sharing": "Freigabe konnte nicht umgeschaltet werden",
  "Failed to update template": "Vorlage konnte nicht aktualisiert werden",

  // ─── Import-Assistent: Kabelliste (CSV) ────────────────────────
  "Import Cable Schedule": "Kabelliste importieren",
  "Match Devices": "Geräte zuordnen",
  "Choose CSV File": "CSV-Datei wählen",
  "or paste below": "oder unten einfügen",
  "Paste CSV data here...": "CSV-Daten hier einfügen...",
  "Preview ({n} rows)": "Vorschau ({n} Zeilen)",
  "Column Mapping": "Spaltenzuordnung",
  "(ignore)": "(ignorieren)",
  "Source Device": "Quellgerät",
  "Source Port": "Quell-Port",
  "Dest Device": "Zielgerät",
  "Dest Port": "Ziel-Port",
  "Source Room": "Quellraum",
  "Dest Room": "Zielraum",
  "No data rows found. Make sure the first row contains headers.":
    "Keine Datenzeilen gefunden. Die erste Zeile muss die Spaltenüberschriften enthalten.",
  "Failed to parse CSV data.": "CSV-Daten konnten nicht gelesen werden.",
  "No valid connections found. Check your column mapping.":
    "Keine gültigen Verbindungen gefunden. Spaltenzuordnung prüfen.",
  "Device Matching": "Gerätezuordnung",
  "{matched}/{total} matched": "{matched}/{total} zugeordnet",
  "{n} connections": "{n} Verbindungen",
  "Generic": "Generisch",
  "Use Generic": "Generisch verwenden",
  "Generic device": "Generisches Gerät",
  "Search Template": "Vorlage suchen",
  "Search templates...": "Vorlagen suchen...",
  "{n} ports": "{n} Ports",
  "({in} in, {out} out)": "({in} Eingänge, {out} Ausgänge)",
  "Import {devices} devices, {connections} connections": "{devices} Geräte, {connections} Verbindungen importieren",

  // ─── Import-Assistent: Geräte (JSON/CSV) ───────────────────────
  "Import Devices": "Geräte importieren",
  // Fünf Fragmente um zwei Links herum — zusammen ergeben sie einen Satz.
  "Bulk-add device templates to your library. See the":
    "Gerätevorlagen gesammelt zur eigenen Bibliothek hinzufügen. Beispieldateien und Anleitungen stehen im",
  "import guide": "Import-Leitfaden",
  "for sample files and walkthroughs, or the": "— nachschlagen lässt sich jedes Feld in der",
  "schema reference": "Schema-Referenz",
  "for the full field list.": "der Gerätevorlagen.",
  "Upload JSON file": "JSON-Datei hochladen",
  "Upload CSV file": "CSV-Datei hochladen",
  "Load sample": "Beispiel laden",
  "Or paste below": "Oder unten einfügen",
  "Paste device JSON here…": "Geräte-JSON hier einfügen…",
  "Paste CSV here…": "CSV hier einfügen…",
  "Could not parse:": "Konnte nicht gelesen werden:",
  "1 template parsed": "1 Vorlage gelesen",
  "{n} templates parsed": "{n} Vorlagen gelesen",
  "{n} valid": "{n} gültig",
  "{n} with errors": "{n} mit Fehlern",
  "(no label)": "(keine Beschriftung)",
  "+ {n} more": "+ {n} weitere",
  "Submitter note (optional, used if you submit to community)":
    "Notiz zur Einreichung (optional, wird beim Einreichen in der Community verwendet)",
  "e.g. Imported from Extron stencil 2024.1": "z. B. Aus Extron-Stencil 2024.1 importiert",
  "Adds to your library AND submits to the community library for review":
    "Fügt zur eigenen Bibliothek hinzu UND reicht zur Prüfung in der Community-Bibliothek ein",
  "Add & Submit ({n})": "Hinzufügen & einreichen ({n})",
  "Add {n} to Library": "{n} zur Bibliothek hinzufügen",
  "Submitting…": "Wird eingereicht…",
  "{n} added": "{n} hinzugefügt",
  "{n} updated": "{n} aktualisiert",
  "Your library: {summary}": "Eigene Bibliothek: {summary}",
  "Nothing changed — already in your library": "Nichts geändert — bereits in der eigenen Bibliothek",
  "Added {n} to library. Submitted {ok}, {failed} failed: {summary}":
    "{n} zur Bibliothek hinzugefügt. {ok} eingereicht, {failed} fehlgeschlagen: {summary}",
  "Added {n} to library and submitted to community":
    "{n} zur Bibliothek hinzugefügt und in der Community eingereicht",

  // ─── Einreichung aus dem Banner ────────────────────────────────
  "Your device is ready to submit to the community library.":
    "Das Gerät ist bereit zum Einreichen in der Community-Bibliothek.",
  "Auto-submit failed. Click to try again.":
    "Automatisches Einreichen fehlgeschlagen. Zum erneuten Versuch anklicken.",
  "Submit now": "Jetzt einreichen",
  "Submitting...": "Wird eingereicht...",
  "Dismiss": "Ausblenden",

  // ─── Abgleich mit der Vorlage ──────────────────────────────────
  "Update from template": "Aus Vorlage aktualisieren",
  "No material changes — version bump only. Applying will update the stored template version.":
    "Keine inhaltlichen Änderungen — nur eine neue Versionsnummer. Übernehmen aktualisiert die gespeicherte Vorlagenversion.",
  "Specs that will update": "Daten, die aktualisiert werden",
  "{n} added:": "{n} hinzugefügt:",
  "{n} removed:": "{n} entfernt:",
  "{n} orphaned (have connections — kept for manual cleanup):":
    "{n} verwaist (haben Verbindungen — bleiben zum manuellen Aufräumen erhalten):",
  "Preserved": "Bleibt erhalten",
  "Custom label, color, hostname, port labels, DHCP config, installed cards, and existing connections are all kept.":
    "Eigene Beschriftung, Farbe, Hostname, Port-Beschriftungen, DHCP-Konfiguration, eingebaute Karten und bestehende Verbindungen bleiben erhalten.",
  "yes": "ja",
  "no": "nein",
  // Feldnamen aus FIELD_LABELS (Manufacturer/Model stehen in common.ts)
  "Model number": "Modellnummer",
  "Height (mm)": "Höhe (mm)",
  "Width (mm)": "Breite (mm)",
  "Depth (mm)": "Tiefe (mm)",
  "Weight (kg)": "Gewicht (kg)",
  "Power draw (W)": "Leistungsaufnahme (W)",
  "Power capacity (W)": "Leistungsabgabe (W)",
  "Voltage": "Spannung",
  "PoE budget (W)": "PoE-Budget (W)",
  "PoE draw (W)": "PoE-Aufnahme (W)",
  "Unit cost ($)": "Stückpreis ($)",
  "Cable accessory": "Kabelzubehör",
  "Integrated with cable": "Fest am Kabel",

  // ─── Unverträgliche Verbindung ─────────────────────────────────
  "Connector Mismatch": "Steckverbinder passen nicht",
  "Incompatible Connection": "Unverträgliche Verbindung",
  "These ports use different connector types. Select an adapter to insert between them.":
    "Diese Ports haben unterschiedliche Steckverbinder. Einen Adapter zum Einfügen auswählen.",
  "These ports use different signal types. You can insert an adapter/converter or force the connection.":
    "Diese Ports führen unterschiedliche Signalarten. Ein Adapter bzw. Wandler lässt sich einfügen, oder die Verbindung wird erzwungen.",
  "No matching adapters found in the device library": "Keine passenden Adapter in der Gerätebibliothek gefunden",
  "Connect Anyway": "Trotzdem verbinden",
  "Insert Adapter": "Adapter einfügen",

  // ─── Meldungen aus dem Store ───────────────────────────────────
  "Auto-routing disabled — schematic is too large for real-time routing":
    "Auto-Routing deaktiviert — der Schaltplan ist zu groß für Routing in Echtzeit",
  "a deleted device": "ein gelöschtes Gerät",
  "deleted devices": "gelöschte Geräte",
  "Removed 1 rack placement for {devices}": "1 Rack-Platzierung für {devices} entfernt",
  "Removed {n} rack placements for {devices}": "{n} Rack-Platzierungen für {devices} entfernt",
  "Removed 1 floorplan symbol for {devices}": "1 Grundriss-Symbol für {devices} entfernt",
  "Removed {n} floorplan symbols for {devices}": "{n} Grundriss-Symbole für {devices} entfernt",
  "Swapped to {label}: 1 connection remapped": "Getauscht gegen {label}: 1 Verbindung neu zugeordnet",
  "Swapped to {label}: {n} connections remapped": "Getauscht gegen {label}: {n} Verbindungen neu zugeordnet",
  ", {n} dropped": ", {n} verworfen",
  "; 1 card installed": "; 1 Karte eingebaut",
  "; {n} cards installed": "; {n} Karten eingebaut",
  "Removed from bundle (stubbed)": "Aus dem Bündel entfernt (abgesetzt)",
  "Select at least 2 connections to bundle": "Mindestens 2 Verbindungen zum Bündeln auswählen",

  // ─── Cloud-API ─────────────────────────────────────────────────
  "Failed to create draft": "Entwurf konnte nicht angelegt werden",
  "Failed to create handoff token": "Übergabe-Token konnte nicht erstellt werden",
  "Failed to save schematic": "Schaltplan konnte nicht gespeichert werden",
  "Failed to update schematic": "Schaltplan konnte nicht aktualisiert werden",
  "Failed to list schematics": "Schaltplanliste konnte nicht geladen werden",
  "Failed to load schematic": "Schaltplan konnte nicht geladen werden",
  "Failed to delete schematic": "Schaltplan konnte nicht gelöscht werden",
  "Shared schematic not found": "Freigegebener Schaltplan nicht gefunden",
  "Failed to rename schematic": "Schaltplan konnte nicht umbenannt werden",
  "Failed to set template": "Vorlage konnte nicht festgelegt werden",
  "Failed to clear template": "Vorlage konnte nicht entfernt werden",
  "Failed to load template": "Vorlage konnte nicht geladen werden",
  "Failed to load device library": "Gerätebibliothek konnte nicht geladen werden",
  "Sign in to submit to the community library": "Zum Einreichen in der Community-Bibliothek anmelden",
  "Account suspended": "Konto gesperrt",
  "Too many submissions — try again later": "Zu viele Einreichungen — später erneut versuchen",
  "Duplicate submission": "Doppelte Einreichung",
  "Submission failed: {status}": "Einreichen fehlgeschlagen: {status}",

  // ─── Plan-Unterlage laden ──────────────────────────────────────
  "Could not decode this image file.": "Diese Bilddatei konnte nicht dekodiert werden.",
  "Could not read the file.": "Die Datei konnte nicht gelesen werden.",
  "This plan is too large to rasterize in the browser. Pick a lower resolution.":
    "Dieser Plan ist zu groß, um im Browser gerastert zu werden. Eine niedrigere Auflösung wählen.",
  "This image has no readable dimensions.": "Dieses Bild hat keine lesbaren Abmessungen.",
  "Could not create a canvas to resize the image.":
    "Es konnte keine Zeichenfläche zum Skalieren des Bildes erstellt werden.",
  "Could not create a canvas to rotate the image.":
    "Es konnte keine Zeichenfläche zum Drehen des Bildes erstellt werden.",
  "Pick an image file for the legend.": "Eine Bilddatei für die Legende auswählen.",
  "Pick an image file for the symbol.": "Eine Bilddatei für das Symbol auswählen.",
  "DWG can't be read in the browser. Export the drawing as PDF (best) or as an image from AutoCAD/BricsCAD and import that.":
    "DWG kann im Browser nicht gelesen werden. Die Zeichnung aus AutoCAD/BricsCAD als PDF (am besten) oder als Bild exportieren und diese Datei importieren.",
  "DXF isn't supported as an underlay yet. Plot the drawing to PDF and import the PDF.":
    "DXF wird als Unterlage noch nicht unterstützt. Die Zeichnung als PDF plotten und das PDF importieren.",
  'Unsupported file type "{type}". Use a PDF or an image.':
    "Dateityp „{type}“ wird nicht unterstützt. Ein PDF oder ein Bild verwenden.",
  "unknown": "unbekannt",

  // ─── Routing-Debugpanel (nur bei aktiviertem Edge-Debug) ───────
  "Routing Tuning": "Routing-Feinabstimmung",
  "A* Pathfinding": "A*-Wegsuche",
  "Router Orchestration": "Router-Steuerung",
  "Reset All": "Alles zurücksetzen",
  "Copy Overrides": "Abweichungen kopieren",
  "Turn Penalty": "Abbiege-Strafe",
  "Crossing Penalty": "Kreuzungs-Strafe",
  "Device Padding": "Geräte-Abstand",
  "Escape Margin": "Ausweich-Rand",
  "Nesting Bias": "Verschachtelungs-Bias",
  "Sort Strategy": "Sortierstrategie",
  "Sep. Threshold": "Abstands-Schwelle",
  "Extra cost added each time A* makes a 90° turn. Higher = straighter paths with fewer bends. Lower = shorter paths that bend freely. Also affects U-turns at 5x and the heuristic.":
    "Zusatzkosten für jede 90°-Abbiegung von A*. Höher = geradere Wege mit weniger Knicken. Niedriger = kürzere Wege, die frei abbiegen. Wirkt auch auf Kehrtwenden (5-fach) und auf die Heuristik.",
  "Cost added when a path crosses an existing edge perpendicularly. Accumulates per crossing — 1 crossing costs 1x, 8 crossings costs 8x. Discourages unnecessary crossings without preventing necessary ones like highway intersections.":
    "Kosten, wenn ein Weg eine bestehende Verbindung rechtwinklig kreuzt. Summiert sich je Kreuzung — 1 Kreuzung kostet 1-fach, 8 Kreuzungen 8-fach. Bremst unnötige Kreuzungen, ohne nötige wie Hauptstrecken-Kreuzungen zu verhindern.",
  "How many grid cells of blocked space to add around each device. At 1, edges must route at least 20px away from any device border. At 0, edges can hug device edges.":
    "Wie viele Rasterzellen um jedes Gerät gesperrt werden. Bei 1 müssen Verbindungen mindestens 20 px Abstand zur Gerätekante halten. Bei 0 dürfen sie direkt an der Kante entlanglaufen.",
  "Extra grid cells added beyond the bounding box of all devices. Gives A* room to route around the outside. Too small = edges get trapped, too large = wasted grid and slower routing.":
    "Zusätzliche Rasterzellen außerhalb des umschließenden Rechtecks aller Geräte. Gibt A* Platz, außen herum zu führen. Zu klein = Verbindungen sitzen fest, zu groß = unnötiges Raster und langsameres Routing.",
  "Discount at turns proportional to vertical span × horizontal progress. Larger-span edges get more discount for turning later, claiming outer corridors. At 0.05, a span-60 edge gets ~2.7 discount per turn (vs 7 turn penalty). Too high will override crossing penalties.":
    "Rabatt beim Abbiegen, proportional zu vertikaler Spanne × horizontalem Fortschritt. Verbindungen mit größerer Spanne bekommen mehr Rabatt fürs spätere Abbiegen und belegen so die äußeren Korridore. Bei 0,05 bekommt eine Verbindung mit Spanne 60 rund 2,7 Rabatt je Abbiegung (gegenüber 7 Abbiege-Strafe). Zu hoch überstimmt die Kreuzungs-Strafen.",
  "Order edges are routed in Phase 1. 0 = signal-type groups then shortest first, 1 = longest edges first (they claim space early), 2 = most-connected devices first. Earlier edges get cleaner paths.":
    "Reihenfolge, in der Verbindungen in Phase 1 geroutet werden. 0 = nach Signalart gruppiert, dann kürzeste zuerst; 1 = längste zuerst (sie belegen früh Platz); 2 = Geräte mit den meisten Verbindungen zuerst. Frühere Verbindungen bekommen sauberere Wege.",
  "Minimum pixel distance between two parallel segments before they're considered 'shared' (a violation). Used in Phase 2 violation detection to flag edges that are too close together.":
    "Mindestabstand in Pixeln zwischen zwei parallelen Abschnitten, bevor sie als „geteilt“ (Verstoß) gelten. Dient in Phase 2 dazu, zu dicht liegende Verbindungen zu melden.",
};
