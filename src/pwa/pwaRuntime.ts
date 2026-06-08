import { useEffect, useSyncExternalStore } from "react";

export type PwaUpdateStatus = "idle" | "available" | "activating";

export interface PwaRuntimeSnapshot {
  isOffline: boolean;
  updateStatus: PwaUpdateStatus;
}

type Listener = () => void;

const listeners = new Set<Listener>();

let initialized = false;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let dismissedWorker: ServiceWorker | null = null;
let reloadOnControllerChange = false;
let snapshot: PwaRuntimeSnapshot = {
  isOffline:
    typeof navigator !== "undefined" && "onLine" in navigator
      ? !navigator.onLine
      : false,
  updateStatus: "idle",
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function recomputeSnapshot() {
  snapshot = {
    isOffline:
      typeof navigator !== "undefined" && "onLine" in navigator
        ? !navigator.onLine
        : false,
    updateStatus: reloadOnControllerChange
      ? "activating"
      : waitingWorker && waitingWorker !== dismissedWorker
        ? "available"
        : "idle",
  };
  emit();
}

function setOfflineState(isOffline: boolean) {
  snapshot = {
    ...snapshot,
    isOffline,
  };
  emit();
}

export function initializePwaRuntime() {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;
  const syncOfflineState = () => {
    setOfflineState(!navigator.onLine);
  };

  syncOfflineState();
  window.addEventListener("online", syncOfflineState);
  window.addEventListener("offline", syncOfflineState);
}

export function attachServiceWorkerRegistration(
  registration: ServiceWorkerRegistration,
) {
  serviceWorkerRegistration = registration;
  if (registration.waiting) {
    waitingWorker = registration.waiting;
    dismissedWorker = null;
  }
  recomputeSnapshot();
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
  snapshot = {
    isOffline:
      typeof navigator !== "undefined" && "onLine" in navigator
        ? !navigator.onLine
        : false,
    updateStatus: "idle",
  };
  listeners.clear();
}
