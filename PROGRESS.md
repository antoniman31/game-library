# Game Library — État du projet

> Pour l'historique des décisions, les bugs rencontrés et les approches abandonnées,
> voir [`JOURNAL.md`](JOURNAL.md). Pour l'installation et la configuration,
> voir [`README.md`](README.md).

Application de gestion de bibliothèque de jeux vidéo (Xbox / Switch), usage perso.
Dernière mise à jour : 2026-09-04.

## Stack & lancement

- **Vite + React** (React 19, Vite 8), projet **100 % local** (aucun backend applicatif).
- Interface découpée : `src/App.jsx` (ossature), `src/components/` (fiches, modales,
  panneaux glissants), `src/lib/` (réseau, domaine, statistiques, stockage,
  synchronisation). Les couleurs sont des jetons CSS dans `src/index.css`, basculés
  par `data-theme` sur `<html>`.
- Persistance : **localStorage** (clé `gl_v2`), plus une **sauvegarde sur le Worker**
  (⚙️ → Sauvegarde) pour partager la bibliothèque entre appareils.
- Démarrer le dev :
  ```bash
  npm install   # première fois
  npm run dev   # http://localhost:5173/game-library/
  ```
- Build de prod : `npm run build`. Vérifications : `npm run lint`, `npm test`
  (88 tests + 29 vérifications du Worker).
- **En ligne (PWA installable)** : https://antoniman31.github.io/game-library/
  — déploiement automatique par GitHub Actions à chaque push sur `main`.

## Sources de données & clés

⚠️ **Aucune clé n'est présente dans le code ni dans le dépôt.** Chacun saisit les
siennes dans **⚙️ → Services** ; elles sont stockées sur l'appareil (`localStorage`
clé `gl_keys`, volontairement séparée de `gl_v2` pour ne jamais partir dans l'export
JSON). Un bouton « Tester » valide chaque clé. Une fois renseignée, chaque clé passe
en lecture seule, avec « Modifier » et « Supprimer » séparés et confirmés.

- **RAWG** (jaquettes, Metacritic, genres, dates de sortie) — appels directs, CORS ouvert.
- **Wikipédia FR** (titre officiel + description) et **Wikidata** (infobox) — sans clé, CORS ouvert.
- **SteamGridDB** (jaquettes verticales) et **xbl.io** (bibliothèque Xbox) — ces deux API
  refusent les appels navigateur (pas de CORS). Elles passent par un **relais Cloudflare
  Worker** (`worker/`) qui **ne détient aucun secret** : il ne fait que transmettre la clé
  envoyée par le client, avec liste blanche d'origines *et* de cibles. Son URL se règle
  dans ⚙️ → Services. En développement, le proxy Vite joue le même rôle (sans clé lui non plus).

## Fonctionnalités livrées

### La fiche de jeu

- **Tout est modifiable.** « Modifier la fiche » ouvre un panneau qui laisse corriger
  ce que les sources automatiques ont écrit : titre, plateforme, format,
  rétrocompatibilité, genres, note, date d'ajout, description, jaquette, et jusqu'aux
  champs Wikidata. La saisie passe par un brouillon local — « Annuler » retrouve
  vraiment l'état d'avant — et refuse ce qui casserait le modèle (note hors bornes,
  date invalide, plateforme inconnue).
- **Accordéons repliés** : « 🔗 Liens & contenu » (recherches YouTube / JVC / IGN +
  3 liens personnels) et « 📝 Notes ». Toujours visibles : l'identité du jeu,
  l'infobox Wikidata, et le bloc **Prêt** — la seule action qu'on répète.
- Description repliée avec « Lire la suite ».
- Les quatre sources (correction manuelle, RAWG, titre français, jaquette) s'ouvrent
  en **panneau au premier plan**, pas à l'intérieur de la fiche.

### Sources d'enrichissement par jeu

- **🔄 RAWG** : ré-associe un jeu mal matché → remplace jaquette, Metacritic, genres.
- **🇫🇷 Titre français (Wikipédia)** : recherche full-text FR → titre commercial
  officiel, puis au choix le **résumé**, la **jaquette** d'infobox et les **infos
  Wikidata**, chacun applicable indépendamment.
