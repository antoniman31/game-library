# Game Library — Journal de développement

Ce document retrace l'intégralité de la construction du projet : la chronologie, les
décisions et leurs raisons, les bugs rencontrés et leurs causes réelles, ainsi que les
approches essayées puis abandonnées.

Il complète les deux autres documents :

| Document | Rôle |
|---|---|
| [`README.md`](README.md) | Comment utiliser et configurer l'application |
| [`PROGRESS.md`](PROGRESS.md) | État des fonctionnalités à un instant T |
| **`JOURNAL.md`** | **Comment on en est arrivé là, et pourquoi** |

---

## 1. Ce qu'est le projet

Une bibliothèque de jeux vidéo personnelle (Xbox / Switch) : suivi de progression,
chronomètre de session, prêts, statistiques, et enrichissement automatique des fiches
depuis plusieurs bases publiques.

**Contraintes fixées dès le départ, jamais remises en cause :**

- **Aucun backend.** L'application est entièrement statique, les données vivent dans le
  `localStorage` du navigateur.
- **Un seul fichier.** Tout tient dans `src/App.jsx` (~1550 lignes), styles inline, aucune
  dépendance UI.
- **Français partout** : interface, descriptions, titres de jeux.

**Résultat** : https://antoniman31.github.io/game-library/ — PWA installable, déployée
automatiquement à chaque push.

---

## 2. Chronologie

### Phase 1 — De l'artefact au projet Vite

Le projet démarre comme un composant React autonome (un artefact Claude), sans
infrastructure. Première étape : créer un vrai projet autour.

- `npm create vite` (template React), fichier renommé en `src/App.jsx`.
- Le composant n'importait que `react` et exportait déjà `export default function App()` :
  aucune adaptation d'import n'a été nécessaire.
- **Premier ajustement non trivial** : le `index.css` par défaut de Vite centre le contenu
  et plafonne `#root` à 1280 px, ce qui cassait la mise en page pleine largeur. Remplacé
  par un reset minimal.
- Le fichier a ensuite été remplacé par une v2 plus complète (72 Ko), toujours sans
  dépendance externe.

### Phase 2 — Refonte de la fiche de jeu

La fiche dépliée était devenue trop longue. Réorganisation en deux temps :

1. **Accordéons repliés par défaut** : « 📤 Prêt », « 🔗 Liens & contenu », « 📝 Notes ».
   Restent visibles hors accordéon : genres, statut, bloc « Temps de jeu ».
   Un seul accordéon ouvert à la fois.
2. **Suppression de fonctionnalités** jugées inutiles : la note /10 (et le tri associé,
   et la section « Mes top jeux » des stats) ainsi que les champs tag et progression.
   Les champs correspondants ont été **conservés dans le modèle de données** pour ne pas
   casser les sauvegardes existantes — ils sont simplement absents de l'interface.

Autres ajouts de cette phase : bouton « Supprimer », description repliée à deux lignes
avec un « Lire la suite », boutons **+** et **−** pour la saisie manuelle du temps de jeu.

> **Un cas instructif** : le bouton « + » du temps manuel avait été signalé comme
> non fonctionnel. Après reproduction dans le navigateur, la chaîne d'état marchait
> parfaitement (2 h 30 → +1 h 15 → 3 h 45). Le vrai défaut était ailleurs : les champs
> étaient contrôlés avec une valeur `0`, si bien qu'en tapant « 2 » on obtenait « 02 » ou
> « 20 », et un champ vidé pouvait produire `NaN` et empoisonner le total silencieusement.
> Correctif : champs vides par défaut (`value={manH || ""}`), parsing borné et sûr,
> et bouton neutre si la saisie est nulle.

### Phase 3 — Les descriptions françaises : trois tentatives

C'est le fil rouge le plus long du projet, et celui qui a le plus changé d'approche.

