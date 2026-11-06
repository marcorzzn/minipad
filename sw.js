const CACHE_NAME = 'minipad-v1.5.4.1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './css/style.css',
  './css/mac-classic.css',
  './css/diagram-modal.css',
  './js/data.js',
  './js/smart-paste.js',
  './js/preview.js',
  './js/export.js',
  './js/ui.js',
  './js/editor.js',
  './js/main.js',
  './js/diagram-builder.js',

  // Editor EasyMDE
  'https://unpkg.com/easymde/dist/easymde.min.js',
  'https://unpkg.com/easymde/dist/easymde.min.css',

  // Core Markdown & Math
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/marked-katex-extension/lib/index.umd.js',
  'https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js',

  // Nuove librerie (Mermaid, Turndown, html2pdf)
  'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
  'https://cdn.jsdelivr.net/npm/turndown/dist/turndown.js',
  'https://cdn.jsdelivr.net/npm/html2pdf.js/dist/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('[SW] Alcuni asset non sono stati pre-caricati in cache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Font KaTeX (.woff2/.woff/.ttf): Cache-first con aggiornamento in background
  if (req.url.match(/\.(woff2?|ttf)(\?|$)/i)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        return (
          hit ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return res;
          })
        );
      })
    );
    return;
  }

  // Risorse same-origin: Stale-while-revalidate
  if (req.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(req, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // CDN esterne: Cache-first con salvataggio al primo download
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      return (
        cachedRes ||
        fetch(req).then((fetchRes) => {
          if (fetchRes && fetchRes.status === 200 && req.url.startsWith('http')) {
            const clone = fetchRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, clone);
            });
          }
          return fetchRes;
        })
      );
    })
  );
});
