import "./pwa.js";

const contactForm = document.querySelector("#contact-form");
const contactFeedback = document.querySelector("#contact-feedback");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const name = (formData.get("name") || "").toString().trim();
  const email = (formData.get("email") || "").toString().trim();
  const subject = (formData.get("subject") || "").toString().trim();
  const message = (formData.get("message") || "").toString().trim();

  if (!name || !isValidEmail(email) || !subject || !message) {
    contactFeedback.textContent = "Merci de remplir tous les champs avec des informations valides.";
    contactFeedback.classList.add("is-error");
    contactFeedback.classList.remove("is-success");
    return;
  }

  const mailtoSubject = encodeURIComponent(`[Mistral] ${subject}`);
  const body = encodeURIComponent(`Nom: ${name}\nEmail: ${email}\n\n${message}`);
  window.location.href = `mailto:redaction@mistral-media.fr?subject=${mailtoSubject}&body=${body}`;

  contactFeedback.textContent =
    "Ton client email va s'ouvrir avec le message pré-rempli. Merci pour ton signalement.";
  contactFeedback.classList.remove("is-error");
  contactFeedback.classList.add("is-success");
});
