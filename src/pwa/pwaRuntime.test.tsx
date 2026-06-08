import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPwaRuntimeForTest,
  applyWaitingWorkerUpdate,
  attachServiceWorkerRegistration,
  dismissWaitingWorker,
  handleServiceWorkerControllerChange,
  notifyWaitingWorker,
  usePwaRuntime,
} from "./pwaRuntime.ts";

function renderHook() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latest: ReturnType<typeof usePwaRuntime> | null = null;

  function Harness() {
    latest = usePwaRuntime();
    return null;
  }

  act(() => {
    root.render(<Harness />);
  });

  return {
    getLatest() {
      if (!latest) {
        throw new Error("PWA runtime hook not ready");
      }
      return latest;
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("pwaRuntime", () => {
  const originalNavigatorOnline = navigator.onLine;

  beforeEach(() => {
    __resetPwaRuntimeForTest();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: originalNavigatorOnline,
    });
  });

  it("tracks waiting updates and dismisses them per session", () => {
    const hook = renderHook();
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;

    act(() => {
      attachServiceWorkerRegistration({
        waiting: null,
      } as ServiceWorkerRegistration);
      notifyWaitingWorker(waitingWorker);
    });

    expect(hook.getLatest().updateStatus).toBe("available");

    act(() => {
      dismissWaitingWorker();
    });

    expect(hook.getLatest().updateStatus).toBe("idle");
    hook.cleanup();
  });

  it("enters activating state when applying a waiting update", () => {
    const hook = renderHook();
    const postMessage = vi.fn();
    const waitingWorker = {
      postMessage,
    } as unknown as ServiceWorker;

    act(() => {
      notifyWaitingWorker(waitingWorker);
    });

    let applied = false;
    act(() => {
      applied = applyWaitingWorkerUpdate();
    });
    expect(applied).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(hook.getLatest().updateStatus).toBe("activating");
    hook.cleanup();
  });

  it("tracks offline state from browser events", () => {
    const hook = renderHook();

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(hook.getLatest().isOffline).toBe(true);

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(hook.getLatest().isOffline).toBe(false);
    hook.cleanup();
  });

  it("reloads only after explicit update activation reaches controllerchange", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        reload: reloadSpy,
      },
    });

    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;

    act(() => {
      notifyWaitingWorker(waitingWorker);
    });
    let applied = false;
    let changed = false;
    act(() => {
      applied = applyWaitingWorkerUpdate();
      changed = handleServiceWorkerControllerChange();
    });
    expect(applied).toBe(true);
    expect(changed).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reloads when another tab activates a known waiting update", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        reload: reloadSpy,
      },
    });

    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;

    act(() => {
      notifyWaitingWorker(waitingWorker);
      dismissWaitingWorker();
    });

    let changed = false;
    act(() => {
      changed = handleServiceWorkerControllerChange();
    });

    expect(changed).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