**Tentative 1 — API Anthropic.** Traduire les descriptions RAWG (anglais) via un appel
direct à `api.anthropic.com`. Testé en conditions réelles : **401 `x-api-key header is
required`**. Sans clé — et une clé côté navigateur serait publique — l'appel échoue
toujours et retombe sur l'anglais. Abandonné.

**Tentative 2 — MyMemory.** API de traduction gratuite et sans clé, qui fonctionne
réellement depuis le navigateur. Deux contraintes traitées :
- limite de **500 caractères par requête** → découpage en segments coupés sur les fins de
  phrase, traduits séquentiellement (150 ms entre appels) puis recollés ;
- quota d'environ 5 000 mots/jour par IP → repli sur l'anglais brut en cas d'échec.

Résultat correct (une description de 1 146 caractères ressortait en 1 335 caractères de
français cohérent), mais qualité de traduction automatique et quota fragile.

**Tentative 3 — Wikipédia FR (retenue).** Plutôt que de traduire l'anglais, aller
chercher un texte **déjà rédigé en français**. MyMemory a été **entièrement supprimé**
(trois fonctions et leurs trois appels), et Wikipédia est devenu la source unique des
descriptions.

### Phase 4 — Enrichissement multi-sources

Trois sources se sont ajoutées, chacune avec son propre écueil.

**RAWG** (jaquettes, Metacritic, genres, dates) : autocomplete à l'ajout, récupération
automatique au démarrage, et bouton de correction par jeu pour les mauvaises associations.

**Wikipédia FR** (titre officiel français) : le premier essai utilisait `opensearch`,
qui matche **par préfixe**. Or « LEGO Star Wars: The Force Awakens » ne préfixe pas
« Lego Star Wars : Le Réveil de la Force » — l'endpoint ne renvoyait rien. Bascule sur la
recherche plein-texte `list=search`, qui remonte le bon titre français **en première
position** pour les deux cas de test. S'y sont greffés le résumé d'article, l'image
d'infobox, puis les données structurées Wikidata.

**SteamGridDB** (jaquettes verticales format boîte) : première API à ne pas autoriser les
appels navigateur — voir la section CORS plus bas.

Le format des jaquettes a été refondu à cette occasion : de carré à **rectangle vertical
2:3**, façon boîte de jeu, partout (ligne compacte, vue grille, onglet Prêts, vignettes).

---

### Phase 5 — Les six blocs

Un lot structurant, traité bloc par bloc, chacun buildé et vérifié dans le navigateur
avant de passer au suivant.

| Bloc | Contenu |
|---|---|
| **1** | Bouton « Actualiser descriptions » basculé sur Wikipédia ; MyMemory supprimé ; annulation en cours de route ; bilan des jeux sans page trouvée |
| **2** | AddModal : trois sources (RAWG, Wikipédia, SteamGridDB) disponibles **avant** validation |
| **3** | Format physique / démat éditable directement dans la fiche |
| **4** | Parité fiche ↔ ajout : le jeu créé s'ouvre automatiquement en fiche complète |
| **5** | Infobox Wikidata : développeur, éditeur, dates par plateforme, mode de jeu, série |
| **6** | Séparation Xbox → Xbox One / Xbox Series X, champ `backCompat`, badge |

**Deux arbitrages ont été soumis avant codage**, plutôt que tranchés en silence :

- *Bloc 4 (parité totale)* : répliquer chrono, prêts, liens et notes dans l'écran d'ajout
  aurait demandé un refactor lourd, pour des données qui n'ont de sens qu'**après**
  création (on n'a pas encore joué à un jeu qu'on ajoute). Option retenue : l'ajout couvre
  les sources et les métadonnées, puis **le jeu créé s'ouvre directement en fiche**, où
  tout est déjà disponible.
- *Bloc 5 (infobox)* : Wikidata plutôt que le parsing HTML de l'infobox Wikipédia —
  structuré, stable, sans scraping fragile.