- **📦 Jaquette SteamGridDB** : vignettes verticales 600×900, 3 par ligne.

### Actions de masse (panneau ⋯)

- **Actualiser les descriptions** : régénère toutes les descriptions depuis
  Wikipédia FR. Annulable, délai anti-rate-limit (~150 ms), bilan de fin avec la
  liste des jeux sans page trouvée, meilleure correspondance de titre
  (exact → préfixe → premier résultat). Comme il **remplace** tout, y compris ce qui
  a été corrigé à la main, il demande confirmation en disant combien.
- **Compléter les notes** : cherche sur RAWG les Metacritic manquants, puis affiche
  un **rapport vérifiable** — pour chaque note, le titre RAWG qui a répondu. Un
  rapprochement douteux est marqué ⚠️ et se retire d'un bouton.
- **Importer Xbox** (voir plus bas).

### Import de la bibliothèque Xbox Live (xbl.io)

- Récupère l'historique de jeux du compte lié à la clé (`player/titleHistory`).
- **Filtrage** : sur ~164 titres renvoyés, seuls les vrais jeux console sont gardés
  (~150) — entrées PC-only / Win32 et apps/launchers exclues.
- **Écran de prévisualisation** obligatoire : jaquette, plateformes, marquage
  « Nouveau » / « Déjà présent » (titre normalisé), compteurs, tout cocher/décocher,
  cases individuelles pour écarter les doublons FR/EN.
- **Création** : `format: "démat"`, jaquette xbl.io immédiate, **date d'ajout = date
  de sortie officielle croisée via RAWG** (repli : dernière session, puis date du
  jour), plateforme Xbox One / Series X déduite, `backCompat` cohérent, arrêt possible.
- **Enrichissement post-import** proposé en bannière, best-effort et annulable.
- ⚠️ L'API expose l'**historique joué**, pas les achats. Aucun temps de jeu.

### Prêts

- Prêter un jeu : nom de l'emprunteur, et **date de retour facultative**.
- **Alerte** : la date convenue quand elle existe, sinon un seuil de 30 jours. Un
  seuil unique traitait de la même façon le jeu passé à un frère pour le week-end et
  celui confié à un collègue pour l'été.
- « ✓ Rendu » **archive** le prêt au lieu de l'effacer : la fiche rappelle à qui le
  jeu a déjà été confié et combien de temps, l'onglet Prêts liste les retours sous
  « Déjà rendus ». L'historique est borné à 20 entrées par jeu, garde la date de
  retour convenue, et voyage dans l'export.
- Un prêt **saisi par erreur** s'efface sans être archivé, et chaque ligne
  d'historique porte sa croix : sans ça, un essai fausse les moyennes pour toujours.
- Bouton **SMS** de relance (lien `sms:` pré-rempli).

### Statistiques

Deux sous-onglets. Chaque bloc disparaît quand il n'a rien à dire.

- **Circulation** : nombre de prêts, durée moyenne, jamais prêtés, taux de rotation,
  personnes distinctes, qui emprunte le plus et qui garde le plus longtemps, rythme
  mensuel sur un an, ce qui est dehors trié par ancienneté, et la **ponctualité**
  (a-t-il rendu à la date dite — seuls les prêts rendus avec date convenue comptent).
- **Collection** : plateformes, formats, genres, note moyenne **et médiane**, moyenne
  par plateforme et par genre (3 jeux notés minimum), âge des jeux d'après leur date
  de sortie Wikidata, délai médian entre sortie et achat, rythme d'ajout, studios et
  séries, complétude — plus les **doublons possibles** et les **épisodes manquants**
  déduits des champs « précédent / suivant » de Wikidata.
- Un bouton **Recalculer** relit l'heure : les chiffres suivent la bibliothèque en
  direct, seuls les jours écoulés se figent quand l'app reste ouverte plusieurs jours.

### Plateformes & rétrocompatibilité

