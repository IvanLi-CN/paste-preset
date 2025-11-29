import { normalizeImageBlobForCanvas } from "./heic.ts";
import { PRESETS } from "./presets.ts";
import type {
  ImageInfo,
  OutputFormat,
  ProcessingOptions,
  ResizeMode,
} from "./types.ts";

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

function getOutputMimeType(
  sourceMime: string,
  format: OutputFormat,
): OutputFormat | "image/jpeg" | "image/png" | "image/webp" {
  if (format !== "auto") {
    return format;
  }

  if (
    sourceMime === "image/jpeg" ||
    sourceMime === "image/png" ||
    sourceMime === "image/webp"
  ) {
    return sourceMime;
  }

  // Fallback for other formats (including HEIC once supported): use JPEG.
  return "image/jpeg";
}

function computeTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  options: ProcessingOptions,
): { width: number; height: number } {
  const explicitWidth = options.targetWidth;
  const explicitHeight = options.targetHeight;

  const hasExplicitWidth = explicitWidth != null;
  const hasExplicitHeight = explicitHeight != null;

  // 1) If both dimensions are explicitly specified, respect them as-is.
  if (hasExplicitWidth && hasExplicitHeight) {
    return { width: explicitWidth, height: explicitHeight };
  }

  // 2) Only width is set: derive height from source aspect ratio.
  if (hasExplicitWidth && !hasExplicitHeight) {
    const ratio = sourceHeight / sourceWidth;
    return { width: explicitWidth, height: Math.round(explicitWidth * ratio) };
  }

  // 3) Only height is set: derive width from source aspect ratio.
  if (!hasExplicitWidth && hasExplicitHeight) {
    const ratio = sourceWidth / sourceHeight;
    return {
      width: Math.round(explicitHeight * ratio),
      height: explicitHeight,
    };
  }

  // 4) No explicit dimensions: fall back to preset-based longest-side rules
  // if a preset is selected, otherwise keep the original size.
  const preset = options.presetId
    ? PRESETS.find((item) => item.id === options.presetId)
    : null;
  const maxLongSide = preset?.maxLongSide ?? null;

  if (maxLongSide && maxLongSide > 0) {
    const longSide = Math.max(sourceWidth, sourceHeight);
    if (longSide > maxLongSide) {
      const scale = maxLongSide / longSide;
      return {
        width: Math.round(sourceWidth * scale),
        height: Math.round(sourceHeight * scale),
      };
    }
  }

  // 5) Default: keep original resolution.
  return { width: sourceWidth, height: sourceHeight };
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
    throw new Error("Unable to get 2D context");
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
    const bitmap = await createImageBitmap(blob);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      mimeType,
    };
  }

  const img = new Image();
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
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

function createImageInfo(
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
  const normalized = await normalizeImageBlobForCanvas(blob);

  const {
    bitmap,
    width: sourceWidth,
    height: sourceHeight,
  } = await decodeImage(normalized.blob);

  const target = computeTargetSize(sourceWidth, sourceHeight, options);

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

    const quality =
      mime === "image/jpeg" || mime === "image/webp"
        ? (options.quality ?? 0.8)
        : undefined;

    resultBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error("Failed to export image"));
            return;
          }
          resolve(b);
        },
        mime,
        quality,
      );
    });
  }

  const sourceInfo = normalized.wasConverted
    ? // For formats like HEIC/HEIF we keep the original blob for
      // metadata/size, but use the converted blob for preview so
      // the browser can display the image without errors.
      createImageInfo(
        blob,
        sourceWidth,
        sourceHeight,
        sourceName,
        normalized.blob,
      )
    : createImageInfo(blob, sourceWidth, sourceHeight, sourceName);
  const resultInfo = createImageInfo(
    resultBlob,
    target.width,
    target.height,
    sourceName,
  );

  return {
    source: sourceInfo,
    result: resultInfo,
  };
}
