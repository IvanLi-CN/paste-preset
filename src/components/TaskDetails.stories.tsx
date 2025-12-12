import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { ImageInfo } from "../lib/types.ts";
import { TaskDetails } from "./TaskDetails";

const sampleImage = (overrides: Partial<ImageInfo> = {}): ImageInfo => {
  const width = overrides.width ?? 1200;
  const height = overrides.height ?? 800;
  const mimeType = overrides.mimeType ?? "image/jpeg";
  const blob = new Blob(["sample-image"], { type: mimeType });
  const pickLocal = () =>
    width >= 800
      ? "/storybook/sample-800x600.jpg"
      : "/storybook/sample-640x360.jpg";
  return {
    blob,
    url: overrides.url ?? pickLocal(),
    width,
    height,
    mimeType,
    fileSize: blob.size || 2048,
    metadataStripped: false,
    metadata: {
      camera: "Fujifilm X-T5",
      lens: "XF 23mm F2",
      capturedAt: "2024-11-11 10:12",
      exposure: "1/200s",
      aperture: "f/2.8",
      iso: 200,
      focalLength: "23mm",
      location: { latitude: 35.6895, longitude: 139.6917 },
    },
    ...overrides,
  };
};

const meta = {
  title: "Components/TaskDetails",
  component: TaskDetails,
  tags: ["autodocs"],
  args: {
    onCopyResult: fn(),
    originalFileName: "photo.jpg",
  },
} satisfies Meta<typeof TaskDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SourceAndResult: Story = {
  args: {
    source: sampleImage({ metadataStripped: false, mimeType: "image/jpeg" }),
    result: sampleImage({
      mimeType: "image/png",
      metadataStripped: true,
      width: 1000,
      height: 700,
    }),
  },
};

export const ResultOnly: Story = {
  args: {
    source: null,
    result: sampleImage({
      mimeType: "image/webp",
      width: 1024,
      height: 576,
      metadataStripped: true,
    }),
  },
};
