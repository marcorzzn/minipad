const CACHE_NAME = 'minipad-v4.0';
const urlsToCache = [
  './',
  './index.html',
  './icon.svg',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/ui.js',
  './js/editor.js',
  './js/preview.js',
  './js/main.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js',
  'https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache).catch(err => {
          console.warn("Some absolute URLs failed caching, skipping...", err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // Stale-while-revalidate strategy for same-origin requests
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => {
          // If network fails, just rely on cache
        });

        event.waitUntil(fetchPromise);

        // Return cached response immediately if available, while fetching in background
        return cachedResponse || fetchPromise;
      })
    );
  } else {
    // Cache First for CDNs
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchRes => {
          if (event.request.method === "GET" && event.request.url.startsWith("http")) {
             caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, fetchRes.clone());
             });
          }
          return fetchRes;
        });
      })
    );
  }
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
