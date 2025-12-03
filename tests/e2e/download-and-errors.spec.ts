import {
  expect,
  test,
  uploadFixtureViaFileInput,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-080: download link has correct name and extension", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  const uploadAndGetDownloadName = async (fileName: string) => {
    await uploadFixtureViaFileInput(page, testImagesDir, fileName);
    await waitForProcessingToFinish(page);

    const downloadLink = page.getByRole("link", {
      name: "Download result image",
    });

    await expect(downloadLink).toBeVisible();

    const name = await downloadLink.getAttribute("download");
    expect(name).not.toBeNull();
    return name as string;
  };

  // Default auto format with PNG source -> .png extension.
  const pngName = await uploadAndGetDownloadName("screenshot-png.png");
  expect(pngName).toMatch(/^pastepreset-\d{8}-\d{6}\.png$/);

  // JPEG output -> .jpg extension.
  await page.getByLabel("Format").selectOption("image/jpeg");
  const jpegName = await uploadAndGetDownloadName("photo-large-jpeg.jpg");
  expect(jpegName).toMatch(/^pastepreset-\d{8}-\d{6}\.jpg$/);

  // WebP output -> .webp extension.
  await page.getByLabel("Format").selectOption("image/webp");
  const webpName = await uploadAndGetDownloadName("screenshot-png.png");
  expect(webpName).toMatch(/^pastepreset-\d{8}-\d{6}\.webp$/);
});

test("E2E-090: oversized output dimensions produce a clear error", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");

  await widthInput.fill("10000");
  await heightInput.fill("10000");

  await expect(
    page.getByText(
      "The requested output size is too large to process safely. Please choose smaller dimensions or a lower-resolution preset and try again.",
    ),
  ).toBeVisible();

  // After reducing the size, processing should succeed and the error disappear.
  await widthInput.fill("1000");
  await heightInput.fill("1000");
  await waitForProcessingToFinish(page);

  await expect(
    page.getByText(
      "The requested output size is too large to process safely. Please choose smaller dimensions or a lower-resolution preset and try again.",
    ),
  ).toHaveCount(0);
});

test("E2E-091: processing status is shown in preview and status bar", async ({
  page,
  testImagesDir,
}) => {
  // Install a small artificial delay in the processing pipeline so the
  // transient "Processing image…" status is reliably observable even on
  // very fast machines. This uses a test-only hook consumed by
  // useImageProcessor and does not affect production behaviour.
  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __processingDelayMsForTest?: number;
    };
    globalWindow.__processingDelayMsForTest = 200;
  });

  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "very-large.png");

  const previewProcessing = page
    .locator(".alert.alert-warning")
    .filter({ hasText: "Processing image…" });
  const statusProcessing = page
    .getByRole("status")
    .filter({ hasText: "Processing image…" });

  await expect(previewProcessing).toBeVisible();
  await expect(statusProcessing).toBeVisible();

  await waitForProcessingToFinish(page);

  await expect(previewProcessing).toHaveCount(0);
  await expect(statusProcessing).toHaveCount(0);
});
