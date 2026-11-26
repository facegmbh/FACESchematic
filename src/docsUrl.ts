/**
 * Where the manual lives.
 *
 * The public build links to the upstream docs site. The FACE image ships its own copy next
 * to the app under /handbuch/ (Dockerfile, docker/nginx.conf): the upstream site knows
 * nothing of what was built here — floorplan scale and measuring, projection, the Odoo
 * sign-in — so a link there would send colleagues to a manual without their features.
 */
import { FACE_BACKEND } from "./faceBackend";

export const DOCS_ROOT = FACE_BACKEND ? "/handbuch/" : "https://docs.easyschematic.live/";

/** The manual's front page, or one of its pages ("floorplans", "import-devices"). */
export function docsUrl(page = ""): string {
  return DOCS_ROOT + page;
}
