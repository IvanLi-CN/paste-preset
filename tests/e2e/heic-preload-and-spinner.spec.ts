import { expect, test } from "./_helpers";

test("E2E-090 preloads HEIC converter after initial render", async ({
  page,
}) => {
  await page.goto("/");

  await page.waitForFunction(() => {
    const globalWindow = window as unknown as {
      __heicPreloadTriggered?: boolean;
    };
    return globalWindow.__heicPreloadTriggered === true;
  });

  const wasTriggered = await page.evaluate(() => {
    const globalWindow = window as unknown as {
      __heicPreloadTriggered?: boolean;
    };
    return Boolean(globalWindow.__heicPreloadTriggered);
  });

  await expect(wasTriggered).toBe(true);
});
