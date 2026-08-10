import type { DeviceTemplate } from "./types";

export interface TemplateExportFile {
  version: 1;
  templates: DeviceTemplate[];
}

/** Library identity of a template. Mirrors the store's templateKey. */
export function templateMergeKey(t: DeviceTemplate): string {
  return t.id ?? t.deviceType;
}

export interface TemplateMergeResult {
  /** The library after the merge: existing order preserved, new entries appended. */
  merged: DeviceTemplate[];
  /** Keys appended, in order — the caller needs these for customTemplateOrder. */
  addedKeys: string[];
  added: number;
  updated: number;
}

/**
 * Merge imported templates into a library: a matching key **overwrites** the existing
 * entry in place, an unknown key is appended.
 *
 * Overwriting is the point — skipping known keys (the previous behaviour) silently
 * turned the documented "edit the exported JSON → import it again" workflow into a
 * no-op, while the UI still reported success.
 */
export function mergeCustomTemplates(
  existing: DeviceTemplate[],
  incoming: DeviceTemplate[],
): TemplateMergeResult {
  // Last occurrence wins if the same key appears twice in one import.
  const byKey = new Map<string, DeviceTemplate>();
  for (const t of incoming) byKey.set(templateMergeKey(t), t);

  let updated = 0;
  const merged = existing.map((t) => {
    const replacement = byKey.get(templateMergeKey(t));
    if (!replacement) return t;
    updated++;
    return replacement;
  });

  const existingKeys = new Set(existing.map((t) => templateMergeKey(t)));
  const additions = [...byKey.values()].filter((t) => !existingKeys.has(templateMergeKey(t)));

  return {
    merged: [...merged, ...additions],
    addedKeys: additions.map(templateMergeKey),
    added: additions.length,
    updated,
  };
}

/** Export custom templates as a standalone JSON file download */
export function exportTemplatesToFile(templates: DeviceTemplate[]): void {
  const data: TemplateExportFile = {
    version: 1,
    templates,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "custom-templates.json";
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse and validate a template export file. Returns templates or throws on invalid input. */
export function parseTemplateFile(json: string): DeviceTemplate[] {
  const data = JSON.parse(json);
  if (
    typeof data !== "object" ||
    data === null ||
    data.version !== 1 ||
    !Array.isArray(data.templates)
  ) {
    throw new Error("Invalid template file format");
  }
  const templates: DeviceTemplate[] = [];
  for (const t of data.templates) {
    if (
      typeof t !== "object" ||
      t === null ||
      typeof t.deviceType !== "string" ||
      typeof t.label !== "string" ||
      !Array.isArray(t.ports)
    ) {
      throw new Error(`Invalid template: ${JSON.stringify(t?.label ?? t)}`);
    }
    templates.push(t as DeviceTemplate);
  }
  return templates;
}

/** Read a File object and parse it as a template export file */
export async function readTemplateFile(file: File): Promise<DeviceTemplate[]> {
  const text = await file.text();
  return parseTemplateFile(text);
}

/** Import templates from multiple files, merging into the store via the provided callback */
export async function importTemplateFiles(
  files: FileList | File[],
  importFn: (templates: DeviceTemplate[]) => { added: number; updated: number },
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  for (const file of files) {
    const result = importFn(await readTemplateFile(file));
    added += result.added;
    updated += result.updated;
  }
  return { added, updated };
}
