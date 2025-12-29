import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { ImageInfo, ImageTask } from "../lib/types.ts";
import { TaskRow } from "./TaskRow";

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

const taskBase: Omit<ImageTask, "status"> = {
  id: "task-1",
  batchId: "batch-1",
  batchCreatedAt: Date.now(),
  fileName: "sample.png",
  createdAt: Date.now(),
  source: sampleImage({ sourceName: "source.png" }),
  desiredGeneration: 0,
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
      attemptGeneration: 0,
      resultGeneration: 0,
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
