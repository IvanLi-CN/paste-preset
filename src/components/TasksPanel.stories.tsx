import { expect } from "@storybook/jest";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { userEvent, waitFor, within } from "@storybook/testing-library";
import type { ImageInfo, ImageTask } from "../lib/types.ts";
import { TasksPanel } from "./TasksPanel";

const sampleImage = (overrides: Partial<ImageInfo> = {}): ImageInfo => {
  const width = overrides.width ?? 800;
  const height = overrides.height ?? 600;
  const blob = new Blob(["sample-image"], { type: "image/png" });
  const pickLocal = () =>
    width >= 800
      ? "/storybook/sample-800x600.jpg"
      : "/storybook/sample-640x360.jpg";
  return {
    blob,
    url: overrides.url ?? pickLocal(),
    width,
    height,
    mimeType: "image/png",
    fileSize: blob.size || 1024,
    metadataStripped: false,
    ...overrides,
  };
};

const createTask = (overrides: Partial<ImageTask>): ImageTask => ({
  id: overrides.id ?? "task-default",
  fileName: overrides.fileName ?? "image.png",
  status: "queued",
  createdAt: Date.now(),
  desiredGeneration: 0,
  ...overrides,
});

const doneTask = createTask({
  id: "task-done",
  fileName: "Finished shot.png",
  status: "done",
  result: sampleImage({ width: 800, height: 600, metadataStripped: true }),
  source: sampleImage({ width: 1200, height: 900 }),
  attemptGeneration: 0,
  resultGeneration: 0,
});

const multiTasks = [
  createTask({
    id: "task-queued",
    fileName: "Queued sample.png",
    status: "queued",
  }),
  createTask({
    id: "task-processing",
    fileName: "Processing sample.png",
    status: "processing",
  }),
  doneTask,
];

const meta = {
  title: "Components/TasksPanel",
  component: TasksPanel,
  tags: ["autodocs"],
  args: {
    onCopyResult: fn(),
    onDownloadAll: fn(),
    onClearAll: fn(),
  },
} satisfies Meta<typeof TasksPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    tasks: [],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByText(
          /Paste, drop, or select an image to see the original and processed previews here\./i,
        ),
      ).toBeInTheDocument(),
    );
  },
};

export const SingleDoneTask: Story = {
  args: {
    tasks: [doneTask],
  },
  async play({ canvasElement, step, args }) {
    const canvas = within(canvasElement);

    await step("Check header buttons", async () => {
      const clearBtn = canvas.getByRole("button", { name: /Clear all/i });
      const downloadBtn = canvas.getByRole("button", { name: /Download all/i });
      expect(clearBtn).toBeInTheDocument();
      expect(downloadBtn).toBeEnabled();
    });

    await step("Find and click copy", async () => {
      const copyButton = canvas.getByTestId("task-copy");
      expect(copyButton).toBeEnabled();
      await userEvent.click(copyButton);
    });

    await step("Copy handler called", async () => {
      await waitFor(() =>
        expect(args.onCopyResult).toHaveBeenCalledWith(
          "task-done",
          doneTask.result?.blob,
          doneTask.result?.mimeType,
        ),
      );
    });
  },
};

export const SingleTaskExpanded: Story = {
  args: {
    tasks: [doneTask],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /Finished shot/i });
    const collapse = toggle.closest(".collapse") as HTMLElement | null;
    await waitFor(() => {
      expect(collapse).not.toBeNull();
      expect(collapse).toHaveClass("collapse-open");
    });
  },
};

export const HeaderActions: Story = {
  args: {
    tasks: [
      doneTask,
      createTask({
        id: "task-queued",
        fileName: "Queued.png",
        status: "queued",
      }),
    ],
  },
  async play({ canvasElement, step, args }) {
    const canvas = within(canvasElement);

    const clearBtn = canvas.getByRole("button", { name: /Clear all/i });
    const downloadBtn = canvas.getByRole("button", { name: /Download all/i });

    await step("Download all interaction", async () => {
      expect(downloadBtn).toBeEnabled();
      await userEvent.click(downloadBtn);
      expect(args.onDownloadAll).toHaveBeenCalled();
    });

    await step("Clear all interaction", async () => {
      await userEvent.click(clearBtn);
      expect(args.onClearAll).toHaveBeenCalled();
    });
  },
};

export const MultipleTasksSingleExpand: Story = {
  args: {
    tasks: multiTasks,
  },
  async play({ canvasElement, step }) {
    const canvas = within(canvasElement);

    const queuedToggle = canvas.getByRole("button", {
      name: /queued sample/i,
    });
    const processingToggle = canvas.getByRole("button", {
      name: /processing sample/i,
    });
    const doneToggle = canvas.getByRole("button", {
      name: /finished shot/i,
    });

    const collapseOf = (toggle: HTMLElement) =>
      toggle.closest(".collapse") as HTMLElement;

    await step("Expand first row", async () => {
      await userEvent.click(queuedToggle);
      await waitFor(() =>
        expect(collapseOf(queuedToggle)).toHaveClass("collapse-open"),
      );
      expect(collapseOf(processingToggle)).not.toHaveClass("collapse-open");
      expect(collapseOf(doneToggle)).not.toHaveClass("collapse-open");
    });

    await step("Switch to second row", async () => {
      await userEvent.click(processingToggle);
      await waitFor(() =>
        expect(collapseOf(processingToggle)).toHaveClass("collapse-open"),
      );
      expect(collapseOf(queuedToggle)).not.toHaveClass("collapse-open");
      expect(collapseOf(doneToggle)).not.toHaveClass("collapse-open");
    });

    await step("Collapse second row", async () => {
      await userEvent.click(processingToggle);
      await waitFor(() =>
        expect(collapseOf(processingToggle)).not.toHaveClass("collapse-open"),
      );
      expect(collapseOf(queuedToggle)).not.toHaveClass("collapse-open");
      expect(collapseOf(doneToggle)).not.toHaveClass("collapse-open");
    });
  },
};

export const MultipleTasksMultiExpand: Story = {
  args: {
    tasks: multiTasks,
  },
  async play({ canvasElement, step }) {
    const canvas = within(canvasElement);

    const firstToggle = canvas.getByRole("button", {
      name: /queued sample/i,
    });
    const secondToggle = canvas.getByRole("button", {
      name: /processing sample/i,
    });

    const collapseOf = (toggle: HTMLElement) =>
      toggle.closest(".collapse") as HTMLElement;

    await step("Expand first row", async () => {
      await userEvent.click(firstToggle);
      await waitFor(() =>
        expect(collapseOf(firstToggle)).toHaveClass("collapse-open"),
      );
    });

    await step("Shift+click to expand second row", async () => {
      const shiftClick = new MouseEvent("click", {
        bubbles: true,
        shiftKey: true,
      });
      secondToggle.dispatchEvent(shiftClick);
      await waitFor(() =>
        expect(collapseOf(secondToggle)).toHaveClass("collapse-open"),
      );
      expect(collapseOf(firstToggle)).toHaveClass("collapse-open");
    });
  },
};
