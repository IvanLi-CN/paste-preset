import type { Meta, StoryObj } from "@storybook/react";
import { BrandHeader } from "./BrandHeader.tsx";
import { LanguageSelector } from "./LanguageSelector.tsx";

const meta = {
  title: "Components/BrandHeader",
  component: BrandHeader,
  tags: ["autodocs"],
  args: {
    title: "PastePreset",
    tagline:
      "Paste or drop an image, resize and convert it entirely in your browser.",
  },
  render: (args) => (
    <section className="app-panel mx-auto w-full max-w-5xl rounded-[1.4rem] p-5">
      <BrandHeader {...args} />
    </section>
  ),
} satisfies Meta<typeof BrandHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLanguageSelector: Story = {
  args: {
    action: <LanguageSelector />,
  },
};

export const NarrowShell: Story = {
  args: {
    action: <LanguageSelector />,
    tagline:
      "Clipboard-first image cleanup with side-by-side preview and local-only processing.",
  },
  render: (args) => (
    <section className="app-panel w-full max-w-sm rounded-[1.4rem] p-4">
      <BrandHeader {...args} />
    </section>
  ),
};

export const DarkTheme: Story = {
  args: {
    action: <LanguageSelector />,
  },
  parameters: {
    backgrounds: { default: "inverse" },
  },
  render: (args) => (
    <div
      data-theme="pastepreset-dark"
      className="rounded-[1.5rem] bg-transparent p-5"
    >
      <section className="app-panel mx-auto w-full max-w-5xl rounded-[1.4rem] p-5">
        <BrandHeader {...args} />
      </section>
    </div>
  ),
};
