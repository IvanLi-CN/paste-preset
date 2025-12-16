import {
  expect,
  getTaskDownloadLink,
  test,
  uploadFixtureViaFileInput,
  waitForLatestTaskStatus,
  waitForProcessingToFinish,
} from "../e2e/_helpers";

async function waitForServiceWorkerReady(
  page: import("@playwright/test").Page,
) {
  await page.waitForFunction(() => !!navigator.serviceWorker);
  await page.evaluate(() => navigator.serviceWorker.ready);
}

async function assertSwBuildArtifact(page: import("@playwright/test").Page) {
  const response = await page.request.get("/sw.js");
  expect(response.ok()).toBe(true);

  const text = await response.text();
  expect(text).toContain("version.json");
  expect(text).toContain("heic2any-");

  // Update policy: next launch only (no skipWaiting / clients.claim).
  expect(text).not.toContain("skipWaiting");
  expect(text).not.toContain("clients.claim");
}

async function ensurePageIsControlledByServiceWorker(
  page: import("@playwright/test").Page,
) {
  await waitForServiceWorkerReady(page);

  // We intentionally don't call clients.claim() in the SW, so we need a
  // reload before the page becomes controlled.
  await page.reload();

  await expect
    .poll(
      () => page.evaluate(() => navigator.serviceWorker.controller !== null),
      { timeout: 15_000 },
    )
    .toBe(true);
}

test("PWA-001 offline hard reload loads app shell", async ({ page }) => {
  await page.goto("/");

  await assertSwBuildArtifact(page);
  await ensurePageIsControlledByServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "PastePreset", level: 1 }),
  ).toBeVisible();

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText(/^v\d/)).toBeVisible();
});

test("PWA-002 offline processing + download works", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await ensurePageIsControlledByServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);
  const latestTask = await waitForLatestTaskStatus(page, "Done");

  const downloadLink = getTaskDownloadLink(latestTask);
  await expect(downloadLink).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadLink.click(),
  ]);

  expect(download.suggestedFilename()).not.toBe("");
});
