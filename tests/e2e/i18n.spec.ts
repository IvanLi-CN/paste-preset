import { expect, test } from "./_helpers";

test("i18n-001: defaults to English UI when browser language is en", async ({
  page,
}, testInfo) => {
  test.skip(
    true,
    "i18n Playwright tests are currently experimental and disabled.",
  );

  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  // Force an English browser locale so behavior is stable across environments.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get() {
        return ["en-US", "en"];
      },
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get() {
        return "en-US";
      },
    });
  });

  await page.goto("/");

  // Header title is in English.
  await expect(
    page.getByRole("heading", { level: 1, name: "PastePreset" }),
  ).toBeVisible();

  // Tagline and privacy note use English copy.
  await expect(
    page.getByText(
      "Paste or drop an image, resize and convert it entirely in your browser.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Images stay on this device; no uploads."),
  ).toBeVisible();

  // Language selector shows English as the current language.
  const languageToggle = page
    .locator("button.btn.btn-ghost.btn-sm")
    .filter({ has: page.locator('[data-icon^="circle-flags:"]') });
  await expect(languageToggle).toBeVisible();

  const currentLanguageLabel = await languageToggle
    .locator("span.text-xs")
    .first()
    .textContent();
  expect(currentLanguageLabel?.trim()).toBe("English");
});

test("i18n-002: switching language updates main texts", async ({
  page,
}, testInfo) => {
  test.skip(
    true,
    "i18n Playwright tests are currently experimental and disabled.",
  );

  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  // Start from an English environment so labels and aria attributes are stable.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get() {
        return ["en-US", "en"];
      },
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get() {
        return "en-US";
      },
    });
  });

  await page.goto("/");

  // Open language selector.
  const languageToggle = page
    .locator("button.btn.btn-ghost.btn-sm")
    .filter({ has: page.locator('[data-icon^="circle-flags:"]') });
  await languageToggle.click();

  // Switch to Simplified Chinese.
  await page.getByRole("button", { name: "简体中文" }).click();

  // Main tagline and privacy note should switch to zh-CN.
  await expect(
    page.getByText("粘贴或拖拽图片，在浏览器中完成尺寸调整和格式转换。"),
  ).toBeVisible();
  await expect(page.getByText("图片仅在本地处理，不会上传。")).toBeVisible();

  // Settings panel title should be localized.
  await expect(
    page.getByRole("heading", { level: 2, name: "设置" }),
  ).toBeVisible();

  // Switch to Traditional Chinese (Taiwan) and verify a key text.
  await page.locator('button[aria-label="切换语言"]').click();
  await page.getByRole("button", { name: "繁體中文（台灣）" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "設定" }),
  ).toBeVisible();
  await expect(
    page.getByText("貼上或拖曳圖片，在瀏覽器中完成尺寸調整與格式轉換。"),
  ).toBeVisible();
});

test("i18n-003: selected language is persisted in localStorage", async ({
  page,
}, testInfo) => {
  test.skip(
    true,
    "i18n Playwright tests are currently experimental and disabled.",
  );

  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  // Start from an English environment so initial locale is deterministic.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get() {
        return ["en-US", "en"];
      },
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get() {
        return "en-US";
      },
    });
  });

  await page.goto("/");

  // Change language to zh-CN through the selector.
  const languageToggle = page
    .locator("button.btn.btn-ghost.btn-sm")
    .filter({ has: page.locator('[data-icon^="circle-flags:"]') });
  await languageToggle.click();
  await page.getByRole("button", { name: "简体中文" }).click();

  const storedLocale = await page.evaluate(() =>
    window.localStorage.getItem("pastePreset.locale"),
  );
  expect(storedLocale).toBe("zh-CN");

  // Reload the page; the stored locale should be applied on first paint.
  await page.reload();

  // UI should already be in Simplified Chinese without interacting again.
  await expect(
    page.getByText("粘贴或拖拽图片，在浏览器中完成尺寸调整和格式转换。"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "设置" }),
  ).toBeVisible();

  // Language selector should reflect zh-CN as the current language.
  const zhLanguageToggle = page
    .locator("button.btn.btn-ghost.btn-sm")
    .filter({ has: page.locator('[data-icon^="circle-flags:"]') });
  const currentLanguageLabel = await zhLanguageToggle
    .locator("span.text-xs")
    .first()
    .textContent();
  expect(currentLanguageLabel?.trim()).toBe("简体中文");
});

test("i18n-004: picks zh-TW when browser language prefers Traditional Chinese (Taiwan)", async ({
  page,
}, testInfo) => {
  test.skip(
    true,
    "i18n Playwright tests are currently experimental and disabled.",
  );

  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  // Simulate a browser that prefers Traditional Chinese (Taiwan).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get() {
        return ["zh-TW", "en-US"];
      },
    });

    Object.defineProperty(navigator, "language", {
      configurable: true,
      get() {
        return "zh-TW";
      },
    });
  });

  await page.goto("/");

  // Settings title and tagline should default to zh-TW.
  await expect(
    page.getByRole("heading", { level: 2, name: "設定" }),
  ).toBeVisible();
  await expect(
    page.getByText("貼上或拖曳圖片，在瀏覽器中完成尺寸調整與格式轉換。"),
  ).toBeVisible();

  // Language selector button should reflect zh-TW as the current language.
  const languageToggle = page
    .locator("button.btn.btn-ghost.btn-sm")
    .filter({ has: page.locator('[data-icon^="circle-flags:"]') });
  const currentLanguageLabel = await languageToggle
    .locator("span.text-xs")
    .first()
    .textContent();
  expect(currentLanguageLabel?.trim()).toBe("繁體中文（台灣）");
});
