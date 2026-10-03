/* ---------------------------------------------------------------------------
 * Area11 service worker — internet band ho to bhi app ki shakal khuli rahe.
 * Soch:
 *   - /_next/static/*  (hashed files)  -> cache-first  (kabhi nahi badalte)
 *   - safhe (navigation)               -> network pehle, 3 sec na mile to cache,
 *                                         warna /offline ka safha
 *   - /api/*                           -> HAMESHA network (data zinda rehna chahiye);
 *                                         fail ho to saaf error, purana data nahi
 * Ahem: asli data shop PC par (SQLite) hota hai — SW sirf UI ko zinda rakhta hai.
 * ------------------------------------------------------------------------- */
const VERSION = "area11-v1";
const STATIC = VERSION + "-static";
const PAGES = VERSION + "-pages";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetchWithTimeout(request, 3000);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    const offline = await cache.match(OFFLINE_URL);
    return offline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (r) => { clearTimeout(timer); resolve(r); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // bahar ki cheezein chhodo
  if (url.pathname.startsWith("/api/")) return;             // data = network only
  if (url.pathname === "/sw.js") return;

  if (isStatic(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
    return;
  }
  // baqi (fonts, images, css) -> network, fail ho to cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
