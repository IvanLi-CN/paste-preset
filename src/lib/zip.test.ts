// We mock JSZip to avoid environment-specific issues with Blob/ArrayBuffer in Vitest/JSDOM
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageTask } from "./types";
import { buildResultsZip } from "./zip";

// Mock JSZip
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn();

vi.mock("jszip", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      file: mockFile,
      generateAsync: mockGenerateAsync,
    })),
  };
});

describe("buildResultsZip", () => {
  const mockBlob = new Blob(["fake-image-content"], { type: "image/png" });
  // Ensure arrayBuffer is present even if environment Blob is limited
  if (!mockBlob.arrayBuffer) {
    (mockBlob as any).arrayBuffer = async () =>
      new TextEncoder().encode("fake-image-content").buffer;
  } else {
    (mockBlob as any).arrayBuffer = async () =>
      new TextEncoder().encode("fake-image-content").buffer;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAsync.mockResolvedValue(
      new Blob(["fake-zip"], { type: "application/zip" }),
    );
  });

  const createMockTask = (
    id: string,
    status: ImageTask["status"],
    resultMimeType?: string,
    fileName?: string,
  ): ImageTask => ({
    id,
    status,
    createdAt: Date.now(),
    fileName,
    result:
      status === "done" && resultMimeType
        ? {
            blob: mockBlob,
            url: "blob:url",
            width: 100,
            height: 100,
            mimeType: resultMimeType,
            fileSize: 123,
          }
        : undefined,
  });

  it("should return null if there are no done tasks", async () => {
    const tasks = [
      createMockTask("1", "queued"),
      createMockTask("2", "processing"),
      createMockTask("3", "error"),
    ];
    const result = await buildResultsZip(tasks);
    expect(result).toBeNull();
    // JSZip should not be instantiated or used
    expect(JSZip).not.toHaveBeenCalled();
  });

  it("should return null if done tasks have no result (edge case)", async () => {
    const tasks: ImageTask[] = [
      {
        id: "1",
        status: "done",
        createdAt: 123,
      },
    ];
    const result = await buildResultsZip(tasks);
    expect(result).toBeNull();
    expect(JSZip).not.toHaveBeenCalled();
  });

  it("should generate ZIP with correct filename for task with original fileName", async () => {
    const tasks = [createMockTask("1", "done", "image/png", "photo.HEIC")];

    const zipBlob = await buildResultsZip(tasks);
    expect(zipBlob).not.toBeNull();
    expect(JSZip).toHaveBeenCalled();

    // Check file was added with correct name
    expect(mockFile).toHaveBeenCalledTimes(1);
    // "photo.HEIC" -> "photo.png"
    expect(mockFile).toHaveBeenCalledWith("photo.png", expect.anything());
  });

  it("should generate ZIP with timestamp-based filename for task without fileName", async () => {
    const tasks = [createMockTask("1", "done", "image/jpeg")];

    await buildResultsZip(tasks);

    expect(mockFile).toHaveBeenCalledTimes(1);
    const fileNameArg = mockFile.mock.calls[0][0];
    // Expect pastepreset-YYYYMMDD-HHMMSS-1.jpg
    expect(fileNameArg).toMatch(/^pastepreset-\d{8}-\d{6}-1\.jpg$/);
  });

  it("should handle multiple files and infer extensions correctly", async () => {
    const tasks = [
      createMockTask("1", "done", "image/png", "img1.png"),
      createMockTask("2", "done", "image/webp", "img2"), // no ext in original
      createMockTask("3", "done", "image/jpeg", "img3.heic"),
    ];

    await buildResultsZip(tasks);

    expect(mockFile).toHaveBeenCalledTimes(3);

    const calls = mockFile.mock.calls;
    const fileNames = calls.map((c) => c[0]);

    expect(fileNames).toContain("img1.png");
    expect(fileNames).toContain("img2.webp");
    expect(fileNames).toContain("img3.jpg");
  });

  it("should deduplicate filenames", async () => {
    const tasks = [
      createMockTask("1", "done", "image/png", "image.png"),
      createMockTask("2", "done", "image/png", "image.png"),
      createMockTask("3", "done", "image/jpeg", "image.png"),
      createMockTask("4", "done", "image/png", "image.png"),
    ];

    await buildResultsZip(tasks);

    expect(mockFile).toHaveBeenCalledTimes(4);
    const calls = mockFile.mock.calls;
    const fileNames = calls.map((c) => c[0]);

    expect(fileNames).toContain("image.png");
    expect(fileNames).toContain("image (1).png");
    expect(fileNames).toContain("image.jpg");
    expect(fileNames).toContain("image (2).png");
  });
});
