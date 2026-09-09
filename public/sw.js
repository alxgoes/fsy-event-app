const CACHE_NAME = "fsy-pwa-v2";
const STATIC_ASSETS = ["/offline", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset)))
  ));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("fsy-pwa-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Only public build assets are reusable between authenticated sessions.
  const isStatic = url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") || url.pathname === "/icon.svg";
  if (isStatic) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    }));
    return;
  }

  // APIs and React Server Component payloads use the network: never persist
  // private responses across participant sessions on a shared device.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const offlinePage = await cache.match("/offline");
      if (offlinePage) return offlinePage;
      return new Response(
        '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FSY · Sem conexão</title></head><body style="font-family:system-ui;padding:40px;background:#F3EDE2;color:#0F172A"><h1>Você está sem conexão</h1><p>Conecte-se à internet para acessar os dados da sessão.</p><a href="/dashboard" style="color:#007DA5">Tentar novamente</a></body></html>',
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }));
  }
});
