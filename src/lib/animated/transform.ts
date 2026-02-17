import {
  computeTargetSize,
  MAX_TARGET_PIXELS,
  MAX_TARGET_SIDE,
} from "../imageProcessingCommon.ts";
import type { ProcessingOptions, ResizeMode, RotateDegrees } from "../types.ts";
import type {
  Canvas2DContext,
  CanvasBackend,
  CanvasLike,
  RgbaAnimation,
} from "./animatedTypes";
import { assertAnimationLimits } from "./constants";

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

function setHighQuality(ctx: Canvas2DContext): void {
  ctx.imageSmoothingEnabled = true;
  // Some DOM lib versions omit this on OffscreenCanvasRenderingContext2D;
  // guard to keep the shared code portable.
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
}

function rotateCanvas<C extends CanvasLike>(
  canvas: C,
  sourceWidth: number,
  sourceHeight: number,
  rotateDegrees: RotateDegrees,
  backend: CanvasBackend<C>,
): { canvas: C; width: number; height: number } {
  if (rotateDegrees === 0) {
    return { canvas, width: sourceWidth, height: sourceHeight };
  }

  const swap = rotateDegrees === 90 || rotateDegrees === 270;
  const rotatedCanvas = backend.createCanvas(
    swap ? sourceHeight : sourceWidth,
    swap ? sourceWidth : sourceHeight,
  );
  const ctx = backend.getContext2D(rotatedCanvas);
  setHighQuality(ctx);

  if (rotateDegrees === 90) {
    ctx.translate(rotatedCanvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotateDegrees === 180) {
    ctx.translate(rotatedCanvas.width, rotatedCanvas.height);
    ctx.rotate(Math.PI);
  } else if (rotateDegrees === 270) {
    ctx.translate(0, rotatedCanvas.height);
    ctx.rotate(-Math.PI / 2);
  }

  ctx.drawImage(canvas, 0, 0);

  return {
    canvas: rotatedCanvas,
    width: rotatedCanvas.width,
    height: rotatedCanvas.height,
  };
}

function drawToCanvas<C extends CanvasLike>(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  resizeMode: ResizeMode,
  backend: CanvasBackend<C>,
): C {
  const canvas = backend.createCanvas(targetWidth, targetHeight);
  const ctx = backend.getContext2D(canvas);
  setHighQuality(ctx);

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

export interface TransformAnimationResult {
  width: number;
  height: number;
  frames: Uint8Array[];
  delaysMs: number[];
  rotatedSourcePreviewPng?: ArrayBuffer;
  rotatedSourceWidth: number;
  rotatedSourceHeight: number;
}

export async function transformAnimation<C extends CanvasLike>(
  animation: RgbaAnimation,
  options: ProcessingOptions,
  backend: CanvasBackend<C>,
): Promise<TransformAnimationResult> {
  const rotateDegrees = normalizeRotateDegrees(options.rotateDegrees);
  const frameCount = animation.frames.length;

  const rotatedSourceWidth =
    rotateDegrees === 90 || rotateDegrees === 270
      ? animation.height
      : animation.width;
  const rotatedSourceHeight =
    rotateDegrees === 90 || rotateDegrees === 270
      ? animation.width
      : animation.height;

  const target = computeTargetSize(
    rotatedSourceWidth,
    rotatedSourceHeight,
    options,
  );

  if (
    target.width <= 0 ||
    target.height <= 0 ||
    target.width > MAX_TARGET_SIDE ||
    target.height > MAX_TARGET_SIDE ||
    target.width * target.height > MAX_TARGET_PIXELS
  ) {
    throw new Error("image.tooLarge");
  }

  assertAnimationLimits(frameCount, target.width, target.height);

  const delaysMs = animation.frames.map((frame) => frame.delayMs);

  const isNoOp =
    rotateDegrees === 0 &&
    target.width === animation.width &&
    target.height === animation.height;

  if (isNoOp) {
    return {
      width: animation.width,
      height: animation.height,
      frames: animation.frames.map((frame) => frame.rgba),
      delaysMs,
      rotatedSourceWidth: animation.width,
      rotatedSourceHeight: animation.height,
    };
  }

  const outputFrames: Uint8Array[] = [];
  let rotatedSourcePreviewPng: ArrayBuffer | undefined;

  for (let index = 0; index < animation.frames.length; index += 1) {
    const frame = animation.frames[index];

    const sourceCanvas = backend.createCanvas(
      animation.width,
      animation.height,
    );
    const sourceCtx = backend.getContext2D(sourceCanvas);
    const sourceImage = sourceCtx.createImageData(
      animation.width,
      animation.height,
    );
    sourceImage.data.set(frame.rgba);
    sourceCtx.putImageData(sourceImage, 0, 0);

    const rotated = rotateCanvas(
      sourceCanvas,
      animation.width,
      animation.height,
      rotateDegrees,
      backend,
    );

    if (index === 0 && rotateDegrees !== 0) {
      try {
        const blob = await backend.canvasToBlob(rotated.canvas, "image/png");
        rotatedSourcePreviewPng = await blob.arrayBuffer();
      } catch {
        // Best-effort preview only.
      }
    }

    const resized =
      rotated.width === target.width && rotated.height === target.height
        ? rotated.canvas
        : drawToCanvas(
            rotated.canvas as unknown as CanvasImageSource,
            rotated.width,
            rotated.height,
            target.width,
            target.height,
            options.resizeMode,
            backend,
          );

    const outCtx = backend.getContext2D(resized);
    const out = outCtx.getImageData(0, 0, target.width, target.height);
    outputFrames.push(new Uint8Array(out.data.buffer));
  }

  return {
    width: target.width,
    height: target.height,
    frames: outputFrames,
    delaysMs,
    rotatedSourcePreviewPng,
    rotatedSourceWidth,
    rotatedSourceHeight,
  };
}
