import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Planning a projector: the picture stays on its wall, the slider moves the projector
 * through the distances the lens allows, and a position outside them is called out.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: slide a projector through its throw range", async ({ page }) => {
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

  // A projector symbol with a 100" picture ahead of it, lens typed off a datasheet.
  const state = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const { defaultProjectionFor } = await import("/src/projection.ts");
    const s = useSchematicStore.getState();
    const plan = s.pages.find((p) => p.type === "floorplan")!;
    const groupId = s.addFloorplanGroup(plan.id, { label: "Beamer", shape: "projector" });
    const symbolId = s.addFloorplanSymbol(plan.id, { groupId, positionMm: { x: 80, y: 120 } });
    const fresh = useSchematicStore.getState().pages.find((p) => p.id === plan.id)! as never as {
      scaleDenominator: number;
      symbols: { id: string; positionMm: { x: number; y: number }; groupId: string }[];
    };
    const symbol = fresh.symbols.find((x) => x.id === symbolId)!;
    const projectionId = s.addFloorplanProjection(
      plan.id,
      defaultProjectionFor(symbol, { throwMin: 1.5, throwMax: 2, lumens: 5000 }, fresh.scaleDenominator),
      0,
    );
    return { pageId: plan.id, symbolId, projectionId };
  });

  const read = () => page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const { projectionGeometry } = await import("/src/projection.ts");
    const plan = useSchematicStore.getState().pages.find((p) => p.id === arg.pageId)! as never as {
      scaleDenominator: number;
      symbols: { id: string; positionMm: { x: number; y: number } }[];
      projections: { id: string; widthM: number; heightM: number; screenCenterMm: { x: number; y: number } }[];
    };
    const projection = plan.projections.find((p) => p.id === arg.projectionId)!;
    const symbol = plan.symbols.find((x) => x.id === arg.symbolId)!;
    const g = projectionGeometry(projection as never, symbol.positionMm, plan.scaleDenominator);
    return { distanceM: g.distanceM, widthM: projection.widthM, heightM: projection.heightM, screen: projection.screenCenterMm };
  }, state);

  // Selecting the picture selects its projector, and the panel opens on it.
  const surface = page.locator(`[data-projection-surface="${state.projectionId}"]`);
  await expect(surface).toBeAttached({ timeout: 15_000 });
  await surface.dispatchEvent("mousedown", { bubbles: true, cancelable: true });
  await page.mouse.up();
  const panel = page.getByTestId("projection-panel");
  await expect(panel).toBeVisible();

  const start = await read();
  expect(start.distanceM).toBeCloseTo(1.75 * start.widthM, 2);
  await expect(page.locator(`[data-projection-id="${state.projectionId}"]`)).toHaveAttribute("data-projection-ok", "1");

  // The brightness is spelled out: lumens ÷ area = lux.
  const lux = Math.round(5000 / (start.widthM * start.heightM));
  await expect(page.getByTestId("projection-brightness")).toContainText("5000 lm");
  await expect(page.getByTestId("projection-brightness")).toContainText(`${lux} lx`);

  // The slider ends are the lens's limits; the picture does not move.
  const slider = page.getByTestId("projection-distance-slider");
  await slider.focus();
  await page.keyboard.press("End");
  await expect.poll(async () => (await read()).distanceM).toBeCloseTo(2 * start.widthM, 2);
  await page.keyboard.press("Home");
  await expect.poll(async () => (await read()).distanceM).toBeCloseTo(1.5 * start.widthM, 2);
  expect((await read()).screen).toEqual(start.screen);

  // Typed past the limit, the plan says so.
  await page.getByTestId("projection-distance").fill("1.00");
  await expect(page.getByTestId("projection-issue")).toBeVisible();
  await expect(page.locator(`[data-projection-id="${state.projectionId}"]`)).toHaveAttribute("data-projection-ok", "0");

  // A pinned width stays when the height changes.
  await page.getByTestId("projection-lock-width").click();
  await page.getByTestId("projection-height").fill("1.00");
  await expect.poll(async () => (await read()).heightM).toBeCloseTo(1, 3);
  expect((await read()).widthM).toBeCloseTo(start.widthM, 3);

  // The section: with both heights the panel says where a standing person is in the
  // picture, the cone is hatched there, and the section can be put on the sheet.
  await page.getByTestId("projection-distance").fill("4.00");
  await panel.locator("summary").click();
  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().updateFloorplanProjection(arg.pageId, arg.projectionId, { screenBottomM: 1, lensHeightM: 2.8 });
  }, state);
  // Lower edge climbs from 1.00 m to 2.80 m over 4 m and passes 1.80 m at 1.78 m.
  await expect(page.getByTestId("projection-section-text")).toContainText("1.78");
  await expect(page.locator(`[data-projection-in-picture="${state.projectionId}"]`)).toBeAttached();
  await expect(panel.getByTestId("projection-section")).toBeVisible();
  await page.getByTestId("projection-section-show").check();
  await expect(page.locator(`[data-projection-section-box="${state.projectionId}"]`)).toBeAttached();
  // Seated, the same person is in the picture for a shorter stretch.
  await page.getByRole("button", { name: /seated|sitzend/ }).click();
  await expect(page.getByTestId("projection-section-text")).toContainText("0.67");

  await page.screenshot({ path: process.env.PROJECTION_SHOT ?? join(tmpdir(), "projection.png") });
  expect(errors).toEqual([]);
});
