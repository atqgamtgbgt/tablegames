/* 盤戯のオフラインキャッシュ。GitHub Pagesのサブパスでも動く。 */
const CACHE = 'bangi-assets-v4';
const precache = [
  './', './index.html', './assets/style.css?v=4',
  './assets/core.js?v=4', './assets/curriculum.js?v=4', './assets/app.js?v=4',
  './manifest.webmanifest', './assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(precache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('bangi-assets-') && key !== CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigation should get the newest HTML when connected, but work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return await cache.match('./index.html') || Response.error();
      })
    );
    return;
  }
  // Only cache known local app assets. Never intercept API calls.
  const allowed = precache.some((path) => new URL(path, self.registration.scope).href === url.href);
  if (allowed) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
