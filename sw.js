const CACHE = 'sphynx-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/SPHYNX_LOGO_WHITE.png',
  '/SPHYNY_MOTION_FAV.png',
  '/App_Cvr_Art.png',
  '/assets/posters/image-11.jpg',
  '/assets/posters/image-13.jpg',
  '/assets/posters/image-14.jpg',
  '/assets/posters/image-15.jpg',
  '/assets/posters/image-16.jpg',
  '/assets/posters/image-17.jpg',
  '/assets/posters/image-18.jpg',
  '/assets/posters/image-19.jpg',
  '/assets/posters/image-20.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Stream videos directly — never cache
  if (url.pathname.endsWith('.mp4')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
