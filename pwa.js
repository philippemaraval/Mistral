let hasRegistered = false;

export function registerPwa() {
  if (hasRegistered) return;
  hasRegistered = true;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("./sw.js", import.meta.url), { type: "module" })
      .catch(() => {
        // Ignore registration errors to avoid blocking page logic.
      });
  });
}

registerPwa();
