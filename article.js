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
const articleRevisions = document.querySelector("#article-revisions");
const articleRevisionList = document.querySelector("#article-revision-list");
const relatedArticlesSection = document.querySelector("#related-articles");
const relatedArticlesList = document.querySelector("#related-articles-list");
const breadcrumbCategoryLink = document.querySelector("#breadcrumb-category-link");
const breadcrumbCurrent = document.querySelector("#breadcrumb-current");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const readingProgressBar = document.querySelector("#reading-progress-bar");
const backToTopButton = document.querySelector("#back-to-top");
const articlePage = document.querySelector(".article-page");
const mobileReadingBar = document.querySelector("#mobile-reading-bar");
const mobileReadingToc = document.querySelector("#mobile-reading-toc");
const mobileReadingSources = document.querySelector("#mobile-reading-sources");
const mobileReadingShare = document.querySelector("#mobile-reading-share");
const mobileReadingTop = document.querySelector("#mobile-reading-top");
const readingSizeToggle = document.querySelector("#reading-size-toggle");
const readingSpacingToggle = document.querySelector("#reading-spacing-toggle");
const articleContentGrid = document.querySelector(".article-content-grid");
const articleShareButton = document.querySelector("#article-share-button");

const searchParams = new URLSearchParams(window.location.search);
const requestedId = searchParams.get("id");
const article = getArticleById(requestedId) ?? getArticleById("om-chiffres-stade");
const primaryTag = article.tags[0];
const READING_PREFS_STORAGE_KEY = "mistral.reading.preferences";

const tocEntries = [];
const readingPrefs = {
  largeText: false,
  relaxedSpacing: false,
};

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

function readReadingPrefs() {
  try {
    const raw = localStorage.getItem(READING_PREFS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    readingPrefs.largeText = Boolean(parsed.largeText);
    readingPrefs.relaxedSpacing = Boolean(parsed.relaxedSpacing);
  } catch {
    // Ignore malformed local storage values.
  }
}

function persistReadingPrefs() {
  try {
    localStorage.setItem(READING_PREFS_STORAGE_KEY, JSON.stringify(readingPrefs));
  } catch {
    // Ignore storage errors.
  }
}

function applyReadingPrefs() {
  if (articlePage) {
    articlePage.dataset.readingSize = readingPrefs.largeText ? "large" : "default";
    articlePage.dataset.readingSpacing = readingPrefs.relaxedSpacing ? "relaxed" : "default";
  }

  if (readingSizeToggle) {
    readingSizeToggle.setAttribute("aria-pressed", String(readingPrefs.largeText));
    readingSizeToggle.textContent = readingPrefs.largeText ? "Texte standard" : "Texte agrandi";
  }

  if (readingSpacingToggle) {
    readingSpacingToggle.setAttribute("aria-pressed", String(readingPrefs.relaxedSpacing));
    readingSpacingToggle.textContent = readingPrefs.relaxedSpacing
      ? "Interligne standard"
      : "Interligne plus aéré";
  }
}

function getStickyOffset() {
  const offset = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--sticky-offset")
  );
  return Number.isFinite(offset) ? offset : 96;
}

function inferSourceType(source) {
  if (source.type) return source.type;
  const file = source.file?.toLowerCase() ?? "";
  if (file.endsWith(".csv")) return "Jeu de données (CSV)";
  if (file.endsWith(".pdf")) return "Document PDF";
  if (file.endsWith(".txt")) return "Document administratif";
  return "Document source";
}

function formatSourceDate(source) {
  const candidate = source.date || article.updatedDate || article.date;
  return formatDateFr(candidate);
}

function buildSourceItem(source) {
  const item = document.createElement("article");
  item.className = "source-item";

  const heading = document.createElement("h3");
  const link = document.createElement("a");
  link.className = "source-link";
  link.href = buildDocumentUrl(source.file);
  link.textContent = source.label;
  link.setAttribute("download", "");
  heading.appendChild(link);

  const meta = document.createElement("p");
  meta.className = "source-item__meta";
  meta.textContent = `${inferSourceType(source)} · Référence du ${formatSourceDate(source)}`;

  const context = document.createElement("p");
  context.className = "source-item__context";
  context.textContent =
    source.context ??
    "Pièce utilisée pour vérifier les faits, les montants ou les décisions publiques mentionnées dans l'article.";

  item.append(heading, meta, context);
  return item;
}

