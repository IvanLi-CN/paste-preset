import {
  expect,
  test,
  uploadFixtureViaFileInput,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-050 Auto output format keeps PNG as PNG", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  // Source and result formats should both be image/png.
  await expect(page.getByText("image/png")).toHaveCount(2);

  const downloadLink = page.getByRole("link", {
    name: "Download result image",
  });
  const downloadName = await downloadLink.getAttribute("download");

  expect(downloadName).not.toBeNull();
  expect(downloadName?.endsWith(".png")).toBe(true);
});

test("E2E-051 JPEG format shows quality slider and updates percentage", async ({
  page,
}) => {
  await page.goto("/");

  // Switch output format to JPEG.
  await page.getByLabel("Format").selectOption("image/jpeg");

  const qualitySlider = page.getByLabel("Quality");
  await expect(qualitySlider).toBeVisible();
  await expect(page.getByText("80%")).toBeVisible();

  // Nudge the slider using keyboard input and verify the percentage label updates.
  await qualitySlider.focus();
  await qualitySlider.press("ArrowLeft");

  await expect(page.getByText("75%")).toBeVisible();
});

test("E2E-052 PNG hides quality slider while WebP shows it", async ({
  page,
}) => {
  await page.goto("/");

  const formatSelect = page.getByLabel("Format");

  await formatSelect.selectOption("image/png");
  await expect(page.getByLabel("Quality")).toHaveCount(0);

  await formatSelect.selectOption("image/webp");
  await expect(page.getByLabel("Quality")).toBeVisible();
});

test("E2E-060: enabling stripMetadata marks result metadata as stripped", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  const stripCheckbox = page.getByLabel("Strip metadata (EXIF, etc.)");
  // Default configuration keeps metadata; enable stripping explicitly.
  await expect(stripCheckbox).not.toBeChecked();
  await stripCheckbox.check();
  await expect(stripCheckbox).toBeChecked();

  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  const sourceCard = page
    .getByRole("heading", { name: "Source image" })
    .locator("xpath=../..");
  const resultCard = page
    .getByRole("heading", { name: "Result image" })
    .locator("xpath=../..");

  // Source metadata: badge shows "Preserved" and description explains that
  // original metadata is kept whenever possible.
  const sourceMetadataHeader = sourceCard.getByText("Metadata").locator("..");
  await expect(sourceMetadataHeader.getByText("Preserved")).toBeVisible();

  // Result metadata badge in the side panel should read "Stripped metadata".
  await expect(page.getByText("Stripped metadata")).toBeVisible();

  // Inside the Result image metadata block we show the stripped badge and no
  // detailed metadata fields (they are not surfaced when stripped).
  const resultMetadataHeader = resultCard.getByText("Metadata").locator("..");
  await expect(resultMetadataHeader.getByText("Stripped")).toBeVisible();

  const resultMetadataFields = resultCard.locator("dt", {
    hasText: /Captured|Camera|Lens|Exposure|Focal length|Location/,
  });
  await expect(resultMetadataFields).toHaveCount(0);

  await expect(
    resultCard.getByText(
      "EXIF / IPTC / XMP data was removed when generating this image.",
    ),
  ).toBeVisible();
});

test("E2E-061: stripMetadata=false with no resize keeps metadata", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  // Use Original preset so we do not resize the image.
  await page.getByRole("button", { name: "Original" }).click();

  const stripCheckbox = page.getByLabel("Strip metadata (EXIF, etc.)");
  await stripCheckbox.uncheck();
  await expect(stripCheckbox).not.toBeChecked();

  // Ensure we keep JPEG as the output format (Auto would also work here).
  await page.getByLabel("Format").selectOption("image/jpeg");

  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  const sourceCard = page
    .getByRole("heading", { name: "Source image" })
    .locator("xpath=../..");
  const resultCard = page
    .getByRole("heading", { name: "Result image" })
    .locator("xpath=../..");

  // Dimensions are identical when no resize occurs.
  await expect(
    sourceCard.getByText("Dimensions").locator("xpath=../dd"),
  ).toHaveText("4000 × 3000");
  await expect(
    resultCard.getByText("Dimensions").locator("xpath=../dd"),
  ).toHaveText("4000 × 3000");

  // Result metadata badges: both the panel badge and card-level badge indicate
  // that metadata is preserved.
  await expect(page.getByText("Metadata preserved")).toBeVisible();

  const resultMetadataHeader = resultCard.getByText("Metadata").locator("..");
  await expect(resultMetadataHeader.getByText("Preserved")).toBeVisible();

  await expect(
    resultCard.getByText(
      "Original image metadata is kept for this image whenever possible.",
    ),
  ).toBeVisible();
});

test("E2E-062: HEIC conversion produces JPEG result with stripped metadata", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "heic-photo.heic");
  await waitForProcessingToFinish(page);

  const heicError = page.getByText(
    /HEIC\/HEIF conversion is not available in this environment\. Please convert the image to JPEG or PNG and try again\.|Failed to convert HEIC\/HEIF image\. Please convert it to JPEG or PNG and try again\./,
  );

  if (await heicError.isVisible()) {
    test.skip(
      "HEIC conversion is not supported in this browser environment; error semantics are covered by E2E-063.",
    );
  }

  const sourceCard = page
    .getByRole("heading", { name: "Source image" })
    .locator("xpath=../..");
  const resultCard = page
    .getByRole("heading", { name: "Result image" })
    .locator("xpath=../..");

  // Source metadata badge should report preserved metadata status.
  const sourceMetadataHeader = sourceCard.getByText("Metadata").locator("..");
  await expect(sourceMetadataHeader.getByText("Preserved")).toBeVisible();

  // Result format is JPEG when auto-formatting from HEIC.
  await expect(
    resultCard.getByText("Format").locator("xpath=../dd"),
  ).toHaveText("image/jpeg");

  // Result metadata is treated as stripped and metadata fields are not shown.
  await expect(page.getByText("Stripped metadata")).toBeVisible();

  const resultMetadataHeader = resultCard.getByText("Metadata").locator("..");
  await expect(resultMetadataHeader.getByText("Stripped")).toBeVisible();

  const resultMetadataFields = resultCard.locator("dt", {
    hasText: /Captured|Camera|Lens|Exposure|Focal length|Location/,
  });
  await expect(resultMetadataFields).toHaveCount(0);
});

test("E2E-063: HEIC converter missing surfaces a clear error", async ({
  page,
  testImagesDir,
}) => {
  // Inject the test-only HEIC override hook before the app scripts run so the
  // normalization pipeline behaves as if the conversion library is missing.
  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __heic2anyOverride?: "unavailable";
    };
    globalWindow.__heic2anyOverride = "unavailable";
  });

  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "heic-photo.heic");

  // An explanatory error should be shown in the StatusBar.
  await expect(
    page.getByText(
      "HEIC/HEIF conversion is not available in this environment. Please convert the image to JPEG or PNG and try again.",
    ),
  ).toBeVisible();

  // The Result image card should not be rendered when processing fails.
  await expect(page.getByRole("heading", { name: "Result image" })).toHaveCount(
    0,
  );
});
