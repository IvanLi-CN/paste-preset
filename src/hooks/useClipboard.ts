import { useCallback, useState } from "react";

export interface ClipboardState {
  isCopying: boolean;
  errorMessage: string | null;
  copyImage: (blob: Blob, mimeType: string) => Promise<void>;
  resetError: () => void;
}

export function useClipboard(): ClipboardState {
  const [isCopying, setIsCopying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copyImage = useCallback(async (blob: Blob, mimeType: string) => {
    const globalWithFlags = globalThis as typeof globalThis & {
      /**
       * Test-only flag used by Playwright E2E tests to force the
       * "clipboard not supported" branch without relying on fragile
       * monkey-patching of `navigator.clipboard`. When unset, runtime
       * behavior is identical to the original implementation.
       */
      __forceClipboardUnsupportedForTest?: boolean;
    };

    setIsCopying(true);
    setErrorMessage(null);

    try {
      const hasClipboard =
        "clipboard" in navigator && navigator.clipboard != null;
      const hasWrite = hasClipboard && "write" in navigator.clipboard;

      if (
        globalWithFlags.__forceClipboardUnsupportedForTest ||
        !hasClipboard ||
        !hasWrite
      ) {
        throw new Error(
          "Clipboard image write is not supported in this browser. Please use your browser's context menu (for example, right-click → Copy image) to copy the result manually.",
        );
      }

      const writeImage = async (clipboardBlob: Blob, clipboardType: string) => {
        const item = new ClipboardItem({ [clipboardType]: clipboardBlob });
        await navigator.clipboard.write([item]);
      };

      // First, try writing with the requested MIME type.
      try {
        await writeImage(blob, mimeType);
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "");
        const lower = message.toLowerCase();
        const unsupportedType =
          lower.includes("not supported on write") && lower.includes("image/");

        // If this isn't a "type not supported" error, surface it as-is.
        if (!unsupportedType) {
          throw error;
        }
      }

      // Fallback path: convert to PNG (which is most widely supported) and retry.
      if (typeof createImageBitmap === "undefined") {
        throw new Error(
          "Copying this image format is not supported in this browser. Please use your browser's context menu (for example, right-click → Copy image) to copy the result manually.",
        );
      }

      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to prepare image for clipboard.");
      }

      context.drawImage(bitmap, 0, 0);

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (!b) {
            reject(new Error("Failed to convert image for clipboard."));
            return;
          }
          resolve(b);
        }, "image/png");
      });

      await writeImage(pngBlob, "image/png");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to copy image";
      setErrorMessage(message);
    } finally {
      setIsCopying(false);
    }
  }, []);

  const resetError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {
    isCopying,
    errorMessage,
    copyImage,
    resetError,
  };
}
