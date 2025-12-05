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

test("E2E-145: renaming a system preset persists across reloads", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  const originalButton = page.getByRole("button", { name: "Original" });
  await originalButton.dblclick();

  const renameInput = page.locator("input.input-sm.join-item.input-bordered");
  await renameInput.fill("My Original");
  await renameInput.press("Enter");

  const renamedButton = page.getByRole("button", { name: "My Original" });
  await expect(renamedButton).toBeVisible();

  await page.reload();

  const renamedButtonAfterReload = page.getByRole("button", {
    name: "My Original",
  });
  await expect(renamedButtonAfterReload).toBeVisible();
  await expect(renamedButtonAfterReload).toHaveClass(/btn-primary/);

  const snapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        presets?: {
          id?: string | null;
          name?: string | null;
          kind?: string | null;
        }[];
      };
      if (!Array.isArray(parsed.presets)) {
        return null;
      }
      const preset = parsed.presets.find((entry) => entry.id === "original");
      if (!preset) {
        return null;
      }
      return {
        id: preset.id ?? null,
        name: preset.name ?? null,
        kind: preset.kind ?? null,
      };
    } catch {
      return null;
    }
  }, USER_PRESETS_KEY);

  expect(snapshot).toEqual({
    id: "original",
    name: "My Original",
    kind: "system",
  });
});

test("E2E-146: renaming a user preset created from unsaved slot", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  const smallButton = page.getByRole("button", { name: "Small" });
  await smallButton.click();

  const widthInput = page.getByLabel("Width (px)");
  await widthInput.fill("4321");

  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  const custom1Button = page.getByRole("button", { name: "自定义1" });
  await expect(custom1Button).toBeVisible();
  await expect(custom1Button).toHaveClass(/btn-primary/);

  await custom1Button.dblclick();

  // Rename input appears in the presets header before the numeric inputs.
  const renameInput = page.locator("input.input-sm.input-bordered").first();
  await renameInput.fill("Renamed Custom");
  await renameInput.press("Enter");

  const renamedButton = page.getByRole("button", {
    name: "Renamed Custom",
  });
  await expect(renamedButton).toBeVisible();
  await expect(renamedButton).toHaveClass(/btn-primary/);

  await page.reload();

  const renamedButtonAfterReload = page.getByRole("button", {
    name: "Renamed Custom",
  });
  await expect(renamedButtonAfterReload).toBeVisible();

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
      const preset = parsed.presets.find(
        (entry) => entry.name === "Renamed Custom",
      );
      if (!preset) {
        return null;
      }
      return {
        name: preset.name ?? null,
        kind: preset.kind ?? null,
      };
    } catch {
      return null;
    }
  }, USER_PRESETS_KEY);

  expect(snapshot).toEqual({
    name: "Renamed Custom",
    kind: "user",
  });
});

test("E2E-147: renaming cancelled by Esc keeps original name", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, USER_PRESETS_KEY);

  await page.goto("/");

  const originalButton = page.getByRole("button", { name: "Original" });
  await expect(originalButton).toBeVisible();

  await originalButton.dblclick();

  const renameInput = page.locator("input.input-sm.join-item.input-bordered");
  await renameInput.press("Escape");

  await page.reload();

  const originalButtonAfterReload = page.getByRole("button", {
    name: "Original",
  });
  await expect(originalButtonAfterReload).toBeVisible();

  const snapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        presets?: {
          id?: string | null;
          name?: string | null;
          kind?: string | null;
        }[];
      };
      if (!Array.isArray(parsed.presets)) {
        return null;
      }
      const preset = parsed.presets.find((entry) => entry.id === "original");
      if (!preset) {
        return null;
      }
      return {
        id: preset.id ?? null,
        name: preset.name ?? null,
        kind: preset.kind ?? null,
      };
    } catch {
      return null;
    }
  }, USER_PRESETS_KEY);

  expect(snapshot).toEqual({
    id: "original",
    name: null,
    kind: "system",
  });
});

test("E2E-148: deleting a user preset removes it and falls back to another preset", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  const smallButton = page.getByRole("button", { name: "Small" });
  await smallButton.click();

  // Create a custom preset via the unsaved flow so that we reach vertical mode.
  const widthInput = page.getByLabel("Width (px)");
  await widthInput.fill("1234");

  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  const customPresetButton = page.getByRole("button", { name: "自定义1" });
  await expect(customPresetButton).toBeVisible();
  await expect(customPresetButton).toHaveClass(/btn-ghost/);

  const customRow = customPresetButton.locator("xpath=..");
  const deleteButton = customRow.getByRole("button", { name: "Delete" });

  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  // Custom preset entry is removed from the list.
  await expect(page.getByRole("button", { name: "自定义1" })).toHaveCount(0);

  // Active preset falls back to an existing system preset (Original preferred).
  const originalButtonAfterDelete = page.getByRole("button", {
    name: "Original",
  });
  await expect(originalButtonAfterDelete).toHaveClass(/btn-primary/);
});

test("E2E-149: deleting a system preset updates storage and reselects a fallback", async ({
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

  const originalRow = originalButton.locator("xpath=..");
  const deleteButton = originalRow.getByRole("button", { name: "Delete" });

  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  // Original preset is removed from the UI.
  await expect(page.getByRole("button", { name: "Original" })).toHaveCount(0);

  const storageSnapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        presets?: { id?: string | null }[];
      };
      if (!Array.isArray(parsed.presets)) {
        return null;
      }
      const hasOriginal = parsed.presets.some(
        (preset) => preset.id === "original",
      );
      return { hasOriginal };
    } catch {
      return null;
    }
  }, USER_PRESETS_KEY);

  expect(storageSnapshot).toEqual({ hasOriginal: false });

  // Active preset falls back to Large (first remaining system preset).
  const largeButton = page.getByRole("button", { name: "Large" });
  await expect(largeButton).toHaveClass(/btn-primary/);
});

test("E2E-150: fallback mode disables preset deletion", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.addInitScript((key) => {
    // Ensure a clean starting point and then simulate failing writes so that
    // presets enter fallback mode on first load.
    window.localStorage.removeItem(key);

    Storage.prototype.setItem = function (
      this: Storage,
      _storageKey: string,
      _value: string,
    ): void {
      throw new Error(
        "Simulated localStorage.setItem failure for presets (fallback)",
      );
    };
  }, USER_PRESETS_KEY);

  await page.goto("/");

  const originalButton = page.getByRole("button", { name: "Original" });
  const originalRow = originalButton.locator("xpath=..");
  const deleteButton = originalRow.getByRole("button", { name: "Delete" });

  await expect(deleteButton).toBeDisabled();

  // Force-click should still not change storage or UI.
  await deleteButton.click({ force: true });

  await expect(page.getByRole("button", { name: "Original" })).toHaveCount(1);

  const storageSnapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return raw;
  }, USER_PRESETS_KEY);

  // Storage writes should still be failing, so no presets are persisted.
  expect(storageSnapshot).toBeNull();
});