**Un conflit est apparu en cours de route et a été signalé** : l'actualisation globale
prenait le **premier** résultat Wikipédia, qui pour un jeu de série renvoie la page de la
*série*. « Assassin's Creed Unity » héritait ainsi de la description générique
d'« Assassin's Creed ». Correctif : sélection du **meilleur titre** (exact → préfixe →
premier), vérifiée sur les deux cas.

### Phase 6 — Import de la bibliothèque Xbox Live

Intégration de `xbl.io`, précédée d'une exploration en lecture seule pour établir les
faits avant de proposer un plan :

- clé valide (`200` côté serveur), compte identifié ;
- **CORS bloqué** en navigateur → relais nécessaire ;
- bon endpoint : `player/titleHistory` → **164 titres**, avec `name`, `devices`,
  `displayImage`, `lastTimePlayed` ;
- **aucun temps de jeu** exposé par cet endpoint.

Six points ont été soumis à validation avant codage, dont trois limites structurelles :
l'API expose **l'historique joué et non les achats** ; il n'y a **pas de date d'achat**
(la date de sortie est donc récupérée en croisant RAWG) ; et les noms diffèrent entre
français et anglais, d'où un **écran de prévisualisation obligatoire** avec décochage
manuel.

Sur 164 titres, le filtrage (appareils console + liste noire d'applications) en retient
~150 : sont écartés les entrées PC-only/Win32 et les applications comme « Xbox App on
PC », « Minecraft Launcher » ou « Microsoft Solitaire Collection ».

### Phase 7 — Filtres, recherche, rétrocompatibilité

- **Filtre Format** (Tous / Physique / Démat), combinable avec plateforme, statut et
  recherche.
- **Un tri « Format » a été ajouté puis retiré** : il avait été demandé, puis jugé non
  souhaité. Il n'en reste aucune trace.
- **Recherche restreinte** au titre, au genre et au tag. La description était incluse et
  polluait les résultats (un mot du résumé faisait remonter des jeux sans rapport).
  Ajout au passage de l'insensibilité aux accents : « creatif » trouve le genre
  « Créatif ».
- **Rétrocompatibilité généralisée** : le filtre d'une plateforme récente affiche ses jeux
  natifs **plus** ceux de la génération précédente marqués `backCompat` — d'abord pour
  Xbox Series X, puis pour Switch 2, via une table déclarative `BACK_COMPAT`.
- **Badge et exception par jeu** : badge « 🔄 Compatible Series X » / « 🔄 Compatible
  Switch 2 », et un toggle pour marquer les rares titres incompatibles.

> **Un piège évité de justesse** : le rattrapage qui passait les jeux Switch 1 à
> `backCompat = true` s'exécutait **à chaque chargement**. Il aurait donc écrasé
> systématiquement le choix manuel du nouveau toggle. Remplacé par une **migration
> versionnée par jeu** (`bcV`) : le rattrapage ne joue qu'une fois. Vérifié en
> rechargeant la page après avoir décoché un jeu.

### Phase 8 — Mise en ligne

Le passage en ligne a d'abord été discuté, pas codé. Deux blocages sérieux ont été
identifiés avant toute action :

1. **Trois clés API étaient committées** dans l'historique git.
2. **GitHub Pages est purement statique** : SteamGridDB et xbl.io, qui exigent un relais,
   ne pouvaient pas fonctionner.

L'orientation initiale (Vercel/Netlify pour leurs fonctions serverless) a été **révisée
deux fois grâce aux apports de l'utilisateur** :

- l'idée des **GitHub Actions** : elles règlent le secret des clés utilisées au build,
  mais **pas le CORS à l'exécution** — une Action ne tourne pas pendant que l'utilisateur
  navigue ;
- l'idée de **saisir les clés à la main dans l'application** : c'est elle qui a débloqué
  toute l'architecture. Le dépôt n'a plus aucun secret, et surtout **le relais CORS n'a
  plus rien à protéger** — il devient un simple transmetteur, ce qui annulait l'objection
  faite plus tôt contre les proxys CORS génériques.

Architecture finale retenue, entièrement gratuite :

```
Navigateur (clés dans localStorage)
   ├──► RAWG · Wikipédia · Wikidata          (appels directs, CORS ouvert)
   └──► Cloudflare Worker (aucun secret)  ──► SteamGridDB · xbl.io
```

Sept phases d'exécution ont suivi : réglages, Worker, branchement, PWA, purge de
l'historique, déploiement, vérifications.

---

## 3. Architecture finale

```
├── .github/workflows/deploy.yml   Build Vite + publication GitHub Pages (aucun secret)
├── worker/                        Relais CORS Cloudflare (aucun secret) + sa doc
├── public/                        Icônes PWA 192/512 (any + maskable), favicon
├── src/App.jsx                    Toute l'application (~1550 lignes)
├── vite.config.js                 base '/game-library/', PWA, proxys de dev
├── README.md · PROGRESS.md · JOURNAL.md
└── LICENSE                        MIT
```

**Stockage navigateur** — deux entrées volontairement séparées :

| Clé | Contenu | Dans l'export JSON ? |
|---|---|---|
| `gl_v2` | Les jeux | ✅ oui |
| `gl_keys` | Les clés API + URL du relais | ❌ **jamais** |

Cette séparation est délibérée : un export doit pouvoir être partagé ou sauvegardé sans
fuiter de clé. Conséquence assumée : sur un nouvel appareil, il faut importer l'export
**et** ressaisir les clés.

**Sources et accès :**

| Source | Clé | CORS | Accès |
|---|---|---|---|
| RAWG | oui | ✅ | direct |
| Wikipédia FR | non | ✅ | direct |
| Wikidata | non | ✅ | direct |
| SteamGridDB | oui | ❌ | via le Worker |
| xbl.io | oui | ❌ | via le Worker |

En développement, le proxy du serveur Vite joue exactement le rôle du Worker — il relaie
sans détenir de clé. Il n'est donc pas nécessaire de déployer le Worker pour travailler
en local.

---

## 4. Décisions structurantes

| Décision | Pourquoi |
|---|---|
| **Clés saisies par l'utilisateur** | Une application statique n'a nulle part où cacher un secret : toute clé embarquée serait lisible dans le bundle *et* dans le dépôt public |
| **Relais CORS sans secret** | Puisque la clé vient du client, le relais n'a rien à protéger : rien à faire tourner, rien à renouveler, et le dépôt reste sain |
| **Double liste blanche dans le Worker** | Origines *et* cibles autorisées : ce n'est pas un proxy ouvert que n'importe qui pourrait détourner |
| **Descriptions Wikipédia seulement** | Un texte français déjà rédigé bat une traduction automatique soumise à quota |
| **Wikidata plutôt que scraping d'infobox** | Données structurées et stables, pas de parsing HTML fragile |
| **Déploiement par artefact** | Aucun fichier généré n'entre dans le dépôt (contrairement à un `docs/` commité) |
| **`npm install` et non `npm ci` en CI** | Le lockfile ne réconcilie pas les binaires natifs transitifs entre Windows et Linux |
| **Table `BACK_COMPAT` déclarative** | Une seule règle lisible couvre Xbox et Switch, et reste extensible |
| **Migration versionnée `bcV`** | Un rattrapage automatique ne doit jamais écraser un choix manuel |
| **`addedDate` comme date de sortie** | Faute de champ dédié ; approximatif pour quelques titres anciens, assumé pour rester simple |
| **Purge d'historique avant le premier push** | Les clés n'ayant jamais quitté la machine, il devenait inutile de les régénérer |

---

## 5. Bugs notables et leurs causes

Cette section est probablement la plus utile à relire.

### Écran blanc après un ajout de code (TDZ)

Le build passait, l'application ne s'affichait plus. Cause : une constante `emptyState`
placée **avant** les variables de couleur qu'elle utilise — une `const` n'est pas hoistée,
d'où `ReferenceError: Cannot access 'mut' before initialization`. Invisible au build
(erreur d'exécution), révélée uniquement par le navigateur. Correctif : déplacer la
déclaration après les couleurs.

**Leçon** : un build vert ne prouve rien sur le rendu.

### Jaquettes Xbox toutes cassées en ligne — deux bugs superposés

Le plus vicieux du projet, car **strictement invisible en développement** (la page locale
est servie en `http://localhost`, où la règle du contenu mixte ne s'applique pas).

1. **134 images en `http://`** → bloquées en contenu mixte sur un site HTTPS.
2. **26 images sur `images-eds.xboxlive.com`**, un hôte **qui ne répond pas en TLS** :
   les passer bêtement en `https` produisait `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`.
   Microsoft publie une variante `images-eds-ssl.xboxlive.com` — vérifiée à 200 OK.

Le helper `httpsImage` bascule d'abord d'hôte, puis force le schéma. Résultat mesuré :
**26 images cassées → 1** sur 245. Sans ce correctif, **chaque jeu importé depuis Xbox
aurait gardé une jaquette cassée définitivement**.

### La recherche Wikipédia qui remontait la mauvaise page

`opensearch` matche par préfixe et ne trouvait pas les titres français ; puis, une fois
passé à la recherche plein-texte, le **premier** résultat d'un jeu de série est la page de
la *série*. Deux correctifs successifs : changement d'endpoint, puis sélection du meilleur
titre (exact → préfixe → premier).

### Éditeurs Wikidata absents

`Rockstar Games` ne remontait pas alors que l'entité existe. Cause : Wikidata range les
noms propres sous le code langue **`mul`** (multilingue), pas `fr` ni `en`. Correctif :
résolution `fr` → `en` → `mul`.

### Liste de suggestions coupée

Le panneau SteamGridDB était en `position: absolute` à l'intérieur d'une carte en
`overflow: hidden` : tout ce qui dépassait était rogné. Correctif : passage en flux normal
avec `max-height` et défilement propre.

### Trois blocages au moment de publier

| Symptôme | Cause réelle | Correctif |
|---|---|---|
| `npm ci` échoue en CI | Binaires natifs transitifs (`@emnapi`, via Rollup) non réconciliés entre lockfile Windows et runner Linux | `npm install` |
| `push declined due to email privacy restrictions` | Le compte GitHub bloque l'exposition de l'adresse e-mail | Réécriture des commits sur l'adresse `noreply` |
| `wrangler deploy` refuse de publier | Aucun sous-domaine `workers.dev` enregistré sur le compte | Enregistrement du sous-domaine |

---

## 6. Approches essayées puis abandonnées

Documenter les impasses évite de les refaire.

| Approche | Pourquoi abandonnée |
|---|---|
| **Traduction via l'API Anthropic** | `401 x-api-key header is required`. Sans clé l'appel échoue toujours ; avec une clé côté navigateur, elle serait publique |
| **Traduction via MyMemory** | Fonctionnait, mais qualité automatique, limite de 500 caractères par requête et quota journalier par IP. Remplacée par Wikipédia FR |
| **`opensearch` (Wikipédia)** | Matche par préfixe : ne retrouvait pas les titres français |
| **Proxy CORS générique** (type `cors-anywhere`) | Aurait obligé le navigateur à envoyer lui-même la clé, la rendant visible dans le bundle. Un Worker dédié coûte pareil — rien — sans ce défaut |
| **Proxys CORS publics hébergés** | Les clés transiteraient par un serveur tiers non contrôlé. Rédhibitoire pour xbl.io, qui donne accès au compte Xbox Live |
| **Vercel / Netlify** | Écartés après l'idée des GitHub Actions puis celle des clés saisies par l'utilisateur, qui rendaient GitHub Pages suffisant |
| **Dossier `docs/` commité** | Aurait fait entrer des artefacts de build dans le dépôt |
| **Tri « Format »** | Ajouté sur demande, puis retiré : seul le *filtre* était voulu |
| **Import Nintendo** | Voir ci-dessous |

### Le cas Nintendo

Recherche menée sur GitHub avant de conclure. **Nintendo n'expose aucune API de
bibliothèque ni d'achats.** Les projets « eShop API » trouvés (3★, 0★, abandonnés entre
2020 et 2022) concernent le **catalogue** — prix et métadonnées — pas le compte de
l'utilisateur.

Le seul projet sérieux est [`nxapi`](https://github.com/samuelthomas2774/nxapi)
(611★, maintenu), non officiel. Ce qu'il permet réellement :

- accès aux relevés du **contrôle parental** → jeux *joués* et temps de jeu ;
- mais : enregistrement d'une console requis, **login Nintendo interactif** (pas une clé
  d'API), API rétro-conçue que Nintendo peut casser à tout moment, et une section entière
  du README consacrée au **risque de bannissement de compte** ;
- à noter tout de même : la partie contrôle parental **n'exige pas** de service tiers
  d'authentification, contrairement à l'API NSO qui fait transiter le jeton de session par
  un serveur externe (imink/flapg) — ce qui aurait été rédhibitoire.

**Conclusion** : ce serait un projet à part entière au résultat fragile, sans commune
mesure avec le simple en-tête `X-Authorization` de xbl.io.

---

## 7. État final

| | |
|---|---|
| **En ligne** | https://antoniman31.github.io/game-library/ |
| **Dépôt** | https://github.com/antoniman31/game-library (public, MIT) |
| **Relais** | `https://game-library-proxy.antoniman31.workers.dev` |
| **Bibliothèque** | 94 jeux de départ · 6 statuts · 4 plateformes |
| **Code** | ~1550 lignes dans un fichier · lint sans avertissement |
| **PWA** | Manifest, service worker Workbox, icônes 192/512 (any + maskable) |
| **Secrets** | **Aucune clé dans les fichiers ni dans l'historique git** (revérifié sur les trois) |
| **Coût** | 0 € — GitHub Pages, Actions, Cloudflare Workers et toutes les API utilisées sont sur des offres gratuites |

**Sources intégrées** : RAWG, Wikipédia FR, Wikidata, SteamGridDB, xbl.io.

---

## 8. Ce qui reste

**À faire sur chaque appareil** (rien n'est synchronisé) :

1. Coller les trois clés **et** l'URL du relais dans l'onglet ⚙️, puis « Tester ».
2. Transférer la bibliothèque : **Stats → Exporter** depuis l'ancien appareil,
   **Stats → Importer** sur le nouveau.
3. Sur mobile : « Installer l'application » depuis le menu du navigateur.

**Pistes ouvertes, volontairement non traitées :**

- **Notifications push pour les prêts dépassant 30 jours** — l'application calcule déjà
  l'alerte, et le pattern VAPID est déjà éprouvé dans un autre projet de l'auteur.
- **Synchronisation multi-appareils** — aujourd'hui l'export/import JSON est le seul pont.
- **Parcours SteamGridDB de bout en bout en ligne** — validé par le bouton « Tester »,
  mais le choix d'une jaquette depuis une fiche n'a pas été rejoué en production.
- **Import Nintendo** — voir section 6.

**Points de vigilance :**

- Après un déploiement, le service worker sert l'ancienne version : **la nouvelle
  s'applique au chargement suivant**. Fermer et rouvrir l'application si un changement
  n'apparaît pas.
- Le classement Xbox One / Series X repose sur `addedDate` : approximatif pour les titres
  antérieurs à la Xbox One (Halo 4, sorti en 2012 sur Xbox 360, est classé Xbox One).
- `localStorage` n'est pas un coffre-fort : les clés y sont lisibles par tout script
  s'exécutant sur la page. Acceptable pour une application personnelle sans contenu tiers.
