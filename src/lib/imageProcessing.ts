import { normalizeImageBlobForCanvas } from "./heic.ts";
import {
  buildExifFromEmbedding,
  computeTargetSize,
  embedExifIntoImageBlob,
  extractImageMetadata,
  getOutputMimeType,
  MAX_TARGET_PIXELS,
  MAX_TARGET_SIDE,
} from "./imageProcessingCommon.ts";
import type { ImageInfo, ProcessingOptions, ResizeMode } from "./types.ts";

export interface ProcessResult {
  source: ImageInfo;
  result: ImageInfo;
}

interface DecodeResult {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  mimeType: string;
}

function drawToCanvas(
  image: ImageBitmap | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  resizeMode: ResizeMode,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

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

async function decodeImage(blob: Blob): Promise<DecodeResult> {
  const mimeType = blob.type || "image/png";

  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        mimeType,
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(
          "[PastePreset] createImageBitmap decode failed, falling back to HTMLImageElement:",
          error,
        );
      }
    }
  }

  const img = new Image();
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image.decodeFailed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  return {
    bitmap: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    mimeType,
  };
}

export function createImageInfo(
  blob: Blob,
  width: number,
  height: number,
  sourceName?: string,
  overrideUrlBlob?: Blob,
): ImageInfo {
  const urlBlob = overrideUrlBlob ?? blob;

  return {
    blob,
    url: URL.createObjectURL(urlBlob),
    width,
    height,
    mimeType: blob.type || "image/png",
    fileSize: blob.size,
    sourceName,
  };
}

export async function processImageBlob(
  blob: Blob,
  options: ProcessingOptions,
  sourceName?: string,
): Promise<ProcessResult> {
  const [normalized, parsedMetadata] = await Promise.all([
    normalizeImageBlobForCanvas(blob, sourceName),
    extractImageMetadata(blob),
  ]);

  const metadata = parsedMetadata?.summary;
  const exifEmbedding = parsedMetadata?.exif;

  const decodedBitmap = normalized.decoded;
  const decodedWidth = normalized.decodedWidth;
  const decodedHeight = normalized.decodedHeight;

  let bitmap: ImageBitmap | HTMLImageElement;
  let sourceWidth: number;
  let sourceHeight: number;

  if (
    decodedBitmap &&
    typeof decodedWidth === "number" &&
    typeof decodedHeight === "number"
  ) {
    bitmap = decodedBitmap;
    sourceWidth = decodedWidth;
    sourceHeight = decodedHeight;
  } else {
    ({
      bitmap,
      width: sourceWidth,
      height: sourceHeight,
    } = await decodeImage(normalized.blob));
  }

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
    const canvas = drawToCanvas(
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

    resultBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error("image.exportFailed"));
            return;
          }
          resolve(b);
        },
        mime,
        quality,
      );
    }).then(async (exportedBlob) => {
      if (
        !options.stripMetadata &&
        exifString &&
        (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp")
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
          // Metadata embedding is best-effort only; failures must not break export.
          console.error(
            "[PastePreset] Failed to embed metadata into result image:",
            error,
          );
        }
      }
      return exportedBlob;
    });
  }

  // If we can pass the original blob through untouched, we consider metadata
  // preserved. When we have to re-encode the image, metadata is treated as
  // stripped unless we explicitly re-insert a best-effort EXIF payload.
  const metadataStripped = canPassThrough ? false : !didEmbedMetadata;

  const sourceInfo: ImageInfo = normalized.wasConverted
    ? // For formats like HEIC/HEIF we keep the original blob for
      // metadata/size, but use the converted blob for preview so
      // the browser can display the image without errors. The original
      // file's metadata is never modified by the pipeline.
      {
        ...createImageInfo(
          blob,
          sourceWidth,
          sourceHeight,
          sourceName,
          normalized.blob,
        ),
        metadataStripped: false,
        metadata,
      }
    : {
        // For the source image we always keep the original blob untouched,
        // so from the pipeline's perspective its metadata is preserved.
        ...createImageInfo(blob, sourceWidth, sourceHeight, sourceName),
        metadataStripped: false,
        metadata,
      };
  const resultInfo: ImageInfo = {
    ...createImageInfo(resultBlob, target.width, target.height, sourceName),
    metadataStripped,
    // Only surface metadata details when we believe the exported file
    // actually carries EXIF/GPS information.
    metadata: metadataStripped ? undefined : metadata,
  };

  return {
    source: sourceInfo,
    result: resultInfo,
  };
}
