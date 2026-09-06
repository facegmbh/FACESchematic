/**
 * German dictionary, assembled from one module per UI surface so several people
 * (or agents) can translate different areas without fighting over one huge file.
 *
 * `DE_COMMON` is merged last on purpose: shared words like Cancel/Save/Delete
 * get one translation for the whole app. A surface that needs a different word
 * for the same English string uses a `::context` key, which never collides.
 */
import { DE_MENU } from "./menu";
import { DE_PREFERENCES } from "./preferences";
import { DE_SETTINGS } from "./settings";
import { DE_DEVICES } from "./devices";
import { DE_REPORTS } from "./reports";
import { DE_FLOORPLAN } from "./floorplan";
import { DE_RACK } from "./rack";
import { DE_CANVAS } from "./canvas";
import { DE_SYSTEM } from "./system";
import { DE_COMMON } from "./common";

export const DE: Readonly<Record<string, string>> = {
  ...DE_MENU,
  ...DE_PREFERENCES,
  ...DE_SETTINGS,
  ...DE_DEVICES,
  ...DE_REPORTS,
  ...DE_FLOORPLAN,
  ...DE_RACK,
  ...DE_CANVAS,
  ...DE_SYSTEM,
  ...DE_COMMON,
};
