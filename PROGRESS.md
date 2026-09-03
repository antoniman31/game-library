# Game Library — État du projet

> Pour l'historique des décisions, les bugs rencontrés et les approches abandonnées,
> voir [`JOURNAL.md`](JOURNAL.md).

Application de gestion de bibliothèque de jeux vidéo (Xbox / Switch), usage perso.
Dernière mise à jour : 2026-09-03.

## Stack & lancement

- **Vite + React** (React 19, Vite 8), projet **100 % local** (aucun backend applicatif).
- Interface découpée : `src/App.jsx` (ossature), `src/components/` (fiches, modales,
  panneaux glissants), `src/lib/` (réseau, domaine, stockage, synchronisation).
  Les couleurs sont des jetons CSS dans `src/index.css`, basculés par `data-theme`.
- Persistance : **localStorage** (clé `gl_v2`), plus une **sauvegarde sur le Worker**
  (⚙️ → Synchronisation) pour partager la bibliothèque entre appareils.
- Démarrer le dev :
  ```bash
  npm install   # première fois
  npm run dev   # http://localhost:5173
  ```
- Build de prod : `npm run build`.
- **En ligne (PWA installable)** : https://antoniman31.github.io/game-library/
  — déploiement automatique par GitHub Actions à chaque push sur `main`.

## Sources de données & clés

