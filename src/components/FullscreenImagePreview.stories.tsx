import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { ImageInfo } from "../lib/types.ts";
import { FullscreenImagePreview } from "./FullscreenImagePreview";

const sampleImage = (
  url: string,
  width: number,
  height: number,
  overrides: Partial<ImageInfo> = {},
): ImageInfo => {
  const blob = new Blob(["sample-image"], {
    type: overrides.mimeType ?? "image/jpeg",
  });
  return {
    blob,
    url,
    width,
    height,
    mimeType: overrides.mimeType ?? "image/jpeg",
    fileSize: overrides.fileSize ?? blob.size,
    metadataStripped: overrides.metadataStripped ?? false,
    metadata: overrides.metadata,
    sourceName: overrides.sourceName ?? url.split("/").pop() ?? "sample.jpg",
  };
};

function PreviewHarness(props: {
  defaultOpen: boolean;
  image: ImageInfo;
  title: string;
}) {
  const { defaultOpen, image, title } = props;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
      >
        Open preview
      </button>
      <FullscreenImagePreview
        open={open}
        image={image}
        title={title}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

const meta = {
  title: "Components/FullscreenImagePreview",
  component: FullscreenImagePreview,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FullscreenImagePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StartsOpen800x600: Story = {
  args: {
    open: true,
    title: "Sample 800×600",
    image: sampleImage("/storybook/sample-800x600.jpg", 800, 600),
    onClose: () => {},
  },
  render: () => (
    <PreviewHarness
      defaultOpen
      title="Sample 800×600"
      image={sampleImage("/storybook/sample-800x600.jpg", 800, 600)}
    />
  ),
};

export const StartsClosed640x360: Story = {
  args: {
    open: false,
    title: "Sample 640×360",
    image: sampleImage("/storybook/sample-640x360.jpg", 640, 360),
    onClose: () => {},
  },
  render: () => (
    <PreviewHarness
      defaultOpen={false}
      title="Sample 640×360"
      image={sampleImage("/storybook/sample-640x360.jpg", 640, 360)}
    />
  ),
};

export const ErrorAndRetry: Story = {
  args: {
    open: true,
    title: "Broken image (retry)",
    image: sampleImage("/storybook/does-not-exist.jpg", 800, 600),
    onClose: () => {},
  },
  render: () => (
    <PreviewHarness
      defaultOpen
      title="Broken image (retry)"
      image={sampleImage("/storybook/does-not-exist.jpg", 800, 600)}
    />
  ),
};
