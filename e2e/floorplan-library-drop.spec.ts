import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A model dragged straight from the library onto a plan. The schematic has no such device
 * yet, so it is created there too — in a room named after the plan, so the device is
 * findable where every other device lives.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

test("floorplan: a library model dropped on the plan lands on the schematic too", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  const planPath = join(mkdtempSync(join(tmpdir(), "floorplan-")), "plan.png");
  writeFileSync(planPath, Buffer.from(PNG_BASE64, "base64"));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  const devicesBefore = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    return useSchematicStore.getState().nodes.filter((n) => n.type === "device").length;
  });

  await page.getByTitle("Add floorplan page — an architect's drawing with device symbols").click();
  await page.setInputFiles('input[type="file"][accept*="application/pdf"]', planPath);
  await expect(page.locator('img[alt="plan.png"]')).toBeVisible({ timeout: 30_000 });

  // The library answers a search rather than listing itself.
  const search = page.getByPlaceholder(/Search plan and devices/);
  await expect(page.getByText(/Type at least two letters/)).toBeVisible();
  await search.fill("speaker");
  const hit = page.locator("[draggable=true]").filter({ hasText: /./ }).last();
  await expect(hit).toBeVisible({ timeout: 15_000 });

  // Drag it onto the sheet. Playwright cannot carry a custom MIME through dragTo, so the
  // drop is dispatched with the payload the sidebar sets.
  const sheet = page.locator("div.bg-white.shadow-xl").first();
  const box = (await sheet.boundingBox())!;
  const templateId = await hit.evaluate((el) => {
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    return dt.getData("application/x-floorplan-template-id");
  });
  expect(templateId).not.toBe("");

  await sheet.evaluate((el, arg) => {
    const dt = new DataTransfer();
    dt.setData("application/x-floorplan-template-id", arg.id);
    el.dispatchEvent(new DragEvent("drop", {
      dataTransfer: dt, bubbles: true, cancelable: true,
      clientX: arg.x, clientY: arg.y,
    }));
  }, { id: templateId, x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 });

  // A symbol on the plan …
  await expect(page.getByText(/On the plan \(1\)/)).toBeVisible({ timeout: 15_000 });

  // … and the device on the schematic, in a room named after the plan.
  const after = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const s = useSchematicStore.getState();
    const devices = s.nodes.filter((n) => n.type === "device");
    const room = s.nodes.find((n) => n.type === "room" && (n.data as { label?: string }).label === "Floorplan 1");
    const inRoom = room ? devices.filter((d) => d.parentId === room.id).length : 0;
    return { devices: devices.length, hasRoom: Boolean(room), inRoom };
  });
  expect(after.devices).toBe(devicesBefore + 1);
  expect(after.hasRoom).toBe(true);
  expect(after.inRoom).toBe(1);

  expect(errors).toEqual([]);
});
