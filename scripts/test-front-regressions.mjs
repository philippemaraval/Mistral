import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const pageSuites = [
  {
    name: "Accueil",
    html: "index.html",
    scripts: ["script.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "Article",
    html: "article.html",
    scripts: ["article.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "Catégorie",
    html: "category.html",
    scripts: ["category.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "Auteur",
    html: "author.html",
    scripts: ["author.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "Série",
    html: "series.html",
    scripts: ["series.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "Météo",
    html: "weather.html",
    scripts: ["static-page.js", "WeatherMap.js"],
    requireNewsletterForm: false,
  },
  {
    name: "Dashboard",
    html: "dashboard.html",
    scripts: ["static-page.js", "dashboard.js"],
    requireNewsletterForm: false,
  },
  {
    name: "Contact",
    html: "contact.html",
    scripts: ["static-page.js", "contact.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "404",
    html: "404.html",
    scripts: ["static-page.js", "404.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "À propos",
    html: "about.html",
    scripts: ["static-page.js", "newsletter.js"],
    requireNewsletterForm: true,
  },
  {
    name: "Mentions légales",
    html: "legal.html",
    scripts: ["static-page.js"],
    requireNewsletterForm: false,
  },
];

const scriptSourceCache = new Map();
const scriptIdSelectorCache = new Map();

function collectHtmlIds(htmlSource) {
  const ids = new Set();
  const idPattern = /\sid="([^"]+)"/g;

  let match = idPattern.exec(htmlSource);
  while (match) {
    ids.add(match[1]);
    match = idPattern.exec(htmlSource);
  }

  return ids;
}

function collectLocalScriptImports(htmlSource) {
  const imports = new Set();
  const scriptPattern = /<script[^>]*src="\.\/([^"]+)"[^>]*>/g;

  let match = scriptPattern.exec(htmlSource);
  while (match) {
    imports.add(match[1]);
    match = scriptPattern.exec(htmlSource);
  }

  return imports;
}

function collectQuerySelectorIds(scriptSource) {
  const ids = new Set();
  const selectorPattern = /\bquerySelector(?:All)?\(\s*["'`]#([A-Za-z0-9_-]+)["'`]\s*\)/g;

  let match = selectorPattern.exec(scriptSource);
  while (match) {
    ids.add(match[1]);
    match = selectorPattern.exec(scriptSource);
  }

  return ids;
}

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

async function assertFileExists(relativePath) {
  await access(path.join(projectRoot, relativePath));
}

async function getScriptSource(scriptPath) {
  if (!scriptSourceCache.has(scriptPath)) {
    const source = await readProjectFile(scriptPath);
    scriptSourceCache.set(scriptPath, source);
  }
  return scriptSourceCache.get(scriptPath);
}

async function getScriptIdSelectors(scriptPath) {
  if (!scriptIdSelectorCache.has(scriptPath)) {
    const source = await getScriptSource(scriptPath);
    scriptIdSelectorCache.set(scriptPath, collectQuerySelectorIds(source));
  }
  return scriptIdSelectorCache.get(scriptPath);
}

async function run() {
  const failures = [];
  let checks = 0;

  for (const suite of pageSuites) {
    const htmlSource = await readProjectFile(suite.html);
    const htmlIds = collectHtmlIds(htmlSource);
    const importedScripts = collectLocalScriptImports(htmlSource);

    for (const expectedScript of suite.scripts) {
      checks += 1;
      if (!importedScripts.has(expectedScript)) {
        failures.push(
          `[${suite.name}] script manquant dans ${suite.html}: ./` + expectedScript
        );
        continue;
      }

      checks += 1;
      try {
        await assertFileExists(expectedScript);
      } catch {
        failures.push(`[${suite.name}] fichier script introuvable: ${expectedScript}`);
        continue;
      }

      const requiredIds = await getScriptIdSelectors(expectedScript);
      for (const requiredId of requiredIds) {
        checks += 1;
        if (!htmlIds.has(requiredId)) {
          failures.push(
            `[${suite.name}] l'id "${requiredId}" est requis par ${expectedScript} mais absent de ${suite.html}`
          );
        }
      }
    }

    if (suite.requireNewsletterForm) {
      checks += 1;
      if (!htmlSource.includes("data-newsletter-form")) {
        failures.push(
          `[${suite.name}] formulaire newsletter manquant (attribut data-newsletter-form)`
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error("Echec des tests de non-régression front:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`OK: ${checks} vérifications de non-régression front passées.`);
}

run().catch((error) => {
  console.error("Erreur inattendue dans le test front:", error);
  process.exit(1);
});
