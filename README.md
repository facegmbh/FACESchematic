<p align="center">
  <img src="public/favicon.svg" width="128" alt="EasySchematic logo"/>
</p>

<h1 align="center">EasySchematic</h1>

<p align="center">A drag-and-drop AV signal flow diagram tool for designing and documenting AV system hook-ups.<br>Built for broadcast, live production, and AV integration workflows.</p>

<p align="center"><b><a href="https://easyschematic.live">Try it live →</a></b> · <b><a href="https://docs.easyschematic.live">Documentation →</a></b> · <b><a href="https://docs.easyschematic.live/dev/">Developer Reference →</a></b> · <b><a href="https://devices.easyschematic.live">Device Database →</a></b> · <b><a href="https://discord.gg/dxXn3Jk2a6">Discord →</a></b> · <b><a href="https://ko-fi.com/duremovich">Support the project →</a></b></p>

<h3 align="center">Supported by</h3>

<p align="center">
  <a href="https://cumoratek.com/">
    <img src="https://avatars.githubusercontent.com/u/137531034?v=4" height="64" alt="Cumoratek AV Solutions" title="Cumoratek AV Solutions"/>
  </a>
</p>

<p align="center"><sub><b>Individual supporters</b><br/>Sean Curtis · HI-T3C · Brandon Meyers</sub></p>

---

Draw your signal flow, and the paperwork comes with it. Devices, racks, patch
bays, and print sheets all live in one file, so a cable schedule, pack list, and
rack elevation are views of the same drawing instead of three spreadsheets that
drift apart.

Free, browser-based, no account required. Installs as a desktop app and keeps
working offline.

