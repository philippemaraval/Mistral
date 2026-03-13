# Mistral

Homepage statique du media Mistral.

## Developpement local

Le projet est un site statique simple :

- `index.html`
- `styles.css`
- `script.js`
- `documents/`

Pour une preview locale :

```bash
python3 -m http.server 4173
```

## Build

Un build statique compatible Cloudflare Pages est fourni :

```bash
npm run build
```

La commande copie les fichiers du site dans `dist/`.

## Cloudflare Pages

Deux configurations fonctionnent :

### Option recommandee

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`

### Option sans build

- Framework preset: `None`
- Build command: laisser vide
- Build output directory: `/`

L'option `npm run build` est la plus robuste pour eviter les erreurs de configuration lors du deploy.
