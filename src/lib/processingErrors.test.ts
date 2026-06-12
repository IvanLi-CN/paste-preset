import { describe, expect, it } from "vitest";
import { __resetPwaRuntimeForTest } from "../pwa/pwaRuntime.ts";
import { translateProcessingError } from "./processingErrors.ts";

describe("processingErrors", () => {
  it("keeps the generic HEIC unavailable guidance when service workers are unsupported", () => {
    const originalNavigatorOnline = navigator.onLine;
    const originalServiceWorker = navigator.serviceWorker;

    try {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: undefined,
      });
      __resetPwaRuntimeForTest();

      const translated = translateProcessingError(
        new Error("heic.unavailable"),
        (key) => key,
      );

      expect(translated).toBe("error.heic.unavailable");
    } finally {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: originalNavigatorOnline,
      });
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: originalServiceWorker,
      });
      __resetPwaRuntimeForTest();
    }
  });
});
