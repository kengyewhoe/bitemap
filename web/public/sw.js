// BiteMap service worker — hand-rolled, no workbox/next-pwa.
const SHELL_CACHE = "bitemap-shell-v1";
const TILE_CACHE = "bitemap-tiles-v1";
const STATIC_CACHE = "bitemap-static-v1";
const TILE_CACHE_MAX = 200;
const SHELL_URLS = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Resilient precache: a single 404/failure must not abort the rest.
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, TILE_CACHE, STATIC_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Evict oldest entries once a cache exceeds `max` entries (simple FIFO LRU).
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, max);
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("network-first: offline and no cache");
  }
}

async function cacheFirst(request, cacheName, max) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (max) trimCache(cacheName, max);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never serve stale vote counts / API data — always hit the network first.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Map tiles: cache-first with an LRU cap so storage doesn't grow unbounded.
  if (url.hostname === "api.maptiler.com") {
    event.respondWith(cacheFirst(request, TILE_CACHE, TILE_CACHE_MAX));
    return;
  }

  // Navigations: try the network, fall back to the offline shell page.
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request).catch(() => caches.match("/offline"))
    );
    return;
  }

  // Other static assets (scripts, styles, fonts, images): SWR.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
