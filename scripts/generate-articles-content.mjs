import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const siteConfigPath = path.join(projectRoot, "content", "site.json");
const authorsDir = path.join(projectRoot, "content", "authors");
const seriesDir = path.join(projectRoot, "content", "series");
const documentsDir = path.join(projectRoot, "content", "documents");
const articlesDir = path.join(projectRoot, "content", "articles");
const outputPath = path.join(projectRoot, "articles-content.js");

const ALLOWED_TAGS = new Set([
  "Politique",
  "Économie",
  "Urbanisme",
  "Mobilités",
  "Culture",
  "Quartiers",
]);

const ALLOWED_TEMPLATES = new Set(["enquete", "breve", "portrait", "decryptage"]);
const ALLOWED_STATUS = new Set(["idea", "draft", "review", "legal", "published", "archived"]);
const ALLOWED_DATA_HIGHLIGHT_TYPES = new Set(["bar", "timeline", "comparison"]);

function parseJsonFile(raw, sourcePath) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON invalide: ${sourcePath}\n${error.message}`);
  }
}

function requireNonEmptyString(value, fieldPath, sourcePath) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Champ requis invalide (${fieldPath}) dans ${sourcePath}`);
  }
}

function requireArray(value, fieldPath, sourcePath) {
  if (!Array.isArray(value)) {
    throw new Error(`Champ requis invalide (${fieldPath}) dans ${sourcePath}: attendu un tableau`);
  }
}

function requireValueInSet(value, fieldPath, sourcePath, allowedValues) {
  if (!allowedValues.has(value)) {
    throw new Error(
      `Valeur invalide (${fieldPath}) dans ${sourcePath}: ${value}. Valeurs attendues: ${[
        ...allowedValues,
      ].join(", ")}`
    );
  }
}

function requireStringLength(value, fieldPath, sourcePath, min, max) {
  requireNonEmptyString(value, fieldPath, sourcePath);
  const length = value.trim().length;
  if (length < min || length > max) {
    throw new Error(
      `Longueur invalide (${fieldPath}) dans ${sourcePath}: ${length}. Attendu entre ${min} et ${max}.`
    );
  }
}

