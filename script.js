import {
  articles,
  featuredArticleId,
  sortByDateDesc,
  formatDateFr,
  buildArticleUrl,
  buildCategoryUrl,
  buildDocumentUrl,
} from "./articles-data.js";

const grid = document.querySelector("#article-grid");
const template = document.querySelector("#article-card-template");
const indicator = document.querySelector("#loading-indicator");
const sentinel = document.querySelector("#scroll-sentinel");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const searchForm = document.querySelector(".search-bar");
const searchInput = document.querySelector("#site-search");
const searchStatus = document.querySelector("#search-status");
const backToTopButton = document.querySelector("#back-to-top");
const featuredStoryMeta = document.querySelector("#featured-story-meta");
const featuredStorySources = document.querySelector("#featured-story-sources");

const featuredArticle = articles.find((article) => article.id === featuredArticleId) ?? null;

const feedArticles = articles
  .filter((article) => article.id !== featuredArticleId)
  .sort(sortByDateDesc);

const BATCH_SIZE = 6;

let activeArticles = [...feedArticles];
let cursor = 0;
let isLoading = false;
let observer;
let searchDebounce;
let searchTermRaw = "";
let searchTermNormalized = "";
let loadTimeout;

function normalizeSearchValue(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(value) {
  let output = escapeHtml(value);
  if (!searchTermRaw) return output;

  const terms = searchTermRaw.split(/\s+/).filter(Boolean);
  terms.forEach((term) => {
    const pattern = new RegExp(`(${escapeRegExp(term)})`, "gi");
    output = output.replace(pattern, "<mark>$1</mark>");
  });

  return output;
}

function buildTags(tags, parent) {
  tags.forEach((tag) => {
    const link = document.createElement("a");
    link.href = buildCategoryUrl(tag);
    link.textContent = `#${tag}`;
    link.setAttribute("aria-label", `Voir la categorie ${tag}`);
    parent.appendChild(link);
  });
}

function formatReadingTime(minutes) {
  return `${minutes} min de lecture`;
}

function formatCardByline(article) {
  return `Par ${article.author} · ${formatReadingTime(article.readTimeMinutes)}`;
}

function formatPublishedUpdated(article) {
  const published = `Publie le ${formatDateFr(article.date)}`;
  if (!article.updatedDate || article.updatedDate === article.date) return published;
  return `${published} · Mis a jour le ${formatDateFr(article.updatedDate)}`;
}

function renderFeaturedMeta() {
  if (!featuredStoryMeta || !featuredArticle) return;

  featuredStoryMeta.textContent = `${formatCardByline(featuredArticle)} · ${formatPublishedUpdated(featuredArticle)}`;
}

function renderFeaturedSources() {
  if (!featuredStorySources || !featuredArticle) return;
  featuredStorySources.innerHTML = "";

  if (!featuredArticle.sources?.length) {
    featuredStorySources.classList.add("is-empty");
    return;
  }

  featuredArticle.sources.forEach((source) => {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = buildDocumentUrl(source.file);
    link.textContent = `Source: ${source.label}`;
    link.setAttribute("download", "");
    featuredStorySources.appendChild(link);
  });
}

function buildCard(article) {
  const fragment = template.content.cloneNode(true);
  const image = fragment.querySelector(".article-card__image");
  const link = fragment.querySelector(".article-card__link");
  const tags = fragment.querySelector(".article-card__tags");
  const byline = fragment.querySelector(".article-card__byline");
  const date = fragment.querySelector(".article-card__date");
  const title = fragment.querySelector(".article-card__title");
  const excerpt = fragment.querySelector(".article-card__excerpt");
  const caption = fragment.querySelector(".article-card__caption");

  title.innerHTML = highlightText(article.title);
  excerpt.innerHTML = highlightText(article.excerpt);
  caption.innerHTML = highlightText(article.caption);
  byline.textContent = formatCardByline(article);
  date.textContent = formatPublishedUpdated(article);

  image.src = article.image;
  image.alt = article.title;
  link.href = buildArticleUrl(article.id);
  link.setAttribute("aria-label", `Lire l'article : ${article.title}`);
  buildTags(article.tags, tags);

  return fragment;
}

function updateSearchStatus() {
  if (!searchStatus) return;

  if (!searchTermRaw) {
    searchStatus.textContent = "";
    searchStatus.classList.remove("is-empty");
    return;
  }

  if (activeArticles.length === 0) {
    searchStatus.textContent = `Aucun resultat pour "${searchTermRaw}".`;
    searchStatus.classList.add("is-empty");
    return;
  }

  searchStatus.textContent = `${activeArticles.length} resultat(s) pour "${searchTermRaw}".`;
  searchStatus.classList.remove("is-empty");
}

function updateSentinelVisibility() {
  if (!observer || !sentinel) return;

  const hasMore = cursor < activeArticles.length;
  sentinel.classList.toggle("is-hidden", !hasMore);
  if (hasMore) {
    observer.observe(sentinel);
  } else {
    observer.unobserve(sentinel);
  }
}

function renderBatch(size = BATCH_SIZE) {
  const end = Math.min(cursor + size, activeArticles.length);
  for (let i = cursor; i < end; i += 1) {
    const article = activeArticles[i];
    grid.appendChild(buildCard(article));
  }
  cursor = end;
  updateSentinelVisibility();

  if (cursor >= activeArticles.length) {
    showLoading(false);
  }
}

function showLoading(visible) {
  indicator.classList.toggle("is-visible", visible);
  indicator.setAttribute("aria-hidden", String(!visible));
}

function loadMore() {
  if (isLoading || cursor >= activeArticles.length) return;
  isLoading = true;
  showLoading(true);

  loadTimeout = window.setTimeout(() => {
    renderBatch(BATCH_SIZE);
    showLoading(false);
    isLoading = false;
  }, 380);
}

function articleMatchesSearch(article) {
  if (!searchTermNormalized) return true;
  const sourceText = article.sources?.map((source) => source.label).join(" ") ?? "";
  const searchableText = normalizeSearchValue(
    `${article.title} ${article.excerpt} ${article.caption} ${article.tags.join(" ")} ${article.author} ${sourceText}`
  );
  return searchableText.includes(searchTermNormalized);
}

function applySearch(value) {
  window.clearTimeout(loadTimeout);
  searchTermRaw = value.trim();
  searchTermNormalized = normalizeSearchValue(searchTermRaw);
  activeArticles = feedArticles.filter(articleMatchesSearch);
  cursor = 0;
  isLoading = false;
  grid.innerHTML = "";
  showLoading(false);
  renderBatch(BATCH_SIZE);
  updateSearchStatus();
}

function updateBackToTopVisibility() {
  if (!backToTopButton) return;
  backToTopButton.classList.toggle("is-visible", window.scrollY > 480);
}

if (grid && template) {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) loadMore();
      });
    },
    { rootMargin: "420px 0px" }
  );

  applySearch(searchInput?.value ?? "");
}

renderFeaturedMeta();
renderFeaturedSources();

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  window.clearTimeout(searchDebounce);
  applySearch(searchInput?.value ?? "");
});

searchInput?.addEventListener("input", () => {
  window.clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(() => {
    applySearch(searchInput.value);
  }, 260);
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

window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();
