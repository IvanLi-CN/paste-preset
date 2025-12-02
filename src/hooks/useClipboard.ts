import { useCallback, useState } from "react";
import { useTranslation } from "../i18n";

export interface ClipboardState {
  isCopying: boolean;
  errorMessage: string | null;
  copyImage: (blob: Blob, mimeType: string) => Promise<void>;
  resetError: () => void;
}

export function useClipboard(): ClipboardState {
  const [isCopying, setIsCopying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  const copyImage = useCallback(
    async (blob: Blob, mimeType: string) => {
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
          setErrorMessage(t("clipboard.error.unsupported"));
          return;
        }

        const writeImage = async (
          clipboardBlob: Blob,
          clipboardType: string,
        ) => {
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
            lower.includes("not supported on write") &&
            lower.includes("image/");

          // If this isn't a "type not supported" error, surface it as-is.
          if (!unsupportedType) {
            throw error;
          }
        }

        // Fallback path: convert to PNG (which is most widely supported) and retry.
        if (typeof createImageBitmap === "undefined") {
          throw new Error("clipboard.formatUnsupported");
        }

        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("clipboard.prepareFailed");
        }

        context.drawImage(bitmap, 0, 0);

        const pngBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (!b) {
              reject(new Error("clipboard.convertFailed"));
              return;
            }
            resolve(b);
          }, "image/png");
        });

        await writeImage(pngBlob, "image/png");
      } catch (error) {
        if (error instanceof Error) {
          let handled = false;
          switch (error.message) {
            case "clipboard.formatUnsupported":
              setErrorMessage(t("clipboard.error.formatUnsupported"));
              handled = true;
              break;
            case "clipboard.prepareFailed":
              setErrorMessage(t("clipboard.error.prepareFailed"));
              handled = true;
              break;
            case "clipboard.convertFailed":
              setErrorMessage(t("clipboard.error.convertFailed"));
              handled = true;
              break;
            default:
              break;
          }

          if (!handled) {
            const message =
              error instanceof Error
                ? error.message
                : t("clipboard.error.generic");
            setErrorMessage(message);
          }
        } else {
          setErrorMessage(t("clipboard.error.generic"));
        }
      } finally {
        setIsCopying(false);
      }
    },
    [t],
  );

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
