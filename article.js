import {
  articles,
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
} from "./articles-data.js";

const title = document.querySelector("#article-title");
const excerpt = document.querySelector("#article-excerpt");
const date = document.querySelector("#article-date");
const image = document.querySelector("#article-image");
const caption = document.querySelector("#article-caption");
const tags = document.querySelector("#article-tags");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

const searchParams = new URLSearchParams(window.location.search);
const requestedId = searchParams.get("id");
const article = articles.find((entry) => entry.id === requestedId) ?? articles[0];

document.title = `${article.title} | Mistral`;
title.textContent = article.title;
excerpt.textContent = article.excerpt;
date.textContent = `Publie le ${formatDateFr(article.date)}`;
image.src = article.image;
image.alt = article.title;
caption.textContent = article.caption;

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

const canonical = document.createElement("link");
canonical.rel = "canonical";
canonical.href = buildArticleUrl(article.id);
document.head.appendChild(canonical);
