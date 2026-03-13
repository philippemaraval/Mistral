import {
  articles,
  categories,
  weatherConfig,
  buildCategoryUrl,
} from "./articles-data.js";

const mapContainer = document.querySelector("#map-container");

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_LABELS = {
  sunny: "Ensoleillé",
  cloudy: "Nuageux",
  storm: "Orageux",
  windy: "Venteux",
  rainy: "Pluvieux",
};

function getIcon(status) {
  switch (status) {
    case "sunny":
      return `
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <g fill="none" stroke="#9fbcde" stroke-width="1.5" stroke-linecap="round">
            <circle cx="20" cy="20" r="6.5"></circle>
            <path d="M20 6.5v4.5M20 29v4.5M6.5 20H11M29 20h4.5M10.4 10.4l3.3 3.3M26.3 26.3l3.3 3.3M29.6 10.4l-3.3 3.3M13.7 26.3l-3.3 3.3"></path>
          </g>
        </svg>
      `;
    case "storm":
      return `
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <g fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 24.5h17c2.8 0 5-2.1 5-4.8s-2.2-4.9-5-4.9c-.5 0-1 .1-1.5.2a7.7 7.7 0 0 0-15.3 1.7A4.8 4.8 0 0 0 11 24.5Z"></path>
            <path d="m19.5 24.7-3.2 6.4h4.3l-2 5.8 6.2-8.2H21l2.1-4z" stroke="#9fbcde"></path>
          </g>
        </svg>
      `;
    case "windy":
      return `
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <g fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round">
            <path d="M7 14.5h16.8c2 0 3.7-1.6 3.7-3.6s-1.7-3.7-3.7-3.7c-1.7 0-3.1 1.2-3.6 2.8"></path>
            <path d="M5.5 20h24c2.1 0 3.8 1.7 3.8 3.8s-1.7 3.7-3.8 3.7c-1.5 0-2.9-.9-3.5-2.2"></path>
            <path d="M8.5 26.5h15.2"></path>
          </g>
        </svg>
      `;
    case "rainy":
      return `
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <g fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 22.5h17c2.8 0 5-2.1 5-4.8s-2.2-4.9-5-4.9c-.5 0-1 .1-1.5.2a7.7 7.7 0 0 0-15.3 1.7A4.8 4.8 0 0 0 11 22.5Z"></path>
            <path d="M15.2 25.7v4.1M20 27.1v4.1M24.8 25.7v4.1"></path>
          </g>
        </svg>
      `;
    default:
      return `
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <g fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 24.5h17c2.8 0 5-2.1 5-4.8s-2.2-4.9-5-4.9c-.5 0-1 .1-1.5.2a7.7 7.7 0 0 0-15.3 1.7A4.8 4.8 0 0 0 11 24.5Z"></path>
          </g>
        </svg>
      `;
  }
}

function getArticleDate(article) {
  const published = new Date(article.date);
  const updated = article.updatedDate ? new Date(article.updatedDate) : null;
  if (updated && !Number.isNaN(updated.getTime()) && updated > published) return updated;
  return published;
}

function getLatestArticleByCategory(category) {
  return (
    articles
      .filter((article) => article.tags.includes(category))
      .sort((a, b) => getArticleDate(b).getTime() - getArticleDate(a).getTime())[0] ?? null
  );
}

function resolveWeatherStatus(baseStatus, latestArticle) {
  if (!latestArticle) return "cloudy";

  const ageMs = Date.now() - getArticleDate(latestArticle).getTime();
  if (ageMs < DAY_MS) return "sunny";
  if (ageMs > 3 * DAY_MS) return "cloudy";
  return baseStatus;
}

