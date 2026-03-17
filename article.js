import "./pwa.js";
import {
  formatDateFr,
  buildCategoryUrl,
  buildArticleUrl,
  buildAuthorUrl,
  buildSeriesUrl,
  buildDocumentUrl,
  buildOptimizedImageUrl,
  buildOptimizedImageSrcSet,
  getArticleById,
  getAuthorById,
  getSeriesById,
  resolveAuthorId,
  getPrevNextArticles,
  getRelatedArticles,
  slugRedirects,
} from "./articles-data.js";
import { trackEvent } from "./analytics.js";

const title = document.querySelector("#article-title");
const excerpt = document.querySelector("#article-excerpt");
const metaPrimary = document.querySelector("#article-meta-primary");
const articleAuthorLink = document.querySelector("#article-author-link");
const articleReadTime = document.querySelector("#article-read-time");
const metaSecondary = document.querySelector("#article-meta-secondary");
const metaSeries = document.querySelector("#article-meta-series");
const articleSeriesLink = document.querySelector("#article-series-link");
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
const articlePagination = document.querySelector("#article-pagination");
const articlePrevLink = document.querySelector("#article-prev-link");
const articlePrevLabel = document.querySelector("#article-prev-label");
const articlePrevTitle = document.querySelector("#article-prev-title");
const articleNextLink = document.querySelector("#article-next-link");
const articleNextLabel = document.querySelector("#article-next-label");
const articleNextTitle = document.querySelector("#article-next-title");
const articleReportErrorButton = document.querySelector("#article-report-error");
const articleJsonLd = document.querySelector("#article-jsonld");

const searchParams = new URLSearchParams(window.location.search);
const requestedId = searchParams.get("id");
const requestedSlug = searchParams.get("slug");
const requestedAliasRaw = requestedId || requestedSlug || "";
const requestedAlias = String(requestedAliasRaw).trim().toLowerCase();
const redirectedId = requestedAlias ? slugRedirects[requestedAlias] : null;
const resolvedArticleId = redirectedId || requestedAlias || "om-chiffres-stade";
const article = getArticleById(resolvedArticleId) ?? getArticleById("om-chiffres-stade");
const primaryTag = article.tags[0];
const READING_PREFS_STORAGE_KEY = "mistral.reading.preferences";
const READ_MILESTONES = [25, 50, 75, 100];

const tocEntries = [];
const reachedMilestones = new Set();
const readingPrefs = {
  largeText: false,
  relaxedSpacing: false,
};

function normalizeArticleUrl() {
  if (!article) return;
  const canonicalRelative = buildArticleUrl(article.id);
  const hasLegacyQuery = Boolean(requestedSlug);
  const hasMismatchId = Boolean(requestedId && requestedId !== article.id);
  const hasRedirectAlias = Boolean(redirectedId && redirectedId === article.id);

  if (!hasLegacyQuery && !hasMismatchId && !hasRedirectAlias) return;
  window.history.replaceState({}, "", canonicalRelative);
}

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

