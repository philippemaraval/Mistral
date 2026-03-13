const NEWSLETTER_STORAGE_KEY = "mistral.newsletter.pending";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readStoredEmail() {
  try {
    const raw = localStorage.getItem(NEWSLETTER_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return typeof parsed.email === "string" ? parsed.email : "";
  } catch {
    return "";
  }
}

function writeStoredEmail(email) {
  try {
    localStorage.setItem(
      NEWSLETTER_STORAGE_KEY,
      JSON.stringify({
        email,
        at: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage issues.
  }
}

function bindNewsletterForm(form) {
  const emailInput = form.querySelector("[data-newsletter-email]");
  const consentInput = form.querySelector("[data-newsletter-consent]");
  const feedback = form.querySelector("[data-newsletter-feedback]");
  if (!emailInput || !consentInput || !feedback) return;

  const storedEmail = readStoredEmail();
  if (!emailInput.value && storedEmail) {
    emailInput.value = storedEmail;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();

    if (!isValidEmail(email)) {
      feedback.textContent = "Adresse e-mail invalide.";
      feedback.classList.add("is-error");
      feedback.classList.remove("is-success");
      return;
    }

    if (!consentInput.checked) {
      feedback.textContent = "Merci de cocher le consentement pour finaliser l'inscription.";
      feedback.classList.add("is-error");
      feedback.classList.remove("is-success");
      return;
    }

    writeStoredEmail(email);
    feedback.textContent =
      "Inscription enregistrée. Vérifie ta boîte mail pour confirmer l'abonnement (double opt-in).";
    feedback.classList.remove("is-error");
    feedback.classList.add("is-success");
    form.reset();
    emailInput.value = email;
  });
}

document.querySelectorAll("[data-newsletter-form]").forEach(bindNewsletterForm);
