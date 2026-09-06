import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Right-click on a symbol, and the layer control it carries. A group is the layer: switching
 * one off takes its symbols off the sheet and out of the export, while they stay in the
 * project — one drawing then yields a sheet per trade.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: right-click a symbol to turn it, regroup it and switch its layer off", async ({ page }) => {
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

  // Two groups, one symbol each.
  const paper = page.locator("div.bg-white.shadow-xl").first();
  const box = (await paper.boundingBox())!;
  for (const [i, name] of [["Lautsprecher"], ["Video"]].map((n, i) => [i, n[0]] as const)) {
    await page.getByTitle("Add a symbol group").click();
    await page.getByPlaceholder("Legend title, e.g. Ceiling speakers").fill(name);
    await page.getByTitle("Click the plan to drop symbols of the active group").click();
    await page.mouse.click(box.x + box.width * (0.25 + 0.15 * i), box.y + box.height * 0.4);
    await page.getByRole("button", { name: /Select/ }).click();
  }
  await expect(page.getByText(/On the plan \(2\)/)).toBeVisible();

  const menu = page.locator("[data-floorplan-symbol-menu]");
  const rightClickVideo = () => page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4, { button: "right" });
  const rightClickSpeaker = () => page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.4, { button: "right" });

  // Right-click the Video symbol: the menu names its group and offers the layer controls.
  await rightClickVideo();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: /Hide “Video”/ })).toBeVisible();

  // Turning works from here.
  await menu.getByRole("button", { name: "90° clockwise" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByTitle("Symbol rotation in degrees clockwise")).toHaveValue("90");

  // Switch the Video layer off: its symbol leaves the sheet and the legend loses the row.
  await rightClickVideo();
  await menu.getByRole("button", { name: /Hide “Video”/ }).click();
  await expect(paper.getByText("Video", { exact: true })).toHaveCount(0);
  await expect(paper.getByText("Lautsprecher", { exact: true })).toHaveCount(1);

  // The symbol is still in the project, marked as hidden in the left list.
  await expect(page.getByText(/On the plan \(2\)/)).toBeVisible();
  await expect(page.getByTitle(/group switched off/)).toHaveCount(1);

  // It comes back from the panel.
  await page.getByTitle(/click to draw it again/).click();
  await expect(paper.getByText("Video", { exact: true })).toHaveCount(1);

  // Moving a symbol to another group is the other way to change what it is.
  await rightClickSpeaker();
  await menu.getByRole("button", { name: "Video" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByText(/On the plan \(2\)/)).toBeVisible();

  expect(errors).toEqual([]);
});


test("floorplan: a cover can be turned and faded, on the sheet and in the export", async ({ page }) => {
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

  // Drawing a cover by hand is a drag; adding one through the store keeps this test about
  // what it is for — that a cover can be turned and faded.
  await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const plan = s.pages.find((p) => p.type === "floorplan")!;
    s.addFloorplanMask(plan.id, { positionMm: { x: 60, y: 60 }, sizeMm: { w: 120, h: 60 } });
  });

  const cover = page.locator("[data-floorplan-mask]").first();
  await expect(cover).toBeVisible();

  // The panel opens itself now that there is a cover to edit.
  const turn = page.getByTitle(/Rotation in degrees clockwise/).first();
  await expect(turn).toBeVisible();
  await turn.fill("20");
  await expect.poll(async () => cover.evaluate((el) => getComputedStyle(el).transform), { timeout: 10_000 }).not.toBe("none");

  const fade = page.getByTitle(/Below 1 the cover fades/).first().locator('input[type="range"]');
  await fade.fill("0.45");
  await expect.poll(async () => cover.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10_000 }).toBe("0.45");

  // The export still succeeds with a turned, faded cover — jsPDF draws it as a polygon.
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await download.path()).toBeTruthy();

  expect(errors).toEqual([]);
});


test("floorplan: right-click a cover to turn, fade and lock it", async ({ page }) => {
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

  await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const plan = s.pages.find((p) => p.type === "floorplan")!;
    s.addFloorplanMask(plan.id, { positionMm: { x: 60, y: 60 }, sizeMm: { w: 140, h: 70 } });
  });

  const cover = page.locator("[data-floorplan-mask]").first();
  await expect(cover).toBeVisible();
  const menu = page.locator("[data-floorplan-mask-menu]");
  const rightClickCover = async () => {
    const box = (await cover.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
  };

  // The menu exists at all — a cover had no right-click before.
  await rightClickCover();
  await expect(menu).toBeVisible();

  // Turn it.
  await menu.getByRole("button", { name: "90° clockwise" }).click();
  await expect.poll(async () => cover.evaluate((el) => getComputedStyle(el).transform), { timeout: 10_000 }).not.toBe("none");

  // Fade it.
  await rightClickCover();
  await menu.getByRole("button", { name: "50%" }).click();
  await expect.poll(async () => cover.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10_000 }).toBe("0.5");

  // Lock it: dragging must no longer move it.
  await rightClickCover();
  await menu.getByRole("button", { name: "Lock in place" }).click();
  const before = await cover.evaluate((el) => (el as HTMLElement).style.left);
  const box = (await cover.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  expect(await cover.evaluate((el) => (el as HTMLElement).style.left)).toBe(before);

  // And it unlocks from the same menu.
  await rightClickCover();
  await expect(menu.getByRole("button", { name: "Unlock" })).toBeVisible();
  await menu.getByRole("button", { name: "Unlock" }).click();
  await expect(menu).toHaveCount(0);

  expect(errors).toEqual([]);
});
