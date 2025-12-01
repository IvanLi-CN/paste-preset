import path from "node:path";
import { test as base, expect } from "@playwright/test";

type Fixtures = {
  testImagesDir: string;
};

export const test = base.extend<Fixtures>({
  // Base directory for image fixtures used across E2E suites.
  testImagesDir: async ({ page: _page }, use) => {
    const dir = path.resolve(__dirname, "..", "fixtures");
    await use(dir);
  },
});

export { expect };

export async function uploadFile(
  page: import("@playwright/test").Page,
  fileInputSelector: string,
  filePath: string,
) {
  const input = page.locator(fileInputSelector);
  await input.setInputFiles(filePath);
}

export async function waitForProcessingToFinish(
  page: import("@playwright/test").Page,
) {
  const processingLocator = page.getByText("Processing image…", {
    exact: false,
  });

  // Wait for the processing message to appear (if it ever does) and then disappear.
  await processingLocator
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => {
      // If it never appears, we just continue; callers may assert more specifically.
    });

  await processingLocator
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => {
      // If it does not hide in time, let the test surface its own expectations.
    });
}
