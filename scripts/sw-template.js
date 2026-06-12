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
const OPTIONAL_WARMUP_STATUS_REQUEST = "GET_OPTIONAL_WARMUP_STATUS";

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

function getOptionalManifestUrl() {
  return new URL(OFFLINE_WARM_MANIFEST_URL, self.registration.scope).toString();
}

function getWarmupErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

async function cacheOptionalManifest(cache) {
  const manifestUrl = getOptionalManifestUrl();

  try {
    const response = await fetch(manifestUrl, { cache: "reload" });
    if (!response.ok) {
      return false;
    }

    await cache.put(manifestUrl, response.clone());
    return true;
  } catch {
    return false;
  }
}

async function loadOptionalManifestEntries() {
  if (optionalManifestPromise) {
    return optionalManifestPromise;
  }

  optionalManifestPromise = (async () => {
    const manifestUrl = getOptionalManifestUrl();
    const coreCache = await openCoreCache();

    const cached = await readCachedJson(coreCache, manifestUrl);
    if (Array.isArray(cached)) {
      return cached;
    }

    const response = await fetch(manifestUrl, { cache: "reload" });
    if (!response.ok) {
      throw new Error(`optional warm manifest HTTP ${response.status}`);
    }

    const parsed = await response.clone().json();
    if (!Array.isArray(parsed)) {
      throw new Error("optional warm manifest payload invalid");
    }

    try {
      await coreCache.put(manifestUrl, response.clone());
    } catch {
      // Warmup should still proceed even if the manifest cannot be cached.
    }

    return parsed;
  })();

  try {
    return await optionalManifestPromise;
  } catch (error) {
    optionalManifestPromise = null;
    throw error;
  }
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
  let entries = [];
  try {
    ({ entries } = await getOptionalCacheMaps());
  } catch (error) {
    postMessageToSource(source, {
      type: "OPTIONAL_WARMUP_FAILED",
      completed: 0,
      total: 0,
      error: getWarmupErrorMessage(error, "optional warm manifest failed"),
    });
    return;
  }

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

async function getOptionalWarmupStatusPayload() {
  try {
    const { entries } = await getOptionalCacheMaps();
    const total = entries.length;

    if (total === 0) {
      return {
        type: "OPTIONAL_WARMUP_STATUS",
        offlineReadiness: "shell-ready",
        completed: 0,
        total,
      };
    }

    const cache = await openOptionalCache();
    let completed = 0;

    for (const entry of entries) {
      const cacheKey = createCacheKey(entry);
      if (await cache.match(cacheKey)) {
        completed += 1;
      }
    }

    return {
      type: "OPTIONAL_WARMUP_STATUS",
      offlineReadiness: completed === total ? "full-ready" : "shell-ready",
      completed,
      total,
    };
  } catch (error) {
    return {
      type: "OPTIONAL_WARMUP_STATUS",
      offlineReadiness: "shell-ready",
      completed: 0,
      total: 0,
      error: getWarmupErrorMessage(error, "optional warm status unavailable"),
    };
  }
}

async function reportOptionalWarmupStatus(source) {
  postMessageToSource(source, await getOptionalWarmupStatusPayload());
}

async function cleanupOptionalCache() {
  let expectedCacheKeys = new Set();
  try {
    ({ expectedCacheKeys } = await getOptionalCacheMaps());
  } catch {
    return;
  }

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
      await cacheOptionalManifest(cache);
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
      const optionalManifestUrl = getOptionalManifestUrl();

      await Promise.all(
        keys.map(async (request) => {
          if (
            !expectedCoreCacheKeys.has(request.url) &&
            request.url !== optionalManifestUrl
          ) {
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
    return;
  }
  if (event.data.type === OPTIONAL_WARMUP_STATUS_REQUEST) {
    event.waitUntil(reportOptionalWarmupStatus(event.source));
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

      try {
        const { urlToCacheKey } = await getOptionalCacheMaps();
        const optionalCacheKey = urlToCacheKey.get(url.toString());
        if (optionalCacheKey) {
          const cache = await openOptionalCache();
          const cached = await cache.match(optionalCacheKey);
          if (cached) {
            return cached;
          }
        }
      } catch {
        // Optional warmup metadata should not block unrelated runtime fetches.
      }

      return await fetch(request);
    })(),
  );
});