function parseDateOrThrow(value, fieldPath, sourcePath) {
  requireNonEmptyString(value, fieldPath, sourcePath);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Date invalide (${fieldPath}) dans ${sourcePath}: ${value}`);
  }
  return parsed;
}

function normalizeDocumentFile(file) {
  const raw = String(file ?? "").trim();
  return raw
    .replace(/^\.\//, "")
    .replace(/^\//, "")
    .replace(/^documents\//, "")
    .trim();
}

function normalizeOptionalUrl(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sortByDateDesc(a, b) {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

async function loadJsonCollection(directory, label) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "fr"));

  if (files.length === 0) {
    throw new Error(`Aucun fichier trouvé dans ${directory} pour la collection ${label}`);
  }

  const records = [];
  for (const filename of files) {
    const filePath = path.join(directory, filename);
    const raw = await readFile(filePath, "utf8");
    const payload = parseJsonFile(raw, filePath);
    records.push({ payload, sourcePath: filePath });
  }

  return records;
}

function validateAuthors(records) {
  const byId = new Map();
  const byName = new Map();

  records.forEach(({ payload, sourcePath }) => {
    requireNonEmptyString(payload.id, "id", sourcePath);
    requireStringLength(payload.name, "name", sourcePath, 2, 80);
    requireNonEmptyString(payload.role, "role", sourcePath);
    requireNonEmptyString(payload.bio, "bio", sourcePath);

    if (byId.has(payload.id)) {
      throw new Error(`ID auteur dupliqué (${payload.id}) dans ${sourcePath}`);
    }

    if (byName.has(payload.name)) {
      throw new Error(`Nom auteur dupliqué (${payload.name}) dans ${sourcePath}`);
    }

    byId.set(payload.id, payload);
    byName.set(payload.name, payload);
  });

  return { byId, byName, ordered: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "fr")) };
}

function validateSeries(records) {
  const byId = new Map();

  records.forEach(({ payload, sourcePath }) => {
    requireNonEmptyString(payload.id, "id", sourcePath);
    requireNonEmptyString(payload.title, "title", sourcePath);
    requireNonEmptyString(payload.description, "description", sourcePath);

    if (byId.has(payload.id)) {
      throw new Error(`ID série dupliqué (${payload.id}) dans ${sourcePath}`);
    }

    byId.set(payload.id, payload);
  });

  return { byId, ordered: [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, "fr")) };
}

function validateDocuments(records) {
  const byId = new Map();
  const byFile = new Map();

  records.forEach(({ payload, sourcePath }) => {
    requireNonEmptyString(payload.id, "id", sourcePath);
    requireNonEmptyString(payload.title, "title", sourcePath);
    requireNonEmptyString(payload.file, "file", sourcePath);
    requireNonEmptyString(payload.type, "type", sourcePath);
    parseDateOrThrow(payload.date, "date", sourcePath);

    const normalizedFile = normalizeDocumentFile(payload.file);
    if (!normalizedFile) {
      throw new Error(`Chemin document invalide (file) dans ${sourcePath}`);
    }

    if (byId.has(payload.id)) {
      throw new Error(`ID document dupliqué (${payload.id}) dans ${sourcePath}`);
    }

    if (byFile.has(normalizedFile)) {
      throw new Error(`Fichier document dupliqué (${normalizedFile}) dans ${sourcePath}`);
    }

    const normalized = {
      ...payload,
      file: normalizedFile,
      sourceUrl: normalizeOptionalUrl(payload.sourceUrl),
    };

    if (normalized.sourceUrl && !isValidHttpUrl(normalized.sourceUrl)) {
      throw new Error(`URL document invalide (sourceUrl) dans ${sourcePath}: ${normalized.sourceUrl}`);
    }

    byId.set(normalized.id, normalized);
    byFile.set(normalized.file, normalized);
  });

  return {
    byId,
    byFile,
    ordered: [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, "fr")),
  };
}

function validateSiteConfig(siteConfig, featuredCandidates) {
  requireNonEmptyString(siteConfig.featuredArticleId, "featuredArticleId", siteConfigPath);
  if (!featuredCandidates.has(siteConfig.featuredArticleId)) {
    throw new Error(
      `featuredArticleId (${siteConfig.featuredArticleId}) ne correspond à aucun article publié actuel`
    );
  }
}

function normalizeSourceLinks(sourceLinks, sourcePath) {
  if (sourceLinks === undefined) return [];
  requireArray(sourceLinks, "sourceLinks", sourcePath);

  return sourceLinks.map((entry, index) => {
    const candidate =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object"
          ? entry.url
          : "";
    const url = String(candidate ?? "").trim();
    if (!url) {
      throw new Error(`sourceLinks[${index}] vide dans ${sourcePath}`);
    }
    if (!isValidHttpUrl(url)) {
      throw new Error(`sourceLinks[${index}] invalide dans ${sourcePath}: ${url}`);
    }
    return url;
  });
}

function normalizeRedirectFrom(redirectFrom, currentArticleId, sourcePath) {
  if (redirectFrom === undefined) return [];
  requireArray(redirectFrom, "redirectFrom", sourcePath);

  const normalized = redirectFrom.map((entry, index) => {
    const candidate =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object"
          ? entry.slug
          : "";
    requireNonEmptyString(candidate, `redirectFrom[${index}]`, sourcePath);
    const slug = String(candidate).trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`redirectFrom[${index}] invalide dans ${sourcePath}: ${slug}`);
    }
    return slug;
  });

  return [...new Set(normalized.filter((entry) => entry !== currentArticleId))];
}

function normalizeSocialTitle(value, sourcePath) {
  if (value === undefined || value === null || String(value).trim().length === 0) return undefined;
  requireStringLength(value, "socialTitle", sourcePath, 8, 90);
  return String(value).trim();
}

function normalizeDataHighlights(dataHighlights, sourcePath) {
  if (dataHighlights === undefined) return [];
  requireArray(dataHighlights, "dataHighlights", sourcePath);

  return dataHighlights.map((block, blockIndex) => {
    requireStringLength(block.title, `dataHighlights[${blockIndex}].title`, sourcePath, 3, 90);
    requireNonEmptyString(block.type, `dataHighlights[${blockIndex}].type`, sourcePath);
    requireValueInSet(
      block.type,
      `dataHighlights[${blockIndex}].type`,
      sourcePath,
      ALLOWED_DATA_HIGHLIGHT_TYPES
    );
    requireArray(block.items, `dataHighlights[${blockIndex}].items`, sourcePath);

    if (block.items.length < 1 || block.items.length > 12) {
      throw new Error(
        `Nombre d'éléments invalide (dataHighlights[${blockIndex}].items) dans ${sourcePath}: attendu entre 1 et 12`
      );
    }

    const normalizedItems = block.items.map((item, itemIndex) => {
      requireStringLength(
        item.label,
        `dataHighlights[${blockIndex}].items[${itemIndex}].label`,
        sourcePath,
        2,
        90
      );

      if (block.type === "timeline") {
        requireStringLength(
          item.date,
          `dataHighlights[${blockIndex}].items[${itemIndex}].date`,
          sourcePath,
          4,
          40
        );
        if (item.detail !== undefined && String(item.detail).trim().length > 0) {
          requireStringLength(
            item.detail,
            `dataHighlights[${blockIndex}].items[${itemIndex}].detail`,
            sourcePath,
            6,
            280
          );
        }
        return {
          label: String(item.label).trim(),
          date: String(item.date).trim(),
          detail:
            item.detail !== undefined && String(item.detail).trim().length > 0
              ? String(item.detail).trim()
              : undefined,
        };
      }

      if (!Number.isFinite(item.value)) {
        throw new Error(
          `Valeur numérique invalide (dataHighlights[${blockIndex}].items[${itemIndex}].value) dans ${sourcePath}`
        );
      }
      if (item.valueSecondary !== undefined && item.valueSecondary !== null && !Number.isFinite(item.valueSecondary)) {
        throw new Error(
          `Valeur numérique invalide (dataHighlights[${blockIndex}].items[${itemIndex}].valueSecondary) dans ${sourcePath}`
        );
      }
      if (item.detail !== undefined && String(item.detail).trim().length > 0) {
        requireStringLength(
          item.detail,
          `dataHighlights[${blockIndex}].items[${itemIndex}].detail`,
          sourcePath,
          6,
          280
        );
      }

      return {
        label: String(item.label).trim(),
        value: Number(item.value),
        valueSecondary:
          item.valueSecondary !== undefined && item.valueSecondary !== null
            ? Number(item.valueSecondary)
            : undefined,
        detail:
          item.detail !== undefined && String(item.detail).trim().length > 0
            ? String(item.detail).trim()
            : undefined,
      };
    });

    return {
      title: String(block.title).trim(),
      type: block.type,
      unit: block.unit !== undefined && String(block.unit).trim().length > 0 ? String(block.unit).trim() : undefined,
      note: block.note !== undefined && String(block.note).trim().length > 0 ? String(block.note).trim() : undefined,
      items: normalizedItems,
    };
  });
}

