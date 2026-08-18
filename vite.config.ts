import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { installIconVersion } from "./scripts/pwa-icon-contract.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const iconVersion = installIconVersion(projectRoot);

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    {
      name: "paste-preset-install-icon-version",
      transformIndexHtml(html) {
        return html.replaceAll("%INSTALL_ICON_VERSION%", iconVersion);
      },
    },
    react(),
    tailwindcss(),
  ],
  server: {
    port: 25119,
  },
  worker: {
    format: "es",
  },
});
