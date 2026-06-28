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

function renderInAppShell(args: React.ComponentProps<typeof StatusBar>) {
  return (
    <section
      className="app-shell-frame mx-auto flex min-h-[36rem] w-full max-w-5xl flex-col rounded-[1.7rem] px-4 py-4"
      aria-label="Status shell preview"
    >
      <header className="app-panel mb-4 rounded-[1.45rem] px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-2">
            <div className="h-6 w-36 rounded-full bg-base-300" />
            <div className="h-4 w-60 rounded-full bg-base-300/80" />
          </div>
          <div className="h-9 w-24 rounded-2xl bg-base-300" />
        </div>
      </header>

      <StatusBar {...args} />

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <aside className="app-panel rounded-[1.35rem] p-4 lg:w-80">
          <div className="space-y-3">
            <div className="h-4 w-28 rounded-full bg-base-300" />
            <div className="h-10 rounded-2xl bg-base-200" />
            <div className="h-10 rounded-2xl bg-base-200" />
            <div className="h-24 rounded-[20px] bg-base-200" />
          </div>
        </aside>

        <main className="flex flex-1 flex-col gap-4">
          <section className="app-panel rounded-[1.35rem] border-2 border-dashed border-base-300/80 bg-base-100/82 p-5">
            <div className="space-y-3">
              <div className="h-5 w-44 rounded-full bg-base-300" />
              <div className="h-24 rounded-[20px] bg-base-200" />
            </div>
          </section>
          <section className="app-panel rounded-[1.35rem] p-5">
            <div className="space-y-3">
              <div className="h-5 w-40 rounded-full bg-base-300" />
              <div className="h-32 rounded-[20px] bg-base-200" />
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}

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

export const AppShellOfflineStatus: Story = {
  args: {
    isOffline: true,
    offlineReadiness: "shell-ready",
  },
  render: renderInAppShell,
};

export const AppShellOfflineFullReady: Story = {
  args: {
    isOffline: true,
    offlineReadiness: "full-ready",
  },
  render: renderInAppShell,
};

export const AppShellUpdatePrompt: Story = {
  args: {
    updateStatus: "available",
  },
  render: renderInAppShell,
};
