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
        opens as an A1 landscape sheet at 1:50 with the symbol sidebar on the left. Right-click the
        tab for rename / duplicate / delete — deleting a floorplan removes its underlay and symbols,
        never the devices themselves.
      </p>

      <h2>Importing the architect&apos;s drawing</h2>
      <p>
        <strong>Import Plan…</strong> in the toolbar takes a <strong>PDF</strong> (any page of it)
        or an image (PNG, JPEG, WebP, SVG). PDF pages are rendered in the browser and placed at
        their own physical size; multi-page sets get a page selector next to the file name so you
        can switch floors without re-importing.
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
      <ul>
        <li><strong>Opacity</strong> fades the drawing back so symbols stay readable over dense linework.</li>
        <li><strong>Lock</strong> pins the underlay so it can&apos;t be nudged while placing symbols.</li>
        <li>Unlocked, drag the underlay to reposition it; the corner handle resizes it with the aspect ratio locked.</li>
      </ul>

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

      <h2>Symbol groups</h2>
      <p>
        A symbol group is one legend row: a color, a shape and the model it stands for. Add groups
        in the sidebar and give each one a title (&quot;Ceiling speakers&quot;), a description line
        (&quot;Bose DM6SE black | cable 2×2.5 mm²&quot;), and optionally a product image for the
        legend.
      </p>
      <ul>
        <li><strong>Color</strong> — from the swatch row or any custom color.</li>
        <li><strong>Shape</strong> — circle, square, diamond or triangle, so groups stay apart on a monochrome print.</li>
        <li>
          <strong>Number prefix</strong> — seeds the auto-numbering. Type <code>1.1</code> and the
          group numbers 1.1, 1.2, 1.3…; type <code>SB.</code> and it runs SB.1, SB.2, …
        </li>
      </ul>

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

      <h2>Title block and export</h2>
      <p>
        The project <a href="/printing">title block</a> — project, client, drawing title, date,
        logo — sits in the bottom-right corner of the sheet, the same block the print sheets use.
        Toggle it off per page in the toolbar.
      </p>
      <p>
        <strong>Export PDF</strong> (toolbar, or <strong>File → Export → Export Floorplans</strong>)
        writes every floorplan page at true paper size, one PDF page each. Printed at 100 %, the
        result is a scaled drawing: distances measured off the paper are the distances on site.
      </p>
    </>
  );
}
