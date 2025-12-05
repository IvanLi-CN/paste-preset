import { expect, test } from "./_helpers";

const USER_PRESETS_KEY = "paste-preset:user-presets:v1";

test("E2E-130: initializes system user presets on first load", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, USER_PRESETS_KEY);

  await page.goto("/");

  const snapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      version: number;
      presets?: { id?: string | null }[];
    };

    const ids = Array.isArray(parsed.presets)
      ? parsed.presets
          .map((preset) => preset.id)
          .filter((id): id is string => typeof id === "string")
      : [];

    return {
      version: parsed.version,
      count: ids.length,
      ids: ids.sort(),
    };
  }, USER_PRESETS_KEY);

  expect(snapshot).not.toBeNull();
  expect(snapshot?.version).toBe(1);
  expect(snapshot?.count).toBe(4);
  expect(snapshot?.ids).toEqual(
    ["large", "medium", "original", "small"].sort(),
  );

  const originalButton = page.getByRole("button", { name: "Original" });
  await expect(originalButton).toBeVisible();
  await originalButton.click();
});

test("E2E-131: corrupted user presets re-initialize to system defaults", async ({
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
  }, USER_PRESETS_KEY);

  await page.goto("/");

  expect(pageErrors).toHaveLength(0);

  const snapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      version: number;
      presets?: { id?: string | null }[];
    };

    const ids = Array.isArray(parsed.presets)
      ? parsed.presets
          .map((preset) => preset.id)
          .filter((id): id is string => typeof id === "string")
      : [];

    return {
      version: parsed.version,
      count: ids.length,
      ids: ids.sort(),
    };
  }, USER_PRESETS_KEY);

  expect(snapshot).not.toBeNull();
  expect(snapshot?.version).toBe(1);
  expect(snapshot?.count).toBe(4);
  expect(snapshot?.ids).toEqual(
    ["large", "medium", "original", "small"].sort(),
  );
});

test("E2E-132: falls back when storage writes fail but UI remains usable", async ({
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
    // Ensure a clean starting point and then simulate failing writes.
    window.localStorage.removeItem(key);

    Storage.prototype.setItem = function (
      this: Storage,
      _storageKey: string,
      _value: string,
    ): void {
      throw new Error("Simulated localStorage.setItem failure");
    };
  }, USER_PRESETS_KEY);

  await page.goto("/");

  const originalButton = page.getByRole("button", { name: "Original" });
  const smallButton = page.getByRole("button", { name: "Small" });

  await expect(originalButton).toBeVisible();
  await expect(smallButton).toBeVisible();

  await originalButton.click();
  await smallButton.click();

  expect(pageErrors).toHaveLength(0);

  const storedValue = await page.evaluate((key) => {
    return window.localStorage.getItem(key);
  }, USER_PRESETS_KEY);

  expect(storedValue).toBeNull();
});
