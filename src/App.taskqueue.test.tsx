import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { FullscreenImagePreviewProvider } from "./components/FullscreenImagePreviewProvider.tsx";
import { I18nProvider } from "./i18n";
import type { ImageInfo, ImageTask } from "./lib/types";

const copyImageMock = vi.hoisted(() => vi.fn());
const resetClipboardErrorMock = vi.hoisted(() => vi.fn());

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
    copyImage: copyImageMock,
    resetError: resetClipboardErrorMock,
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

const createTask = (overrides: Partial<ImageTask>): ImageTask => ({
  id: "task",
  batchId: "batch",
  batchCreatedAt: 0,
  status: "queued",
  createdAt: 0,
  desiredGeneration: 0,
  ...overrides,
});

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
    copyImageMock.mockReset();
    resetClipboardErrorMock.mockReset();
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
    mockedTasks.push(
      createTask({
        id: "1",
        status: "done",
        completedAt: 1,
        source: sampleImage,
        result: { ...sampleImage, url: "blob:result" },
        attemptGeneration: 0,
        resultGeneration: 0,
      }),
    );

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
      createTask({
        id: "1",
        status: "error",
        completedAt: 3,
        errorMessage: "boom",
        attemptGeneration: 0,
      }),
    ];

    act(() => {
      root.unmount();
    });

    ({ container, root } = renderApp());

    expect(container.textContent?.toLowerCase()).toContain("boom");
  });

  it("Ctrl/Cmd+C targets the active expanded task result", async () => {
    const blob = new Blob(["ok"], { type: "image/png" });
    mockedTasks = [
      createTask({ id: "a", fileName: "a.png", batchId: "b1" }),
      createTask({
        id: "b",
        fileName: "b.png",
        batchId: "b1",
        status: "done",
        result: {
          ...sampleImage,
          blob,
          url: "blob:b",
          sourceName: "b.png",
        },
        resultGeneration: 0,
        attemptGeneration: 0,
      }),
    ];

    act(() => {
      root.render(
        <I18nProvider>
          <FullscreenImagePreviewProvider>
            <App />
          </FullscreenImagePreviewProvider>
        </I18nProvider>,
      );
    });

    const toggles = Array.from(container.querySelectorAll('[role="button"]'));
    const secondToggle = toggles.find((el) =>
      (el.textContent ?? "").includes("b.png"),
    );
    expect(secondToggle).toBeTruthy();

    act(() => {
      secondToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "c", ctrlKey: true }),
      );
    });

    expect(copyImageMock).toHaveBeenCalledTimes(1);
    expect(copyImageMock).toHaveBeenCalledWith(blob, "image/png");
  });

  it("Ctrl/Cmd+C targets the selected task even when its details are collapsed", async () => {
    const blob = new Blob(["ok"], { type: "image/png" });
    mockedTasks = [
      createTask({ id: "a", fileName: "a.png", batchId: "b1" }),
      createTask({
        id: "b",
        fileName: "b.png",
        batchId: "b1",
        status: "done",
        result: {
          ...sampleImage,
          blob,
          url: "blob:b",
          sourceName: "b.png",
        },
        resultGeneration: 0,
        attemptGeneration: 0,
      }),
    ];

    act(() => {
      root.render(
        <I18nProvider>
          <FullscreenImagePreviewProvider>
            <App />
          </FullscreenImagePreviewProvider>
        </I18nProvider>,
      );
    });

    const toggles = Array.from(container.querySelectorAll('[role="button"]'));
    const toggle = toggles.find((el) =>
      (el.textContent ?? "").includes("b.png"),
    );
    expect(toggle).toBeTruthy();

    act(() => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "c", ctrlKey: true }),
      );
    });

    expect(copyImageMock).toHaveBeenCalledTimes(1);
    expect(copyImageMock).toHaveBeenCalledWith(blob, "image/png");
  });

  it("Ctrl/Cmd+C refuses when active task has no up-to-date result", async () => {
    mockedTasks = [
      createTask({
        id: "a",
        fileName: "a.png",
        batchId: "b1",
        status: "done",
        result: { ...sampleImage, url: "blob:a", sourceName: "a.png" },
        desiredGeneration: 1,
        resultGeneration: 0,
        attemptGeneration: 0,
      }),
    ];

    act(() => {
      root.render(
        <I18nProvider>
          <FullscreenImagePreviewProvider>
            <App />
          </FullscreenImagePreviewProvider>
        </I18nProvider>,
      );
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "c", metaKey: true }),
      );
    });

    expect(copyImageMock).toHaveBeenCalledTimes(0);
    expect(container.textContent?.toLowerCase()).toContain("no up-to-date");
  });
});
