import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Aiming a camera's coverage area turns the camera. The wedge is what you point at what the
 * device has to see, so the icon underneath has to end up facing the same way — otherwise
 * the plan shows a camera looking one way and a field of view going another.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: aiming a coverage area turns its camera symbol", async ({ page }) => {
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

  // A camera symbol with a coverage area anchored to it.
  const state = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const plan = s.pages.find((p) => p.type === "floorplan")!;
    const groupId = s.addFloorplanGroup(plan.id, { label: "Kameras", shape: "camera" });
    const symbolId = s.addFloorplanSymbol(plan.id, { groupId, positionMm: { x: 150, y: 150 } });
    const coverageId = s.addFloorplanCoverage(plan.id, {
      shape: "sector", symbolId, groupId,
      positionMm: { x: 150, y: 150 }, rangeM: 12, apertureDeg: 90,
    });
    return { pageId: plan.id, symbolId, coverageId };
  });

  const readAim = () => page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const plan = useSchematicStore.getState().pages.find((p) => p.id === arg.pageId)! as never as {
      symbols: { id: string; rotationDeg?: number }[];
      coverages?: { id: string; rotationDeg?: number }[];
    };
    return {
      symbol: plan.symbols.find((s) => s.id === arg.symbolId)?.rotationDeg ?? 0,
      offset: (plan.coverages ?? []).find((c) => c.id === arg.coverageId)?.rotationDeg ?? 0,
    };
  }, state);

  expect(await readAim()).toEqual({ symbol: 0, offset: 0 });

  // The aim handle only appears on the selected area — select it the way a click would.
  await page.evaluate(async (arg) => {
    const paper = document.querySelector("div.bg-white.shadow-xl") as HTMLElement;
    const area = paper.querySelector(`[data-coverage-id="${arg.coverageId}"]`) as HTMLElement | null;
    area?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  }, state);

  // Drag the aim handle to below the camera: the device has to end up facing down (~90°).
  const handle = page.locator(`[data-coverage-aim="${state.coverageId}"]`);
  await expect(handle).toBeVisible({ timeout: 15_000 });
  const hb = (await handle.boundingBox())!;
  const symbolPoint = await page.evaluate(() => {
    const paper = document.querySelector("div.bg-white.shadow-xl") as HTMLElement;
    const r = paper.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  // Straight down from the camera, well clear of it.
  await page.mouse.move(symbolPoint.x + symbolPoint.w * 0.5, symbolPoint.y + symbolPoint.h * 0.9, { steps: 10 });
  await page.mouse.up();

  const after = await readAim();
  // The camera turned; the area's own offset was left alone.
  expect(after.offset).toBe(0);
  expect(after.symbol).not.toBe(0);

  expect(errors).toEqual([]);
});
