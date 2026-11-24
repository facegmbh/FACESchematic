import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A display on the plan: drawn as a bar of its true width, and judged against the viewing
 * distances exactly like a projector's picture — only that it hangs on its own symbol.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: a display in its true size with its audience area", async ({ page }) => {
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

  const state = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const plan = s.pages.find((p) => p.type === "floorplan")!;
    const groupId = s.addFloorplanGroup(plan.id, { label: "Display", shape: "display" });
    const symbolId = s.addFloorplanSymbol(plan.id, { groupId, positionMm: { x: 300, y: 120 } });
    const fresh = useSchematicStore.getState().pages.find((p) => p.id === plan.id)! as never as { symbols: { id: string; label: string }[] };
    return { pageId: plan.id, symbolId, label: fresh.symbols.find((x) => x.id === symbolId)!.label };
  });

  type Stored = { kind?: string; widthM: number; heightM: number; audience?: { rotationDeg: number } };
  const read = () => page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const plan = useSchematicStore.getState().pages.find((p) => p.id === arg.pageId)! as never as {
      scaleDenominator: number;
      projections: ({ symbolId: string } & Stored)[];
    };
    return { scale: plan.scaleDenominator, display: plan.projections.find((p) => p.symbolId === arg.symbolId) };
  }, state);

  // Selecting the display symbol offers to plan it.
  const symbol = page.locator(`div.absolute[title="${state.label}"]`).first();
  await symbol.click();
  // Its basics are in the plan options; the picture is planned on the other tab.
  await page.getByTestId("symbol-open-planning").click();
  await page.getByTestId("display-create").click();
  await expect(page.getByTestId("display-panel")).toBeVisible();

  // 65″ in 16:9 by default — and on the sheet a bar of exactly that width.
  const bar = page.locator(`[data-display-bar="${state.symbolId}"]`);
  await expect(bar).toBeVisible();
  const first = await read();
  expect(first.display!.kind).toBe("display");
  expect(first.display!.widthM).toBeCloseTo(1.439, 2);
  const widthPx = async () => (await bar.boundingBox())!.width;
  const w65 = await widthPx();

  // A larger diagonal makes the bar wider by the same factor.
  await page.getByTestId("display-diagonal-preset").selectOption("98");
  await expect.poll(async () => (await read()).display!.widthM).toBeCloseTo(2.17, 2);
  expect((await widthPx()) / w65).toBeCloseTo(98 / 65, 1);
  await expect(page.getByTestId("display-size")).toContainText("2.17");

  // The viewing distances are the projector's, on the display's picture: 3 % characters
  // reach six picture heights.
  const height = (await read()).display!.heightM;
  await expect(page.getByTestId("projection-viewing")).toContainText((6 * height).toFixed(2));

  // Detail work asks for the resolution.
  await page.getByTestId("projection-viewing-task").selectOption("adm");
  await page.getByTestId("display-resolution").selectOption("2160");
  await expect(page.getByTestId("projection-viewing")).toContainText(((height * 3438) / 2160).toFixed(2));
  await page.getByTestId("projection-viewing-task").selectOption("bdm");

  // Contrast: a 350 cd/m² display in a 300 lx office serves detail work, not moving pictures.
  await page.getByTestId("contrast-ambient").fill("300");
  await expect(page.getByTestId("contrast-result")).toContainText(/display's brightness|Helligkeit des Displays/);
  await page.getByTestId("contrast-nits").fill("350");
  const reflected = (300 * 0.05) / Math.PI;
  await expect(page.getByTestId("contrast-result")).toContainText(`${((350 + reflected) / (0.35 + reflected)).toFixed(1)}:1`);
  await expect(page.getByTestId("contrast-issue")).toHaveCount(0);

  // The audience area lies in front of the display, parallel to it, with its heatmap.
  await page.getByTestId("projection-audience-add").click();
  const area = page.locator('[data-projection-audience]');
  await expect(area).toHaveAttribute("data-projection-audience-fits", "1");
  await expect(page.locator("[data-projection-heatmap]")).toBeAttached();
  await expect(page.locator('[data-legend-key="viewing"]')).toBeVisible();
  await page.screenshot({ path: process.env.DISPLAY_SHOT ?? join(tmpdir(), "display.png") });

  // Turn the display away: the area stays, the display no longer faces it.
  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().updateFloorplanSymbol(arg.pageId, arg.symbolId, { rotationDeg: 180 });
  }, state);
  await expect(area).toHaveAttribute("data-projection-audience-fits", "0");

  // The export draws the bar and the area without tripping.
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  if (process.env.DISPLAY_PDF) await download.saveAs(process.env.DISPLAY_PDF);

  expect(errors).toEqual([]);
});
