const CACHE_NAME = 'waveorder-fidelity-v1';
const ASSETS_TO_CACHE = [
  '/icon-192.jpg',
  '/icon-512.jpg'
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
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Ignora le chiamate API o i checkout Stripe per evitare problemi con i pagamenti
  if (event.request.url.includes('/api/') || event.request.url.includes('stripe.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Fallback offline silenzioso
        return caches.match('/icon-192.jpg');
      });
    })
  );
});
