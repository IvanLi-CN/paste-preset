import {
  expandTaskRow,
  expect,
  getTaskDownloadLink,
  getTaskRows,
  pasteFixtureImageFromClipboard,
  test,
  uploadFixtureViaFileInput,
  waitForProcessingToFinish,
} from "./_helpers";

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function countOccurrences(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0 || haystack.length < needle.length) return 0;
  let count = 0;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) count += 1;
  }
  return count;
}

async function fetchResultBytes(page: import("@playwright/test").Page) {
  const taskRow = getTaskRows(page).first();
  const downloadLink = getTaskDownloadLink(taskRow);
  const href = await downloadLink.getAttribute("href");
  expect(href).not.toBeNull();

  const bytes = await page.evaluate(async (url) => {
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    return Array.from(new Uint8Array(ab));
  }, href);

  return new Uint8Array(bytes);
}

test("E2E-070: animated GIF keeps GIF output with Auto format", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await uploadFixtureViaFileInput(page, testImagesDir, "animated-2f.gif");
  await waitForProcessingToFinish(page);

  const taskRow = getTaskRows(page).first();
  await expect(taskRow.getByText("Done")).toBeVisible();

  // Source and result formats should both be image/gif.
  await expect(taskRow.getByText("image/gif")).toHaveCount(2);

  const bytes = await fetchResultBytes(page);
  expect(ascii(bytes, 0, 6)).toMatch(/^GIF(87a|89a)$/);

  // Each GIF frame typically has a Graphics Control Extension (GCE) block.
  // Ensure we see at least two, i.e. an actual animation.
  const gce = new Uint8Array([0x21, 0xf9, 0x04]);
  expect(countOccurrences(bytes, gce)).toBeGreaterThanOrEqual(2);

  const downloadName =
    await getTaskDownloadLink(taskRow).getAttribute("download");
  expect(downloadName).not.toBeNull();
  expect(downloadName?.endsWith(".gif")).toBe(true);
});

test("E2E-071: animated GIF converts to animated WebP", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await page.getByLabel("Format").selectOption("image/webp");

  await uploadFixtureViaFileInput(page, testImagesDir, "animated-2f.gif");
  await waitForProcessingToFinish(page);

  const taskRow = getTaskRows(page).first();
  await expect(taskRow.getByText("Done")).toBeVisible();
  await expect(taskRow.getByText("image/webp")).toBeVisible();

  const bytes = await fetchResultBytes(page);
  expect(ascii(bytes, 0, 4)).toBe("RIFF");
  expect(ascii(bytes, 8, 12)).toBe("WEBP");

  // Animated WebP uses ANIM/ANMF chunks.
  const anim = new Uint8Array([0x41, 0x4e, 0x49, 0x4d]); // "ANIM"
  const anmf = new Uint8Array([0x41, 0x4e, 0x4d, 0x46]); // "ANMF"
  expect(
    countOccurrences(bytes, anim) + countOccurrences(bytes, anmf),
  ).toBeGreaterThanOrEqual(1);

  const downloadName =
    await getTaskDownloadLink(taskRow).getAttribute("download");
  expect(downloadName).not.toBeNull();
  expect(downloadName?.endsWith(".webp")).toBe(true);
});

test("E2E-072: animated GIF converts to APNG (PNG container)", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  await page.getByLabel("Format").selectOption("image/apng");

  await uploadFixtureViaFileInput(page, testImagesDir, "animated-2f.gif");
  await waitForProcessingToFinish(page);

  const taskRow = getTaskRows(page).first();
  await expect(taskRow.getByText("Done")).toBeVisible();
  await expect(taskRow.getByText("image/apng")).toBeVisible();

  const bytes = await fetchResultBytes(page);
  // PNG signature
  expect(bytes.slice(0, 8)).toEqual(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  // APNG requires an animation control chunk.
  const actl = new Uint8Array([0x61, 0x63, 0x54, 0x4c]); // "acTL"
  expect(countOccurrences(bytes, actl)).toBeGreaterThanOrEqual(1);

  // We intentionally use .png extension for APNG to maximize compatibility.
  const downloadName =
    await getTaskDownloadLink(taskRow).getAttribute("download");
  expect(downloadName).not.toBeNull();
  expect(downloadName?.endsWith(".png")).toBe(true);
});

test("E2E-073: mislabelled animated WebP still previews and keeps WebP output", async ({
  page,
  testImagesDir,
}) => {
  await page.goto("/");

  // Some sites (e.g. CDN-transcoded images) may be copied with a misleading
  // MIME type (such as image/avif) even when the underlying bytes are WebP.
  await pasteFixtureImageFromClipboard(
    page,
    testImagesDir,
    "animated-2f.webp",
    "image/avif",
  );
  await waitForProcessingToFinish(page);

  const taskRow = getTaskRows(page).first();
  await expect(taskRow.getByText("Done")).toBeVisible();

  await expandTaskRow(taskRow);

  const sourceCard = taskRow
    .getByRole("heading", { name: "Source image" })
    .locator("xpath=../..");
  await expect(sourceCard.getByText("image/webp")).toBeVisible();

  const sourceDecoded = await sourceCard.locator("img").evaluate((img) => {
    const el = img as HTMLImageElement;
    return el.complete && el.naturalWidth > 0;
  });
  expect(sourceDecoded).toBe(true);

  const resultCard = taskRow
    .getByRole("heading", { name: "Result image" })
    .locator("xpath=../..");
  await expect(resultCard.getByText("image/webp")).toBeVisible();

  const resultDecoded = await resultCard.locator("img").evaluate((img) => {
    const el = img as HTMLImageElement;
    return el.complete && el.naturalWidth > 0;
  });
  expect(resultDecoded).toBe(true);
});
