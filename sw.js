const CACHE = 'sphynx-v6';
const PRECACHE = [
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Never intercept cross-origin or API calls
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.endsWith('.mp4') || url.pathname.endsWith('.m3u8')) return;

  // HTML documents: network-first so index.html is always fresh
  const isHtml = url.pathname === '/' || url.pathname.endsWith('.html') || !url.pathname.includes('.');
  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/'));
    })
  );
});

self.addEventListener('push', e => {
  let data = { title: 'SPHYNX MOTION', body: 'You have a new notification', url: '/' };
  try { data = Object.assign(data, e.data.json()); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/SPHYNY_MOTION_FAV.png',
      badge: '/SPHYNY_MOTION_FAV.png',
      data: { url: data.url },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
