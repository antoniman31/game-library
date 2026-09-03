# Game Library

Bibliothèque de jeux vidéo personnelle (Xbox / Switch) : suivi de progression,
temps de jeu, prêts, statistiques. Application React + Vite, installable en PWA.

**➡️ https://antoniman31.github.io/game-library/**

## Configuration (indispensable au premier lancement)

L'application ne contient **aucune clé API**. Chacun saisit les siennes dans
l'onglet **⚙️** ; elles sont stockées **sur l'appareil** (stockage local du
navigateur) et ne quittent jamais celui-ci, hormis vers les services concernés.

| Service | Rôle | Obtenir une clé |
|---|---|---|
| RAWG | Jaquettes, Metacritic, genres, dates de sortie | https://rawg.io/apidocs |
| SteamGridDB | Jaquettes verticales format boîte | https://www.steamgriddb.com/profile/preferences/api |
| xbl.io | Import de la bibliothèque Xbox | https://xbl.io/console |

Wikipédia et Wikidata (titres français, descriptions, développeur/éditeur, dates
par plateforme) ne demandent aucune clé.

### Relais CORS

SteamGridDB et xbl.io refusent les appels directs depuis un navigateur. Un petit
relais Cloudflare Worker (dossier [`worker/`](worker/)) rétablit les en-têtes
CORS. Il **ne contient aucun secret** : la clé est transmise par le client à
chaque requête. Déploiement et procédure : [`worker/README.md`](worker/README.md).
Une fois déployé, coller son URL dans ⚙️ → « Relais CORS ».

Sans ce relais, tout le reste fonctionne : RAWG, Wikipédia, Wikidata.

## Données

Tout est stocké **en local** (`localStorage`) : rien n'est envoyé sur un serveur.
Les données sont donc **propres à chaque appareil**. Pour les transférer,
utiliser **Export / Import JSON** dans l'onglet Stats. L'export contient les jeux
mais **jamais les clés API**, afin de pouvoir être partagé sans risque.

## Développement

```bash
npm install
npm run dev     # http://localhost:5173/game-library/
npm run build
```

En développement, le proxy du serveur Vite joue le rôle du Worker (il relaie
sans détenir de clé), il n'est donc pas nécessaire de déployer le Worker pour
travailler en local.

## Déploiement

Automatique via GitHub Actions à chaque push sur `main`
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) : build Vite
puis publication sur GitHub Pages. Aucun secret n'est requis dans le dépôt.
