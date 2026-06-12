import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const swTemplateSource = readFileSync(
  join(process.cwd(), "scripts/sw-template.js"),
  "utf8",
);
const warmManifestUrl =
  "https://example.test/offline-warm-manifest.json?cache=paste-preset-precache-v4";

function normalizeRequestUrl(requestOrUrl: Request | string) {
  return typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url;
}

function createMemoryCache() {
  const store = new Map<string, Response>();

  return {
    store,
    async match(requestOrUrl: Request | string) {
      return store.get(normalizeRequestUrl(requestOrUrl))?.clone() ?? null;
    },
    async put(requestOrUrl: Request | string, response: Response) {
      store.set(normalizeRequestUrl(requestOrUrl), response.clone());
    },
    async keys() {
      return Array.from(store.keys(), (url) => new Request(url));
    },
    async delete(requestOrUrl: Request | string) {
      return store.delete(normalizeRequestUrl(requestOrUrl));
    },
  };
}

function loadServiceWorker(fetchMock: typeof fetch) {
  const eventHandlers = new Map<string, (event: unknown) => void>();
  const coreCache = createMemoryCache();
  const optionalCache = createMemoryCache();
  const cacheBuckets = new Map<string, ReturnType<typeof createMemoryCache>>([
    ["paste-preset-precache-v4", coreCache],
    ["paste-preset-optional-v1", optionalCache],
  ]);

  const cachesMock = {
    async open(name: string) {
      const existing = cacheBuckets.get(name);
      if (existing) {
        return existing;
      }

      const created = createMemoryCache();
      cacheBuckets.set(name, created);
      return created;
    },
    async keys() {
      return Array.from(cacheBuckets.keys());
    },
    async delete(name: string) {
      return cacheBuckets.delete(name);
    },
  };

  const selfMock = {
    __WB_MANIFEST: [{ url: "index.html", revision: "shell-a" }],
    location: {
      origin: "https://example.test",
    },
    registration: {
      scope: "https://example.test/",
    },
    addEventListener(type: string, handler: (event: unknown) => void) {
      eventHandlers.set(type, handler);
    },
    skipWaiting: vi.fn(),
  };

  const installServiceWorker = new Function(
    "self",
    "caches",
    "fetch",
    "Request",
    "Response",
    "URL",
    "console",
    swTemplateSource,
  );

  installServiceWorker(
    selfMock,
    cachesMock,
    fetchMock,
    Request,
    Response,
    URL,
    console,
  );

  return {
    eventHandlers,
    coreCache,
    optionalCache,
  };
}

async function dispatchLifecycleEvent(
  handler: ((event: unknown) => void) | undefined,
  event: Record<string, unknown>,
) {
  if (!handler) {
    throw new Error("expected service worker event handler");
  }

  const pending: Promise<unknown>[] = [];
  handler({
    ...event,
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
  });
  await Promise.all(pending);
}

async function dispatchFetchEvent(
  handler: ((event: unknown) => void) | undefined,
  request: Request,
) {
  if (!handler) {
    throw new Error("expected service worker fetch handler");
  }

  let responsePromise: Promise<Response> | null = null;
  handler({
    request,
    respondWith(promise: Promise<Response>) {
      responsePromise = promise;
    },
  });

  if (!responsePromise) {
    throw new Error("expected fetch handler to call respondWith");
  }

  return await responsePromise;
}