function renderArticleBody() {
  if (!articleBody || !articleToc || !articleTocList) return;

  const sections = article.sections?.length ? article.sections : buildFallbackSections(article);
  const internalTargets = getRelatedArticles(article.id, 6);
  articleBody.innerHTML = "";
  articleTocList.innerHTML = "";
  tocEntries.length = 0;

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

    const categoryTag = article.tags[index % article.tags.length];
    const relatedTarget =
      internalTargets.length > 0 ? internalTargets[index % internalTargets.length] : null;
    if (categoryTag || relatedTarget) {
      const linksLine = document.createElement("p");
      linksLine.className = "article-body__context-links";
      linksLine.append("À lire dans le même fil: ");

      if (categoryTag) {
        const categoryLink = document.createElement("a");
        categoryLink.href = buildCategoryUrl(categoryTag);
        categoryLink.textContent = `#${categoryTag}`;
        categoryLink.setAttribute("aria-label", `Voir plus sur ${categoryTag}`);
        linksLine.appendChild(categoryLink);
      }

      if (categoryTag && relatedTarget) {
        linksLine.append(" · ");
      }

      if (relatedTarget) {
        const relatedLink = document.createElement("a");
        relatedLink.href = buildArticleUrl(relatedTarget.id);
        relatedLink.textContent = relatedTarget.title;
        relatedLink.setAttribute("aria-label", `Lire l'article: ${relatedTarget.title}`);
        linksLine.appendChild(relatedLink);
      }

      articleSection.appendChild(linksLine);
    }

    articleBody.appendChild(articleSection);

    const tocItem = document.createElement("li");
    const tocLink = document.createElement("a");
    tocLink.href = `#${sectionId}`;
    tocLink.textContent = section.title;
    tocItem.appendChild(tocLink);
    articleTocList.appendChild(tocItem);
    tocEntries.push({ section: articleSection, link: tocLink });
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
    articleSourceLinks.appendChild(buildSourceItem(source));
  });
}

function renderRevisionHistory() {
  if (!articleRevisions || !articleRevisionList) return;
  articleRevisionList.innerHTML = "";

  const events = [
    {
      date: article.date,
      label: "Publication initiale",
      detail: `Mise en ligne par ${article.author}.`,
    },
  ];

  if (article.updatedDate && article.updatedDate !== article.date) {
    events.push({
      date: article.updatedDate,
      label: "Mise à jour éditoriale",
      detail: "Actualisation des éléments de contexte et de vérification.",
    });
  }

  article.corrections?.forEach((correction) => {
    events.push({
      date: correction.date,
      label: "Correction",
      detail: correction.detail,
    });
  });

  events
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((event) => {
      const item = document.createElement("li");
      item.className = "revision-item";

      const heading = document.createElement("p");
      heading.className = "revision-item__heading";
      heading.textContent = `${formatDateFr(event.date)} · ${event.label}`;

      const detail = document.createElement("p");
      detail.className = "revision-item__detail";
      detail.textContent = event.detail;

      item.append(heading, detail);
      articleRevisionList.appendChild(item);
    });

  if (events.length === 0) {
    articleRevisions.remove();
  }
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

function updateActiveTocEntry() {
  if (!tocEntries.length || articleToc?.hidden) return;

  const threshold = getStickyOffset() + 22;
  let activeEntry = tocEntries[0];

  tocEntries.forEach((entry) => {
    if (entry.section.getBoundingClientRect().top - threshold <= 0) {
      activeEntry = entry;
    }
  });

  tocEntries.forEach((entry) => {
    const isActive = entry === activeEntry;
    entry.link.classList.toggle("is-active", isActive);
    if (isActive) {
      entry.link.setAttribute("aria-current", "location");
    } else {
      entry.link.removeAttribute("aria-current");
    }
  });
}

function syncScrollUI() {
  updateReadingProgress();
  updateActiveTocEntry();
  updateBackToTopVisibility();
}

function toggleMobileShortcut(element, visible) {
  if (!element) return;
  element.classList.toggle("is-hidden", !visible);
  if (visible) {
    element.removeAttribute("aria-hidden");
    element.removeAttribute("tabindex");
  } else {
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("tabindex", "-1");
  }
}

function syncMobileReadingBar() {
  if (!mobileReadingBar) return;
  const hasToc = Boolean(articleToc && !articleToc.hidden);
  const hasSources = Boolean(article.sources?.length && articleSources?.isConnected);

  articleContentGrid?.classList.toggle("article-content-grid--with-toc", hasToc);
  toggleMobileShortcut(mobileReadingToc, hasToc);
  toggleMobileShortcut(mobileReadingSources, hasSources);
}

function setupReadingPreferences() {
  readReadingPrefs();
  applyReadingPrefs();

  readingSizeToggle?.addEventListener("click", () => {
    readingPrefs.largeText = !readingPrefs.largeText;
    applyReadingPrefs();
    persistReadingPrefs();
    syncScrollUI();
  });

  readingSpacingToggle?.addEventListener("click", () => {
    readingPrefs.relaxedSpacing = !readingPrefs.relaxedSpacing;
    applyReadingPrefs();
    persistReadingPrefs();
    syncScrollUI();
  });
}

function setMetaTag(selector, content) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.setAttribute("content", content);
}

