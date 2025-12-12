import {
  expandTaskRow,
  expect,
  getImageCardDimensionsText,
  getTaskDownloadLink,
  getTaskRows,
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

    const latestTask = getTaskRows(page).last();
    await expect(latestTask).toBeVisible();
    await expect(latestTask.getByText(fileName)).toBeVisible();

    const downloadLink = getTaskDownloadLink(latestTask);
    await expect(downloadLink).toBeVisible();

    const name = await downloadLink.getAttribute("download");
    expect(name).not.toBeNull();
    return name as string;
  };

  // Default auto format with PNG source keeps original name/extension.
  const pngName = await uploadAndGetDownloadName("screenshot-png.png");
  expect(pngName).toBe("screenshot-png.png");

  // JPEG output -> .jpg extension while preserving base name.
  await page.getByLabel("Format").selectOption("image/jpeg");
  const jpegName = await uploadAndGetDownloadName("photo-large-jpeg.jpg");
  expect(jpegName).toBe("photo-large-jpeg.jpg");

  // WebP output -> .webp extension.
  await page.getByLabel("Format").selectOption("image/webp");
  const webpName = await uploadAndGetDownloadName("screenshot-png.png");
  expect(webpName).toBe("screenshot-png.webp");

  // Download all should emit a batch ZIP when at least one task is done.
  const downloadAllButton = page.getByRole("button", { name: "Download all" });
  await expect(downloadAllButton).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadAllButton.click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^pastepreset-batch-\d{8}-\d{6}\.zip$/,
  );
});

test("E2E-090: oversized output dimensions produce a clear error", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");

  await widthInput.fill("10000");
  await heightInput.fill("10000");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const errorRow = getTaskRows(page).last();
  await expect(errorRow.getByText("Error")).toBeVisible();
  await expect(
    errorRow.getByText(
      "The requested output size is too large to process safely. Please choose smaller dimensions or a lower-resolution preset and try again.",
    ),
  ).toBeVisible();

  // After reducing the size, a new task should succeed.
  await widthInput.fill("1000");
  await heightInput.fill("1000");
  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const successRow = getTaskRows(page).last();
  await expect(successRow.getByText("Done")).toBeVisible();
  await expandTaskRow(successRow);
  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
    successRow,
  );
  expect(resultDimensions).toBe("1000 × 1000");
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

  const tasks = getTaskRows(page);
  await expect(tasks).toHaveCount(1);

  const statusProcessing = page
    .getByRole("status")
    .filter({ hasText: "Processing image…" });

  await expect(statusProcessing).toBeVisible();

  await waitForProcessingToFinish(page);

  await expect(statusProcessing).toHaveCount(0);
  await expect(
    getTaskRows(page).first().getByText("Done", { exact: false }),
  ).toBeVisible();
});
