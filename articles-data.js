import { featuredArticleId, articles, authors, series } from "./articles-content.js";

export { featuredArticleId, articles, authors, series };

export const categories = [
  "Politique",
  "Économie",
  "Urbanisme",
  "Mobilités",
  "Culture",
  "Quartiers",
];

export const weatherConfig = {
  Politique: {
    coords: { x: 42, y: 56 },
    latLng: { lat: 43.2963, lng: 5.3699 },
    anchor: "Hôtel de Ville",
    status: "storm",
  },
  Économie: {
    coords: { x: 41, y: 33 },
    latLng: { lat: 43.3153, lng: 5.3665 },
    anchor: "Arenc",
    status: "windy",
  },
  Urbanisme: {
    coords: { x: 55, y: 82 },
    latLng: { lat: 43.2614, lng: 5.3928 },
    anchor: "Sainte-Anne",
    status: "cloudy",
  },
  Mobilités: {
    coords: { x: 56, y: 19 },
    latLng: { lat: 43.339, lng: 5.3802 },
    anchor: "La Delorme",
    status: "rainy",
  },
  Culture: {
    coords: { x: 59, y: 56 },
    latLng: { lat: 43.2899, lng: 5.3889 },
    anchor: "Notre-Dame-du-Mont",
    status: "sunny",
  },
  Quartiers: {
    coords: { x: 68, y: 43 },
    latLng: { lat: 43.3089, lng: 5.4208 },
    anchor: "Montolivet",
    status: "cloudy",
  },
};

export function sortByDateDesc(a, b) {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

export function formatDateFr(isoDate) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function buildCategoryUrl(tag) {
  return `./category.html?tag=${encodeURIComponent(tag)}`;
}

export function buildArticleUrl(id) {
  return `./article.html?id=${encodeURIComponent(id)}`;
}

export function buildAuthorUrl(id) {
  return `./author.html?id=${encodeURIComponent(id)}`;
}

export function buildSeriesUrl(id) {
  return `./series.html?id=${encodeURIComponent(id)}`;
}

export function buildDocumentUrl(file) {
  const raw = String(file ?? "").trim();
  if (!raw) return "./documents/";

  const normalized = raw
    .replace(/^\.?\//, "")
    .replace(/^documents\//, "")
    .replace(/^\/documents\//, "");

  return `./documents/${normalized
    .split("/")
    .filter(Boolean)
    .map((entry) => encodeURIComponent(entry))
    .join("/")}`;
}

export function buildOptimizedImageUrl(source, width = 960, quality = 72) {
  try {
    const url = new URL(source);
    if (!url.hostname.includes("unsplash.com")) return source;
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality));
    return url.toString();
  } catch {
    return source;
  }
}

export function buildOptimizedImageSrcSet(
  source,
  widths = [320, 480, 640, 800, 960, 1200],
  quality = 72
) {
  return widths
    .map((width) => `${buildOptimizedImageUrl(source, width, quality)} ${width}w`)
    .join(", ");
}

export function getArticleById(id) {
  return articles.find((article) => article.id === id) ?? null;
}

export function getAuthorById(id) {
  return authors.find((author) => author.id === id) ?? null;
}

export function getSeriesById(id) {
  return series.find((entry) => entry.id === id) ?? null;
}

export function resolveAuthorId(article) {
  if (!article) return null;
  if (article.authorId && getAuthorById(article.authorId)) return article.authorId;
  const matchByName = authors.find((entry) => entry.name === article.author);
  return matchByName?.id ?? null;
}

export function getArticlesByAuthor(authorId) {
  return articles
    .filter((article) => resolveAuthorId(article) === authorId)
    .sort(sortByDateDesc);
}

export function getArticlesBySeries(seriesId) {
  return articles.filter((article) => article.series === seriesId).sort(sortByDateDesc);
}

export function getPrevNextArticles(articleId) {
  const sorted = [...articles].sort(sortByDateDesc);
  const index = sorted.findIndex((entry) => entry.id === articleId);
  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: sorted[index - 1] ?? null,
    next: sorted[index + 1] ?? null,
  };
}

export function getRelatedArticles(articleId, limit = 3) {
  const currentArticle = getArticleById(articleId);
  if (!currentArticle) return [];

  if (Array.isArray(currentArticle.relatedArticles) && currentArticle.relatedArticles.length > 0) {
    const manualTargets = currentArticle.relatedArticles
      .map((id) => getArticleById(id))
      .filter((entry) => entry && entry.id !== articleId);

    if (manualTargets.length > 0) {
      return manualTargets.slice(0, limit);
    }
  }

  return articles
    .filter((article) => article.id !== articleId)
    .map((article) => ({
      article,
      score: article.tags.filter((tag) => currentArticle.tags.includes(tag)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((entryA, entryB) => {
      if (entryB.score !== entryA.score) return entryB.score - entryA.score;
      return sortByDateDesc(entryA.article, entryB.article);
    })
    .slice(0, limit)
    .map((entry) => entry.article);
}