function buildBaseMap() {
  return `
    <svg class="weather-map__base" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="0.5" y="0.5" width="99" height="99" fill="#ffffff"></rect>
      <path d="M10 18 24 12 35 16 48 12 61 18 74 16 88 25 85 38 89 49 84 63 73 70 66 82 51 87 37 84 23 87 12 77 8 66 11 52 6 40 9 29Z" fill="none" stroke="#f5f5f5" stroke-width="0.5"></path>
      <path d="M24 12 23 24 35 16 37 30 48 12 50 26 61 18 63 31 74 16 73 29 88 25" fill="none" stroke="#f5f5f5" stroke-width="0.5"></path>
      <path d="M9 29 23 24 22 39 37 30 36 45 50 26 50 43 63 31 62 47 73 29 72 44 85 38" fill="none" stroke="#f5f5f5" stroke-width="0.5"></path>
      <path d="M6 40 22 39 21 55 36 45 35 60 50 43 49 58 62 47 62 63 72 44 71 58 89 49" fill="none" stroke="#f5f5f5" stroke-width="0.5"></path>
      <path d="M11 52 21 55 19 68 35 60 34 73 49 58 49 73 62 63 61 76 71 58 73 70" fill="none" stroke="#f5f5f5" stroke-width="0.5"></path>
      <path d="M8 66 19 68 23 87M34 73 37 84M49 73 51 87M61 76 66 82" fill="none" stroke="#f5f5f5" stroke-width="0.5"></path>
    </svg>
  `;
}

function buildWindOverlay() {
  return `
    <svg class="weather-map__wind" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline class="wind-line wind-line--a" points="-6 18 10 24 19 20 33 27 45 23 59 29 72 25 89 34 104 30"></polyline>
      <polyline class="wind-line wind-line--b" points="-7 37 8 42 18 38 34 46 47 41 61 49 74 45 90 53 104 49"></polyline>
      <polyline class="wind-line wind-line--c" points="-5 58 11 64 22 59 37 67 49 62 64 71 76 66 91 75 106 70"></polyline>
      <polyline class="wind-line wind-line--d" points="-6 77 9 83 20 79 34 87 45 82 59 90 71 85 87 94 102 89"></polyline>
    </svg>
  `;
}

function createPoint(category, config, latestArticle, status) {
  const link = document.createElement("a");
  link.className = `weather-point weather-point--${status}`;
  link.href = buildCategoryUrl(category);
  link.style.left = `${config.coords.x}%`;
  link.style.top = `${config.coords.y}%`;

  const statusLabel = STATUS_LABELS[status] ?? "Variable";
  const latestTitle = latestArticle?.title ?? "Aucun article récent";
  link.setAttribute(
    "aria-label",
    `${category} (${statusLabel}) - ${latestTitle}`
  );

  const icon = document.createElement("span");
  icon.className = "weather-point__icon";
  icon.innerHTML = getIcon(status);

  const anchor = document.createElement("span");
  anchor.className = "weather-point__anchor";
  anchor.textContent = config.anchor;

  const tooltip = document.createElement("span");
  tooltip.className = "weather-tooltip";

  const tooltipCategory = document.createElement("strong");
  tooltipCategory.textContent = category;

  const tooltipStatus = document.createElement("span");
  tooltipStatus.textContent = statusLabel;

  const tooltipTitle = document.createElement("span");
  tooltipTitle.textContent = latestTitle;

  tooltip.append(tooltipCategory, tooltipStatus, tooltipTitle);
  link.append(icon, anchor, tooltip);
  return link;
}

function renderMapSkeleton() {
  mapContainer.innerHTML = `
    <div class="weather-map__canvas">
      ${buildBaseMap()}
      ${buildWindOverlay()}
      <div class="weather-map__points" id="weather-map-points"></div>
    </div>
  `;
}

function getConfigForCategory(category) {
  return weatherConfig[category] ?? {
    coords: { x: 50, y: 50 },
    anchor: category,
    status: "cloudy",
  };
}

function updateWeather() {
  const pointsRoot = document.querySelector("#weather-map-points");
  if (!pointsRoot) return;
  pointsRoot.innerHTML = "";

  categories.forEach((category) => {
    const config = getConfigForCategory(category);
    const latestArticle = getLatestArticleByCategory(category);
    const status = resolveWeatherStatus(config.status, latestArticle);
    pointsRoot.appendChild(createPoint(category, config, latestArticle, status));
  });
}

if (mapContainer) {
  renderMapSkeleton();
  updateWeather();
  window.setInterval(updateWeather, 60 * 60 * 1000);
}
