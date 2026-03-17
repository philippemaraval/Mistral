import "./pwa.js";
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
  getSeriesById,
} from "./articles-data.js";
import { trackEvent } from "./analytics.js";

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
const featuredNativeShareButton = document.querySelector('[data-share-action="featured-native"]');
const siteNativeShareButton = document.querySelector('[data-share-action="site-native"]');

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
let activeSuggestionIndex = -1;
let hasTrackedHomeView = false;
let lastSearchSignature = "";

function normalizeSearchValue(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/#/g, " ")
    .toLowerCase()
    .trim();
}

function shortSocialTitle(value, maxLength = 72) {
  const source = String(value ?? "").trim();
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function setMetaTag(selector, content) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.setAttribute("content", content);
}

function getCanonicalHomeUrl() {
  return new URL("./index.html", window.location.href).toString();
}

function updateHomeSocialMeta() {
  const previewImage = featuredArticle
    ? buildOptimizedImageUrl(featuredArticle.ogImage || featuredArticle.image, 1200, 76)
    : new URL("./social-preview.svg", window.location.href).toString();
  const socialTitle = featuredArticle
    ? shortSocialTitle(featuredArticle.socialTitle || featuredArticle.seoTitle || featuredArticle.title)
    : "Mistral | Le vent de l'actualité";
  const socialDescription = featuredArticle
    ? featuredArticle.seoDescription || featuredArticle.excerpt
    : "Le vent de l'actualité à Marseille.";
  const canonicalUrl = getCanonicalHomeUrl();

  setMetaTag('meta[name="description"]', socialDescription);
  setMetaTag('meta[property="og:title"]', `${socialTitle} | Mistral`);
  setMetaTag('meta[property="og:description"]', socialDescription);
  setMetaTag('meta[property="og:image"]', previewImage);
  setMetaTag('meta[property="og:image:alt"]', featuredArticle?.heroImageAlt || socialTitle);
  setMetaTag('meta[property="og:url"]', canonicalUrl);
  setMetaTag('meta[name="twitter:title"]', `${socialTitle} | Mistral`);
  setMetaTag('meta[name="twitter:description"]', socialDescription);
  setMetaTag('meta[name="twitter:image"]', previewImage);
  setMetaTag('meta[name="twitter:image:alt"]', featuredArticle?.heroImageAlt || socialTitle);

  const canonical = document.querySelector("#canonical-link");
  if (canonical) canonical.setAttribute("href", canonicalUrl);
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

function getSiteSharePayload() {
  return {
    title: "Mistral",
    text: "Le vent de l'actualité",
    url: new URL("./", window.location.href).toString(),
  };
}

function getFeaturedSharePayload() {
  if (!featuredArticle) return getSiteSharePayload();
  return {
    title: featuredArticle.socialTitle || featuredArticle.seoTitle || featuredArticle.title,
    text: featuredArticle.seoDescription || featuredArticle.excerpt,
    url: new URL(buildArticleUrl(featuredArticle.id), window.location.href).toString(),
  };
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

async function copyShareUrl(url) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

function setShareFeedback(button, message) {
  if (!button) return;
  const previousTitle = button.dataset.shareTitle || button.getAttribute("title") || "";
  if (!button.dataset.shareTitle && previousTitle) {
    button.dataset.shareTitle = previousTitle;
  }
  button.setAttribute("title", message);
  window.setTimeout(() => {
    button.setAttribute("title", button.dataset.shareTitle || previousTitle || message);
  }, 1800);
}

async function handleNativeShare(button, payloadBuilder) {
  const payload = payloadBuilder();
  const scope = payloadBuilder === getSiteSharePayload ? "site" : "featured";
  const articleId = scope === "featured" ? featuredArticle?.id : undefined;

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      trackEvent("share_click", {
        scope,
        articleId,
        via: "native",
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  const copied = await copyShareUrl(payload.url);
  if (copied) {
    setShareFeedback(button, "Copié");
    trackEvent("share_click", {
      scope,
      articleId,
      via: "clipboard",
    });
    return;
  }

  const subject = encodeURIComponent(payload.title || "Partager");
  const body = encodeURIComponent(`${payload.text || ""}\n${payload.url}`.trim());
  trackEvent("share_click", {
    scope,
    articleId,
    via: "mailto",
  });
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function bindNativeShareButton(button, payloadBuilder) {
  if (!button) return;
  button.addEventListener("click", () => {
    void handleNativeShare(button, payloadBuilder);
  });
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

function formatPublishedUpdated(article) {
  const published = `Publié le ${formatDateFr(article.date)}`;
  if (!article.updatedDate || article.updatedDate === article.date) return published;
  return `${published} · Mis à jour le ${formatDateFr(article.updatedDate)}`;
}

function renderFeaturedMeta() {
  if (!featuredStoryMeta || !featuredArticle) return;
  renderCardByline(featuredStoryMeta, featuredArticle);
  featuredStoryMeta.append(` · ${formatPublishedUpdated(featuredArticle)}`);
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
    link.addEventListener("click", () => {
      trackEvent("source_click", {
        articleId: featuredArticle.id,
        file: source.file,
        label: source.label,
        context: "featured",
      });
    });
    featuredStorySources.appendChild(link);
  });
}

function getSuggestionButtons() {
  if (!searchSuggestList) return [];
  return [...searchSuggestList.querySelectorAll(".search-suggest__item")];
}

function setActiveSuggestion(index) {
  const buttons = getSuggestionButtons();
  if (buttons.length === 0) {
    activeSuggestionIndex = -1;
    searchInput?.removeAttribute("aria-activedescendant");
    return;
  }

  const boundedIndex = ((index % buttons.length) + buttons.length) % buttons.length;
  activeSuggestionIndex = boundedIndex;

  buttons.forEach((button, buttonIndex) => {
    const isActive = buttonIndex === boundedIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    if (isActive) {
      searchInput?.setAttribute("aria-activedescendant", button.id);
    }
  });
}

function selectSuggestion(value) {
  if (searchInput) searchInput.value = value;
  hideSuggestionPanel();
  trackEvent("search_suggestion_select", { value });
  applySearchAndFilters(value);
}

function hideSuggestionPanel() {
  if (!searchSuggestPanel) return;
  searchSuggestPanel.hidden = true;
  searchInput?.setAttribute("aria-expanded", "false");
  searchInput?.removeAttribute("aria-activedescendant");
  activeSuggestionIndex = -1;
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
  activeSuggestionIndex = -1;
  matches.forEach((value) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggest__item";
    button.id = `search-suggest-item-${normalizeSearchValue(value).replace(/\s+/g, "-")}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", "false");
    button.dataset.value = value;
    button.textContent = value;
    button.addEventListener("click", () => {
      selectSuggestion(value);
    });
    button.addEventListener("mouseenter", () => {
      const buttons = getSuggestionButtons();
      const hoveredIndex = buttons.indexOf(button);
      if (hoveredIndex >= 0) setActiveSuggestion(hoveredIndex);
    });
    item.appendChild(button);
    searchSuggestList.appendChild(item);
  });

  searchSuggestPanel.hidden = false;
  searchInput?.setAttribute("aria-expanded", "true");
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
  const seriesLine = fragment.querySelector(".article-card__series");
  const title = fragment.querySelector(".article-card__title");
  const excerpt = fragment.querySelector(".article-card__excerpt");
  const caption = fragment.querySelector(".article-card__caption");

  title.innerHTML = highlightText(article.title);
  excerpt.innerHTML = highlightText(article.excerpt);
  caption.innerHTML = highlightText(article.caption);
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

  const signature = `${searchTermRaw}::${selectedTagFilter}::${selectedAuthorFilter}::${activeArticles.length}`;
  if (signature !== lastSearchSignature) {
    lastSearchSignature = signature;
    trackEvent("search_apply", {
      query: searchTermRaw,
      tag: selectedTagFilter,
      author: selectedAuthorFilter,
      resultCount: activeArticles.length,
    });
  }
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
updateHomeSocialMeta();

renderFeaturedMeta();
renderFeaturedSources();
bindNativeShareButton(featuredNativeShareButton, getFeaturedSharePayload);
bindNativeShareButton(siteNativeShareButton, getSiteSharePayload);

if (!hasTrackedHomeView) {
  hasTrackedHomeView = true;
  trackEvent("home_view", {
    featuredArticleId: featuredArticle?.id || null,
    articleCount: feedArticles.length,
  });
}

const featuredImage = document.querySelector(".featured-story__figure img");
markImageLoading(featuredImage, { eager: true });

document.querySelector("#featured-story .featured-story__link")?.addEventListener("click", () => {
  if (!featuredArticle) return;
  trackEvent("article_card_click", {
    articleId: featuredArticle.id,
    context: "featured",
  });
});

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

searchInput?.addEventListener("keydown", (event) => {
  const buttons = getSuggestionButtons();
  const hasSuggestions = buttons.length > 0 && searchSuggestPanel && !searchSuggestPanel.hidden;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!hasSuggestions) {
      updateSuggestionPanel(searchInput.value);
      const refreshedButtons = getSuggestionButtons();
      if (refreshedButtons.length === 0) return;
      setActiveSuggestion(0);
      return;
    }
    setActiveSuggestion(activeSuggestionIndex + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    if (!hasSuggestions) return;
    event.preventDefault();
    setActiveSuggestion(activeSuggestionIndex - 1);
    return;
  }

  if (event.key === "Enter" && hasSuggestions && activeSuggestionIndex >= 0) {
    event.preventDefault();
    const value = buttons[activeSuggestionIndex]?.dataset.value ?? "";
    if (value) selectSuggestion(value);
    return;
  }

  if (event.key === "Escape") {
    hideSuggestionPanel();
  }
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

grid?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest(".article-card__link");
  if (!link) return;
  const articleId = link.getAttribute("data-article-id");
  if (!articleId) return;
  trackEvent("article_card_click", {
    articleId,
    context: "home_feed",
  });
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
    trackEvent("feed_view_mode", {
      page: "home",
      mode,
    });
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
