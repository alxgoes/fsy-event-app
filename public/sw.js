const CACHE_NAME = "fsy-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/offline",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// 1. Install: Precache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[FSY SW] Non-critical asset precache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate: Clean up older cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch: Cache-First for static assets, Network-First for APIs and pages
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore chrome-extension or other non-http schemes
  if (!url.protocol.startsWith("http")) return;

  // Ignore mutating POST/PUT/DELETE requests (they cannot be cached by Cache API)
  if (request.method !== "GET") return;

  // A. Static Next.js chunks, fonts, icons -> Cache First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // B. Event APIs (/api/schedule, /api/announcements, /api/companies) -> Network First with Cache Fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: "Offline mode", data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          });
        })
    );
    return;
  }

  // C. HTML Pages navigation -> Network First with Fallback to Cache or /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlineFallback = await caches.match("/offline");
          if (offlineFallback) return offlineFallback;
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FSY Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0B1528;color:#fff;"><h1>FSY 2027 • Modo Offline</h1><p>Você está sem conexão de internet. Os dados em cache do painel continuarão funcionando!</p><a href="/dashboard" style="color:#7DE3F4;">Abrir Painel</a></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
  }
});
