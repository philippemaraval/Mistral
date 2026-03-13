import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

const entries = [
  "index.html",
  "styles.css",
  "script.js",
  "social-preview.svg",
  "logo mistral.PNG",
  "logo-mistral.svg",
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
