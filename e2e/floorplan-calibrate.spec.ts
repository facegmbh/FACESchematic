import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Calibration has to take its two points whatever was done on the sheet before.
 *
 * Reported 23.11.2026: "ich kann nicht kalibrieren, es nimmt keinen Punkt". The sheet
 * remembers whether the last press turned into a drag, so the click that ends a drag does
 * not also place something. The calibrate tool returned before that memory was reset —
 * after any drag or pan, every calibration click counted as the end of a drag and was
 * dropped. Moving the view before calibrating is exactly what everyone does first.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: calibrating takes its points after the view was dragged", async ({ page }) => {
  const planPath = join(mkdtempSync(join(tmpdir(), "calibrate-")), "plan.png");
  writeFileSync(planPath, Buffer.from(PNG_BASE64, "base64"));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', planPath);
  await expect(page.locator('img[alt="plan.png"]')).toBeVisible({ timeout: 30_000 });

  const paper = page.locator("div.bg-white.shadow-xl").first();
  const box = (await paper.boundingBox())!;

  // Drag across the sheet with the select tool — moving the plan or the view into place,
  // the thing one does before calibrating.
  await page.getByRole("button", { name: /Select/ }).click();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 6 });
  await page.mouse.up();

  // Now calibrate: both clicks have to land.
  await page.getByTitle(/Click two points a known distance apart/).click();
  const again = (await paper.boundingBox())!;
  await page.mouse.click(again.x + again.width * 0.2, again.y + again.height * 0.3);
  await page.mouse.click(again.x + again.width * 0.4, again.y + again.height * 0.3);
  await expect(page.getByRole("button", { name: "Apply" })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/mm\/px/)).toBeVisible();
});
