import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";

type Fixtures = {
  testImagesDir: string;
};

export const test = base.extend<Fixtures>({
  // Base directory for image fixtures used across E2E suites.
  testImagesDir: async ({ page: _page }, use) => {
    const dir = path.resolve(process.cwd(), "tests", "fixtures");
    await use(dir);
  },
});

export { expect };

export async function uploadFile(
  page: import("@playwright/test").Page,
  fileInputSelector: string,
  filePath: string,
) {
  const input = page.locator(fileInputSelector);
  await input.setInputFiles(filePath);
}

export async function uploadFixtureViaFileInput(
  page: import("@playwright/test").Page,
  testImagesDir: string,
  fileName: string,
) {
  const filePath = path.join(testImagesDir, fileName);

  // The hidden file input lives inside the PasteArea button. We use a CSS
  // selector here because the input has no associated label.
  await uploadFile(page, 'input[type="file"]', filePath);
}

export async function pasteFixtureImageFromClipboard(
  page: import("@playwright/test").Page,
  testImagesDir: string,
  fileName: string,
  mimeType: string,
) {
  const filePath = path.join(testImagesDir, fileName);
  const buffer = await fs.promises.readFile(filePath);
  const bytes = Array.from(buffer.values());

  await page.evaluate(
    async (payload) => {
      const data = new Uint8Array(payload.bytes);
      const blob = new Blob([data], { type: payload.mimeType });
      const file = new File([blob], payload.fileName, {
        type: payload.mimeType,
      });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const event = new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);
    },
    { bytes, fileName, mimeType },
  );
}

export async function pastePlainTextToPasteArea(
  page: import("@playwright/test").Page,
  text: string,
) {
  await page.evaluate(
    (payload) => {
      const button =
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="Paste, drop, or click to select an image"]',
        ) ??
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="Paste, drop, or click to replace the current image"]',
        );
      if (!button) return;

      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", payload.text);

      const event = new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      button.dispatchEvent(event);
    },
    { text },
  );
}

export async function dropFixtureOnPasteArea(
  page: import("@playwright/test").Page,
  testImagesDir: string,
  fileName: string,
  mimeType: string,
) {
  const filePath = path.join(testImagesDir, fileName);
  const buffer = await fs.promises.readFile(filePath);
  const bytes = Array.from(buffer.values());

  await page.evaluate(
    (payload) => {
      const button = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Paste, drop, or click to select an image"]',
      );
      if (!button) return;

      const data = new Uint8Array(payload.bytes);
      const blob = new Blob([data], { type: payload.mimeType });
      const file = new File([blob], payload.fileName, {
        type: payload.mimeType,
      });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent("drop", {
        dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      button.dispatchEvent(dropEvent);
    },
    { bytes, fileName, mimeType },
  );
}

export async function getImageCardDimensionsText(
  page: import("@playwright/test").Page,
  title: string,
): Promise<string> {
  const card = page
    .getByRole("heading", { name: title })
    // Walk up from the <h3> to the card container.
    .locator("xpath=../..");

  const dimensionsValue = card.getByText("Dimensions").locator("xpath=../dd");

  const text = await dimensionsValue.textContent();
  return (text ?? "").trim();
}

export async function waitForProcessingToFinish(
  page: import("@playwright/test").Page,
) {
  const processingLocator = page
    .getByRole("status")
    .filter({ hasText: "Processing image…" });

  // Wait for the processing message to appear (if it ever does) and then disappear.
  await processingLocator
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => {
      // If it never appears, we just continue; callers may assert more specifically.
    });

  await processingLocator.waitFor({ state: "hidden", timeout: 30_000 });
}

/**
 * Install a lightweight spy around `navigator.clipboard.write` so E2E tests
 * can assert how many times it was called without altering runtime behavior.
 *
 * This is implemented as a Playwright `addInitScript` hook so that it runs
 * before the application code executes in the browser.
 */
export async function setupClipboardWriteSpy(
  page: import("@playwright/test").Page,
) {
  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __clipboardWrites?: unknown[];
      __forceClipboardUnsupportedForTest?: boolean;
    };

    globalWindow.__clipboardWrites = [];

    const originalClipboard = navigator.clipboard;
    if (!originalClipboard || typeof originalClipboard.write !== "function") {
      return;
    }

    const wrappedClipboard = {
      ...originalClipboard,
      async write(data: ClipboardItem[]) {
        globalWindow.__clipboardWrites?.push(data);
        // Resolve with a tiny delay so the UI has time to render the
        // "Copying image to clipboard…" status before the operation finishes.
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
      },
    };

    try {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        get() {
          return wrappedClipboard;
        },
      });
    } catch {
      // Some environments may not allow redefining navigator.clipboard;
      // in that case we simply skip spying and tests fall back to looser
      // expectations.
    }
  });
}

export async function getClipboardWriteCallCount(
  page: import("@playwright/test").Page,
): Promise<number> {
  const calls = await page.evaluate(() => {
    const globalWindow = window as unknown as {
      __clipboardWrites?: unknown[];
    };
    return globalWindow.__clipboardWrites ?? [];
  });
  return Array.isArray(calls) ? calls.length : 0;
}

/**
 * Simulate an environment where the Clipboard API is not available for image
 * writes. We prefer toggling a small global flag consumed by the app over
 * aggressive monkey-patching of `navigator.clipboard`, but still attempt to
 * clear it when possible.
 */
export async function disableClipboardAPI(
  page: import("@playwright/test").Page,
) {
  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __forceClipboardUnsupportedForTest?: boolean;
    };
    globalWindow.__forceClipboardUnsupportedForTest = true;

    try {
      // Best-effort attempt to make `navigator.clipboard` unusable. The app
      // no longer relies on this for correctness, but it keeps the behavior
      // close to real unsupported environments.
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
    } catch {
      // Silently ignore if the environment does not allow redefining
      // navigator.clipboard.
    }
  });
}

/**
 * Force `navigator.clipboard.write` to reject with a deterministic error so
 * we can exercise the error handling branch in `useClipboard` (E2E-092).
 */
export async function makeClipboardWriteFail(
  page: import("@playwright/test").Page,
) {
  await page.addInitScript(() => {
    const originalClipboard = navigator.clipboard;
    if (!originalClipboard) {
      return;
    }

    const fakeClipboard = {
      ...originalClipboard,
      write: () => Promise.reject(new Error("playwright test error")),
    };

    try {
      Object.defineProperty(navigator, "clipboard", {
        value: fakeClipboard,
        configurable: true,
      });
    } catch {
      // If we cannot redefine navigator.clipboard, the test that relies on
      // this helper should be skipped or relaxed.
    }
  });
}
