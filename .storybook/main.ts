import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {
      strictMode: true,
    },
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(config) {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(dirname, "../node_modules/react"),
      "react-dom": path.resolve(dirname, "../node_modules/react-dom"),
    };
    return config;
  },
};

export default config;
