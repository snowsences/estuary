// Network-first service worker: always load the latest files when online, and fall back to the
// last copies only when offline. Other origins (Firebase, Google Fonts) are left to the network.
const CACHE = 'estuary-offline-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate';
  // One cache entry per file: pages share the app shell, and ?v= query strings are ignored.
  const key = navigation ? new URL('./', self.registration.scope).href : url.origin + url.pathname;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = navigation
          ? await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
          : await fetch(request, { cache: 'no-cache' });
        if (response.ok) await cache.put(key, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(key);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
