import { test } from "node:test";
import assert from "node:assert/strict";
import { toolResultContent } from "./content.js";

test("toolResultContent: a plain result is pretty JSON text", () => {
  assert.deepEqual(toolResultContent({ a: 1 }), [{ type: "text", text: JSON.stringify({ a: 1 }, null, 2) }]);
});

test("toolResultContent: an image becomes an image block, the rest stays text (without the base64)", () => {
  const content = toolResultContent({ image: { mimeType: "image/png", data: "iVBOR" }, width: 800, height: 600 });
  assert.deepEqual(content, [
    { type: "image", mimeType: "image/png", data: "iVBOR" },
    { type: "text", text: JSON.stringify({ width: 800, height: 600 }, null, 2) },
  ]);
});

test("toolResultContent: something that only looks like an image is left as text", () => {
  const odd = { image: { mimeType: "text/html", data: "<b>" } };
  assert.deepEqual(toolResultContent(odd), [{ type: "text", text: JSON.stringify(odd, null, 2) }]);
});
