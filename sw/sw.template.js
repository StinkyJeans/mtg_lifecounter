/* Service worker. Generated into public/sw.js by scripts/stamp-sw.mjs, which
 * replaces __BUILD_ID__ so every build is a byte-different worker (that is what
 * triggers the browser's update check and our "new version" prompt).
 *
 * Strategy
 *  - install: fetch "/" and everything it references under /_next/static
 *    (JS, CSS, self-hosted fonts referenced from CSS) plus icons and manifest,
 *    into one versioned cache. No skipWaiting: the page asks for it.
 *  - navigation: cache-first from the versioned cache, so the shell opens
 *    instantly and offline. The HTML and its chunk hashes always match.
 *  - /_next/static: cache-first (content-hashed, immutable), fill on miss.
 *  - everything else (Supabase, APIs): untouched, straight to network.
 */
const BUILD_ID = "__BUILD_ID__";
const CACHE = `mtg-life-${BUILD_ID}`;
// Filled by scripts/stamp-sw.mjs --post with every file Next emitted under /_next/static.
const PRECACHE = [];
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png", "/icons/mark.svg", "/textures/grain-paper.svg", "/textures/ruled-diamonds.svg"];

const STATIC_RE = /\/_next\/static\/[^"'\s)\\<>]+/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch("/", { cache: "reload" });
  const html = await res.clone().text();
  await cache.put("/", res);

  const assets = new Set(html.match(STATIC_RE) ?? []);
  // CSS pulls in the font files; walk it one level.
  const cssUrls = [...assets].filter((u) => u.split("?")[0].endsWith(".css"));
  for (const css of cssUrls) {
    const r = await fetch(css, { cache: "reload" });
    if (!r.ok) continue;
    const text = await r.clone().text();
    await cache.put(css, r);
    const base = new URL(css, self.location.origin);
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const target = new URL(m[1], base);
      if (target.origin === self.location.origin) assets.add(target.pathname + target.search);
    }
  }
  await Promise.all(
    [...assets, ...PRECACHE, ...SHELL.filter((u) => u !== "/")].map(async (u) => {
      if (await cache.match(u)) return;
      try {
        const r = await fetch(u, { cache: "reload" });
        if (r.ok) await cache.put(u, r);
      } catch {
        /* best effort per asset; runtime caching fills gaps */
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("mtg-life-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match("/")) || fetch(req)),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/textures/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
