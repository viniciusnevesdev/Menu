const CACHE = "menu-pwas-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin === location.origin) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
