import { useEffect, useSyncExternalStore } from "react";

export type PwaUpdateStatus = "idle" | "available" | "activating";
export type OfflineReadiness =
  | "shell-ready"
  | "warming"
  | "full-ready"
  | "warmup-failed"
  | "unsupported";

export type StartOptionalWarmupMessage = {
  type: "START_OPTIONAL_WARMUP";
};

export type RequestOptionalWarmupStatusMessage = {
  type: "GET_OPTIONAL_WARMUP_STATUS";
};

export type OptionalWarmupProgressMessage = {
  type: "OPTIONAL_WARMUP_PROGRESS";
  completed?: number;
  total?: number;
};

export type OptionalWarmupDoneMessage = {
  type: "OPTIONAL_WARMUP_DONE";
  completed?: number;
  total?: number;
};

export type OptionalWarmupFailedMessage = {
  type: "OPTIONAL_WARMUP_FAILED";
  completed?: number;
  total?: number;
  error?: string;
};

export type OptionalWarmupStatusMessage = {
  type: "OPTIONAL_WARMUP_STATUS";
  offlineReadiness?: "shell-ready" | "full-ready";
  completed?: number;
  total?: number;
  error?: string;
};

type ServiceWorkerRuntimeMessage =
  | OptionalWarmupProgressMessage
  | OptionalWarmupDoneMessage
  | OptionalWarmupFailedMessage
  | OptionalWarmupStatusMessage;

export interface PwaRuntimeSnapshot {
  isOffline: boolean;
  updateStatus: PwaUpdateStatus;
  offlineReadiness: OfflineReadiness;
}

type Listener = () => void;

const listeners = new Set<Listener>();
const OPTIONAL_WARMUP_STATUS_TIMEOUT_MS = 1_500;

let initialized = false;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let dismissedWorker: ServiceWorker | null = null;
let reloadOnControllerChange = false;
let offlineReadiness: OfflineReadiness = "unsupported";
let warmupScheduleRequested = false;
let warmupStatusRequestInFlight = false;
let warmupStatusTimeoutId: number | null = null;

let snapshot: PwaRuntimeSnapshot = {
  isOffline: readOfflineState(),
  updateStatus: "idle",
  offlineReadiness,
};

function syncSnapshotForTest() {
  if (typeof window === "undefined") {
    return;
  }

  (
    window as typeof window & {
      __pastePresetPwaSnapshot?: PwaRuntimeSnapshot;
    }
  ).__pastePresetPwaSnapshot = snapshot;
}

function supportsServiceWorker() {
  return (
    typeof window !== "undefined" &&
    typeof navigator.serviceWorker !== "undefined"
  );
}

function readOfflineState() {
  return typeof navigator !== "undefined" && "onLine" in navigator
    ? !navigator.onLine
    : false;
}

function readUpdateStatus(): PwaUpdateStatus {
  if (reloadOnControllerChange) {
    return "activating";
  }
  if (waitingWorker && waitingWorker !== dismissedWorker) {
    return "available";
  }
  return "idle";
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function recomputeSnapshot() {
  snapshot = {
    isOffline: readOfflineState(),
    updateStatus: readUpdateStatus(),
    offlineReadiness,
  };
  syncSnapshotForTest();
  emit();
}

function setOfflineReadiness(next: OfflineReadiness) {
  if (offlineReadiness === next) {
    return;
  }
  offlineReadiness = next;
  recomputeSnapshot();
}

function markShellReady() {
  if (offlineReadiness === "full-ready" || offlineReadiness === "warming") {
    recomputeSnapshot();
    return;
  }

  setOfflineReadiness(supportsServiceWorker() ? "shell-ready" : "unsupported");
}

function setOfflineState() {
  recomputeSnapshot();
}

function waitForVisibleDocument() {
  if (
    typeof document === "undefined" ||
    document.visibilityState === "visible"
  ) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        resolve();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
  });
}

function waitForBrowserIdle() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  type IdleWindow = typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback) => number;
  };

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    return new Promise<void>((resolve) => {
      idleWindow.requestIdleCallback?.(() => resolve());
    });
  }

  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 1200);
  });
}

