import { expect, test } from "./_helpers";

const USER_SETTINGS_KEY = "paste-preset:user-settings:v1";

test("E2E-120: user settings persist across reloads", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  const storedSettings = {
    version: 1,
    settings: {
      presetId: "small",
      targetWidth: 1024,
      targetHeight: null,
      lockAspectRatio: true,
      resizeMode: "fit",
      outputFormat: "image/jpeg" as const,
      quality: 0.8,
      stripMetadata: false,
    },
  };

  // Simulate a returning user with custom settings already stored.
  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: USER_SETTINGS_KEY, payload: storedSettings },
  );

  await page.goto("/");

  // Settings panel should reflect stored configuration on first paint.
  await expect(page.getByRole("button", { name: "Small" })).toHaveClass(
    /btn-primary/,
  );

  // Resolution input keeps the last entered value.
  await expect(page.getByLabel("Width (px)")).toHaveValue("1024");

  // Output format select keeps the chosen MIME type.
  await expect(page.getByLabel("Format")).toHaveValue("image/jpeg");

  // stripMetadata checkbox preserves its stored state.
  await expect(
    page.getByLabel("Strip metadata (EXIF, etc.)"),
  ).not.toBeChecked();

  // Reload to verify the configuration remains stable across refreshes.
  await page.reload();

  await expect(page.getByRole("button", { name: "Small" })).toHaveClass(
    /btn-primary/,
  );
  await expect(page.getByLabel("Width (px)")).toHaveValue("1024");
  await expect(page.getByLabel("Format")).toHaveValue("image/jpeg");
  await expect(
    page.getByLabel("Strip metadata (EXIF, etc.)"),
  ).not.toBeChecked();
});

test("E2E-121: Reset settings restores defaults and clears storage", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  const storedSettings = {
    version: 1,
    settings: {
      presetId: "original" as const,
      targetWidth: 2048,
      targetHeight: null,
      lockAspectRatio: true,
      resizeMode: "fit",
      outputFormat: "image/jpeg" as const,
      quality: 0.9,
      stripMetadata: false,
    },
  };

  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: USER_SETTINGS_KEY, payload: storedSettings },
  );

  await page.goto("/");

  const widthInput = page.getByLabel("Width (px)");
  const formatSelect = page.getByLabel("Format");
  const stripCheckbox = page.getByLabel("Strip metadata (EXIF, etc.)");

  // Sanity-check that we picked up the stored configuration.
  await expect(page.getByRole("button", { name: "Original" })).toHaveClass(
    /btn-primary/,
  );
  await expect(widthInput).toHaveValue("2048");
  await expect(formatSelect).toHaveValue("image/jpeg");
  await expect(stripCheckbox).not.toBeChecked();

  const storedBeforeReset = await page.evaluate((key) => {
    return window.localStorage.getItem(key);
  }, USER_SETTINGS_KEY);
  expect(storedBeforeReset).not.toBeNull();

  // Trigger the UI-level reset action.
  await page.getByRole("button", { name: "Reset settings" }).click();

  // Defaults from defaultUserSettings are applied back to the UI.
  await expect(page.getByRole("button", { name: "Original" })).toHaveClass(
    /btn-primary/,
  );

  await expect(page.getByLabel("Width (px)")).toHaveValue("");
  await expect(page.getByLabel("Height (px)")).toHaveValue("");

  await expect(page.getByLabel("Format")).toHaveValue("auto");
  await expect(
    page.getByLabel("Strip metadata (EXIF, etc.)"),
  ).not.toBeChecked();

  // Storage entry is cleared by resetSettings().
  const storedAfterReset = await page.evaluate((key) => {
    return window.localStorage.getItem(key);
  }, USER_SETTINGS_KEY);
  expect(storedAfterReset).toBeNull();
});

test("E2E-122: corrupted stored user settings fall back to defaults", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error);
  });

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "not-json");
  }, USER_SETTINGS_KEY);

  await page.goto("/");

  // App loads normally without surfacing unhandled runtime errors.
  expect(pageErrors).toHaveLength(0);

  // Settings panel falls back to the same defaults as a fresh install.
  await expect(page.getByRole("button", { name: "Original" })).toHaveClass(
    /btn-primary/,
  );

  await expect(page.getByLabel("Width (px)")).toHaveValue("");
  await expect(page.getByLabel("Height (px)")).toHaveValue("");

  await expect(page.getByLabel("Format")).toHaveValue("auto");
  await expect(
    page.getByLabel("Strip metadata (EXIF, etc.)"),
  ).not.toBeChecked();
});
