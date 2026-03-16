import {
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
  buildDocumentUrl,
  buildOptimizedImageUrl,
  buildOptimizedImageSrcSet,
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
const articleToc = document.querySelector("#article-toc");
const articleTocList = document.querySelector("#article-toc-list");
const articleBody = document.querySelector("#article-body");
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
  const published = `Publié le ${formatDateFr(entry.date)}`;
  if (!entry.updatedDate || entry.updatedDate === entry.date) return published;
  return `${published} · Mis à jour le ${formatDateFr(entry.updatedDate)}`;
}

function formatAuthorLine(entry) {
  return `Par ${entry.author} · ${formatReadingTime(entry.readTimeMinutes)}`;
}

function slugify(value, index) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `section-${index + 1}`
  );
}

function buildFallbackSections(entry) {
  const publishedText = `Publié le ${formatDateFr(entry.date)}.`;
  const updatedText =
    entry.updatedDate && entry.updatedDate !== entry.date
      ? `Mise à jour le ${formatDateFr(entry.updatedDate)}.`
      : "";
  const sourceCount = entry.sources?.length ?? 0;
  const sourceText =
    sourceCount > 0
      ? `${sourceCount} document(s) source ont été mobilisés pour ce sujet.`
      : "Ce sujet repose sur des témoignages et des éléments publics recoupés.";

  return [
    {
      title: "Contexte",
      paragraphs: [entry.excerpt, publishedText],
    },
    {
      title: "Constats clés",
      paragraphs: [
        `L'enquête croise les enjeux de ${entry.tags.join(", ")} à Marseille.`,
        sourceText,
      ],
    },
    {
      title: "Ce qui reste à suivre",
      paragraphs: [
        "La rédaction continue de suivre les arbitrages publics et leurs effets concrets.",
        updatedText || "Cette publication sera mise à jour en cas d'évolution factuelle.",
      ],
    },
  ];
}

function renderArticleBody() {
  if (!articleBody || !articleToc || !articleTocList) return;

  const sections = article.sections?.length ? article.sections : buildFallbackSections(article);
  articleBody.innerHTML = "";
  articleTocList.innerHTML = "";

  sections.forEach((section, index) => {
    const sectionId = slugify(section.title, index);
    const articleSection = document.createElement("section");
    articleSection.className = "article-body__section";
    articleSection.id = sectionId;

    const heading = document.createElement("h2");
    heading.textContent = section.title;
    articleSection.appendChild(heading);

    section.paragraphs.forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      articleSection.appendChild(p);
    });

    articleBody.appendChild(articleSection);

    const tocItem = document.createElement("li");
    const tocLink = document.createElement("a");
    tocLink.href = `#${sectionId}`;
    tocLink.textContent = section.title;
    tocItem.appendChild(tocLink);
    articleTocList.appendChild(tocItem);
  });

  articleToc.hidden = sections.length < 2;
}

function setupActiveCategoryNav() {
  nav?.querySelectorAll("a").forEach((link) => {
    const linkUrl = new URL(link.href, window.location.origin);
    const linkTag = linkUrl.searchParams.get("tag");
    const isActive = linkTag === primaryTag;
    link.classList.toggle("is-active", isActive);
  });
}

function buildRelatedArticleCard(relatedArticle) {
  const link = document.createElement("a");
  link.className = "related-article";
  link.href = buildArticleUrl(relatedArticle.id);
  link.setAttribute("aria-label", `Lire l'article lié : ${relatedArticle.title}`);

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

function setMetaTag(selector, content) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.setAttribute("content", content);
}

function updateSocialMeta() {
  const pageUrl = new URL(buildArticleUrl(article.id), window.location.href).toString();
  const description = article.excerpt;
  const previewImage = buildOptimizedImageUrl(article.image, 1200, 78);

  setMetaTag('meta[name="description"]', description);
  setMetaTag('meta[property="og:title"]', `${article.title} | Mistral`);
  setMetaTag('meta[property="og:description"]', description);
  setMetaTag('meta[property="og:image"]', previewImage);
  setMetaTag('meta[property="og:url"]', pageUrl);
  setMetaTag('meta[name="twitter:title"]', `${article.title} | Mistral`);
  setMetaTag('meta[name="twitter:description"]', description);
  setMetaTag('meta[name="twitter:image"]', previewImage);

  const canonical = document.querySelector("#canonical-link");
  if (canonical) canonical.setAttribute("href", pageUrl);
}

document.title = `${article.title} | Mistral`;
title.textContent = article.title;
excerpt.textContent = article.excerpt;
metaPrimary.textContent = formatAuthorLine(article);
metaSecondary.textContent = formatPublishedUpdated(article);
image.src = buildOptimizedImageUrl(article.image, 960, 72);
image.srcset = buildOptimizedImageSrcSet(article.image, [480, 720, 960, 1200, 1600], 74);
image.sizes = "(max-width: 980px) 100vw, 920px";
image.alt = article.title;
caption.textContent = article.caption;
breadcrumbCategoryLink.href = buildCategoryUrl(primaryTag);
breadcrumbCategoryLink.textContent = primaryTag;
breadcrumbCurrent.textContent = article.title;
setupActiveCategoryNav();
updateSocialMeta();
renderArticleBody();
renderSources();
renderRelatedArticles();

article.tags.forEach((tag) => {
  const link = document.createElement("a");
  link.href = buildCategoryUrl(tag);
  link.textContent = `#${tag}`;
  link.setAttribute("aria-label", `Voir la catégorie ${tag}`);
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
