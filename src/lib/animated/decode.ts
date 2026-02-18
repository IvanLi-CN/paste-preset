import type {
  CanvasBackend,
  CanvasLike,
  RgbaAnimation,
  RgbaFrame,
  SniffResult,
} from "./animatedTypes";
import { MAX_ANIM_FRAMES, normalizeFrameDelayMs } from "./constants";

function sliceArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.buffer instanceof ArrayBuffer) {
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function decodeGif<C extends CanvasLike>(
  bytes: Uint8Array,
  backend: CanvasBackend<C>,
): Promise<RgbaAnimation> {
  const { parseGIF, decompressFrames } = await import("gifuct-js");
  const gif = parseGIF(sliceArrayBuffer(bytes));

  const width = gif?.lsd?.width as number | undefined;
  const height = gif?.lsd?.height as number | undefined;

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("image.decodeFailed");
  }

  const rawFrames = decompressFrames(gif, true) as Array<{
    delay?: number;
    disposalType?: number;
    dims: { left: number; top: number; width: number; height: number };
    patch: Uint8ClampedArray;
  }>;

  if (rawFrames.length > MAX_ANIM_FRAMES) {
    throw new Error("image.tooManyFrames");
  }

  const canvas = backend.createCanvas(width, height);
  const ctx = backend.getContext2D(canvas);
  ctx.clearRect(0, 0, width, height);

  const frames: RgbaFrame[] = [];

  for (const frame of rawFrames) {
    const { dims } = frame;
    const delayMs = normalizeFrameDelayMs(frame.delay);

    const restoreToPrevious = frame.disposalType === 3;
    const before = restoreToPrevious
      ? ctx.getImageData(0, 0, width, height)
      : null;

    const patch = frame.patch;
    const patchImage = ctx.createImageData(dims.width, dims.height);
    patchImage.data.set(patch);
    ctx.putImageData(patchImage, dims.left, dims.top);

    const composed = ctx.getImageData(0, 0, width, height);
    frames.push({ rgba: new Uint8Array(composed.data.buffer), delayMs });

    // Disposal methods:
    // 0/1: keep; 2: clear to transparent; 3: restore to previous.
    if (frame.disposalType === 2) {
      ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
    } else if (restoreToPrevious && before) {
      ctx.putImageData(before, 0, 0);
    }
  }

  return { width, height, frames };
}

async function decodeApng(bytes: Uint8Array): Promise<RgbaAnimation> {
  const upngModule = await import("upng-js");
  const UPNG =
    (upngModule as unknown as { default?: unknown }).default ?? upngModule;

  type UPNGDecodedImage = {
    width: number;
    height: number;
    frames?: Array<{ delay?: number }>;
  };

  type UPNGApi = {
    decode: (buffer: ArrayBuffer) => UPNGDecodedImage;
    toRGBA8: (img: UPNGDecodedImage) => ArrayBuffer[];
  };

  const api = UPNG as unknown as UPNGApi;
  const decoded = api.decode(sliceArrayBuffer(bytes));
  const rgbaFrames = api.toRGBA8(decoded);

  const width = decoded?.width as number | undefined;
  const height = decoded?.height as number | undefined;

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("image.decodeFailed");
  }

  if (rgbaFrames.length > MAX_ANIM_FRAMES) {
    throw new Error("image.tooManyFrames");
  }

  const delays = Array.isArray(decoded.frames)
    ? decoded.frames.map((f) => f.delay)
    : [];

  const frames: RgbaFrame[] = rgbaFrames.map((frameBuffer, index) => ({
    rgba: new Uint8Array(frameBuffer),
    delayMs: normalizeFrameDelayMs(delays[index]),
  }));

  return { width, height, frames };
}

async function decodeAnimatedWebp(bytes: Uint8Array): Promise<RgbaAnimation> {
  const webp = await import("./webpWasm.ts");
  const decodedFrames = await webp.decodeAnimation(bytes, true);

  if (!decodedFrames || decodedFrames.length === 0) {
    throw new Error("image.decodeFailed");
  }

  if (decodedFrames.length > MAX_ANIM_FRAMES) {
    throw new Error("image.tooManyFrames");
  }

  const width = decodedFrames[0].width;
  const height = decodedFrames[0].height;

  const frames: RgbaFrame[] = decodedFrames.map((frame) => ({
    rgba: frame.data,
    delayMs: normalizeFrameDelayMs(frame.duration),
  }));

  return { width, height, frames };
}

export async function decodeAnimatedImage<C extends CanvasLike>(
  bytes: Uint8Array,
  sniffed: SniffResult,
  backend: CanvasBackend<C>,
): Promise<RgbaAnimation> {
  if (sniffed.effectiveMimeType === "image/gif") {
    return decodeGif(bytes, backend);
  }
  if (sniffed.effectiveMimeType === "image/apng") {
    return decodeApng(bytes);
  }
  if (sniffed.effectiveMimeType === "image/webp" && sniffed.isAnimated) {
    return decodeAnimatedWebp(bytes);
  }

  throw new Error("image.decodeFailed");
}
