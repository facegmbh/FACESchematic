import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A symbol group in true size: each device is drawn as its own outline at the plan's
 * scale, and a device that does not say how large it is keeps its pictogram.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: symbols in true size", async ({ page }) => {
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

  // A rack-width amplifier, 483 × 400 mm in plan, and a symbol without any device.
  const state = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const nodes = s.nodes as never as { id: string; type: string; data: Record<string, unknown> }[];
    const host = nodes.find((n) => n.type === "device")!;
    useSchematicStore.setState({
      nodes: s.nodes.map((n) => n.id === host.id ? { ...n, data: { ...n.data, widthMm: 483, heightMm: 88, depthMm: 400 } } : n) as never,
    });
    const plan = s.pages.find((p) => p.type === "floorplan")!;
    const groupId = s.addFloorplanGroup(plan.id, { label: "Verstärker", shape: "square" });
    const sized = s.addFloorplanSymbol(plan.id, { groupId, positionMm: { x: 200, y: 150 }, deviceNodeId: host.id });
    const bare = s.addFloorplanSymbol(plan.id, { groupId, positionMm: { x: 260, y: 150 } });
    return { pageId: plan.id, groupId, sized, bare };
  });

  const footprint = page.locator(`[data-symbol-footprint="${state.sized}"]`);
  await expect(footprint).toHaveCount(0);

  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().updateFloorplanGroup(arg.pageId, arg.groupId, { trueSize: true });
  }, state);

  // 483 × 400 mm: the outline's sides are in that ratio; the bare symbol stays a pictogram.
  await expect(footprint).toBeVisible();
  const box = (await footprint.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(483 / 400, 1);
  await expect(page.locator(`[data-symbol-footprint="${state.bare}"]`)).toHaveCount(0);

  // On a plan of half the scale the outline is half as large.
  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().setFloorplanScale(arg.pageId, 100);
  }, state);
  await expect.poll(async () => (await footprint.boundingBox())!.width / box.width).toBeCloseTo(0.5, 1);
  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().setFloorplanScale(arg.pageId, 50);
  }, state);

  // Lying flat it shows width × height instead.
  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().updateFloorplanGroup(arg.pageId, arg.groupId, { footprint: "height" });
  }, state);
  await expect.poll(async () => { const b = (await footprint.boundingBox())!; return b.width / b.height; }).toBeCloseTo(483 / 88, 0);
  await page.evaluate(async (arg) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().updateFloorplanGroup(arg.pageId, arg.groupId, { footprint: undefined });
  }, state);

  // The symbol without a device says why it is not in true size.
  await page.locator('[data-symbol-footprint]').first().click();
  await expect(page.getByTestId("symbol-footprint-missing")).toHaveCount(0);
  await page.screenshot({ path: process.env.TRUE_SIZE_SHOT ?? join(tmpdir(), "true-size.png") });

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  if (process.env.TRUE_SIZE_PDF) await download.saveAs(process.env.TRUE_SIZE_PDF);

  expect(errors).toEqual([]);
});
