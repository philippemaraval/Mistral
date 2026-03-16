import {
  articles,
  featuredArticleId,
  sortByDateDesc,
  formatDateFr,
  buildArticleUrl,
  buildCategoryUrl,
  buildDocumentUrl,
  buildOptimizedImageUrl,
  buildOptimizedImageSrcSet,
} from "./articles-data.js";

const grid = document.querySelector("#article-grid");
const template = document.querySelector("#article-card-template");
const indicator = document.querySelector("#loading-indicator");
const sentinel = document.querySelector("#scroll-sentinel");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const searchForm = document.querySelector(".search-bar");
const searchInput = document.querySelector("#site-search");
const searchSuggestPanel = document.querySelector("#search-suggest");
const searchSuggestList = document.querySelector("#search-suggest-list");
const searchStatus = document.querySelector("#search-status");
const filterTag = document.querySelector("#filter-tag");
const filterAuthor = document.querySelector("#filter-author");
const backToTopButton = document.querySelector("#back-to-top");
const viewButtons = Array.from(document.querySelectorAll("[data-view-option]"));
const featuredStoryMeta = document.querySelector("#featured-story-meta");
const featuredStorySources = document.querySelector("#featured-story-sources");

const featuredArticle = articles.find((article) => article.id === featuredArticleId) ?? null;

const feedArticles = articles
  .filter((article) => article.id !== featuredArticleId)
  .sort(sortByDateDesc);

const BATCH_SIZE = 6;
const VIEW_MODE_STORAGE_KEY = "mistral.viewMode";
const pageSearchParams = new URLSearchParams(window.location.search);
const initialQuery = pageSearchParams.get("q")?.trim() ?? "";
const initialTagFilter = pageSearchParams.get("tag")?.trim() ?? "";
const initialAuthorFilter = pageSearchParams.get("author")?.trim() ?? "";

let activeArticles = [...feedArticles];
let cursor = 0;
let isLoading = false;
let observer;
let searchDebounce;
let searchTermRaw = "";
let searchTermNormalized = "";
let selectedTagFilter = "";
let selectedAuthorFilter = "";
let loadTimeout;
let viewMode = "grid";
let suggestionValues = [];

