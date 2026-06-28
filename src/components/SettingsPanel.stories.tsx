import type { Meta, StoryObj } from "@storybook/react";
import type { ImageInfo } from "../lib/types.ts";
import { SettingsPanel } from "./SettingsPanel.tsx";

const sampleImage: ImageInfo = {
  blob: new Blob([], { type: "image/jpeg" }),
  url: "/storybook/sample-800x600.jpg",
  width: 800,
  height: 600,
  mimeType: "image/jpeg",
  fileSize: 97280,
  sourceName: "sample-800x600.jpg",
};

const meta = {
  title: "Components/SettingsPanel",
  component: SettingsPanel,
  tags: ["autodocs"],
  args: {
    currentImage: sampleImage,
  },
  parameters: {
    layout: "centered",
  },
  render: (args) => (
    <section className="w-full max-w-[28rem]">
      <SettingsPanel {...args} />
    </section>
  ),
} satisfies Meta<typeof SettingsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAutoDimensions: Story = {
  args: {
    currentImage: null,
  },
};

export const DarkTheme: Story = {
  args: {
    currentImage: sampleImage,
  },
  parameters: {
    backgrounds: { default: "inverse" },
  },
  render: (args) => (
    <div data-theme="pastepreset-dark" className="w-full max-w-[28rem]">
      <SettingsPanel {...args} />
    </div>
  ),
};
