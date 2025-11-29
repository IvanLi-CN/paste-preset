import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

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

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
