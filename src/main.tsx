import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./ui/iconify.ts";
import App from "./App.tsx";
import { UserPresetsProvider } from "./hooks/useUserPresets.tsx";
import { UserSettingsProvider } from "./hooks/useUserSettings.tsx";
import { I18nProvider } from "./i18n";
import { getInitialUserPresetsState } from "./lib/userPresets.ts";

const LIGHT_THEME = "winter";
const DARK_THEME = "dim";

function setupSystemThemeSync() {
  if (typeof window === "undefined") {
    return;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const applyTheme = (isDark: boolean) => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? DARK_THEME : LIGHT_THEME,
    );
  };

  applyTheme(mediaQuery.matches);

  const listener = (event: MediaQueryListEvent) => {
    applyTheme(event.matches);
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", listener);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(listener);
  }
}

setupSystemThemeSync();
// Initialize the user presets storage once so subsequent React code can rely
// on a stable in-memory snapshot and localStorage entry when available.
getInitialUserPresetsState();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <UserPresetsProvider>
        <UserSettingsProvider>
          <App />
        </UserSettingsProvider>
      </UserPresetsProvider>
    </I18nProvider>
  </StrictMode>,
);
