import {
  articles,
  categories,
  sortByDateDesc,
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
  buildOptimizedImageUrl,
  buildOptimizedImageSrcSet,
} from "./articles-data.js";

const grid = document.querySelector("#category-grid");
const template = document.querySelector("#article-card-template");
const indicator = document.querySelector("#category-loading");
const sentinel = document.querySelector("#category-sentinel");
const title = document.querySelector("#category-title");
const lead = document.querySelector("#category-lead");
const breadcrumbCurrent = document.querySelector("#breadcrumb-current");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const backToTopButton = document.querySelector("#back-to-top");
const viewButtons = Array.from(document.querySelectorAll("[data-view-option]"));
const tagFiltersChips = document.querySelector("#tag-filters-chips");
const tagFiltersReset = document.querySelector("#tag-filters-reset");

const BATCH_SIZE = 6;
const VIEW_MODE_STORAGE_KEY = "mistral.viewMode";
const searchParams = new URLSearchParams(window.location.search);
const requestedTag = searchParams.get("tag") || "";
const tag = categories.find((entry) => entry === requestedTag) ?? categories[0];

const baseArticles = articles
  .filter((article) => article.tags.includes(tag))
  .sort(sortByDateDesc);
const availableFilterTags = categories.filter(
  (entry) =>
    entry !== tag && baseArticles.some((article) => article.tags.includes(entry))
);

let activeArticles = [...baseArticles];
let selectedTags = new Set();
let cursor = 0;
let isLoading = false;
let observer;
let loadTimeout;
let viewMode = "grid";

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

function buildTags(tags, parent) {
  tags.forEach((entry) => {
    const link = document.createElement("a");
    link.href = buildCategoryUrl(entry);
    link.textContent = `#${entry}`;
    link.setAttribute("aria-label", `Voir la categorie ${entry}`);
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

  fragment.querySelector(".article-card__title").textContent = article.title;
  fragment.querySelector(".article-card__excerpt").textContent = article.excerpt;
  fragment.querySelector(".article-card__caption").textContent = article.caption;
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

function setMetaTag(selector, content) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.setAttribute("content", content);
}

function updateSocialMeta() {
  const pageUrl = new URL(buildCategoryUrl(tag), window.location.href).toString();
  const countText = `${baseArticles.length} article(s)`;
  const description = `Categorie ${tag} sur Mistral. ${countText} du plus recent au plus ancien.`;
  const previewImage = baseArticles[0]?.image
    ? buildOptimizedImageUrl(baseArticles[0].image, 1200, 78)
    : new URL("./social-preview.svg", window.location.href).toString();

  document.title = `${tag} | Mistral`;
  setMetaTag('meta[name="description"]', description);
  setMetaTag('meta[property="og:title"]', `${tag} | Mistral`);
  setMetaTag('meta[property="og:description"]', description);
  setMetaTag('meta[property="og:image"]', previewImage);
  setMetaTag('meta[property="og:url"]', pageUrl);
  setMetaTag('meta[name="twitter:title"]', `${tag} | Mistral`);
  setMetaTag('meta[name="twitter:description"]', description);
  setMetaTag('meta[name="twitter:image"]', previewImage);

  const canonical = document.querySelector("#canonical-link");
  if (canonical) canonical.setAttribute("href", pageUrl);
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

function showLoading(visible) {
  indicator.classList.toggle("is-visible", visible);
  indicator.setAttribute("aria-hidden", String(!visible));
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
    grid.appendChild(buildCard(activeArticles[i]));
  }
  cursor = end;
  updateSentinelVisibility();
  if (cursor >= activeArticles.length) {
    showLoading(false);
  }
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
  }, 260);
}

function updateCategoryLead() {
  if (activeArticles.length === 0) {
    lead.textContent = "Aucun article pour les filtres actuels.";
    return;
  }

  if (selectedTags.size === 0) {
    lead.textContent = `${activeArticles.length} article(s), affiches du plus recent au plus ancien.`;
    return;
  }

  const filters = [...selectedTags].map((entry) => `#${entry}`).join(", ");
  lead.textContent = `${activeArticles.length} article(s), affiches du plus recent au plus ancien. Filtres actifs: ${filters}.`;
}

function setupCategoryHeader() {
  title.textContent = `#${tag}`;
  breadcrumbCurrent.textContent = tag;
  updateCategoryLead();
}

function setupActiveCategoryNav() {
  nav?.querySelectorAll("a").forEach((link) => {
    const linkUrl = new URL(link.href, window.location.origin);
    const linkTag = linkUrl.searchParams.get("tag");
    const isActive = linkTag === tag;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function renderTagFilters() {
  if (!tagFiltersChips) return;
  tagFiltersChips.innerHTML = "";

  availableFilterTags.forEach((entry) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-filter-chip";
    chip.textContent = `#${entry}`;
    const isActive = selectedTags.has(entry);
    chip.classList.toggle("is-active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
    chip.addEventListener("click", () => {
      if (selectedTags.has(entry)) {
        selectedTags.delete(entry);
      } else {
        selectedTags.add(entry);
      }
      applyFilters();
    });
    tagFiltersChips.appendChild(chip);
  });

  tagFiltersReset?.classList.toggle("is-hidden", selectedTags.size === 0);
}

function applyFilters() {
  window.clearTimeout(loadTimeout);
  activeArticles = baseArticles.filter((article) =>
    [...selectedTags].every((selectedTag) => article.tags.includes(selectedTag))
  );
  cursor = 0;
  isLoading = false;
  clearSkeletons();
  grid.innerHTML = "";
  showLoading(false);
  renderBatch(BATCH_SIZE);
  renderTagFilters();
  updateCategoryLead();
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

setupCategoryHeader();
setupActiveCategoryNav();
setupNavigation();
updateSocialMeta();
setViewMode(readViewMode());
renderTagFilters();
window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();

if (grid && template) {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) loadMore();
      });
    },
    { rootMargin: "360px 0px" }
  );
  applyFilters();
}

backToTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.viewOption === "list" ? "list" : "grid";
    setViewMode(mode);
  });
});

tagFiltersReset?.addEventListener("click", () => {
  selectedTags = new Set();
  applyFilters();
});
