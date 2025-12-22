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

    // When a new SW takes control, reload once so the page uses a consistent
    // set of cached assets (prevents mixed-version issues that can surface as
    // stuck HEIC processing).
    {
      const RELOAD_COUNT_KEY =
        "paste-preset:sw-controllerchange-reload-count:v1";
      const MAX_RELOADS_PER_SESSION = 2;

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;

        try {
          const raw = window.sessionStorage.getItem(RELOAD_COUNT_KEY);
          const count = raw ? Number.parseInt(raw, 10) : 0;
          const safeCount = Number.isNaN(count) ? 0 : count;

          if (safeCount >= MAX_RELOADS_PER_SESSION) {
            return;
          }

          window.sessionStorage.setItem(
            RELOAD_COUNT_KEY,
            String(safeCount + 1),
          );
        } catch {
          // If sessionStorage is unavailable, fall back to best-effort reload.
        }

        window.location.reload();
      });
    }

    const requestSkipWaiting = (worker: ServiceWorker | null | undefined) => {
      if (!worker) return;
      try {
        worker.postMessage({ type: "SKIP_WAITING" });
      } catch {
        // Ignore; the SW may not support messaging yet.
      }
    };

    // If there's already a waiting SW (e.g. update downloaded in a previous
    // session), activate it now.
    requestSkipWaiting(registration.waiting);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          // Trigger immediate activation for updates; initial installs have
          // no existing controller.
          requestSkipWaiting(worker);
        }
      });
    });

    // Proactively check for updates after startup.
    void registration.update();
  } catch (error) {
    // Avoid throwing during startup; SW is an enhancement.
    console.warn("[pwa] service worker registration failed", error);
  }
}
