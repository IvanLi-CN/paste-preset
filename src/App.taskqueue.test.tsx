import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { FullscreenImagePreviewProvider } from "./components/FullscreenImagePreviewProvider.tsx";
import { I18nProvider } from "./i18n";
import type { ImageInfo, ImageTask } from "./lib/types";

vi.mock("./hooks/useUserPresets.tsx", () => ({
  useUserPresets: () => ({ presets: [], activePresetId: null }),
}));

vi.mock("./hooks/useUserSettings.tsx", () => ({
  useUserSettings: () => ({
    settings: {
      presetId: null,
      targetWidth: null,
      targetHeight: null,
      lockAspectRatio: false,
      resizeMode: "fit",
      outputFormat: "auto",
      quality: null,
      stripMetadata: false,
    },
    processingOptions: {
      presetId: null,
      targetWidth: null,
      targetHeight: null,
      lockAspectRatio: false,
      resizeMode: "fit",
      outputFormat: "auto",
      quality: null,
      stripMetadata: false,
    },
  }),
}));

vi.mock("./hooks/useAppVersion.ts", () => ({
  useAppVersion: () => ({ version: "test" }),
}));

vi.mock("./hooks/useClipboard.ts", () => ({
  useClipboard: () => ({
    isCopying: false,
    errorMessage: null,
    copyImage: vi.fn(),
    resetError: vi.fn(),
  }),
}));

const enqueueFilesMock = vi.fn();
const clearAllMock = vi.fn();

vi.mock("./hooks/useImageTaskQueue", () => ({
  useImageTaskQueue: () => ({
    tasks: mockedTasks,
    enqueueFiles: enqueueFilesMock,
    clearAll: clearAllMock,
  }),
  getLastCompletedTask: (tasks: ImageTask[]) =>
    [...tasks]
      .filter((task) => task.status === "done")
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0],
}));

let mockedTasks: ImageTask[] = [];

const sampleImage: ImageInfo = {
  blob: new Blob(["x"], { type: "image/png" }),
  url: "blob:x",
  width: 1,
  height: 1,
  mimeType: "image/png",
  fileSize: 1,
  sourceName: "x.png",
  metadataStripped: false,
};

function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <I18nProvider>
        <FullscreenImagePreviewProvider>
          <App />
        </FullscreenImagePreviewProvider>
      </I18nProvider>,
    );
  });
  return { container, root };
}

describe("App integrates task queue", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    enqueueFilesMock.mockReset();
    clearAllMock.mockReset();
    mockedTasks = [];
    ({ container, root } = renderApp());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("passes multiple pasted files as one batch to enqueueFiles", () => {
    const button = container.querySelector("button");
    const files = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ];

    const fakeEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(fakeEvent, "clipboardData", {
      value: {
        items: files.map((file) => ({
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        })),
        files,
      },
    });

    button?.dispatchEvent(fakeEvent);

    expect(enqueueFilesMock).toHaveBeenCalledTimes(1);
    const [batch] = enqueueFilesMock.mock.calls[0];
    expect(batch).toHaveLength(2);
    expect(batch.map((f: File) => f.name)).toEqual(["a.png", "b.png"]);
  });

  it("shows latest completed task in preview", () => {
    mockedTasks.push({
      id: "1",
      status: "done",
      createdAt: 0,
      completedAt: 1,
      source: sampleImage,
      result: { ...sampleImage, url: "blob:result" },
      desiredGeneration: 0,
      attemptGeneration: 0,
      resultGeneration: 0,
    });

    act(() => {
      root.unmount();
    });

    ({ container, root } = renderApp());

    const imgs = Array.from(container.querySelectorAll("img"));
    const sources = imgs.map((img) => img.getAttribute("src"));
    expect(sources).toContain("blob:result");
  });

  it("surfaces latest error from tasks", () => {
    mockedTasks = [
      {
        id: "1",
        status: "error",
        createdAt: 0,
        completedAt: 3,
        errorMessage: "boom",
        desiredGeneration: 0,
        attemptGeneration: 0,
      },
    ];

    act(() => {
      root.unmount();
    });

    ({ container, root } = renderApp());

    expect(container.textContent?.toLowerCase()).toContain("boom");
  });
});
