export function formatReadingTime(minutes) {
  return `${minutes} min de lecture`;
}

export function markImageLoading(target, options = {}) {
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

export function setMetaTag(selector, content) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.setAttribute("content", content);
}

export function setupNavigation(navToggle, nav) {
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
}

export function createBackToTopVisibilityUpdater(backToTopButton, threshold = 480) {
  return function updateBackToTopVisibility() {
    if (!backToTopButton) return;
    backToTopButton.classList.toggle("is-visible", window.scrollY > threshold);
  };
}

export function bindBackToTopButton(backToTopButton) {
  backToTopButton?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
