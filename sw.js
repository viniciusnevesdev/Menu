const CACHE = "menu-pwas-v8";
const ASSETS = ["./index.html", "./manifest.webmanifest", "./icon.svg", "./apps.json"];

self.addEventListener("install", event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => caches.open(CACHE))
    .then(cache => cache.addAll(ASSETS))
    .then(() => self.skipWaiting())
));

self.addEventListener("activate", event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isCatalog = url.pathname.endsWith("/apps.json");

  if (isNavigation || isCatalog) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(isNavigation ? "./index.html" : "./apps.json", copy));
        return response;
      }).catch(() => caches.match(isNavigation ? "./index.html" : "./apps.json"))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
