# Game Library

Ludothèque personnelle (console et PC) : catalogue, prêts, statistiques, et
enrichissement automatique des fiches depuis plusieurs bases publiques.

**➡️ [antoniman31.github.io/game-library](https://antoniman31.github.io/game-library/)** — installable en PWA sur mobile. Une application Android (APK) est construite à la demande.

React 19 + Vite, sans backend applicatif : les données vivent dans le
`localStorage` de l'appareil, et un Worker Cloudflare sert de relais CORS et de
sauvegarde entre appareils.

---

## Sommaire

[Démarrage rapide](#démarrage-rapide) · [Clés API](#clés-api) ·
[Relais CORS](#relais-cors) · [Fonctionnalités](#fonctionnalités) ·
[Sources de données](#sources-de-données) · [Données et sauvegarde](#données-et-sauvegarde) ·
[Développement](#développement) · [Déploiement](#déploiement) ·
[Android](#android) · [Limites connues](#limites-connues) ·
[Documentation](#documentation)

---

## Démarrage rapide

1. Ouvrir [l'application](https://antoniman31.github.io/game-library/).
2. ⚙️ → **Services** : saisir ses clés API (voir ci-dessous). Sans clé, tout
   fonctionne sauf les jaquettes et l'enrichissement.
3. Sur mobile : menu du navigateur → « Installer l'application ».
4. Pour transférer une bibliothèque existante : ⚙️ → **Sauvegarde**, soit par
   **code de synchronisation** (elle emporte aussi l'apparence), soit par
   **export / import JSON** hors ligne, sans relais.

---

## Clés API

⚠️ **Le dépôt ne contient aucune clé.** Chacun saisit les siennes dans ⚙️ →
Services ; elles restent **sur l'appareil** (`gl_keys`) et ne partent que vers
le service concerné. Un bouton « Tester » valide chaque clé.

| Service | Sert à | Obtenir une clé | Obligatoire |
|---|---|---|---|
| **RAWG** | Jaquettes, Metacritic, genres, dates de sortie | [rawg.io/apidocs](https://rawg.io/apidocs) | Recommandé |
| **SteamGridDB** | Jaquettes verticales 2:3 | [steamgriddb.com](https://www.steamgriddb.com/profile/preferences/api) | Optionnel |
| **xbl.io** | Import de la bibliothèque Xbox | [xbl.io/console](https://xbl.io/console) | Optionnel |

Wikipédia, Wikidata et le magasin Steam n'en demandent pas.

Une application statique n'a pas de serveur où cacher un secret : toute clé
embarquée serait lisible dans le bundle et dans le dépôt public. L'export JSON
n'emporte jamais les clés ; la synchronisation ne les emporte que si on coche
une case, décochée par défaut. Détail : [docs/deploiement.md](docs/deploiement.md).

---

## Relais CORS

SteamGridDB et xbl.io n'envoient pas d'en-tête CORS : un navigateur refuse de
lire leurs réponses, même avec une clé valide. Le dossier [`worker/`](worker/)
contient un Worker Cloudflare qui les rétablit. **Il ne détient aucun secret**
(la clé est retransmise telle qu'envoyée) et **n'est pas un proxy ouvert** :
double liste blanche sur les origines appelantes et sur les cibles relayées.

```bash
cd worker && npx wrangler login && npx wrangler deploy
```

Coller l'URL obtenue dans ⚙️ → Services → « Relais CORS ». Un relais est déjà
déployé : `https://game-library-proxy.antoniman31.workers.dev`. Sans relais,
tout fonctionne sauf SteamGridDB, l'import Xbox, les notes Steam et la
synchronisation. En développement, le proxy de Vite joue le même rôle.

---

## Fonctionnalités

Chaque point renvoie au détail dans [`docs/`](docs/).

**Bibliothèque** ([détail](docs/fonctionnalites.md))
- Deux univers, **Console** et **PC** : sur PC la *boutique* remplace la
  plateforme, et un même titre sur plusieurs boutiques n'occupe qu'une carte.
- Recherche insensible à la casse et aux accents (titre, genre) ; filtres par
  plateforme, prêt, format, mode de jeu, genre, note, série et « À compléter » ;
  cinq tris (titre, ajout, sortie, note, hasard) ; vues liste, compacte et grille,
  avec regroupement facultatif.
- Rétrocompatibilité déclarative : Xbox Series X montre ses jeux natifs et ceux
  de Xbox One marqués compatibles ; idem Switch 2 / Switch.
- « Aussi sur PC · Steam » : un jeu possédé sur deux supports se signale seul.
- Fiche modifiable champ par champ ; suppression avec annulation de 5 s.
- Thème automatique, clair ou noir profond ; navigation en bas, une main.

**Prêts** ([détail](docs/fonctionnalites.md))
- Emprunteur, date de retour facultative, alerte de retard, relance par SMS.
- « Rendu » archive le prêt ; l'historique alimente les statistiques.
- L'onglet n'apparaît qu'après le premier prêt, et jamais côté PC.

**Enrichissement** ([détail](docs/enrichissement.md))
- RAWG, Wikipédia FR, Wikidata, SteamGridDB, magasin Steam, jeu par jeu ou en
  masse (⚙️ → Outils). **Une source ne remplit que les champs vides et n'écrase
  jamais** ; la fiche dit d'où viennent ses données.
- Notes Metacritic en trois sources (RAWG, Steam, Wikidata) ; repasser sur
  l'existant ne fait que proposer des changements à cocher.
- Remplissage depuis les autres éditions du même jeu, sans réseau.
- Scan de codes-barres (application Android).

**Imports** ([détail](docs/imports.md))
- **Xbox Live** via xbl.io : historique joué, aperçu obligatoire avant écriture.
- **Playnite** (Steam, Epic, GOG, Amazon) : lecture d'un fichier exporté ; aperçu
  obligatoire, liste des jeux écartés qui ne reviennent pas.

**Statistiques** ([détail](docs/fonctionnalites.md))
- Sous-onglets *Collection* (plateformes, genres, notes moyenne et médiane,
  âge, rythme d'ajout) et *Circulation* (prêts, ponctualité), avec anneaux,
  jauges et courbes dont chaque valeur reste écrite ; côté PC, la boutique
  remplace la plateforme.
- Doublons possibles et épisodes manquants d'une série.

**Sauvegarde** ([détail](docs/fonctionnalites.md))
- Synchronisation par code (26 caractères), manuelle, avec détection de
  conflit ; copie hors ligne JSON avec Fusionner / Remplacer / Annuler.
- Une pastille signale une sauvegarde vieille de plus de sept jours.

**Ce que l'application ne fait pas, volontairement** : suivre la progression ou
le temps de jeu (retirés : la console le tient mieux). Voir
[`JOURNAL.md`](JOURNAL.md), phase 9.

Principes d'interface (cibles tactiles ≥ 44 px, contrastes mesurés, vrais
`<button>`, panneaux accessibles) : [docs/ergonomie.md](docs/ergonomie.md).

---

## Sources de données

| Source | Clé | CORS | Usage |
|---|---|---|---|
| RAWG | oui | ✅ direct | Jaquettes, Metacritic, genres, dates de sortie |
| Wikipédia FR | non | ✅ direct | Titre officiel français, résumé, image d'infobox |
| Wikidata | non | ✅ direct | Développeur, éditeur, sorties, mode de jeu, série, note |
| SteamGridDB | oui | ❌ relais | Jaquettes verticales |
| xbl.io | oui | ❌ relais | Historique Xbox |
| Magasin Steam | non | ❌ relais | Note Metacritic, par appid |
| Playnite (fichier) | non | — | Jeux PC des boutiques et leurs infos IGDB |

---

## Données et sauvegarde

Un jeu est un objet simple persisté sous `gl_v2` (`localStorage`). Quatre clés
vivent à part pour ne jamais entrer dans l'export : `gl_keys` (clés des
services), `gl_sync` (code de synchronisation), `gl_theme` et `gl_affichage`.

Toute donnée venue d'un fichier, du stockage ou de la sauvegarde distante est
traitée comme une entrée non fiable : dates, plateformes et formats invalides
sont ramenés à une valeur sûre, et le nombre de corrections est annoncé. Le
modèle complet, les migrations et les règles de validation sont dans
[docs/donnees.md](docs/donnees.md).

---

## Développement

```bash
npm install
npm run dev          # http://localhost:5173/game-library/
npm run build
npm run lint         # oxlint
npm test             # modules de src/lib, scripts et Worker (node --test)
npm run verif:ui     # mesure les écrans rendus ; demande Playwright et un navigateur
npm run audit -- ma-sauvegarde.json   # symptômes dans les données
```

Lint et tests doivent passer avant tout commit ; `verif:ui` pour tout changement
d'interface. En local, le Worker n'est pas nécessaire. Détail des outils, dont
`scripts/dates-suspectes.mjs` : [docs/outils.md](docs/outils.md). Règles de
travail du projet : [`CLAUDE.md`](CLAUDE.md).

Organisation : `src/lib/` pour la logique pure (un `*.test.mjs` à côté de chaque
module), `src/components/` pour l'interface, `worker/` pour le relais,
`scripts/` pour l'audit et la chaîne Android. Arbre complet :
[docs/architecture.md](docs/architecture.md).

---

## Déploiement

- **Site** : à chaque push sur `main`, `deploy.yml` lance `npm ci`, lint, tests et
  build, puis publie `dist/` sur GitHub Pages. Aucun secret n'est nécessaire.
- **Worker** : `worker.yml` le déploie dès que `worker/**` change sur `main`,
  tests d'abord. Un seul secret, `CLOUDFLARE_API_TOKEN`.
- **Mise à jour** : le service worker récupère la nouvelle version au chargement
  suivant ; une bannière « Nouvelle version » propose de recharger.

Détail : [docs/deploiement.md](docs/deploiement.md).

---

## Android

La même application, empaquetée par Capacitor dans un APK (`--mode android` :
seule différence, la base des chemins et l'absence de service worker).

Le workflow [`android.yml`](.github/workflows/android.yml) se lance à la main
(Actions → « Application Android ») avec une variante, *publication* (réduite,
non débogable, par défaut) ou *débogage*, et dépose l'APK en artefact. Il est
signé par une clé fixe, ce qui permet de mettre à jour sans désinstaller.
`android/` et `assets/` sont engendrés et absents du dépôt.

Le site et l'application sont deux bibliothèques distinctes : utiliser les deux
demande la synchronisation. Comportements propres à la WebView (export, bouton
Retour, liens sortants, barre d'état, jaquettes sur l'appareil) :
[docs/android.md](docs/android.md).

---

## Limites connues

- **La synchronisation est manuelle** : rien ne part ni n'arrive tout seul. Elle
  signale le retard (pastille après sept jours), elle ne le rattrape pas.
- **Deux envois vraiment simultanés peuvent se marcher dessus** : le Worker lit,
  compare, puis écrit, sans verrou sur le KV. Non couvert, peu probable à un seul
  utilisateur.
- **SteamGridDB, l'import Xbox, les notes Steam et la synchronisation exigent le
  relais.**
- **xbl.io** expose l'historique joué, pas les achats, et aucun temps de jeu.
- **Wikidata est incomplet** sur certains jeux (titres Nintendo, très récents) :
  l'infobox s'affiche partiellement.
- **Le classement Xbox One / Series X repose sur `addedDate`**, faute de date de
  sortie séparée ; approximatif pour quelques titres anciens.
- **Les filtres ne survivent pas au lancement, délibérément** ; la vue, le tri et
  le regroupement, si.
- **`localStorage` n'est pas un coffre-fort** : les clés y sont lisibles par tout
  script de la page. Acceptable pour une application personnelle sans contenu tiers.

---

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/fonctionnalites.md`](docs/fonctionnalites.md) | Comportement détaillé : univers, filtres, prêts, stats, sauvegarde |
| [`docs/enrichissement.md`](docs/enrichissement.md) | Sources, notes, jaquettes, règle « ne jamais écraser » |
| [`docs/imports.md`](docs/imports.md) | Imports Xbox et Playnite |
| [`docs/donnees.md`](docs/donnees.md) | Modèle de données, migrations, validation |
| [`docs/ergonomie.md`](docs/ergonomie.md) | Jetons, règles d'interface, garde-fous mesurés |
| [`docs/architecture.md`](docs/architecture.md) | Décisions techniques, performances, arbre du dépôt |
| [`docs/deploiement.md`](docs/deploiement.md) | Clés, relais, publication du site et du Worker |
| [`docs/android.md`](docs/android.md) | APK, signature, spécificités de la WebView |
| [`docs/outils.md`](docs/outils.md) | `verif:ui`, audit des données, dates suspectes |
| [`PROGRESS.md`](PROGRESS.md) | État des fonctionnalités |
| [`JOURNAL.md`](JOURNAL.md) | Chronologie, décisions, bugs, impasses |
| [`TODO.md`](TODO.md) | Liste de travail |

## Licence

[MIT](LICENSE)
