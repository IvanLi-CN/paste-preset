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
      return new Response(this).arrayBuffer();
    };
  }
  // Reset capability flags between tests.
  (globalThis as Record<string, unknown>).OffscreenCanvas = originalOffscreen;
  (globalThis as Record<string, unknown>).createImageBitmap =
    originalCreateImageBitmap;
  (globalThis as Record<string, unknown>).Worker = originalWorker;
});

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
