/**
 * How the central device library from Odoo (SPEC-odoo-device-library.md) folds into the
 * browser's own devices. Pure, so the store can use it without importing the backend client.
 */
import type { DeviceTemplate } from "./types";

/** One template as /face/api/library hands it out (mcp-server/src/cloud/library.ts). */
export interface CentralEntry {
  key: string;
  version: number;
  productId: number | null;
  productName: string | null;
  writeDate: string;
  writtenBy: string | null;
  template: DeviceTemplate;
}

/** What the browser remembers about a central template; a key missing here is local only. */
export interface LibraryMetaEntry {
  version: number;
  productId: number | null;
  productName: string | null;
}

export type LibraryMeta = Record<string, LibraryMetaEntry>;

export interface CentralMergeResult {
  templates: DeviceTemplate[];
  order: string[];
  meta: LibraryMeta;
  added: number;
  updated: number;
  removed: number;
  /** Keys dropped because they left Odoo — their group assignments go too. */
  removedKeys: string[];
}

const keyOf = (t: DeviceTemplate) => t.id ?? t.deviceType;

/**
 * Central templates join or replace the browser's copies; the higher version wins, a local copy
 * without one (brought in by a drawing) counts as oldest. What was central before and is no
 * longer in Odoo — archived by a colleague — leaves the library. What only this browser has stays.
 */
export function mergeCentralLibrary(
  local: DeviceTemplate[],
  order: string[],
  previousMeta: LibraryMeta,
  entries: CentralEntry[],
): CentralMergeResult {
  const central = new Map(entries.map((e) => [e.key, e]));
  const removedKeys = Object.keys(previousMeta).filter((k) => !central.has(k));
  const gone = new Set(removedKeys);
  let updated = 0;

  const templates = local
    .filter((t) => !gone.has(keyOf(t)))
    .map((t) => {
      const e = central.get(keyOf(t));
      if (!e || (t.version ?? 0) > e.version) return t;
      const next = { ...e.template, version: e.version };
      if (JSON.stringify(next) === JSON.stringify(t)) return t;
      updated++;
      return next;
    });

  const present = new Set(templates.map(keyOf));
  const fresh = entries.filter((e) => !present.has(e.key));
  templates.push(...fresh.map((e) => ({ ...e.template, version: e.version })));

  const nextOrder = order.filter((k) => !gone.has(k));
  const ordered = new Set(nextOrder);
  for (const e of fresh) if (!ordered.has(e.key)) nextOrder.push(e.key);

  const meta: LibraryMeta = {};
  for (const e of entries) meta[e.key] = { version: e.version, productId: e.productId, productName: e.productName };

  return { templates, order: nextOrder, meta, added: fresh.length, updated, removed: removedKeys.length, removedKeys };
}