function clearWarmupStatusTimeout() {
  if (typeof window === "undefined" || warmupStatusTimeoutId === null) {
    warmupStatusTimeoutId = null;
    return;
  }

  window.clearTimeout(warmupStatusTimeoutId);
  warmupStatusTimeoutId = null;
}

function releaseWarmupStatusRequest(shouldScheduleFallback = false) {
  const wasInFlight = warmupStatusRequestInFlight;
  warmupStatusRequestInFlight = false;
  clearWarmupStatusTimeout();

  if (
    wasInFlight &&
    shouldScheduleFallback &&
    typeof navigator !== "undefined" &&
    navigator.onLine &&
    offlineReadiness !== "full-ready"
  ) {
    scheduleOptionalWarmup();
  }
}

function getPreferredWarmupMessageTarget(
  registration: ServiceWorkerRegistration,
): ServiceWorker | null {
  return (
    registration.waiting ??
    registration.installing ??
    registration.active ??
    navigator.serviceWorker.controller
  );
}

export async function requestOptionalWarmup(
  registration: ServiceWorkerRegistration | null = serviceWorkerRegistration,
) {
  if (!registration || !supportsServiceWorker()) {
    return false;
  }

  let target = getPreferredWarmupMessageTarget(registration);
  if (!target) {
    try {
      const readyRegistration = await navigator.serviceWorker.ready;
      target = getPreferredWarmupMessageTarget(readyRegistration);
      serviceWorkerRegistration = readyRegistration;
    } catch {
      target = null;
    }
  }

  if (!target) {
    return false;
  }

  warmupScheduleRequested = true;
  if (offlineReadiness !== "full-ready") {
    setOfflineReadiness("warming");
  }

  try {
    const message: StartOptionalWarmupMessage = {
      type: "START_OPTIONAL_WARMUP",
    };
    target.postMessage(message);
    return true;
  } catch {
    warmupScheduleRequested = false;
    setOfflineReadiness("warmup-failed");
    return false;
  }
}

async function requestOptionalWarmupStatus(
  registration: ServiceWorkerRegistration | null = serviceWorkerRegistration,
) {
  if (!registration || !supportsServiceWorker()) {
    return false;
  }

  let target = getPreferredWarmupMessageTarget(registration);
  if (!target) {
    try {
      const readyRegistration = await navigator.serviceWorker.ready;
      target = getPreferredWarmupMessageTarget(readyRegistration);
      serviceWorkerRegistration = readyRegistration;
    } catch {
      target = null;
    }
  }

  if (!target) {
    return false;
  }

  clearWarmupStatusTimeout();
  warmupStatusRequestInFlight = true;
  warmupStatusTimeoutId = window.setTimeout(() => {
    releaseWarmupStatusRequest(true);
  }, OPTIONAL_WARMUP_STATUS_TIMEOUT_MS);

  try {
    const message: RequestOptionalWarmupStatusMessage = {
      type: "GET_OPTIONAL_WARMUP_STATUS",
    };
    target.postMessage(message);
    return true;
  } catch {
    releaseWarmupStatusRequest();
    return false;
  }
}

export function scheduleOptionalWarmup(
  registration: ServiceWorkerRegistration | null = serviceWorkerRegistration,
) {
  if (
    !registration ||
    !supportsServiceWorker() ||
    offlineReadiness === "full-ready" ||
    warmupScheduleRequested ||
    warmupStatusRequestInFlight
  ) {
    return;
  }

  warmupScheduleRequested = true;

  void (async () => {
    await waitForVisibleDocument();
    await waitForBrowserIdle();

    const started = await requestOptionalWarmup(registration);
    if (!started) {
      warmupScheduleRequested = false;
    }
  })();
}

export function initializePwaRuntime() {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;

  const syncOfflineState = () => {
    setOfflineState();
    if (
      supportsServiceWorker() &&
      navigator.onLine &&
      offlineReadiness !== "full-ready"
    ) {
      scheduleOptionalWarmup();
    }
  };

  syncOfflineState();
  window.addEventListener("online", syncOfflineState);
  window.addEventListener("offline", syncOfflineState);

  if (!supportsServiceWorker()) {
    offlineReadiness = "unsupported";
    recomputeSnapshot();
    return;
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    handleServiceWorkerRuntimeMessage(event.data);
  });
}

