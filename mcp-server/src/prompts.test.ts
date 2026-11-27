import { test } from "node:test";
import assert from "node:assert/strict";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { PROMPTS, getPrompt, SERVER_INSTRUCTIONS } from "./prompts.js";

test("PROMPTS: exposes the five named playbooks", () => {
  assert.deepEqual(
    PROMPTS.map((p) => p.name).sort(),
    ["build-schematic", "device-template", "floorplan", "modular-chassis", "rack-elevation"],
  );
  // Every prompt the list advertises must be resolvable by getPrompt.
  for (const p of PROMPTS) {
    assert.ok(getPrompt(p.name).messages.length > 0);
  }
});

test("getPrompt: a supplied argument is woven into the message", () => {
  const result = getPrompt("build-schematic", { brief: "huddle room with one display" });
  const text = result.messages[0].content.type === "text" ? result.messages[0].content.text : "";
  assert.match(text, /get_schematic/); // the playbook body is present
  assert.match(text, /huddle room with one display/); // the user's brief is appended
});

test("getPrompt: missing argument falls back to a guiding instruction", () => {
  const text = getPrompt("modular-chassis").messages[0].content;
  assert.equal(text.type, "text");
  if (text.type === "text") assert.match(text.text, /ask the user which one to configure/);
});

test("getPrompt: an unknown name throws an MCP InvalidParams error", () => {
  assert.throws(
    () => getPrompt("no-such-prompt"),
    (err) => err instanceof McpError && err.code === ErrorCode.InvalidParams,
  );
});

test("SERVER_INSTRUCTIONS: names the five playbooks", () => {
  for (const name of ["build-schematic", "rack-elevation", "modular-chassis", "floorplan", "device-template"]) {
    assert.ok(SERVER_INSTRUCTIONS.includes(name));
  }
});

test("build-schematic: locations and areas, racks, connect BEFORE arranging (signal flow needs the connections), arrange, THEN sides (they depend on where devices ended up), route, check, look", () => {
  const text = (getPrompt("build-schematic").messages[0].content as { text: string }).text;
  const order = ["create_room", "parentRoomId", "add_rack_to_room", "place_device_in_rack", "connect_devices_batch", "arrange_room", "margin", "arrange_rooms", "gap", "renumber_ports", "choose_port_sides", "route_connections", "straighten_lines", "check_layout", "set_connection_path", "render_schematic"];
  let last = -1;
  for (const step of order) {
    const at = text.indexOf(step, last + 1);
    assert.ok(at > last, `${step} should come after the previous step`);
    last = at;
  }
  assert.match(text, /location/i);
  assert.match(text, /not .*trade/i);
  assert.match(text, /three rounds/i);
});

test("build-schematic: an existing drawing by trade is restructured, not rebuilt", () => {
  const text = (getPrompt("build-schematic").messages[0].content as { text: string }).text;
  assert.match(text, /rename_room/);
  assert.match(text, /dissolve_room/);
});

test("SERVER_INSTRUCTIONS: says how a drawing is laid out and checked", () => {
  for (const word of ["location", "check_layout", "render_schematic"]) assert.match(SERVER_INSTRUCTIONS, new RegExp(word));
});

test("build-schematic: Jean-Luc's wishes (21.11.) are in the playbook", () => {
  const text = (getPrompt("build-schematic").messages[0].content as { text: string }).text;
  // Areas inside a location: gear that sits together physically, with distance to the rest.
  assert.match(text, /area/i);
  assert.match(text, /encoder/i);
  // The rack box stays, gear side by side by signal flow; never dissolved.
  assert.match(text, /side by side/i);
  assert.match(text, /never dissolve/i);
  // No lines outside the drawing or over text; look at the picture, not only the numbers.
  assert.match(text, /outside the drawing/i);
  assert.match(text, /over .*text|over .*name/i);
  assert.match(text, /empty/i);
  // Switch ports are only renumbered when the user agrees.
  assert.match(text, /switch port/i);
});

test("build-schematic: Jean-Luc's wishes (22.11.) — off frames, not through other rooms, devices moved to straighten lines", () => {
  const text = (getPrompt("build-schematic").messages[0].content as { text: string }).text;
  assert.match(text, /along a frame/i);
  assert.match(text, /through_room/);
  assert.match(text, /side by side/i);
  assert.match(text, /straighten_lines/);
  assert.match(SERVER_INSTRUCTIONS, /straighten_lines/);
});

test("device-template: search first, derive, name the values, read before changing, announce drift (SPEC-device-template)", () => {
  const text = (getPrompt("device-template").messages[0].content as { text: string }).text;
  // Order: search, then read, then create (derived) or update.
  const order = ["search_templates", "get_device_template", "create_device_template", "baseTemplateId", "update_device_template", "baseVersion"];
  let last = -1;
  for (const step of order) {
    const at = text.indexOf(step, last + 1);
    assert.ok(at > last, `${step} should come after the previous step`);
    last = at;
  }
  // Values come from the datasheet or the user, are named before writing, never guessed.
  assert.match(text, /datasheet/i);
  assert.match(text, /never guess/i);
  assert.match(text, /before you (create|write)/i);
  // Drawings never change by themselves; the user is told about drift.
  assert.match(text, /drift/i);
  assert.match(text, /removedPorts/);
  assert.match(text, /connectedInOpenDrawing/);
  // A product is linked only when maker and model match or the user says so.
  assert.match(text, /productId/);
  assert.match(text, /maker and model/i);
  // Archiving and deleting stay with the user.
  assert.match(text, /archive/i);
});

test("device-template: a missing argument asks what device to describe", () => {
  const text = (getPrompt("device-template").messages[0].content as { text: string }).text;
  assert.match(text, /ask the user which device/i);
});

test("SERVER_INSTRUCTIONS: own devices — search first, never invent a template", () => {
  assert.match(SERVER_INSTRUCTIONS, /create_device_template/);
  assert.match(SERVER_INSTRUCTIONS, /get_device_template/);
});

test("device-template: every tool and parameter it names exists in the tool list", async () => {
  const { TOOLS } = await import("./tools.js");
  const text = (getPrompt("device-template").messages[0].content as { text: string }).text;
  const tools = new Map(TOOLS.map((t: { name: string; inputSchema: { properties?: Record<string, unknown> } }) => [t.name, t]));
  for (const name of ["search_templates", "get_device_template", "create_device_template", "update_device_template", "add_devices"]) {
    assert.ok(tools.has(name), `${name} is a tool`);
  }
  const params = new Set<string>();
  for (const name of ["create_device_template", "update_device_template"]) {
    for (const key of Object.keys(tools.get(name)!.inputSchema.properties ?? {})) params.add(key);
  }
  for (const word of ["baseTemplateId", "baseVersion", "allowDuplicate", "productId", "speakerLoad", "ampLoad", "detection", "micCoverage", "referenceUrl", "imageUrl", "ports", "deviceType"]) {
    assert.ok(text.includes(word), `the playbook names ${word}`);
    assert.ok(params.has(word), `${word} is a parameter`);
  }
  assert.doesNotMatch(text, /removePorts/);
  // Found in the end-to-end run: a placed device has its own port ids, not the template's.
  assert.match(text, /own port ids[^.]*get_device/);
  const create = tools.get("create_device_template") as unknown as { description: string };
  assert.match(create.description, /own port ids[^.]*get_device/);
});
