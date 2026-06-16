const CACHE_NAME = 'sirafest-admin-v2';

const assetsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/admin.css',
  '/admin.js',
  '/sw.js',
  '/asset/Notifikasi order.wav',
  '/asset/Sound login.wav',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

