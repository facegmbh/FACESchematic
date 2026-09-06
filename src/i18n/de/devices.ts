/** German dictionary — devices surface. Keys are the English source strings. */
export const DE_DEVICES: Record<string, string> = {
  // "Source" here is where a device was procured from, not a cable's source device.
  "Source::procurement": "Herkunft",
  // ─── Device library panel ──────────────────────────────────────
  "Show device library": "Gerätebibliothek anzeigen",
  "Collapse device library": "Gerätebibliothek einklappen",
  "Couldn't load the full device library — some community devices may be missing.":
    "Die vollständige Gerätebibliothek konnte nicht geladen werden — einzelne Community-Geräte fehlen womöglich.",
  "Retrying…": "Erneuter Versuch…",
  "Owned Gear": "Eigener Bestand",
  "Search devices...": "Geräte suchen...",
  "Search owned gear...": "Bestand durchsuchen...",
  "1 result": "1 Treffer",
  "{n} results": "{n} Treffer",
  "Categories": "Kategorien",
  "Categories ({n})": "Kategorien ({n})",
  "Brands": "Marken",
  "Brands ({n})": "Marken ({n})",
  "Signals ({n})": "Signale ({n})",
  "No devices match “{query}”": "Keine Geräte passen zu „{query}“",
  "Favorites": "Favoriten",
  "User Templates": "Eigene Vorlagen",
  "New group": "Neue Gruppe",
  "Rename group": "Gruppe umbenennen",
  "Delete group": "Gruppe löschen",
  "Group name...": "Gruppenname...",
  "Delete template": "Vorlage löschen",
  "Delete all user templates": "Alle eigenen Vorlagen löschen",
  "Delete all user templates?": "Alle eigenen Vorlagen löschen?",
  "This will permanently delete all {n} of your user templates":
    "Damit werden alle {n} eigenen Vorlagen endgültig gelöscht",
  "and all 1 group": "und die eine Gruppe",
  "and all {n} groups": "und alle {n} Gruppen",
  "Devices already placed on the canvas are not affected. This cannot be undone.":
    "Bereits platzierte Geräte bleiben unberührt. Das lässt sich nicht rückgängig machen.",
  "Delete All": "Alle löschen",
  "Drag to reorder": "Zum Umsortieren ziehen",
  "Remove from favorites": "Aus Favoriten entfernen",
  "Add to favorites": "Zu Favoriten hinzufügen",
  "Add to owned gear": "Zum Bestand hinzufügen",
  "Owned: {n}": "Bestand: {n}",
  "Inv": "Inv",
  "preset": "Preset",
  "1 slot": "1 Slot",
  "{n} slots": "{n} Slots",
  "1 port": "1 Port",
  "{n} ports": "{n} Ports",

  // ─── Owned gear tab ────────────────────────────────────────────
  "Export JSON": "JSON exportieren",
  "Import JSON": "JSON importieren",
  "Owned": "Bestand",
  "Used": "Verbaut",
  "Need": "Bedarf",
  "Owned {n}": "Bestand {n}",
  "Used {n}": "Verbaut {n}",
  "Buy {n}": "{n} kaufen",
  "Spare {n}": "{n} übrig",
  "Remove from owned gear": "Aus dem Bestand entfernen",
  "Decrease quantity": "Menge verringern",
  "Increase quantity": "Menge erhöhen",
  "No owned gear yet. Add items from the Devices tab, or import a JSON inventory.":
    "Noch kein Bestand. Posten im Reiter Geräte hinzufügen oder ein JSON-Inventar importieren.",
  "No owned gear matches “{query}”.": "Kein Bestand passt zu „{query}“.",
  "Loaded 1 owned gear item": "1 Bestandsposten geladen",
  "Loaded {n} owned gear items": "{n} Bestandsposten geladen",
  "Couldn't load owned gear JSON": "Bestands-JSON konnte nicht geladen werden",

  // ─── Quick add / device creator ────────────────────────────────
  "Add device, note, room...": "Gerät, Notiz, Raum hinzufügen...",
  "Text annotation": "Textnotiz",
  "Grouping container": "Gruppierungsrahmen",
  "Create New Device": "Neues Gerät anlegen",
  "Blank or copy from existing": "Leer oder als Kopie eines vorhandenen",
  "navigate": "navigieren",
  "place": "platzieren",
  "cancel": "abbrechen",
  "Start Blank": "Leer beginnen",
  "Empty device with no ports": "Leeres Gerät ohne Ports",
  "Import from JSON or CSV": "Aus JSON oder CSV importieren",
  "Bulk-add devices from external data": "Geräte gesammelt aus externen Daten anlegen",
  "Or clone from library device": "Oder ein Gerät aus der Bibliothek klonen",
  "Search the device library...": "Gerätebibliothek durchsuchen...",
  "Type to search {n} library devices": "Tippen, um {n} Bibliotheksgeräte zu durchsuchen",
  "No matching devices": "Keine passenden Geräte",

  // ─── Card creator ──────────────────────────────────────────────
  "Create Custom Card": "Eigene Karte anlegen",
  "This card will be saved to your custom templates and installed in the slot.":
    "Die Karte wird bei den eigenen Vorlagen gespeichert und in den Slot eingebaut.",
  "e.g. Fiber SFP+ Module": "z. B. Fiber-SFP+-Modul",
  "Slot Family": "Slot-Familie",
  "e.g. disguise-vfc, my-custom-family": "z. B. disguise-vfc, eigene-familie",
  "Unit Cost (USD)": "Stückpreis (USD)",
  "Create & Install": "Anlegen & einbauen",
  "Dup": "Dupl.",
  "none": "keine",

  // ─── Device swap ───────────────────────────────────────────────
  "Swap '{name}' for...": "'{name}' tauschen gegen...",
  "Swap '{from}' → '{to}'": "'{from}' → '{to}' tauschen",
  "Installed cards": "Installierte Karten",
  "carried over": "übernommen",
  "auto-installed": "automatisch eingebaut",
  "satisfies {n}": "deckt {n} ab",
  "Connections ({n})": "Verbindungen ({n})",
  "No existing connections — swap will simply replace the device.":
    "Keine bestehenden Verbindungen — der Tausch ersetzt einfach das Gerät.",
  "1 card could not be carried over:": "1 Karte konnte nicht übernommen werden:",
  "{n} cards could not be carried over:": "{n} Karten konnten nicht übernommen werden:",
  "Specification changes ({n})": "Technische Änderungen ({n})",
  "remapped": "neu zugeordnet",
  "will be dropped": "werden verworfen",
  "Pick different": "Anderes wählen",
  "Confirm Swap": "Tausch bestätigen",
  "{n} edges": "{n} Kanten",
  "— Drop these connections —": "— Diese Verbindungen verwerfen —",
  "direction: {from} → {to}": "Richtung: {from} → {to}",
  "signal: {from} → {to}": "Signal: {from} → {to}",
  "connector: {from} → {to}": "Steckverbinder: {from} → {to}",
  "target port doesn't accept multiple connections":
    "Zielport nimmt keine Mehrfachverbindungen an",
  // matchSourceLabel()
  "id match": "ID-Treffer",
  "by label": "über Name",
  "exact": "exakt",
  "by signal": "über Signal",
  "via card": "über Karte",
  "manual": "manuell",
  "drop": "verwerfen",

  // ─── Face-plate editor ─────────────────────────────────────────
  "Face-Plate Layout": "Face-Plate-Layout",
  "Reset all positions to auto-layout": "Alle Positionen auf das Auto-Layout zurücksetzen",
  "Snap": "Einrasten",
  "Fine": "Fein",
  "Medium": "Mittel",
  "Coarse": "Grob",
  "Reset View": "Ansicht zurücksetzen",
  "Align:": "Ausrichten:",
  "Align left": "Linksbündig ausrichten",
  "Align center horizontally": "Horizontal zentrieren",
  "Align right": "Rechtsbündig ausrichten",
  "Align top": "Oben ausrichten",
  "Align center vertically": "Vertikal zentrieren",
  "Align bottom": "Unten ausrichten",
  "L::align-left": "L",
  "CX::align-center-h": "CX",
  "R::align-right": "R",
  "T::align-top": "O",
  "CY::align-center-v": "CY",
  "B::align-bottom": "U",
  "Distribute:": "Verteilen:",
  "Distribute horizontally": "Horizontal verteilen",
  "Distribute vertically": "Vertikal verteilen",
  "H::distribute-h": "H",
  "V::distribute-v": "V",
  "{n} items selected": "{n} Objekte ausgewählt",
  "Device label": "Gerätebeschriftung",
  "Label text": "Beschriftungstext",

  // ─── Device editor: header & identity ──────────────────────────
  "Device Properties": "Geräte-Eigenschaften",
  "Template updated — v{from} → v{to} available":
    "Vorlage aktualisiert — v{from} → v{to} verfügbar",
  "Device Name": "Gerätename",
  "e.g. Camera 1": "z. B. Kamera 1",
  "Template: {name}": "Vorlage: {name}",
  "Short Name": "Kurzname",
  "e.g. HDC-5500": "z. B. HDC-5500",
  " — falls back to model number \"{model}\"": " — greift sonst auf die Modellnummer „{model}“ zurück",
  "Use the short name on this device{fallback}. Leave unchecked to inherit the schematic-wide default.":
    "Für dieses Gerät den Kurznamen verwenden{fallback}. Nicht angehakt heißt: Vorgabe des Schaltplans übernehmen.",
  "Set a Short Name (or Model Number) above to enable this toggle.":
    "Oben einen Kurznamen (oder eine Modellnummer) eintragen, um diesen Schalter zu aktivieren.",
  "Use short name": "Kurznamen verwenden",
  "(inherit)": "(geerbt)",
  "on": "ein",
  "off": "aus",
  "Inheriting the schematic-wide default (currently {state}). Click to set this device explicitly.":
    "Übernimmt die Vorgabe des Schaltplans (derzeit {state}). Klicken, um es für dieses Gerät festzulegen.",
  "Wrap the device label across two lines on this device. Uncheck twice to go back to inheriting the schematic-wide default.":
    "Beschriftung dieses Geräts auf zwei Zeilen umbrechen. Zweimal abwählen, um wieder die Vorgabe des Schaltplans zu übernehmen.",
  "Wrap label": "Beschriftung umbrechen",
  "Device Type": "Gerätetyp",
  "e.g. camera": "z. B. camera",
  "e.g. Sony": "z. B. Sony",
  "Model Number": "Modellnummer",
  "e.g. FX9": "z. B. FX9",
  "e.g. video": "z. B. video",
  "Reference URL": "Referenz-URL",
  "Header Color": "Kopfzeilenfarbe",
  "Background Color": "Hintergrundfarbe",
  "View manufacturer spec page": "Datenblattseite des Herstellers öffnen",
  "Spec sheet": "Datenblatt",
  "Preset active for all “{name}” devices": "Preset aktiv für alle Geräte vom Typ „{name}“",
  "this template": "diese Vorlage",
  "Hostname:": "Hostname:",
  "e.g. nvx-room101": "z. B. nvx-raum101",

  // ─── Device editor: floorplan symbol & install info ────────────
  "Install cable": "Installationskabel",
  "e.g. Kabel aus Decke: 2x2,5 mm²": "z. B. Kabel aus Decke: 2x2,5 mm²",
  "Fixed installation cable for this model — appears in the floorplan legend row (saved with the template)":
    "Fest verlegtes Installationskabel für dieses Modell — erscheint in der Legendenzeile des Grundrisses (wird mit der Vorlage gespeichert)",
  "Install notes": "Installationshinweise",
  "e.g. Montage an der Decke; Kabel 5 cm von der Wand":
    "z. B. Montage an der Decke; Kabel 5 cm von der Wand",
  "Standing installation note for this model — listed under the floorplan legend's installation notes":
    "Dauerhafter Installationshinweis für dieses Modell — steht unter den Installationshinweisen der Grundriss-Legende",
  "Plan symbol": "Plansymbol",
  "Symbol on floorplans — abstract shape or a top-view pictogram; empty follows the device type":
    "Symbol auf Grundrissen — abstrakte Form oder Piktogramm in Draufsicht; leer richtet sich nach dem Gerätetyp",
  "Auto (by type)": "Automatisch (nach Typ)",
  "Symbol color on floorplans": "Symbolfarbe auf Grundrissen",
  "Up to two characters drawn inside the symbol": "Bis zu zwei Zeichen im Symbol",
  "Outline": "Kontur",
  "Outline color around the symbol body on floorplans":
    "Konturfarbe um den Symbolkörper auf Grundrissen",
  "Outline thickness on paper in mm. 0 draws no outline; empty scales with the symbol size.":
    "Konturstärke auf dem Papier in mm. 0 zeichnet keine Kontur; leer skaliert mit der Symbolgröße.",
  "Upload your own symbol for this model (PNG, JPG, WebP or SVG). Every plan that uses the model draws the picture instead of the shape.":
    "Eigenes Symbol für dieses Modell hochladen (PNG, JPG, WebP oder SVG). Jeder Plan mit diesem Modell zeichnet dann das Bild statt der Form.",
  "Replace symbol…": "Symbol ersetzen…",
  "Upload symbol…": "Symbol hochladen…",
  "Back to the drawn shape": "Zurück zur gezeichneten Form",
  "auto": "auto",

  // ─── Device editor: dimensions & rack ──────────────────────────
  "Physical Dimensions": "Abmessungen",
  "Height (mm)": "Höhe (mm)",
  "Width (mm)": "Breite (mm)",
  "Depth (mm)": "Tiefe (mm)",
  "Weight (kg)": "Gewicht (kg)",
  "e.g. 44": "z. B. 44",
  "e.g. 482": "z. B. 482",
  "e.g. 350": "z. B. 350",
  "e.g. 2.5": "z. B. 2.5",
  "Rack height:": "Rack-Höhe:",
  "(1U = 44.45 mm)": "(1 HE = 44,45 mm)",
  "Rack Form": "Rack-Form",
  "Auto (from size)": "Automatisch (nach Größe)",
  "Full width (19\")": "Volle Breite (19\")",
  "Half width (9.5\")": "Halbe Breite (9,5\")",
  "Shelf only": "Nur Fachboden",
  "Overrides how this device mounts in a rack. Auto infers from width & height.":
    "Legt fest, wie das Gerät im Rack sitzt. Automatisch leitet es aus Breite und Höhe ab.",

  // ─── Device editor: power ──────────────────────────────────────
  "PoE Source": "PoE-Quelle",
  "Budget (W)": "Budget (W)",
  "Powered by PoE": "Über PoE versorgt",
  "Draw (W)": "Aufnahme (W)",
  "Power Draw (W)": "Leistungsaufnahme (W)",
  "Power Capacity (W)": "Leistungsabgabe (W)",
  "Voltage": "Spannung",
  "Protection Class": "Schutzklasse",
  "Electrical protection class (IEC 61140). Carried into the Geräteprüfung in Odoo. Leave blank where it does not apply — passive speakers, patch panels, adapters.":
    "Elektrische Schutzklasse (IEC 61140). Fließt in die Geräteprüfung in Odoo ein. Leer lassen, wo sie nicht greift — passive Lautsprecher, Patchfelder, Adapter.",
  "— not applicable / unknown": "— nicht zutreffend / unbekannt",
  "I — earthed (PE)": "I — geerdet (PE)",
  "II — double insulated": "II — schutzisoliert",
  "III — SELV": "III — SELV",
  "Thermal load for HVAC sizing. Auto-derived from Power Draw × 3.412 if left blank.":
    "Wärmelast für die Klimaauslegung. Leer wird sie aus Leistungsaufnahme × 3,412 abgeleitet.",
  "auto: {n}": "auto: {n}",

  // ─── Device editor: search terms, cost, notes ──────────────────
  "Search Terms": "Suchbegriffe",
  "Search Terms ({n})": "Suchbegriffe ({n})",
  "Comma-separated keywords used to find this device in the library. Edit here and \"Submit to Community\" to contribute improvements back.":
    "Kommagetrennte Stichwörter, über die das Gerät in der Bibliothek gefunden wird. Hier bearbeiten und über „Submit to Community“ zurückgeben.",
  "e.g. matrix, router, video switcher": "z. B. Matrix, Router, Videokreuzschiene",
  "Cost & Procurement": "Kosten & Beschaffung",
  "Unit Cost ({currency})": "Stückpreis ({currency})",
  "Serial Number": "Seriennummer",
  "e.g. SN-00123": "z. B. SN-00123",
  "Own stock": "Eigener Bestand",
  "Other contractor": "Anderes Gewerk",
  "Cold spare": "Kaltreserve",
  "Free-text note": "Freitext-Notiz",
  "Shows in the pack list / device report.": "Erscheint in Packliste und Gerätebericht.",

  // ─── Device editor: auxiliary data ─────────────────────────────
  "Auxiliary Data": "Zusatzdaten",
  "Up to 5 custom lines. Use the": "Bis zu 5 eigene Zeilen. Über",
  "button to insert a device field. Leave a line blank to add a separator. Toggle":
    "ein Gerätefeld einfügen. Eine leere Zeile ergibt einen Trenner. Mit",
  "to pin a row to the header or footer of the device.":
    "eine Zeile am Kopf oder Fuß des Geräts verankern.",
  "Insert device field": "Gerätefeld einfügen",
  "Pinned to header — click to move to footer": "Am Kopf verankert — klicken, um sie an den Fuß zu setzen",
  "Pinned to footer — click to move to header": "Am Fuß verankert — klicken, um sie an den Kopf zu setzen",
  "(empty)": "(leer)",
  // AUX_FIELD_GROUPS group names
  "Identity": "Identität",
  "Physical": "Physisch",
  "Cost": "Kosten",
  // AUX field labels
  "Power Draw": "Leistungsaufnahme",
  "Power Capacity": "Leistungsabgabe",
  "PoE Budget": "PoE-Budget",
  "Weight": "Gewicht",
  "Unit Cost": "Stückpreis",
  "Total Ports": "Ports gesamt",
  "Input Ports": "Eingangs-Ports",
  "Output Ports": "Ausgangs-Ports",
  "Bidirectional Ports": "Bidirektionale Ports",
  "Connected Ports": "Belegte Ports",

  // ─── Device editor: flags ──────────────────────────────────────
  "Flags": "Merkmale",
  "Cable accessory": "Kabelzubehör",
  "Integrated with cable": "Fest am Kabel",
  "Visibility:": "Sichtbarkeit:",
  "Always Show": "Immer zeigen",
  "Always Hide": "Immer ausblenden",
  "Venue provided (exclude from pack list)":
    "Vom Veranstaltungsort gestellt (nicht in der Packliste)",

  // ─── Device editor: footer actions ─────────────────────────────
  "Save this device configuration as a reusable user template":
    "Diese Gerätekonfiguration als wiederverwendbare eigene Vorlage speichern",
  "Save as User Template": "Als eigene Vorlage speichern",
  "Submit this device to the community device library":
    "Dieses Gerät an die Community-Gerätebibliothek senden",
  "Submit to Community": "An die Community senden",
  "Overwrite the saved user template with this configuration and apply it to every instance on the schematic":
    "Die gespeicherte eigene Vorlage mit dieser Konfiguration überschreiben und auf jedes Exemplar im Schaltplan anwenden",
  "Update User Template": "Eigene Vorlage aktualisieren",
  "Save these changes as a new '(Custom)' user template and apply them to every instance of this device on the schematic":
    "Diese Änderungen als neue Vorlage „(Custom)“ speichern und auf jedes Exemplar dieses Geräts im Schaltplan anwenden",
  "Update as Custom": "Als eigene Vorlage aktualisieren",
  "Set this configuration as the project default for this template":
    "Diese Konfiguration als Projektvorgabe für diese Vorlage setzen",
  "Save as Preset": "Als Preset speichern",
  "Reset ports and visibility to the project preset":
    "Ports und Sichtbarkeit auf das Projekt-Preset zurücksetzen",
  "Revert to Preset": "Auf Preset zurücksetzen",
  "Reset ports and visibility to the original template defaults":
    "Ports und Sichtbarkeit auf die Vorgaben der Vorlage zurücksetzen",
  "Revert to Template": "Auf Vorlage zurücksetzen",
  "Update 1 other instance of this device on the current schematic?":
    "1 weiteres Exemplar dieses Geräts im aktuellen Schaltplan aktualisieren?",
  "Update {n} other instances of this device on the current schematic?":
    "{n} weitere Exemplare dieses Geräts im aktuellen Schaltplan aktualisieren?",
  "Updated 1 other instance on this schematic":
    "1 weiteres Exemplar in diesem Schaltplan aktualisiert",
  "Updated {n} other instances on this schematic":
    "{n} weitere Exemplare in diesem Schaltplan aktualisiert",
  "Create a \"(Custom)\" user template and update 1 other instance on the current schematic?":
    "Eine eigene Vorlage „(Custom)“ anlegen und 1 weiteres Exemplar im aktuellen Schaltplan aktualisieren?",
  "Create a \"(Custom)\" user template and update {n} other instances on the current schematic?":
    "Eine eigene Vorlage „(Custom)“ anlegen und {n} weitere Exemplare im aktuellen Schaltplan aktualisieren?",
  "Created \"{name}\"": "„{name}“ angelegt",
  "Created \"{name}\" and updated 1 other instance":
    "„{name}“ angelegt und 1 weiteres Exemplar aktualisiert",
  "Created \"{name}\" and updated {n} other instances":
    "„{name}“ angelegt und {n} weitere Exemplare aktualisiert",

  // ─── Port sections ─────────────────────────────────────────────
  "Bidirectional": "Bidirektional",
  "Passthrough Circuits": "Passthrough-Wege",
  "input": "Eingänge",
  "output": "Ausgänge",
  "bidirectional": "Bidirektional",
  "passthrough": "Passthrough",
  "Bulk Add": "Mehrere anlegen",
  // `{kind}` is the section title, lowercased by the caller — kept in parentheses
  // so the German sentence doesn't read as an uncapitalised noun.
  "No {kind} — click \"+ Add\" or drag a port here":
    "Nichts vorhanden ({kind}) — auf „+ Hinzufügen“ klicken oder einen Port hierher ziehen",
  "Port Visibility": "Port-Sichtbarkeit",
  "Show all ports (override filters)": "Alle Ports zeigen (Filter übergehen)",
  "Quick:": "Schnell:",
  "Show All": "Alle zeigen",
  "Hide All": "Alle ausblenden",
  "Hide on all “{name}” devices:": "Auf allen Geräten vom Typ „{name}“ ausblenden:",

  // ─── Bulk add forms ────────────────────────────────────────────
  "Prefix": "Präfix",
  "from": "von",
  "to": "bis",
  "Section:": "Abschnitt:",
  "(optional)": "(optional)",
  "Preview:": "Vorschau:",
  "Family:": "Familie:",
  "(optional, e.g. yamaha-my)": "(optional, z. B. yamaha-my)",
  "Add {n}": "{n} anlegen",

  // ─── Port row ──────────────────────────────────────────────────
  "Show port on schematic": "Port im Schaltplan zeigen",
  "Hide port on schematic": "Port im Schaltplan ausblenden",
  "Port label": "Port-Name",
  "(inherits from connection)": "(erbt von der Verbindung)",
  "Connector type": "Steckverbinder-Typ",
  "Connector gender (overridden)": "Steckerausführung (überschrieben)",
  "Connector gender (auto: {value})": "Steckerausführung (automatisch: {value})",
  "{value} (auto)": "{value} (auto)",
  "M": "M",
  "F": "F",
  "Male": "männlich",
  "Female": "weiblich",
  "Multicable trunk port": "Multicable-Trunk-Port",
  "Channel count": "Kanalzahl",
  "Multi-connect — port accepts multiple connections (SRT, wireless, custom signals)":
    "Multi-Connect — Port nimmt mehrere Verbindungen an (SRT, Funk, eigene Signale)",
  "Direct attach — plugs directly into device, no separate cable":
    "Direct Attach — steckt direkt am Gerät, kein eigenes Kabel",
  "Set section group": "Abschnitt festlegen",
  "Add note": "Notiz hinzufügen",
  "Flip port to opposite side": "Port auf die andere Seite legen",
  "Duplicate port": "Port duplizieren",
  "Remove port": "Port entfernen",
  "e.g. Cameras": "z. B. Kameras",
  "Note:": "Notiz:",
  "e.g. East wall plate, Drop 3": "z. B. Wandplatte Ost, Abgang 3",
  "Rear connector type": "Steckverbinder-Typ hinten",
  "Rear gender": "Ausführung hinten",
  "Front connector type": "Steckverbinder-Typ vorn",
  "Front gender": "Ausführung vorn",
  "(unset)": "(nicht gesetzt)",
  // CONNECTOR_GROUPS names
  "Network / Data": "Netzwerk / Daten",
  "D-Sub / Serial": "D-Sub / Seriell",
  "Speaker": "Lautsprecher",
  "Terminal": "Klemmen",
  "RF": "HF",
  "Other": "Sonstige",

  // ─── Port network / USB-C power ────────────────────────────────
  "Addressable (has IP)": "Adressierbar (hat IP)",
  "USB-C PD (W):": "USB-C PD (W):",
  "Delivers": "Liefert",
  "Watts this port can deliver (source — charger, dock, laptop)":
    "Watt, die dieser Port liefern kann (Quelle — Netzteil, Dock, Laptop)",
  "Draws": "Nimmt",
  "Watts this port consumes (sink — bus-powered device)":
    "Watt, die dieser Port aufnimmt (Senke — busgespeistes Gerät)",
  "Network (configured)": "Netzwerk (konfiguriert)",
  "DHCP": "DHCP",
  "IP Address": "IP-Adresse",
  "Subnet Mask": "Subnetzmaske",
  "Gateway": "Gateway",
  "VLAN": "VLAN",
  "VLAN must be 1-4094": "VLAN muss zwischen 1 und 4094 liegen",
  "PoE (W)": "PoE (W)",
  "Duplicate IP — also used by: {devices}": "Doppelte IP — wird auch benutzt von: {devices}",
  "DHCP Server": "DHCP-Server",
  "DHCP Server (active)": "DHCP-Server (aktiv)",
  "This device serves DHCP on its network":
    "Dieses Gerät stellt DHCP in seinem Netzwerk bereit",
  "Pool Start": "Pool-Start",
  "Pool End": "Pool-Ende",
  "Invalid IP": "Ungültige IP",
  "Invalid mask": "Ungültige Maske",

  // ─── Expansion slots ───────────────────────────────────────────
  "Expansion Slots": "Erweiterungs-Slots",
  "Expansion Slots ({n})": "Erweiterungs-Slots ({n})",
  "Add Slot": "Slot anlegen",
  "No expansion slots. Add a slot for devices with modular card bays.":
    "Keine Erweiterungs-Slots. Für Geräte mit modularen Kartenschächten einen Slot anlegen.",
  "Slot label": "Slot-Name",
  "family": "Familie",
  "Show empty slot on the device": "Leeren Slot am Gerät zeigen",
  "Hide empty slot on the device": "Leeren Slot am Gerät ausblenden",
  "This slot has {n} connection(s) that will be disconnected.":
    "An diesem Slot hängen {n} Verbindung(en), die getrennt werden.",
  "The installed card and its ports will be removed.":
    "Die eingebaute Karte und ihre Ports werden entfernt.",
  "Remove slot \"{name}\"?": "Slot „{name}“ entfernen?",
  "Remove slot": "Slot entfernen",
  "Swapping this card will disconnect {n} connection(s). Continue?":
    "Beim Kartentausch werden {n} Verbindung(en) getrennt. Fortfahren?",
  "(set slot family to enable)": "(Slot-Familie setzen, um zu aktivieren)",
  "Create custom card...": "Eigene Karte anlegen...",

  // ─── Port capabilities ─────────────────────────────────────────
  "Capabilities": "Fähigkeiten",
  "Capabilities (set)": "Fähigkeiten (gesetzt)",
  "Max Resolution (e.g. 3840x2160)": "Max. Auflösung (z. B. 3840x2160)",
  "Max FPS": "Max. FPS",
  "Bit Depth": "Farbtiefe",
  "Color Spaces (comma sep)": "Farbräume (kommagetrennt)",

  // ─── Loudspeaker / amplifier load ──────────────────────────────
  "Feeds the line load check on loudspeaker plans (modeled on the Bose PowerShareX Design Tool)":
    "Speist die Linienlast-Prüfung auf Lautsprecherplänen (nach dem Bose PowerShareX Design Tool)",
  "Load": "Last",
  "Load (loudspeaker line calculation)": "Last (Lautsprecherlinien-Berechnung)",
  "As a loudspeaker": "Als Lautsprecher",
  "As an amplifier": "Als Endstufe",
  "Impedance (Ω)": "Impedanz (Ω)",
  "Nominal impedance for low-impedance operation": "Nennimpedanz im Niederohmbetrieb",
  "Continuous power (W)": "Dauerleistung (W)",
  "RMS / pink-noise power handling from the datasheet":
    "RMS-/Rosa-Rauschen-Belastbarkeit laut Datenblatt",
  "Transformer tap settings in watts, highest first — empty when the model has no 70 V / 100 V transformer":
    "Übertrager-Abgriffe in Watt, größter zuerst — leer, wenn das Modell keinen 70-V-/100-V-Übertrager hat",
  "Taps 70/100 V (W)": "Abgriffe 70/100 V (W)",
  "Spectral profile — sets the crest factor that turns burst into average power":
    "Spektrales Profil — legt den Crestfaktor fest, der Burst- in Durchschnittsleistung umrechnet",
  "Profile": "Profil",
  "Full range (default)": "Full Range (Standard)",
  // PROFILE_LABELS
  "Full range": "Full Range",
  "Low band": "Tiefton",
  "Mid band": "Mittelton",
  "High band": "Hochton",
  "Channels": "Kanäle",
  "ports": "Ports",
  "Empty = number of speaker-level output ports": "Leer = Anzahl der Speaker-Level-Ausgänge",
  "Total rated (W)": "Nennleistung gesamt (W)",
  "sum": "Summe",
  "Rated power across all channels (the shared pool)":
    "Nennleistung über alle Kanäle (der gemeinsame Vorrat)",
  "Min load (Ω)": "Min. Last (Ω)",
  "W @ 8 Ω": "W @ 8 Ω",
  "W @ 4 Ω": "W @ 4 Ω",
  "W @ 2 Ω": "W @ 2 Ω",
  "W @ 70 V": "W @ 70 V",
  "W @ 100 V": "W @ 100 V",
  "Empty = no 70 V mode": "Leer = kein 70-V-Betrieb",
  "Empty = no 100 V mode": "Leer = kein 100-V-Betrieb",
  "Burst / ch (W)": "Burst / Kanal (W)",
  "Most one channel may take with the others idle":
    "Höchstwert für einen Kanal, wenn die übrigen ruhen",
  "Burst total (W)": "Burst gesamt (W)",
  "Average total (W)": "Durchschnitt gesamt (W)",
  "Long-term output the amplifier sustains; empty = 17.5 % of the rated total":
    "Dauerleistung, die die Endstufe hält; leer = 17,5 % der Nennleistung",
  "Peak V / A": "Spitze V / A",
  "V, auto": "V, auto",
  "Peak output voltage per channel": "Spitzen-Ausgangsspannung je Kanal",
  "Peak current (A)": "Spitzenstrom (A)",
};
