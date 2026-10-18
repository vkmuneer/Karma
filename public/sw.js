// Service worker: push notifications + offline fallback for visited pages.
const CACHE = 'karma-v1';
const ASSETS = ['/css/style.css?v=1', '/js/common.js?v=1', '/js/site.js?v=1', '/img/logo-160.png', '/img/logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for pages (fresh alerts matter most), cache as fallback when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      if (!url.pathname.startsWith('/member')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('/'))));
    return;
  }
  if (/\.(css|js|png|jpg|jpeg|webp|gif|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/img/'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })));
  }
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data.json(); } catch (err) { data = { title: 'Karma Omassery', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Karma Omassery', {
    body: data.body || '',
    icon: '/img/icon-192.png',
    badge: '/img/favicon.png',
    tag: data.tag,
    renotify: true,
    data: { url: data.url || '/alerts' },
    vibrate: [200, 100, 200],
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url || '/alerts';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
