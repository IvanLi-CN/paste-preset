import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:25119",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:25119",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "tablet",
      use: {
        browserName: "chromium",
        viewport: { width: 800, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
