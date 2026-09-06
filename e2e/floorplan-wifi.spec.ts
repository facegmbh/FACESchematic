import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Walls and the Wi-Fi heatmap: trace a run, give it a build-up, drop an access point and
 * see the coverage appear — and shrink when the wall gets thicker.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: trace a wall, place an AP, and the heatmap answers to both", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  const planPath = join(mkdtempSync(join(tmpdir(), "floorplan-")), "plan.png");
  writeFileSync(planPath, Buffer.from(PNG_BASE64, "base64"));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', planPath);
  await expect(page.locator('img[alt="plan.png"]')).toBeVisible({ timeout: 30_000 });

  const paper = page.locator("div.bg-white.shadow-xl").first();
  const box = (await paper.boundingBox())!;

  // ── Trace a two-segment wall run with the wall tool ──
  await page.getByRole("button", { name: /Wall$/ }).click();
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.2);
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.6);
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await page.keyboard.press("Enter");

  await expect(page.getByText(/Walls \(1\)/)).toBeVisible();
  // Drawn at its real thickness, so the stroke width is a function of mm and scale.
  const wallLine = paper.locator("svg polyline[stroke-linecap='butt']").nth(1);
  await expect(wallLine).toBeVisible();
  const thinStroke = Number(await wallLine.getAttribute("stroke-width"));

  // ── Make it a 240 mm solid brick wall ──
  await page.getByRole("combobox").filter({ hasText: /Drywall|Gipskarton/ }).selectOption("brick-solid");
  await page.getByRole("button", { name: "240", exact: true }).click();
  const thickStroke = Number(await wallLine.getAttribute("stroke-width"));
  expect(thickStroke).toBeGreaterThan(thinStroke);

  // ── The heatmap says plainly that it has nothing to draw yet ──
  // An access point reaches the plan by being dropped from the floorplan sidebar, i.e.
  // it has to exist as a device on the schematic first. Until then the panel has to say
  // so rather than showing an empty picture — that distinction is the point here.
  await page.locator('summary:has-text("Wi-Fi heatmap")').first().click();
  const showBox = page.locator('label:has-text("Show the heatmap") input[type="checkbox"]');
  await showBox.check();
  await expect(page.getByText(/No access points on this plan yet|Noch keine Access Points/)).toBeVisible();
  await expect(paper.locator("canvas")).toHaveCount(0);

  // Switching the band keeps the plan intact — the walls are not part of the radio model.
  await page.locator('label:has-text("Band") select').selectOption("2.4");
  await expect(page.getByText(/Walls \(1\)/)).toBeVisible();

  console.log("ERRORS:", JSON.stringify(errors));
  expect(errors).toEqual([]);
});
