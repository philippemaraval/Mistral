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
const scriptSimpleSelectorCache = new Map();
const scriptLocalImportCache = new Map();
let buildEntriesCache = null;

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

function collectHtmlClasses(htmlSource) {
  const classes = new Set();
  const classPattern = /\sclass="([^"]+)"/g;

  let match = classPattern.exec(htmlSource);
  while (match) {
    match[1]
      .split(/\s+/)
      .filter(Boolean)
      .forEach((className) => classes.add(className));
    match = classPattern.exec(htmlSource);
  }

  return classes;
}

function collectHtmlDataAttributes(htmlSource) {
  const dataAttributes = new Set();
  const dataAttributePattern = /\sdata-([A-Za-z0-9_-]+)(?=[=\s>])/g;

  let match = dataAttributePattern.exec(htmlSource);
  while (match) {
    dataAttributes.add(match[1]);
    match = dataAttributePattern.exec(htmlSource);
  }

  return dataAttributes;
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

function collectDocumentSimpleSelectors(scriptSource) {
  const classes = new Set();
  const dataAttributes = new Set();
  const selectorPattern = /\bdocument\.querySelector(?:All)?\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

  let match = selectorPattern.exec(scriptSource);
  while (match) {
    const selector = match[1].trim();

    if (/^\.[A-Za-z0-9_-]+$/.test(selector)) {
      classes.add(selector.slice(1));
    }

    const dataAttributeMatch = selector.match(
      /^\[data-([A-Za-z0-9_-]+)(?:[~|^$*]?=(?:"[^"]*"|'[^']*'))?\]$/
    );
    if (dataAttributeMatch) {
      dataAttributes.add(dataAttributeMatch[1]);
    }

    match = selectorPattern.exec(scriptSource);
  }

  return { classes, dataAttributes };
}

function collectLocalModuleImports(scriptSource) {
  const imports = new Set();
  const importPattern = /\bimport\s+(?:[^"'`]*?\s+from\s+)?["']\.\/([^"']+)["']/g;

  let match = importPattern.exec(scriptSource);
  while (match) {
    imports.add(match[1]);
    match = importPattern.exec(scriptSource);
  }

  return imports;
}

function collectBuildEntries(buildSource) {
  const entries = new Set();
  const entriesBlockMatch = buildSource.match(/const entries = \[([\s\S]*?)\];/);

  if (!entriesBlockMatch) {
    return entries;
  }

  const entryPattern = /["']([^"']+)["']/g;
  let match = entryPattern.exec(entriesBlockMatch[1]);
  while (match) {
    entries.add(match[1]);
    match = entryPattern.exec(entriesBlockMatch[1]);
  }

  return entries;
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

async function getScriptSimpleSelectors(scriptPath) {
  if (!scriptSimpleSelectorCache.has(scriptPath)) {
    const source = await getScriptSource(scriptPath);
    scriptSimpleSelectorCache.set(scriptPath, collectDocumentSimpleSelectors(source));
  }
  return scriptSimpleSelectorCache.get(scriptPath);
}

async function getScriptLocalImports(scriptPath) {
  if (!scriptLocalImportCache.has(scriptPath)) {
    const source = await getScriptSource(scriptPath);
    scriptLocalImportCache.set(scriptPath, collectLocalModuleImports(source));
  }
  return scriptLocalImportCache.get(scriptPath);
}

async function getBuildEntries() {
  if (!buildEntriesCache) {
    const buildSource = await readProjectFile("build-static.mjs");
    buildEntriesCache = collectBuildEntries(buildSource);
  }
  return buildEntriesCache;
}

async function run() {
  const failures = [];
  let checks = 0;
  const buildEntries = await getBuildEntries();
  const validatedFileChecks = new Set();
  const validatedBuildChecks = new Set();

  for (const suite of pageSuites) {
    const htmlSource = await readProjectFile(suite.html);
    const htmlIds = collectHtmlIds(htmlSource);
    const htmlClasses = collectHtmlClasses(htmlSource);
    const htmlDataAttributes = collectHtmlDataAttributes(htmlSource);
    const importedScripts = collectLocalScriptImports(htmlSource);

    checks += 1;
    if (!htmlSource.includes('href="./styles.css"')) {
      failures.push(`[${suite.name}] feuille de style principale manquante: ./styles.css`);
    }

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

      if (!validatedBuildChecks.has(expectedScript)) {
        validatedBuildChecks.add(expectedScript);
        checks += 1;
        if (!buildEntries.has(expectedScript)) {
          failures.push(
            `[${suite.name}] ${expectedScript} est requis mais absent de la liste entries de build-static.mjs`
          );
        }
      }

      const localImports = await getScriptLocalImports(expectedScript);
      for (const importedFile of localImports) {
        if (!validatedFileChecks.has(importedFile)) {
          validatedFileChecks.add(importedFile);
          checks += 1;
          try {
            await assertFileExists(importedFile);
          } catch {
            failures.push(
              `[${suite.name}] import local introuvable "${importedFile}" référencé depuis ${expectedScript}`
            );
          }
        }

        if (!validatedBuildChecks.has(importedFile)) {
          validatedBuildChecks.add(importedFile);
          checks += 1;
          if (!buildEntries.has(importedFile)) {
            failures.push(
              `[${suite.name}] module importé "${importedFile}" absent de la liste entries de build-static.mjs`
            );
          }
        }
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

      const { classes: requiredClasses, dataAttributes: requiredDataAttributes } =
        await getScriptSimpleSelectors(expectedScript);

      for (const requiredClass of requiredClasses) {
        checks += 1;
        if (!htmlClasses.has(requiredClass)) {
          failures.push(
            `[${suite.name}] la classe ".${requiredClass}" est requise par ${expectedScript} mais absente de ${suite.html}`
          );
        }
      }

      for (const requiredDataAttribute of requiredDataAttributes) {
        checks += 1;
        if (!htmlDataAttributes.has(requiredDataAttribute)) {
          failures.push(
            `[${suite.name}] l'attribut "data-${requiredDataAttribute}" est requis par ${expectedScript} mais absent de ${suite.html}`
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
