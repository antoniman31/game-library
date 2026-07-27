# Game Library — État du projet

Application de gestion de bibliothèque de jeux vidéo (Xbox / Switch), usage perso.
Dernière mise à jour : 2026-07-27.

## Stack & lancement

- **Vite + React** (React 19, Vite 8), projet **100 % local** (aucun backend applicatif).
- Point d'entrée : `src/App.jsx` (tout le code y est — composant unique, styles inline).
- Persistance : **localStorage** (clé `gl_v2`).
- Démarrer le dev :
  ```bash
  npm install   # première fois
  npm run dev   # http://localhost:5173
  ```
- Build de prod : `npm run build`.

## Sources de données & clés

- **RAWG** (jeux : covers, Metacritic, genres) — clé dans la constante `RAWG_KEY` en haut de `src/App.jsx`.
- **SteamGridDB** (jaquettes verticales format boîte) — clé dans la constante `SGDB_KEY` de `vite.config.js` (côté serveur, jamais exposée au navigateur). ⚠️ passe par un **proxy Vite** (`/sgdb/*` → API, avec le token injecté côté serveur) car l'API n'expose pas de CORS : **fonctionne uniquement en `npm run dev`**, pas en build statique / preview.
- **Wikipédia FR** (titre officiel + description) et **Wikidata** (infobox structurée) — sans clé, appels navigateur directs (`origin=*`).
- **xbl.io** (bibliothèque Xbox Live du compte) — clé dans la constante `XBL_KEY` de `vite.config.js` (côté serveur). ⚠️ même contrainte que SteamGridDB : **proxy Vite** (`/xbl/*` → `api.xbl.io`, header `X-Authorization` injecté côté serveur), donc **`npm run dev` uniquement**.

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

### Plateformes — Xbox One / Xbox Series X
- L'ancienne plateforme « Xbox » est **séparée automatiquement** en **Xbox One** / **Xbox Series X** selon la date (`addedDate`, seuil **10/11/2020**). Migration **idempotente** (au chargement, seed + localStorage ; ne re-migre pas un jeu déjà séparé). `addedDate` sert de proxy de date de sortie — approximatif pour quelques titres anciens (ex. Halo 4 classé Xbox One).
- Champ booléen **`backCompat`** (rétrocompatible Series X, `true` par défaut pour les Xbox One) → badge discret **« 🔄 Compatible Series X »**.
- Couleurs de badge distinctes (Series X vert vif, One vert foncé, Switch rouge). Filtres de plateforme et select d'AddModal mis à jour.
- Le filtre **« Xbox Series X » inclut aussi les jeux Xbox One `backCompat`** (jouables sur Series X) ; le filtre **« Xbox One » reste strict**.

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

- **SteamGridDB et xbl.io via proxy dev** : ces deux sources ne marchent qu'en `npm run dev` (le proxy Vite injecte le token côté serveur ; aucune des deux API n'expose de CORS). Un build statique ne pourra pas y accéder sans backend/proxy équivalent.
- **xbl.io** : historique joué ≠ bibliothèque achetée (voir section Import Xbox) ; pas de temps de jeu exposé.
- **Wikidata** : certains champs d'infobox sont parfois absents (jeux Nintendo/récents) → affichage best-effort, sans casser l'UI.

## Prochaine étape

- **Déploiement en PWA** (Vercel ou Netlify) pour un accès mobile.
  - Manifest + service worker (installable sur écran d'accueil).
  - Prévoir un proxy/serveur pour SteamGridDB **et xbl.io** (sinon désactiver ces sources en prod).
  - Vérifier que localStorage suffit ou prévoir une synchro multi-appareils.

## Structure

```
GameLibrary/
├── index.html
├── package.json
├── vite.config.js        ← proxys /sgdb (SteamGridDB) et /xbl (xbl.io) + tokens SGDB_KEY / XBL_KEY
├── PROGRESS.md           ← ce fichier
└── src/
    ├── App.jsx           ← toute l'application (constante RAWG_KEY en tête)
    ├── main.jsx
    └── index.css
```
