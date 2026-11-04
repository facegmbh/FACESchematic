/**
 * Reading a DXF into the little that a floorplan underlay needs: how big the drawing is,
 * what it is measured in, which layers it has, and the entities themselves.
 *
 * This is deliberately not a CAD kernel. The drawing is a backdrop to place devices on, so
 * what matters is that it lands on the sheet at the right scale with the right layers —
 * not that every spline is mathematically perfect.
 *
 * The parser is loaded on demand: nobody who never opens a plan should carry it.
 */
import type { IBlock, IDxf, IEntity, IPoint } from "dxf-parser";
import { t } from "../i18n";

export type DxfUnit = "mm" | "cm" | "m" | "in" | "ft";

/** What one drawing unit is worth, so a plan drawn in metres lands at the same size as one
 *  drawn in millimetres. */
export const MM_PER_DXF_UNIT: Record<DxfUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

/** $INSUNITS, as far as a building drawing ever uses it. */
const UNIT_BY_INSUNITS: Record<number, DxfUnit> = {
  1: "in",
  2: "ft",
  4: "mm",
  5: "cm",
  6: "m",
};

export interface DxfLayerInfo {
  name: string;
  /** Preselected state: a layer the drawing itself has frozen or switched off starts off. */
  visible: boolean;
}

export interface DxfExtents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DxfDrawing {
  unit: DxfUnit;
  /** The drawing did not say — mm was assumed, and the import dialog offers to change it. */
  unitAssumed: boolean;
  /** Bounding box in drawing units. */
  extents: DxfExtents;
  layers: DxfLayerInfo[];
  entities: IEntity[];
  blocks: Record<string, IBlock>;
}

/** A nested INSERT is a block placed inside a block; this is how deep that is followed. */
const MAX_BLOCK_DEPTH = 8;

export async function parseDxf(text: string): Promise<DxfDrawing> {
  const { default: DxfParser } = await import("dxf-parser");
  let dxf: IDxf | null = null;
  try {
    dxf = new DxfParser().parseSync(text);
  } catch (e) {
    throw new Error(t("This file could not be read as a DXF: {reason}", {
      reason: e instanceof Error ? e.message : String(e),
    }));
  }
  if (!dxf || !Array.isArray(dxf.entities)) {
    throw new Error(t("This file could not be read as a DXF."));
  }
  const entities = dxf.entities.filter((e) => e && typeof e.type === "string");
  if (entities.length === 0) {
    throw new Error(t("This DXF draws nothing — it is empty, or everything sits in a layout. Export it from model space."));
  }

  const blocks = dxf.blocks ?? {};
  const insunits = numberAt(dxf.header, "$INSUNITS");
  const unit = insunits !== undefined ? UNIT_BY_INSUNITS[insunits] : undefined;

  return {
    unit: unit ?? "mm",
    unitAssumed: unit === undefined,
    extents: headerExtents(dxf) ?? entityExtents(entities, blocks),
    layers: layerList(dxf, entities),
    entities,
    blocks,
  };
}

// ── Header ──────────────────────────────────────────────────────────

