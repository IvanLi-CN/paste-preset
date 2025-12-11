import type { Meta, StoryObj } from "@storybook/react";
import type { ImageInfo } from "../lib/types.ts";
import { ImageCard } from "./ImageCard";

const sampleImage = (overrides: Partial<ImageInfo> = {}): ImageInfo => {
  const blob = new Blob(["sample-image"], {
    type: overrides.mimeType ?? "image/png",
  });
  return {
    blob,
    url:
      overrides.url ?? "https://via.placeholder.com/800x450.png?text=Preview",
    width: overrides.width ?? 800,
    height: overrides.height ?? 450,
    mimeType: overrides.mimeType ?? "image/png",
    fileSize: overrides.fileSize ?? blob.size,
    metadataStripped: overrides.metadataStripped ?? false,
    metadata: overrides.metadata,
    sourceName: overrides.sourceName ?? "sample.png",
  };
};

const meta = {
  title: "Components/ImageCard",
  component: ImageCard,
  tags: ["autodocs"],
} satisfies Meta<typeof ImageCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Source image",
    image: sampleImage(),
  },
};

export const Highlighted: Story = {
  args: {
    title: "Result image",
    highlighted: true,
    image: sampleImage({
      mimeType: "image/webp",
      width: 1024,
      height: 768,
      sourceName: "result.webp",
    }),
  },
};

export const WithMetadata: Story = {
  args: {
    title: "Photo with metadata",
    image: sampleImage({
      metadataStripped: false,
      metadata: {
        camera: "Sony A7IV",
        lens: "35mm F1.8",
        capturedAt: "2024-10-10 08:30",
        exposure: "1/160s",
        aperture: "f/2.8",
        iso: 400,
        focalLength: "35mm",
        location: { latitude: 51.5074, longitude: -0.1278 },
      },
    }),
  },
};
