import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The BHE symbol library in the running app: the catalogue is served, the picker lists it,
 * and a picked symbol is what the sheet then draws.
 *
 * The drawings are member material and are not in the repository (see BHE_SYMBOLS.md), so
 * on a checkout without them this whole file skips rather than failing. Where they are
 * installed — a developer machine with the CD, and the server — it is a real test.
 */
const CATALOG = join(process.cwd(), "public", "symbols", "bhe", "catalog.json");

test.skip(!existsSync(CATALOG), "BHE symbol library not installed on this checkout");
test.slow();

test("floorplan: a BHE symbol can be picked for a group and is what gets drawn", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  // The catalogue is fetched, not bundled — nothing works if that request does not land.
  const loaded = await page.evaluate(async () => {
    const { loadSymbolLibrary } = await import("/src/symbolLibrary.ts");
    const cats = await loadSymbolLibrary();
    return { categories: cats.length, symbols: cats.reduce((n, c) => n + c.symbols.length, 0) };
  });
  expect(loaded.categories).toBeGreaterThan(10);
  expect(loaded.symbols).toBeGreaterThan(200);

  // A plan with one group, made the way the app makes them.
  const { pageId, groupId } = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const st = useSchematicStore.getState();
    const pageId = st.addFloorplanPage("EG");
    const groupId = st.addFloorplanGroup(pageId, { label: "Kameras", color: "#e11d1d", shape: "triangle" });
    st.addFloorplanSymbol(pageId, { groupId, positionMm: { x: 120, y: 120 }, label: "K1" });
    return { pageId, groupId };
  });

  await page.getByRole("button", { name: "EG" }).first().click();

  // The picker sits in the group's own editor, behind the ▸ on the group row.
  // The e2e build runs in English; the German wording is covered by i18n-de.spec.
  await page.getByTitle("Edit group").first().click();
  await page.locator('button[title*="BHE symbol"]').first().click();
  await expect(page.getByPlaceholder(/Search all \d+ symbols/)).toBeVisible();

  // Search finds the fixed dome, and picking it writes the id onto the group.
  await page.getByPlaceholder(/Search all \d+ symbols/).fill("fix-dome");
  const firstHit = page.locator('img[src^="/symbols/bhe/"]').first();
  await expect(firstHit).toBeVisible();
  const src = await firstHit.getAttribute("src");
  await firstHit.click();

  const picked = await page.evaluate(async ({ pageId, groupId }) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const p = useSchematicStore.getState().pages.find((pp) => pp.id === pageId) as { groups: { id: string; symbolLibraryId?: string }[] };
    return p.groups.find((g) => g.id === groupId)?.symbolLibraryId;
  }, { pageId, groupId });
  expect(picked).toBeTruthy();
  expect(src).toBe(`/symbols/bhe/${picked}.svg`);

  // And the sheet draws it: the symbol on the plan references the same file.
  await expect(page.locator(`image[href="/symbols/bhe/${picked}.svg"]`).first()).toBeVisible();

  expect(errors).toEqual([]);
});
