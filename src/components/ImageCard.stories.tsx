import { expect } from "@storybook/jest";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, waitFor, within } from "@storybook/testing-library";
import type { ImageInfo } from "../lib/types.ts";
import { ImageCard } from "./ImageCard";

const sampleImage = (overrides: Partial<ImageInfo> = {}): ImageInfo => {
  const width = overrides.width ?? 800;
  const height = overrides.height ?? 450;
  const blob = new Blob(["sample-image"], {
    type: overrides.mimeType ?? "image/png",
  });
  const pickLocal = () =>
    width >= 800
      ? "/storybook/sample-800x600.jpg"
      : "/storybook/sample-640x360.jpg";
  return {
    blob,
    url: overrides.url ?? pickLocal(),
    width,
    height,
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

export const OpensFullscreenPreview: Story = {
  args: {
    title: "Source image",
    image: sampleImage(),
  },
  parameters: {
    layout: "fullscreen",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: args.title });

    await userEvent.click(trigger);
    await waitFor(() =>
      expect(document.querySelector("dialog.modal")).not.toBeNull(),
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(document.querySelector("dialog.modal")).toBeNull(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
