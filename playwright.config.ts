import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      APP_ORIGIN: "http://127.0.0.1:3100",
      APP_ENV: "development",
      FIXTURE_MODE: "true",
      DEV_BROWSER_SESSION: "false",
      SESSION_PASSWORD: "isolated-playwright-fixtures-password-32plus",
    },
  },
});
