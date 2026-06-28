import { expect } from "@storybook/jest";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, waitFor, within } from "@storybook/testing-library";
import App from "./App.tsx";

const SETTINGS_KEY = "paste-preset:user-settings:v1";
const PRESETS_KEY = "paste-preset:user-presets:v1";
const sampleFixture = "/storybook/sample-800x600.jpg";

function resetStoryStorage() {
  window.localStorage.removeItem(SETTINGS_KEY);
  window.localStorage.removeItem(PRESETS_KEY);
}

async function uploadSample(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const input = canvasElement.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement | null;

  if (!input) {
    throw new Error("Expected file input in App shell story.");
  }

  const response = await fetch(sampleFixture);
  const blob = await response.blob();
  const file = new File([blob], "storybook-sample.jpg", { type: blob.type });

  await userEvent.upload(input, file);

  await waitFor(() => {
    expect(canvas.getByText(/Source image/i)).toBeInTheDocument();
    expect(canvas.getByText(/Result image/i)).toBeInTheDocument();
  });
}

const meta = {
  title: "Pages/AppShell",
  component: App,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Storybook fallback for the full PastePreset shell. Used when no stable ui_demo exists, with deterministic file input and responsive theme scenarios.",
      },
    },
  },
  decorators: [
    (Story) => {
      resetStoryStorage();
      return <Story />;
    },
  ],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DesktopReady: Story = {
  parameters: {
    viewport: {
      defaultViewport: "desktop",
    },
  },
};

export const DesktopWithSample: Story = {
  parameters: {
    viewport: {
      defaultViewport: "desktop",
    },
  },
  async play({ canvasElement }) {
    await uploadSample(canvasElement);
  },
};

export const NarrowShell: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const NarrowShellWithSample: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  async play({ canvasElement }) {
    await uploadSample(canvasElement);

    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(
        canvas.getByRole("heading", { level: 2, name: /Settings/i }),
      ).toBeInTheDocument();
    });
  },
};

export const DarkDesktopWithSample: Story = {
  parameters: {
    viewport: {
      defaultViewport: "desktop",
    },
    backgrounds: { default: "inverse" },
  },
  decorators: [
    (Story) => (
      <div data-theme="pastepreset-dark">
        <Story />
      </div>
    ),
  ],
  async play({ canvasElement }) {
    await uploadSample(canvasElement);
  },
};
