import { test, expect, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * An architect's DXF as a plan underlay, in the running app.
 *
 * The drawings here are written by hand — a customer's DXF has no place in a public
 * repository. They are small but real: a 10 × 5 m room outline on a "Wand" layer and a
 * piece of furniture on "Möbel", once with its unit stated and once without.
 */
test.slow();

function dxf(...pairs: [number | string, string | number][]): string {
  return pairs.map(([code, value]) => `${code}\n${value}`).join("\n") + "\n";
}

function room(insunits?: number): string {
  return dxf(
    [0, "SECTION"], [2, "HEADER"],
    ...(insunits === undefined ? [] : [[9, "$INSUNITS"], [70, insunits]] as [number | string, string | number][]),
    [0, "ENDSEC"],
    [0, "SECTION"], [2, "TABLES"], [0, "TABLE"], [2, "LAYER"],
    [0, "LAYER"], [2, "Wand"], [70, 0], [62, 7],
    [0, "LAYER"], [2, "Möbel"], [70, 0], [62, 3],
    [0, "ENDTAB"], [0, "ENDSEC"],
    [0, "SECTION"], [2, "ENTITIES"],
    [0, "LWPOLYLINE"], [8, "Wand"], [90, 4], [70, 1],
    [10, 0], [20, 0], [10, 10000], [20, 0], [10, 10000], [20, 5000], [10, 0], [20, 5000],
    // A door swing: a quarter circle as a bulged polyline, the way CAD draws it.
    [0, "LWPOLYLINE"], [8, "Wand"], [90, 2], [70, 0],
    [10, 4000], [20, 0], [42, 0.41421356], [10, 4900], [20, 900],
    [0, "LINE"], [8, "Möbel"], [10, 1000], [20, 1000], [11, 3000], [21, 2000],
    [0, "TEXT"], [8, "Wand"], [10, 500], [20, 4500], [40, 250], [1, "Büro 1.04"],
    [0, "ENDSEC"], [0, "EOF"],
  );
}

function writeDrawing(name: string, text: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "dxf-")), name);
  writeFileSync(path, text);
  return path;
}

type Underlay = {
  kind: string;
  src: string;
  mmPerPx?: number;
  sizeMm: { w: number; h: number };
  dxfUnit?: string;
  dxfUnitAssumed?: boolean;
  pdfLayers?: { id: string; name: string; visible: boolean }[];
};

async function underlayOf(page: Page): Promise<{ underlay?: Underlay; scale: number }> {
  return page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const st = useSchematicStore.getState();
    const plan = st.pages.find((p) => p.id === st.activePage) as unknown as { underlay?: Underlay; scaleDenominator: number };
    return { underlay: plan?.underlay, scale: plan?.scaleDenominator };
  });
}

async function openPlanWith(page: Page, file: string) {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await page.setInputFiles('input[type="file"][accept*=".dxf"]', file);
}

test("floorplan: a DXF comes in to scale, with its layers, and goes out in the PDF", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await openPlanWith(page, writeDrawing("EG.dxf", room(4)));

  // To scale on arrival: the drawing is in mm, so one pixel is one mm on site — nobody has
  // calibrated anything.
  await expect(page.getByText(/no calibration needed/)).toBeVisible({ timeout: 15_000 });
  const first = await underlayOf(page);
  expect(first.underlay?.kind).toBe("dxf");
  expect(first.underlay?.src.startsWith("data:image/svg+xml")).toBe(true);
  expect(first.underlay?.mmPerPx).toBeCloseTo(1, 6);
  // 10 m fit A1 at the page's 1:50, so the scale stayed: 10 100 mm with margin → 202 mm.
  expect(first.scale).toBe(50);
  expect(first.underlay?.sizeMm.w).toBeCloseTo(202, 3);

  // The picture on the sheet is the vector drawing itself.
  await expect(page.locator('img[src^="data:image/svg+xml"]').first()).toBeVisible();

  // Two layers, so the choice opens by itself. Switching the furniture off redraws the
  // plan without moving it.
  const furniture = page.locator("label", { hasText: "Möbel" }).locator('input[type="checkbox"]');
  await expect(furniture).toBeChecked();
  // The box only follows once the redraw is done (it mirrors the stored choice), so it is
  // clicked like a person would and the result read from the store.
  await furniture.click();
  await expect.poll(async () => (await underlayOf(page)).underlay?.pdfLayers?.find((l) => l.name === "Möbel")?.visible)
    .toBe(false);
  const quiet = await underlayOf(page);
  expect(quiet.underlay?.src.length).toBeLessThan(first.underlay!.src.length);
  expect(quiet.underlay?.sizeMm).toEqual(first.underlay?.sizeMm);

  // The PDF carries it as a print-resolution image: 202 mm at 300 dpi is about 2386 px.
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]).then(([d]) => d);
  const pdf = readFileSync((await download.path())!).toString("latin1");
  const widths = [...pdf.matchAll(/\/Width (\d+)/g)].map((m) => Number(m[1]));
  expect(Math.max(...widths)).toBeGreaterThan(2000);

  expect(errors).toEqual([]);
});

test("floorplan: a DXF that does not state its unit says so, and can be told", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await openPlanWith(page, writeDrawing("Altbau.dxf", room()));

  // The guess is visible, not silent.
  await expect(page.getByText(/millimetres were assumed/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("(assumed)")).toBeVisible();
  const guessed = await underlayOf(page);
  expect(guessed.underlay).toMatchObject({ dxfUnit: "mm", dxfUnitAssumed: true });

  // A layer tick keeps the guess a guess — it must not quietly turn into a fact.
  await page.locator("label", { hasText: "Möbel" }).locator('input[type="checkbox"]').click();
  await expect.poll(async () => (await underlayOf(page)).underlay?.pdfLayers?.find((l) => l.name === "Möbel")?.visible)
    .toBe(false);
  expect((await underlayOf(page)).underlay?.dxfUnitAssumed).toBe(true);

  // It was in centimetres after all: ten times the size, ten mm per pixel, same corner.
  await page.locator("label", { hasText: "UNIT" }).locator("select").selectOption("cm");
  await expect.poll(async () => (await underlayOf(page)).underlay?.dxfUnit).toBe("cm");
  const told = await underlayOf(page);
  expect(told.underlay?.dxfUnitAssumed).toBe(false);
  expect(told.underlay?.mmPerPx).toBeCloseTo(10, 6);
  expect(told.underlay!.sizeMm.w / guessed.underlay!.sizeMm.w).toBeCloseTo(10, 6);
  await expect(page.getByText("(assumed)")).toHaveCount(0);

  expect(errors).toEqual([]);
});
