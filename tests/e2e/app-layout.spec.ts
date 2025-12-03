import { expect, test } from "./_helpers";

test("E2E-001 desktop first screen layout", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  // Title and header copy
  await expect(
    page.getByRole("heading", { level: 1, name: "PastePreset" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Paste or drop an image, resize and convert it entirely in your browser.",
    ),
  ).toBeVisible();
  // The separate privacy note in the header has been removed.

  // Settings panel (desktop: left column, always visible)
  await expect(
    page.getByRole("heading", { level: 2, name: "Settings" }),
  ).toBeVisible();

  // Paste area & helper text
  await expect(
    page.getByRole("button", {
      name: "Paste, drop, or click to select an image",
    }),
  ).toBeVisible();
  await expect(page.getByText("Paste image here (Ctrl/Cmd + V)")).toBeVisible();
  await expect(
    page.getByText("or drag & drop an image, or click to choose a file"),
  ).toBeVisible();

  // Preview info banner
  await expect(
    page.getByText(
      "Paste, drop, or select an image to see the original and processed previews here.",
    ),
  ).toBeVisible();

  // StatusBar should not render anything on initial load.
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("E2E-002 mobile first screen layout", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") {
    test.skip();
  }

  await page.goto("/");

  const settingsHeading = page.getByRole("heading", {
    level: 2,
    name: "Settings",
  });
  const pasteButton = page.getByRole("button", {
    name: "Paste, drop, or click to select an image",
  });

  await expect(settingsHeading).toBeVisible();
  await expect(pasteButton).toBeVisible();

  // On small screens the Settings panel is stacked above Paste/Preview,
  // and there is no floating "Settings" toggle button / drawer.
  const settingsBox = await settingsHeading.boundingBox();
  const pasteBox = await pasteButton.boundingBox();

  if (
    !settingsBox ||
    !pasteBox ||
    settingsBox.y == null ||
    pasteBox.y == null
  ) {
    throw new Error("Expected bounding boxes for Settings and PasteArea.");
  }
  expect(settingsBox.y).toBeLessThan(pasteBox.y);

  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Close settings" }),
  ).toHaveCount(0);

  // StatusBar should not render anything on initial load.
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("E2E-003 system theme sync via matchMedia", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  // Inject a fake matchMedia before any app scripts run.
  await page.addInitScript(() => {
    const listeners = new Set<(event: { matches: boolean }) => void>();
    let isDark = true;

    const mediaQueryObject = {
      matches: isDark,
      media: "(prefers-color-scheme: dark)",
      onchange: null as ((event: { matches: boolean }) => void) | null,
      addEventListener(
        _type: string,
        listener: (event: { matches: boolean }) => void,
      ) {
        listeners.add(listener);
      },
      removeEventListener(
        _type: string,
        listener: (event: { matches: boolean }) => void,
      ) {
        listeners.delete(listener);
      },
      addListener(listener: (event: { matches: boolean }) => void) {
        listeners.add(listener);
      },
      removeListener(listener: (event: { matches: boolean }) => void) {
        listeners.delete(listener);
      },
      dispatchEvent() {
        return false;
      },
    };

    window.matchMedia = () => mediaQueryObject as unknown as MediaQueryList;

    // Expose a helper for tests to flip the simulated system theme.
    const globalWindow = window as unknown as {
      __setDarkModeForTest?: (nextIsDark: boolean) => void;
    };

    globalWindow.__setDarkModeForTest = (nextIsDark: boolean) => {
      isDark = nextIsDark;
      mediaQueryObject.matches = isDark;
      const event = { matches: isDark };
      listeners.forEach((listener) => {
        listener(event);
      });
      if (typeof mediaQueryObject.onchange === "function") {
        mediaQueryObject.onchange(event);
      }
    };
  });

  await page.goto("/");

  // Initial load should respect dark preference.
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-theme")),
    )
    .toBe("dim");

  // Toggle to light mode and dispatch a change event through our stub.
  await page.evaluate(() => {
    const globalWindow = window as unknown as {
      __setDarkModeForTest?: (nextIsDark: boolean) => void;
    };
    globalWindow.__setDarkModeForTest?.(false);
  });

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-theme")),
    )
    .toBe("winter");
});
