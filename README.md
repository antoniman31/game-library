# Game Library

Bibliothèque de jeux vidéo personnelle (Xbox / Switch) : catalogue, prêts,
statistiques, et enrichissement automatique des fiches depuis plusieurs bases
de données publiques.

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
2. Aller dans l'onglet **⚙️ → Services** et saisir ses clés API (voir
   ci-dessous). Sans clé, l'application fonctionne mais sans jaquettes ni
   enrichissement.
3. Sur mobile : menu du navigateur → **« Installer l'application »** / « Ajouter à
   l'écran d'accueil ».
4. Pour transférer une bibliothèque existante, deux chemins depuis **⚙️ →
   Sauvegarde** : la **synchronisation par code** (elle emporte aussi
   l'apparence, et les clés si on coche la case), ou la **copie hors ligne**
   Exporter / Importer, qui ne demande aucun relais.

---

## Configuration des clés API

⚠️ **Le dépôt ne contient aucune clé.** Chacun saisit les siennes dans
**⚙️ → Services** ; elles sont enregistrées **sur l'appareil** (`localStorage`,
entrée `gl_keys`) et ne transitent que vers les services concernés.

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
puisse être partagée ou stockée sans fuite. La synchronisation en ligne peut,
elle, les emporter — mais seulement si l'on coche une case prévue pour, décochée
par défaut (voir [Sauvegarde](#sauvegarde)).

Une fois renseignée, chaque clé passe en **lecture seule** avec un cadenas :
« Modifier » et « Supprimer » sont deux boutons distincts, chacun demandant
confirmation. Ces valeurs n'existent nulle part ailleurs — ni dans l'export, ni
dans le dépôt — et se perdaient d'un doigt qui glisse.

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
La coller dans **⚙️ → Services → « Relais CORS »** → Enregistrer.

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
- **Filtres combinables** : plateforme, prêt (chez moi / prêtés), format (physique / démat).
- **Tri** : A-Z, date, Metacritic.
- **Tout est modifiable** : « Modifier la fiche » ouvre un panneau qui laisse
  corriger ce que les sources automatiques ont écrit — titre, plateforme,
  format, rétrocompatibilité, genres, note, date, description, jaquette et
  jusqu'aux champs Wikidata. Avant, une erreur de RAWG ne se corrigeait qu'en
  supprimant le jeu pour le recréer.
- **Trois modes de thème** : automatique (il suit le réglage du téléphone, y
  compris quand celui-ci bascule le soir), clair, et noir profond.
- **Suppression avec toast « Annuler »** (5 s), précédée d'une confirmation qui
  rappelle ce qui part avec le jeu.

### Prêts

C'est le seul état que l'application suive : ce jeu est-il chez moi, ou dehors ?

- Prêter un jeu — nom de l'emprunteur, et **date de retour facultative**.
- **Alerte** : la date convenue quand elle existe, sinon un seuil de 30 jours.
  La bande sous la jaquette passe à l'orange, la fiche et l'onglet Prêts
  signalent le retard.
- « ✓ Rendu » **archive** le prêt au lieu de l'effacer : la fiche rappelle à qui
  le jeu a déjà été confié et combien de temps, l'onglet Prêts liste les retours
  sous « Déjà rendus », et l'onglet Stats indique à qui l'on prête le plus.
  L'historique est borné à 20 entrées par jeu et voyage dans l'export.
- Bouton **SMS** de relance (lien `sms:` pré-rempli).
- Un prêt **saisi par erreur** s'efface sans être archivé, et chaque ligne de
  « Déjà rendus » porte sa croix : sans ça, un essai fausse les moyennes pour
  toujours. Les deux gestes demandent confirmation.

### Fiche de jeu

Chaque fiche se déplie et regroupe, en accordéons repliés par défaut :
**🔗 Liens & contenu** (recherches YouTube / JVC / IGN + 3 liens personnels) et
**📝 Notes**. Restent toujours visibles : l'identité du jeu, l'infobox Wikidata
et le bloc **Prêt**, seule action qu'on répète. La description est repliée avec
un « Lire la suite ».

Le format et la rétrocompatibilité ont quitté la fiche pour le panneau
d'édition : on les règle une fois dans la vie d'un jeu, alors qu'ils occupaient
une place permanente. Les pastilles « démat » et « 🔄 Compatible Series X » en
haut de la carte continuent de les annoncer.

Les quatre sources — correction manuelle, RAWG, titre français, jaquette —
s'ouvrent en **panneau au premier plan** plutôt qu'à l'intérieur de la fiche,
qui devenait interminable.

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

**Bouton « Actualiser les descriptions »** (panneau ⋯ Actions) : régénère la description de
toute la bibliothèque depuis Wikipédia. Il est **annulable en cours de route**,
respecte un délai anti-rate-limit (~150 ms) et affiche en fin de course la
**liste des jeux sans page Wikipédia trouvée**. Il retient le **meilleur titre**
(exact → préfixe → premier résultat) pour éviter de récupérer la page de la
*série* au lieu de celle du jeu — sans quoi « Assassin's Creed Unity » héritait
de la description générique d'« Assassin's Creed ». Comme il **remplace** toutes
les descriptions, y compris celles corrigées à la main, il demande confirmation
en disant combien il va en écraser.

**Bouton « Compléter les notes »** (même panneau) : cherche sur RAWG les scores
Metacritic manquants, puis affiche un **rapport vérifiable** — pour chaque note
trouvée, le titre RAWG qui a répondu. Un rapprochement douteux est marqué ⚠️ et
se retire d'un bouton : sur une centaine de jeux, un titre approximatif finit
toujours par ramener la note d'un autre jeu.

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
un choix **« Jouable sur … : oui / non »** dans le panneau d'édition pour les
rares exceptions — il disparaît, et la valeur avec lui, si l'on choisit une
plateforme sans console parente. Ce choix manuel est protégé par une **migration versionnée par jeu**
(`bcV`) : le rattrapage automatique ne s'applique qu'une fois, il n'écrase donc
jamais une décision prise à la main.

### Statistiques

Deux sous-onglets, parce que les deux familles ne répondent pas à la même
question. Chaque bloc disparaît quand il n'a rien à dire : un « aucune donnée »
répété six fois occupe autant de place qu'un vrai contenu.

**Circulation** — ce qui sort. Nombre de prêts, durée moyenne, jeux jamais
prêtés, taux de rotation de la collection, personnes distinctes, qui emprunte le
plus et qui garde le plus longtemps (ce ne sont pas les mêmes), rythme mensuel
sur un an, ce qui est dehors trié par ancienneté, et la **ponctualité** : a-t-il
rendu quand il l'avait dit, ce qui n'est pas la même question que combien de
temps il a gardé. Ne comptent là que les prêts rendus pour lesquels une date
avait été fixée.

**Collection** — ce qu'on possède. Répartition par plateforme, format et genre,
note moyenne **et médiane** (deux mauvais jeux tirent une moyenne, pas une
médiane), moyenne par plateforme et par genre, âge réel des jeux d'après leur
date de sortie Wikidata, délai médian entre la sortie et l'achat, rythme
d'ajout, studios et séries, et ce qui manque encore à remplir.

S'y ajoutent deux listes qui ne sont pas des statistiques mais qui valent le
reste : les **doublons possibles** — deux fiches sur deux plateformes, c'est
normal ; deux fois la même plateforme, en rouge, est une saisie en double — et
les **épisodes manquants**, déduits des champs « épisode précédent / suivant »
de Wikidata : tu as Halo 5, tu n'as pas Halo 4, l'application te le dit.

Un bouton **Recalculer**, en bas, relit l'heure. Les chiffres suivent la
bibliothèque en direct ; seuls les jours écoulés et la fenêtre des douze mois se
figent quand l'application reste ouverte plusieurs jours.

### Sauvegarde

Tout est dans **⚙️ → Sauvegarde**, où deux blocs répondent au même besoin —
sortir la bibliothèque de cet appareil et l'y ramener — par deux chemins :

- **Synchronisation par code** : dépose la bibliothèque sur le Worker et la
  reprend ailleurs, avec le même code de 26 caractères sur chaque appareil.
  Elle emporte aussi l'**apparence**, et les **clés des services** si l'on coche
  la case prévue — décochée par défaut, parce que cocher change la nature du
  code : il protège une liste de jeux, il protégerait des identifiants. Le code
  lui-même reste sur l'appareil et ne part jamais dans l'export.
- **Copie hors ligne** : Export / Import JSON, en mode *remplacer* ou
  *fusionner*, sans aucun relais à déployer.

Une récupération ne remplace rien sans confirmation, chiffres en main, et les
préférences se reprennent sur une **seconde question** : on vient chercher une
bibliothèque, pas forcément se faire changer son thème.

Un envoi qui écraserait le travail d'un autre appareil est **refusé** : le
Worker compare l'horodatage annoncé à celui qu'il détient et répond 409, et
l'application pose alors le choix au lieu de trancher toute seule.

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
  cover, metacritic,
  lentA, lentDate, lentRetourPrevu,  // prêt en cours, date de retour convenue
  pretsPasses: [{ a, du, au, prevu }],   // historique, borné à 20 par jeu
  myLinks: ["", "", ""], tips, tag,
  backCompat, bcV,                   // rétrocompatibilité + version de migration
  infobox                            // données Wikidata, ou null
}
```

Sept champs ont été **supprimés** par la migration, pas seulement masqués :
`status`, `playedMinutes`, `manualMinutes`, `sessions`, `hltb`, `note`,
`progression`. Les garder ferait croire à des fonctions inexistantes, et ils
voyageaient à chaque écriture et à chaque synchronisation.

**Ce que l'application accepte d'un fichier.** L'import ne fait pas confiance à
ce qu'on lui donne : une date illisible, une plateforme inconnue, un format
inventé ou une note en toutes lettres sont ramenés à une valeur sûre, et le
nombre d'entrées corrigées est annoncé. Le contrôle ne portait que sur les
types — « pas une date » est une chaîne, donc ça passait, et le `NaN` qui en
sortait remontait jusque dans les moyennes de l'onglet Stats, affiché comme une
statistique.

Trois autres clés vivent à part dans le `localStorage`, précisément pour ne
jamais entrer dans l'export : `gl_keys` (clés des services), `gl_sync` (code de
synchronisation) et `gl_theme` (mode d'apparence).

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
- **Le sombre est un vrai noir.** Le noir profond a d'abord été une préférence
  applicable par-dessus un sombre bleu nuit, ce qui faisait quatre commandes
  dans un panneau qui en comptait déjà trois pour la même question — et pour un
  choix qui n'en est pas un : entre un bleu nuit et un vrai noir, on tranche une
  fois. Sur une dalle OLED, un pixel noir est un pixel éteint. Les cartes ne
  sont pas noires elles aussi, sinon plus rien ne se distingue : ce sont les
  bordures, remontées, qui portent la structure.
- **Les gestes irréversibles demandent confirmation, en disant ce qu'ils
  coûtent.** Supprimer un jeu emporte son historique de prêts et le retour
  arrière ne dure que cinq secondes ; effacer une clé nomme le service qui
  cessera de fonctionner ; remplacer le code de synchronisation rend
  inaccessible la sauvegarde qu'il protégeait, ce qui ne se voit pas tout de
  suite. Ces messages vivent dans `src/lib/garde-fous.js`, purs et testés :
  c'est le genre de garde-fou qu'on écrit une fois et qu'on ne relit jamais,
  jusqu'au jour où il ne se déclenche pas.
- **Ce que l'application ne fait pas.** Elle a longtemps suivi la progression
  (non commencé, en cours, terminé, platine, abandonné) et le temps de jeu, avec
  chronomètre et historique de sessions. Les deux ont été retirés : la console
  tient déjà ces données, mieux et sans saisie manuelle. Les redoubler ici
  demandait du travail pour une information qu'on possède ailleurs. Il reste ce
  que la console ne sait pas faire — voir toute la bibliothèque d'un coup, et
  savoir chez qui sont les jeux.
- **Ce qui est écrit deux fois est surveillé.** Le script anti-clignotement
  d'`index.html` réécrit à la main la logique de `resoudreTheme()` et les
  couleurs de barre système — il le doit, il s'exécute avant que le bundle
  existe. Rien n'obligeait ces deux copies à rester d'accord : une couleur de
  fond changée d'un côté et oubliée de l'autre, et la barre d'état affiche
  l'ancienne teinte le temps du chargement, ce que personne ne signale jamais.
  `coherence.test.mjs` exécute le script inline dans un contexte minimal et
  compare son verdict à celui du module, pour toutes les valeurs possibles. Il
  vérifie aussi que chaque jeton nommé par `theme.js` est défini dans les deux
  thèmes. L'idée vient du `check_sources_sync.py` d'un autre projet, écrit après
  qu'une divergence du même genre soit restée invisible plusieurs semaines.
- **Les couleurs sont des jetons, y compris l'accent.** Le bleu était écrit en
  dur une cinquantaine de fois dans le JavaScript ; le jeton `--accent` existait
  mais ne servait à rien, si bien que le thème clair ne pouvait pas le corriger.
  Or sur fond clair il ne donnait que 2,58:1 alors que WCAG AA demande 4,5:1 —
  et c'est la couleur de presque tout le petit texte cliquable. Le thème clair
  le remonte désormais à 5,75:1 ; le sombre garde exactement la même teinte.
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
npm test         # 88 tests (modèle, import, prêts, stats, thème, préférences,
                 #            cohérence des duplications, Worker)
npm run audit -- ma-sauvegarde.json   # symptômes dans les données (voir plus bas)
```

En développement, le proxy du serveur Vite joue exactement le rôle du Worker : il
relaie `/sgdb/*` et `/xbl/*` **sans détenir de clé** (c'est le client qui envoie
l'en-tête d'authentification). Il n'est donc **pas nécessaire de déployer le
Worker pour travailler en local**.

### Auditer ses données

```bash
npm run audit -- ma-sauvegarde.json                # rapport
npm run audit -- ma-sauvegarde.json --jaquettes    # vérifie aussi les URLs (réseau)
npm run audit -- ma-sauvegarde.json --strict       # code de retour ≠ 0 s'il y a des constats

# Sortie JSON, pour comparer deux passages — après un gros import, la question
# n'est pas « combien de constats » mais « lesquels sont apparus ». `--silent`
# est nécessaire : sans lui la bannière de npm précède la sortie et le fichier
# obtenu n'est plus du JSON.
npm run --silent audit -- ma-sauvegarde.json --json > avant.json
```

Les constats sont classés en trois niveaux, du plus grave au moins grave :
**🔴 grave** (une date illisible qui produira des `NaN`, un identifiant en
double qui casse l'édition), **🟠 à vérifier** (une valeur qui n'aurait pas dû
entrer), **⚪ pour information** (un champ vide, à combler quand on veut). Un
rapport à plat mettait « 60 jeux sans jaquette » au même rang qu'« identifiant
en double » : il fallait tout relire pour trouver ce qui compte.

Prend un export JSON et signale : doublons de titre sur une même plateforme,
identifiants réutilisés, champs vides (jaquette, genre, description, note),
valeurs impossibles (plateforme inconnue, format inventé, note hors bornes,
dates illisibles), dates d'ajout à venir, prêts incomplets ou très anciens,
retours antérieurs au prêt, et séries Wikidata éloignées du titre — le signe
qu'une source a répondu pour un autre jeu.

Ce n'est **pas** un test : `npm test` vérifie des invariants et doit rester vert,
l'audit signale des *symptômes* qui peuvent être parfaitement légitimes. Deux
exemplaires du même jeu, c'est possible ; deux entrées identiques après un
import, beaucoup moins.

### Structure

```
├── .github/workflows/deploy.yml   Build + publication GitHub Pages
├── worker/                        Relais CORS + sauvegarde en ligne (sans secret)
│   ├── index.js
│   ├── test.mjs                   29 vérifications, sans dépendance ni déploiement
│   ├── wrangler.toml
│   └── README.md
├── scripts/
│   └── audit.mjs                  Audit des données d'un export (pas un test)
├── public/                        Icônes PWA (192/512, any + maskable), favicon
├── src/
│   ├── App.jsx                    Ossature : état global, en-tête, onglets
│   ├── main.jsx                   Montage + garde-fou d'erreurs global
│   ├── index.css                  Jetons de thème, animations, survol
│   ├── lib/                       Modules purs : testables sans navigateur
│   │   ├── api.js                 RAWG, Wikipédia, Wikidata, SteamGridDB, xbl.io
│   │   ├── model.js               Plateformes, prêts, migration, validation, édition
│   │   ├── stats.js               Agrégats des deux sous-onglets Stats
│   │   ├── apparence.js           Modes de thème et couleur de barre système
│   │   ├── preferences.js         Ce que la sauvegarde emporte en plus des jeux
│   │   ├── garde-fous.js          Messages des confirmations destructrices
│   │   ├── maj.js                 Détection d'une version déjà installée
│   │   ├── seed.js                Bibliothèque de démarrage
│   │   ├── storage.js             localStorage instrumenté (alerte de quota)
│   │   ├── sync.js                Sauvegarde sur le Worker
│   │   ├── theme.js               Alias vers les jetons CSS
│   │   ├── coherence.test.mjs     Ce qui est écrit deux fois doit concorder
│   │   └── *.test.mjs             Tests des modules ci-dessus (node --test)
│   └── components/
│       ├── GameCard.jsx  AddModal.jsx  ImportModal.jsx
│       ├── StatsView.jsx  SettingsView.jsx  ScoresSheet.jsx
│       ├── Sheet.jsx  FiltersSheet.jsx  ActionsSheet.jsx  SousOnglets.jsx
│       └── Cover.jsx  InfoboxView.jsx  ChampProtege.jsx  ErrorBoundary.jsx
├── index.html
├── vite.config.js                 base, PWA, proxys de dev
├── PROGRESS.md                    État des fonctionnalités
└── JOURNAL.md                     Journal de développement : décisions, bugs, impasses
```

---

## Déploiement

Automatique à chaque push sur `main`
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) : `npm ci`,
`npm run lint`, `npm test`, `npm run build`, puis publication de
`dist/` sur GitHub Pages via les actions
officielles `configure-pages` / `upload-pages-artifact` / `deploy-pages`.