function shortSocialTitle(value, maxLength = 72) {
  const source = String(value ?? "").trim();
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function markImageLoading(target, options = {}) {
  if (!target) return;
  const { eager = false } = options;
  target.loading = eager ? "eager" : "lazy";
  target.decoding = "async";
  target.fetchPriority = eager ? "high" : "low";
  target.dataset.imgState = "loading";

  if (target.complete && target.naturalWidth > 0) {
    target.dataset.imgState = "loaded";
    return;
  }

  target.addEventListener(
    "load",
    () => {
      target.dataset.imgState = "loaded";
    },
    { once: true }
  );
  target.addEventListener(
    "error",
    () => {
      target.dataset.imgState = "error";
    },
    { once: true }
  );
}

function renderPrimaryMeta(entry) {
  const authorId = resolveAuthorId(entry);
  const authorEntry = authorId ? getAuthorById(authorId) : null;

  if (articleAuthorLink && articleReadTime) {
    articleAuthorLink.textContent = authorEntry?.name || entry.author;
    const resolvedAuthorId = authorEntry?.id || authorId || "";
    articleAuthorLink.href = resolvedAuthorId ? buildAuthorUrl(resolvedAuthorId) : "#";
    articleReadTime.textContent = formatReadingTime(entry.readTimeMinutes);
  } else if (metaPrimary) {
    metaPrimary.textContent = formatAuthorLine(entry);
  }

  if (!metaSeries || !articleSeriesLink) return;
  const seriesEntry = entry.series ? getSeriesById(entry.series) : null;
  if (!seriesEntry) {
    metaSeries.hidden = true;
    return;
  }

  articleSeriesLink.textContent = seriesEntry.title;
  articleSeriesLink.href = buildSeriesUrl(seriesEntry.id);
  metaSeries.hidden = false;
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
  link.addEventListener("click", () => {
    trackEvent("source_click", {
      articleId: article.id,
      file: source.file,
      label: source.label,
      context: "article-source-panel",
    });
  });
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

function formatDataValue(value, unit = "") {
  if (!Number.isFinite(value)) return "";
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function buildBarHighlight(block) {
  const list = document.createElement("ol");
  list.className = "data-highlight-list data-highlight-list--bar";

  const values = block.items.map((item) => Number(item.value)).filter((value) => Number.isFinite(value));
  const maxValue = Math.max(...values, 1);

  block.items.forEach((item) => {
    const row = document.createElement("li");
    row.className = "data-highlight-row";

    const head = document.createElement("div");
    head.className = "data-highlight-row__head";

    const label = document.createElement("p");
    label.className = "data-highlight-row__label";
    label.textContent = item.label;

    const value = document.createElement("p");
    value.className = "data-highlight-row__value";
    value.textContent = formatDataValue(Number(item.value), block.unit);

    head.append(label, value);

    const bar = document.createElement("div");
    bar.className = "data-highlight-row__bar";

    const fill = document.createElement("span");
    fill.className = "data-highlight-row__fill";
    const ratio = Math.max(0, Math.min(1, Number(item.value) / maxValue));
    fill.style.width = `${Math.max(ratio * 100, 4)}%`;
    bar.appendChild(fill);

    row.append(head, bar);
    if (item.detail) {
      const detail = document.createElement("p");
      detail.className = "data-highlight-row__detail";
      detail.textContent = item.detail;
      row.appendChild(detail);
    }

    list.appendChild(row);
  });

  return list;
}

function buildTimelineHighlight(block) {
  const list = document.createElement("ol");
  list.className = "data-highlight-list data-highlight-list--timeline";

  block.items.forEach((item) => {
    const row = document.createElement("li");
    row.className = "data-highlight-row";

    const date = document.createElement("p");
    date.className = "data-highlight-row__date";
    date.textContent = item.date;

    const label = document.createElement("p");
    label.className = "data-highlight-row__label";
    label.textContent = item.label;

    row.append(date, label);
    if (item.detail) {
      const detail = document.createElement("p");
      detail.className = "data-highlight-row__detail";
      detail.textContent = item.detail;
      row.appendChild(detail);
    }
    list.appendChild(row);
  });

  return list;
}

function buildComparisonHighlight(block) {
  const grid = document.createElement("div");
  grid.className = "data-highlight-comparison";

  block.items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "data-highlight-comparison__card";

    const label = document.createElement("p");
    label.className = "data-highlight-row__label";
    label.textContent = item.label;

    const values = document.createElement("p");
    values.className = "data-highlight-comparison__values";
    const mainValue = formatDataValue(Number(item.value), block.unit);
    if (Number.isFinite(Number(item.valueSecondary))) {
      const secondary = formatDataValue(Number(item.valueSecondary), block.unit);
      values.textContent = `${mainValue} vs ${secondary}`;
    } else {
      values.textContent = mainValue;
    }

    card.append(label, values);
    if (item.detail) {
      const detail = document.createElement("p");
      detail.className = "data-highlight-row__detail";
      detail.textContent = item.detail;
      card.appendChild(detail);
    }
    grid.appendChild(card);
  });

  return grid;
}

function buildDataHighlightSection(block, blockIndex) {
  const section = document.createElement("section");
  section.className = "article-data-highlight";
  section.id = `donnees-${blockIndex + 1}`;

  const heading = document.createElement("h3");
  heading.textContent = block.title;
  section.appendChild(heading);

  if (block.type === "timeline") {
    section.appendChild(buildTimelineHighlight(block));
  } else if (block.type === "comparison") {
    section.appendChild(buildComparisonHighlight(block));
  } else {
    section.appendChild(buildBarHighlight(block));
  }

  if (block.note) {
    const note = document.createElement("p");
    note.className = "article-data-highlight__note";
    note.textContent = block.note;
    section.appendChild(note);
  }

  return section;
}

function renderDataHighlights() {
  const blocks = Array.isArray(article.dataHighlights) ? article.dataHighlights : [];
  if (!blocks.length) return;

  const wrapper = document.createElement("section");
  wrapper.className = "article-body__section article-body__section--data";
  wrapper.id = "reperes-chiffres";

  const heading = document.createElement("h2");
  heading.textContent = "Repères chiffrés";
  wrapper.appendChild(heading);

  const intro = document.createElement("p");
  intro.className = "article-data-highlights__intro";
  intro.textContent =
    "Visualisations synthétiques pour comparer les ordres de grandeur et la chronologie de l'enquête.";
  wrapper.appendChild(intro);

  blocks.forEach((block, index) => {
    wrapper.appendChild(buildDataHighlightSection(block, index));
  });

  articleBody?.appendChild(wrapper);

  const tocItem = document.createElement("li");
  const tocLink = document.createElement("a");
  tocLink.href = "#reperes-chiffres";
  tocLink.textContent = "Repères chiffrés";
  tocLink.addEventListener("click", () => {
    trackEvent("toc_click", {
      articleId: article.id,
      sectionId: "reperes-chiffres",
    });
  });
  tocItem.appendChild(tocLink);
  articleTocList?.appendChild(tocItem);
  tocEntries.push({ section: wrapper, link: tocLink });
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
    tocLink.addEventListener("click", () => {
      trackEvent("toc_click", {
        articleId: article.id,
        sectionId,
      });
    });
    tocItem.appendChild(tocLink);
    articleTocList.appendChild(tocItem);
    tocEntries.push({ section: articleSection, link: tocLink });
  });

  renderDataHighlights();
  articleToc.hidden = tocEntries.length < 2;
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

