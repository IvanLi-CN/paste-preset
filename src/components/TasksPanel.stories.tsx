import { expect } from "@storybook/jest";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { userEvent, waitFor, within } from "@storybook/testing-library";
import type { ImageInfo, ImageTask } from "../lib/types.ts";
import { TasksPanel } from "./TasksPanel";

const sampleImage = (overrides: Partial<ImageInfo> = {}): ImageInfo => {
  const blob = new Blob(["sample-image"], { type: "image/png" });
  return {
    blob,
    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO0dOjYfwAIfwN5mDoAuQAAAABJRU5ErkJggg==",
    width: 640,
    height: 360,
    mimeType: "image/png",
    fileSize: blob.size,
    metadataStripped: false,
    ...overrides,
  };
};

const createTask = (overrides: Partial<ImageTask>): ImageTask => ({
  id: overrides.id ?? "task-default",
  fileName: overrides.fileName ?? "image.png",
  status: "queued",
  createdAt: Date.now(),
  ...overrides,
});

const doneTask = createTask({
  id: "task-done",
  fileName: "Finished shot.png",
  status: "done",
  result: sampleImage({ width: 800, height: 600, metadataStripped: true }),
  source: sampleImage({ width: 1200, height: 900 }),
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

    await step("Find and click copy", async () => {
      const copyButton = canvas.getByRole("button", {
        name: /copy to clipboard/i,
      });
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
