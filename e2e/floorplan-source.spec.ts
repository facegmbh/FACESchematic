import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The source PDF outlives a reload. Switching pages, changing the PDF's layers and changing
 * the raster resolution all redraw from the original file; before it was kept in IndexedDB
 * those three answered "re-import the PDF" the moment the tab was refreshed.
 */
const PDF = join(dirname(fileURLToPath(import.meta.url)), "fixtures-twopage.pdf");

// Rasterizing a plan in the browser is the slowest thing the suite does.
test.slow();

test("floorplan: the source PDF survives a reload, so the plan can be redrawn", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', PDF);

  const plan = page.locator('img[alt="fixtures-twopage.pdf"]');
  await expect(plan).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTitle(/Layers of the source PDF/)).toHaveText(/2\/2/, { timeout: 15_000 });

  // Reload: the raster comes back from the autosave, the source from IndexedDB. The app
  // reopens on the schematic tab, so step back onto the plan.
  await page.reload();
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Floorplan 1/ }).click();
  await expect(plan).toBeVisible({ timeout: 30_000 });
  const beforeSwitch = await plan.getAttribute("src");

  // Page 2 of the set. The toast that says the source is gone must NOT appear.
  await page.locator('input[type="number"][max="2"]').fill("2");
  await expect.poll(async () => plan.getAttribute("src"), { timeout: 30_000 }).not.toBe(beforeSwitch);
  await expect(page.getByText(/isn't available any more/)).toHaveCount(0);

  // Resolution too, on the page we switched to.
  const afterSwitch = await plan.getAttribute("src");
  await page.getByTitle(/How finely the PDF is rasterized/).locator("select").selectOption("300");
  await expect.poll(async () => plan.getAttribute("src"), { timeout: 30_000 }).not.toBe(afterSwitch);
  await expect(page.getByText(/isn't available any more/)).toHaveCount(0);

  expect(errors).toEqual([]);
});
