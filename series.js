import "./pwa.js";
import {
  series,
  formatDateFr,
  buildArticleUrl,
  buildCategoryUrl,
  buildSeriesUrl,
  buildOptimizedImageUrl,
  buildOptimizedImageSrcSet,
  getSeriesById,
  getArticlesBySeries,
} from "./articles-data.js";
import { trackEvent } from "./analytics.js";

const title = document.querySelector("#series-title");
const description = document.querySelector("#series-description");
const stats = document.querySelector("#series-stats");
const cover = document.querySelector("#series-cover");
const breadcrumbCurrent = document.querySelector("#series-breadcrumb-current");
const topics = document.querySelector("#series-topics");
const grid = document.querySelector("#series-grid");
const emptyState = document.querySelector("#series-empty");
const template = document.querySelector("#article-card-template");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const backToTopButton = document.querySelector("#back-to-top");

const searchParams = new URLSearchParams(window.location.search);
const requestedId = searchParams.get("id") ?? "";
const fallbackSeries = series.find((entry) => getArticlesBySeries(entry.id).length > 0) ?? series[0];
const currentSeries = getSeriesById(requestedId) ?? fallbackSeries ?? null;
const seriesArticles = currentSeries ? getArticlesBySeries(currentSeries.id) : [];

function formatReadingTime(minutes) {
  return `${minutes} min de lecture`;
}

function markImageLoading(image, options = {}) {
  if (!image) return;
  const { eager = false } = options;
  image.loading = eager ? "eager" : "lazy";
  image.decoding = "async";
  image.fetchPriority = eager ? "high" : "low";
  image.dataset.imgState = "loading";

  if (image.complete && image.naturalWidth > 0) {
    image.dataset.imgState = "loaded";
    return;
  }

  image.addEventListener(
    "load",
    () => {
      image.dataset.imgState = "loaded";
    },
    { once: true }
  );
  image.addEventListener(
    "error",
    () => {
      image.dataset.imgState = "error";
    },
    { once: true }
  );
}

function setMetaTag(selector, content) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.setAttribute("content", content);
}

function formatPublishedUpdated(article) {
  const published = `Publié le ${formatDateFr(article.date)}`;
  if (!article.updatedDate || article.updatedDate === article.date) return published;
  return `${published} · Mis à jour le ${formatDateFr(article.updatedDate)}`;
}

function renderCardByline(container, article) {
  if (!container) return;
  container.textContent = `Par ${article.author} · ${formatReadingTime(article.readTimeMinutes)}`;
}

function buildTags(tagsToRender, parent) {
  tagsToRender.forEach((tag) => {
    const link = document.createElement("a");
    link.href = buildCategoryUrl(tag);
    link.textContent = `#${tag}`;
    link.setAttribute("aria-label", `Voir la catégorie ${tag}`);
    parent.appendChild(link);
  });
}

function buildCard(article) {
  const fragment = template.content.cloneNode(true);
  const image = fragment.querySelector(".article-card__image");
  const link = fragment.querySelector(".article-card__link");
  const tags = fragment.querySelector(".article-card__tags");
  const byline = fragment.querySelector(".article-card__byline");
  const date = fragment.querySelector(".article-card__date");
  const seriesLine = fragment.querySelector(".article-card__series");

  fragment.querySelector(".article-card__title").textContent = article.title;
  fragment.querySelector(".article-card__excerpt").textContent = article.excerpt;
  fragment.querySelector(".article-card__caption").textContent = article.caption;
  renderCardByline(byline, article);
  date.textContent = formatPublishedUpdated(article);
  if (seriesLine) seriesLine.hidden = true;

  image.src = buildOptimizedImageUrl(article.image, 640, 72);
  image.srcset = buildOptimizedImageSrcSet(article.image, [320, 480, 640, 800, 960], 72);
  image.sizes = "(max-width: 767px) 100vw, (max-width: 980px) 50vw, 33vw";
  image.alt = article.heroImageAlt || article.title;
  markImageLoading(image);
  link.href = buildArticleUrl(article.id);
  link.dataset.articleId = article.id;
  link.setAttribute("aria-label", `Lire l'article : ${article.title}`);
  buildTags(article.tags, tags);

  return fragment;
}