function numberAt(header: IDxf["header"] | undefined, key: string): number | undefined {
  const value = header?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pointAt(header: IDxf["header"] | undefined, key: string): { x: number; y: number } | undefined {
  const value = header?.[key] as IPoint | undefined;
  if (!value || typeof value !== "object") return undefined;
  const { x, y } = value;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

/** $EXTMIN/$EXTMAX, when they say something. Two kinds say nothing and are ignored rather
 *  than believed: AutoCAD's "nothing here yet" placeholder (+1e20 / -1e20, always the
 *  wrong way round) and a never-regenerated 0,0 / 0,0. Both fail the one test that matters
 *  — the box has to enclose some area. */
function headerExtents(dxf: IDxf): DxfExtents | undefined {
  const min = pointAt(dxf.header, "$EXTMIN");
  const max = pointAt(dxf.header, "$EXTMAX");
  if (!min || !max) return undefined;
  if (!(max.x > min.x) || !(max.y > min.y)) return undefined;
  return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
}

// ── Layers ──────────────────────────────────────────────────────────

function layerList(dxf: IDxf, entities: IEntity[]): DxfLayerInfo[] {
  const layers: DxfLayerInfo[] = [];
  const seen = new Set<string>();
  const table = dxf.tables?.layer?.layers ?? {};
  for (const [name, layer] of Object.entries(table)) {
    seen.add(name);
    // dxf-parser already folds the negative-colour convention into `visible`.
    layers.push({ name, visible: layer.visible !== false && layer.frozen !== true });
  }
  // Drawings in the wild name layers on entities that the table never declares. Dropping
  // those entities would lose walls, so the layer is taken at its word.
  for (const entity of entities) {
    const name = entity.layer;
    if (typeof name === "string" && name.length > 0 && !seen.has(name)) {
      seen.add(name);
      layers.push({ name, visible: true });
    }
  }
  return layers;
}

// ── Extents ─────────────────────────────────────────────────────────

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const EMPTY_BOX: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

/**
 * Bounding box over everything the drawing contains, blocks included.
 *
 * Arcs are measured by their whole circle rather than by their swept part. That makes the
 * box a little generous for a drawing built mostly of arcs — which costs a margin of white
 * around an underlay and nothing else, while the exact version costs quadrant arithmetic
 * that nothing here would be better for.
 */
export function entityExtents(entities: IEntity[], blocks: Record<string, IBlock>): DxfExtents {
  const box = { ...EMPTY_BOX };
  collect(entities, blocks, box, { x: 0, y: 0, sx: 1, sy: 1, rot: 0 }, 0);
  if (!Number.isFinite(box.minX) || !Number.isFinite(box.minY)) {
    // Nothing had usable coordinates — one unit square keeps the caller's arithmetic sane.
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return box;
}

/** Placement of a block: where it sits, how it is scaled (negative = mirrored) and turned. */
export interface DxfTransform {
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Degrees, counter-clockwise, as DXF counts them. */
  rot: number;
}

export function applyTransform(p: { x: number; y: number }, t: DxfTransform): { x: number; y: number } {
  const sx = p.x * t.sx;
  const sy = p.y * t.sy;
  if (!t.rot) return { x: sx + t.x, y: sy + t.y };
  const rad = (t.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: sx * cos - sy * sin + t.x, y: sx * sin + sy * cos + t.y };
}

/** The placement of an INSERT, combined with the placement of whatever contains it. */
export function insertTransform(entity: IEntity, outer: DxfTransform): DxfTransform {
  const e = entity as unknown as {
    position?: IPoint;
    xScale?: number;
    yScale?: number;
    rotation?: number;
  };
  const local = applyTransform({ x: e.position?.x ?? 0, y: e.position?.y ?? 0 }, outer);
  return {
    x: local.x,
    y: local.y,
    sx: outer.sx * (e.xScale ?? 1),
    sy: outer.sy * (e.yScale ?? 1),
    rot: outer.rot + (e.rotation ?? 0),
  };
}

function grow(box: Box, p: { x: number; y: number }): void {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  box.minX = Math.min(box.minX, p.x);
  box.minY = Math.min(box.minY, p.y);
  box.maxX = Math.max(box.maxX, p.x);
  box.maxY = Math.max(box.maxY, p.y);
}

function collect(
  entities: IEntity[],
  blocks: Record<string, IBlock>,
  box: Box,
  transform: DxfTransform,
  depth: number,
): void {
  for (const entity of entities) {
    if (entity.type === "INSERT" || entity.type === "DIMENSION") {
      const name = (entity as unknown as { name?: string; block?: string }).name
        ?? (entity as unknown as { block?: string }).block;
      const block = name ? blocks[name] : undefined;
      if (block?.entities && depth < MAX_BLOCK_DEPTH) {
        const inner = entity.type === "INSERT" ? insertTransform(entity, transform) : transform;
        collect(block.entities, blocks, box, inner, depth + 1);
        continue;
      }
    }
    for (const p of entityPoints(entity)) grow(box, applyTransform(p, transform));
  }
}

/** Every coordinate an entity carries, in its own (pre-transform) space. */
export function entityPoints(entity: IEntity): { x: number; y: number }[] {
  const e = entity as unknown as Record<string, unknown>;
  const out: { x: number; y: number }[] = [];

  const pushPoint = (value: unknown) => {
    const p = value as IPoint | undefined;
    if (p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y)) out.push({ x: p.x, y: p.y });
  };
  for (const key of ["position", "startPoint", "endPoint", "center", "anchorPoint", "insertionPoint"]) {
    pushPoint(e[key]);
  }
  for (const key of ["vertices", "points", "controlPoints", "fitPoints"]) {
    const list = e[key];
    if (Array.isArray(list)) for (const p of list) pushPoint(p);
  }

  // A circle or an arc reaches a radius beyond its centre in every direction.
  const radius = typeof e.radius === "number" ? e.radius : undefined;
  const center = e.center as IPoint | undefined;
  if (radius !== undefined && center) {
    out.push({ x: center.x - radius, y: center.y - radius }, { x: center.x + radius, y: center.y + radius });
  }
  // An ellipse states its major axis as an offset from the centre.
  const major = e.majorAxisEndPoint as IPoint | undefined;
  if (major && center) {
    const r = Math.max(Math.abs(major.x), Math.abs(major.y));
    out.push({ x: center.x - r, y: center.y - r }, { x: center.x + r, y: center.y + r });
  }
  return out;
}
