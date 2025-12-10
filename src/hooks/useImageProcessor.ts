import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import { processImageViaWorker } from "../lib/imageWorkerClient.ts";
import { translateProcessingError } from "../lib/processingErrors.ts";
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