**Aucun secret n'est nécessaire** dans le dépôt — c'est toute la raison d'être du
choix « clés saisies par l'utilisateur ».

Le service worker est en `autoUpdate` : une nouvelle version est récupérée
automatiquement au chargement suivant. L'onglet déjà ouvert, lui, continue
d'exécuter l'ancien code — d'où la bannière **« ✨ Nouvelle version »** avec son
bouton Recharger, déclenchée par l'événement `controllerchange`. Sans elle, il
fallait fermer l'application et la rouvrir sans jamais savoir s'il y avait
quelque chose à voir.

⚠️ **Le Worker ne se déploie pas avec le site.** GitHub Pages ne publie que
`dist/` ; toute modification de `worker/index.js` demande un `npx wrangler
deploy` séparé, sinon le relais en ligne reste sur son ancienne version.

---

## Limites connues

- **La synchronisation est manuelle.** ⚙️ → Sauvegarde dépose la bibliothèque
  sur le Worker et la récupère, avec le même code sur chaque appareil ; rien ne
  part ni n'arrive tout seul, et une récupération remplace la bibliothèque
  locale après confirmation. Sans relais déployé, il reste la copie hors ligne.
  Le **code de synchronisation** est à saisir sur chaque appareil — il ne
  figure ni dans l'export ni dans la sauvegarde qu'il protège. Les clés des
  services peuvent voyager, mais seulement si on le demande explicitement.
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
