import path from "node:path";
import {
  dropFixtureOnPasteArea,
  expandTaskRow,
  expect,
  getImageCardDimensionsText,
  getTaskRows,
  pasteFixtureImageFromClipboard,
  pastePlainTextToPasteArea,
  test,
  waitForLatestTaskStatus,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-010 paste PNG from clipboard (happy path)", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await pasteFixtureImageFromClipboard(
    page,
    testImagesDir,
    "screenshot-png.png",
    "image/png",
  );

  await waitForProcessingToFinish(page);

  const taskRow = await waitForLatestTaskStatus(page, "Done");
  await expect(taskRow).toBeVisible();
  await expandTaskRow(taskRow);

  // Source and result cards should be visible within the task detail.
  const sourceCard = taskRow.getByRole("heading", { name: "Source image" });
  const resultCard = taskRow.getByRole("heading", { name: "Result image" });

  await expect(sourceCard).toBeVisible();
  await expect(resultCard).toBeVisible();

  // Dimensions and format text are rendered in the card body.
  await expect(taskRow.getByText("800 × 600")).toHaveCount(2);
  await expect(taskRow.getByText("image/png")).toHaveCount(2);

  // PasteArea label updates when an image is present.
  await expect(
    page.getByRole("button", {
      name: "Paste, drop, or click to replace the current image",
    }),
  ).toBeVisible();
});

test("E2E-011 paste non-image clipboard data on PasteArea", async ({
  page,
}) => {
  await page.goto("/");

  const pasteButton = page.getByRole("button", {
    name: "Paste, drop, or click to select an image",
  });
  await pasteButton.focus();

  await pastePlainTextToPasteArea(page, "hello from playwright");

  // Should not enter processing state; instead show the specific error message.
  await expect(
    page.getByText(
      "No image data found in the clipboard. Please copy an image and try again.",
    ),
  ).toBeVisible();

  // TasksPanel should still show the initial info banner (no tasks).
  await expect(
    page.getByText(
      "Paste, drop, or select an image to see the original and processed previews here.",
    ),
  ).toBeVisible();
  await expect(getTaskRows(page)).toHaveCount(0);
});

test("E2E-012 drag and drop PNG onto PasteArea", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await dropFixtureOnPasteArea(
    page,
    testImagesDir,
    "screenshot-png.png",
    "image/png",
  );

  await waitForProcessingToFinish(page);

  const taskRow = await waitForLatestTaskStatus(page, "Done");
  await expect(taskRow).toBeVisible();
  await expandTaskRow(taskRow);
  await expect(
    taskRow.getByRole("heading", { name: "Source image" }),
  ).toBeVisible();
  await expect(
    taskRow.getByRole("heading", { name: "Result image" }),
  ).toBeVisible();

  // StatusBar should not show any error message.
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("E2E-013 drag and drop non-image file shows error", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await dropFixtureOnPasteArea(
    page,
    testImagesDir,
    "non-image.txt",
    "text/plain",
  );

  await expect(
    page.getByText("Please paste or drop an image file."),
  ).toBeVisible();

  // No image cards should be rendered.
  await expect(getTaskRows(page)).toHaveCount(0);
});

test("E2E-014 select PNG via file chooser", async ({ page, testImagesDir }) => {
  await page.goto("/");

  const pasteButton = page.getByRole("button", {
    name: "Paste, drop, or click to select an image",
  });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    pasteButton.click(),
  ]);

  await fileChooser.setFiles(path.join(testImagesDir, "screenshot-png.png"));

  await waitForProcessingToFinish(page);

  const taskRow = await waitForLatestTaskStatus(page, "Done");
  await expect(taskRow).toBeVisible();
  await expandTaskRow(taskRow);
  await expect(
    taskRow.getByRole("heading", { name: "Source image" }),
  ).toBeVisible();
  await expect(
    taskRow.getByRole("heading", { name: "Result image" }),
  ).toBeVisible();
});

test("E2E-015 selecting a new image replaces the previous one", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  const initialPasteButton = page.getByRole("button", {
    name: "Paste, drop, or click to select an image",
  });

  // First load a PNG.
  const [firstChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    initialPasteButton.click(),
  ]);
  await firstChooser.setFiles(path.join(testImagesDir, "screenshot-png.png"));

  await waitForProcessingToFinish(page);

  // Then choose a JPEG; in multi-task mode this appends a new task.
  const replaceButton = page.getByRole("button", {
    name: "Paste, drop, or click to replace the current image",
  });

  const [secondChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    replaceButton.click(),
  ]);
  await secondChooser.setFiles(
    path.join(testImagesDir, "photo-large-jpeg.jpg"),
  );

  await waitForProcessingToFinish(page);

  await waitForLatestTaskStatus(page, "Done");

  const tasks = getTaskRows(page);
  await expect(tasks).toHaveCount(2);

  const firstTask = tasks.first();
  const latestTask = tasks.last();

  // Old task remains with PNG result.
  await expandTaskRow(firstTask);
  await expect(firstTask.getByText("Done")).toBeVisible();
  await expect(firstTask.getByText("image/png").first()).toBeVisible();

  // Latest task reflects the new JPEG image and sits at the end of the list.
  await expandTaskRow(latestTask);
  await expect(latestTask.getByText("image/jpeg").first()).toBeVisible();
  const latestDimensions = await getImageCardDimensionsText(
    page,
    "Source image",
    latestTask,
  );
  expect(latestDimensions).toBe("4000 × 3000");

  await expect(
    page.getByRole("button", {
      name: "Paste, drop, or click to replace the current image",
    }),
  ).toBeVisible();
});