function normalizeRelatedArticles(relatedArticles, currentArticleId, sourcePath) {
  if (relatedArticles === undefined) return [];
  requireArray(relatedArticles, "relatedArticles", sourcePath);

  const sanitized = relatedArticles
    .map((entry, index) => {
      const candidate =
        typeof entry === "string"
          ? entry
          : entry && typeof entry === "object"
            ? entry.article
            : "";
      requireNonEmptyString(candidate, `relatedArticles[${index}]`, sourcePath);
      return candidate;
    })
    .filter((entry) => entry !== currentArticleId);

  return [...new Set(sanitized)];
}

function normalizeSections(sections, sourcePath) {
  if (sections === undefined) return [];
  requireArray(sections, "sections", sourcePath);

  return sections.map((section, index) => {
    requireStringLength(section.title, `sections[${index}].title`, sourcePath, 3, 90);
    requireArray(section.paragraphs, `sections[${index}].paragraphs`, sourcePath);

    const normalizedParagraphs = section.paragraphs.map((paragraph, paragraphIndex) => {
      const candidate =
        typeof paragraph === "string"
          ? paragraph
          : paragraph && typeof paragraph === "object"
            ? paragraph.paragraph
            : "";
      requireStringLength(
        candidate,
        `sections[${index}].paragraphs[${paragraphIndex}]`,
        sourcePath,
        20,
        2400
      );
      return candidate;
    });

    return {
      ...section,
      paragraphs: normalizedParagraphs,
    };
  });
}

