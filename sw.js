// وِردي — يجعل التطبيق يفتح بلا إنترنت، ويجلب أحدث نسخة عند توفر الاتصال.
const CACHE = 'wirdi-v4';
const QCACHE = 'wirdi-quran-v1'; // Mushaf text and tafsir: saved once, then readable offline
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== QCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// tapping a prayer notification opens the app on today's prayers
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { if (c.navigate) c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never cache the Google Sheet connection
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  if (url.hostname === 'api.alquran.cloud') {
    // Qur'an text never changes: serve from cache, fetch once
    e.respondWith(caches.open(QCACHE).then(c => c.match(req).then(r => r || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (req.mode === 'navigate' || url.origin === location.origin) {
    // the app itself: network first, so updates arrive; cache as fallback offline
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    // fonts: cache first
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});
