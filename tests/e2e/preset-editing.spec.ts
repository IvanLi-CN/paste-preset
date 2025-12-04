import { expect, test } from "./_helpers";

const USER_PRESETS_KEY = "paste-preset:user-presets:v1";

test("E2E-140: editing a saved preset and saving updates the original preset", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  const mediumButton = page.getByRole("button", { name: "Medium" });
  await mediumButton.click();

  // Enter editing mode for the Medium preset.
  await page.getByRole("button", { name: "Edit" }).click();

  // Change output format and quality while in edit mode.
  const formatSelect = page.getByLabel("Format");
  await formatSelect.selectOption("image/jpeg");

  const qualitySlider = page.getByLabel("Quality");
  await expect(page.getByText("80%")).toBeVisible();
  await qualitySlider.focus();
  await qualitySlider.press("ArrowLeft");
  await expect(page.getByText("75%")).toBeVisible();

  // Save edits in place.
  await page.getByRole("button", { name: "Save" }).click();

  await page.reload();

  // Medium remains the active preset after reload.
  const mediumButtonAfterReload = page.getByRole("button", { name: "Medium" });
  await expect(mediumButtonAfterReload).toHaveClass(/btn-primary/);

  // Persisted configuration reflects edited format and quality.
  await expect(page.getByLabel("Format")).toHaveValue("image/jpeg");
  await expect(page.getByText("75%")).toBeVisible();
});

test("E2E-141: cancelling edit mode does not change the saved preset", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  const mediumButton = page.getByRole("button", { name: "Medium" });
  await mediumButton.click();

  await page.getByRole("button", { name: "Edit" }).click();

  const formatSelect = page.getByLabel("Format");
  await formatSelect.selectOption("image/jpeg");

  // Cancel discards edits and restores the last persisted config.
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.reload();

  const mediumButtonAfterReload = page.getByRole("button", { name: "Medium" });
  await expect(mediumButtonAfterReload).toHaveClass(/btn-primary/);
  await expect(page.getByLabel("Format")).toHaveValue("image/png");
});

test("E2E-142: adjusting a locked preset enters unsaved mode and saving creates 自定义1", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  const smallButton = page.getByRole("button", { name: "Small" });
  await smallButton.click();

  // Modify settings without entering explicit edit mode to create an unsaved slot.
  const widthInput = page.getByLabel("Width (px)");
  await widthInput.fill("1234");

  // Unsaved slot exposes Save / Cancel actions.
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  const cancelButton = page.getByRole("button", {
    name: "Cancel",
    exact: true,
  });
  await expect(saveButton).toBeVisible();
  await expect(cancelButton).toBeVisible();

  await saveButton.click();

  // A new user preset named 自定义1 is created and becomes active.
  const custom1Button = page.getByRole("button", { name: "自定义1" });
  await expect(custom1Button).toBeVisible();
  await expect(custom1Button).toHaveClass(/btn-primary/);

  const snapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        presets?: { name?: string | null; kind?: string | null }[];
      };
      if (!Array.isArray(parsed.presets)) {
        return null;
      }
      const custom = parsed.presets.find((preset) => preset.name === "自定义1");
      if (!custom) {
        return null;
      }
      return {
        name: custom.name ?? null,
        kind: custom.kind ?? null,
      };
    } catch {
      return null;
    }
  }, USER_PRESETS_KEY);

  expect(snapshot).toEqual({ name: "自定义1", kind: "user" });
});

test("E2E-143: custom preset naming uses max N + 1 and does not fill holes", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  const storedPresets = {
    version: 1,
    presets: [
      {
        id: "original",
        name: "Original",
        kind: "system" as const,
        settings: {
          presetId: "original" as const,
          targetWidth: null,
          targetHeight: null,
          lockAspectRatio: true,
          resizeMode: "fit" as const,
          outputFormat: "auto" as const,
          quality: 0.8,
          stripMetadata: false,
        },
      },
      {
        id: "large",
        name: "Large",
        kind: "system" as const,
        settings: {
          presetId: "large" as const,
          targetWidth: null,
          targetHeight: null,
          lockAspectRatio: true,
          resizeMode: "fit" as const,
          outputFormat: "auto" as const,
          quality: 0.8,
          stripMetadata: false,
        },
      },
      {
        id: "medium",
        name: "Medium",
        kind: "system" as const,
        settings: {
          presetId: "medium" as const,
          targetWidth: null,
          targetHeight: null,
          lockAspectRatio: true,
          resizeMode: "fit" as const,
          outputFormat: "auto" as const,
          quality: 0.8,
          stripMetadata: false,
        },
      },
      {
        id: "small",
        name: "Small",
        kind: "system" as const,
        settings: {
          presetId: "small" as const,
          targetWidth: null,
          targetHeight: null,
          lockAspectRatio: true,
          resizeMode: "fit" as const,
          outputFormat: "auto" as const,
          quality: 0.8,
          stripMetadata: false,
        },
      },
      {
        id: "user-1",
        name: "自定义1",
        kind: "user" as const,
        settings: {
          presetId: null,
          targetWidth: null,
          targetHeight: null,
          lockAspectRatio: true,
          resizeMode: "fit" as const,
          outputFormat: "auto" as const,
          quality: 0.8,
          stripMetadata: false,
        },
      },
      {
        id: "user-3",
        name: "自定义3",
        kind: "user" as const,
        settings: {
          presetId: null,
          targetWidth: null,
          targetHeight: null,
          lockAspectRatio: true,
          resizeMode: "fit" as const,
          outputFormat: "auto" as const,
          quality: 0.8,
          stripMetadata: false,
        },
      },
    ],
  } as const;

  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: USER_PRESETS_KEY, payload: storedPresets },
  );

  await page.goto("/");

  const originalButton = page.getByRole("button", { name: "Original" });
  await originalButton.click();

  const widthInput = page.getByLabel("Width (px)");
  await widthInput.fill("1024");

  await page
    .getByRole("button", {
      name: "Save",
      exact: true,
    })
    .click();

  // New preset picks 自定义4, not 自定义2.
  const custom4Button = page.getByRole("button", { name: "自定义4" });
  await expect(custom4Button).toBeVisible();

  const names = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as {
        presets?: { name?: string | null }[];
      };
      if (!Array.isArray(parsed.presets)) {
        return [];
      }
      return parsed.presets
        .map((preset) => preset.name)
        .filter((name): name is string => typeof name === "string");
    } catch {
      return [];
    }
  }, USER_PRESETS_KEY);

  expect(names).toEqual(
    expect.arrayContaining(["自定义1", "自定义3", "自定义4"]),
  );
});

test("E2E-144: fallback mode disables preset editing and shows warning", async ({
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
    window.localStorage.removeItem(key);

    Storage.prototype.setItem = function (
      this: Storage,
      _storageKey: string,
      _value: string,
    ): void {
      throw new Error("Simulated localStorage.setItem failure for presets");
    };
  }, USER_PRESETS_KEY);

  await page.goto("/");

  // Fallback warning is visible.
  await expect(
    page.getByText(
      "Unable to save presets on this device. Changes to presets will not be remembered after closing this page.",
    ),
  ).toBeVisible();

  // Editing controls are not available in fallback mode.
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);

  // Built-in presets remain usable without surfacing runtime errors.
  const originalButton = page.getByRole("button", { name: "Original" });
  const smallButton = page.getByRole("button", { name: "Small" });

  await expect(originalButton).toBeEnabled();
  await expect(smallButton).toBeEnabled();

  await originalButton.click();
  await smallButton.click();

  expect(pageErrors).toHaveLength(0);
});
