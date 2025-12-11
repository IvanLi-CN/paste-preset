import { expect } from "@storybook/jest";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, waitFor, within } from "@storybook/testing-library";
import { LanguageSelector } from "./LanguageSelector";

const meta = {
  title: "Components/LanguageSelector",
  component: LanguageSelector,
  tags: ["autodocs"],
} satisfies Meta<typeof LanguageSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DropdownToggle: Story = {
  async play({ canvasElement, step }) {
    const canvas = within(canvasElement);

    await step("Open menu", async () => {
      const toggle = canvas.getByRole("button", {
        name: /language|语言|語言/i,
      });
      await userEvent.click(toggle);
      await waitFor(() =>
        expect(toggle).toHaveAttribute("aria-expanded", "true"),
      );
    });

    await step("Switch to English", async () => {
      const toggle = canvas.getByRole("button", {
        name: /language|语言|語言/i,
      });
      const option = canvas.getByRole("menuitem", { name: /english/i });
      await userEvent.click(option);
      await waitFor(() =>
        expect(toggle).toHaveAttribute("aria-expanded", "false"),
      );
      const list = canvas.getByRole("list", { name: /change language/i });
      await waitFor(() => expect(list).not.toBeVisible());
    });
  },
};
