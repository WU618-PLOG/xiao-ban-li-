/* =========================================================
   小板栗 · Service Worker（离线缓存）
   策略：
   - 预缓存全部静态资源，断网也能打开
   - 页面导航：网络优先（拿到最新页面），离线时回退缓存
   - 静态资源：缓存优先 + 后台更新（stale-while-revalidate）
   ★ 每次更新网页文件后，请把下面 VERSION 号 +1，用户端才会拿到新版本
   ========================================================= */
const VERSION = 'v1';
const CACHE = 'xiaobanli-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/tasks.js',
  './js/sound.js',
  './js/pet.js',
  './js/app.js',
  './js/pwa.js',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* 页面导航：网络优先，离线回退缓存页面 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 静态资源：缓存优先 + 后台更新 */
  e.respondWith(
    caches.match(req).then((hit) => {
      const update = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || update;
    })
  );
});