- L'ancienne plateforme « Xbox » est **séparée automatiquement** en Xbox One /
  Xbox Series X selon `addedDate` (seuil 10/11/2020). Migration **idempotente**.
- **Règle déclarative** (`BACK_COMPAT` dans `src/lib/model.js`) : une plateforme
  récente affiche ses jeux natifs **+** ceux de la précédente marqués `backCompat`.
  Xbox Series X → + Xbox One ; Switch 2 → + Switch 1 ; les anciennes restent strictes.
- Badge « 🔄 Compatible Series X » / « Compatible Switch 2 ».
- **Choix manuel** dans le panneau d'édition pour les rares exceptions. Il disparaît,
  et la valeur avec lui, si l'on choisit une plateforme sans console parente.
- Protégé par une **migration versionnée par jeu** (`bcV`) : le rattrapage ne
  s'applique qu'une fois, un choix manuel n'est jamais réécrasé.

### Sauvegarde

- **Synchronisation par code** (⚙️ → Sauvegarde) : dépose la bibliothèque sur le
  Worker et la reprend ailleurs, avec le même code de 26 caractères. Elle emporte
  aussi l'**apparence**, et les **clés des services** si l'on coche la case prévue,
  décochée par défaut. Le code reste sur l'appareil et ne part jamais dans l'export.
- **Copie hors ligne** : Export / Import JSON, en mode remplacer ou fusionner.
- Un envoi qui écraserait le travail d'un autre appareil est **refusé** (409) : l'app
  pose le choix, chiffres en main.
- L'import ne fait pas confiance au fichier : date illisible, plateforme inconnue,
  format inventé ou note en toutes lettres sont ramenés à une valeur sûre, et le
  nombre d'entrées corrigées est annoncé.

### Organisation & interface

- **Recherche** sur titre + genre + tag, insensible à la casse et aux accents. La
  description est volontairement exclue (trop de faux positifs).
- **Filtres** combinables : plateforme, prêt, format. **Tri** : A-Z, date, Metacritic.
- **Vues** liste et grille (jaquettes 2:3), liste paginée par 30.
- **Trois modes de thème** : automatique (suit le téléphone, y compris quand il
  bascule le soir), clair, noir profond. Bouton dans l'en-tête, choix dans ⚙️.
- **Panneaux glissants** pour les filtres, les actions et les sources : Échap ferme,
  et la page cesse de défiler derrière.
- **Suppression** : confirmation qui dit ce qui part avec le jeu, puis toast
  « Annuler » de 5 s.
- **Bannière de mise à jour** quand une nouvelle version a pris la main
  (`controllerchange`) : l'onglet ouvert exécute encore l'ancien code.

## Limites connues

- **SteamGridDB et xbl.io nécessitent le relais** : sans Worker déployé (et son URL
  renseignée dans ⚙️), ces deux sources restent indisponibles en ligne.
- **Le Worker ne se déploie pas avec le site.** GitHub Pages ne publie que `dist/` ;
  toute modification de `worker/index.js` demande un `npx wrangler deploy` séparé.
- **xbl.io** : historique joué ≠ bibliothèque achetée ; pas de temps de jeu exposé.
- **Jaquettes xbl.io réécrites en HTTPS** (`httpsImage`) : l'API les sert en `http://`
  et une partie via `images-eds.xboxlive.com`, hôte sans TLS. Invisible en dev.
- **Pas d'import Nintendo possible** : aucune API de bibliothèque ou d'achats. La
  bibliothèque Switch a été reconstituée à la main depuis les reçus d'achat par mail.
- **Wikidata** est parfois incomplet (jeux Nintendo ou très récents) : affichage
  best-effort, sans casser la fiche.
- **Le classement Xbox One / Series X repose sur `addedDate`**, faute de date de
  sortie stockée séparément.
- **Contraste du thème clair** : le vert et le rouge tournent entre 2,83 et 4,39:1 là
  où WCAG AA demande 4,5:1, et le blanc sur l'accent du thème sombre est à 3,00:1.
  Mesuré, non corrigé — ça touche l'identité visuelle.

