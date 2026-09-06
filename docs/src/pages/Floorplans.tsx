export default function FloorplansPage() {
  return (
    <>
      <h1>Floorplans</h1>

      <p>
        A floorplan is a scaled plan drawing built on the architect&apos;s drawing: import the
        architect&apos;s PDF or image as an underlay, calibrate it against a known dimension, then
        place device symbols where the gear actually goes. The legend writes itself from the symbol
        groups you use, the project title block sits in the corner, and the whole sheet exports as a
        true-to-scale PDF — the drawing the install team works from on site.
      </p>
      <p>
        This is the physical counterpart to the schematic: the schematic says what is connected to
        what, the floorplan says where it hangs.
      </p>

      <h2>Creating a floorplan</h2>
      <p>
        Click the <strong>🗺+</strong> button at the right end of the page tab bar. The new page
        opens as an A1 landscape sheet at 1:50 between two panels: on the left what is on the plan
        and the devices still to place, on the right everything about how the plan reads. Right-click the
        tab for rename / duplicate / delete — deleting a floorplan removes its underlay and symbols,
        never the devices themselves.
      </p>

      <h2>Importing the architect&apos;s drawing</h2>
      <p>
        <strong>Import Plan…</strong> in the toolbar takes a <strong>PDF</strong> (any page of it)
        or an image (PNG, JPEG, WebP, SVG). A PDF page carries its physical size, so the sheet
        <em>adopts the plan&apos;s format</em> — an A1 portrait drawing becomes an A1 portrait sheet,
        an odd plotter size becomes a custom sheet of exactly that size — and the drawing covers the
        sheet edge to edge. Your legend and drawing block then sit on top of the architect&apos;s own
        boxes, hiding them, instead of the plan being parked on a differently shaped sheet next to a
        second legend. Images have no physical size and are fitted into the current sheet;{" "}
        <strong>⤢ Fill Sheet</strong> re-lays any underlay over the whole sheet. Multi-page sets get
        a page selector next to the file name so you can switch floors without re-importing.
      </p>
      <p>
        <strong>DWG is not supported</strong> — it is a proprietary binary format with no viable
        browser parser. Plot the drawing to PDF from AutoCAD or BricsCAD and import that; DXF needs
        the same treatment for now.
      </p>
      <p>
        The underlay is stored inside the project file as a rasterized image, so the plan travels
        with the schematic and keeps working offline. Very large drawings can outgrow the
        browser&apos;s autosave budget — the app warns when that happens, and saving the project to
        a file always works.
      </p>
      <p>
        A PDF is rasterized at a <strong>resolution in dpi of the real sheet</strong>, not at a
        fixed pixel count: 2400 px is 203 dpi on A4 but only 72 dpi on A1, so a pixel cap made
        exactly the large drawings — the ones carrying the most detail — come out the coarsest.
        The default is 150 dpi, the usual plotting resolution, which keeps room labels and
        dimension text readable when zoomed. <em>Quality</em> in the toolbar goes from 100 to
        500 dpi. Changing it redraws from the PDF, which the app keeps for you (see below).
      </p>
      <p>
        What each step costs, measured on a dense A1 plan: 0.36 MB at 100 dpi, 0.57 at 150,
        0.98 at 200, 1.8 at 300, 3.0 at 400 and 4.5 at 500. Line art compresses well as PNG,
        but two ceilings apply. Above roughly 300 dpi an A1 plan outgrows the browser&apos;s
        autosave budget, so the project has to be saved to a file. And the raster itself cannot
        exceed what a browser will allocate, about 16384 px on the long edge and 260
        megapixels, which works out to around 495 dpi on A1 and 350 on A0. The toolbar shows
        the resolution actually achieved, and says so when the sheet size capped your choice.
        For detail beyond that the answer is a vector export rather than a bigger image.
      </p>
      <ul>
        <li>
          <strong>Layers</strong> — a PDF from AutoCAD or Revit usually carries its own layers
          (furniture, electrical, dimensions). When the imported plan has any, the
          <em>Layers</em> picker opens with the list and you tick what gets drawn. A
          loudspeaker sheet wants a quieter background than a cable sheet, and importing the
          same plan twice with different layers gives two backgrounds to work on. The choice is
          baked into the raster, so changing it later redraws from the PDF, which the app keeps
          for you (see below). The placement and the calibration are kept.
        </li>
        <li><strong>Opacity</strong> fades the drawing back so symbols stay readable over dense linework.</li>
        <li><strong>Lock</strong> pins the underlay so it can&apos;t be nudged while placing symbols.</li>
        <li>Unlocked, drag the underlay to reposition it; the corner handle resizes it with the aspect ratio locked.</li>
      </ul>

      <h3>The source file is kept</h3>
      <p>
        Switching pages, changing layers and changing the resolution all redraw the plan from
        the original PDF, so the app keeps that file in the browser&apos;s own storage
        (IndexedDB) rather than only for the session. Reloading the tab no longer costs you a
        re-import. The bytes deliberately stay out of the project&apos;s autosave, which has a
        budget of roughly 5 MB for the whole document — an architect&apos;s PDF can be many
        times that on its own.
      </p>
      <p>
        Saving the project <strong>to a file</strong> writes those bytes into it, so a colleague
        who opens the file can redraw the plan too — switch its page, change its layers, raise
        its resolution. The file grows accordingly, and a save over 20 MB says so. A
        <em>cloud</em> save does not carry them: that path has a 10 MB ceiling per schematic,
        which one architect&apos;s PDF would use up on its own.
      </p>
      <p>
        One limit worth knowing: a source over 25 MB is not kept at all, and the app says so at
        import. The plan works, but redrawing it later needs the file again.
      </p>

      <h2>Scale and calibration</h2>
      <p>
        The page scale (1:50, 1:100, …) is what makes the sheet a drawing rather than a picture: at
        1:50, one millimetre on paper is 50 mm in the building. Changing the scale re-fits the
        underlay so the building keeps its real size on the sheet.
      </p>
      <p>
        <strong>📏 Calibrate</strong> makes the underlay dimensionally true. Click the two ends of a
        dimension you know — a room width, a grid spacing, a dimension line on the drawing — and
        type that distance in metres. The underlay is resized so the reference measures correctly at
        the page scale, and the toolbar then reports the drawing&apos;s resolution in mm per pixel.
        Until you calibrate, the plan is placed at its nominal size and distances taken off it are
        only as good as the source.
      </p>

      <h2>The two panels</h2>
      <p>
        The <strong>left panel</strong> is the plan&apos;s contents: <em>On the plan</em> lists every
        placed symbol with its number, its picture and the device behind it — click a row to select
        that symbol on the sheet, shift-click to add to the selection. Below it sit the schematic&apos;s
        devices; drag one onto the sheet to place it. One search box filters both lists.
      </p>
      <p>
        The <strong>right panel</strong> edits. Select a symbol — on the sheet or in the left list —
        and <em>Selected symbol</em> opens at the top with its number, the <strong>group</strong> it
        belongs to (changing it changes the symbol), the line it hangs on, which way it faces, where
        its number sits, and a note. <em>Edit symbol…</em> jumps to that group below, where the
        shape, the color and the uploaded picture live — those apply to every symbol of the group.
        Under it sit the symbol groups, the numbering, the amplifier lines, the legend box, the
        drawing block, the erased areas and the notes. Both panels fold away to a narrow rail.
      </p>

      <h2>Symbol groups</h2>
      <p>
        A symbol group is one legend row: a color, a shape and the model it stands for. Add groups
        in the sidebar and give each one a title (&quot;Ceiling speakers&quot;), a description line
        (&quot;Bose DM6SE black | cable 2×2.5 mm²&quot;), and optionally a product image for the
        legend.
      </p>
      <p>
        The description line does not have to be typed per plan. A device template can carry a
        fixed <strong>install cable</strong> (&quot;Kabel aus Decke: 2x2,5 mm²&quot;) and a standing{" "}
        <strong>install note</strong> — both editable in the device editor and saved with the
        template. A group created from such a model (dropping the device on the plan, or
        <code>add_floorplan_group</code> with a templateId) gets{" "}
        <em>Manufacturer Model | install cable</em> as its description and the note appended to the
        legend&apos;s installation notes as <em>Model: note</em>. Write the cable once on the
        loudspeaker in the library and every plan&apos;s legend reads the same.
      </p>
      <p>
        Product shots come from three places, in this order: an image you <strong>upload</strong>{" "}
        (stored in the project, always printed), the <strong>device template&apos;s image</strong> when the
        group is bound to one (offered as a button, or picked up automatically when a device is
        dropped on the plan), or any <strong>image URL</strong> you paste — the slot the Odoo product
        image will fill later. Remote images show on screen immediately; the PDF export embeds them
        when the image host allows cross-origin access, and falls back to printing the row without
        its picture when it does not. The legend lists every group by default; switch it to
        &quot;only groups used on this plan&quot; for a shared legend across a sheet set.
      </p>
      <p>
        Where the symbol comes from: a group created from a library model takes the model&apos;s{" "}
        <strong>plan symbol</strong> — shape, color and an optional one- or two-letter glyph inside
        the symbol — set once in the device editor and saved with the template. A model without
        one is drawn by type: loudspeakers round, subwoofers square, microphones as triangles,
        projectors, cameras, racks and displays as top-view pictograms, other video as diamonds,
        with a color derived from the model so it never changes between plans. Every value stays
        editable on the group afterwards.
      </p>
      <ul>
        <li><strong>Color</strong> — from the swatch row or any custom color.</li>
        <li>
          <strong>Shape</strong> — circle, square, diamond or triangle, so groups stay apart on a
          monochrome print; or a pictogram — <em>projector</em>, <em>rack</em>, <em>display</em>,{" "}
          <em>camera</em> — drawn as the top view an installer reads on an architect&apos;s plan.
          Pictograms take the group color for the body and print their details (lens, cabinet
          diagonals, screen face) in the glyph color.
        </li>
        <li>
          <strong>Your own symbol</strong> — <em>Upload symbol…</em> puts a PNG, JPG, WebP or SVG
          in place of the drawn shape. It is rasterized to a square on import and stored in the
          project, so the plan, the legend and the PDF all show the same picture and nothing
          depends on a server being reachable. An uploaded symbol replaces the shape, the color
          and the glyph — the picture is the symbol. Upload it on the device instead (device
          editor → <em>Plan symbol</em>) and every plan that uses the model gets it.
        </li>
        <li>
          <strong>Outline</strong> — the line around the symbol body, in color and in
          thickness. The thickness is given in paper mm, so it prints the same weight whatever
          the symbol size; <code>0</code> drops the outline entirely for a flat, filled symbol.
          Left empty it scales with the symbol. The pictogram details (lens, cabinet diagonals,
          screen face) keep their own dark ink so they read on white paper.
        </li>
        <li>
          <strong>Turn</strong> — a projector, a display or a camera faces a direction. Select
          symbols on the sheet and use <em>Symbol ⟲ ⟳</em> to turn the picture; the number beside
          it stays upright. <em>Apply to line / group</em> copies the turn to the rest, and a
          group&apos;s <em>Turn</em> field sets the direction new symbols start at.
        </li>
        <li>
          <strong>Number prefix</strong> — seeds the auto-numbering. Type <code>1.1</code> and the
          group numbers 1.1, 1.2, 1.3…; type <code>SB.</code> and it runs SB.1, SB.2, …
        </li>
      </ul>

      <h2>Loudspeaker plans: lines and labels</h2>
      <p>
        The toolbar&apos;s <strong>Type</strong> switches a page to a <strong>loudspeaker plan</strong>. That
        applies the Beschallungsplan presets — German legend title and notes heading, revision
        headers <em>Index · Datum · Änderungen · Bearb. · Gepr.</em>, drawing block fields Bauvorhaben,
        Bauherr, Maßstab, Blattgröße, Datum, Planersteller:in — and changes how symbols are numbered:
        per <strong>amplifier line</strong>. Set the active <strong>Line</strong> in the sidebar
        (&quot;4&quot;, &quot;SB&quot;) and every symbol you drop reads <em>line.speaker</em>: 4.1, 4.2, …
        The sidebar lists the lines on the plan with their counts and renumbers a line in placement
        order. The label template (<code>{"{{line}}.{{n}}"}</code> by default, also{" "}
        <code>{"{{group}}"}</code> and <code>{"{{device}}"}</code>) is editable per page.
      </p>
      <p>
        Every label can be <strong>placed around its symbol and rotated</strong>: select one or more
        symbols and a panel appears with the eight compass positions, a rotation field and ±45°
        buttons, and &quot;apply to line / group&quot; to copy the placement to all speakers on that
        line or in that group. Dragging the number itself still works for free placement. The PDF
        reproduces alignment and rotation exactly.
      </p>

      <h2>Lines, amplifier channels and load</h2>
      <p>
        A line is an amplifier channel&apos;s circuit. On a loudspeaker plan the lines are{" "}
        <strong>read off the schematic</strong>: every speaker-level output of an amplifier (or any
        device that is not a speaker and has such outputs) is a channel, and the speakers wired to
        it — loop-through from speaker to speaker included — are the channel&apos;s load. Drop a
        wired speaker on the plan and it lands on its channel&apos;s line automatically, the line
        being created with the next free number when the channel has none yet; <strong>Sync from
        schematic</strong> in the sidebar&apos;s <em>Lines &amp; load</em> panel does the same for
        everything at once and renumbers the placed symbols per channel. From then on the plan
        follows the schematic <strong>live</strong>: rewire a speaker to another channel and its
        symbol moves to that channel&apos;s line at once, on every loudspeaker plan, with no
        button to press (undoing the wiring undoes the move). Lines that are not wired
        yet (a number typed into the <em>Line</em> field) stay as they are; each line card lets you
        pick the channel, rename the line (its symbols are relabelled), name it for the legend and
        set how the channel runs: <strong>Lo-Z</strong>, <strong>70 V</strong> or{" "}
        <strong>100 V</strong> with the transformer tap per speaker.
      </p>
      <p>
        With the channel known, every line shows its <strong>load check</strong>, modeled on the
        Bose PowerShareX Design Tool and usable for any brand whose templates carry the data
        (Audac, JBL, Voice-Acoustic, Tennax …): the speakers&apos; <code>speakerLoad</code>{" "}
        (impedance, continuous power, taps, profile) and the amplifier&apos;s <code>ampLoad</code>{" "}
        (rated power per channel by load, shared total, peak voltage / current) — see the{" "}
        <a href="/device-template-schema">template schema</a>; both are edited on the device under{" "}
        <em>Load</em>. Per channel the model computes the requested burst power (twice the
        continuous rating in Lo-Z, the tap sum on a 70/100 V line), the load impedance and its
        expected minimum, peak voltage and current, and the average power after the profile&apos;s
        crest factor; it then compares against the amplifier&apos;s peak voltage, peak current,
        per-channel and shared (PowerShare-style) power and reports the smallest headroom in dB
        with what limits it. <strong>OK</strong> above +1 dB, <strong>Nearing limit</strong> down
        to −2 dB, <strong>Exceeds</strong> below — or a load below the amplifier&apos;s minimum
        impedance. Speakers or amplifiers without data are reported as such rather than guessed.
        The legend prints a <strong>line table</strong> (line → amplifier · channel, quantity,
        load) on loudspeaker plans; switch it off or retitle it in the legend settings.
      </p>

      <h2>Placing symbols</h2>
      <p>
        Drag a device from the sidebar onto the plan — the symbol stays linked to that device on the
        schematic, so its model and cable details are the same thing the pack list and cable
        schedule report. Devices already on the plan show their symbol number next to them.
      </p>
      <p>
        The <strong>✚ Place</strong> tool drops symbols of the active group wherever you click,
        useful for positions that have no device yet.
      </p>
      <ul>
        <li>Each new symbol continues its group&apos;s numbering (4.1 → 4.2, SB.09 → SB.10).</li>
        <li>Double-click a symbol or its number to rename it.</li>
        <li>Drag the number itself to move the label clear of the linework.</li>
        <li>Shift-click to multi-select; <kbd>Delete</kbd> removes the selected symbols.</li>
        <li>Positions snap to 0.5 mm on paper — hold <kbd>Alt</kbd> for free placement.</li>
        <li><strong>Renumber</strong> in the group editor re-runs a group&apos;s numbers in placement order.</li>
      </ul>
      <p>
        Deleting a device on the schematic removes its symbols from every floorplan, the same way it
        clears its rack placements.
      </p>

      <h2>The legend box</h2>
      <p>
        The legend is generated from the groups in use: swatch, title, description and product
        image, followed by your free-text installation notes (one line per note — mounting details,
        cable specs, anything the fitter needs). Drag the box anywhere on the sheet; the handle on
        its right edge sets its width, and its height follows its content.
      </p>
      <p>
        Switch it to list every group, not just the ones placed, when the plan is one sheet of a set
        that shares a legend.
      </p>

      <h3>Your company on every plan</h3>
      <p>
        <strong>Preferences → Company</strong> holds the planning company&apos;s identity: logo, name,
        address lines, phone, e-mail, web. It is saved in the browser and snapshotted into each project
        file, and prints at the foot of every floorplan legend without anyone typing it — switch it
        off per legend if a sheet must not carry it. The drawing block falls back to the company logo
        when the project title block has none, and its fields can use{" "}
        <code>{"{{companyName}}"}</code>, <code>{"{{companyAddress}}"}</code> and{" "}
        <code>{"{{companyContact}}"}</code>.
      </p>

      <h2>Taking things out of the architect&apos;s plan</h2>
      <p>
        The underlay is a raster, so nothing in it can be deleted — but it can be covered. The{" "}
        <strong>▭ Erase</strong> tool drags out a white cover over any part of the plan: the
        architect&apos;s symbol legend, revision table, title block, a note that no longer applies.
        Covers move, resize from the corner and go with <kbd>Delete</kbd>; the sidebar lists them.
        Your legend and drawing block sit on top, so the printed sheet carries one set of boxes.
      </p>
      <p>
        Both boxes also stretch: the bottom handle on the legend and on the drawing block sets a
        minimum height, so either can be pulled down to cover the architect&apos;s block exactly
        (the drawing block gives the extra room to its title band, the way architects&apos; blocks do).
      </p>

      <h2>Notes on the plan</h2>
      <p>
        Free text goes anywhere on the sheet: pick the <strong>✎ Note</strong> tool and click, or
        add one from the sidebar. Notes wrap at their width (drag the handle on the right edge),
        print at the size you set in paper mm, and can sit in a white box so they stay legible
        over the architect&apos;s linework. Double-click to edit inline, <kbd>Delete</kbd> removes.
        Use them for the remarks a fitter needs next to the symbol they concern — cable
        clearance, ceiling reinforcement, a door to keep clear.
      </p>

      <h2>The drawing block</h2>
      <p>
        Every issued plan carries a title block — the <em>Plankopf</em>. On a floorplan it is a
        movable object you drag into place and edit in the sidebar. Top to bottom it holds:
      </p>
      <ul>
        <li>
          <strong>Revision table</strong> — index, date, change, drawn by, checked by. Column
          headers are editable (so <em>Index · Datum · Änderungen · Bearb. · Gepr.</em> is one edit
          away). <strong>+ Revision</strong> appends a row with the next index and today&apos;s
          date; the newest issue prints on top.
        </li>
        <li><strong>Disclaimer</strong> — small print such as the site-verification clause.</li>
        <li><strong>Title</strong> and subtitle — the floor and what the drawing shows.</li>
        <li>
          <strong>Fields</strong> — a two-column grid of label/value pairs (project, client,
          scale, sheet, date, drawn by …). Mark a field <em>wide</em> to span both columns for an
          address. Values may use tokens that resolve from the project title block and the page:
          <code>{"{{showName}}"}</code>, <code>{"{{venue}}"}</code>, <code>{"{{designer}}"}</code>,
          <code>{"{{engineer}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{drawingTitle}}"}</code>,
          <code>{"{{company}}"}</code>, <code>{"{{revision}}"}</code>, <code>{"{{scale}}"}</code>,
          <code>{"{{sheetSize}}"}</code>, <code>{"{{pageLabel}}"}</code>, <code>{"{{projectName}}"}</code>.
          Scale and sheet size therefore never go stale when the page changes.
        </li>
        <li><strong>Logo and north arrow</strong> — the project logo from the title block and a rotatable north arrow.</li>
      </ul>
      <p>
        The fixed corner title block the print sheets use is off by default on floorplans (the
        drawing block carries the same data) and can be switched back on in the toolbar.
      </p>

      <h2>Filling a plan from the AI assistant</h2>
      <p>
        Everything above except the underlay can be generated over the{" "}
        <a href="/ai-assistant">MCP bridge</a>: <code>create_floorplan</code>,{" "}
        <code>add_floorplan_group</code>, <code>place_floorplan_symbols</code> (positions in
        real-world metres from the drawing area&apos;s corner), <code>set_floorplan_legend</code>{" "}
        (headline and installation notes), <code>set_floorplan_drawing_block</code> and{" "}
        <code>add_floorplan_revision</code> (title, fields, revision table, disclaimer), and{" "}
        <code>add_floorplan_notes</code>. Lines and load are covered by{" "}
        <code>sync_floorplan_lines</code>, <code>list_floorplan_lines</code>,{" "}
        <code>update_floorplan_line</code> (channel, mode, tap, name, rename) and{" "}
        <code>speaker_load_report</code> (every amplifier on the schematic, channel by channel).
        The server ships a <em>floorplan</em> playbook that walks
        the assistant through the right order. The architect&apos;s drawing itself is imported and
        calibrated in the editor — the assistant is told so when it is missing.
      </p>

      <h2>Export</h2>
      <p>
        <strong>Export PDF</strong> (toolbar, or <strong>File → Export → Export Floorplans</strong>)
        writes every floorplan page at true paper size, one PDF page each. Printed at 100 %, the
        result is a scaled drawing: distances measured off the paper are the distances on site.
      </p>
    </>
  );
}
