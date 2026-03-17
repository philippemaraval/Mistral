import "./pwa.js";
import {
  authors,
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
  buildAuthorUrl,
  buildOptimizedImageUrl,
  buildOptimizedImageSrcSet,
  getAuthorById,
  getArticlesByAuthor,
  getSeriesById,
} from "./articles-data.js";
import { trackEvent } from "./analytics.js";

const title = document.querySelector("#author-name");
const role = document.querySelector("#author-role");
const bio = document.querySelector("#author-bio");
const stats = document.querySelector("#author-stats");
const avatar = document.querySelector("#author-avatar");
const breadcrumbCurrent = document.querySelector("#author-breadcrumb-current");
const topics = document.querySelector("#author-topics");
const grid = document.querySelector("#author-grid");
const emptyState = document.querySelector("#author-empty");
const template = document.querySelector("#article-card-template");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const backToTopButton = document.querySelector("#back-to-top");

const searchParams = new URLSearchParams(window.location.search);
const requestedId = searchParams.get("id") ?? "";
const fallbackAuthor = authors.find((entry) => getArticlesByAuthor(entry.id).length > 0) ?? authors[0];
const author = getAuthorById(requestedId) ?? fallbackAuthor ?? null;
const authoredArticles = author ? getArticlesByAuthor(author.id) : [];

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

function renderSeriesLine(container, article) {
  if (!container) return;
  const seriesEntry = article.series ? getSeriesById(article.series) : null;

  if (!seriesEntry) {
    container.hidden = true;
    return;
  }

  container.textContent = `Dossier: ${seriesEntry.title}`;
  container.hidden = false;
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
  renderSeriesLine(seriesLine, article);

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
  const topicSummary = buildTopicSummary(authoredArticles);
  if (topicSummary.length === 0) {
    topics.hidden = true;
    return;
  }

  topics.hidden = false;
  topics.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = "Rubriques suivies";

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

if (!author || !title || !role || !bio || !stats || !avatar) {
  document.title = "Auteur introuvable | Mistral";
} else {
  const publicationCount = authoredArticles.length;
  const latestArticle = authoredArticles[0] ?? null;
  const pageUrl = new URL(buildAuthorUrl(author.id), window.location.href).toString();
  const description =
    publicationCount > 0
      ? `${author.bio} ${publicationCount} article(s) publié(s) sur Mistral.`
      : `${author.bio} Aucun article publié pour le moment.`;
  const previewImage = buildOptimizedImageUrl(author.avatar || "./social-preview.svg", 1200, 78);

  document.title = `${author.name} | Mistral`;
  title.textContent = author.name;
  role.textContent = author.role;
  bio.textContent = author.bio;
  stats.textContent =
    publicationCount > 0 && latestArticle
      ? `${publicationCount} article(s) publié(s) · Dernière publication le ${formatDateFr(
          latestArticle.updatedDate || latestArticle.date
        )}`
      : "Aucun article publié pour le moment.";
  avatar.src = buildOptimizedImageUrl(author.avatar || "./logo_mistral.png", 440, 72);
  avatar.srcset = buildOptimizedImageSrcSet(author.avatar || "./logo_mistral.png", [220, 320, 440], 72);
  avatar.sizes = "220px";
  avatar.alt = `Portrait de ${author.name}`;
  markImageLoading(avatar, { eager: true });
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = author.name;

  trackEvent("author_view", {
    authorId: author.id,
    articleCount: publicationCount,
  });

  setMetaTag('meta[name="description"]', description);
  setMetaTag('meta[property="og:title"]', `${author.name} | Mistral`);
  setMetaTag('meta[property="og:description"]', description);
  setMetaTag('meta[property="og:image"]', previewImage);
  setMetaTag('meta[property="og:url"]', pageUrl);
  setMetaTag('meta[name="twitter:title"]', `${author.name} | Mistral`);
  setMetaTag('meta[name="twitter:description"]', description);
  setMetaTag('meta[name="twitter:image"]', previewImage);
  const canonical = document.querySelector("#canonical-link");
  if (canonical) canonical.setAttribute("href", pageUrl);

  renderTopics();

  if (grid && template && publicationCount > 0) {
    grid.innerHTML = "";
    authoredArticles.forEach((entry) => {
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
    context: `author:${author?.id || "unknown"}`,
  });
});
