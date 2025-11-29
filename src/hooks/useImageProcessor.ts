import { useCallback, useState } from "react";
import { processImageBlob } from "../lib/imageProcessing.ts";
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
  const [status, setStatus] = useState<AppStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [source, setSource] = useState<ImageInfo | null>(null);
  const [result, setResult] = useState<ImageInfo | null>(null);

  const processBlob = useCallback(
    async (blob: Blob, sourceName?: string) => {
      setStatus("processing");
      setErrorMessage(null);

      try {
        const { source: srcInfo, result: resultInfo } = await processImageBlob(
          blob,
          options,
          sourceName,
        );

        if (source) {
          URL.revokeObjectURL(source.url);
        }
        if (result) {
          URL.revokeObjectURL(result.url);
        }

        setSource(srcInfo);
        setResult(resultInfo);
        setStatus("idle");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown processing error";
        setErrorMessage(message);
        setStatus("error");
      }
    },
    [options, source, result],
  );

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
