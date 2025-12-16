import {
  expandTaskRow,
  expect,
  getTaskRows,
  test,
  uploadFixtureViaFileInput,
  waitForLatestTaskStatus,
  waitForProcessingToFinish,
} from "./_helpers";

test("E2E-093: HEIC conversion falls back from PNG to JPEG when needed", async ({
  page,
  testImagesDir,
}) => {
  // Force deterministic behavior: make the PNG conversion attempt throw,
  // then succeed for JPEG by returning a tiny valid image blob.
  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __heic2anyOverride?: (options: {
        blob: Blob;
        toType: string;
      }) => Promise<Blob>;
      __heic2anyCalls?: string[];
    };

    globalWindow.__heic2anyCalls = [];

    globalWindow.__heic2anyOverride = async ({ toType }) => {
      globalWindow.__heic2anyCalls?.push(toType);

      if (toType === "image/png") {
        throw new Error("playwright test: png conversion failed");
      }

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(0, 0, 1, 1);
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("playwright test: toBlob failed"));
              return;
            }
            resolve(b);
          },
          toType,
          0.92,
        );
      });

      return blob;
    };
  });

  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "heic-photo.heic");
  await waitForProcessingToFinish(page);

  const taskRow = await waitForLatestTaskStatus(page, "Done");
  await expandTaskRow(taskRow);

  const resultCard = taskRow
    .getByRole("heading", { name: "Result image" })
    .locator("xpath=../..");

  await expect(
    resultCard.getByText("Format").locator("xpath=../dd"),
  ).toHaveText("image/jpeg");

  // No error toast/alert should be shown for this best-effort fallback path.
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Ensure the override was exercised: PNG attempted first, then JPEG.
  const calls = await page.evaluate(() => {
    const globalWindow = window as unknown as {
      __heic2anyCalls?: string[];
    };
    return globalWindow.__heic2anyCalls ?? [];
  });
  await expect(calls).toEqual(["image/png", "image/jpeg"]);

  // Sanity-check: at least one task row exists.
  await expect(getTaskRows(page)).toHaveCount(1);
});
