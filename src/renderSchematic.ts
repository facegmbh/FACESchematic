/**
 * FACE: a picture of the schematic for Claude (render_schematic, SPEC-schaltplan-layout.md Task 26).
 * Same capture as the PNG download (exportUtils.captureViewportBlob), but of a chosen part — the
 * whole drawing or one room — at a size an assistant can look at, returned instead of downloaded.
 */
import type { SchematicNode } from "./types";
import { layoutSize } from "./layoutCheck";
import { captureViewportBlob } from "./exportUtils";

/** Margin around what is shown, in canvas px. */
export const RENDER_PADDING = 40;
/** Never sharper than this — 2× keeps small rooms readable without bloating the file. */
const MAX_PIXEL_RATIO = 2;
/** How long to wait for the canvas to appear and draw after switching to it. */
const DRAW_WAIT_MS = 3000;

export interface RenderBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function absolute(n: SchematicNode, byId: Map<string, SchematicNode>): { x: number; y: number } {
  let { x, y } = n.position;
  let parent = n.parentId ? byId.get(n.parentId) : undefined;
  while (parent) {
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

function size(n: SchematicNode): { width: number; height: number } {
  if (n.type === "device" || n.type === "room") return layoutSize(n);
  // Notes, tags, waypoints: only what the editor measured — no default size stretching the picture.
  return { width: n.measured?.width ?? 0, height: n.measured?.height ?? 0 };
}

type Routes = Record<string, { waypoints: { x: number; y: number }[] } | undefined>;

/** The part of the canvas to capture: all visible nodes and the routed lines (they can run
 *  outside the devices), or one room — with a margin. */
export function renderBounds(nodes: SchematicNode[], roomId?: string, routes: Routes = {}): RenderBounds {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const shown = roomId ? nodes.filter((n) => n.id === roomId) : nodes.filter((n) => !n.hidden);
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const n of shown) {
    const p = absolute(n, byId);
    const s = size(n);
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    right = Math.max(right, p.x + s.width);
    bottom = Math.max(bottom, p.y + s.height);
  }
  if (!roomId) {
    for (const r of Object.values(routes)) {
      for (const p of r?.waypoints ?? []) {
        left = Math.min(left, p.x);
        top = Math.min(top, p.y);
        right = Math.max(right, p.x);
        bottom = Math.max(bottom, p.y);
      }
    }
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: left - RENDER_PADDING,
    y: top - RENDER_PADDING,
    width: right - left + 2 * RENDER_PADDING,
    height: bottom - top + 2 * RENDER_PADDING,
  };
}

/** Scale so the longest side is at most maxSize px — sharper for small parts, never above 2×. */
export function renderPixelRatio(bounds: { width: number; height: number }, maxSize: number): number {
  return Math.min(MAX_PIXEL_RATIO, maxSize / Math.max(bounds.width, bounds.height, 1));
}

async function waitFor<T>(probe: () => T | null | undefined, ms: number): Promise<T | null> {
  const deadline = Date.now() + ms;
  for (;;) {
    const found = probe();
    if (found) return found;
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Capture `bounds` of the schematic canvas as PNG. The schematic page must be (or just have been
 *  made) the active page; waits until React Flow has drawn every node. */
export async function captureSchematicPng(bounds: RenderBounds, pixelRatio: number): Promise<Blob> {
  const viewportEl = await waitFor(() => document.querySelector<HTMLElement>(".react-flow__viewport"), DRAW_WAIT_MS);
  if (!viewportEl) throw new Error("The schematic canvas is not showing in the tab.");
  // React Flow keeps a node invisible until it has measured it.
  const drawn = await waitFor(
    () => !Array.from(viewportEl.querySelectorAll<HTMLElement>(".react-flow__node")).some((el) => el.style.visibility === "hidden"),
    DRAW_WAIT_MS,
  );
  if (!drawn) {
    throw new Error(
      "The schematic has not finished drawing — the tab is probably in the background on another page. Ask the user to bring the tab to the front once.",
    );
  }
  const blob = await captureViewportBlob(viewportEl, {
    format: "png",
    backgroundColor: "#ffffff",
    width: bounds.width,
    height: bounds.height,
    pixelRatio,
    transform: `translate(${-bounds.x}px, ${-bounds.y}px) scale(1)`,
  });
  if (!blob) throw new Error("The browser could not encode a picture this large — pass roomId or a smaller maxSize.");
  return blob;
}

/** Base64 without the data-URL prefix, in chunks (String.fromCharCode has an argument limit). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
