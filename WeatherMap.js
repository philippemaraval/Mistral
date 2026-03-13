import {
  articles,
  categories,
  weatherConfig,
  buildCategoryUrl,
} from "./articles-data.js";

const mapContainer = document.querySelector("#map-container");
const leaflet = window.L;

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_LABELS = {
  sunny: "Ensoleillé",
  cloudy: "Nuageux",
  storm: "Orageux",
  windy: "Venteux",
  rainy: "Pluvieux",
};

const MARSEILLE_VIEW_BBOX = {
  west: 5.206,
  south: 43.195,
  east: 5.505,
  north: 43.398,
};

const MARSEILLE_MAX_BOUNDS = {
  west: 5.12,
  south: 43.145,
  east: 5.585,
  north: 43.445,
};

let map;
let markerLayer;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
    <div class="weather-map__base" aria-hidden="true">
      <div class="weather-map__leaflet" id="weather-leaflet-map"></div>
    </div>
  `;
}

function buildWindOverlay() {
  return `
    <svg class="weather-map__wind" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="mistral-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.24"></feGaussianBlur>
        </filter>
        <linearGradient id="mistral-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#d4e4f4" stop-opacity="0"></stop>
          <stop offset="16%" stop-color="#b6cee7" stop-opacity="0.26"></stop>
          <stop offset="47%" stop-color="#9fbcde" stop-opacity="0.54"></stop>
          <stop offset="78%" stop-color="#b6cee7" stop-opacity="0.24"></stop>
          <stop offset="100%" stop-color="#d4e4f4" stop-opacity="0"></stop>
        </linearGradient>
      </defs>

      <g class="wind-layer wind-layer--soft" filter="url(#mistral-blur)">
        <path class="wind-stream wind-stream--soft wind-stream--a" stroke="url(#mistral-grad)" d="M-12 14 C 4 20, 17 18, 33 23 C 49 28, 63 24, 80 30 C 93 35, 104 32, 112 35"></path>
        <path class="wind-stream wind-stream--soft wind-stream--b" stroke="url(#mistral-grad)" d="M-10 31 C 7 37, 20 35, 36 41 C 51 47, 66 43, 81 50 C 95 56, 106 53, 114 57"></path>
        <path class="wind-stream wind-stream--soft wind-stream--c" stroke="url(#mistral-grad)" d="M-11 51 C 6 57, 18 54, 35 60 C 51 66, 66 62, 82 69 C 96 74, 106 72, 114 75"></path>
        <path class="wind-stream wind-stream--soft wind-stream--d" stroke="url(#mistral-grad)" d="M-12 70 C 4 76, 17 73, 33 79 C 49 84, 63 82, 79 88 C 92 92, 103 91, 112 93"></path>
      </g>

      <g class="wind-layer wind-layer--core">
        <path class="wind-stream wind-stream--core wind-stream--a" stroke="url(#mistral-grad)" d="M-12 14 C 4 20, 17 18, 33 23 C 49 28, 63 24, 80 30 C 93 35, 104 32, 112 35"></path>
        <path class="wind-stream wind-stream--core wind-stream--b" stroke="url(#mistral-grad)" d="M-10 31 C 7 37, 20 35, 36 41 C 51 47, 66 43, 81 50 C 95 56, 106 53, 114 57"></path>
        <path class="wind-stream wind-stream--core wind-stream--c" stroke="url(#mistral-grad)" d="M-11 51 C 6 57, 18 54, 35 60 C 51 66, 66 62, 82 69 C 96 74, 106 72, 114 75"></path>
        <path class="wind-stream wind-stream--core wind-stream--d" stroke="url(#mistral-grad)" d="M-12 70 C 4 76, 17 73, 33 79 C 49 84, 63 82, 79 88 C 92 92, 103 91, 112 93"></path>
      </g>

      <g class="wind-layer wind-layer--threads">
        <path class="wind-thread wind-thread--1" d="M-8 22 C 9 27, 24 25, 38 30 C 53 35, 67 33, 84 39 C 96 43, 106 42, 112 45"></path>
        <path class="wind-thread wind-thread--2" d="M-9 43 C 7 48, 20 46, 37 51 C 52 56, 67 54, 83 60 C 96 65, 105 63, 112 66"></path>
        <path class="wind-thread wind-thread--3" d="M-9 63 C 8 68, 22 66, 38 72 C 53 77, 68 74, 84 80 C 97 85, 105 84, 112 86"></path>
      </g>

      <g class="wind-gusts">
        <circle class="wind-gust" cx="-7" cy="18" r="0.85">
          <animate attributeName="cx" from="-7" to="107" dur="8.8s" repeatCount="indefinite"></animate>
          <animate attributeName="cy" values="18;19.2;18.3;18" dur="8.8s" repeatCount="indefinite"></animate>
          <animate attributeName="opacity" values="0;0.42;0.1;0" dur="8.8s" repeatCount="indefinite"></animate>
        </circle>
        <circle class="wind-gust" cx="-8" cy="38" r="0.75">
          <animate attributeName="cx" from="-8" to="108" dur="7.9s" repeatCount="indefinite"></animate>
          <animate attributeName="cy" values="38;39.4;38.1;38" dur="7.9s" repeatCount="indefinite"></animate>
          <animate attributeName="opacity" values="0;0.4;0.12;0" dur="7.9s" repeatCount="indefinite"></animate>
        </circle>
        <circle class="wind-gust" cx="-9" cy="58" r="0.92">
          <animate attributeName="cx" from="-9" to="109" dur="10.2s" repeatCount="indefinite"></animate>
          <animate attributeName="cy" values="58;59.5;58.2;58" dur="10.2s" repeatCount="indefinite"></animate>
          <animate attributeName="opacity" values="0;0.38;0.1;0" dur="10.2s" repeatCount="indefinite"></animate>
        </circle>
        <circle class="wind-gust" cx="-10" cy="79" r="0.82">
          <animate attributeName="cx" from="-10" to="110" dur="9.4s" repeatCount="indefinite"></animate>
          <animate attributeName="cy" values="79;80.1;79.2;79" dur="9.4s" repeatCount="indefinite"></animate>
          <animate attributeName="opacity" values="0;0.35;0.08;0" dur="9.4s" repeatCount="indefinite"></animate>
        </circle>
      </g>
    </svg>
  `;
}

function renderMapSkeleton() {
  mapContainer.innerHTML = `
    <div class="weather-map__canvas">
      ${buildBaseMap()}
      ${buildWindOverlay()}
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

