import { describe, expect, it } from "vitest";

import {
  clampScale,
  computeFitScale,
  computeMinScale,
  getNextModeOnDoubleActivate,
  MAX_PREVIEW_SCALE,
  scaleForMode,
} from "./fullscreenImagePreview";

describe("computeFitScale", () => {
  it("returns < 1 for large images that must be scaled down to fit", () => {
    const fitScale = computeFitScale(
      { width: 1000, height: 500 },
      { width: 2000, height: 1000 },
    );
    expect(fitScale).toBeCloseTo(0.5);
  });

  it("returns 1 when the image exactly matches the viewport", () => {
    const fitScale = computeFitScale(
      { width: 800, height: 600 },
      { width: 800, height: 600 },
    );
    expect(fitScale).toBe(1);
  });

  it("returns > 1 for smaller images (upscaling allowed up to max)", () => {
    const fitScale = computeFitScale(
      { width: 1000, height: 1000 },
      { width: 500, height: 500 },
    );
    expect(fitScale).toBe(2);
  });

  it("clamps very large raw fit scales to MAX_PREVIEW_SCALE", () => {
    const fitScale = computeFitScale(
      { width: 1000, height: 1000 },
      { width: 10, height: 10 },
    );
    expect(fitScale).toBe(MAX_PREVIEW_SCALE);
  });

  it("returns 1 for invalid image dimensions (width = 0)", () => {
    const fitScale = computeFitScale(
      { width: 1000, height: 1000 },
      { width: 0, height: 1000 },
    );
    expect(fitScale).toBe(1);
  });

  it("returns 1 for invalid image dimensions (height = 0)", () => {
    const fitScale = computeFitScale(
      { width: 1000, height: 1000 },
      { width: 1000, height: 0 },
    );
    expect(fitScale).toBe(1);
  });
});

describe("computeMinScale", () => {
  it("returns fitScale when fitScale < 1", () => {
    expect(computeMinScale(0.5)).toBe(0.5);
  });

  it("returns 1 when fitScale = 1", () => {
    expect(computeMinScale(1)).toBe(1);
  });

  it("returns 1 when fitScale > 1", () => {
    expect(computeMinScale(2)).toBe(1);
  });

  it("returns 1 when fitScale = 8", () => {
    expect(computeMinScale(8)).toBe(1);
  });
});

describe("clampScale", () => {
  it("clamps to [fitScale, max] for large images (fitScale < 1)", () => {
    const fitScale = 0.5;
    expect(clampScale(0.1, fitScale)).toBe(0.5);
    expect(clampScale(0.5, fitScale)).toBe(0.5);
    expect(clampScale(2, fitScale)).toBe(2);
    expect(clampScale(9, fitScale)).toBe(MAX_PREVIEW_SCALE);
  });

  it("clamps to [1, max] for small images (fitScale > 1)", () => {
    const fitScale = 2;
    expect(clampScale(0.5, fitScale)).toBe(1);
    expect(clampScale(1, fitScale)).toBe(1);
    expect(clampScale(4, fitScale)).toBe(4);
    expect(clampScale(9, fitScale)).toBe(MAX_PREVIEW_SCALE);
  });
});

describe("getNextModeOnDoubleActivate", () => {
  it("toggles oneToOne -> fit", () => {
    expect(getNextModeOnDoubleActivate("oneToOne")).toBe("fit");
  });

  it("toggles fit -> oneToOne", () => {
    expect(getNextModeOnDoubleActivate("fit")).toBe("oneToOne");
  });

  it("toggles custom -> oneToOne", () => {
    expect(getNextModeOnDoubleActivate("custom")).toBe("oneToOne");
  });
});

describe("scaleForMode", () => {
  it("returns fitScale for fit", () => {
    expect(scaleForMode("fit", 0.75, 2)).toBe(0.75);
  });

  it("returns 1 for oneToOne", () => {
    expect(scaleForMode("oneToOne", 0.75, 0.5)).toBe(1);
  });

  it("clamps currentScale for custom", () => {
    expect(scaleForMode("custom", 0.5, 0.1)).toBe(0.5);
    expect(scaleForMode("custom", 2, 0.5)).toBe(1);
  });
});
