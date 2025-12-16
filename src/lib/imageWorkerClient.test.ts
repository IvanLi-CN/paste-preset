import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ProcessResult } from "./imageProcessing.ts";
import type { ProcessRequest } from "./imageWorkerTypes.ts";
import type { ProcessingOptions } from "./types.ts";

const processImageBlobMock =
  vi.fn<
    (
      blob: Blob,
      options: ProcessingOptions,
      sourceName?: string,
    ) => Promise<ProcessResult>
  >();

vi.mock("./imageProcessing.ts", async () => {
  const actual = await vi.importActual<typeof import("./imageProcessing.ts")>(
    "./imageProcessing.ts",
  );
  processImageBlobMock.mockImplementation(
    async (blob: Blob, _options: ProcessingOptions, sourceName?: string) => ({
      source: {
        blob,
        url: "blob:source",
        width: 10,
        height: 10,
        mimeType: blob.type || "image/png",
        fileSize: blob.size,
        sourceName,
        metadataStripped: false,
      },
      result: {
        blob,
        url: "blob:result",
        width: 10,
        height: 10,
        mimeType: blob.type || "image/png",
        fileSize: blob.size,
        sourceName,
        metadataStripped: false,
      },
    }),
  );

  return {
    ...actual,
    processImageBlob: processImageBlobMock,
  };
});

const baseOptions: ProcessingOptions = {
  presetId: null,
  targetWidth: null,
  targetHeight: null,
  lockAspectRatio: false,
  resizeMode: "fit",
  outputFormat: "auto",
  quality: null,
  stripMetadata: false,
};

const originalCreateObjectUrl = globalThis.URL.createObjectURL;
const originalOffscreen = (globalThis as Record<string, unknown>)
  .OffscreenCanvas;
const originalCreateImageBitmap = (globalThis as Record<string, unknown>)
  .createImageBitmap;
const originalWorker = (globalThis as Record<string, unknown>).Worker;

beforeEach(() => {
  vi.resetModules();
  processImageBlobMock.mockClear();
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  // Polyfill arrayBuffer on Blob for older JSDOM implementations.
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      if (typeof FileReader !== "undefined") {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () =>
            reject(new Error("Blob.arrayBuffer unavailable"));
          reader.readAsArrayBuffer(this);
        });
      }
      return new Response(this).arrayBuffer();
    };
  }
  // Reset capability flags between tests.
  (globalThis as Record<string, unknown>).OffscreenCanvas = originalOffscreen;
  (globalThis as Record<string, unknown>).createImageBitmap =
    originalCreateImageBitmap;
  (globalThis as Record<string, unknown>).Worker = originalWorker;
});

function makeIsoBmffFtypHeader(majorBrand: string): Uint8Array<ArrayBuffer> {
  const brand = majorBrand.slice(0, 4);
  const buffer = new ArrayBuffer(16);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x00, 0x00, 0x00, 0x10], 0);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  for (let i = 0; i < 4; i += 1) {
    bytes[8 + i] = brand.charCodeAt(i) || 0x00;
  }
  bytes.set([0x00, 0x00, 0x00, 0x00], 12);
  return bytes;
}

