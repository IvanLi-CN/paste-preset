import {
  expect,
  test,
  uploadFixtureViaFileInput,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-090: fullscreen image preview covers the viewport and restores focus", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const sourceCard = page
    .getByRole("heading", { name: "Source image" })
    .locator("xpath=../..");
  const trigger = sourceCard.getByRole("button", { name: "Source image" });

  await trigger.click();

  const dialog = page.locator("dialog.modal");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCount(1);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const modalBox = dialog.locator(".modal-box");
  const modalBoxBounds = await modalBox.boundingBox();
  expect(modalBoxBounds).not.toBeNull();

  expect(
    Math.abs((modalBoxBounds?.width ?? 0) - (viewport?.width ?? 0)),
  ).toBeLessThan(2);
  expect(
    Math.abs((modalBoxBounds?.height ?? 0) - (viewport?.height ?? 0)),
  ).toBeLessThan(2);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("E2E-091: clicking the preview background closes the viewer", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const sourceCard = page
    .getByRole("heading", { name: "Source image" })
    .locator("xpath=../..");
  const trigger = sourceCard.getByRole("button", { name: "Source image" });

  await trigger.click();

  const dialog = page.locator("dialog.modal");
  await expect(dialog).toBeVisible();

  const stage = dialog.locator('section[aria-label="Source image"]');
  const stageBounds = await stage.boundingBox();
  expect(stageBounds).not.toBeNull();

  await page.mouse.click(
    (stageBounds?.x ?? 0) + 5,
    (stageBounds?.y ?? 0) + (stageBounds?.height ?? 0) / 2,
  );

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