function normalizeSources(sources, documentsByFile, sourcePath) {
  if (sources === undefined) return [];
  requireArray(sources, "sources", sourcePath);

  return sources.map((source, index) => {
    requireNonEmptyString(source.label, `sources[${index}].label`, sourcePath);
    const rawFile =
      typeof source.file === "string"
        ? source.file
        : source.file && typeof source.file === "object"
          ? source.file.file
          : source.file;
    requireNonEmptyString(rawFile, `sources[${index}].file`, sourcePath);

    const normalizedFile = normalizeDocumentFile(rawFile);
    const doc = documentsByFile.get(normalizedFile);
    if (!doc) {
      throw new Error(
        `sources[${index}].file (${normalizedFile}) dans ${sourcePath} ne correspond à aucun document référencé`
      );
    }

    return {
      ...source,
      file: normalizedFile,
      type: source.type || doc.type,
      date: source.date || doc.date,
    };
  });
}

function normalizeCorrections(corrections, sourcePath) {
  if (corrections === undefined) return [];
  requireArray(corrections, "corrections", sourcePath);

  corrections.forEach((correction, index) => {
    parseDateOrThrow(correction.date, `corrections[${index}].date`, sourcePath);
    requireStringLength(correction.detail, `corrections[${index}].detail`, sourcePath, 10, 500);
  });

  return corrections;
}