describe("processImageViaWorker", () => {
  it("falls back to main thread when OffscreenCanvas is unavailable", async () => {
    (globalThis as Record<string, unknown>).OffscreenCanvas = undefined;
    (globalThis as Record<string, unknown>).createImageBitmap = undefined;
    const { processImageViaWorker } = await import("./imageWorkerClient.ts");

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const result = await processImageViaWorker(blob, baseOptions, "sample.png");

    expect(processImageBlobMock).toHaveBeenCalledTimes(1);
    expect(result.source.mimeType).toBe("image/png");
  });

  it("uses the worker path when supported", async () => {
    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      // eslint-disable-next-line class-methods-use-this
      postMessage(data: ProcessRequest) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: "success",
              id: data.id,
              resultBuffer: new Uint8Array([5, 6, 7]).buffer,
              resultMimeType: "image/png",
              width: 4,
              height: 4,
              sourceWidth: 4,
              sourceHeight: 4,
              metadataStripped: false,
            },
          } as MessageEvent);
        }, 0);
      }
      // eslint-disable-next-line class-methods-use-this
      terminate() {}
    }

    class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "high",
          drawImage: vi.fn(),
          clearRect: vi.fn(),
        };
      }
      convertToBlob = vi.fn(
        async () =>
          new Blob([new Uint8Array([9, 9, 9])], { type: "image/png" }),
      );
    }

    (globalThis as Record<string, unknown>).OffscreenCanvas =
      MockOffscreenCanvas;
    (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(
      async () => ({
        width: 4,
        height: 4,
      }),
    );
    (globalThis as Record<string, unknown>).Worker = MockWorker;

    const { processImageViaWorker } = await import("./imageWorkerClient.ts");

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const result = await processImageViaWorker(blob, baseOptions, "sample.png");

    expect(processImageBlobMock).not.toHaveBeenCalled();
    expect(result.result.width).toBe(4);
    expect(result.result.mimeType).toBe("image/png");
  });

  it("does not default unknown blobs to image/png in worker requests", async () => {
    const posted: ProcessRequest[] = [];

    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      postMessage(data: ProcessRequest) {
        posted.push(data);
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: "success",
              id: data.id,
              resultBuffer: new Uint8Array([5, 6, 7]).buffer,
              resultMimeType: "image/png",
              width: 4,
              height: 4,
              sourceWidth: 4,
              sourceHeight: 4,
              metadataStripped: false,
            },
          } as MessageEvent);
        }, 0);
      }
      terminate() {}
    }

    class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "high",
          drawImage: vi.fn(),
          clearRect: vi.fn(),
        };
      }
      convertToBlob = vi.fn(
        async () =>
          new Blob([new Uint8Array([9, 9, 9])], { type: "image/png" }),
      );
    }

    (globalThis as Record<string, unknown>).OffscreenCanvas =
      MockOffscreenCanvas;
    (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(
      async () => ({
        width: 4,
        height: 4,
      }),
    );
    (globalThis as Record<string, unknown>).Worker = MockWorker;

    const { processImageViaWorker } = await import("./imageWorkerClient.ts");

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "" });
    await processImageViaWorker(blob, baseOptions);

    expect(processImageBlobMock).not.toHaveBeenCalled();
    expect(posted).toHaveLength(1);
    expect(posted[0]?.type).toBe("process");
    expect((posted[0] as { mimeType?: string }).mimeType).toBe(
      "application/octet-stream",
    );
  });

  it("labels HEIC signature payloads as image/heic in worker requests", async () => {
    const posted: ProcessRequest[] = [];

    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      postMessage(data: ProcessRequest) {
        posted.push(data);
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: "success",
              id: data.id,
              resultBuffer: new Uint8Array([5, 6, 7]).buffer,
              resultMimeType: "image/png",
              width: 4,
              height: 4,
              sourceWidth: 4,
              sourceHeight: 4,
              metadataStripped: false,
            },
          } as MessageEvent);
        }, 0);
      }
      terminate() {}
    }

    class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "high",
          drawImage: vi.fn(),
          clearRect: vi.fn(),
        };
      }
      convertToBlob = vi.fn(
        async () =>
          new Blob([new Uint8Array([9, 9, 9])], { type: "image/png" }),
      );
    }

    (globalThis as Record<string, unknown>).OffscreenCanvas =
      MockOffscreenCanvas;
    (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(
      async () => ({
        width: 4,
        height: 4,
      }),
    );
    (globalThis as Record<string, unknown>).Worker = MockWorker;

    const { processImageViaWorker } = await import("./imageWorkerClient.ts");

    const blob = new Blob([makeIsoBmffFtypHeader("heic")], { type: "" });
    await processImageViaWorker(blob, baseOptions);

    expect(posted).toHaveLength(1);
    expect((posted[0] as { mimeType?: string }).mimeType).toBe("image/heic");
  });

  it("uses effective sourceMimeType for bitmap fallback when Blob.type is empty", async () => {
    const posted: ProcessRequest[] = [];

    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      postMessage(data: ProcessRequest) {
        posted.push(data);
        setTimeout(() => {
          if (data.type === "process") {
            this.onmessage?.({
              data: {
                type: "failure",
                id: data.id,
                errorMessage: "image.decodeFailed",
              },
            } as MessageEvent);
            return;
          }
          this.onmessage?.({
            data: {
              type: "success",
              id: data.id,
              resultBuffer: new Uint8Array([5, 6, 7]).buffer,
              resultMimeType: "image/png",
              width: 4,
              height: 4,
              sourceWidth: 4,
              sourceHeight: 4,
              metadataStripped: false,
            },
          } as MessageEvent);
        }, 0);
      }
      terminate() {}
    }

    class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "high",
          drawImage: vi.fn(),
          clearRect: vi.fn(),
        };
      }
      convertToBlob = vi.fn(
        async () =>
          new Blob([new Uint8Array([9, 9, 9])], { type: "image/png" }),
      );
    }

    (globalThis as Record<string, unknown>).OffscreenCanvas =
      MockOffscreenCanvas;
    (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(
      async () => ({
        width: 4,
        height: 4,
      }),
    );
    (globalThis as Record<string, unknown>).Worker = MockWorker;

    const { processImageViaWorker } = await import("./imageWorkerClient.ts");

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "" });
    await processImageViaWorker(blob, baseOptions);

    expect(posted).toHaveLength(2);
    expect(posted[0]?.type).toBe("process");
    expect(posted[1]?.type).toBe("processBitmap");
    expect((posted[1] as { sourceMimeType?: string }).sourceMimeType).toBe(
      "application/octet-stream",
    );
  });
});

afterEach(() => {
  // Restore capability-related globals after each test.
  (globalThis as Record<string, unknown>).OffscreenCanvas = originalOffscreen;
  (globalThis as Record<string, unknown>).createImageBitmap =
    originalCreateImageBitmap;
  (globalThis as Record<string, unknown>).Worker = originalWorker;
});

// Restore shared globals for other suites.
afterAll(() => {
  globalThis.URL.createObjectURL = originalCreateObjectUrl;
});
