import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-pwa",
  use: {
    baseURL: "http://localhost:25119",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run build && bun run preview -- --port 25119 --strictPort",
    url: "http://localhost:25119",
    reuseExistingServer: !process.env.CI,
    timeout: 240 * 1000,
  },
  projects: [
    {
      name: "pwa",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
