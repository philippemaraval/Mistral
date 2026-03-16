# Workflow editorial Mistral

## Objectif

Permettre aux auteurs de publier sans modifier le code.

## Interface auteur

- URL: `/admin/`
- Creation d'article via formulaire
- Workflow: brouillon, relecture, publication

## Fichiers impactes automatiquement

- `content/articles/*.json`
- `content/site.json` (article a la une)

Le build regenere ensuite `articles-content.js`.

## Checklist de publication

1. Verifier l'ID article (`id`) unique et en minuscules avec tirets.
2. Verifier les champs obligatoires (titre, chapo, image, date, auteur, tags).
3. Ajouter les sources documentaires si necessaire (`documents/`).
4. Mettre a jour la date `updatedDate` lors de chaque correction.
5. Publier depuis le workflow editorial.

## Fallback manuel

Si `/admin` est indisponible:

1. Editer les fichiers JSON dans `content/articles/`.
2. Lancer `npm run build`.
3. Commit + push.
