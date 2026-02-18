import type { CanvasBackend } from "./animated/animatedTypes.ts";
import { decodeAnimatedImage } from "./animated/decode.ts";
import {
  encodeAnimatedWebp,
  encodeApng,
  encodeGif,
} from "./animated/encode.ts";
import { sniffImage } from "./animated/sniff.ts";
import { transformAnimation } from "./animated/transform.ts";
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
import type {
  ImageInfo,
  ProcessingOptions,
  ResizeMode,
  RotateDegrees,
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

function drawToCanvas(
  image: CanvasImageSource,
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

function rotateToCanvas(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  rotateDegrees: RotateDegrees,
): { image: CanvasImageSource; width: number; height: number } {
  if (rotateDegrees === 0) {
    return { image, width: sourceWidth, height: sourceHeight };
  }

  const swap = rotateDegrees === 90 || rotateDegrees === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? sourceHeight : sourceWidth;
  canvas.height = swap ? sourceWidth : sourceHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("image.canvasContext");
  }

  // No interpolation is needed for a 90-degree rotation, but keep the settings
  // aligned with the rest of the pipeline.
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

function shouldOverrideBlobMimeTypeForPreview(
  declaredMimeType: string,
  effectiveMimeType: string,
): boolean {
  const declared = declaredMimeType.trim().toLowerCase();
  const effective = effectiveMimeType.trim().toLowerCase();

  if (!effective.startsWith("image/")) {
    return false;
  }
  if (!declared) {
    return true;
  }
  if (declared === effective) {
    return false;
  }

  // APNG is a PNG container, and most environments already decode it fine when
  // served as `image/png`. Avoid changing it just for preview.
  if (effective === "image/apng" && declared === "image/png") {
    return false;
  }

  return true;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  if (view.buffer instanceof ArrayBuffer) {
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    );
  }
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
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

  const sourceBuffer = await blob.arrayBuffer();
  const sourceBytes = new Uint8Array(sourceBuffer);
  const sniffed = sniffImage(sourceBytes, normalized.originalMimeType);
  const displayBlob =
    !normalized.wasConverted &&
    shouldOverrideBlobMimeTypeForPreview(
      blob.type || "",
      sniffed.effectiveMimeType,
    )
      ? new Blob([blob], { type: sniffed.effectiveMimeType })
      : undefined;
  const decodeBlob = displayBlob ?? normalized.blob;

  const mime = getOutputMimeType(
    sniffed.effectiveMimeType,
    options.outputFormat,
  );
  const wantsAnimatedOutput =
    mime === "image/gif" ||
    mime === "image/apng" ||
    (sniffed.isAnimated && mime === "image/webp");

  if (wantsAnimatedOutput) {
    const backend: CanvasBackend<HTMLCanvasElement> = {
      createCanvas: (width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      },
      getContext2D: (canvas) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("image.canvasContext");
        }
        return ctx;
      },
      canvasToBlob: (canvas, mimeType, quality) =>
        new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (!b) {
                reject(new Error("image.exportFailed"));
                return;
              }
              resolve(b);
            },
            mimeType,
            quality,
          );
        }),
    };

    const rotateDegrees = normalizeRotateDegrees(options.rotateDegrees);

    if (sniffed.isAnimated) {
      const decoded = await decodeAnimatedImage(sourceBytes, sniffed, backend);

      const rotatedSourceWidth =
        rotateDegrees === 90 || rotateDegrees === 270
          ? decoded.height
          : decoded.width;
      const rotatedSourceHeight =
        rotateDegrees === 90 || rotateDegrees === 270
          ? decoded.width
          : decoded.height;

      const target = computeTargetSize(
        rotatedSourceWidth,
        rotatedSourceHeight,
        options,
      );

      // Pass-through fast-path: if nothing changes and output matches the source,
      // keep the original bytes to preserve quality and speed.
      if (
        rotateDegrees === 0 &&
        !normalized.wasConverted &&
        !options.stripMetadata &&
        mime === sniffed.effectiveMimeType &&
        target.width === decoded.width &&
        target.height === decoded.height
      ) {
        const resultBlob =
          blob.type === mime ? blob : new Blob([sourceBuffer], { type: mime });

        return {
          source: {
            ...createImageInfo(
              blob,
              decoded.width,
              decoded.height,
              sourceName,
              displayBlob,
            ),
            mimeType: sniffed.effectiveMimeType,
            metadataStripped: false,
            metadata,
          },
          result: {
            ...createImageInfo(
              resultBlob,
              decoded.width,
              decoded.height,
              sourceName,
            ),
            metadataStripped: false,
            metadata,
          },
        };
      }

      const transformed = await transformAnimation(decoded, options, backend);

      const resultBlob = await (async () => {
        if (mime === "image/gif") {
          const out = await encodeGif(
            transformed.frames,
            transformed.width,
            transformed.height,
            transformed.delaysMs,
          );
          return new Blob([toArrayBuffer(out)], { type: mime });
        }
        if (mime === "image/apng") {
          const out = await encodeApng(
            transformed.frames,
            transformed.width,
            transformed.height,
            transformed.delaysMs,
          );
          return new Blob([out], { type: mime });
        }
        const out = await encodeAnimatedWebp(
          transformed.frames,
          transformed.width,
          transformed.height,
          transformed.delaysMs,
        );
        return new Blob([toArrayBuffer(out)], { type: mime });
      })();

      const rotatedSourcePreviewBlob =
        rotateDegrees !== 0 && transformed.rotatedSourcePreviewPng
          ? new Blob([transformed.rotatedSourcePreviewPng], {
              type: "image/png",
            })
          : undefined;

      const sourcePreviewWidth =
        rotateDegrees !== 0 ? transformed.rotatedSourceWidth : decoded.width;
      const sourcePreviewHeight =
        rotateDegrees !== 0 ? transformed.rotatedSourceHeight : decoded.height;

      const sourceInfo: ImageInfo =
        normalized.wasConverted || rotateDegrees !== 0
          ? {
              ...createImageInfo(
                blob,
                sourcePreviewWidth,
                sourcePreviewHeight,
                sourceName,
                rotatedSourcePreviewBlob ?? normalized.blob,
              ),
              mimeType: sniffed.effectiveMimeType,
              metadataStripped: false,
              metadata,
            }
          : {
              ...createImageInfo(
                blob,
                decoded.width,
                decoded.height,
                sourceName,
                displayBlob,
              ),
              mimeType: sniffed.effectiveMimeType,
              metadataStripped: false,
              metadata,
            };

      const resultInfo: ImageInfo = {
        ...createImageInfo(
          resultBlob,
          transformed.width,
          transformed.height,
          sourceName,
        ),
        metadataStripped: true,
        metadata: undefined,
      };

      return { source: sourceInfo, result: resultInfo };
    }

    // Static source -> encode as a single-frame "animation" (GIF/APNG).
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
      } = await decodeImage(decodeBlob));
    }

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = sourceWidth;
    sourceCanvas.height = sourceHeight;
    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) {
      throw new Error("image.canvasContext");
    }
    sourceCtx.imageSmoothingEnabled = true;
    sourceCtx.imageSmoothingQuality = "high";
    sourceCtx.drawImage(bitmap, 0, 0);

    const data = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);

    const decoded = {
      width: sourceWidth,
      height: sourceHeight,
      frames: [{ rgba: new Uint8Array(data.data.buffer), delayMs: 0 }],
    };

    const transformed = await transformAnimation(decoded, options, backend);

    const resultBlob = await (async () => {
      if (mime === "image/gif") {
        const out = await encodeGif(
          transformed.frames,
          transformed.width,
          transformed.height,
          transformed.delaysMs,
        );
        return new Blob([toArrayBuffer(out)], { type: mime });
      }
      if (mime === "image/apng") {
        const out = await encodeApng(
          transformed.frames,
          transformed.width,
          transformed.height,
          transformed.delaysMs,
        );
        return new Blob([out], { type: mime });
      }
      throw new Error("image.animatedCodecUnavailable");
    })();

    const rotatedSourcePreviewBlob =
      rotateDegrees !== 0 && transformed.rotatedSourcePreviewPng
        ? new Blob([transformed.rotatedSourcePreviewPng], { type: "image/png" })
        : undefined;

    const sourcePreviewWidth =
      rotateDegrees !== 0 ? transformed.rotatedSourceWidth : sourceWidth;
    const sourcePreviewHeight =
      rotateDegrees !== 0 ? transformed.rotatedSourceHeight : sourceHeight;

    const sourceInfo: ImageInfo =
      normalized.wasConverted || rotateDegrees !== 0
        ? {
            ...createImageInfo(
              blob,
              sourcePreviewWidth,
              sourcePreviewHeight,
              sourceName,
              rotatedSourcePreviewBlob ?? normalized.blob,
            ),
            mimeType: sniffed.effectiveMimeType,
            metadataStripped: false,
            metadata,
          }
        : {
            ...createImageInfo(
              blob,
              sourceWidth,
              sourceHeight,
              sourceName,
              displayBlob,
            ),
            mimeType: sniffed.effectiveMimeType,
            metadataStripped: false,
            metadata,
          };

    const resultInfo: ImageInfo = {
      ...createImageInfo(
        resultBlob,
        transformed.width,
        transformed.height,
        sourceName,
      ),
      metadataStripped: true,
      metadata: undefined,
    };

    return { source: sourceInfo, result: resultInfo };
  }

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
    } = await decodeImage(decodeBlob));
  }

  const rotateDegrees = normalizeRotateDegrees(options.rotateDegrees);
  const rotated = rotateToCanvas(
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

  const canPassThrough =
    !sniffed.isAnimated &&
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
    const canvas = drawToCanvas(
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

  let rotatedSourcePreviewBlob: Blob | undefined;
  if (rotateDegrees !== 0 && rotated.image instanceof HTMLCanvasElement) {
    const rotatedCanvas = rotated.image;
    const previewMime = (() => {
      const candidate =
        normalized.blob.type || normalized.originalMimeType || "image/png";
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
      rotatedSourcePreviewBlob = await new Promise<Blob>((resolve, reject) => {
        rotatedCanvas.toBlob(
          (preview: Blob | null) => {
            if (!preview) {
              reject(new Error("image.exportFailed"));
              return;
            }
            resolve(preview);
          },
          previewMime,
          previewQuality,
        );
      });
    } catch (error) {
      // Rotation should still produce a valid result image even if creating an
      // extra preview blob fails for some reason.
      console.error(
        "[PastePreset] Failed to create rotated source preview blob:",
        error,
      );
    }
  }

  const sourcePreviewWidth = rotateDegrees !== 0 ? rotated.width : sourceWidth;
  const sourcePreviewHeight =
    rotateDegrees !== 0 ? rotated.height : sourceHeight;

  const sourceInfo: ImageInfo =
    normalized.wasConverted || rotateDegrees !== 0
      ? // For formats like HEIC/HEIF we keep the original blob for
        // metadata/size, but use the converted blob for preview so
        // the browser can display the image without errors. The original
        // file's metadata is never modified by the pipeline.
        {
          ...createImageInfo(
            blob,
            sourcePreviewWidth,
            sourcePreviewHeight,
            sourceName,
            rotatedSourcePreviewBlob ?? normalized.blob,
          ),
          mimeType: sniffed.effectiveMimeType,
          metadataStripped: false,
          metadata,
        }
      : {
          // For the source image we always keep the original blob untouched,
          // so from the pipeline's perspective its metadata is preserved.
          ...createImageInfo(
            blob,
            sourceWidth,
            sourceHeight,
            sourceName,
            displayBlob,
          ),
          mimeType: sniffed.effectiveMimeType,
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
