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

// FACE: device templates (SPEC-device-template.md).
test("TOOLS describe the three device-template commands", () => {
  const byName = new Map(TOOLS.map((t) => [t.name, t]));
  const schema = (name: string) => byName.get(name)!.inputSchema as { required?: string[]; properties: Record<string, unknown> };
  for (const name of ["get_device_template", "create_device_template", "update_device_template"]) assert.ok(byName.has(name), name);
  assert.deepEqual(schema("get_device_template").required, ["templateId"]);
  assert.deepEqual(schema("create_device_template").required, ["label"]);
  assert.deepEqual(schema("update_device_template").required, ["templateId"]);
  for (const field of ["baseTemplateId", "ports", "speakerLoad", "ampLoad", "detection", "micCoverage", "productId", "allowDuplicate"]) {
    assert.ok(field in schema("create_device_template").properties, `create: ${field}`);
  }
  assert.ok("baseVersion" in schema("update_device_template").properties);
  assert.ok(!("baseTemplateId" in schema("update_device_template").properties));
  assert.match(byName.get("create_device_template")!.description, /never guess/);
  assert.match(byName.get("update_device_template")!.description, /baseVersion/);
});
