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
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    // Avoid throwing during startup; SW is an enhancement.
    console.warn("[pwa] service worker registration failed", error);
  }
}
