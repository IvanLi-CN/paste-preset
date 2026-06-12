import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPwaRuntimeForTest,
  applyWaitingWorkerUpdate,
  attachServiceWorkerRegistration,
  dismissWaitingWorker,
  handleServiceWorkerControllerChange,
  handleServiceWorkerRuntimeMessage,
  notifyWaitingWorker,
  requestOptionalWarmup,
  scheduleOptionalWarmup,
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

function installServiceWorkerMocks(params?: {
  activeWorker?: ServiceWorker | null;
  installingWorker?: ServiceWorker | null;
  waitingWorker?: ServiceWorker | null;
  controller?: ServiceWorker | null;
}) {
  const serviceWorker = {
    addEventListener: vi.fn(),
    controller: params?.controller ?? null,
    ready: Promise.resolve({
      active: params?.activeWorker ?? null,
      installing: params?.installingWorker ?? null,
      waiting: params?.waitingWorker ?? null,
    }),
  };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });

  return serviceWorker;
}

describe("pwaRuntime", () => {
  const originalNavigatorOnline = navigator.onLine;
  const originalServiceWorker = navigator.serviceWorker;
  const originalRequestIdleCallback = window.requestIdleCallback;

  beforeEach(() => {
    __resetPwaRuntimeForTest();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    installServiceWorkerMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: originalNavigatorOnline,
    });

    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: originalServiceWorker,
      });
    } else {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: undefined,
      });
    }

    if (originalRequestIdleCallback) {
      Object.defineProperty(window, "requestIdleCallback", {
        configurable: true,
        value: originalRequestIdleCallback,
      });
    } else {
      Object.defineProperty(window, "requestIdleCallback", {
        configurable: true,
        value: undefined,
      });
    }
  });

  it("marks the shell ready once a service worker registration is attached", () => {
    const activeWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    installServiceWorkerMocks({ activeWorker });
    const hook = renderHook();

    expect(hook.getLatest().offlineReadiness).toBe("unsupported");

    act(() => {
      attachServiceWorkerRegistration({
        active: activeWorker,
        waiting: null,
      } as ServiceWorkerRegistration);
    });

    expect(hook.getLatest().offlineReadiness).toBe("shell-ready");
    expect(activeWorker.postMessage).toHaveBeenCalledWith({
      type: "GET_OPTIONAL_WARMUP_STATUS",
    });
    hook.cleanup();
  });

  it("preserves the initial offline snapshot before the effect runs", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const hook = renderHook();
    expect(hook.getLatest().isOffline).toBe(true);
    hook.cleanup();
  });

  it("uses the active worker when requesting optional warmup status", () => {
    const activeWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    installServiceWorkerMocks({ activeWorker, waitingWorker });
    const hook = renderHook();

    act(() => {
      attachServiceWorkerRegistration({
        active: activeWorker,
        waiting: waitingWorker,
      } as ServiceWorkerRegistration);
    });

    expect(activeWorker.postMessage).toHaveBeenCalledWith({
      type: "GET_OPTIONAL_WARMUP_STATUS",
    });
    expect(waitingWorker.postMessage).not.toHaveBeenCalledWith({
      type: "GET_OPTIONAL_WARMUP_STATUS",
    });
    hook.cleanup();
  });

  it("keeps warmup on the active worker even when an update is waiting", async () => {
    const activeWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    installServiceWorkerMocks({ activeWorker, waitingWorker });
    const hook = renderHook();

    act(() => {
      attachServiceWorkerRegistration({
        active: activeWorker,
        waiting: waitingWorker,
      } as ServiceWorkerRegistration);
    });

    await act(async () => {
      await requestOptionalWarmup({
        active: activeWorker,
        waiting: waitingWorker,
      } as ServiceWorkerRegistration);
    });

    expect(activeWorker.postMessage).toHaveBeenCalledWith({
      type: "START_OPTIONAL_WARMUP",
    });
    expect(waitingWorker.postMessage).not.toHaveBeenCalledWith({
      type: "START_OPTIONAL_WARMUP",
    });
    hook.cleanup();
  });

  it("restores full offline readiness from the service worker status after reload", () => {
    const activeWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    installServiceWorkerMocks({ activeWorker });
    const hook = renderHook();

    act(() => {
      attachServiceWorkerRegistration({
        active: activeWorker,
        waiting: null,
      } as ServiceWorkerRegistration);
      handleServiceWorkerRuntimeMessage({
        type: "OPTIONAL_WARMUP_STATUS",
        offlineReadiness: "full-ready",
        completed: 4,
        total: 4,
      });
    });

    expect(hook.getLatest().offlineReadiness).toBe("full-ready");
    hook.cleanup();
  });

  it("falls back to optional warmup when the status probe never returns", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: ((callback: IdleRequestCallback) => {
        callback({
          didTimeout: false,
          timeRemaining: () => 50,
        } as IdleDeadline);
        return 1;
      }) as typeof window.requestIdleCallback,
    });

    const activeWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    installServiceWorkerMocks({ activeWorker });
    const hook = renderHook();
    const registration = {
      active: activeWorker,
      waiting: null,
    } as ServiceWorkerRegistration;

    act(() => {
      attachServiceWorkerRegistration(registration);
      scheduleOptionalWarmup(registration);
    });

    expect(activeWorker.postMessage).toHaveBeenNthCalledWith(1, {
      type: "GET_OPTIONAL_WARMUP_STATUS",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(activeWorker.postMessage).toHaveBeenNthCalledWith(2, {
      type: "START_OPTIONAL_WARMUP",
    });
    expect(hook.getLatest().offlineReadiness).toBe("warming");
    hook.cleanup();
  });

  it("falls back to the controlling worker when the registration has no active worker", () => {
    const controllerWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    installServiceWorkerMocks({
      activeWorker: null,
      waitingWorker,
      controller: controllerWorker,
    });
    const hook = renderHook();

    act(() => {
      attachServiceWorkerRegistration({
        active: null,
        waiting: waitingWorker,
      } as ServiceWorkerRegistration);
    });

    expect(controllerWorker.postMessage).toHaveBeenCalledWith({
      type: "GET_OPTIONAL_WARMUP_STATUS",
    });
    expect(waitingWorker.postMessage).not.toHaveBeenCalledWith({
      type: "GET_OPTIONAL_WARMUP_STATUS",
    });
    hook.cleanup();
  });

  it("tracks waiting updates and dismisses them per session", () => {
    const hook = renderHook();
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;

    act(() => {
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
    installServiceWorkerMocks();
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

  it("tracks offline state changes even when service workers are unsupported", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });

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

  it("tracks optional warmup progress and completion", async () => {
    const activeWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    installServiceWorkerMocks({ activeWorker });
    const hook = renderHook();

    act(() => {
      attachServiceWorkerRegistration({
        active: activeWorker,
        waiting: null,
      } as ServiceWorkerRegistration);
    });

    await act(async () => {
      await requestOptionalWarmup();
    });

    expect(activeWorker.postMessage).toHaveBeenCalledWith({
      type: "START_OPTIONAL_WARMUP",
    });
    expect(hook.getLatest().offlineReadiness).toBe("warming");

    act(() => {
      handleServiceWorkerRuntimeMessage({
        type: "OPTIONAL_WARMUP_DONE",
        completed: 4,
        total: 4,
      });
    });

    expect(hook.getLatest().offlineReadiness).toBe("full-ready");
    hook.cleanup();
  });

  it("surfaces warmup failures without losing cached shell state", () => {
    installServiceWorkerMocks();
    const hook = renderHook();

    act(() => {
      attachServiceWorkerRegistration({
        active: null,
        waiting: null,
      } as ServiceWorkerRegistration);
      handleServiceWorkerRuntimeMessage({
        type: "OPTIONAL_WARMUP_FAILED",
        completed: 1,
        total: 4,
        error: "network",
      });
    });

    expect(hook.getLatest().offlineReadiness).toBe("warmup-failed");
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
