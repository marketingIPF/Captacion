// Service worker simple — cachea los archivos estáticos
// para que la app funcione sin conexión.
const CACHE = "rkp-captacion-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/app.js",
  "./js/agents.js",
  "./assets/logo.svg",
  "./assets/logo-white.png",
  "./assets/icon.svg",
  "./manifest.webmanifest",
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchAndCache = fetch(req).then(res => {
        const copy = res.clone();
        if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes("fonts.googleapis"))) {
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchAndCache;
    })
  );
});
