import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Floorplan page smoke test: the page mounts, an underlay imports and places itself on
 * the sheet, symbols drop with continuing auto-numbers, the legend picks the group up,
 * calibration resolves the drawing's real-world scale, the drawing block takes a title
 * and a revision, and a free text note can be dropped and edited inline.
 *
 * Uses a generated PNG rather than a PDF so the test carries its own fixture; the PDF
 * path shares everything downstream of `importUnderlayFile`.
 */

/** 2×1 white PNG — stands in for the architect's drawing. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test("floorplan: import an underlay, place numbered symbols, calibrate", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  const planPath = join(mkdtempSync(join(tmpdir(), "floorplan-")), "site-plan.png");
  writeFileSync(planPath, Buffer.from(PNG_BASE64, "base64"));

  // Skip the first-visit landing page so we land directly in the editor.
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await expect(page.getByRole("button", { name: /Import Plan/ })).toBeVisible();

  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', planPath);
  await expect(page.locator('img[alt="site-plan.png"]')).toBeVisible({ timeout: 30_000 });

  // A symbol group is one legend row; symbols placed into it continue its numbering.
  await page.getByTitle("Add a symbol group").click();
  await page.getByPlaceholder("Legend title, e.g. Ceiling speakers").fill("LS Gastro");
  await page.getByPlaceholder("Model | cable spec").fill("Bose DM6SE | 2x2,5 mm²");
  await page.getByPlaceholder("No. prefix").fill("1.1");

  await page.getByTitle("Click the plan to drop symbols of the active group").click();
  const paper = page.locator("div.bg-white.shadow-xl").first();
  const box = (await paper.boundingBox())!;
  for (const [dx, dy] of [[0.3, 0.3], [0.4, 0.45], [0.35, 0.6]]) {
    await page.mouse.click(box.x + box.width * dx, box.y + box.height * dy);
  }
  await expect(page.getByText("1.1", { exact: true })).toBeVisible();
  await expect(page.getByText("1.3", { exact: true })).toBeVisible();

  // The legend generates itself from the groups in use.
  await expect(page.getByText("Bose DM6SE | 2x2,5 mm²", { exact: true })).toBeVisible();

  // Calibrating from a known dimension resolves the underlay's real-world scale.
  await page.getByRole("button", { name: /Select/ }).click();
  await page.getByTitle(/Click two points a known distance apart/).click();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.25);
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.25);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/mm\/px/)).toBeVisible();

  // Drawing block: title resolves from the page label token; a revision row appears.
  await page.getByPlaceholder("Drawing title, e.g. Ground floor").fill("Ground floor");
  await page.getByRole("button", { name: "+ Revision" }).click();
  await page.getByPlaceholder("Change").fill("First issue");
  await expect(page.getByText("Ground floor", { exact: true })).toBeVisible();
  await expect(page.getByText("First issue", { exact: true })).toBeVisible();

  // A free text note dropped with the note tool, edited inline.
  await page.getByTitle("Click the plan to add a text note (installation hint, remark)").click();
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Reinforce ceiling 1.2 x 0.6 m");
  await page.keyboard.press("Control+Enter");
  // The text also sits in the sidebar's note editor — assert on the sheet itself.
  await expect(paper.getByText("Reinforce ceiling 1.2 x 0.6 m", { exact: true })).toBeVisible();

  // The PDF export draws the same sheet: underlay, symbols, notes, legend and drawing block.
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  expect(download.suggestedFilename()).toMatch(/Floorplans\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  console.log("exported PDF:", pdfPath);

  // Ignore offline/cloud noise — the API isn't reachable from the test environment.
  const relevant = errors.filter(
    (e) => !/favicon|deviceLibrary|ERR_TUNNEL|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|401|403|Failed to load resource/i.test(e),
  );
  expect(relevant).toEqual([]);
});
