// The backend's copy of the template check (generated from src/mcp/templateValidation.ts).
// The app's tests cover the rules; this only proves the copy runs under Node on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStoredTemplate } from "./templateValidation.generated.js";

const template = {
  id: "custom-1764230000000",
  label: "Audac MFA208",
  deviceType: "custom",
  ports: [{ id: "tpl-0", label: "Mic 1", signalType: "analog-audio", direction: "input", connectorType: "combo-xlr-trs" }],
};

test("checkStoredTemplate: the generated copy accepts a valid template", () => {
  assert.equal(checkStoredTemplate(template), null);
});

test("checkStoredTemplate: the generated copy refuses with a sentence", () => {
  assert.match(checkStoredTemplate({ ...template, referenceUrl: "javascript:alert(1)" }) ?? "", /Audac MFA208.*referenceUrl/);
});