export function attachServiceWorkerRegistration(
  registration: ServiceWorkerRegistration,
) {
  serviceWorkerRegistration = registration;
  if (registration.waiting) {
    waitingWorker = registration.waiting;
    dismissedWorker = null;
  }
  markShellReady();
  void requestOptionalWarmupStatus(registration);
}

export function notifyWaitingWorker(worker: ServiceWorker | null | undefined) {
  if (!worker) {
    return;
  }

  waitingWorker = worker;
  dismissedWorker = null;
  recomputeSnapshot();
}

export function dismissWaitingWorker() {
  if (!waitingWorker) {
    return;
  }

  dismissedWorker = waitingWorker;
  recomputeSnapshot();
}

export function applyWaitingWorkerUpdate() {
  if (!waitingWorker) {
    return false;
  }

  reloadOnControllerChange = true;
  recomputeSnapshot();

  try {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    return true;
  } catch {
    reloadOnControllerChange = false;
    recomputeSnapshot();
    return false;
  }
}

export function handleServiceWorkerControllerChange() {
  const shouldReload =
    reloadOnControllerChange ||
    waitingWorker !== null ||
    dismissedWorker !== null;

  if (!shouldReload) {
    return false;
  }

  reloadOnControllerChange = false;
  waitingWorker = null;
  dismissedWorker = null;
  recomputeSnapshot();
  window.location.reload();
  return true;
}

export function handleServiceWorkerRuntimeMessage(data: unknown) {
  if (!data || typeof data !== "object" || !("type" in data)) {
    return false;
  }

  const message = data as ServiceWorkerRuntimeMessage;

  switch (message.type) {
    case "OPTIONAL_WARMUP_PROGRESS":
      releaseWarmupStatusRequest();
      setOfflineReadiness("warming");
      return true;
    case "OPTIONAL_WARMUP_DONE":
      releaseWarmupStatusRequest();
      warmupScheduleRequested = true;
      setOfflineReadiness("full-ready");
      return true;
    case "OPTIONAL_WARMUP_FAILED":
      releaseWarmupStatusRequest();
      warmupScheduleRequested = false;
      setOfflineReadiness("warmup-failed");
      return true;
    case "OPTIONAL_WARMUP_STATUS":
      releaseWarmupStatusRequest();
      if (message.offlineReadiness === "full-ready") {
        warmupScheduleRequested = true;
        setOfflineReadiness("full-ready");
        return true;
      }
      if (
        message.offlineReadiness === "shell-ready" &&
        offlineReadiness !== "warming" &&
        offlineReadiness !== "full-ready"
      ) {
        setOfflineReadiness("shell-ready");
      }
      if (
        typeof navigator !== "undefined" &&
        navigator.onLine &&
        offlineReadiness !== "full-ready"
      ) {
        scheduleOptionalWarmup();
      }
      return true;
    default:
      return false;
  }
}

export function requestServiceWorkerUpdateCheck() {
  if (!serviceWorkerRegistration) {
    return;
  }

  void serviceWorkerRegistration.update();
}

export function getPwaRuntimeSnapshot() {
  return snapshot;
}

export function subscribeToPwaRuntime(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePwaRuntime() {
  useEffect(() => {
    initializePwaRuntime();
  }, []);

  const currentSnapshot = useSyncExternalStore(
    subscribeToPwaRuntime,
    getPwaRuntimeSnapshot,
    getPwaRuntimeSnapshot,
  );

  return {
    ...currentSnapshot,
    dismissWaitingUpdate: dismissWaitingWorker,
    applyWaitingUpdate: applyWaitingWorkerUpdate,
  };
}

export function __resetPwaRuntimeForTest() {
  initialized = false;
  serviceWorkerRegistration = null;
  waitingWorker = null;
  dismissedWorker = null;
  reloadOnControllerChange = false;
  offlineReadiness = "unsupported";
  warmupScheduleRequested = false;
  warmupStatusRequestInFlight = false;
  clearWarmupStatusTimeout();
  snapshot = {
    isOffline: readOfflineState(),
    updateStatus: "idle",
    offlineReadiness,
  };
  syncSnapshotForTest();
  listeners.clear();
}
