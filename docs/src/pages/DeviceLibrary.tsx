export default function DeviceLibraryPage() {
  return (
    <>
      <h1>Device Library</h1>

      <h2>Built-in templates</h2>
      <p>
        The device library sidebar contains <strong>2,000+ real-world device templates</strong> drawn from the
        community device library — switchers, routers, audio consoles, mixing consoles, microphones, intercom, KVM
        extenders, lighting, LED processors, media servers, and many more. Templates are fetched live from the
        community database when you're online, with a bundled subset shipped with the app for offline use.
      </p>
      <p>
        Browse the full live library — including category breakdowns and search — at{" "}
        <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">
          devices.easyschematic.live
        </a>
        .
      </p>

      <h2>Using templates</h2>
      <ol>
        <li><strong>Search</strong> by typing in the search box — multi-word queries are scored and ranked, with favorites boosted to the top</li>
        <li><strong>Drag</strong> a template from the library onto the canvas</li>
        <li>The device appears with pre-configured ports matching the real hardware</li>
      </ol>
      <p>
        Templates provide sensible defaults — the right signal types, port labels, and I/O configuration for each
        device type.
      </p>

      <h2>User templates</h2>
      <p>After editing a device's ports and configuration:</p>
      <ol>
        <li><strong>Double-click</strong> the device to open the editor</li>
        <li>Configure ports, labels, and signal types as needed</li>
        <li>Click <strong>Save as User Template</strong> at the bottom of the editor</li>
        <li>The template appears in a "User Templates" category in the library</li>
      </ol>
      <p>
        Signed in with Odoo (FACE build), user templates are saved to the central library (see
        below). Otherwise they persist in your browser's localStorage.
      </p>

      <h2>Updating a template</h2>
      <p>
        You can change a template after the fact and have the change follow through to every
        instance already placed on the current schematic:
      </p>
      <ul>
        <li>
          <strong>User templates</strong> — editing a device that came from one of your user
          templates shows an <strong>Update User Template</strong> button. It overwrites the saved
          template with the current configuration. If the device is placed elsewhere on the
          schematic you're asked to confirm, then those other instances are reconciled to the new
          definition — new ports are added, and existing connections are preserved wherever the
          port still exists.
        </li>
        <li>
          <strong>Built-in devices</strong> — editing a built-in library device offers{" "}
          <strong>Update as Custom</strong> in the save menu (the arrow next to{" "}
          <strong>Save as User Template</strong>). It creates a user template named with{" "}
          <em>(Custom)</em> appended (rename it later like any user template), re-points this device
          at it, and applies the change to the other instances of that built-in on the schematic.
        </li>
      </ul>
      <p>
        Removed ports whose connections are still in use are kept as orphaned ports so no cabling is
        silently lost; you can clean them up manually.
      </p>

      <h2>Central Library in Odoo</h2>
      <p>
        In the FACE build, user templates live in Odoo and are the same for everyone. What one person
        creates or changes, the others see at their next sign-in, or at the latest when their window comes
        back to the front after five minutes. In Odoo they are under{" "}
        <strong>Wartung → Konfiguration → Gerätevorlagen (Schaltplan)</strong>, where the history shows who changed what.
      </p>
      <ul>
        <li>
          <strong>Changing:</strong> every change to a template raises its version. Drawings with an older
          version show that on the device and offer the update. Devices in drawings never change by themselves.
        </li>
        <li>
          <strong>Changing at the same time:</strong> if a colleague changed the same template meanwhile, your
          change is not saved; a message names them and their version is loaded.
        </li>
        <li>
          <strong>Removing:</strong> removing a template from the library archives it in Odoo. <em>Delete all user
          templates</em> only empties your own browser; the templates from Odoo come back on the next load.
        </li>
        <li>
          <strong>Offline:</strong> the browser keeps the last copy. New templates that cannot reach Odoo stay in
          the browser and are marked <em>local</em>.
        </li>
        <li>
          <strong>Uploading:</strong> <strong>Upload to Odoo</strong> in the user templates section sends every
          template marked <em>local</em> once — older ones from the browser, or ones a drawing brought along.
          Nothing is duplicated; if Odoo has a different version, yours stays in the browser and is reported.
        </li>
        <li>
          <strong>Odoo product:</strong> in the device editor, <strong>Odoo product (template)</strong> links the
          template to a product in Odoo. It applies to the model, not to one device, and is saved at once.
          The library then shows the product on the template.
        </li>
        <li>
          <strong>Claude:</strong> through the Odoo connector Claude creates and changes own templates, for
          example “Add the Ajax MotionCam Outdoor as a template, reach from the datasheet”. Claude searches the
          library first, derives from a similar device where it can and names the ports and values before it
          saves. The template lands in Odoo with the origin <em>Claude</em>; changes run under your own Odoo
          name. Claude does not change built-in templates, it derives an own one. Archiving and deleting stay
          with you.
        </li>
      </ul>

      <h2>Favorites</h2>
      <p>
        Star any device template in the library to mark it as a favorite. Favorites are pinned to
        the top of the sidebar in their own <strong>Favorites</strong> category and are boosted to the
        top of search results.
      </p>
      <ul>
        <li>Click the <strong>star icon</strong> on any library item to toggle favorite status</li>
        <li>Favorites are saved in your schematic file and persist across sessions</li>
      </ul>

      <h2>Template presets</h2>
      <p>
        Presets let you save a device configuration as the <strong>project-wide default</strong> for
        that template. Every new placement of that device will automatically apply the preset
        configuration.
      </p>
      <ol>
        <li>Edit a device's ports, labels, or signal types</li>
        <li>Choose <strong>Save as Preset</strong> from the save menu in the device editor</li>
        <li>The library shows a <strong>preset badge</strong> on that template</li>
      </ol>
      <p>
        When editing a device that has a preset, a blue banner shows the active preset with
        a <strong>Clear</strong> button. If the device's configuration has drifted from the preset,
        you'll see <strong>Revert to Preset</strong> and <strong>Revert to Template</strong> buttons
        to restore either baseline. Reverting also resets the device{"'"}s header color to what a newly placed
        device would get from that preset or template, then your default header color, so a color you
        picked on the device itself is dropped.
      </p>

      <h2>Auto-numbering</h2>
      <p>
        When you place multiple instances of the same device template, EasySchematic automatically numbers them:
        "Camera 1", "Camera 2", etc. Renaming a device manually removes it from auto-numbering.
      </p>

      <h2>Quick-create routers</h2>
      <p>
        Need a matrix router with specific I/O counts? Type <strong>"router"</strong> in the device library search
        to reveal the <strong>Create Custom Router</strong> button. This opens a dialog where you can:
      </p>
      <ul>
        <li>Set a <strong>device name</strong> and device type</li>
        <li>Define <strong>input and output sections</strong> — each section has a name, port prefix, count, and signal type</li>
        <li>Add multiple sections per side (e.g., 16 SDI inputs + 4 HDMI inputs + 16 SDI outputs + 4 HDMI outputs)</li>
        <li>The router is placed on the canvas and saved as a user template</li>
      </ul>

      <h2>Expansion slots</h2>
      <p>
        Some devices have <strong>expansion slots</strong> — swappable card bays that accept different I/O cards.
        This mirrors how real hardware works: a video router chassis might ship with empty slots that you populate
        with SDI, HDMI, or fiber cards depending on the job.
      </p>
      <ul>
        <li><strong>Right-click a slot</strong> on a device to see available cards and swap one in</li>
        <li>Each card contributes its own ports to the parent device</li>
        <li>Slots show the currently installed card name (or "Empty" if unoccupied)</li>
        <li>Swapping a card removes the old card's ports and adds the new card's ports</li>
      </ul>

      <h2>Community device database</h2>
      <p>
        The <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">community device database</a> lets
        anyone browse, search, and contribute device templates.
      </p>
      <ul>
        <li><strong>Submit new devices</strong> — log in with your email, fill out the device form with ports and specs,
          and include a reference URL to the manufacturer's product page. A live preview above the form shows the
          device exactly as it will render on the schematic canvas — including port colors and section groupings —
          so you can check the layout before submitting. Ports can be reordered by dragging their grip handle
          (or with the up/down buttons), and dragging a port into another group changes its direction</li>
        <li><strong>Suggest edits</strong> — see a mistake or missing port? Propose changes to any existing template</li>
        <li><strong>Moderation</strong> — submissions are reviewed by moderators before going live to ensure accuracy</li>
        <li><strong>Reference URLs</strong> — branded devices link directly to the manufacturer's product page so
          moderators (and you) can verify specs</li>
        <li><strong>Contributor credit</strong> — approved submissions are attributed to you on the device page and
          the contributors hall of fame</li>
        <li><strong>Submit from the app</strong> — right-click any custom device on the canvas and choose
          "Submit to Community" to submit it directly without re-entering the details on the devices site.
          This also works for improvements to existing library devices: edit any placed device (fix a port,
          add a missing connector) and the same action appears in the device editor's save menu once you've made changes</li>
        <li><strong>Clone from an existing device</strong> — on the devices site, the "Submit a device" form has a
          <em>Clone existing device</em> option; pick any current template and the form prefills with its ports,
          connectors, and metadata. Tweak what's different (a sibling model, a regional variant) and submit — the
          moderation queue gets a much cleaner diff than a freshly typed-out form</li>
        <li><strong>Works offline</strong> — visit the devices site once while online and it keeps working without a
          connection: browsing, search, filters, and every device page are served from a locally saved copy of the
          library. An "offline" banner shows when you're seeing the saved copy, and it refreshes automatically the
          next time you're online. You can also install the site as an app from your browser, same as the main
          EasySchematic app</li>
      </ul>
    </>
  );
}
