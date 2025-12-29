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

  const copyButton = page.getByTestId("task-copy").first();

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

  const copyButton = page.getByTestId("task-copy").first();
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

  // Ensure the latest task is expanded/active and has an exportable result
  // before dispatching the global shortcut (helps avoid timing flakiness in CI).
  await expect(page.getByTestId("task-row").first()).toHaveClass(
    /collapse-open/,
  );
  await expect(page.getByTestId("task-copy").first()).toBeEnabled();

  // Focus a non-input element so global shortcuts are eligible.
  await page.getByTestId("task-toggle").first().focus();

  // Trigger Ctrl/Cmd+C via Playwright's keyboard API so the browser treats it as
  // a real user shortcut (more reliable than synthetic DOM events in CI).
  await page.keyboard.press("Control+C");

  await expect
    .poll(() => getClipboardWriteCallCount(page), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);
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

  const copyButton = page.getByTestId("task-copy").first();
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

  const copyButton = page.getByTestId("task-copy").first();
  await copyButton.click();

  const errorAlert = page
    .getByRole("alert")
    .filter({ hasText: "playwright test error" });

  await expect(errorAlert).toBeVisible();
});
