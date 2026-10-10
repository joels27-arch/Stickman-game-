// INKFALL service worker: precache the app shell, then cache-first for
// everything same-origin (so optimized art in assets/game/ is cached on first use).
const VERSION = 'inkfall-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './src/main.js', './src/config.js', './src/assets.js', './src/audio.js', './src/input.js', './src/save.js',
  './src/core/util.js', './src/core/loop.js',
  './src/game/world.js', './src/game/unit.js', './src/game/team.js', './src/game/ai.js', './src/game/levels.js',
  './src/render/renderer.js', './src/render/stick.js', './src/render/fx.js',
  './src/ui/hud.js', './src/ui/menus.js', './src/ui/tutorial.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
];
const OPTIONAL = [
  './assets/game/monument_blue.webp', './assets/game/monument_red.webp',
  './assets/game/bg_grassland.webp', './assets/game/bg_desert.webp', './assets/game/bg_snow.webp',
  './assets/game/bg_volcano.webp', './assets/game/bg_night.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // art is optional (the game falls back to code-drawn art), don't fail install
    await Promise.all(OPTIONAL.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    // network-first for code so updates land quickly, cache-first for art
    const isCode = /\.(js|css|html|webmanifest)$/.test(new URL(req.url).pathname) || req.mode === 'navigate';
    if (hit && !isCode) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return hit || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }
  })());
});
