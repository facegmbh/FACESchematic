import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * A PDF's own layers (optional content groups), picked at import time. An architect ships
 * furniture, electrical and dimensions as layers, and a loudspeaker sheet wants a quieter
 * background than a cable sheet. The fixture draws one rectangle per layer, so unticking
 * one has to change the rasterized underlay.
 */
const LAYERED_PDF = join(dirname(fileURLToPath(import.meta.url)), "fixtures-layered.pdf");

// Rasterizing a plan in the browser is the slowest thing the suite does — under parallel
// load the default timeout is not enough, and a timeout here says nothing about the app.
test.slow();

test("floorplan: the source PDF's layers can be switched off at import", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();

  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', LAYERED_PDF);
  const plan = page.locator('img[alt="fixtures-layered.pdf"]');
  await expect(plan).toBeVisible({ timeout: 30_000 });

  // Both layers came in, and the picker opened itself because there was a choice to make.
  const layerButton = page.getByTitle(/Layers of the source PDF/);
  await expect(layerButton).toHaveText(/2\/2/, { timeout: 15_000 });
  if (!(await page.getByText("Moeblierung").isVisible())) await layerButton.click();
  await expect(page.getByText("Moeblierung")).toBeVisible();
  await expect(page.getByText("Elektro")).toBeVisible();

  const withBoth = await plan.getAttribute("src");

  // Switching one off redraws the plan without it. A click, not uncheck(): the box follows
  // the stored choice, which only flips once the re-render has finished.
  await page.getByRole("checkbox", { name: "Moeblierung" }).click();
  await expect(layerButton).toHaveText(/1\/2/, { timeout: 30_000 });
  await expect.poll(async () => plan.getAttribute("src"), { timeout: 30_000 }).not.toBe(withBoth);

  expect(errors).toEqual([]);
});
