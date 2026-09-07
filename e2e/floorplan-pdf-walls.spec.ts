import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

/**
 * Walls out of the architect's PDF, end to end: import the real plan as the underlay, open
 * the wall dialog, see the wall layer preselected with its thicknesses read, take them all.
 * Then the other path — candidates on the sheet, picked one by one.
 */
// Specs run as ES modules, so the fixture is located relative to this file, not __dirname.
const PLAN = fileURLToPath(new URL("./CBC-Osnabrück_CEI_5010A-EG_260814.pdf", import.meta.url));

test.slow();

test("floorplan: walls come out of the PDF's own layer, thickness included", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', PLAN);
  // An A1 sheet at 150 dpi takes a moment to rasterise.
  await expect(page.locator('img[alt="CBC-Osnabrück_CEI_5010A-EG_260814.pdf"]')).toBeVisible({ timeout: 60_000 });

  // ── Open the dialog: the wall layer is found and ticked without help ──
  await page.getByRole("button", { name: /Walls from PDF/ }).click();
  const dialog = page.locator("[data-wall-import-dialog]");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  const wallLayer = dialog.locator("label", { hasText: "00 CEI Wände" });
  await expect(wallLayer.locator('input[type="checkbox"]')).toBeChecked();
  await expect(dialog.locator("label", { hasText: "00 CEI Bodenbelag" }).locator('input[type="checkbox"]')).not.toBeChecked();

  // The preview reports real thicknesses — the 120 mm partitions are this plan's most
  // common family, and they have to appear before anything is taken.
  await expect(dialog.getByText(/with thickness read from the drawing/)).toBeVisible();
  await expect(dialog.getByText(/120 mm ×\d+/)).toBeVisible();
  // Page and plan both say 1:50, so no scale warning.
  await expect(dialog.getByText(/The plan states/)).toHaveCount(0);

  // ── Take them all ──
  await dialog.getByRole("button", { name: "Take all" }).click();
  await expect(dialog).toHaveCount(0);
  const wallsHeading = page.getByText(/Walls \(\d+\)/);
  await expect(wallsHeading).toBeVisible();
  const count = Number((await wallsHeading.textContent())!.match(/\((\d+)\)/)![1]);
  expect(count).toBeGreaterThan(50);

  // Drawn on the sheet at their real thickness: the wall layer has many polylines now.
  const paper = page.locator("div.bg-white.shadow-xl").first();
  expect(await paper.locator("svg polyline[stroke-linecap='butt']").count()).toBeGreaterThan(count);

  // ── One undo step takes them all back ──
  // Exactly one press: a second would undo the underlay import as well and take the
  // "Walls from PDF" button with it.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByText(/Walls \(0\)/)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('img[alt="CBC-Osnabrück_CEI_5010A-EG_260814.pdf"]')).toBeVisible();

  // ── The other path: candidates on the sheet, one taken by clicking ──
  await page.getByRole("button", { name: /Walls from PDF/ }).click();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Pick on the sheet" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /candidates on the sheet — hide/ })).toBeVisible();

  const candidates = paper.locator("svg g[data-wall-candidate]");
  const offered = await candidates.count();
  expect(offered).toBeGreaterThan(50);
  // Click the middle of a horizontal candidate — on a diagonal one the box centre is off
  // the line. Take the widest flat one so the click lands on the strip for sure.
  const boxes = await Promise.all(Array.from({ length: offered }, (_, i) => candidates.nth(i).boundingBox()));
  const flat = boxes
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b && b.height <= 20 && b.width > 3 * b.height)
    .sort((p, q) => (q.b!.width - p.b!.width))[0];
  expect(flat, "a horizontal candidate exists").toBeDefined();
  const box = flat!.b!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/Walls \(1\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`${offered - 1} candidates on the sheet`) })).toBeVisible();

  // Esc drops the rest of the offer; the taken wall stays.
  await paper.click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /candidates on the sheet/ })).toHaveCount(0);
  await expect(page.getByText(/Walls \(1\)/)).toBeVisible();

  expect(errors).toEqual([]);
});
