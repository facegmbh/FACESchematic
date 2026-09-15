import { test, expect } from "@playwright/test";

/**
 * Two things about coverage areas, in the running app.
 *
 * The caption: it is read from the device, not copied when the area is made. Renumber the
 * camera and the wedge in front of it renumbers — that was the complaint, and copying is
 * why it kept coming back.
 *
 * The switch: one plan is read two ways. The customer wants to see what is covered; the
 * electrician wants the mounting points without wedges over them.
 */
test.slow();

test("floorplan: the caption on a coverage area follows the device, and all areas hide at once", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  const ids = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const st = useSchematicStore.getState();
    const pageId = st.addFloorplanPage("EG");
    const groupId = st.addFloorplanGroup(pageId, { label: "Kameras", color: "#e11d1d", shape: "camera" });
    const symbolId = st.addFloorplanSymbol(pageId, { groupId, positionMm: { x: 150, y: 150 }, label: "K1" });
    // Made the way the app makes one: anchored, with no caption of its own.
    const coverageId = st.addFloorplanCoverage(pageId, {
      symbolId, groupId, shape: "sector", positionMm: { x: 150, y: 150 }, rangeM: 12, apertureDeg: 90,
    });
    return { pageId, symbolId, coverageId };
  });

  await page.getByRole("button", { name: "EG" }).first().click();

  const caption = page.locator("svg text", { hasText: /^K\d+$/ });
  await expect(caption.filter({ hasText: "K1" }).first()).toBeVisible();

  // Renumber the camera; the wedge has to say the new number without anyone touching it.
  await page.evaluate(async ({ pageId, symbolId }) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().updateFloorplanSymbol(pageId, symbolId, { label: "K7" });
  }, ids);
  // The symbol's own number is HTML on the sheet; this locator is the area's caption alone.
  await expect(caption.filter({ hasText: "K7" })).toHaveCount(1);
  await expect(caption.filter({ hasText: "K1" })).toHaveCount(0);

  // Own words win, and keep winning through a renumber.
  await page.evaluate(async ({ pageId, coverageId, symbolId }) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const st = useSchematicStore.getState();
    st.updateFloorplanCoverage(pageId, coverageId, { label: "Zufahrt Nord", ownLabel: true });
    st.updateFloorplanSymbol(pageId, symbolId, { label: "K9" });
  }, ids);
  await expect(page.locator("svg text", { hasText: "Zufahrt Nord" }).first()).toBeVisible();

  // And the one switch takes every area off the sheet.
  const wedge = page.locator("path[data-coverage-id]");
  await expect(wedge).toHaveCount(1);
  await page.evaluate(async ({ pageId }) => {
    const { useSchematicStore } = await import("/src/store.ts");
    useSchematicStore.getState().updateFloorplanPage(pageId, { hideCoverages: true });
  }, ids);
  await expect(wedge).toHaveCount(0);
  // The area is off the sheet, not out of the project.
  const kept = await page.evaluate(async ({ pageId }) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const p = useSchematicStore.getState().pages.find((pp) => pp.id === pageId) as { coverages: unknown[] };
    return p.coverages.length;
  }, ids);
  expect(kept).toBe(1);

  expect(errors).toEqual([]);
});