describe("sw-template", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries the optional manifest after a transient failure instead of memoizing an empty success", async () => {
    let manifestAttempts = 0;
    const fetchMock = vi.fn(async (requestOrUrl: Request | string) => {
      const url = normalizeRequestUrl(requestOrUrl);

      if (url === warmManifestUrl) {
        manifestAttempts += 1;
        if (manifestAttempts === 1) {
          throw new Error("offline");
        }

        return new Response(
          JSON.stringify([
            { url: "assets/heic2any-abc123.js", revision: "asset-a" },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (url.includes("assets/heic2any-abc123.js")) {
        return new Response("asset", { status: 200 });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    const { eventHandlers, coreCache } = loadServiceWorker(fetchMock);
    const source = { postMessage: vi.fn() };

    await dispatchLifecycleEvent(eventHandlers.get("message"), {
      data: { type: "START_OPTIONAL_WARMUP" },
      source,
    });

    expect(source.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPTIONAL_WARMUP_FAILED",
        completed: 0,
        total: 0,
        error: "offline",
      }),
    );
    expect(
      source.postMessage.mock.calls.some(
        ([message]) => message.type === "OPTIONAL_WARMUP_DONE",
      ),
    ).toBe(false);

    source.postMessage.mockClear();

    await dispatchLifecycleEvent(eventHandlers.get("message"), {
      data: { type: "START_OPTIONAL_WARMUP" },
      source,
    });

    expect(manifestAttempts).toBe(2);
    expect(source.postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "OPTIONAL_WARMUP_PROGRESS",
        completed: 0,
        total: 1,
      }),
    );
    expect(source.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "OPTIONAL_WARMUP_PROGRESS",
        completed: 1,
        total: 1,
      }),
    );
    expect(source.postMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: "OPTIONAL_WARMUP_DONE",
        completed: 1,
        total: 1,
      }),
    );
    expect(await coreCache.match(warmManifestUrl)).not.toBeNull();
  });

  it("skips optional cache cleanup when the warm manifest cannot be loaded", async () => {
    const fetchMock = vi.fn(async (requestOrUrl: Request | string) => {
      const url = normalizeRequestUrl(requestOrUrl);

      if (url === warmManifestUrl) {
        throw new Error("offline");
      }

      return new Response("ok", { status: 200 });
    });

    const { eventHandlers, optionalCache } = loadServiceWorker(fetchMock);
    await optionalCache.put(
      "https://example.test/assets/heic2any-stale.js",
      new Response("stale", { status: 200 }),
    );

    await dispatchLifecycleEvent(eventHandlers.get("activate"), {});

    expect(
      await optionalCache.match(
        "https://example.test/assets/heic2any-stale.js",
      ),
    ).not.toBeNull();
  });

  it("reports full offline-ready status when every optional asset is already cached", async () => {
    const fetchMock = vi.fn(async (requestOrUrl: Request | string) => {
      throw new Error(`unexpected fetch: ${normalizeRequestUrl(requestOrUrl)}`);
    });

    const { eventHandlers, coreCache, optionalCache } =
      loadServiceWorker(fetchMock);

    await coreCache.put(
      warmManifestUrl,
      new Response(
        JSON.stringify([
          { url: "assets/heic2any-abc123.js", revision: "asset-a" },
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    await optionalCache.put(
      "https://example.test/assets/heic2any-abc123.js?__WB_REVISION__=asset-a",
      new Response("asset", { status: 200 }),
    );

    const source = {
      postMessage: vi.fn(),
    };
    await dispatchLifecycleEvent(eventHandlers.get("message"), {
      data: { type: "GET_OPTIONAL_WARMUP_STATUS" },
      source,
    });

    expect(source.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPTIONAL_WARMUP_STATUS",
        offlineReadiness: "full-ready",
        completed: 1,
        total: 1,
      }),
    );
  });

  it("falls back to network for unrelated same-origin GETs when the warm manifest is unavailable", async () => {
    const fetchMock = vi.fn(async (requestOrUrl: Request | string) => {
      const url = normalizeRequestUrl(requestOrUrl);

      if (url === warmManifestUrl) {
        throw new Error("offline");
      }

      if (url === "https://example.test/api/ping") {
        return new Response("pong", { status: 200 });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    const { eventHandlers } = loadServiceWorker(fetchMock);
    const response = await dispatchFetchEvent(
      eventHandlers.get("fetch"),
      new Request("https://example.test/api/ping"),
    );

    expect(await response.text()).toBe("pong");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.test/api/ping",
      }),
    );
  });
});
