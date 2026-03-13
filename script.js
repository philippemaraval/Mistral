const articleData = [
  {
    title: "Les dockers racontent l'autre visage du port autonome",
    excerpt:
      "Entre automatisation et fatigue chronique, les travailleurs décrivent une réorganisation qui avance plus vite que la concertation.",
    caption: "Hangar J1, entretien croisé mené sur trois semaines.",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Transports : les retards se concentrent dans le nord de la ville",
    excerpt:
      "Nos relevés montrent une fracture persistante entre promesses de réseau et réalité des temps de trajet.",
    caption: "Analyse à partir d'horaires publics et de témoignages d'usagers.",
    image:
      "https://images.unsplash.com/photo-1470004914212-05527e49370b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "La Méditerranée comme argument politique permanent",
    excerpt:
      "Quand les élus invoquent l'exception marseillaise, que disent vraiment les arbitrages budgétaires ?",
    caption: "Chronique signée rédaction Mistral.",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Ecoles rénovées : les marchés publics passés au crible",
    excerpt:
      "Un relevé ligne par ligne des appels d'offres fait ressortir des écarts de coûts non expliqués.",
    caption: "Documents consolidés sur douze établissements.",
    image:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Les arrêtés municipaux réclamés par les riverains",
    excerpt:
      "Mistral publie les textes complets pour suivre ce qui a réellement été décidé autour des grands chantiers.",
    caption: "Téléchargements disponibles dans l'espace documents.",
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "A la Belle de Mai, une mémoire de quartier s'organise",
    excerpt:
      "Carnets, affiches et photos de façade composent une archive citoyenne face au récit officiel.",
    caption: "Rencontre dans un ancien atelier partagé.",
    image:
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=80",
  },
];

const grid = document.querySelector("#article-grid");
const template = document.querySelector("#article-card-template");
const indicator = document.querySelector("#loading-indicator");
const sentinel = document.querySelector("#scroll-sentinel");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const searchForm = document.querySelector(".search-bar");

let cursor = 0;
let isLoading = false;

function buildArticleUrl(article) {
  const params = new URLSearchParams({
    title: article.title,
    excerpt: article.excerpt,
    caption: article.caption,
    image: article.image,
  });
  return `./article.html?${params.toString()}`;
}

function buildCard(article) {
  const fragment = template.content.cloneNode(true);
  const image = fragment.querySelector(".article-card__image");
  const link = fragment.querySelector(".article-card__link");

  fragment.querySelector(".article-card__title").textContent = article.title;
  fragment.querySelector(".article-card__excerpt").textContent = article.excerpt;
  fragment.querySelector(".article-card__caption").textContent = article.caption;

  image.src = article.image;
  image.alt = article.title;
  link.href = buildArticleUrl(article);
  link.setAttribute("aria-label", `Lire l'article : ${article.title}`);

  return fragment;
}

function renderBatch(size = 6) {
  for (let i = 0; i < size; i += 1) {
    const article = articleData[(cursor + i) % articleData.length];
    grid.appendChild(buildCard(article));
  }
  cursor += size;
}

function showLoading(visible) {
  indicator.classList.toggle("is-visible", visible);
  indicator.setAttribute("aria-hidden", String(!visible));
}

function loadMore() {
  if (isLoading) return;
  isLoading = true;
  showLoading(true);

  window.setTimeout(() => {
    renderBatch(6);
    showLoading(false);
    isLoading = false;
  }, 380);
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadMore();
    });
  },
  { rootMargin: "420px 0px" }
);

observer.observe(sentinel);
renderBatch(6);

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
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
