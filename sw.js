const CACHE_NAME = 'minipad-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/katex/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Optionally cache new dynamic requests if needed
        return networkResponse;
      }).catch(() => {
        // Offline fallback logic here if needed
      });
    })
  );
});
