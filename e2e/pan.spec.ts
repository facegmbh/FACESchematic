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
  const before = await rfVp.evaluate((el) => getComputedStyle(el).transform);
  await swipe(page, 700, 500, 120, 160);
  const after = await rfVp.evaluate((el) => getComputedStyle(el).transform);
  expect(after).not.toBe(before);

  // Floorplan: the surface that zoomed instead of panning.
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  const sheet = page.locator("div.bg-white.shadow-xl").first();
  await expect(sheet).toBeVisible();
  const box0 = (await sheet.boundingBox())!;
  await swipe(page, box0.x + box0.width / 2, box0.y + box0.height / 2, 140, 90);
  const box1 = (await sheet.boundingBox())!;

  // Panned, not zoomed: the sheet moved but kept its size.
  expect(Math.abs(box1.x - box0.x)).toBeGreaterThan(20);
  expect(Math.abs(box1.y - box0.y)).toBeGreaterThan(10);
  expect(Math.abs(box1.width - box0.width)).toBeLessThan(2);
});
