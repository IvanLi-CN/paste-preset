export const MAX_PREVIEW_SCALE = 8;

export type ImageSize = { width: number; height: number };
export type ViewportSize = { width: number; height: number };
export type ViewerMode = "fit" | "oneToOne" | "custom";

function isFinitePositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function resolveMaxScale(maxScale?: number): number {
  return isFinitePositiveNumber(maxScale ?? Number.NaN)
    ? (maxScale as number)
    : MAX_PREVIEW_SCALE;
}

/**
 * Compute the scale that fits the image within the viewport ("contain").
 *
 * Invalid inputs are handled deterministically:
 * - If any viewport or image dimension is not a finite positive number,
 *   the function returns 1.
 */
export function computeFitScale(
  viewport: ViewportSize,
  image: ImageSize,
  maxScale?: number,
): number {
  if (
    !isFinitePositiveNumber(viewport.width) ||
    !isFinitePositiveNumber(viewport.height) ||
    !isFinitePositiveNumber(image.width) ||
    !isFinitePositiveNumber(image.height)
  ) {
    return 1;
  }

  const fitScaleRaw = Math.min(
    viewport.width / image.width,
    viewport.height / image.height,
  );

  return Math.min(fitScaleRaw, resolveMaxScale(maxScale));
}

export function computeMinScale(fitScale: number): number {
  return Math.min(fitScale, 1);
}

export function clampScale(
  scale: number,
  fitScale: number,
  maxScale?: number,
): number {
  const effectiveFitScale = isFinitePositiveNumber(fitScale) ? fitScale : 1;
  const minScale = computeMinScale(effectiveFitScale);
  const maxAllowedScale = resolveMaxScale(maxScale);
  const effectiveScale = Number.isFinite(scale) ? scale : minScale;

  if (maxAllowedScale < minScale) {
    return minScale;
  }

  return Math.min(Math.max(effectiveScale, minScale), maxAllowedScale);
}

export function getNextModeOnDoubleActivate(mode: ViewerMode): ViewerMode {
  return mode === "oneToOne" ? "fit" : "oneToOne";
}

export function scaleForMode(
  mode: ViewerMode,
  fitScale: number,
  currentScale: number,
): number {
  if (mode === "fit") {
    return fitScale;
  }

  if (mode === "oneToOne") {
    return 1;
  }

  return clampScale(currentScale, fitScale);
}
