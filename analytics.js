const ANALYTICS_STORAGE_KEY = "mistral.analytics.events.v1";
const ANALYTICS_MAX_EVENTS = 1200;

function readStoredEvents() {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistEvents(events) {
  try {
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Ignore storage errors.
  }
}

export function trackEvent(type, payload = {}) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  if (typeof type !== "string" || type.trim().length === 0) return;

  const event = {
    type: type.trim(),
    payload,
    path: `${window.location.pathname}${window.location.search}`,
    timestamp: new Date().toISOString(),
  };

  const events = readStoredEvents();
  events.push(event);
  if (events.length > ANALYTICS_MAX_EVENTS) {
    events.splice(0, events.length - ANALYTICS_MAX_EVENTS);
  }
  persistEvents(events);
}

export function getAnalyticsEvents() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  return readStoredEvents();
}

export function clearAnalyticsEvents() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(ANALYTICS_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
