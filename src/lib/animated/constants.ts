export const MAX_ANIM_FRAMES = 300;
export const MAX_ANIM_RGBA_BYTES = 256 * 1024 * 1024;
export const DEFAULT_FRAME_DELAY_MS = 100;

export function normalizeFrameDelayMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_FRAME_DELAY_MS;
  }
  // Avoid absurd delays that could overflow encoders or result in a "frozen" UI.
  return Math.min(Math.round(value), 60_000);
}

export function assertAnimationLimits(
  frameCount: number,
  targetWidth: number,
  targetHeight: number,
): void {
  if (!Number.isFinite(frameCount) || frameCount <= 0) {
    throw new Error("image.decodeFailed");
  }
  if (frameCount > MAX_ANIM_FRAMES) {
    throw new Error("image.tooManyFrames");
  }

  const estimatedBytes = targetWidth * targetHeight * 4 * frameCount;
  if (
    !Number.isFinite(estimatedBytes) ||
    estimatedBytes > MAX_ANIM_RGBA_BYTES
  ) {
    throw new Error("image.animationTooLarge");
  }
}
