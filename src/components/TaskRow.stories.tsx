import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { ImageInfo, ImageTask } from "../lib/types.ts";
import { TaskRow } from "./TaskRow";

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

const taskBase: Omit<ImageTask, "status"> = {
  id: "task-1",
  fileName: "sample.png",
  createdAt: Date.now(),
  source: sampleImage({ sourceName: "source.png" }),
};

const meta = {
  title: "Components/TaskRow",
  component: TaskRow,
  tags: ["autodocs"],
  args: {
    isExpanded: false,
    onToggleExpand: fn(),
    onCopyResult: fn(),
  },
} satisfies Meta<typeof TaskRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Queued: Story = {
  args: {
    task: {
      ...taskBase,
      id: "task-queued",
      status: "queued",
    },
  },
};

export const Processing: Story = {
  args: {
    task: {
      ...taskBase,
      id: "task-processing",
      status: "processing",
    },
  },
};

export const DoneWithResult: Story = {
  args: {
    isExpanded: true,
    task: {
      ...taskBase,
      id: "task-done",
      status: "done",
      result: sampleImage({
        width: 800,
        height: 600,
        metadataStripped: true,
        sourceName: "processed.png",
      }),
    },
  },
};

export const ErrorState: Story = {
  args: {
    task: {
      ...taskBase,
      id: "task-error",
      status: "error",
      errorMessage: "Failed to process image",
    },
  },
};
