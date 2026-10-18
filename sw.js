/* Little Grades service worker: makes the app open offline.
   Change VERSION whenever you change any app file, so phones pick up the update. */
const VERSION = 'lg-v1';
const SHELL = [
  './', 'index.html', 'privacy.html', 'manifest.webmanifest', 'css/styles.css',
  'js/engine.js', 'js/util.js', 'js/themes.js', 'js/store.js', 'js/ui.js', 'js/app.js',
  'js/pages/grades.js', 'js/pages/welcome.js', 'js/pages/home.js', 'js/pages/activities.js',
  'js/pages/calendar.js', 'js/pages/tools.js', 'js/pages/tools-media.js', 'js/pages/settings.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  if (isFont) {
    // Fonts: show the saved copy straight away, refresh it in the background.
    e.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  // App files: network first (so updates arrive), saved copy when offline.
  e.respondWith(
    fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
