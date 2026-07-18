// Gloobal ID service worker — hand-written, no Workbox/vite-plugin-pwa
// dependency, so the exact caching behavior is easy to read and audit.
//
// Update model (the "silent update" requirement):
//   1. A new deploy changes CACHE_VERSION below (done by scripts/generate-sw.js
//      at build time, via a content hash — see that script).
//   2. The browser detects the new sw.js, downloads and installs it in the
//      background. It does NOT activate — it parks itself as "waiting".
//      The person using the app right now is completely unaffected.
//   3. src/registerServiceWorker.js notices the waiting worker and tells
//      the UI (via the update toast) that an update is ready.
//   4. Only when the person taps "Restart" does the app postMessage a
//      SKIP_WAITING to this worker, which activates and takes over —
//      followed by exactly one automatic reload to pick it up.
//
// This file's own precache list (APP_SHELL) is injected at build time by
// scripts/generate-sw.js, which replaces the marker array below with the
// real, content-hashed filenames Vite produced — that's what makes "cache
// the complete shell, never re-download unless a new version exists"
// actually work with Vite's hashed output filenames.

const CACHE_VERSION = "__CACHE_VERSION__";
const SHELL_CACHE = `gloobal-id-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `gloobal-id-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `gloobal-id-runtime-${CACHE_VERSION}`;
const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, RUNTIME_CACHE];

// Replaced at build time with the real list of hashed dist/ files.
// Kept non-empty here so `npm run dev`/unbuilt previews don't 404 on
// install if the service worker is ever registered against source files.
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-16.png",
  "/icons/favicon-32.png",
  "/favicon.ico",
  /* __BUILD_PRECACHE_MANIFEST__ */
];

// Cross-origin hosts we're willing to cache-first: the bank-logo images,
// and Google Fonts' two required origins (the CSS from googleapis.com,
// the actual font files from gstatic.com) so the display typeface still
// renders correctly offline after the first successful load. Everything
// else cross-origin is left completely untouched by this service worker.
const CROSS_ORIGIN_ALLOWLIST = ["logo.clearbit.com", "fonts.googleapis.com", "fonts.gstatic.com"];

function isStaticAsset(pathname) {
  return /\.(?:js|css|mjs|png|jpg|jpeg|svg|gif|webp|avif|woff2?|ttf|eot|ico)$/i.test(pathname);
}

function isCacheableCrossOrigin(url) {
  return CROSS_ORIGIN_ALLOWLIST.includes(url.hostname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL.filter((u) => !u.includes("__BUILD_PRECACHE_MANIFEST__"))))
    // Deliberately no self.skipWaiting() here — see the update model note
    // above. The new worker waits until the person approves the update.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("gloobal-id-") && !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

// The person approved an update (see the toast in the UI) — take over now.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Cross-origin requests made without a `crossorigin` attribute (like the
  // bank-logo <img> tags) come back as "opaque" responses — status is
  // always reported as 0/not-ok by design, even on success, since the
  // browser won't let a service worker inspect a cross-origin response's
  // real status. An opaque response that didn't throw is the best signal
  // we get that it succeeded, so it's cached too, not just `response.ok`
  // same-origin responses.
  if (response && (response.ok || response.type === "opaque")) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await networkPromise) || Response.error();
}

async function networkFirstNavigation(event) {
  const { request } = event;
  try {
    // A navigation-preload response (if the browser started one) arrives
    // here already in flight — using it instead of a fresh fetch saves a
    // full round trip on first byte for the very request that determines
    // how "instant" the app feels to open.
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(request));
    const cache = await caches.open(SHELL_CACHE);
    cache.put("/index.html", response.clone());
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match("/index.html")) || (await cache.match("/offline.html"));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (isCacheableCrossOrigin(url)) {
      event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    }
    return; // everything else cross-origin: untouched, straight to network
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Anything else same-origin (future API-style calls, etc.): stale-
  // while-revalidate — instant from cache when we have one, refreshed
  // silently in the background for next time.
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});
