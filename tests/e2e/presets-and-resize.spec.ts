import {
  expect,
  getImageCardDimensionsText,
  test,
  uploadFixtureViaFileInput,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-020 default medium preset resizes large JPEG", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  const sourceDimensions = await getImageCardDimensionsText(
    page,
    "Source image",
  );
  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );

  expect(sourceDimensions).toBe("4000 × 3000");
  expect(resultDimensions).toBe("1280 × 960");

  await expect(page.getByText("Resized to 1280 × 960")).toBeVisible();
});

test("E2E-021 Original preset keeps original dimensions", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Original" }).click();

  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  const sourceDimensions = await getImageCardDimensionsText(
    page,
    "Source image",
  );
  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );

  expect(sourceDimensions).toBe("4000 × 3000");
  expect(resultDimensions).toBe("4000 × 3000");

  await expect(page.getByText("Original size")).toBeVisible();
  await expect(page.getByText("image/jpeg")).toHaveCount(2);
});

test("E2E-022 switching preset reprocesses existing image", async ({
  page,
  testImagesDir,
}, testInfo) => {
  if (testInfo.project.name === "tablet") {
    test.skip();
  }
  await page.goto("/");

  // Start from Original preset with loaded image.
  await page.getByRole("button", { name: "Original" }).click();
  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  // Switch to Small preset to trigger reprocessing.
  await page.getByRole("button", { name: "Small" }).click();
  await waitForProcessingToFinish(page);

  const sourceDimensions = await getImageCardDimensionsText(
    page,
    "Source image",
  );
  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );

  expect(sourceDimensions).toBe("4000 × 3000");
  expect(resultDimensions).toBe("800 × 600");
  await expect(page.getByText("Resized to 800 × 600")).toBeVisible();
});

test("E2E-030 lock aspect ratio updates height when width changes", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");
  const lockToggle = page.getByLabel("Lock aspect ratio");

  await expect(lockToggle).toBeChecked();

  await widthInput.fill("1000");

  await expect(heightInput).toHaveValue("750");

  await waitForProcessingToFinish(page);

  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );
  expect(resultDimensions).toBe("1000 × 750");
});

test("E2E-031 unlocked aspect ratio keeps independent width and height", async ({
  page,
  testImagesDir,
}, testInfo) => {
  if (testInfo.project.name === "tablet") {
    test.skip();
  }
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "screenshot-png.png");
  await waitForProcessingToFinish(page);

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");
  const lockToggle = page.getByLabel("Lock aspect ratio");

  await lockToggle.click();
  await expect(lockToggle).not.toBeChecked();

  await widthInput.fill("1000");
  await heightInput.fill("300");

  await waitForProcessingToFinish(page);

  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );
  expect(resultDimensions).toBe("1000 × 300");
});

test("E2E-032 width input does not auto-fill height when no image", async ({
  page,
}) => {
  await page.goto("/");

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");
  const lockToggle = page.getByLabel("Lock aspect ratio");

  await expect(lockToggle).toBeChecked();

  await widthInput.fill("1000");

  await expect(heightInput).toHaveValue("");
});

test("E2E-040 Fit mode keeps result within target box", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");

  await widthInput.fill("800");
  await heightInput.fill("600");

  await waitForProcessingToFinish(page);

  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );
  expect(resultDimensions).toBe("800 × 600");
  await expect(page.getByText("Resized to 800 × 600")).toBeVisible();
});

test("E2E-041 Fill mode outputs exact target dimensions", async ({
  page,
  testImagesDir,
}, testInfo) => {
  if (testInfo.project.name === "tablet") {
    test.skip();
  }
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");

  await widthInput.fill("800");
  await heightInput.fill("600");

  await page.getByRole("button", { name: "Fill (crop)" }).click();
  await waitForProcessingToFinish(page);

  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );
  expect(resultDimensions).toBe("800 × 600");
  await expect(page.getByText("Resized to 800 × 600")).toBeVisible();
});

test("E2E-042 Stretch mode outputs exact target dimensions", async ({
  page,
  testImagesDir,
}, testInfo) => {
  if (testInfo.project.name === "tablet") {
    test.skip();
  }
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "photo-large-jpeg.jpg");
  await waitForProcessingToFinish(page);

  const widthInput = page.getByLabel("Width (px)");
  const heightInput = page.getByLabel("Height (px)");

  await widthInput.fill("800");
  await heightInput.fill("600");

  await page.getByRole("button", { name: "Stretch" }).click();
  await waitForProcessingToFinish(page);

  const resultDimensions = await getImageCardDimensionsText(
    page,
    "Result image",
  );
  expect(resultDimensions).toBe("800 × 600");
  await expect(page.getByText("Resized to 800 × 600")).toBeVisible();
});