function coordsToLatLng(coords) {
  const lng =
    MARSEILLE_VIEW_BBOX.west +
    (coords.x / 100) * (MARSEILLE_VIEW_BBOX.east - MARSEILLE_VIEW_BBOX.west);
  const lat =
    MARSEILLE_VIEW_BBOX.north -
    (coords.y / 100) * (MARSEILLE_VIEW_BBOX.north - MARSEILLE_VIEW_BBOX.south);
  return [lat, lng];
}

function getMarkerLatLng(config) {
  if (
    config.latLng &&
    typeof config.latLng.lat === "number" &&
    typeof config.latLng.lng === "number"
  ) {
    return [config.latLng.lat, config.latLng.lng];
  }
  return coordsToLatLng(config.coords);
}

function buildPointHtml(category, latestTitle, status) {
  return `
    <span class="weather-point weather-point--${status}" aria-label="${escapeHtml(
    category
  )}: ${escapeHtml(latestTitle)}">
      <span class="weather-point__icon">${getIcon(status)}</span>
      <span class="weather-point__anchor">${escapeHtml(category)}</span>
    </span>
  `;
}

function buildPopupHtml(category, statusLabel, latestTitle) {
  return `
    <a class="weather-popup-link" href="${buildCategoryUrl(category)}" aria-label="Voir la catégorie ${escapeHtml(
    category
  )}">
      <strong>${escapeHtml(category)}</strong>
      <span>${escapeHtml(statusLabel)}</span>
      <span>${escapeHtml(latestTitle)}</span>
    </a>
  `;
}

function initMap() {
  if (!leaflet || map) return;

  const maxBounds = leaflet.latLngBounds(
    [MARSEILLE_MAX_BOUNDS.south, MARSEILLE_MAX_BOUNDS.west],
    [MARSEILLE_MAX_BOUNDS.north, MARSEILLE_MAX_BOUNDS.east]
  );

  map = leaflet.map("weather-leaflet-map", {
    center: [43.2965, 5.3698],
    zoom: 12.2,
    zoomControl: true,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
    scrollWheelZoom: "center",
    wheelDebounceTime: 10,
    wheelPxPerZoomLevel: 180,
    minZoom: 11,
    maxZoom: 16,
    maxBounds,
    maxBoundsViscosity: 1,
    zoomSnap: 0,
    zoomDelta: 0.1,
  });

  leaflet
    .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      noWrap: true,
      opacity: 0.9,
    })
    .addTo(map);

  markerLayer = leaflet.layerGroup().addTo(map);
}

function clearMarkers() {
  markerLayer?.clearLayers();
}

function createMarker(category, config, latestArticle, status) {
  const statusLabel = STATUS_LABELS[status] ?? "Variable";
  const latestTitle = latestArticle?.title ?? "Aucun article récent";

  const marker = leaflet.marker(getMarkerLatLng(config), {
    icon: leaflet.divIcon({
      className: "weather-marker",
      html: buildPointHtml(category, latestTitle, status),
      iconSize: [136, 92],
      iconAnchor: [68, 38],
      popupAnchor: [0, -22],
    }),
    keyboard: true,
    title: `${category} (${config.anchor}) - ${latestTitle}`,
  });

  marker.bindPopup(buildPopupHtml(category, statusLabel, latestTitle), {
    className: "weather-tooltip-popup",
    autoPan: false,
    closeButton: false,
    closeOnClick: false,
  });

  marker.on("mouseover", () => marker.openPopup());
  marker.on("mouseout", () => marker.closePopup());
  marker.on("click", () => {
    window.location.href = buildCategoryUrl(category);
  });

  return marker;
}

function updateWeather() {
  if (!map || !markerLayer) return;

  clearMarkers();
  categories.forEach((category) => {
    const config = getConfigForCategory(category);
    const latestArticle = getLatestArticleByCategory(category);
    const status = resolveWeatherStatus(config.status, latestArticle);
    markerLayer.addLayer(createMarker(category, config, latestArticle, status));
  });
}

if (mapContainer) {
  renderMapSkeleton();
  initMap();
  updateWeather();
  window.setInterval(updateWeather, 60 * 60 * 1000);
}
