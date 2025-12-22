import { getEffectiveMimeType, isHeicMimeType } from "./heic.ts";
import type { ProcessResult } from "./imageProcessing.ts";
import { createImageInfo, processImageBlob } from "./imageProcessing.ts";
import { extractImageMetadata } from "./imageProcessingCommon.ts";
import type { ProcessRequest, ProcessResponse } from "./imageWorkerTypes.ts";
import type { ProcessingOptions } from "./types.ts";

type PendingRequest = {
  resolve: (value: ProcessResult) => void;
  reject: (reason?: unknown) => void;
  sourceBlob: Blob;
  sourceName?: string;
};

const pending = new Map<string, PendingRequest>();
let workerInstance: Worker | null = null;

function supportsOffscreenProcessing(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function"
  );
}

function isLikelyHeicName(sourceName?: string): boolean {
  if (!sourceName) {
    return false;
  }
  const lower = sourceName.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

function shouldUseWorker(blob: Blob, sourceName?: string): boolean {
  if (!supportsOffscreenProcessing()) {
    return false;
  }
  // heic2any relies on DOM APIs, so HEIC inputs stay on the main thread.
  if (isHeicMimeType(blob.type || "")) {
    return false;
  }
  if (!blob.type && isLikelyHeicName(sourceName)) {
    return false;
  }
  return true;
}

function createWorker(): Worker | null {
  if (workerInstance) {
    return workerInstance;
  }
  if (!supportsOffscreenProcessing()) {
    return null;
  }
  try {
    const worker = new Worker(
      new URL("../workers/imageProcessor.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (event) => {
      console.error("[PastePreset] Image worker error:", event.message);
      flushPending(new Error(event.message || "image.exportFailed"));
    };
    worker.onmessageerror = (event) => {
      console.error("[PastePreset] Image worker message error:", event.data);
      flushPending(new Error("image.exportFailed"));
    };
    workerInstance = worker;
    return workerInstance;
  } catch (error) {
    console.error("[PastePreset] Failed to create image worker:", error);
    workerInstance = null;
    return null;
  }
}

function generateRequestId(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function handleWorkerMessage(event: MessageEvent<ProcessResponse>): void {
  const data = event.data;
  if (!data || (data.type !== "success" && data.type !== "failure")) {
    return;
  }
  const pendingRequest = pending.get(data.id);
  if (!pendingRequest) {
    return;
  }
  pending.delete(data.id);

  if (data.type === "failure") {
    pendingRequest.reject(new Error(data.errorMessage));
    return;
  }

  const { sourceBlob, sourceName, resolve, reject: _reject } = pendingRequest;

  try {
    const resultBlob = new Blob([data.resultBuffer], {
      type: data.resultMimeType,
    });

    const normalizedBlob =
      data.normalizedBuffer && data.normalizedBuffer.byteLength > 0
        ? new Blob([data.normalizedBuffer], {
            type: data.normalizedMimeType ?? "image/png",
          })
        : undefined;

    const sourceInfo = normalizedBlob
      ? {
          ...createImageInfo(
            sourceBlob,
            data.sourceWidth,
            data.sourceHeight,
            sourceName,
            normalizedBlob,
          ),
          metadata: data.metadata,
          metadataStripped: false,
        }
      : {
          ...createImageInfo(
            sourceBlob,
            data.sourceWidth,
            data.sourceHeight,
            sourceName,
          ),
          metadata: data.metadata,
          metadataStripped: false,
        };

    const resultInfo = {
      ...createImageInfo(
        resultBlob,
        data.width,
        data.height,
        sourceName ?? sourceInfo.sourceName,
      ),
      metadataStripped: data.metadataStripped,
      metadata: data.metadataStripped ? undefined : data.metadata,
    };

    resolve({ source: sourceInfo, result: resultInfo });
  } catch (error) {
    pendingRequest.reject(error);
  }
}

function flushPending(error: Error): void {
  for (const [, entry] of pending) {
    entry.reject(error);
  }
  pending.clear();
}

async function runWithWorker(
  blob: Blob,
  options: ProcessingOptions,
  sourceName?: string,
): Promise<ProcessResult> {
  const worker = createWorker();
  if (!worker) {
    return processImageBlob(blob, options, sourceName);
  }

  const id = generateRequestId();
  const buffer = await blob.arrayBuffer();
  const headerBytes = new Uint8Array(
    buffer,
    0,
    Math.min(buffer.byteLength, 32),
  );
  const mimeType = await getEffectiveMimeType(blob, sourceName, headerBytes);

  const request: ProcessRequest = {
    type: "process",
    id,
    buffer,
    mimeType,
    sourceName,
    options,
  };

  return new Promise<ProcessResult>((resolve, reject) => {
    pending.set(id, { resolve, reject, sourceBlob: blob, sourceName });
    worker.postMessage(request, [request.buffer]);
  });
}

async function decodeToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("image.decodeFailed");
  }

  try {
    return await createImageBitmap(blob);
  } catch {
    // Fall through to HTMLImageElement decode.
  }

  if (typeof Image === "undefined" || typeof document === "undefined") {
    throw new Error("image.decodeFailed");
  }

  const url = URL.createObjectURL(blob);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image.decodeFailed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  try {
    return await createImageBitmap(img);
  } catch {
    // Fall through to canvas rendering.
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("image.canvasContext");
  }

  ctx.drawImage(img, 0, 0);
  return createImageBitmap(canvas);
}

async function runWithWorkerBitmap(
  blob: Blob,
  options: ProcessingOptions,
  sourceName?: string,
): Promise<ProcessResult> {
  const worker = createWorker();
  if (!worker) {
    return processImageBlob(blob, options, sourceName);
  }

  const id = generateRequestId();

  const [bitmap, parsedMetadata] = await Promise.all([
    decodeToImageBitmap(blob),
    extractImageMetadata(blob),
  ]);

  const request: ProcessRequest = {
    type: "processBitmap",
    id,
    bitmap,
    sourceMimeType: await getEffectiveMimeType(blob, sourceName),
    metadata: parsedMetadata?.summary,
    exifEmbedding: parsedMetadata?.exif,
    sourceName,
    options,
  };

  return new Promise<ProcessResult>((resolve, reject) => {
    pending.set(id, { resolve, reject, sourceBlob: blob, sourceName });
    worker.postMessage(request, [bitmap]);
  });
}

export async function processImageViaWorker(
  blob: Blob,
  options: ProcessingOptions,
  sourceName?: string,
): Promise<ProcessResult> {
  if (!shouldUseWorker(blob, sourceName)) {
    return processImageBlob(blob, options, sourceName);
  }

  try {
    return await runWithWorker(blob, options, sourceName);
  } catch (error) {
    if (error instanceof Error && error.message === "image.decodeFailed") {
      try {
        return await runWithWorkerBitmap(blob, options, sourceName);
      } catch (retryError) {
        console.warn(
          "[PastePreset] Worker bitmap fallback failed, falling back to main thread:",
          retryError,
        );
        return processImageBlob(blob, options, sourceName);
      }
    }

    console.warn("[PastePreset] Worker processing failed:", error);
    return processImageBlob(blob, options, sourceName);
  }
}

export function resetImageWorker(reason?: Error): void {
  if (workerInstance) {
    try {
      workerInstance.terminate();
    } finally {
      workerInstance = null;
    }
  }

  flushPending(reason ?? new Error("image.exportFailed"));
}
