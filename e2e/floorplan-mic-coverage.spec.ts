import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A ceiling microphone dropped on a plan brings the floor it covers: the maker's area
 * under it, and a dashed ring for how far out a talker may sit at its mounting height.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: a Shure MXA920 arrives with its coverage area and its reach", async ({ page }) => {
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

  // Out of the library, onto the middle of the sheet.
  await page.getByPlaceholder(/Search plan and devices/).fill("MXA920");
  const hit = page.locator("[draggable=true]").filter({ hasText: "MXA920" }).last();
  await expect(hit).toBeVisible({ timeout: 15_000 });
  const sheet = page.locator("div.bg-white.shadow-xl").first();
  const box = (await sheet.boundingBox())!;
  const templateId = await hit.evaluate((el) => {
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    return dt.getData("application/x-floorplan-template-id");
  });
  const at = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  await sheet.evaluate((el, arg) => {
    const dt = new DataTransfer();
    dt.setData("application/x-floorplan-template-id", arg.id);
    el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: arg.x, clientY: arg.y }));
    el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: arg.x, clientY: arg.y }));
  }, { id: templateId, ...at });
  await expect(page.getByText(/On the plan \(1\)/)).toBeVisible({ timeout: 15_000 });

  const read = () => page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const fp = s.pages.find((p) => p.type === "floorplan") as { coverages: { id: string; shape: string; rangeM: number; widthM?: number; offsetM?: { x: number; y: number }; mic?: { mountHeightM: number; dedicated?: boolean } }[] };
    return fp.coverages;
  });

  // The area came with it: Shure's 9 × 9 m, as a box, tied to the device.
  let areas = await read();
  expect(areas).toHaveLength(1);
  expect(areas[0]).toMatchObject({ shape: "box", rangeM: 9, widthM: 9 });
  const id = areas[0].id;
  const area = page.locator(`[data-coverage-id="${id}"]`);
  await expect(area).toBeAttached();
  // The reach is drawn, and the part of the area inside it.
  await expect(page.locator(`[data-coverage-reach="${id}"]`)).toBeAttached();
  await expect(page.locator(`[data-coverage-within="${id}"]`)).toBeAttached();

  // Selecting the area opens its figures under Planning. A corner, clear of the symbol.
  const ab = (await area.boundingBox())!;
  await page.mouse.click(ab.x + 6, ab.y + 6);
  await expect(page.getByText("Selected coverage")).toBeVisible();
  await expect(page.getByTestId("mic-mount-height")).toHaveValue("2.70");
  // 2.7 m up, mouth at 1.2 m: 4.7 m along the floor, and the corners of 9 × 9 m are out.
  await expect(page.getByTestId("mic-reach")).toContainText("4.7 m");
  await expect(page.getByTestId("mic-reach")).toContainText("83 %");
  await expect(page.getByTestId("mic-issue")).toContainText("4.9 m");
  await expect(page.getByTestId("mic-areas")).toContainText("Area 1 of at most 8");

  // Hung higher, less is left; above Shure's 3.7 m the panel says so.
  await page.getByTestId("mic-mount-height").fill("4");
  await page.getByTestId("mic-mount-height").blur();
  await expect(page.getByTestId("mic-reach")).toContainText("4.0 m");
  await expect(page.getByTestId("mic-issue")).toContainText("3.7 m");
  await page.getByTestId("mic-mount-height").fill("2.7");
  await page.getByTestId("mic-mount-height").blur();

  // A room of 6 × 6 m is all in reach: no warning left.
  await page.getByTestId("coverage-length").fill("6");
  await page.getByTestId("coverage-width").fill("6");
  await expect(page.getByTestId("mic-reach")).toContainText("100 %");
  await expect(page.getByTestId("mic-issue")).toHaveCount(0);

  // Dragging the area moves it against the microphone, not the microphone.
  const moved = (await area.boundingBox())!;
  await page.mouse.move(moved.x + 8, moved.y + 8);
  await page.mouse.down();
  await page.mouse.move(moved.x + 48, moved.y + 8, { steps: 4 });
  await page.mouse.up();
  areas = await read();
  expect(areas[0].offsetM?.x ?? 0).toBeGreaterThan(0);
  expect(areas[0].offsetM?.y ?? 0).toBe(0);

  // A second area from the symbol's menu is one steered at a seat: 2 × 2 m.
  await page.mouse.click(at.x, at.y, { button: "right" });
  const symMenu = page.locator("[data-floorplan-symbol-menu]");
  await expect(symMenu).toBeVisible();
  await symMenu.getByRole("button", { name: /Add another coverage area/ }).click();
  areas = await read();
  expect(areas).toHaveLength(2);
  expect(areas[1]).toMatchObject({ shape: "box", rangeM: 2, widthM: 2 });
  expect(areas[1].mic?.dedicated).toBe(true);

  await page.screenshot({ path: process.env.MIC_COVERAGE_SHOT ?? join(tmpdir(), "mic-coverage.png") });

  // The print draws the same without tripping.
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  if (process.env.MIC_COVERAGE_PDF) await download.saveAs(process.env.MIC_COVERAGE_PDF);

  // An execution plan takes the areas off; the microphone stays.
  await page.getByTestId("panel-tab-planning").click();
  await page.getByTestId("plan-execution").check();
  await expect(page.locator("[data-coverage-id]")).toHaveCount(0);
  await expect(page.getByText(/On the plan \(1\)/)).toBeVisible();

  expect(errors).toEqual([]);
});
