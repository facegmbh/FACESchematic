import { describe, it, expect, vi, afterEach } from "vitest";
import { createTrackpadGesture, nextWheelViewport, TRACKPAD_GESTURE_MS } from "../wheelViewport";
import { DEFAULT_SCROLL_CONFIG } from "../types";

const VP = { x: 0, y: 0, zoom: 1 };
const OPTS = { pointer: { x: 100, y: 50 }, ctrlHeld: false, trackpadActive: false, minZoom: 0.05, maxZoom: 8 };
const wheel = (over: Partial<{ deltaX: number; deltaY: number; ctrlKey: boolean; shiftKey: boolean }> = {}) =>
  ({ deltaX: 0, deltaY: 0, ctrlKey: false, shiftKey: false, ...over });

afterEach(() => vi.useRealTimers());

describe("wheel viewport", () => {
  it("pans both axes during a trackpad gesture, which is what a two-finger swipe is", () => {
    const next = nextWheelViewport(wheel({ deltaX: 12, deltaY: -30 }), VP, DEFAULT_SCROLL_CONFIG, { ...OPTS, trackpadActive: true });
    expect(next).toEqual({ x: -12, y: 30, zoom: 1 });
  });

  it("zooms on a pinch, told apart from Ctrl+scroll by the physical key", () => {
    const pinch = nextWheelViewport(wheel({ deltaY: -10, ctrlKey: true }), VP, DEFAULT_SCROLL_CONFIG, OPTS);
    expect(pinch.zoom).toBeGreaterThan(1);
    // Ctrl actually held means the user asked for cfg.ctrlScroll — pan-y by default.
    const held = nextWheelViewport(wheel({ deltaY: -10, ctrlKey: true }), VP, DEFAULT_SCROLL_CONFIG, { ...OPTS, ctrlHeld: true });
    expect(held).toEqual({ x: 0, y: 10, zoom: 1 });
  });

  it("anchors a zoom on the pointer, so what is under it stays put", () => {
    const next = nextWheelViewport(wheel({ deltaY: -100 }), VP, DEFAULT_SCROLL_CONFIG, OPTS);
    expect(next.zoom).toBeCloseTo(1.1, 6);
    // The paper point under the pointer maps to the same screen point after the zoom.
    const before = (OPTS.pointer.x - VP.x) / VP.zoom;
    const after = (OPTS.pointer.x - next.x) / next.zoom;
    expect(after).toBeCloseTo(before, 6);
  });

  it("follows the scroll config for a plain mouse wheel", () => {
    const cfg = { ...DEFAULT_SCROLL_CONFIG, scroll: "pan-y" as const };
    expect(nextWheelViewport(wheel({ deltaY: 40 }), VP, cfg, OPTS)).toEqual({ x: 0, y: -40, zoom: 1 });
    const shift = nextWheelViewport(wheel({ deltaY: 40, shiftKey: true }), VP, DEFAULT_SCROLL_CONFIG, OPTS);
    expect(shift).toEqual({ x: -40, y: 0, zoom: 1 });
  });

  it("clamps the zoom to the surface's range", () => {
    expect(nextWheelViewport(wheel({ deltaY: -100000 }), VP, DEFAULT_SCROLL_CONFIG, OPTS).zoom).toBe(8);
    expect(nextWheelViewport(wheel({ deltaY: 100000 }), VP, DEFAULT_SCROLL_CONFIG, OPTS).zoom).toBe(0.05);
  });

  it("holds the trackpad verdict through the vertical middle of a swipe, then lets go", () => {
    vi.useFakeTimers();
    const g = createTrackpadGesture();
    expect(g.isActive()).toBe(false);
    g.saw({ deltaX: 4, ctrlKey: false }, true, false);
    expect(g.isActive()).toBe(true);
    // A pure-vertical frame carries no deltaX; the verdict has to survive it.
    vi.advanceTimersByTime(TRACKPAD_GESTURE_MS - 50);
    g.saw({ deltaX: 0, ctrlKey: false }, true, false);
    expect(g.isActive()).toBe(true);
    vi.advanceTimersByTime(TRACKPAD_GESTURE_MS + 10);
    expect(g.isActive()).toBe(false);
    g.dispose();
  });

  it("never calls a mouse a trackpad, and stays off when detection is disabled", () => {
    vi.useFakeTimers();
    const g = createTrackpadGesture();
    g.saw({ deltaX: 0, ctrlKey: false }, true, false);
    expect(g.isActive()).toBe(false);
    // Ctrl physically held plus a wheel is a person, not a pinch.
    g.saw({ deltaX: 0, ctrlKey: true }, true, true);
    expect(g.isActive()).toBe(false);
    g.saw({ deltaX: 9, ctrlKey: false }, false, false);
    expect(g.isActive()).toBe(false);
    g.dispose();
  });
});
