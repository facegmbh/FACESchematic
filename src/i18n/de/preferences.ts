/** German dictionary — preferences surface. Keys are the English source strings. */
export const DE_PREFERENCES: Record<string, string> = {
  // ─── View Options panel ────────────────────────────────────────
  "View": "Ansicht",
  "View options": "Ansichtsoptionen",
  "View Options": "Ansichtsoptionen",
  "Collapse": "Einklappen",
  "Hide unconnected ports": "Nicht belegte Ports ausblenden",
  "Show IO counts": "IO-Anzahl anzeigen",
  "Signal Types": "Signalarten",
  "Reset colors and line styles to defaults": "Farben und Linienstile auf Standard zurücksetzen",
  "Used only": "Nur verwendete",
  "All ({n})": "Alle ({n})",
  "Hide all {group} signals": "Alle {group}-Signale ausblenden",
  "Show all {group} signals": "Alle {group}-Signale anzeigen",
  "No signal types in schematic": "Keine Signalarten im Schaltplan",
  "Show wires": "Leitungen anzeigen",
  "Hide wires": "Leitungen ausblenden",
  "Show pins": "Pins anzeigen",
  "Hide pins": "Pins ausblenden",
  "Change color": "Farbe ändern",
  "Line style: {style} (click to cycle)": "Linienstil: {style} (klicken zum Wechseln)",
  "Show line jumps at crossings": "Leitungssprünge an Kreuzungen anzeigen",
  "Show cable IDs": "Kabel-IDs anzeigen",
  "Show custom labels": "Eigene Beschriftungen anzeigen",
  "Show cable lengths": "Kabellängen anzeigen",
  "Cable ID position": "Kabel-ID-Position",
  "At endpoints": "An den Enden",
  "At midpoint": "In der Mitte",
  "Cable ID spacing": "Kabel-ID-Abstand",
  "Cable ID offset": "Kabel-ID-Versatz",
  "Adapters": "Adapter",
  "Hide all adapters": "Alle Adapter ausblenden",
  "Show face-plate detail (advanced)": "Frontblenden-Details anzeigen (erweitert)",
  "Show all signal types": "Alle Signalarten anzeigen",

  // ─── Line styles (LINE_STYLE_LABELS / line-style tooltips) ─────
  "Solid": "Durchgezogen",
  "Dashed": "Gestrichelt",
  "Dotted": "Gepunktet",

  // ─── Signal groups (SIGNAL_GROUPS keys, shown as filter chips) ──
  "Video": "Video",
  "Video over IP": "Video über IP",
  "Audio": "Audio",
  "Control / Data": "Steuerung / Daten",
  "Building Automation": "Gebäudeautomation",
  "Security": "Sicherheitstechnik",
  "Sync / Clock": "Sync / Takt",
  "Streaming": "Streaming",
  "Other": "Sonstige",

  // ─── Signal labels that are words, not protocol names ──────────
  // (SDI, HDMI, Dante, … stay as they are and need no entry.)
  "Speaker": "Lautsprecher",
  "Fiber": "Glasfaser",
  "Ground": "Erde",
  "Serial": "Seriell",
  "Contact Closure": "Kontaktschluss",
  "0-10V Control": "0-10 V Steuerung",

  // ─── Signal Colors panel ───────────────────────────────────────
  "Colors": "Farben",
  "Show signal colors": "Signalfarben anzeigen",
  "Signal Colors": "Signalfarben",
  "Reset to default": "Auf Standard zurücksetzen",
  "reset": "zurücksetzen",
  "Reset all to defaults": "Alles auf Standard zurücksetzen",

  // ─── Show Info panel ───────────────────────────────────────────
  "Show info": "Show-Infos",
  "Show / Project": "Show / Projekt",
  "Venue / Location": "Veranstaltungsort / Standort",
  "Drawing Title": "Zeichnungstitel",
  "e.g. Morning News Live": "z. B. Morning News Live",
  "e.g. Studio A, Building 2": "z. B. Studio A, Gebäude 2",
  "e.g. 2026-03-15": "z. B. 2026-03-15",
  "e.g. Main Studio Signal Flow": "z. B. Signalfluss Hauptstudio",
  "Remove field": "Feld entfernen",
  "New Field": "Neues Feld",
  "+ Add Field": "+ Feld hinzufügen",
  "Customize Title Block...": "Schriftfeld anpassen...",

  // ─── Project status (PROJECT_STATUS_LABELS values) ─────────────
  // The map in types.ts keeps its English values; callers translate on render.
  "Dormant": "Ruhend",
  "Pending": "Ausstehend",
};
