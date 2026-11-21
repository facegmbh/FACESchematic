import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "./tools.js";
import { SERVER_INSTRUCTIONS } from "./prompts.js";

// FACE: the Odoo-drawing commands (SPEC-cloud-bridge.md) are described for Claude like every other tool.
test("TOOLS describe the four Odoo-drawing commands with their parameters", () => {
  const byName = new Map(TOOLS.map((t) => [t.name, t]));
  const required = (name: string) => ((byName.get(name)?.inputSchema as { required?: string[] }).required ?? []).sort();
  for (const name of ["get_editor_status", "open_odoo_drawing", "save_odoo_drawing", "new_odoo_drawing"]) {
    assert.ok(byName.has(name), name);
  }
  assert.deepEqual(required("open_odoo_drawing"), ["drawingId"]);
  assert.deepEqual(required("new_odoo_drawing"), ["name", "projectId"]);
  assert.match(byName.get("save_odoo_drawing")!.description, /force/);
  assert.match(byName.get("open_odoo_drawing")!.description, /discardChanges/);
});

test("the instructions say: status first, never discard or overwrite without being asked", () => {
  assert.match(SERVER_INSTRUCTIONS, /get_editor_status/);
  assert.match(SERVER_INSTRUCTIONS, /discardChanges/);
  assert.match(SERVER_INSTRUCTIONS, /force/);
});
