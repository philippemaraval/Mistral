import {
  articles,
  categories,
  sortByDateDesc,
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
} from "./articles-data.js";

const categoriesContainer = document.querySelector("#notfound-categories");
const latestContainer = document.querySelector("#notfound-latest");

function renderCategoryLinks() {
  if (!categoriesContainer) return;

  categories.forEach((tag) => {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = buildCategoryUrl(tag);
    link.textContent = `#${tag}`;
    categoriesContainer.appendChild(link);
  });
}

function renderLatestArticles() {
  if (!latestContainer) return;
  const latestArticles = [...articles].sort(sortByDateDesc).slice(0, 6);

  latestArticles.forEach((article) => {
    const link = document.createElement("a");
    link.className = "related-article";
    link.href = buildArticleUrl(article.id);
    link.setAttribute("aria-label", `Lire l'article ${article.title}`);

    const title = document.createElement("h3");
    title.className = "related-article__title";
    title.textContent = article.title;

    const meta = document.createElement("p");
    meta.className = "related-article__meta";
    meta.textContent = `Publie le ${formatDateFr(article.date)} · #${article.tags.join(" #")}`;

    link.append(title, meta);
    latestContainer.appendChild(link);
  });
}

renderCategoryLinks();
renderLatestArticles();
