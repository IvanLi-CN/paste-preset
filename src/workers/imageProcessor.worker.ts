/// <reference lib="webworker" />
import { isHeicMimeType, normalizeImageBlobForCanvas } from "../lib/heic.ts";
import type { ExifEmbeddingData } from "../lib/imageProcessingCommon.ts";
import {
  buildExifFromEmbedding,
  computeTargetSize,
  embedExifIntoImageBlob,
  extractImageMetadata,
  getOutputMimeType,
  MAX_TARGET_PIXELS,
  MAX_TARGET_SIDE,
} from "../lib/imageProcessingCommon.ts";
import type {
  ProcessRequest,
  ProcessResponse,
  ProcessSuccess,
} from "../lib/imageWorkerTypes.ts";
import type {
  ImageMetadataSummary,
  ProcessingOptions,
  ResizeMode,
  RotateDegrees,
} from "../lib/types.ts";

const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<ProcessRequest>) => {
  const message = event.data;
  if (
    !message ||
    (message.type !== "process" && message.type !== "processBitmap")
  ) {
    return;
  }

  try {
    const response =
      message.type === "process"
        ? await processImageBlobOffscreen(
            message.buffer,
            message.mimeType,
            message.options,
          )
        : await processImageBitmapOffscreen(
            message.bitmap,
            message.sourceMimeType,
            message.options,
            message.metadata,
            message.exifEmbedding,
          );

    const success: ProcessSuccess = {
      type: "success",
      id: message.id,
      resultBuffer: response.resultBuffer,
      resultMimeType: response.resultMimeType,
      width: response.width,
      height: response.height,
      sourceWidth: response.sourceWidth,
      sourceHeight: response.sourceHeight,
      metadata: response.metadata,
      metadataStripped: response.metadataStripped,
      normalizedBuffer: response.normalizedBuffer,
      normalizedMimeType: response.normalizedMimeType,
    };

    const transferables: ArrayBuffer[] = [response.resultBuffer];
    if (response.normalizedBuffer) {
      transferables.push(response.normalizedBuffer);
    }

    ctx.postMessage(success satisfies ProcessResponse, transferables);
  } catch (error) {
    const failure = {
      type: "failure",
      id: message.id,
      errorMessage:
        error instanceof Error ? error.message : "Unknown processing error",
    } as const satisfies ProcessResponse;
    ctx.postMessage(failure);
  }
};

interface OffscreenProcessResult {
  resultBuffer: ArrayBuffer;
  resultMimeType: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  metadata?: ImageMetadataSummary;
  metadataStripped: boolean;
  normalizedBuffer?: ArrayBuffer;
  normalizedMimeType?: string;
}

