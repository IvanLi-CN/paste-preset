import type { Preview } from "@storybook/react";
import { FullscreenImagePreviewProvider } from "../src/components/FullscreenImagePreviewProvider.tsx";
import { UserPresetsProvider } from "../src/hooks/useUserPresets.tsx";
import { UserSettingsProvider } from "../src/hooks/useUserSettings.tsx";
import { I18nProvider } from "../src/i18n";
import "../src/index.css";
import "../src/ui/iconify.ts";

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-theme", "winter");
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    actions: { argTypesRegex: "^on[A-Z].*" },
    a11y: {
      element: "#storybook-root",
      disableOtherRules: false,
    },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "hsl(var(--b1))" },
        { name: "inverse", value: "hsl(var(--b2))" },
      ],
    },
  },
  decorators: [
    (Story) => (
      <I18nProvider>
        <UserPresetsProvider>
          <UserSettingsProvider>
            <FullscreenImagePreviewProvider>
              <div className="min-h-screen bg-base-200 p-4">
                <Story />
              </div>
            </FullscreenImagePreviewProvider>
          </UserSettingsProvider>
        </UserPresetsProvider>
      </I18nProvider>
    ),
  ],
};

export default preview;
