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
    <section className="mx-auto w-full max-w-5xl rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-sm">
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
    <section className="w-full max-w-sm rounded-[28px] border border-base-300 bg-base-100 p-4 shadow-sm">
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
    <div data-theme="dim" className="rounded-[28px] bg-base-200 p-5">
      <section className="mx-auto w-full max-w-5xl rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-sm">
        <BrandHeader {...args} />
      </section>
    </div>
  ),
};
