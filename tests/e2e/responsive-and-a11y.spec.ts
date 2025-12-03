import {
  expect,
  pastePlainTextToPasteArea,
  test,
  uploadFixtureViaFileInput,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-100: md viewport auto-closes settings drawer after first image", async ({
  page,
  testImagesDir,
}, testInfo) => {
  if (testInfo.project.name !== "tablet") {
    test.skip();
  }

  await page.goto("/");

  // On md viewport without an image, the floating Settings button is visible
  // and the drawer overlay is not mounted.
  const settingsToggle = page.getByRole("button", {
    name: "Settings",
    exact: true,
  });
  await expect(settingsToggle).toBeVisible();
  await expect(page.locator("button.fixed.inset-0")).toHaveCount(0);

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  // Once an image is present, the drawer overlay exists but is closed by
  // default (transparent and non-interactive).
  const drawerOverlay = page.locator("button.fixed.inset-0").first();
  await expect(drawerOverlay).toHaveClass(/opacity-0 .*pointer-events-none/);

  // The Summary line under the Settings toggle should be visible.
  await expect(settingsToggle).toBeVisible();
  await expect(page.getByText("Preset:")).toBeVisible();
});

test("E2E-101: Settings toggle opens and closes the drawer on md viewport", async ({
  page,
  testImagesDir,
}, testInfo) => {
  if (testInfo.project.name !== "tablet") {
    test.skip();
  }

  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const settingsToggle = page.getByRole("button", {
    name: "Settings",
    exact: true,
  });
  const drawerOverlay = page.locator("button.fixed.inset-0").first();

  // Drawer starts closed.
  await expect(drawerOverlay).toHaveClass(/opacity-0 .*pointer-events-none/);

  // Open via the Settings toggle button.
  await settingsToggle.click();
  await expect(drawerOverlay).toHaveClass(/opacity-100 .*pointer-events-auto/);
  await expect(
    page.getByRole("button", { name: "Close settings", exact: true }),
  ).toBeVisible();

  // Close via the close button inside the drawer.
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await expect(drawerOverlay).toHaveClass(/opacity-0 .*pointer-events-none/);

  // Open again and close by clicking on the overlay background.
  await settingsToggle.click();
  await expect(drawerOverlay).toHaveClass(/opacity-100 .*pointer-events-auto/);

  const overlayBox = await drawerOverlay.boundingBox();
  if (!overlayBox) throw new Error("Expected settings drawer overlay box");

  await drawerOverlay.click({
    position: {
      // Click near the far right side, outside of the sliding panel.
      x: overlayBox.width - 10,
      y: overlayBox.height / 2,
    },
  });

  await expect(drawerOverlay).toHaveClass(/opacity-0 .*pointer-events-none/);
});

test("E2E-102: lg viewport keeps Settings visible and removes drawer UI", async ({
  page,
  testImagesDir,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  // On lg viewports the Settings panel is always visible as a sidebar and
  // there is no floating Settings toggle or drawer overlay.
  await expect(
    page.getByRole("heading", { level: 2, name: "Settings" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Close settings" }),
  ).toHaveCount(0);

  // Resize down to md to temporarily enable the drawer UI. We don't assert
  // detailed drawer behavior here (covered by E2E-100/101), only that the
  // floating Settings toggle appears.
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();

  // Resize back to lg; Settings sidebar should be visible again with no
  // drawer-specific controls, regardless of previous drawer state.
  await page.setViewportSize({ width: 1280, height: 800 });

  await expect(
    page.getByRole("heading", { level: 2, name: "Settings" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Close settings" }),
  ).toHaveCount(0);
});

test("E2E-110: primary operations are keyboard accessible", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  // PasteArea button should react to keyboard activation (Enter) by opening
  // the file chooser.
  const pasteButton = page.getByRole("button", {
    name: "Paste, drop, or click to select an image",
  });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    pasteButton.press("Enter"),
  ]);

  await fileChooser.setFiles(`${testImagesDir}/screenshot-png.png`);
  await waitForProcessingToFinish(page);

  // Copy and Download buttons are focusable and can be triggered with Enter.
  const copyButton = page.getByRole("button", {
    name: "Copy result image to clipboard",
  });
  await copyButton.focus();
  await copyButton.press("Enter");

  const downloadButton = page.getByRole("link", {
    name: "Download result image",
  });
  await downloadButton.focus();
  await downloadButton.press("Enter");

  // Settings inputs are all focusable via script and respond to keyboard
  // input; detailed numeric behavior is covered in other tests.
  const widthInput = page.getByLabel("Width (px)");
  await widthInput.focus();
  await page.keyboard.type("1000");

  const stripCheckbox = page.getByLabel("Strip metadata (EXIF, etc.)");
  await stripCheckbox.focus();
  await stripCheckbox.press("Space");
});

test("E2E-111: StatusBar ARIA roles and labels match implementation", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  // Trigger processing once so later assertions can assume an image/result is
  // available.
  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  // Trigger a UI error via non-image clipboard paste and confirm ARIA
  // semantics for errors.
  await pastePlainTextToPasteArea(page, "hello from playwright");

  const errorAlert = page.getByRole("alert").filter({
    hasText:
      "No image data found in the clipboard. Please copy an image and try again.",
  });

  await expect(errorAlert).toBeVisible();
  await expect(errorAlert).toHaveAttribute("aria-live", "assertive");

  // With a result image present, key actions expose descriptive aria-labels.
  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const copyButton = page.getByRole("button", {
    name: "Copy result image to clipboard",
  });
  await expect(copyButton).toHaveAttribute(
    "aria-label",
    "Copy result image to clipboard",
  );

  const downloadLink = page.getByRole("link", {
    name: "Download result image",
  });
  await expect(downloadLink).toHaveAttribute(
    "aria-label",
    "Download result image",
  );
});