function setPaginationItem(linkElement, labelElement, titleElement, target, fallbackLabel) {
  if (!linkElement || !labelElement || !titleElement) return;

  labelElement.textContent = fallbackLabel;

  if (!target) {
    linkElement.classList.add("is-empty");
    linkElement.removeAttribute("href");
    linkElement.setAttribute("aria-disabled", "true");
    titleElement.textContent = `Aucun ${fallbackLabel.toLowerCase()}`;
    return;
  }

  linkElement.classList.remove("is-empty");
  linkElement.href = buildArticleUrl(target.id);
  linkElement.removeAttribute("aria-disabled");
  titleElement.textContent = target.title;
}

function renderPrevNextNavigation() {
  if (!articlePagination) return;

  const { previous, next } = getPrevNextArticles(article.id);
  if (!previous && !next) {
    articlePagination.remove();
    return;
  }

  setPaginationItem(articlePrevLink, articlePrevLabel, articlePrevTitle, previous, "Article plus récent");
  setPaginationItem(articleNextLink, articleNextLabel, articleNextTitle, next, "Article plus ancien");
  articlePagination.hidden = false;
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

function trackReadMilestones(progress) {
  READ_MILESTONES.forEach((milestone) => {
    if (progress * 100 < milestone || reachedMilestones.has(milestone)) return;
    reachedMilestones.add(milestone);
    trackEvent("read_milestone", {
      articleId: article.id,
      milestone,
    });
  });
}

function updateReadingProgress() {
  if (!readingProgressBar || !articlePage) return;
  const articleTop = articlePage.offsetTop;
  const articleHeight = articlePage.offsetHeight;
  const maxScrollable = Math.max(articleHeight - window.innerHeight, 1);
  const progress = Math.min(Math.max((window.scrollY - articleTop) / maxScrollable, 0), 1);
  readingProgressBar.style.transform = `scaleX(${progress})`;
  trackReadMilestones(progress);
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

function getCurrentReadingContext() {
  if (!tocEntries.length) return article.title;
  const threshold = getStickyOffset() + 32;
  let activeSection = tocEntries[0]?.section ?? null;

  tocEntries.forEach((entry) => {
    if (entry.section.getBoundingClientRect().top - threshold <= 0) {
      activeSection = entry.section;
    }
  });

  return activeSection?.querySelector("h2, h3")?.textContent?.trim() || article.title;
}

function getSelectionSnippet() {
  const selectedText = window.getSelection?.()?.toString().trim() || "";
  if (!selectedText) return "";
  return selectedText.slice(0, 260);
}

function buildReportErrorMailto() {
  const sectionContext = getCurrentReadingContext();
  const selectedSnippet = getSelectionSnippet();
  const subject = encodeURIComponent(`[Mistral] Signalement d'erreur - ${article.title}`);
  const body = encodeURIComponent(
    [
      "Bonjour la rédaction,",
      "",
      "Je souhaite signaler une possible erreur dans l'article suivant:",
      resolveArticleShareUrl(),
      "",
      `Rubrique: ${primaryTag}`,
      `Section concernée: ${sectionContext}`,
      selectedSnippet ? `Extrait sélectionné: "${selectedSnippet}"` : "Extrait sélectionné: (aucun)",
      "",
      "Commentaire:",
      "",
    ].join("\n")
  );

  return `mailto:redaction@mistral-media.fr?subject=${subject}&body=${body}`;
}

function bindReportErrorButton() {
  if (!articleReportErrorButton) return;

  articleReportErrorButton.addEventListener("click", () => {
    const sectionContext = getCurrentReadingContext();
    trackEvent("report_error_click", {
      articleId: article.id,
      section: sectionContext,
      category: primaryTag,
    });
    window.location.href = buildReportErrorMailto();
  });
}

function setMetaTag(selector, content) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.setAttribute("content", content);
}

function upsertMetaTagByProperty(property, content) {
  let element = document.querySelector(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertMetaTagByName(name, content) {
  let element = document.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
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

function estimateArticleWordCount() {
  const sections = article.sections?.length ? article.sections : buildFallbackSections(article);
  const content = sections
    .flatMap((section) => section.paragraphs || [])
    .join(" ")
    .trim();
  if (!content) return undefined;
  return content.split(/\s+/).length;
}

function cleanUndefinedValues(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanUndefinedValues(entry))
      .filter((entry) => entry !== undefined && entry !== null && entry !== "");
  }

  if (value && typeof value === "object") {
    const cleaned = {};
    Object.entries(value).forEach(([key, entry]) => {
      const normalized = cleanUndefinedValues(entry);
      if (normalized === undefined || normalized === null || normalized === "") return;
      if (Array.isArray(normalized) && normalized.length === 0) return;
      cleaned[key] = normalized;
    });
    return cleaned;
  }

  return value;
}

function updateStructuredData() {
  if (!articleJsonLd) return;

  const authorId = resolveAuthorId(article);
  const authorEntry = authorId ? getAuthorById(authorId) : null;
  const canonicalUrl = resolveArticleShareUrl();
  const imageUrl = buildOptimizedImageUrl(article.ogImage || article.image, 1200, 78);
  const publisherLogo = new URL("./logo_mistral.png", window.location.href).toString();

  const payload = cleanUndefinedValues({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    headline: article.seoTitle || article.title,
    alternativeHeadline: article.seoTitle && article.seoTitle !== article.title ? article.title : undefined,
    description: article.seoDescription || article.excerpt,
    image: [imageUrl],
    datePublished: new Date(article.date).toISOString(),
    dateModified: new Date(article.updatedDate || article.date).toISOString(),
    articleSection: primaryTag,
    keywords: article.tags?.join(", "),
    wordCount: estimateArticleWordCount(),
    inLanguage: "fr-FR",
    author: {
      "@type": "Person",
      name: authorEntry?.name || article.author,
      url: authorEntry ? new URL(buildAuthorUrl(authorEntry.id), window.location.href).toString() : undefined,
    },
    publisher: {
      "@type": "Organization",
      name: "Mistral",
      logo: {
        "@type": "ImageObject",
        url: publisherLogo,
      },
    },
    about: article.tags?.map((tag) => ({
      "@type": "Thing",
      name: tag,
    })),
  });

  articleJsonLd.textContent = JSON.stringify(payload);
}

function getArticleSharePayload() {
  return {
    title: article.socialTitle || article.seoTitle || article.title,
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
      trackEvent("share_click", {
        articleId: article.id,
        scope: "article",
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
      articleId: article.id,
      scope: "article",
      via: "clipboard",
    });
    return;
  }

  const subject = encodeURIComponent(payload.title || "Partager");
  const body = encodeURIComponent(`${payload.text || ""}\n${payload.url}`.trim());
  trackEvent("share_click", {
    articleId: article.id,
    scope: "article",
    via: "mailto",
  });
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
  const canonicalUrl = resolveArticleShareUrl();
  const description = article.seoDescription || article.excerpt;
  const socialTitle = shortSocialTitle(article.socialTitle || article.seoTitle || article.title);
  const previewImage = buildOptimizedImageUrl(article.ogImage || article.image, 1200, 78);

  setMetaTag('meta[name="description"]', description);
  setMetaTag('meta[property="og:title"]', `${socialTitle} | Mistral`);
  setMetaTag('meta[property="og:description"]', description);
  setMetaTag('meta[property="og:image"]', previewImage);
  upsertMetaTagByProperty("og:image:alt", article.heroImageAlt || article.title);
  setMetaTag('meta[property="og:url"]', canonicalUrl);
  setMetaTag('meta[name="twitter:title"]', `${socialTitle} | Mistral`);
  setMetaTag('meta[name="twitter:description"]', description);
  setMetaTag('meta[name="twitter:image"]', previewImage);
  upsertMetaTagByName("twitter:image:alt", article.heroImageAlt || article.title);
  upsertMetaTagByProperty("article:published_time", new Date(article.date).toISOString());
  upsertMetaTagByProperty(
    "article:modified_time",
    new Date(article.updatedDate || article.date).toISOString()
  );
  upsertMetaTagByProperty("article:section", primaryTag);
  upsertMetaTagByProperty("article:author", article.author);
  upsertMetaTagByProperty("article:tag", article.tags.join(", "));

  const canonical = document.querySelector("#canonical-link");
  if (canonical) canonical.setAttribute("href", canonicalUrl);
}

normalizeArticleUrl();

document.title = `${article.seoTitle || article.title} | Mistral`;
title.textContent = article.title;
excerpt.textContent = article.excerpt;
renderPrimaryMeta(article);
metaSecondary.textContent = formatPublishedUpdated(article);
image.src = buildOptimizedImageUrl(article.image, 960, 72);
image.srcset = buildOptimizedImageSrcSet(article.image, [480, 720, 960, 1200, 1600], 74);
image.sizes = "(max-width: 980px) 100vw, 920px";
image.alt = article.heroImageAlt || article.title;
markImageLoading(image, { eager: true });
caption.textContent = article.imageCredit
  ? `${article.caption} · ${article.imageCredit}`
  : article.caption;
breadcrumbCategoryLink.href = buildCategoryUrl(primaryTag);
breadcrumbCategoryLink.textContent = primaryTag;
breadcrumbCurrent.textContent = article.title;
setupActiveCategoryNav();
updateSocialMeta();
updateStructuredData();
renderArticleBody();
renderSources();
renderRevisionHistory();
renderRelatedArticles();
renderPrevNextNavigation();
setupReadingPreferences();
syncMobileReadingBar();
bindShareButtons();
bindReportErrorButton();

trackEvent("article_view", {
  articleId: article.id,
  category: primaryTag,
  readTimeMinutes: article.readTimeMinutes,
  tags: article.tags,
});

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

mobileReadingToc?.addEventListener("click", () => {
  trackEvent("toc_click", {
    articleId: article.id,
    sectionId: "article-toc",
    source: "mobile-bar",
  });
});

mobileReadingSources?.addEventListener("click", () => {
  trackEvent("source_panel_open", {
    articleId: article.id,
    source: "mobile-bar",
  });
});

articleBody?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest("a");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (!href.includes("category.html")) return;
  trackEvent("context_link_click", {
    articleId: article.id,
    href,
  });
});

relatedArticlesList?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest("a.related-article");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  trackEvent("related_article_click", {
    articleId: article.id,
    href,
  });
});

window.addEventListener("scroll", syncScrollUI, { passive: true });
window.addEventListener("resize", syncScrollUI);
syncScrollUI();
