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
    setIsCopying(true);
    setErrorMessage(null);

    try {
      if (!("clipboard" in navigator) || !("write" in navigator.clipboard)) {
        throw new Error(
          "Clipboard image write is not supported in this browser.",
        );
      }

      const item = new ClipboardItem({ [mimeType]: blob });
      await navigator.clipboard.write([item]);
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