function drawToOffscreenCanvas(
  image: ImageBitmap | OffscreenCanvas,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  resizeMode: ResizeMode,
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("image.canvasContext");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (resizeMode === "stretch") {
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (resizeMode === "fit") {
    let drawWidth = targetWidth;
    let drawHeight = Math.round(targetWidth / sourceRatio);

    if (drawHeight > targetHeight) {
      drawHeight = targetHeight;
      drawWidth = Math.round(targetHeight * sourceRatio);
    }

    const dx = Math.round((targetWidth - drawWidth) / 2);
    const dy = Math.round((targetHeight - drawHeight) / 2);

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    return canvas;
  }

  if (resizeMode === "fill") {
    let sx = 0;
    let sy = 0;
    let sWidth = sourceWidth;
    let sHeight = sourceHeight;

    if (sourceRatio > targetRatio) {
      const newWidth = sourceHeight * targetRatio;
      sx = Math.round((sourceWidth - newWidth) / 2);
      sWidth = Math.round(newWidth);
    } else {
      const newHeight = sourceWidth / targetRatio;
      sy = Math.round((sourceHeight - newHeight) / 2);
      sHeight = Math.round(newHeight);
    }

    ctx.drawImage(
      image,
      sx,
      sy,
      sWidth,
      sHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    return canvas;
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas;
}

function normalizeRotateDegrees(value: number | undefined): RotateDegrees {
  switch (value) {
    case 90:
    case 180:
    case 270:
      return value;
    default:
      return 0;
  }
}

function rotateToOffscreenCanvas(
  image: ImageBitmap,
  sourceWidth: number,
  sourceHeight: number,
  rotateDegrees: RotateDegrees,
): { image: ImageBitmap | OffscreenCanvas; width: number; height: number } {
  if (rotateDegrees === 0) {
    return { image, width: sourceWidth, height: sourceHeight };
  }

  const swap = rotateDegrees === 90 || rotateDegrees === 270;
  const canvas = new OffscreenCanvas(
    swap ? sourceHeight : sourceWidth,
    swap ? sourceWidth : sourceHeight,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("image.canvasContext");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (rotateDegrees === 90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotateDegrees === 180) {
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
  } else if (rotateDegrees === 270) {
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
  }

  ctx.drawImage(image, 0, 0);

  return { image: canvas, width: canvas.width, height: canvas.height };
}

async function decodeImageBitmap(blob: Blob): Promise<{
  bitmap: ImageBitmap;
  width: number;
  height: number;
}> {
  try {
    const bitmap = await createImageBitmap(blob);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
    };
  } catch {
    throw new Error("image.decodeFailed");
  }
}

async function canvasToBlob(
  canvas: OffscreenCanvas,
  mime: string,
  quality: number | undefined,
): Promise<Blob> {
  try {
    return await canvas.convertToBlob({
      type: mime,
      quality,
    });
  } catch (error) {
    console.error("[PastePreset] OffscreenCanvas convertToBlob failed:", error);
    throw new Error("image.exportFailed");
  }
}

async function processImageBlobOffscreen(
  buffer: ArrayBuffer,
  mimeType: string,
  options: ProcessingOptions,
): Promise<OffscreenProcessResult> {
  const blob = new Blob([buffer], { type: mimeType });

  // heic2any relies on DOM APIs that are unavailable in dedicated workers,
  // so when a HEIC/HEIF payload is detected we surface a clear error to let
  // the main thread handle the fallback path.
  if (isHeicMimeType(blob.type) && typeof document === "undefined") {
    throw new Error("heic.unavailable");
  }

  const [normalized, parsedMetadata] = await Promise.all([
    normalizeImageBlobForCanvas(blob),
    extractImageMetadata(blob),
  ]);

  const metadata = parsedMetadata?.summary;
  const exifEmbedding = parsedMetadata?.exif;

  const {
    bitmap,
    width: sourceWidth,
    height: sourceHeight,
  } = await decodeImageBitmap(normalized.blob);

  const rotateDegrees = normalizeRotateDegrees(options.rotateDegrees);
  const rotated = rotateToOffscreenCanvas(
    bitmap,
    sourceWidth,
    sourceHeight,
    rotateDegrees,
  );

  try {
    const target = computeTargetSize(rotated.width, rotated.height, options);

    if (
      target.width <= 0 ||
      target.height <= 0 ||
      target.width > MAX_TARGET_SIDE ||
      target.height > MAX_TARGET_SIDE ||
      target.width * target.height > MAX_TARGET_PIXELS
    ) {
      throw new Error("image.tooLarge");
    }

    const mime = getOutputMimeType(
      normalized.originalMimeType,
      options.outputFormat,
    );

    const canPassThrough =
      rotateDegrees === 0 &&
      !normalized.wasConverted &&
      !options.stripMetadata &&
      target.width === sourceWidth &&
      target.height === sourceHeight &&
      mime === normalized.originalMimeType;

    let resultBlob: Blob;
    let didEmbedMetadata = false;

    if (canPassThrough) {
      resultBlob = blob;
    } else {
      const canvas = drawToOffscreenCanvas(
        rotated.image,
        rotated.width,
        rotated.height,
        target.width,
        target.height,
        options.resizeMode,
      );

      const exifString = buildExifFromEmbedding(exifEmbedding);

      const quality =
        mime === "image/jpeg" || mime === "image/webp"
          ? (options.quality ?? 0.8)
          : undefined;

      resultBlob = await canvasToBlob(canvas, mime, quality).then(
        async (exportedBlob) => {
          if (
            !options.stripMetadata &&
            exifString &&
            (mime === "image/jpeg" ||
              mime === "image/png" ||
              mime === "image/webp")
          ) {
            try {
              const patched = await embedExifIntoImageBlob(
                exportedBlob,
                mime,
                exifString,
              );
              if (patched) {
                didEmbedMetadata = true;
                return patched;
              }
            } catch (error) {
              console.error(
                "[PastePreset] Failed to embed metadata in worker:",
                error,
              );
            }
          }
          return exportedBlob;
        },
      );
    }

    const metadataStripped = canPassThrough ? false : !didEmbedMetadata;

    const resultBuffer = await resultBlob.arrayBuffer();

    let normalizedBuffer: ArrayBuffer | undefined;
    let normalizedMimeType: string | undefined;

    if (rotateDegrees !== 0) {
      const previewMime = (() => {
        const candidate = normalized.wasConverted
          ? normalized.blob.type
          : mimeType;
        if (
          candidate === "image/jpeg" ||
          candidate === "image/png" ||
          candidate === "image/webp"
        ) {
          return candidate;
        }
        return "image/png";
      })();

      const previewQuality =
        previewMime === "image/jpeg" || previewMime === "image/webp"
          ? (options.quality ?? 0.92)
          : undefined;

      try {
        const previewBlob = await canvasToBlob(
          rotated.image as OffscreenCanvas,
          previewMime,
          previewQuality,
        );
        normalizedBuffer = await previewBlob.arrayBuffer();
        normalizedMimeType = previewBlob.type || previewMime;
      } catch (error) {
        console.error(
          "[PastePreset] Failed to export rotated source preview in worker:",
          error,
        );
      }
    } else if (normalized.wasConverted) {
      normalizedBuffer = await normalized.blob.arrayBuffer();
      normalizedMimeType = normalized.blob.type;
    }

    return {
      resultBuffer,
      resultMimeType: resultBlob.type || mime,
      width: target.width,
      height: target.height,
      sourceWidth: rotated.width,
      sourceHeight: rotated.height,
      metadata: metadata ?? undefined,
      metadataStripped,
      normalizedBuffer,
      normalizedMimeType,
    };
  } finally {
    bitmap.close();
  }
}

async function processImageBitmapOffscreen(
  bitmap: ImageBitmap,
  sourceMimeType: string,
  options: ProcessingOptions,
  metadata: ImageMetadataSummary | undefined,
  exifEmbedding: ExifEmbeddingData | undefined,
): Promise<OffscreenProcessResult> {
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;

    const rotateDegrees = normalizeRotateDegrees(options.rotateDegrees);
    const rotated = rotateToOffscreenCanvas(
      bitmap,
      sourceWidth,
      sourceHeight,
      rotateDegrees,
    );

    const target = computeTargetSize(rotated.width, rotated.height, options);

    if (
      target.width <= 0 ||
      target.height <= 0 ||
      target.width > MAX_TARGET_SIDE ||
      target.height > MAX_TARGET_SIDE ||
      target.width * target.height > MAX_TARGET_PIXELS
    ) {
      throw new Error("image.tooLarge");
    }

    const mime = getOutputMimeType(sourceMimeType, options.outputFormat);

    const canvas = drawToOffscreenCanvas(
      rotated.image,
      rotated.width,
      rotated.height,
      target.width,
      target.height,
      options.resizeMode,
    );

    const quality =
      mime === "image/jpeg" || mime === "image/webp"
        ? (options.quality ?? 0.8)
        : undefined;

    const exifString = buildExifFromEmbedding(exifEmbedding);
    let didEmbedMetadata = false;

    const resultBlob = await canvasToBlob(canvas, mime, quality).then(
      async (exportedBlob) => {
        if (
          !options.stripMetadata &&
          exifString &&
          (mime === "image/jpeg" ||
            mime === "image/png" ||
            mime === "image/webp")
        ) {
          try {
            const patched = await embedExifIntoImageBlob(
              exportedBlob,
              mime,
              exifString,
            );
            if (patched) {
              didEmbedMetadata = true;
              return patched;
            }
          } catch (error) {
            console.error(
              "[PastePreset] Failed to embed metadata in worker:",
              error,
            );
          }
        }
        return exportedBlob;
      },
    );

    const resultBuffer = await resultBlob.arrayBuffer();
    const metadataStripped = !didEmbedMetadata;

    let normalizedBuffer: ArrayBuffer | undefined;
    let normalizedMimeType: string | undefined;

    if (rotateDegrees !== 0) {
      const previewMime = (() => {
        if (
          sourceMimeType === "image/jpeg" ||
          sourceMimeType === "image/png" ||
          sourceMimeType === "image/webp"
        ) {
          return sourceMimeType;
        }
        return "image/png";
      })();

      const previewQuality =
        previewMime === "image/jpeg" || previewMime === "image/webp"
          ? (options.quality ?? 0.92)
          : undefined;

      try {
        const previewBlob = await canvasToBlob(
          rotated.image as OffscreenCanvas,
          previewMime,
          previewQuality,
        );
        normalizedBuffer = await previewBlob.arrayBuffer();
        normalizedMimeType = previewBlob.type || previewMime;
      } catch (error) {
        console.error(
          "[PastePreset] Failed to export rotated source preview in worker:",
          error,
        );
      }
    }

    return {
      resultBuffer,
      resultMimeType: resultBlob.type || mime,
      width: target.width,
      height: target.height,
      sourceWidth: rotated.width,
      sourceHeight: rotated.height,
      metadata: metadata ?? undefined,
      metadataStripped,
      normalizedBuffer,
      normalizedMimeType,
    };
  } finally {
    bitmap.close();
  }
}
