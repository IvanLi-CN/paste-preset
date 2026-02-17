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

  let needsTransparency = false;
  let writeOffset = 0;
  for (const frameIndex of sampleIndices) {
    const rgba = frames[frameIndex];
    for (let pixel = 0; pixel < totalPixels; pixel += step) {
      const base = pixel * 4;
      const r = rgba[base] ?? 0;
      const g = rgba[base + 1] ?? 0;
      const b = rgba[base + 2] ?? 0;
      const a = rgba[base + 3] ?? 255;
      if (a < 255) needsTransparency = true;
      sample[writeOffset] = r;
      sample[writeOffset + 1] = g;
      sample[writeOffset + 2] = b;
      sample[writeOffset + 3] = a;
      writeOffset += 4;
    }
  }

  const format = needsTransparency ? "rgba4444" : "rgb565";
  const palette = (() => {
    const basePalette = quantize(
      sample,
      256,
      needsTransparency ? { format, oneBitAlpha: true } : { format },
    );
    if (!needsTransparency) {
      return basePalette;
    }

    // Ensure a fully transparent color exists at index 0 so we can reliably
    // encode 1-bit transparency.
    const idx = basePalette.findIndex(
      (color: number[]) => color.length === 4 && color[3] === 0,
    );
    if (idx === 0) return basePalette;
    if (idx > 0) {
      const [transparent] = basePalette.splice(idx, 1);
      basePalette.unshift(transparent);
      return basePalette;
    }

    basePalette.unshift([0, 0, 0, 0]);
    return basePalette.slice(0, 256);
  })();

  const transparentIndex = 0;
  const gif = GIFEncoder();

  for (let index = 0; index < frames.length; index += 1) {
    const rgba = frames[index];
    const bitmap = applyPalette(rgba, palette, format);
    gif.writeFrame(bitmap, width, height, {
      palette: index === 0 ? palette : undefined,
      delay: Math.round(delaysMs[index] ?? 0),
      repeat: index === 0 ? 0 : undefined,
      transparent: needsTransparency,
      transparentIndex,
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
