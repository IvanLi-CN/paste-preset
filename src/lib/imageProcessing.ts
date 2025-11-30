import exifr from "exifr";
import { normalizeImageBlobForCanvas } from "./heic.ts";
import { PRESETS } from "./presets.ts";
import type {
  ImageInfo,
  ImageMetadataSummary,
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

function formatExposureTime(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  if (seconds >= 1) {
    const rounded =
      seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1));
    return `${rounded} s`;
  }

  const denominator = Math.round(1 / seconds);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return undefined;
  }
  return `1/${denominator} s`;
}

async function extractImageMetadataSummary(
  blob: Blob,
): Promise<ImageMetadataSummary | undefined> {
  try {
    const data = await exifr.parse(blob, {
      // Keep the scope narrow: we only need core EXIF/TIFF + GPS.
      tiff: true,
      exif: true,
      gps: true,
      translateKeys: true,
      mergeOutput: true,
    });

    if (!data) {
      return undefined;
    }

    const make = (data.Make as string | undefined) ?? undefined;
    const model = (data.Model as string | undefined) ?? undefined;
    const deviceManufacturer =
      (data.DeviceManufacturer as string | undefined) ?? undefined;
    const deviceModel = (data.DeviceModel as string | undefined) ?? undefined;

    const camera =
      [make, model].filter(Boolean).join(" ") ||
      [deviceManufacturer, deviceModel].filter(Boolean).join(" ") ||
      undefined;

    const lens = (data.LensModel as string | undefined) ?? undefined;

    const dateTime =
      (data.DateTimeOriginal as Date | string | undefined) ??
      (data.CreateDate as Date | string | undefined) ??
      undefined;

    let capturedAt: string | undefined;
    if (dateTime instanceof Date) {
      capturedAt = dateTime.toLocaleString();
    } else if (typeof dateTime === "string" && dateTime.trim()) {
      capturedAt = dateTime;
    }

    const isoValue = data.ISO as number | undefined;
    const exposureSeconds =
      (data.ExposureTime as number | undefined) ??
      (typeof data.ShutterSpeedValue === "number"
        ? // ShutterSpeedValue is in APEX units; 2 ** -value ≈ exposure time.
          2 ** -(data.ShutterSpeedValue as number)
        : undefined);

    const fNumber = data.FNumber as number | undefined;
    const focalLength = data.FocalLength as number | undefined;

    const latitude = data.latitude as number | undefined;
    const longitude = data.longitude as number | undefined;

    const summary: ImageMetadataSummary = {};

    if (camera) summary.camera = camera;
    if (lens) summary.lens = lens;
    if (capturedAt) summary.capturedAt = capturedAt;

    const exposureText = exposureSeconds
      ? formatExposureTime(exposureSeconds)
      : undefined;
    if (exposureText) summary.exposure = exposureText;

    if (
      typeof fNumber === "number" &&
      Number.isFinite(fNumber) &&
      fNumber > 0
    ) {
      summary.aperture = `f/${fNumber.toFixed(1).replace(/\\.0$/, "")}`;
    }

    if (
      typeof isoValue === "number" &&
      Number.isFinite(isoValue) &&
      isoValue > 0
    ) {
      summary.iso = Math.round(isoValue);
    }

    if (
      typeof focalLength === "number" &&
      Number.isFinite(focalLength) &&
      focalLength > 0
    ) {
      summary.focalLength = `${focalLength.toFixed(1).replace(/\\.0$/, "")} mm`;
    }

    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      summary.location = { latitude, longitude };
    }

    // If we didn't manage to extract anything meaningful, return undefined.
    return Object.keys(summary).length > 0 ? summary : undefined;
  } catch {
    // Metadata parsing is best-effort only; failures should not break processing.
    return undefined;
  }
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

const MAX_TARGET_SIDE = 8_000;
const MAX_TARGET_PIXELS = 40_000_000;

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
  const [normalized, metadata] = await Promise.all([
    normalizeImageBlobForCanvas(blob),
    extractImageMetadataSummary(blob),
  ]);

  const {
    bitmap,
    width: sourceWidth,
    height: sourceHeight,
  } = await decodeImage(normalized.blob);

  const target = computeTargetSize(sourceWidth, sourceHeight, options);

  if (
    target.width <= 0 ||
    target.height <= 0 ||
    target.width > MAX_TARGET_SIDE ||
    target.height > MAX_TARGET_SIDE ||
    target.width * target.height > MAX_TARGET_PIXELS
  ) {
    throw new Error(
      "The requested output size is too large to process safely. Please choose smaller dimensions or a lower-resolution preset and try again.",
    );
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

  // If we can pass the original blob through untouched, we consider metadata
  // preserved. Any other path (HEIC conversion, resize, format change, or
  // explicit metadata stripping) is treated as metadata stripped, since the
  // canvas pipeline re-encodes the image without EXIF/IPTC/XMP.
  const metadataStripped = !canPassThrough;

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
    metadata: metadataStripped ? undefined : metadata,
  };

  return {
    source: sourceInfo,
    result: resultInfo,
  };
}
