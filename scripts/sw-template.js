// Service worker template.
// The build step injects a precache manifest into the `__WB_MANIFEST` placeholder.
//
// Update policy: "immediate"
// - New SW activates as soon as it's installed.
// - Clients reload once on controller change to avoid mixed asset versions.
//
// Offline L2:
// - Precache app shell + build assets (incl. HEIC chunks, worker assets, version.json).
// - SPA navigation fallback to cached `index.html` when offline.

const CACHE_NAME_PREFIX = "paste-preset-precache-";
const CACHE_NAME = `${CACHE_NAME_PREFIX}v2`;

/** @type {Array<{url: string, revision?: string}>} */
const manifest = self.__WB_MANIFEST;

/** @type {Map<string, string>} */
const urlToCacheKey = new Map();

/** @type {Set<string>} */
const expectedCacheKeys = new Set();

for (const entry of manifest) {
  const absoluteUrl = new URL(entry.url, self.registration.scope).toString();
  const cacheKeyUrl = new URL(entry.url, self.registration.scope);

  if (entry.revision) {
    cacheKeyUrl.searchParams.set("__WB_REVISION__", entry.revision);
  }

  const cacheKey = cacheKeyUrl.toString();
  urlToCacheKey.set(absoluteUrl, cacheKey);
  expectedCacheKeys.add(cacheKey);
}

function isDeniedNavigationPath(pathname) {
  // Keep this list minimal and cheap; avoid pathological regex.
  return pathname.startsWith("/assets/") || pathname.startsWith("/storybook/");
}

async function openPrecache() {
  return await caches.open(CACHE_NAME);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await openPrecache();
      const requests = Array.from(expectedCacheKeys, (cacheKey) => {
        return new Request(cacheKey, { cache: "reload" });
      });
      await cache.addAll(requests);
      // Take over ASAP so users don't stay pinned to an older cached app shell.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop older precache buckets to prevent serving stale/buggy assets.
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(async (name) => {
          if (name.startsWith(CACHE_NAME_PREFIX) && name !== CACHE_NAME) {
            await caches.delete(name);
          }
        }),
      );

      const cache = await openPrecache();
      const keys = await cache.keys();

      await Promise.all(
        keys.map(async (request) => {
          if (!expectedCacheKeys.has(request.url)) {
            await cache.delete(request);
          }
        }),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || typeof event.data !== "object") {
    return;
  }
  if (event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // SPA navigation fallback: when offline, serve cached index.html.
  if (request.mode === "navigate") {
    if (isDeniedNavigationPath(url.pathname)) {
      return;
    }

    event.respondWith(
      (async () => {
        // Online-first to avoid users being pinned to an old cached app shell.
        try {
          const network = await fetch(request);
          if (network?.ok) {
            return network;
          }
        } catch {
          // Fall back to cache below.
        }

        const cache = await openPrecache();
        const indexUrl = new URL(
          "index.html",
          self.registration.scope,
        ).toString();
        const indexCacheKey = urlToCacheKey.get(indexUrl);
        if (indexCacheKey) {
          const cached = await cache.match(indexCacheKey);
          if (cached) {
            return cached;
          }
        }

        // As a last resort, fall back to the network.
        return await fetch(request);
      })(),
    );
    return;
  }

  const cacheKey = urlToCacheKey.get(url.toString());
  if (!cacheKey) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await openPrecache();
      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }
      return await fetch(request);
    })(),
  );
});
