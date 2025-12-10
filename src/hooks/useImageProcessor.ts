import { useCallback, useEffect, useState } from "react";
import type { TranslationKey } from "../i18n";
import { useTranslation } from "../i18n";
import { processImageViaWorker } from "../lib/imageWorkerClient.ts";
import type { AppStatus, ImageInfo, ProcessingOptions } from "../lib/types.ts";

export interface UseImageProcessorResult {
  status: AppStatus;
  errorMessage: string | null;
  source: ImageInfo | null;
  result: ImageInfo | null;
  processBlob: (blob: Blob, sourceName?: string) => Promise<void>;
  resetError: () => void;
}

export function useImageProcessor(
  options: ProcessingOptions,
): UseImageProcessorResult {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AppStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [original, setOriginal] = useState<{
    blob: Blob;
    sourceName?: string;
  } | null>(null);
  const [source, setSource] = useState<ImageInfo | null>(null);
  const [result, setResult] = useState<ImageInfo | null>(null);

  const processBlob = useCallback(async (blob: Blob, sourceName?: string) => {
    setOriginal({ blob, sourceName });
  }, []);

  useEffect(() => {
    if (!original) {
      return;
    }

    const globalWithTestHook = globalThis as typeof globalThis & {
      __processingDelayMsForTest?: number | null;
    };

    let cancelled = false;
    const { blob, sourceName } = original;

    const run = async () => {
      setStatus("processing");
      setErrorMessage(null);

      const delayMs = globalWithTestHook.__processingDelayMsForTest;
      if (typeof delayMs === "number" && delayMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }

      try {
        const { source: srcInfo, result: resultInfo } =
          await processImageViaWorker(blob, options, sourceName);

        if (cancelled) {
          return;
        }

        setSource((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous.url);
          }
          return srcInfo;
        });

        setResult((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous.url);
          }
          return resultInfo;
        });

        setStatus("idle");
      } catch (error) {
        if (cancelled) {
          return;
        }
        let message: string;
        if (error instanceof Error) {
          message = translateProcessingError(error, t);
        } else {
          message = t("status.error.unknown");
        }
        setErrorMessage(message);
        setStatus("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [original, options, t]);

  const resetError = useCallback(() => {
    setErrorMessage(null);
    if (status === "error") {
      setStatus("idle");
    }
  }, [status]);

  return {
    status,
    errorMessage,
    source,
    result,
    processBlob,
    resetError,
  };
}

function translateProcessingError(
  error: Error,
  t: (key: TranslationKey) => string,
): string {
  switch (error.message) {
    case "heic.unavailable":
      return t("error.heic.unavailable");
    case "heic.libraryFailed":
      return t("error.heic.libraryFailed");
    case "heic.convertFailed":
      return t("error.heic.convertFailed");
    case "heic.unexpectedResult":
      return t("error.heic.unexpectedResult");
    case "image.invalidDataUrl":
      return t("error.processing.invalidDataUrl");
    case "image.canvasContext":
      return t("error.processing.canvasContext");
    case "image.decodeFailed":
      return t("error.processing.decodeFailed");
    case "image.tooLarge":
      return t("error.processing.tooLarge");
    case "image.exportFailed":
      return t("error.processing.exportFailed");
    default:
      if (error.message === "Unknown processing error") {
        return t("status.error.unknown");
      }
      return error.message || t("status.error.unknown");
  }
}
