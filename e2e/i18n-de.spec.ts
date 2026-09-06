import { test, expect } from "@playwright/test";

/**
 * The FACE image is built with VITE_DEFAULT_LOCALE=de, so the editor has to come
 * up in German without anyone touching a setting — and the switch in Preferences
 * has to repaint the running app, not just the next reload.
 *
 * Run against a German build:  VITE_DEFAULT_LOCALE=de npx playwright test e2e/i18n-de.spec.ts
 * Under the default English build this spec is skipped.
 */
test("the German build opens in German, and the switch changes language live", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  test.skip(
    await page.getByText("File", { exact: true }).first().isVisible(),
    "English build — run with VITE_DEFAULT_LOCALE=de",
  );

  // Menu bar in German.
  await expect(page.getByText("Datei", { exact: true })).toBeVisible();
  await expect(page.getByText("Bearbeiten", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Ansicht", { exact: true }).first()).toBeVisible();

  // Preferences opens in German and carries the language switch.
  await page.getByText("Datei", { exact: true }).click();
  await page.getByText("Einstellungen...", { exact: true }).click();
  await page.getByText("Darstellung", { exact: true }).click();
  await expect(page.getByText("Sprache der Oberfläche", { exact: true })).toBeVisible();

  // Switching to English repaints the open dialog — no reload.
  await page.locator("select").filter({ hasText: "Deutsch" }).selectOption("en");
  await expect(page.getByText("Interface language", { exact: true })).toBeVisible();
  await page.getByText("Close", { exact: true }).click();
  await expect(page.getByText("File", { exact: true }).first()).toBeVisible();

  // And the choice outlives a reload.
  await page.reload();
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("File", { exact: true }).first()).toBeVisible();
});
