import {
  articles,
  featuredArticleId,
  sortByDateDesc,
  formatDateFr,
  buildArticleUrl,
  buildCategoryUrl,
} from "./articles-data.js";

const grid = document.querySelector("#article-grid");
const template = document.querySelector("#article-card-template");
const indicator = document.querySelector("#loading-indicator");
const sentinel = document.querySelector("#scroll-sentinel");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const searchForm = document.querySelector(".search-bar");

const feedArticles = articles
  .filter((article) => article.id !== featuredArticleId)
  .sort(sortByDateDesc);

let cursor = 0;
let isLoading = false;
let observer;

function buildTags(tags, parent) {
  tags.forEach((tag) => {
    const link = document.createElement("a");
    link.href = buildCategoryUrl(tag);
    link.textContent = `#${tag}`;
    link.setAttribute("aria-label", `Voir la categorie ${tag}`);
    parent.appendChild(link);
  });
}

function buildCard(article) {
  const fragment = template.content.cloneNode(true);
  const image = fragment.querySelector(".article-card__image");
  const link = fragment.querySelector(".article-card__link");
  const tags = fragment.querySelector(".article-card__tags");
  const date = fragment.querySelector(".article-card__date");

  fragment.querySelector(".article-card__title").textContent = article.title;
  fragment.querySelector(".article-card__excerpt").textContent = article.excerpt;
  fragment.querySelector(".article-card__caption").textContent = article.caption;
  date.textContent = `Publie le ${formatDateFr(article.date)}`;

  image.src = article.image;
  image.alt = article.title;
  link.href = buildArticleUrl(article.id);
  link.setAttribute("aria-label", `Lire l'article : ${article.title}`);
  buildTags(article.tags, tags);

  return fragment;
}

function renderBatch(size = 6) {
  const end = Math.min(cursor + size, feedArticles.length);
  for (let i = cursor; i < end; i += 1) {
    const article = feedArticles[i];
    grid.appendChild(buildCard(article));
  }
  cursor = end;

  if (cursor >= feedArticles.length) {
    observer?.disconnect();
    sentinel?.remove();
    showLoading(false);
  }
}

function showLoading(visible) {
  indicator.classList.toggle("is-visible", visible);
  indicator.setAttribute("aria-hidden", String(!visible));
}

function loadMore() {
  if (isLoading || cursor >= feedArticles.length) return;
  isLoading = true;
  showLoading(true);

  window.setTimeout(() => {
    renderBatch(6);
    showLoading(false);
    isLoading = false;
  }, 380);
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

  observer.observe(sentinel);
  renderBatch(6);
}

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
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
