# Game Library

Bibliothèque de jeux vidéo personnelle (Xbox / Switch) : suivi de progression,
chronomètre de session, prêts, statistiques, et enrichissement automatique des
fiches depuis plusieurs bases de données publiques.

**➡️ [antoniman31.github.io/game-library](https://antoniman31.github.io/game-library/)** — installable en PWA sur mobile.

Application **React + Vite**, sans backend applicatif : l'interface est
découpée en composants et modules (`src/components/`, `src/lib/`), les données
vivent dans le `localStorage` du navigateur, et un Worker Cloudflare sert à la
fois de relais CORS et de sauvegarde entre appareils.

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Configuration des clés API](#configuration-des-clés-api)
- [Le relais CORS](#le-relais-cors-worker-cloudflare)
- [Fonctionnalités](#fonctionnalités)
- [Sources de données](#sources-de-données)
- [Modèle de données](#modèle-de-données)
- [Architecture et choix techniques](#architecture-et-choix-techniques)
- [Développement](#développement)
- [Déploiement](#déploiement)
- [Limites connues](#limites-connues)

---

## Démarrage rapide

1. Ouvrir **[l'application](https://antoniman31.github.io/game-library/)**.
2. Aller dans l'onglet **⚙️** et saisir ses clés API (voir ci-dessous).
   Sans clé, l'application fonctionne mais sans jaquettes ni enrichissement.
3. Sur mobile : menu du navigateur → **« Installer l'application »** / « Ajouter à
   l'écran d'accueil ».
4. Pour transférer une bibliothèque existante : **Stats → Exporter** sur l'ancien
   appareil, **Stats → Importer** sur le nouveau.

---

## Configuration des clés API

⚠️ **Le dépôt ne contient aucune clé.** Chacun saisit les siennes dans l'onglet
**⚙️** ; elles sont enregistrées **sur l'appareil** (`localStorage`, entrée
`gl_keys`) et ne transitent que vers les services concernés.

| Service | À quoi ça sert | Obtenir une clé | Obligatoire ? |
|---|---|---|---|
| **RAWG** | Jaquettes, score Metacritic, genres, dates de sortie | [rawg.io/apidocs](https://rawg.io/apidocs) | Recommandé |
| **SteamGridDB** | Jaquettes verticales format boîte (2:3) | [steamgriddb.com](https://www.steamgriddb.com/profile/preferences/api) | Optionnel |
| **xbl.io** | Import de la bibliothèque Xbox Live | [xbl.io/console](https://xbl.io/console) | Optionnel |

**Wikipédia** et **Wikidata** ne demandent aucune clé.

Un bouton **« Tester »** valide chaque clé (✅ / ❌) sans quitter l'écran.

### Pourquoi les clés sont-elles saisies à la main ?

Une application 100 % statique n'a pas de serveur où cacher un secret : toute clé
embarquée dans le code se retrouverait lisible dans le bundle JavaScript **et**
dans le dépôt public. Les faire saisir par l'utilisateur règle le problème à la
racine — chacun utilise son propre quota, et le dépôt reste sain.

L'**Export JSON contient les jeux mais jamais les clés**, afin qu'une sauvegarde
puisse être partagée ou stockée sans fuite. Conséquence : sur un nouvel appareil,
il faut importer l'export **et** ressaisir les clés.

---

## Le relais CORS (Worker Cloudflare)

**SteamGridDB** et **xbl.io** ne renvoient pas d'en-tête
`Access-Control-Allow-Origin` : un navigateur refuse donc de lire leurs réponses,
**même avec une clé valide**. Ce n'est pas un problème d'authentification mais une
règle du navigateur — la clé, où qu'elle soit stockée, n'y change rien.

Le dossier [`worker/`](worker/) contient un petit relais Cloudflare Worker qui
rétablit ces en-têtes. Points importants :

- **Il ne contient aucun secret.** La clé est envoyée par le client à chaque
  requête et simplement retransmise. Rien à faire tourner, rien à renouveler.
- **Ce n'est pas un proxy ouvert** : double liste blanche, sur les **origines**
  autorisées à l'appeler *et* sur les **cibles** qu'il accepte de relayer
  (uniquement `steamgriddb.com` et `xbl.io`).

### Déploiement (gratuit, ~2 minutes)

```bash
cd worker
npx wrangler login     # compte Cloudflare gratuit, plan Workers gratuit
npx wrangler deploy
```

Wrangler affiche une URL du type `https://game-library-proxy.<compte>.workers.dev`.
La coller dans **⚙️ → « Relais CORS »** → Enregistrer.

> **Relais déjà déployé pour ce projet :**
> `https://game-library-proxy.antoniman31.workers.dev`
> Il suffit de le coller dans ⚙️ sur chaque appareil — inutile de redéployer.

> Sans ce relais, **tout le reste fonctionne** : RAWG, Wikipédia et Wikidata
> autorisent les appels directs. Seuls SteamGridDB et l'import Xbox sont
> indisponibles en ligne.

Si l'application est servie depuis une autre adresse, ajouter celle-ci dans
`ORIGINES` (`worker/index.js`) et redéployer, sinon le navigateur renverra une
erreur CORS.

---

## Fonctionnalités

### Bibliothèque

- **94 jeux** pré-remplis en données de départ ; ajout, édition et suppression libres.
- **Vues liste et grille**, jaquettes au **format boîte vertical 2:3**.
- **Recherche** sur titre + genre + tag, **insensible à la casse et aux accents**
  (« creatif » trouve le genre « Créatif »). La description est volontairement
  exclue : un mot du résumé faisait remonter des jeux sans rapport.
- **Filtres combinables** : plateforme, statut, format (physique / démat).
- **Tri** : A-Z, date, Metacritic, temps de jeu.
- **Filtre « 🎯 à finir »** : « en cours » + « non commencé », triés par ancienneté
  de dernière session — pour attaquer la pile par le plus vieux.
- **Statuts** : non commencé, en cours, terminé, platine, abandonné, prêté.
- **Thème clair / sombre**.
- **Suppression avec toast « Annuler »** (5 s) au lieu d'une popup bloquante.

### Suivi de jeu

- **Chronomètre de session** (Jouer / Stop) qui alimente le temps total et
  l'historique des 3 dernières sessions.
- **Saisie manuelle** du temps déjà joué (heures / minutes, boutons **+** et **−**,
  borné à 0).
- **Barre HowLongToBeat** : pourcentage d'avancement si le champ `hltb` est rempli.
- **Jeux « poussiéreux »** : un jeu « en cours » sans activité depuis plus de 30
  jours est affiché estompé, bordure en pointillés.
- **Compteur « jours depuis la dernière session »** sur les jeux en cours.

### Prêts

- Marquer un jeu comme prêté (nom de l'emprunteur + date) bascule son statut.
- Onglet **Prêts** : **alerte au-delà de 30 jours** et bouton **SMS** de relance
  (lien `sms:` pré-rempli).

### Fiche de jeu

Chaque fiche se déplie et regroupe, en accordéons repliés par défaut :
**📤 Prêt**, **🔗 Liens & contenu** (recherches YouTube / JVC / IGN + 3 liens
personnels), **📝 Notes**. Restent toujours visibles : genres, statut, format,
rétrocompatibilité et bloc « Temps de jeu ». La description est repliée à deux
lignes avec un « Lire la suite ».

### Enrichissement automatique

Trois sources, activables jeu par jeu depuis la fiche :

| Bouton | Ce qu'il remplace |
|---|---|
| **🔄 Rechercher sur RAWG** | Jaquette, Metacritic, genres — utile quand un jeu a été mal associé |
| **🇫🇷 Titre français (Wikipédia)** | Titre commercial officiel FR, puis au choix : résumé, jaquette d'infobox, infos Wikidata |
| **📦 Jaquette SteamGridDB** | Jaquette verticale 600×900 choisie parmi une grille de vignettes |

**Infobox Wikidata** : développeur, éditeur, dates de sortie par plateforme, mode
de jeu (solo / multi / coop), série et jeux précédent/suivant. Le moteur de jeu
est volontairement exclu. Les libellés sont résolus en `fr` → `en` → `mul`
(Wikidata range les noms propres sous `mul`, ce qui explique que certains
éditeurs ne remontent pas si on ne demande que `fr`/`en`).

**Bouton « 🌐 Actualiser descriptions »** (en-tête) : régénère la description de
toute la bibliothèque depuis Wikipédia. Il est **annulable en cours de route**,
respecte un délai anti-rate-limit (~150 ms) et affiche en fin de course la
**liste des jeux sans page Wikipédia trouvée**. Il retient le **meilleur titre**
(exact → préfixe → premier résultat) pour éviter de récupérer la page de la
*série* au lieu de celle du jeu — sans quoi « Assassin's Creed Unity » héritait
de la description générique d'« Assassin's Creed ».

### Import de la bibliothèque Xbox Live

Bouton **« 🎮 Importer Xbox »** → récupère l'historique de jeux du compte associé
à la clé xbl.io.

- **Filtrage** : sur ~164 titres renvoyés, seuls les vrais jeux console sont
  gardés (~150). Les entrées PC-only / Win32 et les applications (Xbox App,
  Minecraft Launcher, Solitaire…) sont écartées.
- **Écran de prévisualisation obligatoire** : chaque titre est marqué
  **« Nouveau »** ou **« Déjà présent »** (comparaison de titre normalisée), avec
  compteurs, « tout cocher / décocher » et cases individuelles — indispensable
  pour écarter les doublons FR/EN que la normalisation ne rattrape pas.
- **À l'import** : `format: "démat"`, jaquette xbl.io immédiate, **date d'ajout =
  date de sortie officielle** récupérée via RAWG (repli : dernière session, puis
  date du jour), plateforme Xbox One / Series X déduite, `backCompat` cohérent.
  Progression affichée et **arrêt possible**.
- **Enrichissement post-import** proposé en bannière (RAWG + Wikipédia),
  best-effort et annulable.

> ⚠️ L'API expose l'**historique joué**, pas la liste des achats : un jeu acheté
> mais jamais lancé n'apparaît pas, un jeu Game Pass lancé une fois apparaît.
> Aucun temps de jeu n'est importé (absent de l'endpoint).

### Plateformes et rétrocompatibilité

L'ancienne plateforme « Xbox » est séparée en **Xbox One** / **Xbox Series X**
selon la date (seuil du **10/11/2020**, sortie de la Series X), via une migration
idempotente au chargement.

La règle est déclarative (constante `BACK_COMPAT`) : **une plateforme récente
affiche ses jeux natifs plus ceux de la génération précédente marqués
`backCompat`**.

- **Xbox Series X** → natifs + Xbox One rétrocompatibles
- **Switch 2** → natifs + Switch 1 rétrocompatibles
- **Xbox One** et **Switch 1** restent **stricts**

Badge discret **« 🔄 Compatible Series X »** / **« 🔄 Compatible Switch 2 »**, et
un toggle **« Jouable sur … : oui / non »** dans la fiche pour les rares
exceptions. Ce choix manuel est protégé par une **migration versionnée par jeu**
(`bcV`) : le rattrapage automatique ne s'applique qu'une fois, il n'écrase donc
jamais une décision prise à la main.

### Sauvegarde

**Export / Import JSON** dans l'onglet Stats, en mode *remplacer* ou *fusionner*.
C'est le seul moyen de transférer sa bibliothèque d'un appareil à l'autre.

---

## Sources de données

| Source | Clé | CORS | Usage |
|---|---|---|---|
| RAWG | oui | ✅ direct | Jaquettes, Metacritic, genres, dates de sortie |
| Wikipédia FR | non | ✅ direct | Titre officiel français, résumé, image d'infobox |
| Wikidata | non | ✅ direct | Développeur, éditeur, sorties, mode de jeu, série |
| SteamGridDB | oui | ❌ via relais | Jaquettes verticales format boîte |
| xbl.io | oui | ❌ via relais | Historique de la bibliothèque Xbox |

---

## Modèle de données

Un jeu est un objet simple, persisté dans `localStorage` sous la clé `gl_v2` :

```js
{
  id, title, platform, format,       // "physique" | "démat"
  addedDate,                         // sert aussi de date de sortie (proxy)
  genre: [], style,                  // style = description
  status,                            // cf. STATUTS
  note, lentA, lentDate,             // prêt
  cover, metacritic, hltb,
  playedMinutes, manualMinutes, sessions: [{ date, minutes }],
  myLinks: ["", "", ""], tips, tag, progression,
  backCompat, bcV,                   // rétrocompatibilité + version de migration
  infobox                            // données Wikidata, ou null
}
```

Les champs `note`, `tag` et `progression` ne sont plus affichés mais restent
présents pour ne pas casser les anciennes sauvegardes.

Les clés API sont stockées séparément, sous `gl_keys`, précisément pour qu'elles
n'entrent jamais dans l'export.

---

## Architecture et choix techniques

### D'un seul fichier à un découpage

Le projet est né d'un artefact autonome et a grandi par ajouts successifs : tout
vivait dans `src/App.jsx`, 1 560 lignes et 136 Ko, styles inline compris. Ça a
tenu longtemps, puis chaque ajout est devenu plus coûteux que le précédent et
une erreur ne se cherchait plus qu'à l'aveugle.

Le code est désormais réparti entre `src/lib/` (réseau, domaine, stockage,
synchronisation) et `src/components/`, et `App.jsx` ne garde que l'ossature.

Les couleurs, elles, ont quitté le JavaScript. Chaque composant recevait une
prop `dark` et recalculait ses teintes dans des styles inline
(`dark ? "#1a1a2e" : "#f0f4ff"`, une quarantaine de fois). Tant que rien ne
passait par une feuille de style, aucune media query, aucun `:hover` et aucun
mode d'affichage n'étaient possibles. Elles sont maintenant des jetons CSS dans
`src/index.css`, basculés par un attribut `data-theme` sur `<html>`.

### Où sont passées les traductions automatiques ?

Les descriptions ont d'abord été traduites de l'anglais via l'API MyMemory
(gratuite, 500 caractères par requête, avec découpage en segments et recollage).
Cette approche a été **entièrement retirée** au profit de **Wikipédia FR**, qui
fournit directement un texte français rédigé, sans quota ni découpage.

### Décisions notables

- **Le lint distingue le navigateur du Worker.** `no-undef` est actif, et
  l'environnement Node est déclaré dans un `overrides` limité à `worker/**`
  plutôt que globalement. Déclaré partout, il rendrait `process` défini dans
  `src/` aussi : un `process.env.X` glissé dans le code navigateur passerait le
  lint pour échouer à l'exécution, Vite ne fournissant pas `process` au
  navigateur. Attention au nom du fichier : oxlint ne lit que `.oxlintrc.json`,
  avec le point ; un `oxlintrc.json` sans point est ignoré en silence.
- **La CI tourne sur les pull requests**, le job `deploy` restant réservé à
  `main`. Le workflow ne se déclenchait que sur un push vers `main` : lint et
  build ne s'exécutaient donc qu'après la fusion, au moment où ils déploient
  déjà. Une pull request qui ne compilait pas n'était visible qu'une fois le
  site cassé.
- **`npm ci` en CI.** Le lockfile échouait autrefois à la validation stricte
  parce qu'il lui manquait les binaires natifs Linux de Rollup, absents quand il
  était généré sous Windows. Il les porte désormais, et le workflow est repassé
  à `npm ci` : `npm install` laissait npm résoudre librement, donc une version
  mineure d'une dépendance transitive pouvait casser un déploiement sans qu'un
  seul commit touche au projet. Si tu installes sous Windows, npm ajoutera les
  binaires win32 : commite le lockfile mis à jour, il portera alors les deux
  plateformes.
- **Le mobile d'abord.** L'en-tête collant empilait le titre, cinq boutons à
  libellé complet, les onglets, la recherche et quatre rangées de puces de
  filtres : 317 px sur un écran de 915, soit un tiers de la surface avant le
  premier jeu, et une rangée de boutons qui débordait de 13 px et faisait
  défiler la page latéralement. Filtres et actions sont passés dans des
  panneaux glissants, les cibles tactiles à 44 px, et la liste est paginée par
  30 au lieu de monter les 94 fiches d'un coup.
- **Rien n'échoue plus en silence.** Une exception de rendu vidait `#root` sans
  un mot ; un `ErrorBoundary` affiche désormais l'erreur et propose d'exporter
  la bibliothèque avant toute chose. Les écritures dans `localStorage` étaient
  enveloppées dans un `catch {}` muet : un quota saturé faisait perdre la
  persistance sans le moindre signe.
- **Déploiement par artefact**, pas de dossier `docs/` commité : aucun fichier
  généré n'entre dans le dépôt.
- **`addedDate` sert de proxy de date de sortie** pour classer Xbox One /
  Series X. C'est approximatif pour quelques titres anciens (Halo 4, sorti en
  2012 sur Xbox 360, se retrouve classé Xbox One) — assumé pour rester simple.
- **Le service worker ne met jamais les appels d'API en cache**, uniquement la
  coquille de l'application et les jaquettes distantes : les données doivent
  rester fraîches et échouer proprement hors ligne.
- **Les jaquettes xbl.io sont réécrites en HTTPS.** L'API les renvoie en `http://`
  (bloquées en contenu mixte sur un site HTTPS), et une partie vient de
  `images-eds.xboxlive.com`, hôte qui ne répond pas en TLS — un simple passage en
  `https` échouait donc aussi. Le helper `httpsImage` bascule vers l'hôte
  `images-eds-ssl` équivalent avant de forcer le schéma. Bug invisible en
  développement, où la page est servie en `http://localhost`.
- **Historique git purgé avant la première publication.** Les clés avaient été
  committées pendant le développement local ; elles ont été retirées de tous les
  commits avec `git-filter-repo` **avant** le premier push. Elles ne sont donc
  jamais sorties de la machine de développement.

---

## Développement

```bash
npm install
npm run dev      # http://localhost:5173/game-library/
npm run build
npm run preview
npm run lint     # oxlint
```

En développement, le proxy du serveur Vite joue exactement le rôle du Worker : il
relaie `/sgdb/*` et `/xbl/*` **sans détenir de clé** (c'est le client qui envoie
l'en-tête d'authentification). Il n'est donc **pas nécessaire de déployer le
Worker pour travailler en local**.

### Structure

```
├── .github/workflows/deploy.yml   Build + publication GitHub Pages
├── worker/                        Relais CORS Cloudflare (sans secret) + sa doc
│   ├── index.js
│   ├── test.mjs                   16 vérifications, sans dépendance ni déploiement
│   ├── wrangler.toml
│   └── README.md
├── public/                        Icônes PWA (192/512, any + maskable), favicon
├── src/
│   ├── App.jsx                    Ossature : état global, en-tête, onglets
│   ├── main.jsx                   Montage + garde-fou d'erreurs global
│   ├── index.css                  Jetons de thème, animations, survol
│   ├── lib/
│   │   ├── api.js                 RAWG, Wikipédia, Wikidata, SteamGridDB, xbl.io
│   │   ├── model.js               Statuts, plateformes, migration, validation
│   │   ├── seed.js                Bibliothèque de démarrage
│   │   ├── storage.js             localStorage instrumenté (alerte de quota)
│   │   ├── sync.js                Sauvegarde sur le Worker
│   │   └── theme.js               Alias vers les jetons CSS
│   └── components/
│       ├── GameCard.jsx  AddModal.jsx  ImportModal.jsx
│       ├── Sheet.jsx  FiltersSheet.jsx  ActionsSheet.jsx
│       └── Cover.jsx  InfoboxView.jsx  ErrorBoundary.jsx
├── index.html
├── vite.config.js                 base, PWA, proxys de dev
├── PROGRESS.md                    État des fonctionnalités
└── JOURNAL.md                     Journal de développement : décisions, bugs, impasses
```

---

## Déploiement

Automatique à chaque push sur `main`
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) : `npm ci`,
`npm run lint`, `npm run test:worker`, `npm run build`, puis publication de
`dist/` sur GitHub Pages via les actions
officielles `configure-pages` / `upload-pages-artifact` / `deploy-pages`.

**Aucun secret n'est nécessaire** dans le dépôt — c'est toute la raison d'être du
choix « clés saisies par l'utilisateur ».

Le service worker est en `autoUpdate` : une nouvelle version est récupérée
automatiquement au chargement suivant.

---

## Limites connues

- **La synchronisation est manuelle.** ⚙️ → Synchronisation dépose la
  bibliothèque sur le Worker et la récupère, avec le même code sur chaque
  appareil ; rien ne part ni n'arrive tout seul, et une récupération remplace la
  bibliothèque locale après confirmation. Sans relais déployé, il reste l'Export
  / Import JSON. Les clés d'API et le code de synchronisation sont à ressaisir
  sur chaque appareil : ils ne figurent pas dans l'export.
- **SteamGridDB et l'import Xbox exigent le relais** déployé et renseigné dans ⚙️.
- **xbl.io** expose l'historique joué, pas les achats, et aucun temps de jeu.
- **Wikidata est incomplet** sur certains jeux (souvent les titres Nintendo ou
  très récents) : l'infobox s'affiche alors partiellement, sans casser la fiche.
- **Le classement Xbox One / Series X repose sur `addedDate`**, faute de date de
  sortie stockée séparément.
- **`localStorage` n'est pas un coffre-fort** : les clés y sont lisibles par tout
  script s'exécutant sur la page. Acceptable pour une application personnelle
  sans contenu tiers.

---

## Aller plus loin

- [`PROGRESS.md`](PROGRESS.md) — état détaillé des fonctionnalités
- [`JOURNAL.md`](JOURNAL.md) — journal de développement : chronologie, décisions et leurs
  raisons, bugs rencontrés et leurs causes réelles, approches abandonnées

## Licence

[MIT](LICENSE)
