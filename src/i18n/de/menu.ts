/** German dictionary — menu surface. Keys are the English source strings. */
export const DE_MENU: Record<string, string> = {
  // ─── Menu bar titles (::menu keeps them apart from the verbs in common) ───
  "File::menu": "Datei",
  "Edit::menu": "Bearbeiten",
  "Insert::menu": "Einfügen",
  "View::menu": "Ansicht",
  "Export::menu": "Export",
  "Reports::menu": "Berichte",
  "Help::menu": "Hilfe",
  "Menu": "Menü",
  "Panels": "Panels",

  // ─── File menu ───────────────────────────────────────────────────
  "Save to Cloud": "In Cloud speichern",
  "Save to Cloud (Offline)": "In Cloud speichern (Offline)",
  "My Schematics...": "Meine Schaltpläne...",
  "Must be logged in": "Anmeldung erforderlich",
  "Save Device Archive": "Gerätearchiv speichern",
  "Import Device Archive...": "Gerätearchiv importieren...",
  "Import Cable Schedule...": "Kabelliste importieren...",

  // ─── Edit menu ───────────────────────────────────────────────────
  "Reset All Routes": "Alle Routen zurücksetzen",
  "Clear every manual route so the whole schematic re-auto-routes (undoable)":
    "Alle manuellen Routen löschen, damit der ganze Schaltplan neu automatisch geroutet wird (rückgängig machbar)",

  // ─── Insert menu ─────────────────────────────────────────────────
  "Add Rectangle": "Rechteck hinzufügen",
  "Add Ellipse": "Ellipse hinzufügen",
  "Add Circle": "Kreis hinzufügen",
  "Add Diamond": "Raute hinzufügen",
  "Add Triangle": "Dreieck hinzufügen",

  // ─── View menu ───────────────────────────────────────────────────
  "Print View": "Druckansicht",
  "Show Owned Gear": "Eigenen Bestand anzeigen",
  "Hide Unconnected Ports": "Unbelegte Ports ausblenden",
  "Minimap": "Minimap",
  "Auto-Route Edges": "Verbindungen automatisch routen",
  "Debug Edges": "Verbindungen debuggen",
  "View Options": "Ansichtsoptionen",
  "Signal Colors": "Signalfarben",

  // ─── Export menu ─────────────────────────────────────────────────
  "Export as PNG": "Als PNG exportieren",
  "Export as SVG": "Als SVG exportieren",
  "Export as DXF": "Als DXF exportieren",
  "Export as PDF": "Als PDF exportieren",
  "Export Rack PDF": "Rack-PDF exportieren",
  "Export Print Sheets": "Druckbögen exportieren",
  "Export Floorplans": "Grundrisse exportieren",
  "Title Block...": "Schriftfeld...",

  // ─── Reports menu ────────────────────────────────────────────────
  "Device List...": "Geräteliste...",
  "Cable Schedule...": "Kabelliste...",
  "Patch Panels...": "Patchfelder...",
  "Pack List...": "Packliste...",
  "Network Report...": "Netzwerkbericht...",
  "Power Report...": "Strombericht...",
  "Room Distances...": "Raumabstände...",

  // ─── Help menu ───────────────────────────────────────────────────
  "Documentation ↗": "Dokumentation ↗",
  "Device Database ↗": "Gerätedatenbank ↗",
  "Landing Page": "Startseite",
  "About FACESchematic": "Über FACESchematic",
  "Device Library ↗": "Gerätebibliothek ↗",

  // ─── Title bar & toolbar ─────────────────────────────────────────
  "Offline — cloud sync paused": "Offline — Cloud-Sync pausiert",
  "Cloud saved: {when}": "In Cloud gespeichert: {when}",
  "Cloud-backed schematic": "Schaltplan liegt in der Cloud",
  "Saving to: {file}": "Speichert nach: {file}",
  "Offline": "Offline",
  "No internet connection. Editing works normally — save to your computer via File → Save.":
    "Keine Internetverbindung. Bearbeiten funktioniert normal — über Datei → Speichern auf dem Rechner sichern.",
  "Undo (Ctrl+Z)": "Rückgängig (Ctrl+Z)",
  "Redo (Ctrl+Shift+Z)": "Wiederherstellen (Ctrl+Shift+Z)",
  "Switch to light mode": "Zu hellem Modus wechseln",
  "Switch to dark mode": "Zu dunklem Modus wechseln",

  // ─── Align & distribute ──────────────────────────────────────────
  "Align": "Ausrichten",
  "Distribute": "Verteilen",
  "Align & Distribute": "Ausrichten & Verteilen",
  "Middle": "Mitte",
  "Horizontally": "Horizontal",
  "Vertically": "Vertikal",

  // ─── Save / open / import messages ───────────────────────────────
  "Saved": "Gespeichert",
  "Save failed": "Speichern fehlgeschlagen",
  "Cloud save failed": "Cloud-Speichern fehlgeschlagen",
  "Failed to save to cloud": "Speichern in der Cloud fehlgeschlagen",
  "FACESchematic files": "FACESchematic-Dateien",
  "Saved {mb} MB — the file carries the imported plans so they can be redrawn elsewhere.":
    "{mb} MB gespeichert — die Datei enthält die importierten Pläne, damit sie anderswo neu gezeichnet werden können.",
  "File is too large (max 10 MB). Please use a smaller schematic file.":
    "Datei ist zu groß (max. 10 MB). Bitte eine kleinere Schaltplandatei verwenden.",
  "Invalid schematic file.": "Ungültige Schaltplandatei.",
  "No custom device templates to export.": "Keine eigenen Gerätevorlagen zum Exportieren vorhanden.",
  "{n} added": "{n} hinzugefügt",
  "{n} updated": "{n} aktualisiert",
  "{n} already built in": "{n} bereits enthalten",
  "Imported device templates: {parts}.": "Gerätevorlagen importiert: {parts}.",
  "Nothing to import — the file matched your library exactly.":
    "Nichts zu importieren — die Datei stimmt genau mit der Bibliothek überein.",
  "Invalid device archive file.": "Ungültige Gerätearchiv-Datei.",
  "You're offline. Use File → Save to save a copy to your computer.":
    "Offline. Über Datei → Speichern eine Kopie auf dem Rechner ablegen.",
  "No rack pages to export. Create a rack page first via the page tabs.":
    "Keine Rack-Seiten zum Exportieren. Zuerst über die Seitenreiter eine Rack-Seite anlegen.",

  // ─── Page tabs ───────────────────────────────────────────────────
  "Rack Page {n}": "Rack-Seite {n}",
  "Add rack elevation page": "Rack-Ansichtsseite hinzufügen",
  "Add print sheet": "Druckbogen hinzufügen",
  "Add floorplan page — an architect's drawing with device symbols":
    "Grundriss-Seite hinzufügen — eine Architektenzeichnung mit Gerätesymbolen",
  "Add patch bay page": "Patchfeld-Seite hinzufügen",
  "Double-click to rename, right-click for options":
    "Doppelklick zum Umbenennen, Rechtsklick für Optionen",
  'Delete print sheet "{name}"?': 'Druckbogen "{name}" löschen?',
  'Delete floorplan "{name}"? The underlay and every symbol on it are removed; devices stay on the schematic.':
    'Grundriss "{name}" löschen? Die Unterlage und alle Symbole darauf werden entfernt; die Geräte bleiben im Schaltplan.',
  'Delete patch bay page "{name}"? Panels and patch assignments are kept — only the tab is removed.':
    'Patchfeld-Seite "{name}" löschen? Panels und Patch-Zuordnungen bleiben erhalten — nur der Reiter wird entfernt.',
  'Delete rack page "{name}"? This will remove all racks and placements on this page.':
    'Rack-Seite "{name}" löschen? Alle Racks und Platzierungen auf dieser Seite werden entfernt.',

  // ─── About dialog ────────────────────────────────────────────────
  "AV signal flow diagram tool for broadcast, live production, and AV integration":
    "Werkzeug für AV-Signalflusspläne in Broadcast, Live-Produktion und AV-Integration",
  "{n}+ bundled device templates": "{n}+ mitgelieferte Gerätevorlagen",
  "2,000+ in the community library": "2.000+ in der Community-Bibliothek",
  "68 signal types": "68 Signalarten",
  "Website": "Website",
  "Docs": "Doku",
  "GitHub": "GitHub",
  "Device Database": "Gerätedatenbank",
  "Support": "Support",
  "Report a Bug": "Fehler melden",
  "Discord": "Discord",
  "Built with React, React Flow, and Zustand": "Gebaut mit React, React Flow und Zustand",
  "Force Update": "Update erzwingen",
  "Reloading…": "Wird neu geladen…",
  "Copied!": "Kopiert!",
  "Copy Debug Info": "Debug-Infos kopieren",
  "Unregister the service worker, clear app cache, and reload. Schematic data is preserved.":
    "Service Worker abmelden, App-Cache leeren und neu laden. Schaltplandaten bleiben erhalten.",
  "Force update: this unregisters the service worker and clears the app cache, then reloads. Your saved schematics (in browser storage) are NOT affected. Continue?":
    "Update erzwingen: Der Service Worker wird abgemeldet und der App-Cache geleert, danach wird neu geladen. Gespeicherte Schaltpläne (im Browser-Speicher) bleiben erhalten. Fortfahren?",

  // ─── Banners ─────────────────────────────────────────────────────
  "New version available.": "Neue Version verfügbar.",
  "Reload to pick up the latest fixes.": "Neu laden, um die neuesten Korrekturen zu übernehmen.",
  "Reload now": "Jetzt neu laden",
  "Beta:": "Beta:",
  "testing new features before they hit production. Your saved schematics are real — don't save anything you can't lose.":
    "Hier werden neue Funktionen getestet, bevor sie produktiv gehen. Gespeicherte Schaltpläne sind echt — nichts speichern, dessen Verlust wehtut.",
  "Dismiss": "Ausblenden",
};
