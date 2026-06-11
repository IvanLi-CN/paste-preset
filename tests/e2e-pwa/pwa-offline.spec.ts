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

async function getPwaSnapshot(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const globalWindow = window as unknown as {
      __pastePresetPwaSnapshot?: {
        isOffline: boolean;
        updateStatus: string;
        offlineReadiness: string;
      };
    };

    return globalWindow.__pastePresetPwaSnapshot ?? null;
  });
}

async function getStartupMetrics(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const globalWindow = window as unknown as {
      __pastePresetMetrics?: {
        appShellVisible?: number;
        appInteractive?: number;
      };
    };

    return globalWindow.__pastePresetMetrics ?? {};
  });
}

async function assertSwBuildArtifact(page: import("@playwright/test").Page) {
  const swResponse = await page.request.get("/sw.js");
  expect(swResponse.ok()).toBe(true);

  const swText = await swResponse.text();
  expect(swText).toContain("offline-warm-manifest.json");
  expect(swText).toContain("START_OPTIONAL_WARMUP");
  expect(swText).not.toContain("clients.claim");
  expect(swText).not.toContain("heic2any-");

  const warmManifestResponse = await page.request.get(
    "/offline-warm-manifest.json",
  );
  expect(warmManifestResponse.ok()).toBe(true);
  const warmManifest = (await warmManifestResponse.json()) as Array<{
    url?: string;
  }>;
  expect(warmManifest.some((entry) => entry.url?.includes("heic2any-"))).toBe(
    true,
  );
  expect(warmManifest.some((entry) => entry.url?.includes("webp-wasm-"))).toBe(
    true,
  );
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

test("PWA-001 offline hard reload loads cached app shell within the startup budget", async ({
  page,
}) => {
  await page.goto("/");

  await assertSwBuildArtifact(page);
  await ensurePageIsControlledByServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "PastePreset", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText(/Offline mode:/);

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText(/^v\d/)).toBeVisible();

  const metrics = await getStartupMetrics(page);
  expect(
    metrics.appShellVisible ?? Number.POSITIVE_INFINITY,
  ).toBeLessThanOrEqual(1000);
  expect(
    metrics.appInteractive ?? Number.POSITIVE_INFINITY,
  ).toBeLessThanOrEqual(2000);
});

test("PWA-002 offline processing + download still works for common formats", async ({
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

test("PWA-003 optional warm assets are split out and reach full-ready online", async ({
  page,
}) => {
  await page.goto("/");

  await ensurePageIsControlledByServiceWorker(page);

  await expect
    .poll(async () => {
      const snapshot = await getPwaSnapshot(page);
      return snapshot?.offlineReadiness ?? "missing";
    })
    .toBe("full-ready");
});

test("PWA-004 offline HEIC without completed warmup explains the recovery path", async ({
  page,
  testImagesDir,
}) => {
  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __heic2anyOverride?: "unavailable";
    };
    globalWindow.__heic2anyOverride = "unavailable";

    window.requestIdleCallback = ((callback: IdleRequestCallback) =>
      window.setTimeout(
        () =>
          callback({
            didTimeout: false,
            timeRemaining: () => 0,
          } as IdleDeadline),
        5000,
      )) as typeof window.requestIdleCallback;
  });

  await page.goto("/");
  await ensurePageIsControlledByServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await uploadFixtureViaFileInput(page, testImagesDir, "heic-photo.heic");

  const statusError = page.getByRole("alert").filter({
    hasText:
      "This HEIC/HEIF file needs one successful online warmup before it can be processed offline. Reconnect once, wait for offline extras to finish preparing, then try again.",
  });
  await expect(statusError).toBeVisible();
});

test("PWA-005 waiting update is user-prompted and survives reload until applied", async ({
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
