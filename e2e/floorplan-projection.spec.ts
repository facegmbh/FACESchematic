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

  // The architect's own section as the backdrop: attach it, click the floor below the
  // picture and below the projector, and the beam is laid over it.
  await page.getByTestId("projection-section-file").setInputFiles(planPath);
  const calibrator = page.getByTestId("section-calibrator-image");
  await expect(calibrator).toBeVisible({ timeout: 15_000 });
  const cb = (await calibrator.boundingBox())!;
  await page.mouse.click(cb.x + cb.width * 0.2, cb.y + cb.height * 0.8);
  await page.mouse.click(cb.x + cb.width * 0.8, cb.y + cb.height * 0.8);
  await page.getByTestId("section-calibrator-apply").click();
  await expect(calibrator).toBeHidden();
  const sectionBox = page.locator(`[data-projection-section-box="${state.projectionId}"]`);
  await expect(sectionBox.locator("image")).toBeAttached();
  await expect(sectionBox.locator('[data-section-role="beam"]')).toBeAttached();
  // The generated floor line is gone — the drawing brings its own.
  await expect(sectionBox.locator('[data-section-role="floor"]')).toHaveCount(0);

  await page.screenshot({ path: process.env.PROJECTION_SHOT ?? join(tmpdir(), "projection.png") });
  expect(errors).toEqual([]);
});

test("floorplan: an audience area is checked against the viewing distances", async ({ page }) => {
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

  type Stored = {
    heightM: number;
    screenRotationDeg: number;
    audience?: { centerMm: { x: number; y: number }; widthM: number; depthM: number; rotationDeg: number };
  };
  const read = () => page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const plan = useSchematicStore.getState().pages.find((p) => p.id === arg.pageId)! as never as {
      scaleDenominator: number;
      projections: ({ id: string } & Stored)[];
    };
    return { scale: plan.scaleDenominator, ...plan.projections.find((p) => p.id === arg.projectionId)! };
  }, state);

  const surface = page.locator(`[data-projection-surface="${state.projectionId}"]`);
  await expect(surface).toBeAttached({ timeout: 15_000 });
  // A real press and release on the spot: selects the projector without moving the picture.
  const sb = (await surface.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId("projection-panel")).toBeVisible();

  // Without an area the panel only states the recommendation: 3 % characters, 6 heights.
  const start = await read();
  await expect(page.getByTestId("projection-viewing")).toContainText((6 * start.heightM).toFixed(2));

  // A new area lies parallel to the picture and inside the recommendation.
  await page.getByTestId("projection-audience-add").click();
  const area = page.locator(`[data-projection-audience="${state.projectionId}"]`);
  await expect(area).toHaveAttribute("data-projection-audience-fits", "1");
  await expect(page.locator(`[data-projection-recommended="${state.projectionId}"]`)).toBeAttached();
  await expect(page.getByTestId("projection-viewing-issue")).toHaveCount(0);
  const placed = (await read()).audience!;
  expect(placed.rotationDeg).toBe(start.screenRotationDeg);

  // Dragging a corner sizes it; the opposite corner stays, so the middle moves too.
  const corner = area.locator('[data-projection-audience-corner="2"]');
  const cb = (await corner.boundingBox())!;
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + 40, cb.y + cb.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  const sized = (await read()).audience!;
  expect(sized.widthM !== placed.widthM || sized.depthM !== placed.depthM).toBe(true);

  // A last row far beyond the recommendation: the panel says by how much and offers the
  // picture height that would reach it.
  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const a = (deg: number) => (deg * Math.PI) / 180;
    const mmPerM = 1000 / arg.scale;
    const extraM = 6 * arg.heightM;
    useSchematicStore.getState().updateFloorplanProjection(arg.pageId, arg.projectionId, {
      audience: {
        ...arg.placed,
        depthM: arg.placed.depthM + extraM,
        centerMm: {
          x: arg.placed.centerMm.x + (Math.cos(a(arg.placed.rotationDeg)) * extraM * mmPerM) / 2,
          y: arg.placed.centerMm.y + (Math.sin(a(arg.placed.rotationDeg)) * extraM * mmPerM) / 2,
        },
      },
    });
  }, { ...state, placed, scale: start.scale, heightM: start.heightM });
  await expect(area).toHaveAttribute("data-projection-audience-fits", "0");
  // The heatmap colours the area: good near the picture, too far at the back.
  const heatmap = page.locator(`[data-projection-heatmap="${state.projectionId}"]`);
  await expect(heatmap.locator('[data-seat-rating="good"]').first()).toBeAttached();
  await expect(heatmap.locator('[data-seat-rating="too-far"]').first()).toBeAttached();
  await expect(page.getByTestId("projection-viewing-key")).toBeVisible();
  // The legend on the sheet explains the colours, so the print does too.
  const legendKey = page.locator('[data-legend-key="viewing"]');
  await expect(legendKey).toBeVisible();
  await page.screenshot({ path: process.env.PROJECTION_AUDIENCE_SHOT ?? join(tmpdir(), "projection-audience.png") });
  await page.getByTestId("projection-viewing-apply").click();
  await expect(page.getByTestId("projection-viewing-apply")).toHaveCount(0);
  expect((await read()).heightM).toBeGreaterThan(start.heightM);

  // The export draws the area and the recommendation's outline without tripping.
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  if (process.env.PROJECTION_AUDIENCE_PDF) await download.saveAs(process.env.PROJECTION_AUDIENCE_PDF);

  // Switched off under More, only the frame is left.
  await page.getByTestId("projection-panel").locator("summary").click();
  await page.getByTestId("projection-viewing-heatmap").uncheck();
  await expect(heatmap).toHaveCount(0);
  await expect(area).toBeAttached();
  await expect(legendKey).toHaveCount(0);

  // Removing the area takes it off the plan.
  await page.getByTestId("projection-audience-remove").click();
  await expect(area).toHaveCount(0);

  expect(errors).toEqual([]);
});
