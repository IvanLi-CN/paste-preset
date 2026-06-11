import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { StatusBar } from "./StatusBar.tsx";

function renderStatusBar(
  override: Partial<React.ComponentProps<typeof StatusBar>> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const props: React.ComponentProps<typeof StatusBar> = {
    status: "idle",
    processingError: null,
    clipboardError: null,
    isOffline: false,
    offlineReadiness: "unsupported",
    updateStatus: "idle",
    onReloadNow: vi.fn(),
    onLater: vi.fn(),
    ...override,
  };

  act(() => {
    root.render(
      <I18nProvider>
        <StatusBar {...props} />
      </I18nProvider>,
    );
  });

  return {
    container,
    props,
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("StatusBar", () => {
  it("stays hidden when idle without messages", () => {
    const { container, cleanup } = renderStatusBar();
    expect(container.textContent?.trim()).toBe("");
    cleanup();
  });

  it("shows offline informational state", () => {
    const { container, cleanup } = renderStatusBar({
      isOffline: true,
      offlineReadiness: "shell-ready",
    });
    expect(container.textContent).toContain(
      "Offline mode: cached shell is ready, and common formats remain available.",
    );
    cleanup();
  });

  it("shows full offline readiness when all warm assets are cached", () => {
    const { container, cleanup } = renderStatusBar({
      isOffline: true,
      offlineReadiness: "full-ready",
    });
    expect(container.textContent).toContain(
      "Offline mode: full cached processing features remain available.",
    );
    cleanup();
  });

  it("shows update actions when a waiting worker is available", () => {
    const onReloadNow = vi.fn();
    const onLater = vi.fn();
    const { container, cleanup } = renderStatusBar({
      updateStatus: "available",
      onReloadNow,
      onLater,
    });

    const buttons = container.querySelectorAll("button");
    expect(container.textContent).toContain("A new version is ready.");
    expect(buttons).toHaveLength(2);

    act(() => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onReloadNow).toHaveBeenCalledTimes(1);
    expect(onLater).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
