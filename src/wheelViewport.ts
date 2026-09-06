/**
 * What a wheel event does to a viewport — shared by every pan/zoom surface: the schematic
 * canvas, the floorplan sheet and the print sheet.
 *
 * This lived three times over as a copy, and the floorplan's copy had lost its trackpad
 * handling, so a two-finger scroll there zoomed instead of panning. One implementation
 * now, so a gesture means the same thing wherever the user is.
 */

import type { ScrollConfig } from "./types";

export interface WheelViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WheelViewportOptions {
  /** Pointer position relative to the element being zoomed, in px — zoom anchors here. */
  pointer: { x: number; y: number };
  /** True while the physical Control key is down. A wheel event that carries `ctrlKey`
   *  without the key being held is a trackpad pinch, which always zooms. */
  ctrlHeld: boolean;
  /** True while a trackpad gesture is in flight — see {@link createTrackpadGesture}. */
  trackpadActive: boolean;
  minZoom: number;
  maxZoom: number;
}

/** How much of `deltaY` a pinch gesture turns into zoom, against a mouse wheel's notch.
 *  A pinch reports small continuous deltas, a wheel reports coarse jumps. */
const PINCH_ZOOM_STEP = 0.01;
const WHEEL_ZOOM_STEP = 0.001;

function zoomAt(vp: WheelViewport, target: number, pointer: { x: number; y: number }): WheelViewport {
  const ratio = target / vp.zoom;
  return {
    zoom: target,
    x: pointer.x - (pointer.x - vp.x) * ratio,
    y: pointer.y - (pointer.y - vp.y) * ratio,
  };
}

/** The viewport a wheel event leads to. Pure — callers apply the result themselves. */
export function nextWheelViewport(
  e: Pick<WheelEvent, "deltaX" | "deltaY" | "ctrlKey" | "shiftKey">,
  vp: WheelViewport,
  cfg: ScrollConfig,
  o: WheelViewportOptions,
): WheelViewport {
  const clamp = (z: number) => Math.min(o.maxZoom, Math.max(o.minZoom, z));

  // Trackpad pinch: the browser synthesizes ctrlKey. Physically held Ctrl means the user
  // asked for cfg.ctrlScroll instead, so the two must stay apart.
  if (cfg.trackpadEnabled && e.ctrlKey && !o.ctrlHeld) {
    return zoomAt(vp, clamp(vp.zoom * (1 - e.deltaY * PINCH_ZOOM_STEP * cfg.zoomSpeed)), o.pointer);
  }

  // Trackpad two-finger scroll: pan both axes. Once a gesture is recognized this also
  // covers the pure-vertical frames of it, which carry no deltaX to recognize them by.
  if (o.trackpadActive && !e.ctrlKey && !e.shiftKey) {
    return { zoom: vp.zoom, x: vp.x - e.deltaX * cfg.panSpeed, y: vp.y - e.deltaY * cfg.panSpeed };
  }

  const action = e.ctrlKey ? cfg.ctrlScroll : e.shiftKey ? cfg.shiftScroll : cfg.scroll;
  if (action === "zoom") {
    return zoomAt(vp, clamp(vp.zoom * (1 - e.deltaY * WHEEL_ZOOM_STEP * cfg.zoomSpeed)), o.pointer);
  }
  if (action === "pan-x") {
    return { zoom: vp.zoom, x: vp.x - e.deltaY * cfg.panSpeed, y: vp.y };
  }
  return { zoom: vp.zoom, x: vp.x, y: vp.y - e.deltaY * cfg.panSpeed };
}

/** How long after the last wheel event a trackpad gesture is still considered in flight. */
export const TRACKPAD_GESTURE_MS = 400;

export interface TrackpadGesture {
  /** Feed every wheel event through this before asking {@link isActive}. */
  saw(e: Pick<WheelEvent, "deltaX" | "ctrlKey">, enabled: boolean, ctrlHeld: boolean): void;
  isActive(): boolean;
  dispose(): void;
}

/** Recognizes a trackpad from the shape of its events: a horizontal component, or the
 *  synthetic ctrlKey of a pinch. Neither appears on a plain mouse wheel. The verdict is
 *  held for {@link TRACKPAD_GESTURE_MS} after the last event, so the vertical middle of a
 *  two-finger swipe is not mistaken for a mouse. */
export function createTrackpadGesture(): TrackpadGesture {
  let active = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    saw(e, enabled, ctrlHeld) {
      if (!enabled) return;
      if (e.deltaX !== 0 || (e.ctrlKey && !ctrlHeld)) active = true;
      clearTimeout(timer);
      timer = setTimeout(() => { active = false; }, TRACKPAD_GESTURE_MS);
    },
    isActive() {
      return active;
    },
    dispose() {
      clearTimeout(timer);
      active = false;
    },
  };
}
