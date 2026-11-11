// Saves pages as you visit them so they open instantly and work without a connection.
//
// App pages (Home, Meals, Shopping, Trips, Settings) open straight from the saved copy;
// the page then fetches current data in the background (see KeepFresh). Other pages load
// from the network and fall back to the saved copy when the network is down or too slow.
//
// In-app navigation fetches page data rather than whole pages; that's left to the network.
// When it fails offline, Next falls back to a full page load, which is answered from here.

const PAGES = "pages-v2";
const STATIC = "static-v1"; // build files have hashed names, so they never change once published
const OFFLINE_URL = "/offline.html";
const NETWORK_TIMEOUT_MS = 4000; // weak signal in a store: show the saved page instead of waiting
const REFRESH_AFTER_MS = 5 * 60 * 1000; // background refreshes of a page at most this often
const INSTANT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // older saved copies aren't shown first
// A reload right after an instant open (pull to refresh, or Next reloading after a deploy)
// goes to the network, so it never loops on an outdated copy
const INSTANT_AGAIN_AFTER_MS = 30 * 1000;
const MAX_STATIC_ENTRIES = 400;
const SAVED_AT = "x-saved-at";
const ASSETS = "x-assets";

// Pages that are never saved: sign-in callbacks, OAuth screens, invite links, APIs
const SKIP = /^\/(?:api|auth|oauth|invite|\.well-known)(?:\/|$)/;
// Signed-in app pages, which open from the saved copy and refresh themselves
const INSTANT = /^\/(?:dashboard|meals|shopping|trips|settings)(?:\/|$)/;

const instantOpened = new Map(); // page → when it was last opened from the saved copy

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== PAGES && key !== STATIC) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    if (url.origin === self.location.origin && !SKIP.test(url.pathname)) event.respondWith(page(event));
    return;
  }
  if (
    (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.hostname === "fonts.googleapis.com") {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Everything else (data, APIs) goes straight to the network
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "refresh-pages" && Array.isArray(data.urls)) event.waitUntil(refresh(data.urls));
  if (data.type === "clear-pages") event.waitUntil(clearPages());
});

// ── Pages ────────────────────────────────────────────────────────────────────

const pageKey = (href) => {
  const url = new URL(href, self.location.origin);
  url.hash = "";
  return url.href;
};

function savable(res) {
  return (
    res.ok &&
    res.status === 200 &&
    !res.redirected && // e.g. sent to /login: don't save that under this page's address
    res.type === "basic" &&
    (res.headers.get("content-type") || "").includes("text/html")
  );
}

// Build files a page refers to: <script>/<link> tags, plus chunks named in its embedded
// page data, which load later (e.g. when a dialog opens). Route groups put parentheses in
// file names (app/(protected)/meals/page-….js); a ")" on its own ends a CSS url(…).
const ASSET_URL = /(?:\/_next\/)?static\/(?:chunks|css|media)\/(?:[^"'\s\\()<>]|\([^"'\s\\()<>/]*\))+/g;

function assetsIn(text) {
  return [...new Set((text.match(ASSET_URL) || []).map((p) => (p.startsWith("/_next/") ? p : `/_next/${p}`)))];
}

/** Saves a page, then the scripts and styles it needs, so it can run from the device. */
async function save(cache, key, res) {
  const html = await res.text();
  const assets = assetsIn(html);
  const headers = new Headers(res.headers);
  headers.set(SAVED_AT, String(Date.now()));
  headers.set(ASSETS, JSON.stringify(assets));
  await cache.put(key, new Response(html, { status: res.status, statusText: res.statusText, headers }));
  await saveAssets(assets);
}

async function saveAssets(paths) {
  const cache = await caches.open(STATIC);
  for (const path of paths) {
    if (await cache.match(path)) continue;
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      // Stylesheets name the fonts they use
      if (path.endsWith(".css")) await saveAssets(assetsIn(await res.clone().text()));
      await cache.put(path, res);
    } catch {
      return; // offline: try again next time
    }
  }
  trim(cache);
}

/** Whether every build file the saved page needs is on the device (null: not recorded). */
async function assetsReady(saved) {
  const list = saved.headers.get(ASSETS);
  if (!list) return null;
  const cache = await caches.open(STATIC);
  for (const path of JSON.parse(list)) {
    if (!(await cache.match(path))) return false;
  }
  return true;
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function page(event) {
  const cache = await caches.open(PAGES);
  const key = pageKey(event.request.url);
  const { pathname } = new URL(key);

  // App pages: open the saved copy right away when it can run as is
  if (INSTANT.test(pathname)) {
    const saved = await cache.match(key);
    const age = Date.now() - Number(saved?.headers.get(SAVED_AT) || 0);
    const openedRecently = Date.now() - (instantOpened.get(key) || 0) < INSTANT_AGAIN_AFTER_MS;
    if (saved && age < INSTANT_MAX_AGE_MS && !openedRecently && (await assetsReady(saved)) === true) {
      instantOpened.set(key, Date.now());
      return saved;
    }
  }

  // Network first; the saved copy when offline or slow; the offline page if never saved
  const network = fetch(event.request).then((res) => {
    // Saved in the background so the page still streams in as it arrives
    if (savable(res)) event.waitUntil(save(cache, key, res.clone()).catch(() => {}));
    return res;
  });

  try {
    return await Promise.race([network, timeout(NETWORK_TIMEOUT_MS)]);
  } catch {
    const saved = (await cache.match(key)) || (await cache.match(key, { ignoreSearch: true }));
    // A saved page missing its build files would crash; the offline page is better
    if (saved && (await assetsReady(saved)) !== false) {
      event.waitUntil(network.catch(() => {})); // still save the fresh copy if it arrives
      return saved;
    }
    try {
      return await network; // slow but not offline: keep waiting
    } catch {
      return (await cache.match(OFFLINE_URL)) || Response.error();
    }
  }
}

/** Saves fresh copies of pages the app expects you to open, unless saved recently. */
async function refresh(urls) {
  const cache = await caches.open(PAGES);
  for (const href of urls) {
    const url = new URL(href, self.location.origin);
    if (url.origin !== self.location.origin || SKIP.test(url.pathname)) continue;
    const key = pageKey(url.href);
    const saved = await cache.match(key);
    const savedAt = Number(saved?.headers.get(SAVED_AT) || 0);
    if (Date.now() - savedAt < REFRESH_AFTER_MS) continue;
    try {
      const res = await fetch(url.href, { credentials: "same-origin", headers: { Accept: "text/html" } });
      if (savable(res)) await save(cache, key, res);
    } catch {
      // Offline: keep the copy we have
    }
  }
}

/** On sign-out: forget saved pages, which hold the signed-in person's data. */
async function clearPages() {
  instantOpened.clear();
  await caches.delete(PAGES);
  const cache = await caches.open(PAGES);
  await cache.add(new Request(OFFLINE_URL, { cache: "reload" })).catch(() => {});
}

// ── Build files and fonts ────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trim(cache);
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  return network;
}

// Old deploys' files pile up; drop the oldest once there are too many
async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(key);
}
