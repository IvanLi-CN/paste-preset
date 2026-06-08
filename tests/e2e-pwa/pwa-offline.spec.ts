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
  expect(text).not.toContain("clients.claim");
  expect(text).toContain("SKIP_WAITING");
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

async function waitForWaitingWorker(
  page: import("@playwright/test").Page,
  timeout = 15_000,
) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.waiting ? "waiting" : "missing";
        }),
      { timeout },
    )
    .toBe("waiting");
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
  await expect(
    page.getByRole("status").filter({
      hasText: "Offline mode: cached features remain available.",
    }),
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

test("PWA-003 waiting update is user-prompted and survives reload until applied", async ({
  page,
}) => {
  await page.goto("/");
  await ensurePageIsControlledByServiceWorker(page);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      throw new Error("service worker registration missing");
    }

    const scriptUrl = new URL("/sw.js", window.location.origin);
    const nonce = String(Date.now());
    scriptUrl.searchParams.set("test-update", nonce);

    await navigator.serviceWorker.register(scriptUrl.toString(), {
      scope: "/",
      updateViaCache: "none",
    });
  });

  await waitForWaitingWorker(page);

  const updateStatus = page.getByRole("status").filter({
    hasText: "A new version is ready.",
  });
  await expect(updateStatus).toBeVisible();

  await page.getByRole("button", { name: "Later" }).click();
  await expect(updateStatus).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await ensurePageIsControlledByServiceWorker(page);
  await waitForWaitingWorker(page);
  await expect(updateStatus).toBeVisible();

  await page.getByRole("button", { name: "Reload now" }).click();

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return {
            hasController: navigator.serviceWorker.controller !== null,
            hasWaiting: Boolean(registration?.waiting),
          };
        }),
      { timeout: 15_000 },
    )
    .toEqual({
      hasController: true,
      hasWaiting: false,
    });

  await expect(
    page.getByRole("status").filter({ hasText: "A new version is ready." }),
  ).toHaveCount(0);
});
