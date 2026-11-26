import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A detector dropped on a plan brings the area its maker states (asked for 26.11.2026:
 * the Telenot and Ajax components "mit BHE Symbol und Abdeckung").
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: a Telenot histar arrives with 15 m / 90° and its BHE symbol", async ({ page }) => {
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

  const drop = async (search: string, fx: number) => {
    await page.getByPlaceholder(/Search plan and devices/).fill(search);
    const hit = page.locator("[draggable=true]").filter({ hasText: search }).last();
    await expect(hit).toBeVisible({ timeout: 15_000 });
    const sheet = page.locator("div.bg-white.shadow-xl").first();
    const box = (await sheet.boundingBox())!;
    const templateId = await hit.evaluate((el) => {
      const dt = new DataTransfer();
      el.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
      return dt.getData("application/x-floorplan-template-id");
    });
    await sheet.evaluate((el, arg) => {
      const dt = new DataTransfer();
      dt.setData("application/x-floorplan-template-id", arg.id);
      el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: arg.x, clientY: arg.y }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: arg.x, clientY: arg.y }));
    }, { id: templateId, x: box.x + box.width * fx, y: box.y + box.height * 0.5 });
  };

  const read = () => page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const fp = s.pages.find((p) => p.type === "floorplan") as {
      coverages: { shape: string; rangeM: number; apertureDeg?: number; symbolId?: string }[];
      symbols: { id: string; groupId: string }[];
      groups: { id: string; symbolLibraryId?: string }[];
    };
    return { coverages: fp.coverages, symbols: fp.symbols, groups: fp.groups };
  });

  // A wall detector: the wedge off the datasheet, tied to the device.
  await drop("histar 1015-C2B", 0.35);
  await expect(page.getByText(/On the plan \(1\)/)).toBeVisible({ timeout: 15_000 });
  let plan = await read();
  expect(plan.coverages).toHaveLength(1);
  expect(plan.coverages[0]).toMatchObject({ shape: "sector", rangeM: 15, apertureDeg: 90, symbolId: plan.symbols[0].id });
  // Its group draws the BHE infrared motion detector.
  expect(plan.groups.find((g) => g.id === plan.symbols[0].groupId)?.symbolLibraryId).toBe("1-einbruchmeldetechnik/infrarot-bewegungsmelder");

  // A ceiling detector: all round, Telenot's Ø 20 m.
  await drop("histar DUAL B360", 0.65);
  await expect(page.getByText(/On the plan \(2\)/)).toBeVisible({ timeout: 15_000 });
  plan = await read();
  expect(plan.coverages).toHaveLength(2);
  expect(plan.coverages[1]).toMatchObject({ shape: "circle", rangeM: 10 });

  expect(errors).toEqual([]);
});
