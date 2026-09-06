import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Coverage areas on a floorplan: what a camera sees, what a detector reaches.
 *
 * The regression guarded here: pressing "Coverage" a second time used to stack a second
 * wedge on the same device. Rotating the top one then looked like a rotation that did not
 * take, because the one underneath kept its own angle.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8//8/AzJgYkAFRPEBW1YDzUZ2eiIAAAAASUVORK5CYII=";

test.slow();

/** Apex, bisector direction and spread of the drawn wedge, in degrees. */
function geom(d: string) {
  const pts = [...d.matchAll(/([-\d.]+) ([-\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
  const apex = pts[0];
  const angs = pts.slice(1).map((p) => (Math.atan2(p.y - apex.y, p.x - apex.x) * 180) / Math.PI);
  return {
    mid: Math.round((Math.max(...angs) + Math.min(...angs)) / 2),
    spread: Math.round(Math.max(...angs) - Math.min(...angs)),
  };
}

test("floorplan: a device keeps one coverage area, and turning it turns what is drawn", async ({ page }) => {
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

  const paper = page.locator("div.bg-white.shadow-xl").first();
  const box = (await paper.boundingBox())!;
  const sx = box.x + box.width * 0.3;
  const sy = box.y + box.height * 0.5;

  // A group and one symbol.
  await page.getByTitle("Add a symbol group").click();
  await page.getByPlaceholder("Legend title, e.g. Ceiling speakers").fill("Kameras");
  await page.getByTitle("Click the plan to drop symbols of the active group").click();
  await page.mouse.click(sx, sy);
  await page.getByRole("button", { name: /Select/ }).first().click();

  const wedges = paper.locator("svg path[fill-opacity]");
    // The panel button, not the toolbar tool of the same name — matched on its own title.
  const coverBtn = page.getByTitle(/Draw what this device covers|Open the area this device already has/);

  // First press gives it an area.
  await coverBtn.click();
  await expect(wedges).toHaveCount(1);

  // Re-select the symbol, then press again: it must OPEN that area, not add a second.
  await page.mouse.click(sx, sy);
  await expect(coverBtn).toHaveText(/Edit coverage/);
  await coverBtn.click();
  await expect(wedges).toHaveCount(1);
  await expect(page.getByText("Selected coverage")).toBeVisible();

  // Turning it moves the one wedge that exists — nothing keeps an old angle behind it.
  const before = geom((await wedges.first().getAttribute("d")) ?? "");
  const rad = (before.mid * Math.PI) / 180;
  await page.mouse.click(sx + Math.cos(rad) * 25, sy + Math.sin(rad) * 25, { button: "right" });
  const menu = page.locator("[data-floorplan-coverage-menu]");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "90° clockwise" }).click();
  await expect(menu).toHaveCount(0);

  await expect(wedges).toHaveCount(1);
  const after = geom((await wedges.first().getAttribute("d")) ?? "");
  expect(after.spread).toBe(before.spread);
  expect(((after.mid - before.mid) % 360 + 360) % 360).toBe(90);

  // A second area stays reachable on purpose, from the symbol's right-click menu.
  await page.mouse.click(sx, sy, { button: "right" });
  const symMenu = page.locator("[data-floorplan-symbol-menu]");
  await expect(symMenu).toBeVisible();
  await expect(symMenu.getByRole("button", { name: /Edit its coverage area/ })).toBeVisible();
  await symMenu.getByRole("button", { name: /Add another coverage area/ }).click();
  await expect(wedges).toHaveCount(2);

  expect(errors).toEqual([]);
});
