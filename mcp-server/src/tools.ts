/**
 * MCP tool catalog: the Ship-1 "working core" tools, the Ship-2 "editing & layout"
 * tools (move_device, delete_connection), the Ship-3 "batch" tools (add_devices,
 * connect_devices_batch), the Ship-4 "rooms" tools (create_room,
 * place_device_in_room), the Ship-5 "annotations" tool (add_note), the Ship-6
 * "slots / modular chassis" tools (list_slot_cards, install_card, remove_card), and the
 * Ship-7 "racks / rack elevation" tools (list_racks, create_rack, place_device_in_rack,
 * remove_device_from_rack), the Ship-8 "notes" tools (update_note, delete_note;
 * get_schematic also reports rooms + notes), and the Ship-9 "batch structural" tools
 * (install_card_batch, place_device_in_rack_batch), and the Ship-10 "floorplan" tools
 * (list_floorplans … delete_floorplan_note) that fill a scaled plan drawing. Each entry is a plain JSON-Schema tool
 * definition; the call is relayed verbatim to the editor over the bridge, which validates
 * and executes it against the live store.
 *
 * In AV terms the user sees Device / Connection / Port; these tool names and the
 * docs use the same AV language.
 */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const noArgs = { type: "object", properties: {}, additionalProperties: false };

