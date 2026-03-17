import { articles, sortByDateDesc, buildArticleUrl } from "./articles-data.js";

const STATIC_CACHE = "mistral-static-v2";
const RUNTIME_CACHE = "mistral-runtime-v2";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./article.html",
  "./author.html",
  "./series.html",
  "./category.html",
  "./about.html",
  "./contact.html",
  "./legal.html",
  "./weather.html",
  "./dashboard.html",
  "./404.html",
  "./styles.css",
  "./script.js",
  "./article.js",
  "./author.js",
  "./series.js",
  "./category.js",
  "./WeatherMap.js",
  "./static-page.js",
  "./contact.js",
  "./dashboard.js",
  "./newsletter.js",
  "./404.js",
  "./articles-data.js",
  "./articles-content.js",
  "./analytics.js",
  "./pwa.js",
  "./social-preview.svg",
  "./logo_mistral.png",
  "./logo-mistral.svg",
  "./favicon_mistral.ico/manifest.json",
  "./favicon_mistral.ico/favicon-32x32.png",
  "./favicon_mistral.ico/favicon-16x16.png",
];

function getLatestArticleUrls(limit = 8) {
  return [...articles].sort(sortByDateDesc).slice(0, limit).map((article) => buildArticleUrl(article.id));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll([...new Set([...SHELL_ASSETS, ...getLatestArticleUrls()])]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

async function handleNavigationRequest(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("./index.html");
  }
}

async function handleAssetRequest(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const network = await fetchPromise;
  if (network) return network;
  return caches.match("./index.html");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});