> This README is the highlights reel. The full feature-by-feature reference
> lives at **[docs.easyschematic.live](https://docs.easyschematic.live)**.

## Highlights

### Canvas & connections

- **Click-to-connect or drag-to-connect** — a preview line follows the cursor and
  snaps to nearby valid ports, green for a valid target and red for an
  incompatible signal type. Click a device body to auto-connect the first
  compatible port.
- **Smart routing** — A\* pathfinding routes cables around devices with parallel
  nesting and line-jump arcs. Add waypoints by hand where the algorithm gets it
  wrong, or switch routing off entirely for lag-free editing on big drawings.
- **[73 signal types](#signal-types)**, each color-coded and individually
  restylable, with per-signal line styles and a customizable color palette saved
  in the file.
- **Adapters insert themselves** between incompatible ports, with gender
  awareness, direct-attach support, and barrels.
- **Bundles** — select a group of connections and run them down one shared trunk
  like a snake, mixed signal types included. Each member stays its own cable in
  the schedule and pack list.
- **Rooms** — resizable containers for control rooms, racks, trucks, and stages,
  nestable and lockable, with room-to-room distances feeding estimated cable
  lengths.

### Devices

- **3,800+ device templates** from the [community device
  library](https://devices.easyschematic.live), fetched live, with a bundled
  core set as an offline fallback so the app keeps working without a connection.
- **Build anything that isn't there** — a guided builder for matrix routers,
  breakout panels, patch bays, and anything else with structured I/O; save your
  own as reusable templates and share them back to the community.
- **Expansion slots** — chassis with swappable card bays, including cards with
  their own sub-slots for SFP/QSFP transceivers.
- **Swap Device** — replace a device with a different model and a mapping dialog
  proposes where every existing connection lands, carries installed cards across,
  and auto-installs cards where the new chassis needs them. One undo step.
- **Real-world data on every device** — dimensions, weight, power draw, hostname
  and IP, unit cost, venue-provided flag — all of which feed the reports.

### Rack Builder

A rack elevation surface alongside the signal flow, sharing devices by
reference — place a device on a rack and it stays the same device on the
schematic, connections and all.

- Floor, wall, desktop, and open 2-post/4-post rack presets, or a custom rack
- Drag devices from the unracked sidebar with snap-to-U placement, collision
  detection, half-rack pairing, and auto-shelving for non-rack-mount gear
- Front, rear, and side views — face plates with connectors, occupancy ghosts,
  and depth conflicts
- **Face-plate editor** for connector positions, with 60+ connector types drawn
  at mm-accurate dimensions
- Accessories: shelves, vent panels, blanks, drawers, cable managers, fans

### Patch Bay

Route connections through patch panels without drawing the panels on the
schematic. Virtual panels appear in the reports and racks, click-to-patch handles
multi-panel hops, per-segment cable IDs get letter suffixes (`E001-A/-B/-C`), and
designation strips print at 100% physical scale for the panel's label holder.

### Print Sheets

Paper pages for composing rack viewports into a printable drawing — Letter
through A0 and custom sizes, drag-and-resize viewports with alignment guides,
title blocks and stats lines, and a **vector PDF export** that carries mounting
holes, occupancy stripes, and shelf occupants at full fidelity.

### Paperwork

### Floorplans

Scaled plan drawings built on the architect's drawing — where the gear physically goes, as a counterpart to the signal flow.

- **Architect's drawing as underlay** — import a **PDF** page (rendered in the browser) or an image (PNG/JPEG/WebP/SVG); the sheet adopts the PDF's format (A1 portrait stays A1 portrait, odd sizes become a custom sheet) and the drawing covers it edge to edge, so your legend and drawing block lie over the architect's own. Multi-page PDFs get a page switcher, and the raster is stored in the project file so the plan travels with the schematic. DWG has no browser-side parser — plot it to PDF first
- **Drawing scale** — 1:20 through 1:500 or any custom denominator; changing the scale re-fits the underlay so the building keeps its real-world size
- **Calibration** — click two ends of a known dimension, type it in metres, and the underlay is resized so the plan measures true at the page scale; the toolbar then reports the drawing's mm-per-pixel resolution
- **Symbol groups** — one legend row each: color, shape (circle / square / diamond / triangle), model + cable description, product image, and a number prefix that seeds auto-numbering
- **Device-linked symbols** — drag a device from the sidebar onto the plan and the symbol stays bound to that schematic device; deleting the device clears its symbols the same way it clears rack placements
- **Auto-numbering** that continues the group's series (4.1 → 4.2, SB.09 → SB.10), with per-symbol rename, draggable number labels, and group renumbering
- **Generated legend box** — swatch, title, description and product shot per group (uploaded, from the device template, or any image URL — the slot Odoo product images fill later), plus free-text installation notes; draggable, resizable in width and height, listing all groups or only the ones placed
- **Loudspeaker plan type** — per-page type that numbers symbols per amplifier line (4.1, 4.2 …, `{{line}}.{{n}}` template), lists lines with counts and renumbering, and applies the Beschallungsplan presets (German legend/notes headings, revision headers, drawing block field labels)
- **Lines from the schematic** — on a loudspeaker plan every amplifier channel (speaker-level output) with speakers wired to it is a line; a dropped speaker takes its channel's line automatically, *Sync from schematic* binds and renumbers everything at once, and from then on a speaker rewired to another channel moves to that channel's line live. Each line can be wired, renamed, named for the legend and run as Lo-Z / 70 V / 100 V with a tap per speaker
- **Load check per line** — modeled on the Bose PowerShareX Design Tool and brand-neutral (`speakerLoad` on speakers: impedance, continuous power, taps, profile; `ampLoad` on amplifiers: rated power per load, shared total, peak V/A): requested burst power, impedance and its expected minimum, peak voltage/current, average power after the crest factor, headroom in dB against peak voltage, peak current, per-channel and shared power, with OK / Nearing / Exceeds verdicts; the legend prints a line table (line → amplifier · channel, quantity, load)
- **Label placement** — every symbol label can be put N/NE/E/SE/S/SW/W/NW of its symbol, rotated by degrees, and the placement copied to a whole line or group; alignment and rotation print identically in the PDF
- **Plan symbol per model** — templates carry a `planSymbol` (shape, color, optional glyph, or your own uploaded picture) that groups inherit, so the same loudspeaker looks the same on every plan; models without one are drawn by device type (speakers round, subs square, microphones triangles, projectors / cameras / racks / displays as top-view pictograms, other video diamonds) in a color derived from the model
- **Layers** — a symbol group doubles as a layer: switch it off and its symbols leave the sheet, the export and the legend while staying in the project, so one drawing yields a sheet per trade; right-click a symbol to turn it, regroup it or switch its layer
- **Covers turn, fade and lock** — the white patches over the architect's own title block can be rotated to match it, faded to quiet linework instead of erasing it, and locked so placing symbols on top cannot nudge them; right-click a cover for all of it
- **The imported PDF is kept** — in the browser's own storage and inside a project saved to a file, so switching pages, changing the PDF's layers or its resolution still redraws the plan after a reload, and on a colleague's machine
- **Plan resolution in dpi** — an imported PDF is rasterized at a resolution of the real sheet (150 dpi by default, 100 to 500 selectable), instead of a fixed pixel count that left large A1 drawings at 72 dpi
- **PDF layers** — an imported plan's own layers (furniture, electrical, dimensions) are listed at import and can be switched off before they are drawn, so one drawing yields a quiet background for one trade and a detailed one for another
- **Turn a symbol** — projectors, displays and cameras face a direction: select symbols on the sheet and turn the picture, while the number beside it stays upright; a group sets the direction its new symbols start at
- **Library-driven legend text** — templates carry a fixed `installCable` ("Kabel aus Decke: 2x2,5 mm²") and `installNotes`; a group created from that model gets *Manufacturer Model | cable* as its legend line and the note under the legend's installation notes, so the cable spec is written once on the loudspeaker and reads the same on every plan
- **Company block** — Preferences → Company (logo, name, address, contact) prints at the foot of every floorplan legend and feeds the drawing block's logo and `{{companyName}}` / `{{companyAddress}}` / `{{companyContact}}` tokens; saved in the browser and snapshotted into the project file
- **Erase** — drag white covers over parts of the architect's plan (its legend, revision table, title block) so the printed sheet carries only your boxes; covers move, resize and delete like any object
- **Drawing block (Plankopf)** — a movable, editable title block per plan: revision table (index / date / change / by / checked, headers editable), disclaimer small print, drawing title and subtitle, a two-column field grid with `{{scale}}`, `{{sheetSize}}`, `{{showName}}` … tokens that resolve from the project title block, logo and rotatable north arrow
- **Notes on the plan** — free text anywhere on the sheet (✎ Note tool or sidebar), wrapping at a set width, boxed or plain, edited inline
- **Generated over MCP** — `create_floorplan`, `add_floorplan_group`, `place_floorplan_symbols` (real-world metres), `sync_floorplan_lines` / `list_floorplan_lines` / `update_floorplan_line` / `speaker_load_report`, `set_floorplan_legend`, `set_floorplan_drawing_block`, `add_floorplan_revision`, `add_floorplan_notes` … plus a `floorplan` playbook; only the architect's drawing itself is imported in the editor
- **True-to-scale PDF export** — one PDF page per floorplan at real paper size, so a 100 % print can be measured off on site

### Pack List & Reports

### Files & exports

- **Print** — Standard, ISO A0–A4, ANSI, Architectural, or custom paper, with
  orientation, scale, and an optional, configurable title block
- **DXF** for AutoCAD and Vectorworks, with organized layers; plus **PDF**,
  **PNG** (4x), and **SVG**
- **JSON** import/export with schema versioning and migrations
- **CSV cable schedule import** — turn an existing spreadsheet into a schematic
- **Optional free account** for cloud saves (up to 10 schematics), share links,
  and access from any browser; everything else stays local

### AI assistant (Beta)

EasySchematic speaks [MCP](https://docs.easyschematic.live/ai-assistant), so an
assistant like Claude can read and edit your schematic live — searching the
library, placing devices, making validated connections, and writing notes, with
the results appearing on your canvas as it works. The bridge runs on
`127.0.0.1` only, is off by default, and requires a one-time pairing token.

### Community device database

[devices.easyschematic.live](https://devices.easyschematic.live) is a browsable,
searchable, installable-offline catalog. Submit new devices or edits by
magic-link email — or right-click a device on your canvas and choose **Submit to
Community** to seed a submission from what you've already filled in. Approved
submissions credit the contributor.

#### Public API

If you're building AV tooling and need a structured database of professional
audiovisual equipment with port definitions, signal types, and connector types,
help yourself:

- `GET https://api.easyschematic.live/templates` — all device templates
- `GET https://api.easyschematic.live/templates/:id` — single template with contributor attribution

Responses are JSON, cached for 5 minutes, no auth required. See the [full API
reference](https://docs.easyschematic.live/api) for additional endpoints.

## Signal Types

- **Auto-save** to browser localStorage
- **Cloud storage** — create a free account to save up to 10 schematics to the cloud and access them from any browser
- **New file template** — designate any cloud save as your new-file template; File → New loads it with all devices, title block, and settings pre-filled
- **Sharing** — generate a shareable link for any cloud-saved schematic
- **JSON import/export** with schema versioning and automatic migrations
- **CSV cable schedule import** — import cable schedule spreadsheets to auto-generate schematics with device matching
- **Print** — configurable paper size (Standard, ISO A0–A4, ANSI, Architectural, or custom dimensions), orientation, scale, title block
- **PNG** — 4x resolution raster export
- **SVG** — vector export
- **Floorplan PDF** — every floorplan page at true paper size, underlay + symbols + legend + title block (File → Export → Export Floorplans)
- **DXF** — AutoCAD R2000 (AC1015) export with canvas-faithful visuals and organized layer hierarchy (`EasySchematic-Devices`, `EasySchematic-Connections-SDI`, etc.) for Vectorworks, AutoCAD, and similar CAD tools
- **Template import/export** — export and import user device templates as JSON
- **Bulk device-template import** — import many templates at once from a JSON or CSV file (e.g. a vendor catalog dump) straight into your user-template library
- **Google OAuth** — sign in with Google as an alternative to magic-link email
- **Offline cloud cache** — cloud schematics cached to IndexedDB for offline access

### Editing

- **Undo/redo** — full history
- **Copy/paste** with offset positioning
- **Double-click device** to open device editor (label, type, ports, presets); **Ctrl+Enter** applies and closes from any field
- **Double-click canvas** to quick-add a device via search dialog
- **Preferences** — navigation mode (left drag: selection box or pan canvas), scroll wheel configuration, trackpad support with sensitivity sliders, label case display (UPPERCASE / lowercase / Capitalize), via Edit menu
- **Right-click room** for context menu — edit properties (label, colors, border style) or lock/unlock the room

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
```

Output goes to `dist/` — deploy as a static site anywhere.

## Self-Hosting with Docker

```bash
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080). This builds the frontend
from source and serves it with nginx. Cloud features (save to cloud, device
submissions, sharing) still talk to the hosted API at `api.easyschematic.live` —
no account or API key required for read access.

| Command | Description |
|---------|-------------|
| `make build` | Build the Docker image |
| `make up` | Start the container (port 8080) |
| `make down` | Stop the container |
| `make restart` | Restart the container |
| `make logs` | Tail container logs |
| `make build-clean` | Rebuild with no cache |

The `makefile` is just a convenience wrapper around `docker compose`. To change
the port, edit the first number in the port mapping in `compose.yml`. See the
[Self-Hosting docs](https://docs.easyschematic.live/self-hosting) for reverse
proxy setup and more.

## Install as a Desktop App

EasySchematic installs as a standalone app that works offline — no download page,
no account, no app store. Visit [easyschematic.live](https://easyschematic.live)
and install from your browser:

- **Chrome / Edge** — the install icon in the address bar, or Menu → "Install EasySchematic"
- **Safari (macOS Sonoma+)** — File → Add to Dock
- **Safari (iOS / iPadOS)** — Share → Add to Home Screen
- **Android** — the browser prompts automatically, or Menu → "Install app"

The installed app opens in its own window, works fully offline, and updates when
you're back online. EasySchematic is built for a desktop-sized screen with a
keyboard and mouse.

## Design Principles

1. **AV signal flow, nothing else.** This is a tool for designing audiovisual
   systems — not a general diagramming app. Every feature decision starts from
   "does this serve AV workflows?"

2. **Your workflow, your way.** Signal colors, display names, device templates,
   port layouts — customization is a first-class feature. Different shops work
   differently, and the tool should adapt to you, not the other way around.

3. **Simple to start, deep to master.** A student can drag devices and draw
   cables in five minutes. The depth is there when you need it, but it's never in
   your face on day one.

4. **Automate the tedious, not the creative.** Smart routing, auto-numbering, and
   sensible defaults handle the grunt work. When the algorithm gets it wrong,
   manual overrides put you back in control.

5. **Community-built device library.** The shared device database grows because
   users contribute to it. Submit a template, everyone benefits.

## Tech Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org/)
- [@xyflow/react v12](https://reactflow.dev) — canvas
- [Zustand v5](https://zustand.docs.pmnd.rs/) — state management
- [Tailwind CSS v4](https://tailwindcss.com) — styling
- [Vite 8](https://vite.dev) — build tool
- [Cloudflare Workers + D1](https://developers.cloudflare.com/) — API and device database

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Click port | Start click-to-connect |
| `Escape` | Cancel connection / deselect |
| `Space` + drag | Pan canvas |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+S` / `Ctrl+Shift+S` | Save / Save As |
| `Ctrl+O` | Open schematic |
| `Ctrl+C` / `Ctrl+V` | Copy / paste |
| `Ctrl+A` | Select all |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `F9` | Toggle Print View |
| `Shift` + click | Toggle item in selection |
| `Shift` + drag | Directional toggle selection |
| Double-click device | Open device editor |
| Double-click canvas | Quick-add device search |
| Double-click room background | Quick-add device inside room |
| Double-click rack label | Rename rack inline |
| Right-click room | Room context menu |
| Right-click connection | Connection context menu (waypoints, stub, reset route) |
| `R` (print sheet) | Reset selected viewports to natural aspect |
| `Shift` while resizing (print sheet) | Escape aspect lock |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, architecture
notes, and guidelines.

## License

AGPL-3.0
