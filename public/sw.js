const VERSION = "homeledger-v2";
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const STATIC_MAX = 300;

// App screens whose HTML may be kept for offline opens. The HTML is the same shell for every
// user (all household data loads in the browser after sign-in), so it holds nothing private.
const APP_PATHS = ["/home", "/add", "/transactions", "/reports", "/more"];

const OFFLINE_PAGE = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>HomeLedger · Offline</title>
<style>body{font-family:system-ui,sans-serif;background:#fef9f4;color:#2a1d17;margin:0;padding:48px 20px;max-width:28rem}
a{display:inline-block;margin:16px 12px 0 0;padding:12px 18px;border-radius:16px;background:#b54a2a;color:#fff;text-decoration:none;font-weight:600}
@media (prefers-color-scheme:dark){body{background:#17110e;color:#f1ebe4}a{background:#e3876a;color:#1d1410}}</style></head>
<body><p style="font-weight:600;opacity:.7">HomeLedger</p><h1>You're offline</h1>
<p>This screen hasn't been opened on this phone yet. Home and Add work offline once you've opened them online, and expenses you add sync when you're back.</p>
<a href="/home">Open Home</a><a href="/add">Add expense</a></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== PAGES && key !== STATIC).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => "focus" in client);
      return open ? open.focus() : self.clients.openWindow("/home");
    }),
  );
});

function isAppPage(url) {
  return APP_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
}

async function trimStatic() {
  const cache = await caches.open(STATIC);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_MAX)).map((key) => cache.delete(key)));
}

// The first visit loads its scripts before this worker takes control, so keep every build file a
// kept screen refers to; otherwise an offline open would find the HTML but not its JavaScript.
async function warm(html) {
  // Paths end at a quote, space, bracket or backslash (the inline Next payload escapes its quotes).
  const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
  const cache = await caches.open(STATIC);
  await Promise.all(
    files.map(async (path) => {
      if (await cache.match(path)) return;
      try {
        const response = await fetch(path);
        if (response.ok) await cache.put(path, response);
      } catch {
        /* next visit tries again */
      }
    }),
  );
  await trimStatic();
}

// Screens: always the network first, so online users get the latest build; the kept copy is only
// for when the network fails. Redirects (signed out) and errors are never kept.
async function page(event, request, url) {
  const key = url.origin + url.pathname;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) {
      const copy = response.clone();
      const scan = response.clone();
      event.waitUntil(
        caches
          .open(PAGES)
          .then((cache) => cache.put(key, copy))
          .then(() => scan.text())
          .then(warm),
      );
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES);
    const kept = (await cache.match(key)) ?? (url.pathname.startsWith("/add") ? await cache.match(url.origin + "/add") : null);
    return kept ?? new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

// Build files have content hashes in their names, so a kept copy never goes stale.
async function staticFile(request) {
  const cache = await caches.open(STATIC);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    void trimStatic();
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only this site; never Supabase, Google or the API/auth routes, and never React Server
  // Component payloads (they vary by request headers).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (url.searchParams.has("_rsc") || request.headers.get("RSC")) return;

  if (request.mode === "navigate") {
    if (isAppPage(url)) event.respondWith(page(event, request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) event.respondWith(staticFile(request));
});
