import {
  attachServiceWorkerRegistration,
  handleServiceWorkerControllerChange,
  notifyWaitingWorker,
  requestServiceWorkerUpdateCheck,
  scheduleOptionalWarmup,
} from "./pwaRuntime.ts";

export async function registerServiceWorker() {
  if (!import.meta.env.PROD) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      // Ensure SW update checks bypass HTTP cache so users aren't pinned to a
      // stale app shell (which can break HEIC handling across deployments).
      updateViaCache: "none",
    });

    attachServiceWorkerRegistration(registration);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      handleServiceWorkerControllerChange();
    });

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller !== null
        ) {
          notifyWaitingWorker(registration.waiting ?? worker);
        }
      });
    });

    // Proactively check for updates after startup.
    requestServiceWorkerUpdateCheck();
    scheduleOptionalWarmup(registration);
  } catch (error) {
    // Avoid throwing during startup; SW is an enhancement.
    console.warn("[pwa] service worker registration failed", error);
  }
}
