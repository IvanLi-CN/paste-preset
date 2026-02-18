function sliceArrayBuffer(view: Uint8Array): ArrayBuffer {
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

function pickSampleIndices(frameCount: number, maxSamples: number): number[] {
  const count = Math.max(1, Math.min(frameCount, maxSamples));
  if (count === 1) return [0];
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    indices.push(Math.round(t * (frameCount - 1)));
  }
  return indices;
}

function analyzeAlpha(frames: Uint8Array[]): {
  hasTransparency: boolean;
  hasSemiTransparency: boolean;
} {
  let hasTransparency = false;
  let hasSemiTransparency = false;

  for (const rgba of frames) {
    for (let i = 3; i < rgba.length; i += 4) {
      const a = rgba[i] ?? 255;
      if (a === 0) {
        hasTransparency = true;
        continue;
      }
      if (a < 255) {
        hasTransparency = true;
        hasSemiTransparency = true;
        break;
      }
    }
    if (hasSemiTransparency) {
      break;
    }
  }

  return { hasTransparency, hasSemiTransparency };
}

export async function encodeGif(
  frames: Uint8Array[],
  width: number,
  height: number,
  delaysMs: number[],
): Promise<Uint8Array> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");

  const sampleIndices = pickSampleIndices(frames.length, 8);
  const totalPixels = width * height;
  const maxSamplePixelsTotal = 80_000;
  const pixelsPerFrame = Math.max(
    1_000,
    Math.floor(maxSamplePixelsTotal / sampleIndices.length),
  );
  const step = Math.max(1, Math.floor(totalPixels / pixelsPerFrame));
  const sampledPixelsPerFrame = Math.ceil(totalPixels / step);
  const sample = new Uint8Array(
    sampleIndices.length * sampledPixelsPerFrame * 4,
  );

  const { hasTransparency, hasSemiTransparency } = analyzeAlpha(frames);
  const alphaThreshold = hasSemiTransparency ? 128 : 1;

  // When transparency is present we reserve palette index 0 for "transparent",
  // and quantize only opaque pixels into indices 1..255. This avoids the
  // lower-precision rgba4444 path (which can introduce visible artifacts),
  // while still keeping transparent pixels distinct from opaque pixels.
  const format = "rgb565" as const;

  let writeOffset = 0;
  for (const frameIndex of sampleIndices) {
    const rgba = frames[frameIndex];
    for (let pixel = 0; pixel < totalPixels; pixel += step) {
      const base = pixel * 4;
      const a = rgba[base + 3] ?? 255;
      if (hasTransparency && a < alphaThreshold) {
        continue;
      }

      sample[writeOffset] = rgba[base] ?? 0;
      sample[writeOffset + 1] = rgba[base + 1] ?? 0;
      sample[writeOffset + 2] = rgba[base + 2] ?? 0;
      sample[writeOffset + 3] = 255;
      writeOffset += 4;
    }
  }

  if (writeOffset === 0 && hasTransparency) {
    // Fallback: if sampling missed opaque pixels but they exist, seed the
    // quantizer with a single opaque pixel so encoding still works.
    const rgba = frames[0];
    for (let pixel = 0; pixel < totalPixels; pixel += 1) {
      const base = pixel * 4;
      const a = rgba[base + 3] ?? 255;
      if (a < alphaThreshold) {
        continue;
      }
      sample[0] = rgba[base] ?? 0;
      sample[1] = rgba[base + 1] ?? 0;
      sample[2] = rgba[base + 2] ?? 0;
      sample[3] = 255;
      writeOffset = 4;
      break;
    }
  }

  const opaquePalette = quantize(
    sample.subarray(0, writeOffset),
    hasTransparency ? 255 : 256,
    { format },
  );

  const palette = hasTransparency
    ? ([[0, 0, 0], ...opaquePalette] as number[][]).slice(0, 256)
    : opaquePalette;

  const gif = GIFEncoder();

  for (let index = 0; index < frames.length; index += 1) {
    const rgba = frames[index];
    const baseBitmap = applyPalette(rgba, opaquePalette, format);

    const bitmap = hasTransparency ? new Uint8Array(totalPixels) : baseBitmap;
    if (hasTransparency) {
      for (let pixel = 0; pixel < totalPixels; pixel += 1) {
        const a = rgba[pixel * 4 + 3] ?? 255;
        if (a < alphaThreshold) {
          bitmap[pixel] = 0;
          continue;
        }
        bitmap[pixel] = Math.min(255, (baseBitmap[pixel] ?? 0) + 1);
      }
    }

    gif.writeFrame(bitmap, width, height, {
      palette: index === 0 ? palette : undefined,
      delay: Math.round(delaysMs[index] ?? 0),
      repeat: index === 0 ? 0 : undefined,
      transparent: hasTransparency,
      transparentIndex: 0,
      // We always encode full-frame bitmaps; when transparency is present,
      // disposing to background avoids "trails" from previous frames showing
      // through transparent pixels.
      dispose: hasTransparency ? 2 : undefined,
    });
  }

  gif.finish();
  return gif.bytes();
}

export async function encodeApng(
  frames: Uint8Array[],
  width: number,
  height: number,
  delaysMs: number[],
): Promise<ArrayBuffer> {
  const upngModule = await import("upng-js");
  const UPNG =
    (upngModule as unknown as { default?: unknown }).default ?? upngModule;

  const imgs = frames.map((frame) => sliceArrayBuffer(frame));
  const dels =
    frames.length > 1 ? delaysMs.map((d) => Math.round(d)) : undefined;
  return (
    UPNG as {
      encode: (
        imgs: ArrayBuffer[],
        w: number,
        h: number,
        cnum: number,
        dels?: number[],
      ) => ArrayBuffer;
    }
  ).encode(imgs, width, height, 0, dels);
}

export async function encodeAnimatedWebp(
  frames: Uint8Array[],
  width: number,
  height: number,
  delaysMs: number[],
): Promise<Uint8Array> {
  const webp = await import("./webpWasm.ts");

  const payload = frames.map((frame, index) => ({
    data: frame,
    duration: Math.round(delaysMs[index] ?? 0),
  }));

  const encoded = await webp.encodeAnimation(width, height, true, payload);
  if (!encoded) {
    throw new Error("image.animatedCodecUnavailable");
  }
  return encoded;
}
