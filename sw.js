const CACHE_NAME = 'minipad-v4.1';
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
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Identify core assets (HTML, CSS, JS) and navigations
  const isNavigate = event.request.mode === 'navigate';
  const isCoreAsset = isNavigate ||
                      event.request.destination === 'style' ||
                      event.request.destination === 'script' ||
                      url.pathname.endsWith('.html') ||
                      url.pathname.endsWith('.css') ||
                      url.pathname.endsWith('.js') ||
                      url.pathname === '/';

  if (isCoreAsset) {
    // Network-First strategy
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If response is valid, clone and cache it
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline or network fails, match in cache
          return caches.match(event.request).then(cachedRes => {
              if (cachedRes) return cachedRes;
              // Fallback to index.html if navigating
              if (event.request.mode === 'navigate') {
                  return caches.match('./index.html');
              }
          });
        })
    );
  } else {
    // Cache-First strategy for images, fonts, CDNs, etc.
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response; // Found in cache
          }
          // Not found, fetch from network
          return fetch(event.request).then(netResponse => {
            if (netResponse && (netResponse.status === 200 || netResponse.type === 'opaque')) {
               const responseToCache = netResponse.clone();
               caches.open(CACHE_NAME).then(cache => {
                 cache.put(event.request, responseToCache);
               });
            }
            return netResponse;
          }).catch(err => console.error("Fetch failed for:", event.request.url, err));
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
