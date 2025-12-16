self.addEventListener("install", () => {
  // Intentionally empty: no precache logic in Task 2.
});

self.addEventListener("activate", () => {
  // Intentionally empty: do not call clients.claim() to avoid mid-session takeover.
});

self.addEventListener("fetch", () => {
  // Intentionally empty: offline caching/navigation fallback are implemented in Task 3.
});
