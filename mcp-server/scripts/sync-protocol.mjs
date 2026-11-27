// Copies the canonical wire protocol from the app into this package so there is
// exactly ONE source of truth (src/mcp/protocol.ts). The copies are gitignored and
// regenerated on every build/test, so they can never silently drift.
//
// templateValidation.ts (SPEC-odoo-device-library.md) comes along: the backend checks
// templates for the central library with the same function as the editor. Its one import,
// "./protocol", is pointed at the generated copy.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "../../src/mcp");
const out = resolve(here, "../src");

const copies = [
  { from: "protocol.ts", to: "protocol.generated.ts" },
  { from: "templateValidation.ts", to: "templateValidation.generated.ts", imports: { "./protocol": "./protocol.generated.js" } },
];

mkdirSync(out, { recursive: true });
for (const { from, to, imports = {} } of copies) {
  let text = readFileSync(resolve(app, from), "utf8");
  for (const [spec, target] of Object.entries(imports)) {
    const before = `from "${spec}";`;
    if (!text.includes(before)) throw new Error(`[sync-protocol] ${from} no longer imports ${spec}`);
    text = text.replaceAll(before, `from "${target}";`);
  }
  const banner = `// AUTO-GENERATED from src/mcp/${from} — do not edit. Regenerate with \`npm run sync\`.\n`;
  const dest = resolve(out, to);
  writeFileSync(dest, banner + text);
  process.stderr.write(`[sync-protocol] wrote ${dest}\n`);
}