function buildTopicSummary(sourceArticles) {
  const counts = new Map();
  sourceArticles.forEach((article) => {
    article.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return [...counts.entries()].sort((entryA, entryB) => {
    if (entryB[1] !== entryA[1]) return entryB[1] - entryA[1];
    return entryA[0].localeCompare(entryB[0], "fr");
  });
}

function renderTopics() {
  if (!topics) return;
  const topicSummary = buildTopicSummary(seriesArticles);
  if (topicSummary.length === 0) {
    topics.hidden = true;
    return;
  }

  topics.hidden = false;
  topics.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = "Rubriques du dossier";

  const list = document.createElement("p");
  list.className = "article-tags";
  topicSummary.forEach(([tag, count]) => {
    const link = document.createElement("a");
    link.className = "author-topics__link";
    link.href = buildCategoryUrl(tag);
    link.setAttribute("aria-label", `Voir la catégorie ${tag}`);
    link.textContent = `#${tag} (${count})`;
    list.appendChild(link);
  });

  topics.append(heading, list);
}

function setupNavigation() {
  navToggle?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      navToggle?.setAttribute("aria-expanded", "false");
    });
  });
}

function updateBackToTopVisibility() {
  if (!backToTopButton) return;
  backToTopButton.classList.toggle("is-visible", window.scrollY > 480);
}

if (!currentSeries || !title || !description || !stats || !cover) {
  document.title = "Dossier introuvable | Mistral";
} else {
  const publicationCount = seriesArticles.length;
  const latestArticle = seriesArticles[0] ?? null;
  const pageUrl = new URL(buildSeriesUrl(currentSeries.id), window.location.href).toString();
  const seoDescription =
    publicationCount > 0
      ? `${currentSeries.description} ${publicationCount} article(s) publiés dans ce dossier.`
      : `${currentSeries.description} Aucun article publié dans ce dossier pour le moment.`;
  const previewImage = buildOptimizedImageUrl(currentSeries.coverImage || "./social-preview.svg", 1200, 78);

  document.title = `${currentSeries.title} | Mistral`;
  title.textContent = currentSeries.title;
  description.textContent = currentSeries.description;
  stats.textContent =
    publicationCount > 0 && latestArticle
      ? `${publicationCount} article(s) · Dernière publication le ${formatDateFr(
          latestArticle.updatedDate || latestArticle.date
        )}`
      : "Aucun article publié dans ce dossier pour le moment.";
  cover.src = buildOptimizedImageUrl(currentSeries.coverImage || "./social-preview.svg", 1280, 74);
  cover.srcset = buildOptimizedImageSrcSet(
    currentSeries.coverImage || "./social-preview.svg",
    [480, 720, 960, 1280, 1600],
    74
  );
  cover.sizes = "(max-width: 980px) 100vw, 720px";
  cover.alt = `Illustration du dossier ${currentSeries.title}`;
  markImageLoading(cover, { eager: true });
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = currentSeries.title;

  trackEvent("series_view", {
    seriesId: currentSeries.id,
    articleCount: publicationCount,
  });

  setMetaTag('meta[name="description"]', seoDescription);
  setMetaTag('meta[property="og:title"]', `${currentSeries.title} | Mistral`);
  setMetaTag('meta[property="og:description"]', seoDescription);
  setMetaTag('meta[property="og:image"]', previewImage);
  setMetaTag('meta[property="og:url"]', pageUrl);
  setMetaTag('meta[name="twitter:title"]', `${currentSeries.title} | Mistral`);
  setMetaTag('meta[name="twitter:description"]', seoDescription);
  setMetaTag('meta[name="twitter:image"]', previewImage);
  const canonical = document.querySelector("#canonical-link");
  if (canonical) canonical.setAttribute("href", pageUrl);

  renderTopics();

  if (grid && template && publicationCount > 0) {
    grid.innerHTML = "";
    seriesArticles.forEach((entry) => {
      grid.appendChild(buildCard(entry));
    });
  } else if (emptyState) {
    emptyState.hidden = false;
  }
}

setupNavigation();
window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();

backToTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

grid?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest(".article-card__link");
  if (!link) return;
  const articleId = link.getAttribute("data-article-id");
  if (!articleId) return;
  trackEvent("article_card_click", {
    articleId,
    context: `series:${currentSeries?.id || "unknown"}`,
  });
});