⚠️ **Aucune clé n'est présente dans le code ni dans le dépôt.** Chacun saisit les
siennes dans l'onglet **⚙️ Réglages** ; elles sont stockées sur l'appareil
(`localStorage` clé `gl_keys`, volontairement séparée de `gl_v2` pour ne jamais
partir dans l'Export JSON). Un bouton « Tester » valide chaque clé.

- **RAWG** (jaquettes, Metacritic, genres, dates de sortie) — appels directs, CORS ouvert.
- **Wikipédia FR** (titre officiel + description) et **Wikidata** (infobox) — sans clé, CORS ouvert.
- **SteamGridDB** (jaquettes verticales) et **xbl.io** (bibliothèque Xbox) — ces deux API
  refusent les appels navigateur (pas de CORS). Elles passent par un **relais Cloudflare
  Worker** (`worker/`) qui **ne détient aucun secret** : il ne fait que transmettre la clé
  envoyée par le client, avec liste blanche d'origines *et* de cibles. Son URL se règle
  dans ⚙️. En développement, le proxy Vite joue le même rôle (sans clé lui non plus).

## Fonctionnalités livrées

### Sources d'enrichissement par jeu (fiche dépliée)
- **🔄 Rechercher sur RAWG** : ré-associe un jeu mal matché → remplace cover, Metacritic, genres. Liste scrollable (jusqu'à 10 résultats).
- **🇫🇷 Titre français (Wikipédia)** : recherche full-text Wikipédia FR → remplace le titre par le titre commercial officiel FR ; propose ensuite le **résumé** (description), la **jaquette** d'infobox, et les **infos Wikidata** (voir plus bas), chacun applicable indépendamment.
- **📦 Jaquette SteamGridDB** : vignettes verticales 600×900 (aperçu via `thumb`, image finale via `url`), 3 par ligne, clic pour choisir la cover.

### Descriptions — Wikipédia FR uniquement
- Les descriptions proviennent **exclusivement de Wikipédia FR** (extract d'intro). **MyMemory a été entièrement supprimé** (plus aucune traduction automatique EN→FR).
- **Bouton « 🌐 Actualiser descriptions »** (header) : régénère la description de tous les jeux depuis Wikipédia.
  - **Annulable en cours de route** (bouton « Annuler »).
  - **Meilleure correspondance de titre** (exact → préfixe → 1er résultat) pour éviter de récupérer la page « série » au lieu du jeu.
  - **Bilan de fin** : nombre de descriptions actualisées + **liste des jeux sans page Wikipédia trouvée**.
  - Délai anti-rate-limit conservé (~150 ms entre jeux).

### Infobox Wikidata
- Après avoir choisi le titre via Wikipédia, récupération structurée depuis **Wikidata** : **développeur, éditeur, dates de sortie par plateforme, mode de jeu (solo/multi/coop), série/franchise (jeu précédent / suivant)**. Le **moteur de jeu est volontairement exclu**. Métacritic non repris de Wikidata (celui de RAWG suffit).
- Appliquée via « Utiliser ces infos » puis **affichée dans la fiche** si présente ; libellés résolus en `fr` → `en` → `mul`.

### Ajout d'un jeu (AddModal) — parité totale avec les fiches
- **3 sources avant validation** : RAWG (autocomplete), Wikipédia (titre + description + infobox), SteamGridDB (jaquette), en plus de plateforme / format / statut / date.
- **Après ajout, le jeu s'ouvre automatiquement en fiche complète** (scroll + dépliage) : toutes les actions (chrono, prêt, liens, notes, sources, format…) sont immédiatement disponibles, exactement comme pour un jeu existant.

### Import de la bibliothèque Xbox Live (xbl.io)
- Bouton header **« 🎮 Importer Xbox »** → récupère l'historique de jeux du compte lié à la clé (`player/titleHistory`).
- **Filtrage** : sur ~164 titres renvoyés, seuls les **vrais jeux console Xbox** sont gardés (~150) — les entrées PC-only / Win32 et les apps/launchers (Xbox App, Minecraft Launcher, Solitaire…) sont exclues.
- **Écran de prévisualisation** avant tout import (modal scrollable) : jaquette xbl.io + plateformes du titre, marquage **« Nouveau » / « Déjà présent »** (comparaison de titre normalisée), **compteurs**, **tout cocher / décocher**, cases décochables individuellement pour écarter les doublons FR/EN.
- **Création des jeux** : `format: "démat"`, jaquette xbl.io immédiate (remplaçable ensuite par SteamGridDB), **date d'ajout = date de sortie officielle croisée via RAWG** (fallback : dernière session jouée, puis date du jour), plateforme **Xbox One / Series X** déduite par la règle de date, `backCompat` cohérent. Délai anti-rate-limit RAWG + **arrêt possible** en cours d'import.
- **Enrichissement post-import** (bannière « Enrichir », best-effort et **annulable**) : complète cover/Metacritic/genres via RAWG et la description via Wikipédia sur les jeux fraîchement importés.
- ⚠️ L'API expose l'**historique joué**, pas la liste des achats : un jeu acheté mais jamais lancé n'apparaît pas ; un jeu Game Pass/démo lancé apparaît. Aucun temps de jeu n'est importé (absent de l'endpoint) — le chrono manuel reste la source.

### Plateformes & rétrocompatibilité
- L'ancienne plateforme « Xbox » est **séparée automatiquement** en **Xbox One** / **Xbox Series X** selon la date (`addedDate`, seuil **10/11/2020**). Migration **idempotente** (au chargement, seed + localStorage ; ne re-migre pas un jeu déjà séparé). `addedDate` sert de proxy de date de sortie — approximatif pour quelques titres anciens (ex. Halo 4 classé Xbox One).
- Champ booléen **`backCompat`**, `true` par défaut pour les plateformes « anciennes » (**Xbox One** et **Switch 1**) → badge discret **« 🔄 Compatible Series X »** / **« 🔄 Compatible Switch 2 »** selon la plateforme.
- **Modifiable au cas par cas** : un toggle « Jouable sur … : oui / non » dans la fiche permet de marquer les rares exceptions (titres nécessitant un accessoire spécifique, etc.).
- La valeur par défaut est posée par une **migration versionnée par jeu** (`bcV`) : le rattrapage ne s'applique qu'une fois, donc un choix manuel n'est **jamais réécrasé** au rechargement.
- **Règle de rétrocompatibilité déclarative** (constante `BACK_COMPAT` dans `src/lib/model.js`) : une plateforme récente affiche ses jeux natifs **+** ceux de la plateforme précédente marqués `backCompat`.
  - **« Xbox Series X »** → natifs + **Xbox One** `backCompat`.
  - **« Switch 2 »** → natifs + **Switch 1** `backCompat` (tous par défaut : la Switch 2 lit quasiment toute la ludothèque Switch 1).
  - Les plateformes « anciennes » (**« Xbox One »**, **« Switch 1 »**) restent **strictes**.
- Couleurs de badge distinctes (Series X vert vif, One vert foncé, Switch rouge). Filtres de plateforme et select d'AddModal alignés.

### Suivi de jeu
- **Chrono de session** (Jouer/Stop) + **temps manuel** (h/min, boutons **+** / **−** borné à 0) + **historique des 3 dernières sessions**.
- **Barre HowLongToBeat** (`% HLtB`) si le champ `hltb` est renseigné.
- **Format physique / démat éditable directement dans la fiche** (toggle), plus seulement à l'ajout.
- **Jeux « poussiéreux »** : un « en cours » sans activité depuis > 30 j est estompé (bordure grisée).
- **Compteur « jours depuis dernière session »** sur les jeux en cours.

### Prêts
- Marquer un jeu prêté (nom + date) → statut « prêté ».
- Onglet **Prêts** : **alerte si prêt > 30 jours** (« ⚠️ Prêt long ! »), bouton **SMS** de relance (lien `sms:` pré-rempli).

### Organisation & UI
- **Stats** : total, terminés, en cours, prêtés, temps total, top genres. **Export / Import JSON** de la bibliothèque (remplacer ou fusionner).
- **Tri** : A-Z / Date / Metacritic / Temps. **Filtre « 🎯 à finir »** (en cours + non commencé, triés par ancienneté).
- **Filtres** (combinables entre eux et avec la recherche) : **plateforme**, **statut**, et **format** (Tous / Physique / Démat).
- **Recherche texte** sur **titre + genre + tag**, **insensible à la casse et aux accents** (« creatif » trouve le genre « Créatif »). La **description est volontairement exclue** de la recherche : elle générait trop de faux positifs (un mot du résumé remontait des jeux sans rapport).
- **Vues** liste et grille (jaquettes **format boîte vertical 2:3**), **thème clair / sombre**.
- **Suppression** via **toast « Annuler »** (5 s) au lieu d'une confirmation bloquante.
- **Fiches en accordéons** repliés : « 📤 Prêt », « 🔗 Liens & contenu », « 📝 Notes ». Description repliée à 2 lignes avec « Lire la suite ».
- Note /10, tag et progression retirés de l'UI (champs conservés dans le modèle pour compat).

## Limites connues

- **SteamGridDB et xbl.io nécessitent le relais** : sans Worker déployé (et son URL renseignée dans ⚙️), ces deux sources restent indisponibles en ligne. Tout le reste fonctionne.
- **xbl.io** : historique joué ≠ bibliothèque achetée (voir section Import Xbox) ; pas de temps de jeu exposé.
- **Jaquettes xbl.io réécrites en HTTPS** (`httpsImage`) : l'API les sert en `http://` et une partie via `images-eds.xboxlive.com`, hôte sans TLS. Sans cette réécriture, toute jaquette importée depuis Xbox restait cassée sur le site HTTPS — invisible en dev (`http://localhost`).
- **Pas d'import Nintendo possible** : Nintendo n'expose aucune API de bibliothèque/achats. Le seul accès (non officiel, `nxapi`) passe par les relevés du contrôle parental — jeux *joués* et temps de jeu, via un login Nintendo interactif. Voir README.
- **Wikidata** : certains champs d'infobox sont parfois absents (jeux Nintendo/récents) → affichage best-effort, sans casser l'UI.

## Fait récemment

- **Refonte mobile** : en-tête collant ramené de 317 à 177 px, débordement
  horizontal de 13 px supprimé, filtres et actions en panneaux glissants,
  cibles tactiles à 44 px, liste paginée par 30, recherche debouncée, mode
  d'affichage compact.
- **Robustesse** : `ErrorBoundary` avec export de secours, bandeau d'erreur pour
  les fautes hors rendu, alerte de quota de stockage, validation de l'import
  JSON, `npm ci` et lint en CI, `no-undef` activé dans oxlint.
- **Synchronisation** entre appareils via le Worker (espace KV), et `worker/test.mjs`.

- **PWA en ligne sur GitHub Pages** (manifest, service worker Workbox, icônes
  192/512 + maskable, installable sur écran d'accueil).
- **Clés API sorties du code** et purgées de tout l'historique git avant le premier
  push (aucune clé n'a jamais été publiée → inutile de les régénérer).
- **Relais CORS sans secret** pour SteamGridDB et xbl.io.

## Prochaines étapes

- **Ajouter le secret `CLOUDFLARE_API_TOKEN`** au dépôt GitHub (Settings →
  Secrets and variables → Actions) : sans lui, le déploiement automatique du
  Worker échoue et `/sync` reste inactif. L'espace KV `SYNC` est créé et
  déclaré dans `worker/wrangler.toml`.
- **Relais déployé** : `https://game-library-proxy.antoniman31.workers.dev`
  — à coller dans ⚙️ sur chaque nouvel appareil (il n'est pas dans l'export JSON).
- Éventuellement : rappel local à l'ouverture pour les prêts > 30 j. Les
  notifications push de `gta6-backend` supposent un backend qui pousse ; ici, il
  faudrait envoyer la liste des prêts à un serveur pour un gain quasi nul.

## Structure

```
GameLibrary/
├── index.html
├── package.json
├── .github/workflows/    ← deploy.yml : build + publication GitHub Pages
├── worker/               ← relais CORS + sauvegarde KV (sans secret) + tests
├── vite.config.js        ← base '/game-library/', PWA, proxys de dev (sans clé)
├── PROGRESS.md           ← ce fichier
└── src/
    ├── App.jsx           ← ossature : état global, en-tête, onglets
    ├── main.jsx          ← montage + garde-fou d'erreurs global
    ├── index.css         ← jetons de thème, animations, survol
    ├── lib/              ← api, model, seed, storage, sync, theme
    └── components/       ← GameCard, AddModal, ImportModal, Sheet,
                             FiltersSheet, ActionsSheet, Cover,
                             InfoboxView, ErrorBoundary
```
