import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ImageInfo, ImageTask } from "../lib/types.ts";
import { FullscreenImagePreviewProvider } from "./FullscreenImagePreviewProvider.tsx";
import { TaskRow } from "./TaskRow.tsx";

// Mock I18n
vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockTask = (overrides: Partial<ImageTask>): ImageTask => ({
  id: "task-1",
  batchId: overrides.batchId ?? "batch-1",
  batchCreatedAt: overrides.batchCreatedAt ?? 1000,
  fileName: "test.png",
  status: "queued",
  createdAt: 1000,
  desiredGeneration: 0,
  ...overrides,
});

const mockImageInfo = (overrides: Partial<ImageInfo> = {}): ImageInfo => ({
  blob: new Blob(["mock"], { type: overrides.mimeType ?? "image/png" }),
  url: "blob:url",
  width: 100,
  height: 100,
  mimeType: overrides.mimeType ?? "image/png",
  fileSize: 10,
  ...overrides,
});

function renderTaskRow({
  task,
  isExpanded = false,
  onCopyResult = vi.fn(),
}: {
  task: ImageTask;
  isExpanded?: boolean;
  onCopyResult?: (taskId: string, blob: Blob, mimeType: string) => unknown;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <FullscreenImagePreviewProvider>
        <TaskRow
          task={task}
          isExpanded={isExpanded}
          isSelected={false}
          onToggleExpand={() => {}}
          onCopyResult={
            onCopyResult as (id: string, blob: Blob, mime: string) => void
          }
        />
      </FullscreenImagePreviewProvider>,
    );
  });

  const cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };

  return { container, cleanup };
}

describe("TaskRow export gating + stale overlay", () => {
  it("disables in-app copy/download when result is stale and shows a hint", () => {
    const onCopy = vi.fn();
    const task = mockTask({
      status: "queued",
      desiredGeneration: 2,
      resultGeneration: 1,
      result: mockImageInfo(),
    });

    const { container, cleanup } = renderTaskRow({
      task,
      onCopyResult: onCopy,
    });

    const copyBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="task-copy"]',
    );
    expect(copyBtn).toBeTruthy();
    expect(copyBtn?.disabled).toBe(true);
    expect(copyBtn?.parentElement?.getAttribute("data-tip")).toBe(
      "export.gate.waiting",
    );

    act(() => {
      copyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCopy).not.toHaveBeenCalled();

    const downloadBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="task-download"]',
    );
    expect(downloadBtn).toBeTruthy();
    expect(downloadBtn?.tagName).toBe("BUTTON");
    expect(downloadBtn?.disabled).toBe(true);
    expect(downloadBtn?.parentElement?.getAttribute("data-tip")).toBe(
      "export.gate.waiting",
    );

    cleanup();
  });

  it("renders a stale pulse overlay in expanded result view", () => {
    const task = mockTask({
      status: "queued",
      desiredGeneration: 2,
      resultGeneration: 1,
      source: mockImageInfo({ url: "blob:source" }),
      result: mockImageInfo({ url: "blob:result" }),
    });

    const { container, cleanup } = renderTaskRow({ task, isExpanded: true });

    const overlays = container.querySelectorAll(
      '[data-testid="image-overlay"]',
    );
    expect(overlays).toHaveLength(1);
    expect(overlays[0].textContent).toContain("preview.result.overlay.waiting");

    cleanup();
  });

  it("shows loading state while copy is in-flight", async () => {
    let resolveCopy: (() => void) | null = null;
    const onCopy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );

    const task = mockTask({
      status: "done",
      desiredGeneration: 3,
      resultGeneration: 3,
      result: mockImageInfo(),
    });

    const { container, cleanup } = renderTaskRow({
      task,
      onCopyResult: onCopy,
    });

    const copyBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="task-copy"]',
    );
    expect(copyBtn).toBeTruthy();
    expect(copyBtn?.disabled).toBe(false);

    act(() => {
      copyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(copyBtn?.querySelector(".loading")).toBeTruthy();

    await act(async () => {
      resolveCopy?.();
      await Promise.resolve();
    });

    expect(copyBtn?.querySelector(".loading")).toBeNull();

    cleanup();
  });
});