function validateAndPrepareArticle(
  article,
  sourcePath,
  { authorsById, seriesById, documentsByFile, allArticleIds, now }
) {
  requireNonEmptyString(article.id, "id", sourcePath);
  requireStringLength(article.title, "title", sourcePath, 12, 120);
  requireStringLength(article.excerpt, "excerpt", sourcePath, 60, 600);
  requireStringLength(article.caption, "caption", sourcePath, 8, 220);
  requireNonEmptyString(article.image, "image", sourcePath);
  requireStringLength(article.heroImageAlt, "heroImageAlt", sourcePath, 8, 200);
  requireStringLength(article.imageCredit, "imageCredit", sourcePath, 3, 120);
  requireNonEmptyString(article.location, "location", sourcePath);

  parseDateOrThrow(article.date, "date", sourcePath);
  parseDateOrThrow(article.updatedDate, "updatedDate", sourcePath);

  if (new Date(article.updatedDate).getTime() < new Date(article.date).getTime()) {
    throw new Error(`updatedDate doit être >= date dans ${sourcePath}`);
  }

  const authorId =
    typeof article.author === "string"
      ? article.author
      : article.author && typeof article.author === "object"
        ? article.author.id
        : "";
  requireNonEmptyString(authorId, "author", sourcePath);
  const authorRecord = authorsById.get(authorId);
  if (!authorRecord) {
    throw new Error(`Auteur introuvable (${authorId}) dans ${sourcePath}`);
  }

  const factCheckedById =
    typeof article.factCheckedBy === "string"
      ? article.factCheckedBy
      : article.factCheckedBy && typeof article.factCheckedBy === "object"
        ? article.factCheckedBy.id
        : article.factCheckedBy;

  if (factCheckedById !== undefined && factCheckedById !== "") {
    requireNonEmptyString(factCheckedById, "factCheckedBy", sourcePath);
    if (!authorsById.has(factCheckedById)) {
      throw new Error(`factCheckedBy introuvable (${factCheckedById}) dans ${sourcePath}`);
    }
  }

  const legalReviewedById =
    typeof article.legalReviewedBy === "string"
      ? article.legalReviewedBy
      : article.legalReviewedBy && typeof article.legalReviewedBy === "object"
        ? article.legalReviewedBy.id
        : article.legalReviewedBy;

  if (legalReviewedById !== undefined && legalReviewedById !== "") {
    requireNonEmptyString(legalReviewedById, "legalReviewedBy", sourcePath);
    if (!authorsById.has(legalReviewedById)) {
      throw new Error(`legalReviewedBy introuvable (${legalReviewedById}) dans ${sourcePath}`);
    }
  }

  requireNonEmptyString(article.editorialTemplate, "editorialTemplate", sourcePath);
  requireValueInSet(article.editorialTemplate, "editorialTemplate", sourcePath, ALLOWED_TEMPLATES);

  requireNonEmptyString(article.status, "status", sourcePath);
  requireValueInSet(article.status, "status", sourcePath, ALLOWED_STATUS);

  if (!Number.isFinite(article.readTimeMinutes) || article.readTimeMinutes < 2 || article.readTimeMinutes > 45) {
    throw new Error(`Champ requis invalide (readTimeMinutes) dans ${sourcePath}`);
  }

  requireArray(article.tags, "tags", sourcePath);
  const normalizedTags = article.tags.map((entry) =>
    typeof entry === "string" ? entry : entry && typeof entry === "object" ? entry.tag : ""
  );

  if (normalizedTags.length < 1 || normalizedTags.length > 4) {
    throw new Error(`Nombre de tags invalide dans ${sourcePath}: attendu entre 1 et 4`);
  }

  normalizedTags.forEach((tag, index) => {
    requireNonEmptyString(tag, `tags[${index}]`, sourcePath);
    if (!ALLOWED_TAGS.has(tag)) {
      throw new Error(`Tag non autorisé (${tag}) dans ${sourcePath}`);
    }
  });

  const seriesId =
    typeof article.series === "string"
      ? article.series
      : article.series && typeof article.series === "object"
        ? article.series.id
        : article.series;

  if (seriesId !== undefined && seriesId !== "") {
    requireNonEmptyString(seriesId, "series", sourcePath);
    if (!seriesById.has(seriesId)) {
      throw new Error(`Série introuvable (${seriesId}) dans ${sourcePath}`);
    }
  }

  if (article.canonicalUrl !== undefined && String(article.canonicalUrl).trim().length > 0) {
    if (!isValidHttpUrl(String(article.canonicalUrl).trim())) {
      throw new Error(`canonicalUrl invalide dans ${sourcePath}: ${article.canonicalUrl}`);
    }
  }

  const sections = normalizeSections(article.sections, sourcePath);
  const sources = normalizeSources(article.sources, documentsByFile, sourcePath);
  const corrections = normalizeCorrections(article.corrections, sourcePath);
  const sourceLinks = normalizeSourceLinks(article.sourceLinks, sourcePath);
  const relatedArticles = normalizeRelatedArticles(article.relatedArticles, article.id, sourcePath);
  const redirectFrom = normalizeRedirectFrom(article.redirectFrom, article.id, sourcePath);
  const socialTitle = normalizeSocialTitle(article.socialTitle, sourcePath);
  const dataHighlights = normalizeDataHighlights(article.dataHighlights, sourcePath);

  relatedArticles.forEach((relatedId) => {
    if (!allArticleIds.has(relatedId)) {
      throw new Error(`relatedArticles référence un ID inconnu (${relatedId}) dans ${sourcePath}`);
    }
  });

  const publishAt = article.publishAt ? parseDateOrThrow(article.publishAt, "publishAt", sourcePath) : null;
  const unpublishAt = article.unpublishAt
    ? parseDateOrThrow(article.unpublishAt, "unpublishAt", sourcePath)
    : null;

  if (publishAt && unpublishAt && unpublishAt.getTime() <= publishAt.getTime()) {
    throw new Error(`unpublishAt doit être > publishAt dans ${sourcePath}`);
  }

  const isPublished = article.status === "published";
  const isAfterPublishWindow = !publishAt || now.getTime() >= publishAt.getTime();
  const isBeforeUnpublishWindow = !unpublishAt || now.getTime() < unpublishAt.getTime();
  const isVisibleNow = isPublished && isAfterPublishWindow && isBeforeUnpublishWindow;

  return {
    ...article,
    author: authorRecord.name,
    authorId: authorRecord.id,
    factCheckedBy:
      factCheckedById && authorsById.has(factCheckedById)
        ? authorsById.get(factCheckedById).name
        : undefined,
    factCheckedById: factCheckedById || undefined,
    legalReviewedBy:
      legalReviewedById && authorsById.has(legalReviewedById)
        ? authorsById.get(legalReviewedById).name
        : undefined,
    legalReviewedById: legalReviewedById || undefined,
    series: seriesId || undefined,
    tags: normalizedTags,
    sections,
    sources,
    corrections,
    sourceLinks,
    relatedArticles,
    redirectFrom,
    socialTitle,
    dataHighlights,
    isVisibleNow,
  };
}

