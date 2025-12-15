/// <reference lib="webworker" />
import piexif from "piexifjs";
import { isHeicMimeType, normalizeImageBlobForCanvas } from "../lib/heic.ts";
import type { ExifEmbeddingData } from "../lib/imageProcessingCommon.ts";
import {
  buildExifFromEmbedding,
  computeTargetSize,
  dataUrlToBlob,
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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("image.invalidDataUrl"));
    reader.readAsDataURL(blob);
  });
}

function drawToOffscreenCanvas(
  image: ImageBitmap,
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

  const target = computeTargetSize(sourceWidth, sourceHeight, options);

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
      bitmap,
      sourceWidth,
      sourceHeight,
      target.width,
      target.height,
      options.resizeMode,
    );

    const exifString = buildExifFromEmbedding(exifEmbedding);

    const quality =
      mime === "image/jpeg" || mime === "image/webp"
        ? (options.quality ?? 0.8)
        : undefined;

    if (mime === "image/jpeg" && !options.stripMetadata) {
      const exported = await canvasToBlob(canvas, mime, quality);
      const dataUrl = await blobToDataUrl(exported);
      const finalDataUrl =
        exifString != null ? piexif.insert(exifString, dataUrl) : dataUrl;
      resultBlob = dataUrlToBlob(finalDataUrl, mime);
      didEmbedMetadata = exifString != null;
    } else {
      resultBlob = await canvasToBlob(canvas, mime, quality).then(
        async (exportedBlob) => {
          if (
            !options.stripMetadata &&
            (mime === "image/png" || mime === "image/webp") &&
            exifString
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
  }

  const metadataStripped = canPassThrough ? false : !didEmbedMetadata;

  const resultBuffer = await resultBlob.arrayBuffer();

  const normalizedBuffer = normalized.wasConverted
    ? await normalized.blob.arrayBuffer()
    : undefined;

  return {
    resultBuffer,
    resultMimeType: resultBlob.type || mime,
    width: target.width,
    height: target.height,
    sourceWidth,
    sourceHeight,
    metadata: metadata ?? undefined,
    metadataStripped,
    normalizedBuffer,
    normalizedMimeType: normalized.wasConverted
      ? normalized.blob.type
      : undefined,
  };
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

    const target = computeTargetSize(sourceWidth, sourceHeight, options);

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
      bitmap,
      sourceWidth,
      sourceHeight,
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

    let resultBlob: Blob;
    if (mime === "image/jpeg" && !options.stripMetadata) {
      const exported = await canvasToBlob(canvas, mime, quality);
      const dataUrl = await blobToDataUrl(exported);
      const finalDataUrl =
        exifString != null ? piexif.insert(exifString, dataUrl) : dataUrl;
      resultBlob = dataUrlToBlob(finalDataUrl, mime);
      didEmbedMetadata = exifString != null;
    } else {
      resultBlob = await canvasToBlob(canvas, mime, quality).then(
        async (exportedBlob) => {
          if (
            !options.stripMetadata &&
            (mime === "image/png" || mime === "image/webp") &&
            exifString
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

    const resultBuffer = await resultBlob.arrayBuffer();
    const metadataStripped = !didEmbedMetadata;

    return {
      resultBuffer,
      resultMimeType: resultBlob.type || mime,
      width: target.width,
      height: target.height,
      sourceWidth,
      sourceHeight,
      metadata: metadata ?? undefined,
      metadataStripped,
    };
  } finally {
    bitmap.close();
  }
}