function normalizeSearchValue(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/#/g, " ")
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

function readViewMode() {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function setViewMode(mode) {
  viewMode = mode === "list" ? "list" : "grid";
  grid?.classList.toggle("is-list-view", viewMode === "list");

  viewButtons.forEach((button) => {
    const isActive = button.dataset.viewOption === viewMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  } catch {
    // Ignore storage errors.
  }
}

function createSkeletonCard() {
  const card = document.createElement("article");
  card.className = "article-card article-card--skeleton";
  card.setAttribute("aria-hidden", "true");
  card.innerHTML = `
    <div class="skeleton skeleton--image"></div>
    <div class="skeleton skeleton--line skeleton--title"></div>
    <div class="skeleton skeleton--line"></div>
    <div class="skeleton skeleton--line skeleton--short"></div>
  `;
  return card;
}

function clearSkeletons() {
  grid?.querySelectorAll(".article-card--skeleton").forEach((card) => card.remove());
}

function showSkeletons(count) {
  if (!grid || count <= 0) return;
  clearSkeletons();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    fragment.appendChild(createSkeletonCard());
  }
  grid.appendChild(fragment);
}

function buildTags(tags, parent) {
  tags.forEach((tag) => {
    const link = document.createElement("a");
    link.href = buildCategoryUrl(tag);
    link.textContent = `#${tag}`;
    link.setAttribute("aria-label", `Voir la catégorie ${tag}`);
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
  const published = `Publié le ${formatDateFr(article.date)}`;
  if (!article.updatedDate || article.updatedDate === article.date) return published;
  return `${published} · Mis à jour le ${formatDateFr(article.updatedDate)}`;
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

function hideSuggestionPanel() {
  if (!searchSuggestPanel) return;
  searchSuggestPanel.hidden = true;
}

function populateSearchSuggestions() {
  const suggestions = new Set();
  feedArticles.forEach((article) => {
    suggestions.add(article.title);
    suggestions.add(article.author);
    article.tags.forEach((tag) => suggestions.add(`#${tag}`));
  });
  suggestionValues = [...suggestions].sort((a, b) => a.localeCompare(b, "fr"));
}

function updateSuggestionPanel(rawValue) {
  if (!searchSuggestPanel || !searchSuggestList) return;
  const query = normalizeSearchValue(rawValue);

  if (query.length < 2) {
    hideSuggestionPanel();
    return;
  }

  const matches = suggestionValues
    .filter((value) => normalizeSearchValue(value).includes(query))
    .slice(0, 6);

  if (matches.length === 0) {
    hideSuggestionPanel();
    return;
  }

  searchSuggestList.innerHTML = "";
  matches.forEach((value) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggest__item";
    button.textContent = value;
    button.addEventListener("click", () => {
      if (searchInput) searchInput.value = value;
      hideSuggestionPanel();
      applySearchAndFilters(value);
    });
    item.appendChild(button);
    searchSuggestList.appendChild(item);
  });

  searchSuggestPanel.hidden = false;
}

function populateFilterControls() {
  if (filterTag) {
    const tags = [...new Set(feedArticles.flatMap((article) => article.tags))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
    tags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      filterTag.appendChild(option);
    });
    if ([...filterTag.options].some((option) => option.value === initialTagFilter)) {
      filterTag.value = initialTagFilter;
    }
  }

  if (filterAuthor) {
    const authors = [...new Set(feedArticles.map((article) => article.author))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
    authors.forEach((author) => {
      const option = document.createElement("option");
      option.value = author;
      option.textContent = author;
      filterAuthor.appendChild(option);
    });
    if ([...filterAuthor.options].some((option) => option.value === initialAuthorFilter)) {
      filterAuthor.value = initialAuthorFilter;
    }
  }

  selectedTagFilter = filterTag?.value ?? "";
  selectedAuthorFilter = filterAuthor?.value ?? "";
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

  image.src = buildOptimizedImageUrl(article.image, 640, 72);
  image.srcset = buildOptimizedImageSrcSet(article.image, [320, 480, 640, 800, 960], 72);
  image.sizes = "(max-width: 767px) 100vw, (max-width: 980px) 50vw, 33vw";
  image.alt = article.title;
  link.href = buildArticleUrl(article.id);
  link.setAttribute("aria-label", `Lire l'article : ${article.title}`);
  buildTags(article.tags, tags);

  return fragment;
}

function syncSearchQueryParam() {
  const nextUrl = new URL(window.location.href);
  if (searchTermRaw) {
    nextUrl.searchParams.set("q", searchTermRaw);
  } else {
    nextUrl.searchParams.delete("q");
  }

  if (selectedTagFilter) {
    nextUrl.searchParams.set("tag", selectedTagFilter);
  } else {
    nextUrl.searchParams.delete("tag");
  }

  if (selectedAuthorFilter) {
    nextUrl.searchParams.set("author", selectedAuthorFilter);
  } else {
    nextUrl.searchParams.delete("author");
  }

  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function updateSearchStatus() {
  if (!searchStatus) return;

  const activeFilters = [];
  if (selectedTagFilter) activeFilters.push(`rubrique ${selectedTagFilter}`);
  if (selectedAuthorFilter) activeFilters.push(`auteur ${selectedAuthorFilter}`);
  const filtersLabel = activeFilters.length ? ` (${activeFilters.join(" · ")})` : "";
  const hasQuery = Boolean(searchTermRaw);

  if (!hasQuery && activeFilters.length === 0) {
    searchStatus.textContent = "";
    searchStatus.classList.remove("is-empty");
    return;
  }

  if (activeArticles.length === 0) {
    const queryLabel = hasQuery ? `"${searchTermRaw}"` : "les filtres actuels";
    searchStatus.textContent = `Aucun résultat pour ${queryLabel}${filtersLabel}.`;
    searchStatus.classList.add("is-empty");
    return;
  }

  const queryLabel = hasQuery ? ` pour "${searchTermRaw}"` : "";
  searchStatus.textContent = `${activeArticles.length} résultat(s)${queryLabel}${filtersLabel}.`;
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
  clearSkeletons();
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
  showSkeletons(Math.min(BATCH_SIZE, activeArticles.length - cursor));

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

function articleMatchesFilters(article) {
  if (selectedTagFilter && !article.tags.includes(selectedTagFilter)) return false;
  if (selectedAuthorFilter && article.author !== selectedAuthorFilter) return false;
  return true;
}

function applySearchAndFilters(value) {
  window.clearTimeout(loadTimeout);
  searchTermRaw = value.trim();
  searchTermNormalized = normalizeSearchValue(searchTermRaw);
  selectedTagFilter = filterTag?.value ?? "";
  selectedAuthorFilter = filterAuthor?.value ?? "";
  activeArticles = feedArticles.filter(
    (article) => articleMatchesSearch(article) && articleMatchesFilters(article)
  );
  cursor = 0;
  isLoading = false;
  clearSkeletons();
  grid.innerHTML = "";
  showLoading(false);
  renderBatch(BATCH_SIZE);
  updateSearchStatus();
  syncSearchQueryParam();
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

  populateSearchSuggestions();
  populateFilterControls();
  if (searchInput && initialQuery) searchInput.value = initialQuery;
  applySearchAndFilters(searchInput?.value ?? "");
}

setViewMode(readViewMode());

renderFeaturedMeta();
renderFeaturedSources();

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  window.clearTimeout(searchDebounce);
  hideSuggestionPanel();
  applySearchAndFilters(searchInput?.value ?? "");
});

searchInput?.addEventListener("input", () => {
  window.clearTimeout(searchDebounce);
  updateSuggestionPanel(searchInput.value);
  searchDebounce = window.setTimeout(() => {
    applySearchAndFilters(searchInput.value);
  }, 260);
});

searchInput?.addEventListener("focus", () => {
  updateSuggestionPanel(searchInput.value);
});

searchInput?.addEventListener("blur", () => {
  window.setTimeout(() => {
    hideSuggestionPanel();
  }, 120);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (!searchForm?.contains(target)) {
    hideSuggestionPanel();
  }
});

filterTag?.addEventListener("change", () => {
  applySearchAndFilters(searchInput?.value ?? "");
});

filterAuthor?.addEventListener("change", () => {
  applySearchAndFilters(searchInput?.value ?? "");
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.viewOption === "list" ? "list" : "grid";
    setViewMode(mode);
  });
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
