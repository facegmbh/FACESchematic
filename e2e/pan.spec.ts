import { test, expect } from "@playwright/test";

/** A two-finger trackpad swipe: wheel events carrying a horizontal component. */
async function swipe(page: import("@playwright/test").Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(dx / 4, dy / 4);
    await page.waitForTimeout(20);
  }
}

/**
 * Panning with a trackpad. The floorplan once zoomed instead of panning because its copy
 * of the wheel handler had lost the trackpad detection the other surfaces had; all three
 * now share src/wheelViewport.ts, and this pins the gesture down on both of them.
 */
test("trackpad two-finger scroll pans the floorplan and the schematic", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  // Schematic first — this one already worked and must keep working.
  const rfVp = page.locator(".react-flow__viewport");
  const canvasBefore = await rfVp.evaluate((el) => getComputedStyle(el).transform);
  await expect.poll(async () => {
    await swipe(page, 700, 500, 120, 160);
    return rfVp.evaluate((el) => getComputedStyle(el).transform);
  }, { timeout: 30_000 }).not.toBe(canvasBefore);

  // Floorplan: the surface that zoomed instead of panning. Read the sheet's own transform
  // rather than its box on screen — a panned sheet can leave the viewport, and then waiting
  // for a bounding box just times out.
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  const sheet = page.locator("div.bg-white.shadow-xl").first();
  await expect(sheet).toBeVisible();
  const read = async () => sheet.evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
  // fitView runs in an effect on mount; wait for it to settle before measuring.
  await expect.poll(async () => (await read()).zoom, { timeout: 10_000 }).toBeGreaterThan(0);
  const sheetBefore = await read();

  // Repeat the gesture until it lands. Under a loaded machine a single burst of wheel
  // events can be swallowed; a pan that never happens still fails, which is the point.
  const box = (await sheet.boundingBox())!;
  await expect.poll(async () => {
    await swipe(page, box.x + box.width / 2, box.y + box.height / 2, 140, 90);
    return (await read()).x;
  }, { timeout: 30_000 }).not.toBe(sheetBefore.x);
  const sheetAfter = await read();
  // Panned, not zoomed.
  expect(Math.abs(sheetAfter.x - sheetBefore.x)).toBeGreaterThan(20);
  expect(Math.abs(sheetAfter.y - sheetBefore.y)).toBeGreaterThan(10);
  expect(sheetAfter.zoom).toBeCloseTo(sheetBefore.zoom, 5);
});
