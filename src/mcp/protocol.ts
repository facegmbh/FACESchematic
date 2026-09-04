/**
 * Shared wire protocol for the EasySchematic MCP bridge (Beta).
 *
 * This is the single source of truth for the messages exchanged between:
 *   - the standalone MCP server (`mcp-server/`, a Node process Claude attaches to), and
 *   - the in-app bridge (`src/mcpBridge.ts`, a WebSocket client inside the running editor).
 *
 * It MUST stay dependency-free (no imports from the rest of `src/`) so the server's
 * own TypeScript build can include this exact file without pulling in the app. Keep it
 * to plain types + constants.
 */

/** Default localhost port the MCP server listens on and the app dials. Both sides
 *  share this constant; either may override it (server via env, app via the setting). */
export const DEFAULT_BRIDGE_PORT = 8765;

/** Bumped when the message shapes change incompatibly, so a mismatched server/app pair
 *  refuses to pair instead of misbehaving. */
export const PROTOCOL_VERSION = 1;

/** The bridge tools: the eight Ship-1 "working core" tools, the two Ship-2
 *  "editing & layout" tools (move_device, delete_connection), the two Ship-3
 *  "batch" tools (add_devices, connect_devices_batch), the two Ship-4
 *  "rooms" tools (create_room, place_device_in_room), the Ship-5
 *  "annotations" tool (add_note), the three Ship-6 "slots / modular chassis"
 *  tools (list_slot_cards, install_card, remove_card), and the four Ship-7
 *  "racks / rack elevation" tools (list_racks, create_rack, place_device_in_rack,
 *  remove_device_from_rack), the two Ship-8 "notes" tools (update_note,
 *  delete_note — get_schematic also now reports rooms + notes), the two Ship-9
 *  "batch structural" tools (install_card_batch, place_device_in_rack_batch), and the
 *  Ship-10 "floorplan" tools (list_floorplans … delete_floorplan_note) that fill a scaled
 *  plan drawing: symbol groups, device symbols, the legend box, the drawing block with
 *  its revision table, and free text notes. */
export type CommandType =
  | "get_schematic"
  | "list_devices"
  | "get_device"
  | "search_templates"
  | "add_device"
  | "set_device_property"
  | "connect_devices"
  | "delete_device"
  | "move_device"
  | "delete_connection"
  | "add_devices"
  | "connect_devices_batch"
  | "create_room"
  | "place_device_in_room"
  | "add_note"
  | "list_slot_cards"
  | "install_card"
  | "remove_card"
  | "list_racks"
  | "create_rack"
  | "place_device_in_rack"
  | "remove_device_from_rack"
  | "update_note"
  | "delete_note"
  | "install_card_batch"
  | "place_device_in_rack_batch"
  | "list_floorplans"
  | "create_floorplan"
  | "update_floorplan"
  | "add_floorplan_group"
  | "update_floorplan_group"
  | "place_floorplan_symbols"
  | "update_floorplan_symbol"
  | "remove_floorplan_symbol"
  | "set_floorplan_legend"
  | "set_floorplan_drawing_block"
  | "add_floorplan_revision"
  | "add_floorplan_notes"
  | "update_floorplan_note"
  | "delete_floorplan_note"
  | "set_floorplan_masks"
  | "list_floorplan_lines"
  | "sync_floorplan_lines"
  | "update_floorplan_line"
  | "speaker_load_report";

/** Max items accepted by a single batch tool call (input arrives over the bridge,
 *  so it is capped). The mcp-server tool schemas mirror this as `maxItems`. */
export const MAX_BATCH_ITEMS = 100;

/** Which two-sided face of a port to wire. Required only for bidirectional ports
 *  (`in`/`out`) and passthrough ports (`rear`/`front`); ignored for plain ports. */
export type PortFace = "in" | "out" | "rear" | "front";

/** The rack enclosure types, mirroring `RackType` in `src/types.ts`. Kept here as the
 *  single source the bridge validates against (create_rack); the server tool schema
 *  mirrors the same five values. */