## Fait récemment

- **Audit complet** : validation des valeurs à l'import (une date illisible produisait
  des `NaN` jusque dans les moyennes de l'onglet Stats), fiche qui se rouvrait toute
  seule, Échap sans effet sur les panneaux, page qui défilait derrière eux, accent du
  thème clair sous la limite de lisibilité, manifeste PWA resté au thème précédent.
- **Statistiques** refaites : deux sous-onglets, ponctualité, rotation, âge de la
  collection, doublons et épisodes manquants.
- **Noir profond** en remplacement du sombre bleu nuit.
- **Préférences dans la sauvegarde en ligne** (apparence toujours, clés sur demande).
- **Worker** : horodatage strictement croissant — deux envois dans la même
  milliseconde portaient le même, et l'appareil resté en arrière écrasait l'autre en
  silence.
- **Confirmations** sur tous les gestes irréversibles, et champs sensibles
  verrouillés.
- **Panneau d'édition** : plus rien n'est en lecture seule dans une fiche.

## Garde-fous contre la dérive silencieuse

Deux duplications existent, toutes deux délibérées, et `src/lib/coherence.test.mjs`
les surveille — l'idée vient du `check_sources_sync.py` de gta6-backend, où une
divergence entre deux copies d'une même liste était restée invisible des semaines.

- Le script anti-clignotement d'`index.html` réécrit `resoudreTheme()` et les
  couleurs de `COULEUR_BARRE` : il s'exécute avant que le bundle existe, donc il
  ne peut rien importer. Le test **exécute réellement** ce script inline dans un
  contexte minimal et compare son verdict à celui d'`apparence.js`, pour toutes
  les valeurs possibles de `gl_theme` croisées avec le réglage du système. Il
  compare des comportements, pas des chaînes : une réécriture qui change la forme
  sans changer le résultat ne fait pas échouer la CI.
- Chaque jeton nommé par `theme.js` doit être défini dans `index.css`, **et
  redéfini pour le thème clair**. Un jeton nommé mais jamais défini rend du vide :
  l'élément perd sa couleur et rien n'échoue.

## Prochaines étapes

- **Déployer le Worker** (`cd worker && npx wrangler deploy`) : trois changements
  l'attendent, dont le correctif d'écrasement silencieux. Rien ne le fait
  automatiquement — un déploiement par GitHub Actions demanderait un secret
  `CLOUDFLARE_API_TOKEN` dans le dépôt, ce qui n'a jamais été mis en place.
- **Relais déployé** : `https://game-library-proxy.antoniman31.workers.dev`
  — à coller dans ⚙️ sur chaque nouvel appareil.
- Passer `npm run audit -- export.json` sur la vraie bibliothèque : le script n'a
  jamais vu autre chose que des données de test.
- Trancher le contraste du thème clair (voir Limites connues).

## Structure

```
game-library/
├── index.html            ← script anti-clignotement du thème
├── package.json
├── .github/workflows/    ← deploy.yml : lint, tests, build, publication Pages
├── worker/               ← relais CORS + sauvegarde KV (sans secret) + tests
├── scripts/audit.mjs     ← audit des données d'un export (pas un test)
├── vite.config.js        ← base '/game-library/', PWA, proxys de dev (sans clé)
├── PROGRESS.md           ← ce fichier
└── src/
    ├── App.jsx           ← ossature : état global, en-tête, onglets
    ├── main.jsx          ← montage + garde-fou d'erreurs global
    ├── index.css         ← jetons de thème, animations, survol
    ├── lib/              ← api, model, stats, apparence, preferences,
    │                       garde-fous, maj, seed, storage, sync, theme
    │                       (+ *.test.mjs, dont coherence.test.mjs qui
    │                        surveille ce qui est écrit deux fois)
    └── components/       ← GameCard, AddModal, ImportModal, StatsView,
                             SettingsView, ScoresSheet, Sheet, FiltersSheet,
                             ActionsSheet, SousOnglets, Cover, InfoboxView,
                             ChampProtege, ErrorBoundary
```
