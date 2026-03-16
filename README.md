# Mistral

Site statique du media Mistral avec workflow editorial via `/admin` (Decap CMS).

## Developpement local

Preview locale du site:

```bash
python3 -m http.server 4173
```

## Source editoriale

- Articles: `content/articles/*.json`
- Configuration homepage: `content/site.json`
- Documents sources telechargeables: `documents/`

`articles-content.js` est genere automatiquement depuis `content/` et alimente le front.

## Build

```bash
npm run build
```

Cette commande:
1. genere `articles-content.js` depuis `content/`
2. copie les fichiers dans `dist/`

## Cloudflare Pages

Configuration recommandee:

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`

## Espace redaction (`/admin`)

Le back-office est disponible dans `admin/` (Decap CMS).

Pour l'utiliser en production, il faut configurer une authentification GitHub pour Decap.

- backend configure dans [admin/config.yml](admin/config.yml):
  - repo: `philippemaraval/Mistral`
  - branch: `main`
  - publish mode: `editorial_workflow` (brouillon -> relecture -> publication)

Une fois l'auth configuree, les auteurs peuvent:
1. creer/editer un article depuis `/admin`
2. enregistrer un brouillon
3. envoyer en relecture
4. publier (merge vers `main`, deploy Cloudflare automatique)

Guide interne: [docs/editorial-workflow.md](docs/editorial-workflow.md)

## Publication quotidienne (mode manuel de secours)

Si le back-office est indisponible:
1. ajouter/editer un fichier dans `content/articles/`
2. ajuster `content/site.json` pour la une si necessaire
3. lancer `npm run build`
4. commit + push
