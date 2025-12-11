import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ImageTask } from "../lib/types.ts";
import { TasksPanel } from "./TasksPanel.tsx";

// Mock I18n
vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockTask = (overrides: Partial<ImageTask>): ImageTask => ({
  id: "task-1",
  fileName: "test.png",
  status: "queued",
  createdAt: 1000,
  ...overrides,
});

function renderTasksPanel({
  tasks = [],
  onCopyResult = vi.fn(),
}: {
  tasks?: ImageTask[];
  onCopyResult?: (taskId: string, blob: Blob, mimeType: string) => void;
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<TasksPanel tasks={tasks} onCopyResult={onCopyResult} />);
  });

  const cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };

  return { container, cleanup };
}

describe("TasksPanel", () => {
  it("renders empty state when no tasks", () => {
    const { container, cleanup } = renderTasksPanel({ tasks: [] });
    expect(container.textContent).toContain("preview.empty");
    cleanup();
  });

  it("renders list of tasks", () => {
    const tasks = [
      mockTask({ id: "1", status: "queued" }),
      mockTask({ id: "2", status: "processing" }),
      mockTask({
        id: "3",
        status: "done",
        // biome-ignore lint/suspicious/noExplicitAny: Mocking for test
        result: { width: 100, height: 100 } as any,
      }),
    ];
    const { container, cleanup } = renderTasksPanel({ tasks });

    // Check for task rows.
    // They have class "collapse-title"
    const titles = container.querySelectorAll(".collapse-title");
    expect(titles).toHaveLength(3);

    expect(container.textContent).toContain("status.queued");
    expect(container.textContent).toContain("status.processing");
    expect(container.textContent).toContain("status.done");

    cleanup();
  });

  it("handles single expansion logic", () => {
    const tasks = [mockTask({ id: "1" }), mockTask({ id: "2" })];
    const { container, cleanup } = renderTasksPanel({ tasks });

    const titles = container.querySelectorAll(".collapse-title");
    const collapses = container.querySelectorAll(".collapse");

    // Expand first
    act(() => {
      titles[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

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

    // Expand first
    act(() => {
      titles[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
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

  it("calls onCopyResult when clicking copy button on folded done task", () => {
    const onCopy = vi.fn();
    const tasks = [
      mockTask({
        id: "1",
        status: "done",
        result: {
          blob: "blob",
          mimeType: "image/png",
          width: 100,
          height: 100,
          url: "blob:url",
          fileSize: 10,
          // biome-ignore lint/suspicious/noExplicitAny: Mocking for test
        } as any,
      }),
    ];
    const { container, cleanup } = renderTasksPanel({
      tasks,
      onCopyResult: onCopy,
    });

    // Find copy button in the folded row.
    // It has specific title logic: t("preview.actions.copyLabel") -> "preview.actions.copyLabel" (mocked)
    const copyBtn = container.querySelector(
      'button[title="preview.actions.copyLabel"]',
    );
    expect(copyBtn).toBeTruthy();

    act(() => {
      copyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCopy).toHaveBeenCalledWith("1", "blob", "image/png");

    cleanup();
  });
});
