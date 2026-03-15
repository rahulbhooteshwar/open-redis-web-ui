// Service Worker for Open Redis Web UI
// Minimal caching: only pre-cache offline.html.
// All other requests go straight to the network — no SW caching.
// On server-down/offline, navigate requests get the offline page.

const CACHE_NAME = 'orwui-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add('/offline.html'))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept navigation requests (page loads/reloads)
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match('/offline.html'))
  );
});
