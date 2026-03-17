import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

const entries = [
  "index.html",
  "dashboard.html",
  "article.html",
  "author.html",
  "series.html",
  "category.html",
  "about.html",
  "contact.html",
  "legal.html",
  "404.html",
  "weather.html",
  "styles.css",
  "script.js",
  "dashboard.js",
  "analytics.js",
  "pwa.js",
  "sw.js",
  "article.js",
  "author.js",
  "series.js",
  "category.js",
  "WeatherMap.js",
  "static-page.js",
  "ui-utils.js",
  "contact.js",
  "newsletter.js",
  "404.js",
  "articles-data.js",
  "articles-content.js",
  "social-preview.svg",
  "_headers",
  "_redirects",
  "logo_mistral.png",
  "logo-mistral.svg",
  "favicon_mistral.ico",
  "admin",
  "uploads",
  "documents",
];

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const entry of entries) {
  await cp(path.join(__dirname, entry), path.join(distDir, entry), {
    recursive: true,
  });
}

console.log("Built static site into dist/");
