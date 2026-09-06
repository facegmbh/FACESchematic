import { test, expect, type Locator } from "@playwright/test";

/**
 * Panning with a trackpad. The floorplan once zoomed instead of panning because its copy of
 * the wheel handler had lost the trackpad detection the other surfaces had; all three now
 * share src/wheelViewport.ts, and this pins the gesture down on both of them.
 *
 * The wheel events are dispatched straight onto the element rather than driven through
 * page.mouse.wheel(). What is under test is the handler, not Chromium's input pipeline, and
 * a synchronous burst makes the test independent of how loaded the machine is.
 */
async function swipe(target: Locator, dx: number, dy: number) {
  await target.evaluate((el, d) => {
    const box = el.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      el.dispatchEvent(new WheelEvent("wheel", {
        // A horizontal component is what marks the gesture as a trackpad's.
        deltaX: d.dx / 4,
        deltaY: d.dy / 4,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
        bubbles: true,
        cancelable: true,
      }));
    }
  }, { dx, dy });
}

/** A transformed element's translation and scale. */
function readTransform(target: Locator) {
  return target.evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
}

test("trackpad two-finger scroll pans the floorplan and the schematic", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  // The schematic. This one already worked and must keep working.
  const canvas = page.locator(".react-flow__viewport");
  const canvasBefore = await readTransform(canvas);
  await swipe(canvas, 120, 160);
  await expect.poll(async () => (await readTransform(canvas)).x, { timeout: 15_000 }).not.toBe(canvasBefore.x);
  const canvasAfter = await readTransform(canvas);
  expect(canvasAfter.zoom).toBeCloseTo(canvasBefore.zoom, 5);

  // The floorplan sheet — the surface that zoomed instead of panning. Read its transform
  // rather than its box on screen: a panned sheet can leave the viewport, and then waiting
  // for a bounding box just times out.
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  const sheet = page.locator("div.bg-white.shadow-xl").first();
  await expect(sheet).toBeVisible();
  // fitView runs in an effect on mount; let it settle before measuring.
  await expect.poll(async () => (await readTransform(sheet)).zoom, { timeout: 15_000 }).toBeGreaterThan(0);
  const sheetBefore = await readTransform(sheet);

  await swipe(sheet, 140, 90);
  await expect.poll(async () => (await readTransform(sheet)).x, { timeout: 15_000 }).not.toBe(sheetBefore.x);
  const sheetAfter = await readTransform(sheet);

  // Panned, not zoomed.
  expect(Math.abs(sheetAfter.x - sheetBefore.x)).toBeGreaterThan(20);
  expect(Math.abs(sheetAfter.y - sheetBefore.y)).toBeGreaterThan(10);
  expect(sheetAfter.zoom).toBeCloseTo(sheetBefore.zoom, 5);
});