export const TOOLS: ToolDef[] = [
  {
    name: "get_schematic",
    description:
      "Get a summary of the current schematic: its name, every device (with ports), every connection, every room (container) and every note (text annotation). Call this first to see what already exists. Note ids and room ids here feed update_note/delete_note and place_device_in_room.",
    inputSchema: noArgs,
  },
  {
    name: "list_devices",
    description: "List the devices on the canvas with their ids, labels, type, manufacturer and position.",
    inputSchema: noArgs,
  },
  {
    name: "get_device",
    description:
      "Get one device's details, including its ports (id, label, direction, signal type) and, for a modular chassis, its slots (id and slot family) — the slotId values that list_slot_cards and install_card need.",
    inputSchema: {
      type: "object",
      properties: { nodeId: { type: "string", description: "The device id." } },
      required: ["nodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "search_templates",
    description:
      "Search the device template library (community library + this schematic's custom devices) by name, type or manufacturer. Returns templateId values to pass to add_device.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search, e.g. 'crestron switcher' or 'display'." },
        limit: { type: "number", description: "Max results (default 25)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "add_device",
    description:
      "Add a device to the canvas from a template. Use search_templates to get a templateId. Returns the new device's id.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "string", description: "Template id from search_templates." },
        label: { type: "string", description: "Optional custom name; defaults to the template name." },
        x: { type: "number", description: "Optional canvas X position." },
        y: { type: "number", description: "Optional canvas Y position." },
      },
      required: ["templateId"],
      additionalProperties: false,
    },
  },
  {
    name: "set_device_property",
    description:
      "Set safe properties on a device (e.g. label, shortName, manufacturer, modelNumber, note, serialNumber, unitCost, power figures). Structural fields like ports and slots are not editable in this Beta and are rejected.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "The device id." },
        properties: {
          type: "object",
          description: "Map of field name to new value (string, number or boolean).",
        },
      },
      required: ["nodeId", "properties"],
      additionalProperties: false,
    },
  },
  {
    name: "connect_devices",
    description:
      "Create a connection from one device's port to another's. For two-sided ports give the face: bidirectional ports use 'in'/'out'; passthrough ports use 'rear'/'front'. Plain ports need no face. The connection is validated before it is made.",
    inputSchema: {
      type: "object",
      properties: {
        sourceNodeId: { type: "string" },
        sourcePortId: { type: "string" },
        sourceFace: { type: "string", enum: ["in", "out", "rear", "front"], description: "Required only for two-sided source ports." },
        targetNodeId: { type: "string" },
        targetPortId: { type: "string" },
        targetFace: { type: "string", enum: ["in", "out", "rear", "front"], description: "Required only for two-sided target ports." },
      },
      required: ["sourceNodeId", "sourcePortId", "targetNodeId", "targetPortId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_device",
    description: "Delete a device (and its connections) from the canvas.",
    inputSchema: {
      type: "object",
      properties: { nodeId: { type: "string", description: "The device id." } },
      required: ["nodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "move_device",
    description:
      "Reposition a device on the canvas. x and y are in the same coordinate space get_device/get_schematic report for that device — canvas coordinates for a top-level device, or coordinates relative to its room/rack when the device has a parentId. This moves the device within its current container; it does not move a device into or out of a room or rack.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "The device id." },
        x: { type: "number", description: "New X position." },
        y: { type: "number", description: "New Y position." },
      },
      required: ["nodeId", "x", "y"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_connection",
    description:
      "Remove a single connection from the canvas by its id (the connection ids are returned by get_schematic and connect_devices). Stubbed connections cannot be removed this way yet.",
    inputSchema: {
      type: "object",
      properties: {
        connectionId: { type: "string", description: "The connection (edge) id to remove." },
      },
      required: ["connectionId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_devices",
    description:
      "Add several devices to the canvas in one call — use this instead of repeated add_device calls when placing many devices. Best-effort: each device is added independently, and the result lists per-device success or failure (with the new device id) so you can retry only the ones that failed.",
    inputSchema: {
      type: "object",
      properties: {
        devices: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          description: "The devices to add.",
          items: {
            type: "object",
            properties: {
              templateId: { type: "string", description: "Template id from search_templates." },
              label: { type: "string", description: "Optional custom name; defaults to the template name." },
              x: { type: "number", description: "Optional canvas X position." },
              y: { type: "number", description: "Optional canvas Y position." },
            },
            required: ["templateId"],
            additionalProperties: false,
          },
        },
      },
      required: ["devices"],
      additionalProperties: false,
    },
  },
  {
    name: "connect_devices_batch",
    description:
      "Make several connections in one call — use this instead of repeated connect_devices calls. Best-effort: each connection is attempted independently and the result lists per-connection success or failure. Connections are applied in array order, so an earlier one can affect a later one (for example, using up a single-link port). For two-sided ports give the face: bidirectional ports use 'in'/'out'; passthrough ports use 'rear'/'front'.",
    inputSchema: {
      type: "object",
      properties: {
        connections: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          description: "The connections to make.",
          items: {
            type: "object",
            properties: {
              sourceNodeId: { type: "string" },
              sourcePortId: { type: "string" },
              sourceFace: { type: "string", enum: ["in", "out", "rear", "front"], description: "Required only for two-sided source ports." },
              targetNodeId: { type: "string" },
              targetPortId: { type: "string" },
              targetFace: { type: "string", enum: ["in", "out", "rear", "front"], description: "Required only for two-sided target ports." },
            },
            required: ["sourceNodeId", "sourcePortId", "targetNodeId", "targetPortId"],
            additionalProperties: false,
          },
        },
      },
      required: ["connections"],
      additionalProperties: false,
    },
  },
  {
    name: "create_room",
    description:
      "Create a room — a labelled container on the canvas that devices can be placed inside (use place_device_in_room). Returns the new room's id. width/height are optional (default 400x300; minimums 200x150). Any existing devices already inside the new room's bounds are absorbed into it and listed in absorbedDeviceIds (their coordinates become relative to the room, so re-read them before reusing old positions).",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "The room's name, shown on the canvas." },
        x: { type: "number", description: "Room top-left X position on the canvas." },
        y: { type: "number", description: "Room top-left Y position on the canvas." },
        width: { type: "number", description: "Optional room width (minimum 200; default 400)." },
        height: { type: "number", description: "Optional room height (minimum 150; default 300)." },
      },
      required: ["label", "x", "y"],
      additionalProperties: false,
    },
  },
  {
    name: "place_device_in_room",
    description:
      "Place a device inside a room. x and y are the device's position relative to the room's top-left corner (default 16,16). The device's center must land inside the room or the call fails without changing anything, so a device is never reported as placed when it isn't. To reposition a device that is already in a room, use move_device instead.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The device id." },
        roomId: { type: "string", description: "The room id (from get_schematic or create_room)." },
        x: { type: "number", description: "Optional X relative to the room's top-left corner (default 16)." },
        y: { type: "number", description: "Optional Y relative to the room's top-left corner (default 16)." },
      },
      required: ["deviceId", "roomId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_note",
    description:
      "Add a text note (a sticky-note card) to the canvas to annotate or explain the schematic. The text is shown literally (it is escaped, and line breaks are kept). Returns the new note's id. Notes can't yet be listed, edited, or deleted through the assistant — do that in the editor.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The note's text. Shown literally; newlines become line breaks." },
        x: { type: "number", description: "Note top-left X position on the canvas." },
        y: { type: "number", description: "Note top-left Y position on the canvas." },
      },
      required: ["text", "x", "y"],
      additionalProperties: false,
    },
  },
  {
    name: "list_slot_cards",
    description:
      "List the expansion cards that fit a given slot on a modular device (chassis). A device's slots come from get_device. Returns the card templateId values to pass to install_card. If the full community library hasn't been loaded yet this session, call search_templates once first so live-library cards are included.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The modular device (chassis) id." },
        slotId: { type: "string", description: "The slot id from get_device's slots." },
      },
      required: ["deviceId", "slotId"],
      additionalProperties: false,
    },
  },
  {
    name: "install_card",
    description:
      "Install an expansion card into an empty slot on a modular device. Use list_slot_cards to get a compatible card templateId. The card's slot family must match the slot's, or the call is refused. If the slot already holds a card, remove it first with remove_card (installing never silently replaces a card). Returns the installed card and the ids of the ports it added.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The modular device (chassis) id." },
        slotId: { type: "string", description: "The empty slot's id from get_device's slots." },
        cardTemplateId: { type: "string", description: "A card templateId from list_slot_cards." },
      },
      required: ["deviceId", "slotId", "cardTemplateId"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_card",
    description:
      "Remove the card from a filled slot on a modular device, emptying the slot. This also removes the card's ports and any connections on them. Fails if the slot is already empty.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The modular device (chassis) id." },
        slotId: { type: "string", description: "The filled slot's id from get_device's slots." },
      },
      required: ["deviceId", "slotId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_racks",
    description:
      "List the rack elevations: every rack-elevation page, each rack on it (id, label, type, height in U, depth) and the devices currently placed in each rack (placementId, device, U position, face). Rack elevations are a separate view from the schematic canvas. Call this first to get the pageId/rackId/placementId values the other rack tools need.",
    inputSchema: noArgs,
  },
  {
    name: "create_rack",
    description:
      "Create an equipment rack. If pageId is omitted a new rack-elevation page is created to hold it; pass a pageId from list_racks to add the rack to an existing page. Returns the new pageId and rackId. Height (U) and depth (mm) are clamped to the editor's ranges (2–60U, 100–2000mm).",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Rack name (default \"Rack\")." },
        heightU: { type: "number", description: "Rack height in rack units (2–60, default 42)." },
        rackType: {
          type: "string",
          enum: ["floor-19", "wall-mount", "desktop", "open-2post", "open-4post"],
          description: "Rack enclosure type (default \"floor-19\").",
        },
        depthMm: { type: "number", description: "Rack depth in mm (100–2000, default 600)." },
        pageId: { type: "string", description: "Existing rack-elevation page id from list_racks. Omit to create a new page." },
        pageLabel: { type: "string", description: "Name for the new rack page (used only when pageId is omitted; default \"Rack Elevation\")." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "place_device_in_rack",
    description:
      "Mount a device from the schematic into a rack at a U position. The device's height in U is inferred from its physical dimensions, and half-rack gear is placed on a free side automatically. Gear too small to rack-mount directly is placed on an auto-created 1U shelf (the response includes that shelfId; remove_device_from_rack cleans the shelf up for you unless you've since edited it in the editor). Fails if the U span is occupied or out of the rack's bounds, if the device is already placed in a rack (remove it first), for a rear placement on a 2-post rack, or if the device is too wide to fit a 19\" rack. uPosition is 1-based from the bottom.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The device id from get_schematic / list_devices." },
        rackId: { type: "string", description: "The target rack id from list_racks." },
        uPosition: { type: "number", description: "Bottom U position (1-based, from the bottom)." },
        face: { type: "string", enum: ["front", "rear"], description: "Which face to mount on (default \"front\")." },
      },
      required: ["deviceId", "rackId", "uPosition"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_device_from_rack",
    description:
      "Remove a device's rack placement (from list_racks) so its U position frees up. The device stays on the schematic; only its position in the rack is removed. If the device sat on a 1U shelf that this bridge auto-created for it (and you haven't adopted that shelf by editing it or adding another device), the empty shelf is removed too (its id is returned as removedShelfId).",
    inputSchema: {
      type: "object",
      properties: {
        placementId: { type: "string", description: "The placement id from list_racks." },
      },
      required: ["placementId"],
      additionalProperties: false,
    },
  },
  {
    name: "update_note",
    description:
      "Replace the text of an existing note (text annotation). Get note ids from get_schematic. The text is shown literally (HTML-escaped) and newlines become line breaks; this replaces the note's whole content, so a note with rich formatting from the editor becomes plain text.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "The note id from get_schematic's notes." },
        text: { type: "string", description: "The new note text." },
      },
      required: ["noteId", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_note",
    description:
      "Delete a note (text annotation) by id. Get note ids from get_schematic. Only the note is removed; devices, rooms and connections are untouched.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "The note id from get_schematic's notes." },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
  {
    name: "install_card_batch",
    description:
      "Install several expansion cards into modular-chassis slots in one call — use this instead of repeated install_card calls. Best-effort: each install is attempted independently and the result lists per-item success or failure. Items are applied in array order, so an earlier install can affect a later one (two installs into the same slot leave only the first; a card that adds sub-slots can make a later install into one of them valid). Each card's slot family must match its slot, and a filled slot is never silently overwritten.",
    inputSchema: {
      type: "object",
      properties: {
        installs: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          description: "The cards to install.",
          items: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "The modular device (chassis) id." },
              slotId: { type: "string", description: "The empty slot's id from get_device's slots." },
              cardTemplateId: { type: "string", description: "A card templateId from list_slot_cards." },
            },
            required: ["deviceId", "slotId", "cardTemplateId"],
            additionalProperties: false,
          },
        },
      },
      required: ["installs"],
      additionalProperties: false,
    },
  },
  {
    name: "place_device_in_rack_batch",
    description:
      "Mount several devices into racks in one call — use this instead of repeated place_device_in_rack calls. Best-effort: each placement is attempted independently and the result lists per-item success or failure. Placements are applied in array order, so an earlier one can affect a later one (it consumes the U span / half-rack side; a device already placed by an earlier item is rejected by a later one). Each item names its own rack; the same occupancy, 2-post-rear, already-placed, oversize and shelf-only (auto-shelf) handling as place_device_in_rack applies per item.",
    inputSchema: {
      type: "object",
      properties: {
        placements: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          description: "The rack placements to make.",
          items: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "The device id from get_schematic / list_devices." },
              rackId: { type: "string", description: "The target rack id from list_racks." },
              uPosition: { type: "number", description: "Bottom U position (1-based, from the bottom)." },
              face: { type: "string", enum: ["front", "rear"], description: "Which face to mount on (default \"front\")." },
            },
            required: ["deviceId", "rackId", "uPosition"],
            additionalProperties: false,
          },
        },
      },
      required: ["placements"],
      additionalProperties: false,
    },
  },
  // ── Floorplans (Ship 10) ─────────────────────────────────────────
  {
    name: "list_floorplans",
    description:
      "List the floorplan pages — scaled plan drawings built on an architect's drawing. For each page: paper, scale, the real-world extent the sheet covers in metres, whether an underlay is imported and calibrated, the symbol groups (legend rows) with their groupIds, every placed symbol (symbolId, number, linked device, position in metres), the legend box text, the drawing block (title, fields, revision table, disclaimer) and the free text notes. Positions are real-world METRES from the top-left corner of the sheet's drawing area, x right, y down. Call this first to get the pageId / groupId / symbolId / noteId values the other floorplan tools need.",
    inputSchema: noArgs,
  },
  {
    name: "create_floorplan",
    description:
      "Create a floorplan page (default A1 landscape at 1:50) and return its summary. The architect's drawing itself (PDF/image underlay) has to be imported and calibrated in the editor by the user — say so if it is missing. Then add symbol groups, place symbols, and fill the legend and drawing block.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Tab name and default drawing title, e.g. \"Erdgeschoss\" / \"Ground floor\"." },
        paperId: { type: "string", description: "Paper id: iso-a0, iso-a1 (default), iso-a2, iso-a3, iso-a4, letter, tabloid, ansi-c … arch-e." },
        orientation: { type: "string", enum: ["landscape", "portrait"], description: "Default landscape." },
        scaleDenominator: { type: "number", description: "Drawing scale denominator — 50 means 1:50 (default 50)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_floorplan",
    description: "Rename a floorplan page or change its paper, orientation or drawing scale. Changing the scale re-fits the underlay so the building keeps its real size; symbols keep their real-world positions.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Floorplan page id from list_floorplans." },
        label: { type: "string" },
        paperId: { type: "string" },
        orientation: { type: "string", enum: ["landscape", "portrait"] },
        scaleDenominator: { type: "number", description: "50 means 1:50." },
      },
      required: ["pageId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_floorplan_group",
    description:
      "Add a symbol group to a floorplan — one legend row: a color, a shape and the model it stands for (e.g. \"LS Gastro\" / \"Bose DM6SE black | cable 2×2.5 mm²\"). Returns the groupId that place_floorplan_symbols needs. Set labelPrefix (\"1.1\" or \"SB.\") to seed the group's auto-numbering.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Floorplan page id from list_floorplans." },
        label: { type: "string", description: "Legend headline, e.g. \"Ceiling speakers\"." },
        color: { type: "string", description: "#rrggbb. Omit to take the next palette color." },
        shape: { type: "string", enum: ["circle", "square", "triangle", "diamond"], description: "Default circle." },
        description: { type: "string", description: "Legend sub-line: model, finish, cable spec." },
        labelPrefix: { type: "string", description: "Numbering seed: \"1.1\" → 1.1, 1.2 …; \"SB.\" → SB.1, SB.2 …" },
        templateId: { type: "string", description: "Device template this group stands for (from search_templates / get_device). The template brings its legend line — manufacturer, model and the fixed install cable written on it — its product image and its standing install note (appended to the legend's notes), unless you pass description/imageUrl yourself." },
        imageCaption: { type: "string", description: "Caption for the group's product image in the legend, e.g. \"DM6SE\" (defaults to the template's model number)." },
        imageUrl: { type: "string", description: "https URL of the product shot for the legend. Defaults to the template's image when templateId is given." },
        hiddenInLegend: { type: "boolean", description: "Keep the group off the legend box." },
      },
      required: ["pageId", "label"],
      additionalProperties: false,
    },
  },
  {
    name: "update_floorplan_group",
    description: "Change a symbol group's label, color, shape, description, numbering prefix, template binding, image caption or legend visibility. Only the properties you pass change.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        groupId: { type: "string", description: "Group id from list_floorplans / add_floorplan_group." },
        label: { type: "string" },
        color: { type: "string", description: "#rrggbb" },
        shape: { type: "string", enum: ["circle", "square", "triangle", "diamond"] },
        description: { type: "string" },
        labelPrefix: { type: "string" },
        templateId: { type: "string" },
        imageCaption: { type: "string" },
        imageUrl: { type: "string", description: "https URL of the product shot; empty string removes it." },
        hiddenInLegend: { type: "boolean" },
      },
      required: ["pageId", "groupId"],
      additionalProperties: false,
    },
  },
  {
    name: "place_floorplan_symbols",
    description:
      "Place device symbols on a floorplan in one call (best-effort, per-item results, applied in array order). Each symbol belongs to a group (its legend row) and may link a schematic device (deviceId from get_schematic) so the plan and the signal flow describe the same gear. Positions are real-world METRES from the drawing area's top-left corner; a position beyond what the sheet covers at its scale is rejected (list_floorplans reports the covered extent). Omit label to continue the group's numbering (4.1 → 4.2, SB.1 → SB.2).",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Floorplan page id from list_floorplans." },
        symbols: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            properties: {
              groupId: { type: "string", description: "Group id from list_floorplans / add_floorplan_group." },
              deviceId: { type: "string", description: "Schematic device id this symbol stands for (optional)." },
              xM: { type: "number", description: "Metres from the drawing area's left edge." },
              yM: { type: "number", description: "Metres from the drawing area's top edge." },
              label: { type: "string", description: "Symbol number, e.g. \"4.1\". Omit to auto-number." },
              notes: { type: "string", description: "Per-symbol remark, kept in the plan's schedule." },
            },
            required: ["groupId", "xM", "yM"],
            additionalProperties: false,
          },
        },
      },
      required: ["pageId", "symbols"],
      additionalProperties: false,
    },
  },
  {
    name: "update_floorplan_symbol",
    description: "Move, renumber, regroup or relink one symbol. Positions in metres as in place_floorplan_symbols; pass deviceId null to unlink the device.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        symbolId: { type: "string", description: "Symbol id from list_floorplans / place_floorplan_symbols." },
        groupId: { type: "string" },
        deviceId: { type: ["string", "null"], description: "Link another device, or null to unlink." },
        xM: { type: "number" },
        yM: { type: "number" },
        label: { type: "string" },
        notes: { type: "string" },
      },
      required: ["pageId", "symbolId"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_floorplan_symbol",
    description: "Remove one symbol from a floorplan. The linked device stays on the schematic.",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string" }, symbolId: { type: "string" } },
      required: ["pageId", "symbolId"],
      additionalProperties: false,
    },
  },
  {
    name: "set_floorplan_legend",
    description:
      "Fill the legend box: its headline (e.g. \"BESCHALLUNG – LEGENDE & MONTAGE\"), the heading above the installation notes (e.g. \"MONTAGEHINWEISE\") and the notes themselves — one string per printed line, such as mounting instructions and cable specs per model. The rows of the legend (color, model, description) come from the symbol groups automatically. Only the properties you pass change; notes replaces the whole list.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        visible: { type: "boolean" },
        title: { type: "string" },
        notesTitle: { type: "string" },
        notes: { type: "array", items: { type: "string" }, description: "Installation notes, one per line." },
        showImages: { type: "boolean", description: "Show each group's product image." },
        onlyUsedGroups: { type: "boolean", description: "List only groups that have symbols on this plan." },
      },
      required: ["pageId"],
      additionalProperties: false,
    },
  },
  {
    name: "set_floorplan_drawing_block",
    description:
      "Fill the drawing block (title block / Plankopf) of a floorplan: the drawing title (\"Erdgeschoss\"), a subtitle, the label/value field grid (project, client, scale, sheet, date, drawn by …), the revision table, the small-print disclaimer, logo and north arrow. Field values may use tokens that resolve from the project title block and the page: {{showName}} {{venue}} {{designer}} {{engineer}} {{date}} {{drawingTitle}} {{company}} {{revision}} {{scale}} {{sheetSize}} {{pageLabel}} {{projectName}}. fields and revisions REPLACE the existing lists; to append one issue use add_floorplan_revision. Only the properties you pass change. The block's position on the sheet is dragged in the editor.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        visible: { type: "boolean" },
        title: { type: "string", description: "Drawing title, tokens allowed." },
        subtitle: { type: "string" },
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "e.g. \"Bauvorhaben\"" },
              value: { type: "string", description: "Text or a {{token}}." },
              wide: { type: "boolean", description: "Span both columns (addresses)." },
            },
            required: ["label", "value"],
            additionalProperties: false,
          },
        },
        revisions: {
          type: "array",
          description: "Whole revision history, oldest first.",
          items: {
            type: "object",
            properties: {
              index: { type: "string", description: "\"A\", \"B\", \"01\" … omit to continue the sequence." },
              date: { type: "string", description: "As printed, e.g. \"04.09.26\". Omit for today." },
              description: { type: "string" },
              author: { type: "string", description: "Drawn by (initials)." },
              checkedBy: { type: "string", description: "Checked by (initials)." },
            },
            required: ["description"],
            additionalProperties: false,
          },
        },
        revisionHeaders: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: { type: "string" },
          description: "Column headers: index, date, description, author, checked — e.g. [\"Index\",\"Datum\",\"Änderungen\",\"Bearb.\",\"Gepr.\"].",
        },
        disclaimer: { type: "string", description: "Small print above the title." },
        showLogo: { type: "boolean" },
        showNorthArrow: { type: "boolean" },
        northRotationDeg: { type: "number", description: "Clockwise degrees; 0 = north up the sheet." },
      },
      required: ["pageId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_floorplan_revision",
    description: "Append one issue to a floorplan's revision table. Index and date default to the next letter/number in the sequence and today's date (dd.mm.yy).",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        description: { type: "string", description: "What changed in this issue." },
        index: { type: "string" },
        date: { type: "string" },
        author: { type: "string" },
        checkedBy: { type: "string" },
      },
      required: ["pageId", "description"],
      additionalProperties: false,
    },
  },
  {
    name: "add_floorplan_notes",
    description:
      "Add free text notes to a floorplan in one call (best-effort, per-item results) — installation hints and remarks written next to the symbols they concern (\"Automatiktür schließen\", \"Decke verstärken 1,2 × 0,6 m\"). Positions are real-world metres from the drawing area's top-left corner, like symbols. Notes wrap at widthMm (paper mm, default 60) and print at fontSizeMm (default 2.8).",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        notes: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              xM: { type: "number" },
              yM: { type: "number" },
              widthMm: { type: "number", description: "Wrap width in paper mm (default 60)." },
              fontSizeMm: { type: "number", description: "Text size in paper mm (default 2.8)." },
              boxed: { type: "boolean", description: "White box behind the text (default true)." },
              color: { type: "string", description: "#rrggbb text color." },
            },
            required: ["text", "xM", "yM"],
            additionalProperties: false,
          },
        },
      },
      required: ["pageId", "notes"],
      additionalProperties: false,
    },
  },
  {
    name: "update_floorplan_note",
    description: "Change a floorplan note's text, position (metres), wrap width, size, box or color. Only the properties you pass change.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        noteId: { type: "string", description: "Note id from list_floorplans / add_floorplan_notes." },
        text: { type: "string" },
        xM: { type: "number" },
        yM: { type: "number" },
        widthMm: { type: "number" },
        fontSizeMm: { type: "number" },
        boxed: { type: "boolean" },
        color: { type: "string" },
      },
      required: ["pageId", "noteId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_floorplan_note",
    description: "Delete a free text note from a floorplan.",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string" }, noteId: { type: "string" } },
      required: ["pageId", "noteId"],
      additionalProperties: false,
    },
  },
  {
    name: "set_floorplan_masks",
    description:
      "Replace the white covers laid over the architect's plan — the way to take its legend, revision table, notes or title block out of the print so ours stand alone. Rectangles are in PAPER millimetres from the sheet's top-left corner (the sheet has the plan's format; list_floorplans reports our legend's and drawing block's positions in the same units). Pass [] to remove all covers. Only use where the user wants parts of the original plan gone.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        masks: {
          type: "array",
          maxItems: 100,
          items: {
            type: "object",
            properties: {
              xMm: { type: "number" }, yMm: { type: "number" },
              wMm: { type: "number" }, hMm: { type: "number" },
            },
            required: ["xMm", "yMm", "wMm", "hMm"],
            additionalProperties: false,
          },
        },
      },
      required: ["pageId", "masks"],
      additionalProperties: false,
    },
  },
];
