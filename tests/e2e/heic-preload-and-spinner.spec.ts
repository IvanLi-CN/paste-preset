import { expect, test } from "./_helpers";

test("E2E-090 records cached-shell and interactive startup marks", async ({
  page,
}) => {
  await page.goto("/");

  await page.waitForFunction(() => {
    const globalWindow = window as unknown as {
      __pastePresetMetrics?: {
        appShellVisible?: number;
        appInteractive?: number;
      };
    };

    return (
      typeof globalWindow.__pastePresetMetrics?.appShellVisible === "number" &&
      typeof globalWindow.__pastePresetMetrics?.appInteractive === "number"
    );
  });

  const metrics = await page.evaluate(() => {
    const globalWindow = window as unknown as {
      __pastePresetMetrics?: {
        appShellVisible?: number;
        appInteractive?: number;
      };
    };

    return globalWindow.__pastePresetMetrics ?? {};
  });

  await expect(typeof metrics.appShellVisible).toBe("number");
  await expect(typeof metrics.appInteractive).toBe("number");
  await expect(metrics.appInteractive).toBeGreaterThanOrEqual(
    metrics.appShellVisible ?? 0,
  );
});
