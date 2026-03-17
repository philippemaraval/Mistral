import "./pwa.js";
import {
  setupNavigation,
  createBackToTopVisibilityUpdater,
  bindBackToTopButton,
} from "./ui-utils.js";

const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const backToTopButton = document.querySelector("#back-to-top");
const updateBackToTopVisibility = createBackToTopVisibilityUpdater(backToTopButton);

setupNavigation(navToggle, nav);
bindBackToTopButton(backToTopButton);

window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();
