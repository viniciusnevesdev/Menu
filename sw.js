'use strict';
const CACHE = 'menu-pwas-v10';
const ASSETS = ['index.html', 'styles.css', 'lib.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'apps.json'];
const base = new URL('./', self.location.href);
const ownURLs = new Set(ASSETS.map(path => new URL(path, base).href));
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll([...ownURLs])).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('menu-pwas-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== base.origin) return;
  const navigation = event.request.mode === 'navigate' && (url.pathname === base.pathname || url.pathname === base.pathname + 'index.html');
  if (!navigation && !ownURLs.has(url.href)) return;
  const key = navigation ? new URL('index.html', base).href : url.href;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, {cache: 'no-store'});
      if (!response.ok) throw Error('Network response unavailable');
      // Never persist redirects to other applications or origins.
      if (!response.redirected) await cache.put(key, response.clone());
      return response;
    } catch {
      const cached = await cache.match(key);
      if (!cached) return new Response('Conteúdo indisponível offline.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
      const headers = new Headers(cached.headers); headers.set('X-Menu-Offline', '1');
      return new Response(cached.body, {status: cached.status, headers});
    }
  })());
});
