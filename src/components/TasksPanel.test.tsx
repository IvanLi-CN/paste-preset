import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ImageInfo, ImageTask } from "../lib/types.ts";
import { FullscreenImagePreviewProvider } from "./FullscreenImagePreviewProvider.tsx";
import { TasksPanel } from "./TasksPanel.tsx";

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

function renderTasksPanel({
  tasks = [],
  onCopyResult = vi.fn(),
  onRotateTask90,
  onClearAll = vi.fn(),
  onExpandedIdsChange,
  onActiveTaskIdChange,
}: {
  tasks?: ImageTask[];
  onCopyResult?: (taskId: string, blob: Blob, mimeType: string) => void;
  onRotateTask90?: (taskId: string) => void;
  onClearAll?: () => void;
  onExpandedIdsChange?: (expandedIds: ReadonlySet<string>) => void;
  onActiveTaskIdChange?: (taskId: string | null) => void;
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const baseProps = {
    onCopyResult,
    onRotateTask90,
    onClearAll,
    onExpandedIdsChange,
    onActiveTaskIdChange,
  };

  const render = (
    override: Partial<typeof baseProps> & { tasks?: ImageTask[] } = {},
  ) => {
    act(() => {
      root.render(
        <FullscreenImagePreviewProvider>
          <TasksPanel
            tasks={override.tasks ?? tasks}
            onCopyResult={override.onCopyResult ?? baseProps.onCopyResult}
            onRotateTask90={override.onRotateTask90 ?? baseProps.onRotateTask90}
            onClearAll={override.onClearAll ?? baseProps.onClearAll}
            onExpandedIdsChange={
              override.onExpandedIdsChange ?? baseProps.onExpandedIdsChange
            }
            onActiveTaskIdChange={
              override.onActiveTaskIdChange ?? baseProps.onActiveTaskIdChange
            }
          />
        </FullscreenImagePreviewProvider>,
      );
    });
  };

  render();

  const cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };

  return { container, cleanup, rerender: render };
}

