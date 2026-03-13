import {
  articles,
  categories,
  sortByDateDesc,
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
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

const searchParams = new URLSearchParams(window.location.search);
const requestedTag = searchParams.get("tag") || "";
const tag = categories.find((entry) => entry === requestedTag) ?? categories[0];

const filteredArticles = articles
  .filter((article) => article.tags.includes(tag))
  .sort(sortByDateDesc);

let cursor = 0;
let isLoading = false;
let observer;

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

  image.src = article.image;
  image.alt = article.title;
  link.href = buildArticleUrl(article.id);
  link.setAttribute("aria-label", `Lire l'article : ${article.title}`);
  buildTags(article.tags, tags);

  return fragment;
}

function showLoading(visible) {
  indicator.classList.toggle("is-visible", visible);
  indicator.setAttribute("aria-hidden", String(!visible));
}

function renderBatch(size = 6) {
  const end = Math.min(cursor + size, filteredArticles.length);
  for (let i = cursor; i < end; i += 1) {
    grid.appendChild(buildCard(filteredArticles[i]));
  }
  cursor = end;

  if (cursor >= filteredArticles.length) {
    observer?.disconnect();
    sentinel?.remove();
    showLoading(false);
  }
}

function loadMore() {
  if (isLoading || cursor >= filteredArticles.length) return;
  isLoading = true;
  showLoading(true);

  window.setTimeout(() => {
    renderBatch(6);
    showLoading(false);
    isLoading = false;
  }, 260);
}

function setupCategoryHeader() {
  title.textContent = `#${tag}`;
  lead.textContent = `${filteredArticles.length} article(s), affiches du plus recent au plus ancien.`;
  breadcrumbCurrent.textContent = tag;
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
window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();

if (filteredArticles.length === 0) {
  lead.textContent = "Aucun article pour cette categorie.";
  sentinel?.remove();
} else {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) loadMore();
      });
    },
    { rootMargin: "360px 0px" }
  );
  observer.observe(sentinel);
  renderBatch(6);
}

backToTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
