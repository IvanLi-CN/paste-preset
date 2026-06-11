import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import type { AppStatus } from "../lib/types.ts";
import type { OfflineReadiness, PwaUpdateStatus } from "../pwa/pwaRuntime.ts";
import { StatusBar } from "./StatusBar";

const meta = {
  title: "Components/StatusBar",
  component: StatusBar,
  tags: ["autodocs"],
  args: {
    status: "idle",
    processingError: null,
    clipboardError: null,
    isOffline: false,
    offlineReadiness: "unsupported",
    updateStatus: "idle",
    onReloadNow: fn(),
    onLater: fn(),
  },
  argTypes: {
    status: {
      control: { type: "select" },
      options: ["idle", "processing", "error"] satisfies AppStatus[],
    },
    updateStatus: {
      control: { type: "select" },
      options: ["idle", "available", "activating"] satisfies PwaUpdateStatus[],
    },
    offlineReadiness: {
      control: { type: "select" },
      options: [
        "shell-ready",
        "warming",
        "full-ready",
        "warmup-failed",
        "unsupported",
      ] satisfies OfflineReadiness[],
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

export const Offline: Story = {
  args: {
    isOffline: true,
    offlineReadiness: "shell-ready",
  },
};

export const OfflineFullReady: Story = {
  args: {
    isOffline: true,
    offlineReadiness: "full-ready",
  },
};

export const OfflineWarmupFailed: Story = {
  args: {
    isOffline: true,
    offlineReadiness: "warmup-failed",
  },
};

export const WarmupRetryHint: Story = {
  args: {
    offlineReadiness: "warmup-failed",
  },
};

export const UpdateAvailable: Story = {
  args: {
    updateStatus: "available",
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const reloadNow = canvas.getByRole("button", { name: "Reload now" });
    const later = canvas.getByRole("button", { name: "Later" });

    await userEvent.click(reloadNow);
    await userEvent.click(later);

    await expect(args.onReloadNow).toHaveBeenCalledTimes(1);
    await expect(args.onLater).toHaveBeenCalledTimes(1);
  },
};

export const ApplyingUpdate: Story = {
  args: {
    updateStatus: "activating",
  },
};

export const OfflineWithUpdate: Story = {
  args: {
    isOffline: true,
    offlineReadiness: "shell-ready",
    updateStatus: "available",
  },
};