async function loadSiteConfig() {
  const raw = await readFile(siteConfigPath, "utf8");
  return parseJsonFile(raw, siteConfigPath);
}

function toModuleLiteral(value) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const now = new Date();

  const [siteConfig, authorRecords, seriesRecords, documentRecords, articleRecords] = await Promise.all([
    loadSiteConfig(),
    loadJsonCollection(authorsDir, "authors"),
    loadJsonCollection(seriesDir, "series"),
    loadJsonCollection(documentsDir, "documents"),
    loadJsonCollection(articlesDir, "articles"),
  ]);

  const authors = validateAuthors(authorRecords);
  const series = validateSeries(seriesRecords);
  const documents = validateDocuments(documentRecords);

  const allArticleIds = new Set();
  articleRecords.forEach(({ payload, sourcePath }) => {
    requireNonEmptyString(payload.id, "id", sourcePath);
    if (allArticleIds.has(payload.id)) {
      throw new Error(`ID d'article dupliqué (${payload.id}) dans ${sourcePath}`);
    }
    allArticleIds.add(payload.id);
  });

  const normalizedArticles = articleRecords.map(({ payload, sourcePath }) =>
    validateAndPrepareArticle(payload, sourcePath, {
      authorsById: authors.byId,
      seriesById: series.byId,
      documentsByFile: documents.byFile,
      allArticleIds,
      now,
    })
  );

  const redirectAliasOwners = new Map();
  normalizedArticles.forEach((article) => {
    const aliases = [article.id, ...(article.redirectFrom ?? [])];
    aliases.forEach((alias) => {
      const existingOwner = redirectAliasOwners.get(alias);
      if (existingOwner && existingOwner !== article.id) {
        throw new Error(
          `Alias de redirection en conflit (${alias}) entre les articles ${existingOwner} et ${article.id}`
        );
      }
      redirectAliasOwners.set(alias, article.id);
    });
  });

  const visibleArticles = normalizedArticles
    .filter((article) => article.isVisibleNow)
    .map(({ isVisibleNow, ...article }) => article)
    .sort(sortByDateDesc);

  validateSiteConfig(siteConfig, new Set(visibleArticles.map((entry) => entry.id)));

  const output = `// This file is auto-generated by scripts/generate-articles-content.mjs.\n// Do not edit manually.\n\nexport const featuredArticleId = ${toModuleLiteral(siteConfig.featuredArticleId)};\n\nexport const authors = ${toModuleLiteral(authors.ordered)};\n\nexport const series = ${toModuleLiteral(series.ordered)};\n\nexport const documents = ${toModuleLiteral(documents.ordered)};\n\nexport const articles = ${toModuleLiteral(visibleArticles)};\n`;

  await writeFile(outputPath, output, "utf8");
  console.log(`Generated ${path.basename(outputPath)} with ${visibleArticles.length} visible article(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
