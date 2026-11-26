import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

/**
 * The scale of an architect's PDF, and the measuring tool (reported 25.11.2026).
 *
 * The import reads the scale the plan states. Changing the scale afterwards says what the
 * plan is drawn at — the drawing keeps covering the sheet instead of shrinking to half of
 * it. The measuring tool reads a distance between two clicks at that scale.
 */
const PLAN = fileURLToPath(new URL("./CBC-Osnabrück_CEI_5010A-EG_260814.pdf", import.meta.url));

test.slow();

test("floorplan: a PDF keeps covering the sheet when its scale is set, and distances can be measured", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', PLAN);
  const plan = page.locator('img[alt="CBC-Osnabrück_CEI_5010A-EG_260814.pdf"]');
  await expect(plan).toBeVisible({ timeout: 60_000 });

  // ── The import read the scale off the plan ──
  await expect(page.getByText(/Plan imported at 1:50, as the plan states/)).toBeVisible();
  const scale = page.getByTitle("Drawing scale — 1:50 means 1 mm on paper is 50 mm on site");
  await expect(scale).toHaveValue("50");

  // ── Setting another scale leaves the drawing where it is ──
  const before = await plan.boundingBox();
  await scale.selectOption("100");
  await expect(scale).toHaveValue("100");
  const after = await plan.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width, 0);
  expect(after!.height).toBeCloseTo(before!.height, 0);
  expect(after!.x).toBeCloseTo(before!.x, 0);

  // ── Measure: two clicks, a distance at the page's scale ──
  await page.getByTestId("floorplan-tool-measure").click();
  const readout = page.getByTestId("floorplan-measure");
  await expect(readout).toContainText("Click the first point");
  const box = (await plan.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.click(box.x + box.width * 0.3, y);
  await expect(readout).toContainText("Click the second point");
  await page.mouse.click(box.x + box.width * 0.6, y);
  const value = page.getByTestId("floorplan-measure-value");
  await expect(value).toBeVisible();
  await expect(page.getByTestId("floorplan-measure-line")).toBeVisible();

  // The plan is 594 mm wide; 30 % of that is 178.2 mm on paper: 17.8 m at 1:100.
  const metres = (s: string | null) => Number((s ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  const at100 = metres(await value.textContent());
  expect(at100).toBeGreaterThan(17.5);
  expect(at100).toBeLessThan(18.2);

  // The same two points at 1:50 are half as far apart.
  await scale.selectOption("50");
  await expect.poll(async () => metres(await value.textContent())).toBeCloseTo(at100 / 2, 1);

  // Closing the tool takes the line away; nothing was drawn onto the plan.
  await readout.getByRole("button", { name: "Close" }).click();
  await expect(readout).toHaveCount(0);
  await expect(page.getByTestId("floorplan-measure-line")).toHaveCount(0);
  await expect(page.getByTestId("floorplan-dimensions")).toHaveCount(0);

  // ── Keep a measurement as a dimension line ──
  await page.getByTestId("floorplan-tool-measure").click();
  await page.mouse.click(box.x + box.width * 0.3, y);
  await page.mouse.click(box.x + box.width * 0.6, y);
  const kept = metres(await value.textContent());
  await page.getByTestId("floorplan-measure-keep").click();
  const dims = page.getByTestId("floorplan-dimensions");
  await expect(dims.locator("g[data-dimension-id]")).toHaveCount(1);
  expect(metres(await dims.locator("text").textContent())).toBeCloseTo(kept, 2);
  // The tool is ready for the next one.
  await expect(readout).toContainText("Click the first point");

  // The figure follows the scale — it is worked out, not stored.
  await scale.selectOption("100");
  await expect.poll(async () => metres(await dims.locator("text").textContent())).toBeCloseTo(kept * 2, 1);

  // It goes into the PDF with the rest of the sheet.
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  expect(await download.path()).toBeTruthy();

  // Select it and press Delete to take it off again; undo brings it back.
  await page.getByTitle("Select and move (Esc)").click();
  await page.mouse.click(box.x + box.width * 0.45, y);
  await page.keyboard.press("Delete");
  await expect(dims).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(dims.locator("g[data-dimension-id]")).toHaveCount(1);

  expect(errors).toEqual([]);
});

test("floorplan: the measuring tool catches wall corners, and Alt lets go", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  const paper = page.locator("div.bg-white.shadow-xl").first();
  const box = (await paper.boundingBox())!;

  // One straight wall across the sheet.
  const x1 = box.x + box.width * 0.3;
  const x2 = box.x + box.width * 0.7;
  const y = box.y + box.height * 0.4;
  await page.getByRole("button", { name: /Wall$/ }).click();
  await page.mouse.click(x1, y);
  await page.mouse.click(x2, y);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Walls \(1\)/)).toBeVisible();

  await page.getByTestId("floorplan-tool-measure").click();
  const value = page.getByTestId("floorplan-measure-value");
  const metres = async () => Number(((await value.textContent()) ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  const marker = page.getByTestId("floorplan-measure-snap");

  // Near the end of the wall the pointer is caught by its corner, before any click.
  await page.mouse.move(x1 - 3, y - 3);
  await expect(marker).toHaveAttribute("data-snap-kind", "corner");

  // Two sloppy measurements along the wall read the same length: both landed on the corners.
  await page.mouse.click(x1 - 3, y - 3);
  await page.mouse.click(x2 + 2, y - 4);
  const first = await metres();
  await page.mouse.click(x1 + 3, y - 4);
  await page.mouse.click(x2 - 3, y - 2);
  expect(await metres()).toBe(first);

  // With Alt held the points stay where they were clicked: a shorter distance.
  await page.keyboard.down("Alt");
  await page.mouse.click(x1 + 6, y - 4);
  await page.mouse.click(x2 - 6, y - 4);
  await page.keyboard.up("Alt");
  expect(await metres()).toBeLessThan(first);

  expect(errors).toEqual([]);
});