function resolveArticleShareUrl() {
  const fallback = new URL(buildArticleUrl(article.id), window.location.href).toString();
  if (!article.canonicalUrl) return fallback;
  try {
    return new URL(article.canonicalUrl, window.location.href).toString();
  } catch {
    return fallback;
  }
}

function getArticleSharePayload() {
  return {
    title: article.seoTitle || article.title,
    text: article.seoDescription || article.excerpt,
    url: resolveArticleShareUrl(),
  };
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

async function handleNativeShare(button) {
  const payload = getArticleSharePayload();

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  const copied = await copyShareUrl(payload.url);
  if (copied) {
    setShareFeedback(button, "Copié");
    return;
  }

  const subject = encodeURIComponent(payload.title || "Partager");
  const body = encodeURIComponent(`${payload.text || ""}\n${payload.url}`.trim());
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function bindShareButtons() {
  [articleShareButton, mobileReadingShare].forEach((button) => {
    button?.addEventListener("click", () => {
      void handleNativeShare(button);
    });
  });
}

function updateSocialMeta() {
  const pageUrl = new URL(buildArticleUrl(article.id), window.location.href).toString();
  const canonicalUrl = article.canonicalUrl || pageUrl;
  const description = article.seoDescription || article.excerpt;
  const socialTitle = article.seoTitle || article.title;
  const previewImage = buildOptimizedImageUrl(article.ogImage || article.image, 1200, 78);

  setMetaTag('meta[name="description"]', description);
  setMetaTag('meta[property="og:title"]', `${socialTitle} | Mistral`);
  setMetaTag('meta[property="og:description"]', description);
  setMetaTag('meta[property="og:image"]', previewImage);
  setMetaTag('meta[property="og:url"]', canonicalUrl);
  setMetaTag('meta[name="twitter:title"]', `${socialTitle} | Mistral`);
  setMetaTag('meta[name="twitter:description"]', description);
  setMetaTag('meta[name="twitter:image"]', previewImage);

  const canonical = document.querySelector("#canonical-link");
  if (canonical) canonical.setAttribute("href", canonicalUrl);
}

document.title = `${article.seoTitle || article.title} | Mistral`;
title.textContent = article.title;
excerpt.textContent = article.excerpt;
metaPrimary.textContent = formatAuthorLine(article);
metaSecondary.textContent = formatPublishedUpdated(article);
image.src = buildOptimizedImageUrl(article.image, 960, 72);
image.srcset = buildOptimizedImageSrcSet(article.image, [480, 720, 960, 1200, 1600], 74);
image.sizes = "(max-width: 980px) 100vw, 920px";
image.alt = article.heroImageAlt || article.title;
caption.textContent = article.imageCredit
  ? `${article.caption} · ${article.imageCredit}`
  : article.caption;
breadcrumbCategoryLink.href = buildCategoryUrl(primaryTag);
breadcrumbCategoryLink.textContent = primaryTag;
breadcrumbCurrent.textContent = article.title;
setupActiveCategoryNav();
updateSocialMeta();
renderArticleBody();
renderSources();
renderRevisionHistory();
renderRelatedArticles();
setupReadingPreferences();
syncMobileReadingBar();
bindShareButtons();

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

mobileReadingTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", syncScrollUI, { passive: true });
window.addEventListener("resize", syncScrollUI);
syncScrollUI();
