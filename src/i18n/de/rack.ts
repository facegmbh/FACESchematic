/** German dictionary — rack surface. Keys are the English source strings. */
export const DE_RACK: Record<string, string> = {
  // "Use" as an instruction ("Use + Add panel"), not the cable-use column.
  "Use::instruction": "Nutze",
  // Stats line under every rack and print viewport (src/rackStats.ts).
  "{n}U used": "{n} HE belegt",
  "1 conflict ⚠": "1 Konflikt ⚠",
  "{n} conflicts ⚠": "{n} Konflikte ⚠",
  // ─── Rackansicht: Ansichten & Seiten ───────────────────────────
  // Einbuchstabige Markierungen der Holme in der Seitenansicht
  "F::rack-side-front": "V",
  "R::rack-side-rear": "R",

  // ─── Rack-Sidebar ──────────────────────────────────────────────
  "+ Add Rack": "+ Rack hinzufügen",
  "Page Totals": "Seitensumme",
  "Move to page": "Auf Seite verschieben",
  "Edit {name}": "{name} bearbeiten",
  "Delete {name}": "{name} löschen",
  "{n} dev": "{n} Ger.",
  "Search devices…": "Geräte suchen…",
  "All devices placed": "Alle Geräte platziert",
  "No height set — drop on a shelf accessory · {name}":
    "Keine Höhe hinterlegt — auf einen Fachboden ziehen · {name}",
  "needs shelf": "braucht Fachboden",
  "From {room} → {rack} ({n})": "Aus {room} → {rack} ({n})",
  "Other Unracked ({n})": "Sonstige ohne Rack ({n})",
  "Unracked Devices ({n})": "Geräte ohne Rack ({n})",

  // ─── Rack anlegen / bearbeiten ─────────────────────────────────
  "Add Rack": "Rack hinzufügen",
  "Edit Rack": "Rack bearbeiten",
  "Edit Rack…": "Rack bearbeiten…",
  "Delete Rack": "Rack löschen",
  "Presets": "Presets",
  "Height (U)": "Höhe (HE)",
  "Depth (mm)": "Tiefe (mm)",
  "Rack cost ({currency})": "Rackpreis ({currency})",
  "Reducing the U height does not delete devices already placed at higher U positions — they'll just sit outside the visible frame until you move or remove them.":
    "Eine kleinere HE-Höhe löscht keine Geräte, die weiter oben eingebaut sind — sie stehen dann nur außerhalb des sichtbaren Rahmens, bis sie verschoben oder entfernt werden.",
  "Delete \"{name}\"? This removes all devices placed in it.":
    "\"{name}\" löschen? Damit werden alle darin platzierten Geräte entfernt.",

  // Racktypen (RACK_TYPE_LABELS in types.ts)
  "19\" Floor Standing": "19\" Standrack",
  "Wall Mount": "Wandmontage",
  "Desktop / Tabletop": "Desktop / Tischgerät",
  "Open Frame (2-Post)": "Offener Rahmen (2 Holme)",
  "Open Frame (4-Post)": "Offener Rahmen (4 Holme)",

  // Rack-Presets
  "42U Floor Rack": "42U Standrack",
  "25U Floor Rack": "25U Standrack",
  "16U Floor Rack": "16U Standrack",
  "12U Wall Mount": "12U Wandmontage",
  "6U Wall Mount": "6U Wandmontage",
  "4U Desktop": "4U Desktop",
  "8U Desktop": "8U Desktop",
  "45U Open 2-Post": "45U offen, 2 Holme",
  "12U Open 2-Post": "12U offen, 2 Holme",
  "42U Open 4-Post": "42U offen, 4 Holme",
  "Standard full-height AV rack": "Standard-AV-Rack in voller Höhe",
  "Half-height floor standing": "Standrack in halber Höhe",
  "Short floor standing": "Niedriges Standrack",
  "Wall-mounted enclosure": "Wandgehäuse",
  "Small wall-mount": "Kleine Wandmontage",
  "Tabletop / portable": "Tischgerät / mobil",
  "Larger tabletop rack": "Größeres Tischrack",
  "2-post relay rack": "2-Holm-Relayrack",
  "Small 2-post relay rack": "Kleines 2-Holm-Relayrack",
  "4-post open frame": "Offener 4-Holm-Rahmen",

  // ─── Rack-Zubehör (RACK_ACCESSORY_LABELS in types.ts) ──────────
  "Blank Panel": "Blindplatte",
  "Vent Panel": "Lüftungsblende",
  "Shelf": "Fachboden",
  "Drawer": "Schublade",
  "Cable Manager": "Kabelführung",
  "Bürstenleiste": "Bürstenleiste",
  "Fan Unit": "Lüftereinheit",

  "Add Accessory": "Zubehör hinzufügen",
  "Rack at U{u}": "Rack bei U{u}",
  " ({n} on shelf)": " ({n} auf dem Fachboden)",
  "Can't add {type} — {h}U slot at U{u} is occupied":
    "{type} nicht möglich — {h}U-Platz bei U{u} ist belegt",
  "Can't resize: extends past top of rack":
    "Größe nicht änderbar: ragt über die Rackoberkante hinaus",
  "Can't resize: would overlap an existing item":
    "Größe nicht änderbar: würde ein vorhandenes Element überlappen",
  "Remove shelf?": "Fachboden entfernen?",
  "\"{name}\" has 1 mounted device. Removing the shelf will return it to the unracked sidebar pool.":
    "Auf \"{name}\" liegt 1 Gerät. Beim Entfernen des Fachbodens wandert es zurück in die Liste der Geräte ohne Rack.",
  "\"{name}\" has {n} mounted devices. Removing the shelf will return them to the unracked sidebar pool.":
    "Auf \"{name}\" liegen {n} Geräte. Beim Entfernen des Fachbodens wandern sie zurück in die Liste der Geräte ohne Rack.",
  "Remove shelf & unrack devices": "Fachboden entfernen und Geräte ausbauen",

  // ─── Rackansicht: Kontextmenüs & Meldungen ─────────────────────
  "Edit Face-Plate Layout": "Frontblenden-Layout bearbeiten",
  "Edit Device": "Gerät bearbeiten",
  "Remove from Rack": "Aus dem Rack entfernen",
  "Remove from shelf (unrack)": "Vom Fachboden nehmen (ausbauen)",
  "Lay flat": "Flach legen",
  "Rotate (lay on side)": "Drehen (hochkant stellen)",
  "Drop here to remove from rack": "Hier ablegen, um aus dem Rack zu entfernen",
  "2-post racks have no rear mounting": "2-Holm-Racks haben keine rückseitige Montage",
  "No racks yet. Use the sidebar to add a rack.":
    "Noch keine Racks. In der Sidebar ein Rack hinzufügen.",
  "Removed {name} from rack": "{name} aus dem Rack entfernt",
  "device": "Gerät",
  "Device is too wide to fit in this rack — can't be racked.":
    "Gerät ist zu breit für dieses Rack — kein Einbau möglich.",
  "Auto-Populate": "Auto-Belegen",
  "No devices to place": "Keine Geräte zum Platzieren",
  "Placed {n}": "{n} platziert",
  "{n} skipped (missing height)": "{n} übersprungen (Höhe fehlt)",

  // ─── Rack-Statistik & Warnungen ────────────────────────────────
  "1 depth conflict": "1 Tiefenkonflikt",
  "{n} depth conflicts": "{n} Tiefenkonflikte",
  "{n} front/rear pair(s) overlap deeper than the rack.":
    "{n} Vorder-/Rückseiten-Paar(e) überlappen tiefer als das Rack.",
  "1 device has unknown depth (not counted).":
    "Bei 1 Gerät ist die Tiefe unbekannt (nicht mitgezählt).",
  "{n} devices have unknown depth (not counted).":
    "Bei {n} Geräten ist die Tiefe unbekannt (nicht mitgezählt).",
  "{n} too deep": "{n} zu tief",
  "1 device is deeper than the rack (max +{mm}mm). Consider a deeper rack.":
    "1 Gerät ist tiefer als das Rack (max. +{mm}mm). Ein tieferes Rack wäre besser.",
  "{n} devices are deeper than the rack (max +{mm}mm). Consider a deeper rack.":
    "{n} Geräte sind tiefer als das Rack (max. +{mm}mm). Ein tieferes Rack wäre besser.",
  "{n} unknown depth": "{n} ohne Tiefenangabe",
  "{n} unknown weight": "{n} ohne Gewichtsangabe",
  "{n} unknown power": "{n} ohne Leistungsangabe",
  "{n} U": "{n} HE",
  "{n} U used": "{n} HE belegt",

  // ─── Rack-Plan (Bericht) ───────────────────────────────────────
  "No rack elevation in this schematic.": "Keine Rack-Elevation in diesem Schaltplan.",
  "Add a rack in the rack editor and place devices in it to see the rack plan.":
    "Lege im Rack-Editor einen Schrank an und platziere die Geräte darin, um den Rack-Plan zu sehen.",

  // ─── Patchfeld ─────────────────────────────────────────────────
  "Patch Bay": "Patchfeld",
  "Panel": "Panel",
  "Panels in project": "Panels im Projekt",
  "+ Add panel": "+ Panel hinzufügen",
  "Search patch panels…": "Patchfelder suchen…",
  "Loading library…": "Bibliothek wird geladen…",
  "No patch panel templates match.": "Keine passenden Patchfeld-Vorlagen.",
  "{n} ports": "{n} Ports",
  "Panels added here are “virtual” — in reports and racks, but never on the schematic.":
    "Hier angelegte Panels sind „virtuell“ — sie erscheinen in Berichten und Racks, nie im Schaltplan.",
  "No patch panels yet.": "Noch keine Patchfelder.",
  "No patch panels in this project yet.": "Noch keine Patchfelder in diesem Projekt.",
  "in the sidebar to create a virtual panel, or place one on the schematic.":
    "in der Sidebar ein virtuelles Panel anlegen oder eines im Schaltplan platzieren.",
  "Click to scroll to panel · double-click to rename":
    "Klick springt zum Panel · Doppelklick zum Umbenennen",
  "Unnamed Panel": "Panel ohne Namen",
  "{used}/{total} used": "{used}/{total} belegt",
  " · virtual": " · virtuell",
  "virtual (not on schematic)": "virtuell (nicht im Schaltplan)",
  "on schematic": "im Schaltplan",
  "Panel has wired connections on the schematic":
    "Panel ist im Schaltplan verdrahtet",
  "Show on canvas": "Im Schaltplan zeigen",
  "Make virtual": "Virtuell machen",
  "Delete panel \"{name}\"? Patch assignments through it are removed; connections stay.":
    "Panel \"{name}\" löschen? Patch-Zuordnungen darüber werden entfernt, die Verbindungen bleiben.",
  "Legacy paired-port panel — shown in the Patch Panel Schedule report only.":
    "Altes Panel mit Port-Paaren — erscheint nur im Bericht Patchfeld-Belegung.",
  "{name} panel face": "Panelfront {name}",
  "Hover a port or cable to trace its circuit":
    "Port oder Kabel überfahren, um den Signalweg zu verfolgen",
  "Designation strips at 100% physical scale — cut and slide into the panel's label holder":
    "Beschriftungsstreifen in Originalgröße — ausschneiden und in die Beschriftungsleiste schieben",
  "Print strips (PDF)": "Streifen drucken (PDF)",
  "Schedule report…": "Belegungsbericht…",
  "Patching": "Patchen",
  "— click an open port. Click a second panel’s port to add another hop.":
    "— einen freien Port anklicken. Ein Port an einem zweiten Panel fügt einen weiteren Hop hinzu.",
  "patch here": "hier patchen",
  "spare": "frei",
  "unwired": "unbeschaltet",
  "Double-click to override the cable label": "Doppelklick überschreibt die Kabelbeschriftung",
  "Wired on the schematic — edit there": "Im Schaltplan verdrahtet — dort bearbeiten",
  "That port is already occupied": "Dieser Port ist bereits belegt",
  "front": "Vorderseite",
  "rear": "Rückseite",
  "Won't fit — this port's {face} is {panelConnector}, but {other} is {otherConnector}.":
    "Passt nicht — die {face} dieses Ports ist {panelConnector}, {other} aber {otherConnector}.",
  "Patched": "Gepatcht",
  "Direct": "Direkt",
  "No cables match.": "Keine passenden Kabel.",
  "via {path}": "über {path}",
  "Unpatch": "Patch lösen",
  "Add hop…": "Hop hinzufügen…",
  "Patch…": "Patchen…",

  // ─── Druckbogen ────────────────────────────────────────────────
  "Drag to Sheet": "Auf den Bogen ziehen",
  "Paper": "Papier",
  "Standard": "Standard",
  "Architectural": "Architektur",
  "Auto-Fill from:": "Auto-Füllen aus:",
  "— Pick rack —": "— Rack wählen —",
  "Add View:": "Ansicht:",
  "— Pick view —": "— Ansicht wählen —",
  "Sheet {i} of {n}": "Bogen {i} von {n}",
  "Clear All": "Alles leeren",
  "Export PDF": "PDF exportieren",
  "Rack not found": "Rack nicht gefunden",
  "Reset size to natural rack aspect (shortcut: R)":
    "Größe auf das natürliche Rack-Seitenverhältnis zurücksetzen (Kürzel: R)",
  "Drag a rack view from the sidebar, or use Auto-Fill in the toolbar":
    "Eine Rackansicht aus der Sidebar ziehen oder Auto-Füllen in der Toolbar nutzen",
  "Fit": "Einpassen",

  // ─── Druckansicht (Schaltplan) ─────────────────────────────────
  "Offset": "Versatz",
  "1 page": "1 Seite",
  "{n} pages": "{n} Seiten",
  "Toggle signal color key": "Signalfarben-Legende ein-/ausblenden",
  "Color Key": "Farblegende",
  "Color key settings": "Einstellungen der Farblegende",
  "Corner": "Ecke",
  "Top Left": "Oben links",
  "Top Right": "Oben rechts",
  "Bottom Left": "Unten links",
  "Bottom Right": "Unten rechts",
  "Columns": "Spalten",
  "Show On": "Anzeigen auf",
  "First page": "Erste Seite",
  "Last page": "Letzte Seite",
  "All pages": "Alle Seiten",
  "Signal Types": "Signalarten",
  "No connected signals": "Keine verbundenen Signale",

  // ─── Seitenraster-Overlay ──────────────────────────────────────
  "Pg {n}": "S. {n}",
  "SIGNAL KEY": "SIGNALLEGENDE",
  "Page {n} / {total}": "Seite {n} / {total}",
};
