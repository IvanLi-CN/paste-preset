// Service worker template.
// The build step injects a precache manifest into the `__WB_MANIFEST` placeholder.
//
// Update policy: "waiting with explicit user action"
// - New SW waits after install until the current session opts into activation.
// - Clients are not auto-claimed; a controlled page refreshes only after the
//   app explicitly requests SKIP_WAITING and receives controllerchange.
//
// Offline L2:
// - Precache the cached app shell + common processing assets.
// - Warm heavy optional assets (HEIC / animated codecs) in the background.
// - Serve cached `index.html` immediately for SPA navigations once available.

const CORE_CACHE_NAME_PREFIX = "paste-preset-precache-";
const OPTIONAL_CACHE_NAME_PREFIX = "paste-preset-optional-";
const CORE_CACHE_NAME = `${CORE_CACHE_NAME_PREFIX}v4`;
const OPTIONAL_CACHE_NAME = `${OPTIONAL_CACHE_NAME_PREFIX}v1`;
const OFFLINE_WARM_MANIFEST_URL = "offline-warm-manifest.json";

/** @type {Array<{url: string, revision?: string}>} */
const manifest = self.__WB_MANIFEST;

/** @type {Map<string, string>} */
const coreUrlToCacheKey = new Map();

/** @type {Set<string>} */
const expectedCoreCacheKeys = new Set();

for (const entry of manifest) {
  const absoluteUrl = new URL(entry.url, self.registration.scope).toString();
  const cacheKey = createCacheKey(entry);
  coreUrlToCacheKey.set(absoluteUrl, cacheKey);
  expectedCoreCacheKeys.add(cacheKey);
}

function isDeniedNavigationPath(pathname) {
  // Keep this list minimal and cheap; avoid pathological regex.
  return pathname.startsWith("/assets/") || pathname.startsWith("/storybook/");
}

function createCacheKey(entry) {
  const cacheKeyUrl = new URL(entry.url, self.registration.scope);
  if (entry.revision) {
    cacheKeyUrl.searchParams.set("__WB_REVISION__", entry.revision);
  }
  return cacheKeyUrl.toString();
}

async function openCoreCache() {
  return await caches.open(CORE_CACHE_NAME);
}

async function openOptionalCache() {
  return await caches.open(OPTIONAL_CACHE_NAME);
}

let optionalManifestPromise = null;

async function readCachedJson(cache, cacheKey) {
  const response = await cache.match(cacheKey);
  if (!response) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function loadOptionalManifestEntries() {
  if (optionalManifestPromise) {
    return optionalManifestPromise;
  }

  optionalManifestPromise = (async () => {
    const manifestUrl = new URL(
      OFFLINE_WARM_MANIFEST_URL,
      self.registration.scope,
    ).toString();
    const coreCache = await openCoreCache();
    const coreCacheKey = coreUrlToCacheKey.get(manifestUrl);

    if (coreCacheKey) {
      const cached = await readCachedJson(coreCache, coreCacheKey);
      if (Array.isArray(cached)) {
        return cached;
      }
    }

    try {
      const response = await fetch(manifestUrl, { cache: "reload" });
      if (!response.ok) {
        return [];
      }
      const parsed = await response.json();
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return optionalManifestPromise;
}

async function getOptionalCacheMaps() {
  const entries = await loadOptionalManifestEntries();
  const urlToCacheKey = new Map();
  const expectedCacheKeys = new Set();

  for (const entry of entries) {
    if (!entry || typeof entry.url !== "string") {
      continue;
    }
    const absoluteUrl = new URL(entry.url, self.registration.scope).toString();
    const cacheKey = createCacheKey(entry);
    urlToCacheKey.set(absoluteUrl, cacheKey);
    expectedCacheKeys.add(cacheKey);
  }

  return { entries, urlToCacheKey, expectedCacheKeys };
}

function postMessageToSource(source, payload) {
  if (!source || typeof source !== "object") {
    return;
  }
  if (typeof source.postMessage === "function") {
    source.postMessage(payload);
  }
}

async function warmOptionalAssets(source) {
  const { entries } = await getOptionalCacheMaps();
  const cache = await openOptionalCache();
  let completed = 0;

  postMessageToSource(source, {
    type: "OPTIONAL_WARMUP_PROGRESS",
    completed,
    total: entries.length,
  });

  for (const entry of entries) {
    const cacheKey = createCacheKey(entry);
    const existing = await cache.match(cacheKey);
    if (existing) {
      completed += 1;
      continue;
    }

    const request = new Request(cacheKey, { cache: "reload" });

    try {
      const response = await fetch(request);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await cache.put(request, response.clone());
      completed += 1;
      postMessageToSource(source, {
        type: "OPTIONAL_WARMUP_PROGRESS",
        completed,
        total: entries.length,
      });
    } catch (error) {
      postMessageToSource(source, {
        type: "OPTIONAL_WARMUP_FAILED",
        completed,
        total: entries.length,
        error:
          error instanceof Error ? error.message : "optional warmup failed",
      });
      return;
    }
  }

  postMessageToSource(source, {
    type: "OPTIONAL_WARMUP_DONE",
    completed,
    total: entries.length,
  });
}

async function cleanupOptionalCache() {
  const { expectedCacheKeys } = await getOptionalCacheMaps();
  const cache = await openOptionalCache();
  const keys = await cache.keys();

  await Promise.all(
    keys.map(async (request) => {
      if (!expectedCacheKeys.has(request.url)) {
        await cache.delete(request);
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await openCoreCache();
      const requests = Array.from(expectedCoreCacheKeys, (cacheKey) => {
        return new Request(cacheKey, { cache: "reload" });
      });
      await cache.addAll(requests);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop older cache buckets to prevent serving stale/buggy assets.
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(async (name) => {
          if (
            (name.startsWith(CORE_CACHE_NAME_PREFIX) &&
              name !== CORE_CACHE_NAME) ||
            (name.startsWith(OPTIONAL_CACHE_NAME_PREFIX) &&
              name !== OPTIONAL_CACHE_NAME)
          ) {
            await caches.delete(name);
          }
        }),
      );

      const cache = await openCoreCache();
      const keys = await cache.keys();

      await Promise.all(
        keys.map(async (request) => {
          if (!expectedCoreCacheKeys.has(request.url)) {
            await cache.delete(request);
          }
        }),
      );

      await cleanupOptionalCache();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || typeof event.data !== "object") {
    return;
  }
  if (event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (event.data.type === "START_OPTIONAL_WARMUP") {
    event.waitUntil(warmOptionalAssets(event.source));
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
        const cache = await openCoreCache();
        const indexUrl = new URL(
          "index.html",
          self.registration.scope,
        ).toString();
        const indexCacheKey = coreUrlToCacheKey.get(indexUrl);
        if (indexCacheKey) {
          const cached = await cache.match(indexCacheKey);
          if (cached) {
            return cached;
          }
        }

        return await fetch(request);
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const coreCacheKey = coreUrlToCacheKey.get(url.toString());
      if (coreCacheKey) {
        const cache = await openCoreCache();
        const cached = await cache.match(coreCacheKey);
        if (cached) {
          return cached;
        }
      }

      const { urlToCacheKey } = await getOptionalCacheMaps();
      const optionalCacheKey = urlToCacheKey.get(url.toString());
      if (optionalCacheKey) {
        const cache = await openOptionalCache();
        const cached = await cache.match(optionalCacheKey);
        if (cached) {
          return cached;
        }
      }

      return await fetch(request);
    })(),
  );
});
