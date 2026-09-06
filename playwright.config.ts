import { defineConfig, devices } from "@playwright/test";

/**
 * Thin integration/visual layer for the routing system. The headless harness
 * (src/routingHarness) is the rule oracle; this only confirms the real app boots,
 * mounts the canvas, routes without throwing, and surfaces no console errors.
 *
 * One-time setup: `npm run test:e2e:install` (downloads Chromium), then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // Playwright defaults to half the cores, which on a developer machine that is also being
  // used for actual work means five browsers plus one dev server competing — the heavier
  // specs (rasterizing a plan, driving wheel gestures) then time out at random and say
  // nothing about the app. Three is reliable here; CI gets a machine to itself.
  workers: process.env.CI ? undefined : 3,
  outputDir: "./e2e/test-results",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // PowerShell-safe: a single command, no && chaining.
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
