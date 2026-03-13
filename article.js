import {
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
  buildDocumentUrl,
  getArticleById,
  getRelatedArticles,
} from "./articles-data.js";

const title = document.querySelector("#article-title");
const excerpt = document.querySelector("#article-excerpt");
const metaPrimary = document.querySelector("#article-meta-primary");
const metaSecondary = document.querySelector("#article-meta-secondary");
const image = document.querySelector("#article-image");
const caption = document.querySelector("#article-caption");
const tags = document.querySelector("#article-tags");
const articleSources = document.querySelector("#article-sources");
const articleSourceLinks = document.querySelector("#article-source-links");
const relatedArticlesSection = document.querySelector("#related-articles");
const relatedArticlesList = document.querySelector("#related-articles-list");
const breadcrumbCategoryLink = document.querySelector("#breadcrumb-category-link");
const breadcrumbCurrent = document.querySelector("#breadcrumb-current");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const readingProgressBar = document.querySelector("#reading-progress-bar");
const backToTopButton = document.querySelector("#back-to-top");
const articlePage = document.querySelector(".article-page");

const searchParams = new URLSearchParams(window.location.search);
const requestedId = searchParams.get("id");
const article = getArticleById(requestedId) ?? getArticleById("om-chiffres-stade");
const primaryTag = article.tags[0];

function formatReadingTime(minutes) {
  return `${minutes} min de lecture`;
}

function formatPublishedUpdated(entry) {
  const published = `Publie le ${formatDateFr(entry.date)}`;
  if (!entry.updatedDate || entry.updatedDate === entry.date) return published;
  return `${published} · Mis a jour le ${formatDateFr(entry.updatedDate)}`;
}

function formatAuthorLine(entry) {
  return `Par ${entry.author} · ${formatReadingTime(entry.readTimeMinutes)}`;
}

function setupActiveCategoryNav() {
  nav?.querySelectorAll("a").forEach((link) => {
    const linkUrl = new URL(link.href, window.location.origin);
    const linkTag = linkUrl.searchParams.get("tag");
    link.classList.toggle("is-active", linkTag === primaryTag);
  });
}

function buildRelatedArticleCard(relatedArticle) {
  const link = document.createElement("a");
  link.className = "related-article";
  link.href = buildArticleUrl(relatedArticle.id);
  link.setAttribute("aria-label", `Lire l'article lie : ${relatedArticle.title}`);

  const relatedTitle = document.createElement("h3");
  relatedTitle.className = "related-article__title";
  relatedTitle.textContent = relatedArticle.title;

  const relatedMeta = document.createElement("p");
  relatedMeta.className = "related-article__meta";
  relatedMeta.textContent = `${formatAuthorLine(relatedArticle)} · ${formatPublishedUpdated(relatedArticle)}`;

  link.append(relatedTitle, relatedMeta);
  return link;
}

function renderRelatedArticles() {
  if (!relatedArticlesSection || !relatedArticlesList) return;
  const relatedArticles = getRelatedArticles(article.id, 4);

  if (relatedArticles.length === 0) {
    relatedArticlesSection.remove();
    return;
  }

  relatedArticles.forEach((relatedArticle) => {
    relatedArticlesList.appendChild(buildRelatedArticleCard(relatedArticle));
  });
}

function renderSources() {
  if (!articleSources || !articleSourceLinks) return;
  articleSourceLinks.innerHTML = "";

  if (!article.sources?.length) {
    articleSources.remove();
    return;
  }

  article.sources.forEach((source) => {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = buildDocumentUrl(source.file);
    link.textContent = source.label;
    link.setAttribute("download", "");
    articleSourceLinks.appendChild(link);
  });
}

function updateReadingProgress() {
  if (!readingProgressBar || !articlePage) return;
  const articleTop = articlePage.offsetTop;
  const articleHeight = articlePage.offsetHeight;
  const maxScrollable = Math.max(articleHeight - window.innerHeight, 1);
  const progress = Math.min(Math.max((window.scrollY - articleTop) / maxScrollable, 0), 1);
  readingProgressBar.style.transform = `scaleX(${progress})`;
}

function updateBackToTopVisibility() {
  if (!backToTopButton) return;
  backToTopButton.classList.toggle("is-visible", window.scrollY > 480);
}

function syncScrollUI() {
  updateReadingProgress();
  updateBackToTopVisibility();
}

document.title = `${article.title} | Mistral`;
title.textContent = article.title;
excerpt.textContent = article.excerpt;
metaPrimary.textContent = formatAuthorLine(article);
metaSecondary.textContent = formatPublishedUpdated(article);
image.src = article.image;
image.alt = article.title;
caption.textContent = article.caption;
breadcrumbCategoryLink.href = buildCategoryUrl(primaryTag);
breadcrumbCategoryLink.textContent = primaryTag;
breadcrumbCurrent.textContent = article.title;
setupActiveCategoryNav();
renderSources();
renderRelatedArticles();

article.tags.forEach((tag) => {
  const link = document.createElement("a");
  link.href = buildCategoryUrl(tag);
  link.textContent = `#${tag}`;
  link.setAttribute("aria-label", `Voir la categorie ${tag}`);
  tags.appendChild(link);
});

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

backToTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", syncScrollUI, { passive: true });
window.addEventListener("resize", syncScrollUI);
syncScrollUI();

const canonical = document.createElement("link");
canonical.rel = "canonical";
canonical.href = buildArticleUrl(article.id);
document.head.appendChild(canonical);
