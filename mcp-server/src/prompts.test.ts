import { test } from "node:test";
import assert from "node:assert/strict";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { PROMPTS, getPrompt, SERVER_INSTRUCTIONS } from "./prompts.js";

test("PROMPTS: exposes the four named playbooks", () => {
  assert.deepEqual(
    PROMPTS.map((p) => p.name).sort(),
    ["build-schematic", "floorplan", "modular-chassis", "rack-elevation"],
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

test("SERVER_INSTRUCTIONS: names the four playbooks", () => {
  for (const name of ["build-schematic", "rack-elevation", "modular-chassis", "floorplan"]) {
    assert.ok(SERVER_INSTRUCTIONS.includes(name));
  }
});

test("build-schematic: locations and areas, racks, connect BEFORE arranging (signal flow needs the connections), arrange, THEN sides (they depend on where devices ended up), route, check, look", () => {
  const text = (getPrompt("build-schematic").messages[0].content as { text: string }).text;
  const order = ["create_room", "parentRoomId", "add_rack_to_room", "place_device_in_rack", "connect_devices_batch", "arrange_room", "margin", "arrange_rooms", "gap", "renumber_ports", "choose_port_sides", "route_connections", "check_layout", "set_connection_path", "render_schematic"];
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
