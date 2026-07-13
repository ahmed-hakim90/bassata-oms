import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
/** When set, Playwright will not spawn `npm run dev` (expect an already-running app). */
const skipWebServer = Boolean(process.env.PLAYWRIGHT_SKIP_WEBSERVER || process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        // Inherit caller env so local Supabase overrides in the shell win over `.env.local`.
        env: process.env as Record<string, string>,
      },
});
