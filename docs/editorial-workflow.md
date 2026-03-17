# Workflow editorial Mistral

## Objectif

Permettre aux auteurs de publier sans modifier le code.

## Interface auteur

- URL: `/admin/`
- Creation d'article via formulaire
- Workflow: brouillon, relecture, publication
- Choix de la une via un selecteur d'articles
- Relations vers auteurs, series, documents et articles lies

## Fichiers impactes automatiquement

- `content/articles/*.json`
- `content/authors/*.json`
- `content/series/*.json`
- `content/documents/*.json`
- `content/site.json` (article a la une)

Le build regenere ensuite `articles-content.js`.

## Checklist de publication

1. Verifier l'ID article (`id`) unique et en minuscules avec tirets.
2. Renseigner les champs obligatoires (titre, chapo, image, alt, credit, auteur, tags, statut).
3. Verifier la coherence des dates (`date`, `updatedDate`, `publishAt`, `unpublishAt`).
4. Associer les sources via la collection `documents` plutot que du texte libre.
5. Completer les champs SEO (`seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl`) si necessaire.
6. Mettre a jour la date `updatedDate` lors de chaque correction.
7. Publier depuis le workflow editorial.

## Fallback manuel

Si `/admin` est indisponible:

1. Editer les fichiers JSON dans `content/articles/`.
2. Lancer `npm run build`.
3. Commit + push.