describe("TasksPanel", () => {
  it("renders empty state when no tasks", () => {
    const { container, cleanup } = renderTasksPanel({ tasks: [] });
    // Should NOT show header actions if empty (implemented logic)
    expect(container.textContent).toContain("preview.empty");
    expect(
      container.querySelector('button[title="Clear all tasks"]'),
    ).toBeNull();
    cleanup();
  });

  it("renders list of tasks and header actions", () => {
    const tasks = [
      mockTask({ id: "1", status: "queued" }),
      mockTask({ id: "2", status: "processing" }),
      mockTask({
        id: "3",
        status: "done",
        result: mockImageInfo(),
        attemptGeneration: 0,
        resultGeneration: 0,
      }),
    ];
    const { container, cleanup } = renderTasksPanel({ tasks });

    // Check header actions exist
    expect(
      container.querySelector('button[title="Clear all tasks"]'),
    ).toBeTruthy();

    const titles = container.querySelectorAll(".collapse-title");
    expect(titles).toHaveLength(3);

    expect(container.textContent).toContain("status.queued");
    expect(container.textContent).toContain("status.processing");
    expect(container.textContent).toContain("status.done");

    cleanup();
  });

  it("groups tasks by batch with newest batch first", () => {
    const tasks = [
      mockTask({ id: "n1", fileName: "new-1.png", batchId: "batch-new" }),
      mockTask({ id: "n2", fileName: "new-2.png", batchId: "batch-new" }),
      mockTask({ id: "o1", fileName: "old-1.png", batchId: "batch-old" }),
    ];
    const { container, cleanup } = renderTasksPanel({ tasks });

    const separators = Array.from(
      container.querySelectorAll('[data-testid="task-batch-separator"]'),
    );
    expect(separators).toHaveLength(2);
    expect(separators[0]?.getAttribute("data-batch-id")).toBe("batch-new");
    expect(separators[1]?.getAttribute("data-batch-id")).toBe("batch-old");

    const titles = Array.from(
      container.querySelectorAll(".collapse-title"),
    ).map((el) => el.textContent ?? "");
    expect(titles.join("|")).toContain("new-1.png");
    expect(titles.join("|")).toContain("new-2.png");
    expect(titles.join("|")).toContain("old-1.png");

    cleanup();
  });

  it("handles single expansion logic", () => {
    const tasks = [mockTask({ id: "1" }), mockTask({ id: "2" })];
    const { container, cleanup } = renderTasksPanel({ tasks });

    const titles = container.querySelectorAll(".collapse-title");
    const collapses = container.querySelectorAll(".collapse");

    // First task auto-expands when a new batch is inserted.
    expect(collapses[0].classList.contains("collapse-open")).toBe(true);
    expect(
      collapses[1].classList.contains("collapse-close") ||
        !collapses[1].classList.contains("collapse-open"),
    ).toBe(true);

    // Click second -> First collapses, Second expands
    act(() => {
      titles[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(collapses[0].classList.contains("collapse-open")).toBe(false);
    expect(collapses[1].classList.contains("collapse-open")).toBe(true);

    // Click second again -> Second collapses
    act(() => {
      titles[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(collapses[1].classList.contains("collapse-open")).toBe(false);

    cleanup();
  });

  it("handles multi expansion logic", () => {
    const tasks = [mockTask({ id: "1" }), mockTask({ id: "2" })];
    const { container, cleanup } = renderTasksPanel({ tasks });

    const titles = container.querySelectorAll(".collapse-title");
    const collapses = container.querySelectorAll(".collapse");

    expect(collapses[0].classList.contains("collapse-open")).toBe(true);

    // Shift+Click second -> First stays expanded, Second expands
    act(() => {
      titles[1].dispatchEvent(
        new MouseEvent("click", { bubbles: true, shiftKey: true }),
      );
    });

    expect(collapses[0].classList.contains("collapse-open")).toBe(true);
    expect(collapses[1].classList.contains("collapse-open")).toBe(true);

    cleanup();
  });

  it("collapses previous expansions and auto-expands first task when a new batch arrives", () => {
    const onActiveTaskIdChange = vi.fn();

    const initialTasks = [
      mockTask({ id: "old-1", fileName: "old-1.png", batchId: "batch-old" }),
      mockTask({ id: "old-2", fileName: "old-2.png", batchId: "batch-old" }),
    ];

    const { container, cleanup, rerender } = renderTasksPanel({
      tasks: initialTasks,
      onActiveTaskIdChange,
    });

    const titles = container.querySelectorAll(".collapse-title");
    const collapses = container.querySelectorAll(".collapse");

    expect(collapses[0]?.classList.contains("collapse-open")).toBe(true);

    act(() => {
      titles[1]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, shiftKey: true }),
      );
    });

    expect(
      Array.from(container.querySelectorAll(".collapse-open")),
    ).toHaveLength(2);
    expect(onActiveTaskIdChange).toHaveBeenLastCalledWith("old-2");

    const nextTasks = [
      mockTask({ id: "new-1", fileName: "new-1.png", batchId: "batch-new" }),
      mockTask({ id: "new-2", fileName: "new-2.png", batchId: "batch-new" }),
      ...initialTasks,
    ];

    rerender({ tasks: nextTasks });

    const open = Array.from(container.querySelectorAll(".collapse-open"));
    expect(open).toHaveLength(1);
    expect(container.textContent).toContain("new-1.png");
    expect(onActiveTaskIdChange).toHaveBeenLastCalledWith("new-1");

    cleanup();
  });

  it("calls onCopyResult when clicking copy button on folded done task", () => {
    const onCopy = vi.fn();
    const tasks = [
      mockTask({
        id: "1",
        status: "done",
        result: mockImageInfo(),
        resultGeneration: 0,
      }),
    ];
    const { container, cleanup } = renderTasksPanel({
      tasks,
      onCopyResult: onCopy,
    });

    const copyBtn = container.querySelector(
      'button[title="preview.actions.copyLabel"]',
    );
    expect(copyBtn).toBeTruthy();

    act(() => {
      copyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCopy).toHaveBeenCalledWith(
      "1",
      tasks[0].result?.blob,
      "image/png",
    );

    cleanup();
  });

  it("calls onRotateTask90 when clicking rotate button without toggling expansion", () => {
    const onRotate = vi.fn();
    const tasks = [mockTask({ id: "1", status: "queued" })];
    const { container, cleanup } = renderTasksPanel({
      tasks,
      onRotateTask90: onRotate,
    });

    const collapse = container.querySelector(".collapse");
    expect(collapse?.classList.contains("collapse-open")).toBe(true);

    const rotateBtn = container.querySelector(
      'button[title="preview.actions.rotate90Label"]',
    );
    expect(rotateBtn).toBeTruthy();

    act(() => {
      rotateBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRotate).toHaveBeenCalledWith("1");
    expect(collapse?.classList.contains("collapse-open")).toBe(true);

    cleanup();
  });

  it("calls onClearAll when clicking Clear all button", () => {
    const onClear = vi.fn();
    const tasks = [mockTask({ id: "1", status: "queued" })];
    const { container, cleanup } = renderTasksPanel({
      tasks,
      onClearAll: onClear,
    });

    const clearBtn = container.querySelector('button[title="Clear all tasks"]');
    expect(clearBtn).toBeTruthy();

    act(() => {
      clearBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClear).toHaveBeenCalled();
    cleanup();
  });

  it("auto expands when transitioning from 0 to 1 task", () => {
    const singleTask = mockTask({ id: "solo" });
    const { container, rerender, cleanup } = renderTasksPanel({ tasks: [] });

    rerender({ tasks: [singleTask] });

    const collapse = container.querySelector(".collapse");
    expect(collapse).toBeTruthy();
    expect(collapse?.classList.contains("collapse-open")).toBe(true);
    cleanup();
  });

  it("keeps single task collapsed if user collapses it", () => {
    const singleTask = mockTask({ id: "solo" });
    const { container, rerender, cleanup } = renderTasksPanel({
      tasks: [singleTask],
    });

    const title = container.querySelector(".collapse-title");
    expect(title).toBeTruthy();

    act(() => {
      title?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const collapse = container.querySelector(".collapse");
    expect(collapse?.classList.contains("collapse-open")).toBe(false);

    // simulate task status update without clearing list
    rerender({
      tasks: [{ ...singleTask, status: "processing" }],
    });

    const collapseAfterUpdate = container.querySelector(".collapse");
    expect(collapseAfterUpdate?.classList.contains("collapse-open")).toBe(
      false,
    );
    cleanup();
  });

  it("keeps first task expanded and new task folded when adding second task", () => {
    const first = mockTask({ id: "first" });
    const second = mockTask({ id: "second" });
    const { container, rerender, cleanup } = renderTasksPanel({
      tasks: [first],
    });

    const firstCollapse = container.querySelector(".collapse");
    expect(firstCollapse?.classList.contains("collapse-open")).toBe(true);

    rerender({ tasks: [first, second] });

    const collapses = container.querySelectorAll(".collapse");
    expect(collapses).toHaveLength(2);
    expect(collapses[0].classList.contains("collapse-open")).toBe(true);
    expect(collapses[1].classList.contains("collapse-open")).toBe(false);
    cleanup();
  });
});