export const RACK_TYPES = ["floor-19", "wall-mount", "desktop", "open-2post", "open-4post"] as const;

/** Symbol shapes a floorplan group may use, mirroring `FloorplanSymbolShape` in `src/types.ts`. */
export const FLOORPLAN_SHAPES = ["circle", "square", "triangle", "diamond"] as const;

// ---------------------------------------------------------------------------
// App -> server: handshake. The app proves it is the real editor (token) and the
// server validates token + Origin before accepting any commands.
// ---------------------------------------------------------------------------
export interface HelloMessage {
  type: "hello";
  /** Pairing token the user copied from the server into the app's Preferences. */
  token: string;
  protocolVersion: number;
  /** Stable id for this browser tab, so the server can report which tab is bound. */
  clientId: string;
  /** Human-friendly name of the open schematic, surfaced to Claude. */
  schematicName?: string;
}

/** Server -> app: result of the handshake. */
export interface HelloAck {
  type: "hello_ack";
  ok: boolean;
  /** When ok=false, why pairing was refused (bad token, version mismatch, etc.). */
  reason?: string;
}

/** Server -> app: a tool invocation to run against the store. */
export interface CommandMessage {
  type: "command";
  requestId: string;
  command: CommandType;
  params: Record<string, unknown>;
}

/** App -> server: the correlated result of a CommandMessage. */
export interface ResponseMessage {
  type: "response";
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** Server -> app: sent when this tab is being unbound because another tab claimed
 *  the connection, so the app can show an honest "disconnected" status. */
export interface SupersededMessage {
  type: "superseded";
  reason: string;
}

/** Messages the app may send to the server. */
export type BridgeClientMessage = HelloMessage | ResponseMessage;
/** Messages the server may send to the app. */
export type BridgeServerMessage = HelloAck | CommandMessage | SupersededMessage;

// ---------------------------------------------------------------------------
// Tool parameter shapes (documented contract; validated on both ends).
// ---------------------------------------------------------------------------
export interface AddDeviceParams {
  /** Template identity to instantiate — get one from `search_templates`. */
  templateId: string;
  /** Optional custom label; defaults to the template's name. */
  label?: string;
  /** Canvas position; defaults to a free spot near origin when omitted. */
  x?: number;
  y?: number;
}

export interface SetDevicePropertyParams {
  nodeId: string;
  /** Only keys in SAFE_DEVICE_FIELDS are applied; anything else is rejected. */
  properties: Record<string, string | number | boolean>;
}

export interface ConnectDevicesParams {
  sourceNodeId: string;
  sourcePortId: string;
  sourceFace?: PortFace;
  targetNodeId: string;
  targetPortId: string;
  targetFace?: PortFace;
}

export interface GetDeviceParams {
  nodeId: string;
}

export interface SearchTemplatesParams {
  query: string;
  limit?: number;
}

export interface DeleteDeviceParams {
  nodeId: string;
}

export interface MoveDeviceParams {
  nodeId: string;
  /** New position in the SAME coordinate space get_device/get_schematic report for
   *  this device: canvas coordinates for a top-level device, or coordinates relative
   *  to its room/rack when the device has a parentId. Does not change containment. */
  x: number;
  y: number;
}

export interface DeleteConnectionParams {
  /** The connection (edge) id from get_schematic / connect_devices. */
  connectionId: string;
}

export interface AddDevicesParams {
  /** Devices to add in one call; each is added independently (best-effort). */
  devices: AddDeviceParams[];
}

export interface ConnectDevicesBatchParams {
  /** Connections to make in one call; each is attempted independently in array
   *  order (best-effort), so an earlier connection can affect a later one. */
  connections: ConnectDevicesParams[];
}

export interface CreateRoomParams {
  /** The room's name, shown on the canvas. */
  label: string;
  /** Room top-left position in canvas coordinates. */
  x: number;
  y: number;
  /** Optional room size; both are required together when given. Defaults to
   *  400x300. Minimums mirror the editor: width >= 200, height >= 150. */
  width?: number;
  height?: number;
}

export interface PlaceDeviceInRoomParams {
  /** The device to place inside the room. */
  deviceId: string;
  /** The target room (container) id from get_schematic / create_room. */
  roomId: string;
  /** Position relative to the room's top-left corner; defaults to (16,16). The
   *  device's center must land inside the room or the call fails (nothing changes). */
  x?: number;
  y?: number;
}

export interface AddNoteParams {
  /** Plain text for the note card. It is HTML-escaped on the way in (the note
   *  renders as HTML), so it always shows literally; newlines become line breaks. */
  text: string;
  /** Note top-left position in canvas coordinates. */
  x: number;
  y: number;
}

export interface ListSlotCardsParams {
  /** The modular device (chassis) whose slot you want cards for. */
  deviceId: string;
  /** A slot id from get_device's `slots`. */
  slotId: string;
}

export interface InstallCardParams {
  /** The modular device (chassis) to install the card into. */
  deviceId: string;
  /** The (empty) slot's id, from get_device's `slots`. */
  slotId: string;
  /** A card templateId from list_slot_cards. Its slot family must match the slot's. */
  cardTemplateId: string;
}

export interface RemoveCardParams {
  /** The modular device (chassis) to remove a card from. */
  deviceId: string;
  /** The (filled) slot's id, from get_device's `slots`. */
  slotId: string;
}

export interface CreateRackParams {
  /** Display name for the rack. Defaults to "Rack". */
  label?: string;
  /** Rack height in rack units. Clamped to the editor's range [2, 60]. Default 42. */
  heightU?: number;
  /** One of RACK_TYPES. Default "floor-19". */
  rackType?: string;
  /** Rack depth in mm. Clamped to the editor's range [100, 2000]. Default 600. */
  depthMm?: number;
  /** Target rack-elevation page id (from list_racks). When omitted, a new rack page
   *  is created and the rack is added to it. */
  pageId?: string;
  /** Name for the new rack page, used only when `pageId` is omitted. Default
   *  "Rack Elevation". */
  pageLabel?: string;
}

export interface PlaceDeviceInRackParams {
  /** The device (from get_schematic) to mount in the rack. */
  deviceId: string;
  /** The target rack's id, from list_racks. Its page is derived from this id. */
  rackId: string;
  /** Bottom U position (1-based, counted from the bottom). The device's height in U
   *  is inferred from its dimensions; the call fails if the span is occupied or out of
   *  the rack's bounds. */
  uPosition: number;
  /** Which face to mount on; defaults to "front". "rear" is rejected on 2-post racks. */
  face?: "front" | "rear";
}

export interface RemoveDeviceFromRackParams {
  /** The placement id to remove, from list_racks. The device itself stays on the
   *  schematic — only its rack placement is removed. */
  placementId: string;
}

export interface UpdateNoteParams {
  /** The note id, from get_schematic's `notes`. */
  noteId: string;
  /** New plain text for the note. HTML-escaped on the way in (the note renders as
   *  HTML), so it always shows literally; newlines become line breaks. Replaces the
   *  note's content (a note with rich editor formatting becomes plain text). */
  text: string;
}

export interface DeleteNoteParams {
  /** The note id to delete, from get_schematic's `notes`. */
  noteId: string;
}

export interface InstallCardBatchParams {
  /** Cards to install in one call; each is attempted independently in array order
   *  (best-effort). Order matters: installing a card that itself adds sub-slots can make
   *  a later install into one of those sub-slots valid, and two installs targeting the
   *  same slot leave only the first applied (the second fails — the slot is now filled). */
  installs: InstallCardParams[];
}

export interface PlaceDeviceInRackBatchParams {
  /** Placements to make in one call; each is attempted independently in array order
   *  (best-effort), so an earlier placement can affect a later one (it consumes the U
   *  span / half-rack side, and a device already placed by an earlier item is rejected
   *  by a later one). */
  placements: PlaceDeviceInRackParams[];
}

// ── Floorplan tools (Ship 10) ─────────────────────────────────────────
// Positions on a floorplan are REAL-WORLD METRES measured from the top-left corner of the
// sheet's drawing area (inside the printed border), x to the right, y down. The page's
// drawing scale converts them to paper — so a symbol stays where the loudspeaker hangs
// even if the planner later changes the scale. Paper-mm placement of the boxes (legend,
// drawing block) is left to the editor, where the planner drags them.

export interface FloorplanPageRef {
  /** The floorplan page id from list_floorplans / create_floorplan. */
  pageId: string;
}

/** Where a symbol's label sits relative to its symbol (compass positions). */
export const FLOORPLAN_LABEL_POSITIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

export interface CreateFloorplanParams {
  /** "loudspeaker" numbers symbols per amplifier line (4.1, 4.2 …) and applies the
   *  Beschallungsplan presets (German legend/drawing block headings); default "generic". */
  kind?: "generic" | "loudspeaker";
  /** Tab name and default drawing title, e.g. "Ground floor". Default "Floorplan N". */
  label?: string;
  /** Paper id as in the editor ("iso-a1", "iso-a0", "iso-a3", "letter", …). Default "iso-a1". */
  paperId?: string;
  orientation?: "landscape" | "portrait";
  /** Drawing scale denominator: 50 means 1:50. Default 50. */
  scaleDenominator?: number;
}

export interface UpdateFloorplanParams extends FloorplanPageRef {
  /** Switching the kind resets legend title, notes heading, revision headers and field labels to the preset. */
  kind?: "generic" | "loudspeaker";
  /** Label template: {{line}}, {{n}}, {{group}}, {{device}}. Empty string → the kind's default. */
  labelTemplate?: string;
  label?: string;
  paperId?: string;
  orientation?: "landscape" | "portrait";
  /** Changing the scale re-fits the underlay so the building keeps its real size. */
  scaleDenominator?: number;
}

export interface FloorplanGroupSpec {
  /** Legend headline, e.g. "Ceiling speakers". */
  label: string;
  /** #rrggbb. Defaults cycle through the editor's legend palette. */
  color?: string;
  /** One of FLOORPLAN_SHAPES. Default "circle". */
  shape?: string;
  /** Legend sub-line, e.g. "Bose DM6SE black | cable 2×2.5 mm²". */
  description?: string;
  /** Seed for auto-numbering: "1.1" numbers 1.1, 1.2 …; "SB." numbers SB.1, SB.2 … */
  labelPrefix?: string;
  /** Device template this group stands for; devices of that template land in it. */
  templateId?: string;
  /** Caption next to the group's product image in the legend, e.g. "DM6SE". */
  imageCaption?: string;
  /** Remote product image (https URL). Defaults to the template's image when templateId
   *  is given; the Odoo product image can be passed here later. */
  imageUrl?: string;
  /** One or two characters drawn inside every symbol of the group, e.g. "S". */
  glyph?: string;
  /** Hide the group from the legend box. */
  hiddenInLegend?: boolean;
}

export interface AddFloorplanGroupParams extends FloorplanPageRef, FloorplanGroupSpec {}

export interface UpdateFloorplanGroupParams extends FloorplanPageRef, Partial<FloorplanGroupSpec> {
  groupId: string;
}

export interface FloorplanSymbolSpec {
  /** The group (legend row) the symbol belongs to. */
  groupId: string;
  /** Schematic device this symbol stands for (from get_schematic). Optional. */
  deviceId?: string;
  /** Real-world position in metres from the drawing area's top-left corner. */
  xM: number;
  yM: number;
  /** Symbol number, e.g. "4.1". Omit to number automatically (see lineNo). */
  label?: string;
  /** Amplifier line / circuit ("4", "SB"). With a line the symbol is numbered line.n from the
   *  page's label template, n continuing that line; without one, on a generic plan, the
   *  group's own numbering continues. */
  lineNo?: string;
  /** Speaker number within the line; omit to take the next free one. */
  seq?: number;
  /** Where the label sits around the symbol; default east. */
  labelPosition?: (typeof FLOORPLAN_LABEL_POSITIONS)[number];
  /** Clockwise label rotation in degrees. */
  labelRotationDeg?: number;
  notes?: string;
}

export interface PlaceFloorplanSymbolsParams extends FloorplanPageRef {
  /** Symbols to place, applied in array order (best-effort, per-item results). */
  symbols: FloorplanSymbolSpec[];
}

export interface UpdateFloorplanSymbolParams extends FloorplanPageRef {
  symbolId: string;
  groupId?: string;
  deviceId?: string | null;
  xM?: number;
  yM?: number;
  label?: string;
  /** Changing lineNo or seq rebuilds the label from the page's template unless label is passed too. */
  lineNo?: string | null;
  seq?: number;
  labelPosition?: (typeof FLOORPLAN_LABEL_POSITIONS)[number];
  labelRotationDeg?: number;
  notes?: string;
}

export interface RemoveFloorplanSymbolParams extends FloorplanPageRef {
  symbolId: string;
}

export interface SetFloorplanLegendParams extends FloorplanPageRef {
  visible?: boolean;
  /** Print the line table (line → amplifier channel, quantity, load). Default: on for loudspeaker plans. */
  showLines?: boolean;
  /** Heading of the line table, e.g. "LINIEN / ENDSTUFENKANÄLE". */
  linesTitle?: string;
  /** Box headline, e.g. "BESCHALLUNG – LEGENDE & MONTAGE". */
  title?: string;
  /** Heading above the free-text notes, e.g. "MONTAGEHINWEISE". */
  notesTitle?: string;
  /** Installation notes, one entry per printed line. Replaces the existing list. */
  notes?: string[];
  showImages?: boolean;
  onlyUsedGroups?: boolean;
}

export interface FloorplanRevisionSpec {
  /** Revision index ("A", "B", "01"). Omit to continue the sequence. */
  index?: string;
  /** Issue date as printed, e.g. "04.09.26". Omit for today. */
  date?: string;
  description: string;
  /** Drawn by (initials). */
  author?: string;
  /** Checked by (initials). */
  checkedBy?: string;
}

export interface FloorplanDrawingFieldSpec {
  label: string;
  /** Text or a `{{token}}`: showName, venue, designer, engineer, date, drawingTitle,
   *  company, revision (project title block) · scale, sheetSize, pageLabel, projectName (page). */
  value: string;
  /** Span both columns (for a client address). */
  wide?: boolean;
}

export interface SetFloorplanDrawingBlockParams extends FloorplanPageRef {
  visible?: boolean;
  /** Drawing title, e.g. "Erdgeschoss". Tokens allowed. */
  title?: string;
  subtitle?: string;
  /** Replaces the field grid. */
  fields?: FloorplanDrawingFieldSpec[];
  /** Replaces the revision table (oldest first). Use add_floorplan_revision to append. */
  revisions?: FloorplanRevisionSpec[];
  /** Column headers: index, date, description, author, checked. */
  revisionHeaders?: [string, string, string, string, string];
  /** Small print above the title (site-verification clause etc.). */
  disclaimer?: string;
  showLogo?: boolean;
  showNorthArrow?: boolean;
  /** Clockwise degrees; 0 = north is up the sheet. */
  northRotationDeg?: number;
}

export interface AddFloorplanRevisionParams extends FloorplanPageRef, FloorplanRevisionSpec {}

export interface FloorplanNoteSpec {
  text: string;
  /** Real-world position of the note's top-left corner, in metres from the drawing area's corner. */
  xM: number;
  yM: number;
  /** Wrap width in paper mm. Default 60. */
  widthMm?: number;
  /** Cap height in paper mm. Default 2.8. */
  fontSizeMm?: number;
  /** White box with hairline border behind the text. Default true. */
  boxed?: boolean;
  /** #rrggbb text color. */
  color?: string;
}

export interface AddFloorplanNotesParams extends FloorplanPageRef {
  notes: FloorplanNoteSpec[];
}

export interface UpdateFloorplanNoteParams extends FloorplanPageRef, Partial<FloorplanNoteSpec> {
  noteId: string;
}

export interface DeleteFloorplanNoteParams extends FloorplanPageRef {
  noteId: string;
}

export interface FloorplanMaskSpec {
  /** Top-left corner and size in PAPER mm from the sheet's top-left corner — covers hide
   *  parts of the printed sheet (the architect's legend, title block), not building spots. */
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

export interface SetFloorplanMasksParams extends FloorplanPageRef {
  /** Replaces every white cover on the page. Pass [] to remove them all. */
  masks: FloorplanMaskSpec[];
}

// ── Amplifier lines & load (Ship 11) ─────────────────────────────────
// A line is an amplifier channel's circuit on the plan: the number printed on its
// speakers (4.1, 4.2 …), the schematic channel that feeds it and how the channel runs
// (Lo-Z / 70 V / 100 V). The load check follows the Bose PowerShareX Design Tool and
// is brand-neutral: speakers carry speakerLoad, amplifiers ampLoad on their templates.

/** How an amplifier channel drives its line, mirroring `SpeakerLineMode` in `src/types.ts`. */
export const SPEAKER_LINE_MODES_WIRE = ["lo-z", "70v", "100v"] as const;

export type ListFloorplanLinesParams = FloorplanPageRef;

export type SyncFloorplanLinesParams = FloorplanPageRef;

export interface UpdateFloorplanLineParams extends FloorplanPageRef {
  /** The line as printed ("4", "SB"). */
  lineNo: string;
  /** Rename the line; its symbols are relabelled. */
  newLineNo?: string;
  /** Amplifier device id (get_schematic) and the id or label of its speaker-level output
   *  port. Pass null for both to unwire the line. */
  ampDeviceId?: string | null;
  ampPort?: string | null;
  mode?: (typeof SPEAKER_LINE_MODES_WIRE)[number];
  /** Hi-Z tap per speaker in watts; null = each speaker's highest tap. */
  tapW?: number | null;
  /** Free text printed in the legend's line table, e.g. "Terrasse". null clears. */
  name?: string | null;
}

export interface SpeakerLoadReportParams {
  /** Optional: use this floorplan's line modes / taps; otherwise every channel is judged
   *  in Lo-Z (or the amplifier's only Hi-Z mode). */
  pageId?: string;
}

// ---------------------------------------------------------------------------
// Device-property whitelist. Each safe field maps to the store action that
// applies it correctly. Fields with port/edge/structural invariants are
// deliberately ABSENT and rejected (deferred to Ship 2), so the bridge can
// never corrupt a drawing through a blind merge.
// ---------------------------------------------------------------------------
export type SafeFieldKind = "label" | "shortName" | "patch";

export const SAFE_DEVICE_FIELDS: Record<string, SafeFieldKind> = {
  label: "label",
  shortName: "shortName",
  hostname: "patch",
  color: "patch",
  headerColor: "patch",
  manufacturer: "patch",
  modelNumber: "patch",
  referenceUrl: "patch",
  category: "patch",
  note: "patch",
  serialNumber: "patch",
  voltage: "patch",
  powerDrawW: "patch",
  powerCapacityW: "patch",
  thermalBtuh: "patch",
  poeBudgetW: "patch",
  poeDrawW: "patch",
  unitCost: "patch",
  heightMm: "patch",
  widthMm: "patch",
  depthMm: "patch",
  weightKg: "patch",
  isSpare: "patch",
  isVenueProvided: "patch",
  useShortName: "patch",
  wrapLabel: "patch",
};
