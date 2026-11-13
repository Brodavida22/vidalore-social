// VIDALORE SOCIAL Service Worker
const CACHE_NAME = "vidalore-cache-v4";
const STATIC_ASSETS = [
  "/",
  "/icon.svg",
  "/icon-maskable.svg",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

const OFFLINE_HTML = `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#080808" />
  <title>Offline — VIDALORE SOCIAL</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #080808; color: #ffffff; min-height: 100dvh; display: grid; place-items: center; padding: 24px; text-align: center; }
    .card { max-width: 360px; background: #111111; border: 1px solid #27272a; border-radius: 20px; padding: 28px 24px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 20px; }
    button { background: #e91e63; color: #ffffff; border: 0; border-radius: 12px; padding: 10px 18px; font-weight: 600; font-size: 13px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are offline</h1>
    <p>Check your internet connection and retry to continue using VIDALORE SOCIAL.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCodeOrDocumentRequest(request, url) {
  if (request.mode === "navigate") return true;
  if (
    request.destination === "document" ||
    request.destination === "script" ||
    request.destination === "style"
  ) {
    return true;
  }
  return /\.(?:js|mjs|css|html)(?:\?|$)/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Always bypass cache for non-GET, range streaming, APIs, and Supabase requests
  if (
    request.method !== "GET" ||
    request.url.includes("/rest/v1/") ||
    request.url.includes("/auth/v1/") ||
    request.url.includes("/storage/v1/") ||
    request.url.includes("supabase.co") ||
    request.headers.get("range")
  ) {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML navigations and app bundles so deployments are never stale
  if (isCodeOrDocumentRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === "navigate") {
            const rootCached = await caches.match("/");
            if (rootCached) return rootCached;
            return new Response(OFFLINE_HTML, {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
          return Response.error();
        }),
    );
    return;
  }

  // Stale-while-revalidate for static icons, images, and manifest
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});
