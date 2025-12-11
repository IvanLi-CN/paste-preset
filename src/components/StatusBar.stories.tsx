import type { Meta, StoryObj } from "@storybook/react";
import type { AppStatus } from "../lib/types.ts";
import { StatusBar } from "./StatusBar";

const meta = {
  title: "Components/StatusBar",
  component: StatusBar,
  tags: ["autodocs"],
  args: {
    status: "idle",
    processingError: null,
    clipboardError: null,
  },
  argTypes: {
    status: {
      control: { type: "select" },
      options: ["idle", "processing", "error"] satisfies AppStatus[],
    },
  },
} satisfies Meta<typeof StatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HiddenWhenIdle: Story = {
  args: {
    status: "idle",
  },
};

export const Processing: Story = {
  args: {
    status: "processing",
  },
};

export const WithErrors: Story = {
  args: {
    status: "error",
    processingError: "Failed to process image",
    clipboardError: "Clipboard unavailable",
  },
};

export const ClipboardOnlyError: Story = {
  args: {
    status: "error",
    clipboardError: "Clipboard permission denied",
  },
};
