import type { TestRunnerConfig } from "@storybook/test-runner";

const config: TestRunnerConfig = {
  /**
   * Keep defaults; hook reserved for lightweight diagnostics or future tweaks.
   */
  async postVisit() {
    // Placeholder for future logging or cleanup.
  },
};

export default config;
