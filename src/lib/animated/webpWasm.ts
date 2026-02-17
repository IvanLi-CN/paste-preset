export interface WebpDecodedFrame {
  width: number;
  height: number;
  duration: number;
  data: Uint8Array;
}

type WebpModuleInstance = {
  decodeAnimation: (
    data: Uint8Array,
    hasAlpha: boolean,
  ) => Promise<WebpDecodedFrame[]>;
  encodeAnimation: (
    width: number,
    height: number,
    hasAlpha: boolean,
    durations: number[],
    data: Uint8Array,
  ) => Promise<Uint8Array>;
};

type WebpModuleFactory = (moduleArg?: {
  locateFile?: (path: string, scriptDirectory: string) => string;
}) => Promise<WebpModuleInstance>;

let modulePromise: Promise<WebpModuleInstance> | null = null;

async function getWebpModule(): Promise<WebpModuleInstance> {
  if (modulePromise) {
    return modulePromise;
  }

  modulePromise = (async () => {
    const [{ default: createModule }, wasmUrlModule] = await Promise.all([
      import("wasm-webp/dist/esm/webp-wasm.js"),
      import("wasm-webp/dist/esm/webp-wasm.wasm?url"),
    ]);

    const wasmUrl = (wasmUrlModule as { default: string }).default;

    return (createModule as unknown as WebpModuleFactory)({
      locateFile: (path) => {
        // Emscripten will request the wasm by its original filename.
        if (path.endsWith(".wasm")) {
          return wasmUrl;
        }
        return path;
      },
    });
  })();

  return modulePromise;
}

export async function decodeAnimation(
  data: Uint8Array,
  hasAlpha: boolean,
): Promise<WebpDecodedFrame[]> {
  const module = await getWebpModule();
  return await module.decodeAnimation(data, hasAlpha);
}

export async function encodeAnimation(
  width: number,
  height: number,
  hasAlpha: boolean,
  frames: Array<{ data: Uint8Array; duration: number }>,
): Promise<Uint8Array> {
  const module = await getWebpModule();

  const durations: number[] = [];
  const dataLength = frames.reduce((acc, frame) => acc + frame.data.length, 0);
  const data = new Uint8Array(dataLength);

  let offset = 0;
  for (const frame of frames) {
    data.set(frame.data, offset);
    offset += frame.data.length;
    durations.push(frame.duration);
  }

  return await module.encodeAnimation(width, height, hasAlpha, durations, data);
}
