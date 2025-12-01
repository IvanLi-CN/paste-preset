import {
  disableClipboardAPI,
  expect,
  getClipboardWriteCallCount,
  makeClipboardWriteFail,
  setupClipboardWriteSpy,
  test,
  uploadFixtureViaFileInput,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-070: copy button uses clipboard API when available", async ({
  page,
  testImagesDir,
}) => {
  await setupClipboardWriteSpy(page);
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const copyButton = page.getByRole("button", {
    name: "Copy result image to clipboard",
  });

  await copyButton.click();

  // Copy completes without surfacing an error in the StatusBar.
  await expect(page.getByRole("alert")).toHaveCount(0);

  const callCount = await getClipboardWriteCallCount(page);
  expect(callCount).toBe(1);
});

test("E2E-071: Ctrl/Cmd+C on copy button triggers clipboard write", async ({
  page,
  testImagesDir,
}) => {
  await setupClipboardWriteSpy(page);
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const copyButton = page.getByRole("button", {
    name: "Copy result image to clipboard",
  });
  await copyButton.focus();

  await page.keyboard.press("Control+C");

  const callCount = await getClipboardWriteCallCount(page);
  expect(callCount).toBeGreaterThanOrEqual(1);
});

test("E2E-072: global Ctrl/Cmd+C copies result image", async ({
  page,
  testImagesDir,
}) => {
  await setupClipboardWriteSpy(page);
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  // Focus a non-input element so global shortcuts are eligible.
  await page.locator("body").click();

  // Dispatch a global Ctrl/Cmd+C keydown so the window-level shortcut handler
  // runs regardless of which element is currently focused.
  await page.evaluate(() => {
    const target = document.body;

    const event = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      metaKey: false,
      bubbles: true,
    });
    target.dispatchEvent(event);
  });

  const callCount = await getClipboardWriteCallCount(page);
  expect(callCount).toBe(1);
});

test("E2E-073: Ctrl/Cmd+C inside inputs does not trigger image copy", async ({
  page,
  testImagesDir,
}) => {
  await setupClipboardWriteSpy(page);
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const widthInput = page.getByLabel("Width (px)");
  await widthInput.fill("1234");
  await widthInput.selectText();

  await page.keyboard.press("Control+C");

  const callCount = await getClipboardWriteCallCount(page);
  expect(callCount).toBe(0);
});

test("E2E-074: clipboard API unavailable shows fallback error", async ({
  page,
  testImagesDir,
}) => {
  await disableClipboardAPI(page);
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const copyButton = page.getByRole("button", {
    name: "Copy result image to clipboard",
  });
  await copyButton.click();

  await expect(
    page.getByText(
      "Clipboard image write is not supported in this browser. Please use your browser's context menu (for example, right-click → Copy image) to copy the result manually.",
    ),
  ).toBeVisible();

  // Result image should still be present after the failure.
  await expect(
    page.getByRole("heading", { name: "Result image" }),
  ).toBeVisible();
});

test("E2E-092: explicit clipboard write failure surfaces error message", async ({
  page,
  testImagesDir,
}) => {
  await makeClipboardWriteFail(page);
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const copyButton = page.getByRole("button", {
    name: "Copy result image to clipboard",
  });
  await copyButton.click();

  const errorAlert = page
    .getByRole("alert")
    .filter({ hasText: "playwright test error" });

  await expect(errorAlert).toBeVisible();
});
