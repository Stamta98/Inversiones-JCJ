/**
 * Service worker.
 *
 * Two jobs, and deliberately no more:
 *
 * 1. Make the app installable, so a collector gets a real icon on their phone
 *    instead of a browser bookmark.
 * 2. Say something useful when the phone loses signal in the middle of a
 *    route, instead of the browser's dinosaur.
 *
 * It never caches a page: every screen here is per company and per user, and
 * a cached one would show a collector another company's numbers, or yesterday's
 * balance presented as today's. Only the build's own static files and the
 * offline notice are kept, and those are content addressed or fixed.
 */

const CACHE = "jcj-shell-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Immutable build output: safe to keep, and what makes a reload feel instant. */
function isBuildAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Anything that changes data goes to the network or fails; there is no such
  // thing as a cached payment.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error()),
      ),
    );
  }
});
