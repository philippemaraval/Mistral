import "./pwa.js";
import { articles, getArticleById } from "./articles-data.js";
import { getAnalyticsEvents, clearAnalyticsEvents } from "./analytics.js";

const summary = document.querySelector("#dashboard-summary");
const topViews = document.querySelector("#dashboard-top-views");
const topSources = document.querySelector("#dashboard-top-sources");
const topShares = document.querySelector("#dashboard-top-shares");
const readDepth = document.querySelector("#dashboard-read-depth");
const topSearches = document.querySelector("#dashboard-top-searches");
const topWeather = document.querySelector("#dashboard-top-weather");
const clearButton = document.querySelector("#dashboard-clear");
const feedback = document.querySelector("#dashboard-feedback");

function countBy(items, keyGetter) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
}

function toSortedEntries(map, limit = 8) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function buildStatCard(label, value) {
  const card = document.createElement("article");
  card.className = "contact-card";

  const heading = document.createElement("h2");
  heading.textContent = label;

  const text = document.createElement("p");
  text.textContent = String(value);

  card.append(heading, text);
  return card;
}

function buildListItem(titleText, metaText) {
  const card = document.createElement("article");
  card.className = "related-article";

  const title = document.createElement("h3");
  title.className = "related-article__title";
  title.textContent = titleText;

  const meta = document.createElement("p");
  meta.className = "related-article__meta";
  meta.textContent = metaText;

  card.append(title, meta);
  return card;
}

function renderList(container, entries, resolveLabel, resolveMeta, emptyLabel) {
  if (!container) return;
  container.innerHTML = "";

  if (entries.length === 0) {
    container.appendChild(buildListItem("Aucune donnée", emptyLabel));
    return;
  }

  entries.forEach((entry) => {
    container.appendChild(buildListItem(resolveLabel(entry), resolveMeta(entry)));
  });
}

function renderDashboard() {
  const events = getAnalyticsEvents();

  const viewEvents = events.filter((event) => event.type === "article_view");
  const sourceEvents = events.filter((event) => event.type === "source_click");
  const shareEvents = events.filter((event) => event.type === "share_click");
  const readMilestones = events.filter((event) => event.type === "read_milestone");
  const searchEvents = events.filter((event) => event.type === "search_apply");
  const weatherEvents = events.filter(
    (event) =>
      event.type === "weather_focus_category" ||
      event.type === "weather_popup_action" ||
      event.type === "weather_hub_link_click" ||
      event.type === "weather_point_click"
  );
  const errorReports = events.filter((event) => event.type === "report_error_click");

  if (summary) {
    summary.innerHTML = "";
    summary.className = "dashboard-summary info-page__section info-page__section--grid";
    summary.append(
      buildStatCard("Événements captés", events.length),
      buildStatCard("Lectures d'articles", viewEvents.length),
      buildStatCard("Clics sources", sourceEvents.length),
      buildStatCard("Partages", shareEvents.length),
      buildStatCard("Milestones lecture", readMilestones.length),
      buildStatCard("Signalements", errorReports.length),
      buildStatCard("Recherches", searchEvents.length),
      buildStatCard("Articles trackés", articles.length)
    );
  }

  const viewsByArticle = toSortedEntries(
    countBy(viewEvents, (event) => event.payload?.articleId)
  );
  renderList(
    topViews,
    viewsByArticle,
    ([articleId]) => getArticleById(articleId)?.title || articleId,
    ([, count]) => `${count} vue(s)`,
    "Aucune lecture captée pour le moment."
  );

  const sourcesByFile = toSortedEntries(
    countBy(sourceEvents, (event) => event.payload?.file || event.payload?.label)
  );
  renderList(
    topSources,
    sourcesByFile,
    ([file]) => file,
    ([, count]) => `${count} clic(s) source`,
    "Aucun clic source capté pour le moment."
  );

  const sharesByArticle = toSortedEntries(
    countBy(shareEvents, (event) => event.payload?.articleId || event.payload?.scope || "site")
  );
  renderList(
    topShares,
    sharesByArticle,
    ([key]) => (getArticleById(key)?.title ? getArticleById(key).title : `Partage ${key}`),
    ([, count]) => `${count} partage(s)`,
    "Aucun partage capté pour le moment."
  );

  const deepReadEvents = readMilestones.filter(
    (event) => Number(event.payload?.milestone) >= 75 && event.payload?.articleId
  );
  const deepReadByArticle = toSortedEntries(
    countBy(deepReadEvents, (event) => event.payload?.articleId)
  );
  renderList(
    readDepth,
    deepReadByArticle,
    ([articleId]) => getArticleById(articleId)?.title || articleId,
    ([, count]) => `${count} session(s) avec lecture 75%+`,
    "Aucune lecture profonde captée pour le moment."
  );

  const searchesByQuery = toSortedEntries(
    countBy(searchEvents, (event) => {
      const query = String(event.payload?.query ?? "").trim();
      return query.length > 0 ? query.toLowerCase() : null;
    })
  );
  renderList(
    topSearches,
    searchesByQuery,
    ([query]) => `“${query}”`,
    ([, count]) => `${count} recherche(s)`,
    "Aucune recherche saisie captée pour le moment."
  );

  const weatherByCategory = toSortedEntries(
    countBy(weatherEvents, (event) => event.payload?.category)
  );
  renderList(
    topWeather,
    weatherByCategory,
    ([category]) => category,
    ([, count]) => `${count} interaction(s) météo`,
    "Aucune interaction météo captée pour le moment."
  );
}

clearButton?.addEventListener("click", () => {
  clearAnalyticsEvents();
  renderDashboard();
  if (feedback) {
    feedback.textContent = "Les données locales du dashboard ont été réinitialisées.";
    feedback.classList.remove("is-error");
    feedback.classList.add("is-success");
  }
});

renderDashboard();
