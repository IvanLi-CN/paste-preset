export type EffectiveMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/apng"
  | string;

export interface SniffResult {
  effectiveMimeType: EffectiveMimeType;
  isAnimated: boolean;
}

export interface RgbaFrame {
  rgba: Uint8Array;
  delayMs: number;
}

export interface RgbaAnimation {
  width: number;
  height: number;
  frames: RgbaFrame[];
}

export type CanvasLike = OffscreenCanvas | HTMLCanvasElement;

export type Canvas2DContext =
  | OffscreenCanvasRenderingContext2D
  | CanvasRenderingContext2D;

export interface CanvasBackend<C extends CanvasLike = CanvasLike> {
  createCanvas: (width: number, height: number) => C;
  getContext2D: (canvas: C) => Canvas2DContext;
  canvasToBlob: (
    canvas: C,
    mimeType: string,
    quality?: number,
  ) => Promise<Blob>;
}
