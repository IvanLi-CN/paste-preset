import type { Preview } from "@storybook/react";
import { FullscreenImagePreviewProvider } from "../src/components/FullscreenImagePreviewProvider.tsx";
import { UserPresetsProvider } from "../src/hooks/useUserPresets.tsx";
import { UserSettingsProvider } from "../src/hooks/useUserSettings.tsx";
import { I18nProvider } from "../src/i18n";
import "../src/index.css";

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-theme", "pastepreset-light");
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
        { name: "app", value: "#e7edf4" },
        { name: "inverse", value: "#1e293b" },
      ],
    },
  },
  decorators: [
    (Story) => (
      <I18nProvider>
        <UserPresetsProvider>
          <UserSettingsProvider>
            <FullscreenImagePreviewProvider>
              <div className="min-h-screen bg-[#e7edf4] p-4 md:p-6">
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
