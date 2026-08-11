import type { DeviceTemplate } from "../types";
import data from "./face-library.json";

/**
 * FACE GmbH house device library.
 *
 * These 153 templates were curated in the browser as *user templates* (localStorage,
 * exported via "Save Device Archive") while planning the SKUZ Schüttorf install, which
 * meant every colleague had to import the archive by hand to see them. Bundling them
 * here puts them in `DEVICE_TEMPLATES`, so they ship in `deviceLibrary.fallback.json`
 * and reach every user of the deployed app with no import step and no network round-trip.
 *
 * IDs are preserved verbatim from the archive — existing schematics reference them via
 * `node.data.templateId`, and changing them would break template-sync drift detection
 * on already-placed devices.
 *
 * Unlike the hand-authored modules in this directory, the data lives in an adjacent
 * JSON file rather than in `port()`/`ports()` helper calls: it carries per-port
 * `section`/`flipped`/`notes` layout and `auxiliaryData` rows that the helpers don't
 * model, and round-tripping it as data keeps it lossless and re-generatable from a
 * fresh archive export.
 *
 * Port counts/specs are representative starting points; verify against the concrete
 * model variant before relying on a schematic for procurement. Templates that are
 * deliberately generic or carry assumptions:
 *
 * - **Crown I-Tech HD (Generic 2-Channel)** — pick the concrete model (5000HD/9000HD/
 *   12000HD) for accurate specs.
 * - **Ayrton Stradale Profile** — fixed feed (PowerCon IP44 / open-ended, no
 *   through-connection). Wired DMX confirmed in addition to CRMX.
 * - **PureTools 4x1 HDMI 2.1 Switch (48G, 8K)** — audio de-embed connector
 *   (Toslink/analog) inferred.
 * - **Epson EB-PU2216B** — input complement typical for the PU series; SDI/DVI vary by
 *   firmware/slot.
 * - **Samsung QM-C Serie** — one template for QM55C/65C/75C/85C/98C (identical ports);
 *   dimensions and power draw depend on the size.
 * - **Service PC (Workstation)** — generic; adjust ports as needed.
 * - **FACE Beam150** — FACE house brand: DMX 3-pin confirmed, power/connector assumed.
 */
export const templates = data as DeviceTemplate[];
