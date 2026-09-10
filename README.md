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
- [Ergonomie et système visuel](#ergonomie-et-système-visuel)
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

### Deux univers — onglets « Console » et « PC »

Une ludothèque de console et une bibliothèque PC ne se décrivent pas avec les
mêmes mots. Sur console, la plateforme dit sur quelle machine le jeu tourne et le
format dit s'il est sur une galette ou dans un compte ; sur PC la machine est
toujours la même, et ce qui distingue un jeu d'un autre est la **boutique**.
D'où `platform: "PC"` et un champ `boutique` séparé, plutôt qu'une liste
« PC (Steam) », « PC (Epic) » qui mélangerait deux axes sans rapport et qu'on
paierait à chaque filtre.

La boutique n'est **pas une liste fermée**, contrairement aux plateformes : elle
est dérivée de la bibliothèque comme les genres. Une boutique nouvelle se saisit
une fois dans une fiche et apparaît dans les filtres — Ubisoft Connect, EA App,
itch.io entrent sans modification du code.

Un jeu PC est toujours démat et jamais rétrocompatible : le modèle le force, et
l'édition ne propose ni format ni case de rétrocompatibilité. Le panneau des
filtres change avec l'univers — Boutique remplace Plateforme, Prêt et Format
disparaissent — les statistiques suivent l'univers et le disent en titre, et
« Prêts » quitte la barre d'onglets côté PC : un jeu Steam ne se prête pas.

**Un jeu possédé des deux côtés se signale tout seul.** Deux fiches dont les
titres sont identiques une fois normalisés sont le même jeu : la fiche console
affiche « Aussi sur PC · Steam », la fiche PC « Aussi sur Xbox Series X », et
toucher la pastille ouvre l'autre. Rien n'est stocké — un lien enregistré
devrait être tenu à jour et finirait par mentir. La correspondance est exacte et
jamais approximative : « GTA V » et « Grand Theft Auto V » ne se rejoindront
pas, ce qui est un manque silencieux mais préférable à une affirmation fausse
sur ce qu'on possède. Le même mécanisme signale un jeu possédé sur deux
consoles.

Changer d'univers remet les filtres à zéro : « Xbox One » et « Steam » ne
veulent rien dire l'un pour l'autre, et un filtre survivant afficherait une
bibliothèque vide sans qu'on comprenne pourquoi.

### La bibliothèque

- **94 jeux** pré-remplis en données de départ ; ajout, édition et suppression libres.
- **Recherche** sur titre + genre + tag, **insensible à la casse et aux accents**
  (« creatif » trouve le genre « Créatif »). La description est volontairement
  exclue : un mot du résumé faisait remonter des jeux sans rapport.
- **Filtres combinables** : plateforme, prêt (chez moi / prêtés), format (physique /
  démat), **mode de jeu** (solo / à plusieurs / coopératif) et **genre**. Chaque groupe
  tient sur une ligne portant sa valeur courante et s'ouvre au toucher, un seul à la
  fois : dépliés, les sept groupes faisaient quarante boutons d'un coup, et il fallait
  défiler pour découvrir qu'un filtre par mode existait.
- **La rétrocompatibilité se décide.** Une plateforme récente montre ses jeux natifs et
  ceux de la précédente marqués rétrocompatibles — mais le mélange était imposé : sur
  une bibliothèque réelle, « Xbox Series X » rendait 101 jeux dont 19 seulement sont
  des jeux Series X, et ces 19 étaient introuvables. Une case à cocher, présente
  uniquement pour une console qui en accueille une autre et cochée par défaut, porte
  le même libellé pour la Xbox et pour la Switch — « Inclure les jeux
  rétrocompatibles » — et laisse les noms et les nombres à la ligne de détail :
  « 82 jeux Xbox One démarrent sur Xbox Series X. Décoche pour ne voir que les 19 jeux
  vraiment Xbox Series X. » Décochée, la ligne repliée annonce « Xbox Series X seul ».
- **« À compléter » est en tête du panneau, et c'est le seul bloc plein.** Tous les
  autres filtres répondent à « montre-moi » ; celui-ci répond à « qu'est-ce qu'il me
  reste à faire », et l'onglet Stats savait le compter depuis longtemps sans qu'on
  puisse y aller. Il annonce le nombre de fiches concernées — pas la somme des colonnes,
  un même jeu pouvant manquer de trois choses — et n'affiche que ce qui manque
  réellement : une option s'efface dès que son champ est rempli partout, et le bloc
  entier disparaît quand la bibliothèque est complète. Un appel à l'action sans action
  à faire est pire qu'une absence. Une exception, et c'est la seule : si le filtre est
  posé au moment où le dernier manque est comblé, le bloc reste — sinon il emporterait
  avec lui le seul moyen d'enlever un filtre qui vide désormais la liste. Les mêmes prédicats servent au bloc « Ce qui
  manque » des Stats : le chiffre affiché et la liste obtenue ne peuvent pas diverger.
- **Filtre par note** : au-dessus d'un seuil (90, 80 ou 70). Un seuil répond à
  « qu'est-ce que j'ai de vraiment bien » ; une tranche obligerait à toutes les cocher.
- **Le filtre par série se pose depuis une fiche**, en touchant le nom de la série :
  cinquante-huit séries ne tiennent pas dans une grille de boutons. Le groupe
  correspondant n'apparaît dans le panneau que pour montrer celui qui est posé et
  permettre de l'enlever.
- **Cinq tris** : titre, date d'ajout, date de sortie, note, et au hasard — pour quand
  la question est « je joue à quoi ce soir ». Le sens s'inverse d'un bouton, sauf pour
  le hasard où il n'aurait pas de sens. Ce qui n'a pas de valeur va toujours à la fin,
  dans un sens comme dans l'autre : inverser un tri ne remonte pas les jeux sans note
  en tête. Le tirage au hasard tient tant qu'on ne redemande pas à mélanger — une
  empreinte calculée depuis l'identifiant et une graine, plutôt qu'un `Math.random()`
  dans le comparateur qui ferait danser la liste à chaque frappe.
- **Le tri est sur la ligne de recherche**, plus dans le panneau : ce n'est pas un
  filtre, le badge ne le compte pas. Il y a d'abord occupé une rangée à lui, ce qui
  faisait deux rangées de commandes avant la première jaquette ; il tient désormais à
  côté du champ, avec la flèche de sens et « Filtres ». Quatre commandes sur 360 px
  ne rentrent qu'à deux conditions : le champ abrège son invite — « Rechercher… »,
  réduite à une loupe quand le bouton de tri porte son libellé, une invite ne
  s'abrégeant pas comme un texte mais se coupant net — et le bouton de tri ne dit son
  libellé que lorsqu'il ne trie plus par défaut. Le contour accentué reste au seul
  bouton « Filtres » : deux boutons au même traitement, côte à côte et sans la même
  importance, se confondent. Le nombre de jeux affichés remonte dans l'en-tête, à côté
  du total — « 155 jeux · 23 affichés ».
- **Le tri alphabétique met l'article initial de côté.** « The Legend of Zelda »,
  « The Last of Us », « The Sims 4 » se rangeaient tous à la lettre T, en un bloc où
  l'on ne trouve rien — et l'arrivée des jeux PC en a ajouté des dizaines. « The »,
  « A », « An », « Le », « La », « Les », « L' » sont sautés au classement ; l'affichage
  ne change pas, c'est un ordre, pas un titre. Un mot qui commence par un article n'en
  est pas un : « Alone in the Dark » reste à A, « Anno 1800 » aussi.
- **Trois vues et un regroupement** : liste, compacte (une ligne par jeu, pour
  parcourir cent cinquante titres au pouce) et grille ; regroupement facultatif par
  plateforme, série ou genre, avec des en-têtes de section. Le regroupement ne change
  pas l'ordre : les sections apparaissent dans celui que le tri leur donne.
- **Les statistiques disent la même chose que les filtres.** Le bloc « Par plateforme »
  annonçait « 82 jeux jouables sur Xbox Series X » juste sous une barre marquée 19 :
  deux chiffres justes que rien ne reliait, alors que le filtre, lui, en montrait 101.
  Chaque console qui en accueille une autre porte désormais une ligne complète —
  « Sur Xbox Series X : 19 natifs et 82 hérités de Xbox One, soit 101 jouables ».
- **Le mode de jeu** répond à la question qu'une ludothèque de cent cinquante jeux
  rend difficile — « on est deux ce soir, on lance quoi ». Il vient de la fiche
  Wikidata, dont les étiquettes ne forment pas un vocabulaire (« solo », « Solo »,
  « mode coopératif », « joueur contre joueur », « multijoueur en écran divisé /
  partagé ») : elles sont classées à la lecture plutôt que réécrites, parce que leur
  formulation est une information. Le coopératif compte comme un multijoueur, jamais
  l'inverse. Un jeu sans fiche Wikidata n'a aucun mode connu et ne sort d'aucun de ces
  choix — le panneau le dit et donne le nombre, plutôt que de laisser croire que ces
  jeux ne sont pas solo.
- **Le genre** est dérivé de la bibliothèque, pas d'une liste fermée, et classé par
  nombre de jeux. Les huit premiers sont affichés, le reste derrière un bouton : sur
  une bibliothèque réelle il y a vingt-huit genres, et vingt-huit boutons ne sont plus
  un choix. Le genre sélectionné reste visible même s'il vient de la traîne, sinon le
  filtre actif disparaît de l'écran.
  Le vocabulaire est français quelle que soit la source : RAWG répond en anglais,
  Playnite dans les deux langues, et la table ramène chaque notion à une seule forme
  — « Card & Board Game » devient « Jeu de société », « Tactical » « Tactique »,
  « Massively Multiplayer » « Massivement multijoueur », « Family » « Famille ».
  « Indie » et « Open World » restent tels quels : ce sont les formes en usage.
  Sept valeurs venues de Steam sont écartées à la lecture — Utilitaires, Retouche
  photo, Production vidéo, Animation & Modélisation, Conception & Illustration, Accès
  anticipé, Free-to-play : elles décrivent un logiciel, un modèle économique ou un
  stade de développement, jamais une manière de jouer. Comme la migration rejoue la
  normalisation à chaque chargement, les fiches déjà en place se nettoient seules.
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
| **🔄 Rechercher sur RAWG** | Jaquette, Metacritic, genres, et les infos de l'édition possédée — utile quand un jeu a été mal associé |
| **📚 Wikipédia** | Titre commercial officiel FR, puis au choix : résumé, jaquette d'infobox, infos Wikidata |
| **🧹 Vider** | Efface au choix infos, description, jaquette, note ou genres — pour repartir d'une base propre |
| **📦 Jaquette SteamGridDB** | Jaquette verticale 600×900 choisie parmi une grille de vignettes |

**La fiche détaillée** — développeur, éditeur, dates de sortie, mode de jeu
(solo / multi / coop), série et jeux précédent/suivant — vient de deux sources
qui ne décrivent pas tout à fait la même chose. Wikipédia range un remaster sous
la page du jeu d'origine : « Sonic The Hedgehog » y sort en 1991, quelle que soit
la compilation qu'on possède. RAWG a une entrée par édition, avec la date de
celle qu'on a achetée, mais ses studios viennent d'une base communautaire, moins
sûre sur les vieux titres. Aucune ne gagne partout.

**Une source ne remplit donc que les champs vides et n'écrase jamais.** Passer
RAWG puis Wikipédia sur un remaster garde la date de la version possédée et
complète le reste. Une source qui n'a rien rempli ne signe pas la provenance :
annoncer « et RAWG » sur une fiche où RAWG n'a rien apporté serait une fausse
piste au moment de démêler une date. Car la fiche dit d'où elle vient —
« Source : RAWG et Wikidata » sous les lignes. Et puisque plus rien ne s'écrase,
« 🧹 Vider » existe pour repartir propre : sans lui une fiche fausse le
resterait, chaque nouvelle source la respectant poliment.

Côté Wikidata, le moteur de jeu est volontairement exclu, et les libellés sont
résolus en `fr` → `en` → `mul` (Wikidata range les noms propres sous `mul`, ce
qui explique que certains éditeurs ne remontent pas si on ne demande que
`fr`/`en`). Côté RAWG, les modes viennent des étiquettes `Singleplayer`,
`Multiplayer` et `Co-op`, traduites dans le vocabulaire que le filtre par mode
sait déjà lire.

**Bouton « Partager la liste »** (panneau ⋯ Actions) : produit la liste **affichée** —
donc celle de l'univers où l'on se trouve, console ou PC, et le titre le dit — en
texte lisible — groupée par plateforme, un jeu par ligne avec son format et, le cas
échéant, le prêt en cours avec sa date de retour convenue ; la note Metacritic n'y figure
pas, elle sert à trier sa propre bibliothèque, pas à conseiller quelqu'un d'autre — et l'envoie au menu de partage du téléphone, ou la copie
dans le presse-papier ailleurs. Pas de sélecteur de plateforme : le panneau des filtres a
déjà composé la liste, et deux endroits pour dire la même chose finiraient par se
contredire.

**Bouton « Compléter les notes manquantes »** (panneau ⋯ Actions) : trois sources dans
l'ordre de leur sûreté, la première qui répond gagne.

1. **RAWG**, qui cherche par titre — et qu'un titre suffit à faire échouer :
   « Hogwarts Legacy : L'Héritage de Poudlard » ne lui disait rien.
2. **Le magasin Steam**, qui répond sur l'**appid** posé par l'import Playnite, donc sans
   aucune approximation. L'appid est cherché sur la fiche **puis sur ses autres éditions** :
   une fiche Xbox n'en a pas, mais le même jeu acheté sur Steam, si.
3. **Wikidata** (P444 « note de critique » qualifiée par P447 = Metacritic), sans clé et
   sans relais, valable aussi côté console — mais peuplée par des contributeurs, donc
   inégale.

**Et quand les trois disent non, la fiche cesse de réclamer.** Elle porte « Pas de note
connue » et sort de « À compléter → Note ». Sur une bibliothèque réelle, sept des jeux
sans note sont antérieurs à Metacritic — Fallout est de 1997, Alone in the Dark 2 de
1993 — et deux autres sont des remasters gratuits. Aucune source ne leur inventera un
chiffre ; les redemander à chaque passage transformait une action qui se termine en
corvée qui recommence. Une note saisie à la main efface la mention, un champ vidé rend
la fiche aux sources.

**Bouton « Rattraper les jaquettes manquantes »** (panneau ⋯ Actions) : cherche sur
SteamGridDB une jaquette pour chaque fiche qui n'en a pas, avec progression et arrêt
possible. L'application en rattrape déjà douze à chaque ouverture, ce qui convenait à une
bibliothèque qui grandit d'un jeu par semaine ; un import Playnite en laisse cent
quarante d'un coup. SteamGridDB et lui seul : ses images sont des jaquettes verticales
600×900, du même format que celles des fiches console — RAWG rendrait des paysages, et
une grille où un jeu sur trois n'a pas la même forme se lit plus mal qu'une grille où il
manque une image. Un titre trop éloigné de ce que la recherche renvoie est laissé sans
image et compté à part : une jaquette fausse ne se remarque pas dans trois cents fiches.

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

### Import des jeux PC (Playnite)

**Le problème.** Steam demande une clé d'API ; Epic, GOG et Amazon n'ont pas
d'API publique du tout. Les mails de confirmation ne portent les titres que
dans leur corps HTML, et il n'existe aucun mail Amazon Gaming. Écrire quatre
intégrations ici aurait donc coûté cher pour un résultat partiel.

[Playnite](https://github.com/JosefNemec/Playnite) (Windows, MIT) lit ces
quatre boutiques depuis les clients installés et télécharge les métadonnées
d'IGDB. Il fait ce travail sur le PC ; l'application lit son export.

**Deux façons d'obtenir le fichier**, l'application lit les deux.

La plus simple : installer l'extension [Json Library Import
Export](https://github.com/sokolinthesky/JsonLibraryImportExport) depuis
l'annuaire d'add-ons de Playnite, puis Extensions → Json Library Import Export
→ Export. Elle écrit un dossier de fichiers ; seul `games.json` sert ici. Son
format est celui des objets Playnite bruts, en anglais et imbriqué.

L'autre, sans extension tierce : le script ci-dessous, qui écrit directement un
fichier plat. Créer un dossier `ExportLudotheque` dans
`%AppData%\Playnite\Extensions\` (ou dans le dossier `Extensions` de
l'installation portable) avec ces deux fichiers, en UTF-8, puis relancer
Playnite : l'entrée apparaît dans le menu principal.

`extension.yaml` :

```yaml
Id: ExportLudotheque_Script
Name: Export ludothèque
Author: Antoni
Version: 1.0
Module: export.psm1
Type: Script
```

`export.psm1` :

```powershell
function GetMainMenuItems()
{
    param($menuArgs)
    $item = New-Object Playnite.SDK.Plugins.ScriptMainMenuItem
    $item.Description = "Exporter la ludothèque (JSON)"
    $item.FunctionName = "ExportLudotheque"
    $item.MenuSection = "@Export ludothèque"
    return $item
}

function ExportLudotheque()
{
    # Playnite passe un argument à la fonction du menu : sans ce `param`,
    # le clic échoue sur « Impossible de trouver un paramètre positionnel ».
    param($menuArgs)

    $chemin = $PlayniteApi.Dialogs.SaveFile("JSON|*.json")
    if (!$chemin) { return }

    $jeux = @()
    foreach ($j in $PlayniteApi.Database.Games)
    {
        $boutique = ""
        if ($j.Source) { $boutique = $j.Source.Name }

        $sortie = ""
        if ($j.ReleaseDate -ne $null) { $sortie = $j.ReleaseDate.Serialize() }

        $jeux += [PSCustomObject]@{
            titre           = $j.Name
            boutique        = $boutique
            idBoutique      = $j.GameId
            plateformes     = @($j.Platforms  | ForEach-Object { $_.Name })
            sortie          = $sortie
            genres          = @($j.Genres     | ForEach-Object { $_.Name })
            developpeurs    = @($j.Developers | ForEach-Object { $_.Name })
            editeurs        = @($j.Publishers | ForEach-Object { $_.Name })
            series          = @($j.Series     | ForEach-Object { $_.Name })
            fonctionnalites = @($j.Features   | ForEach-Object { $_.Name })
            description     = $j.Description
            installe        = $j.IsInstalled
        }
    }

    $jeux | ConvertTo-Json -Depth 4 | Out-File -FilePath $chemin -Encoding utf8
    $PlayniteApi.Dialogs.ShowMessage("$($jeux.Count) jeux exportés.")
}
```

**Dans l'application** : ⚙️ → Sauvegarde → **« 🖥️ Importer un export Playnite »**.

- **Écran de prévisualisation obligatoire**, comme pour l'import Xbox : chaque
  ligne est marquée **Nouveau**, **Déjà présent**, **Écarté** ou **Ignoré**, et
  seules les nouvelles sont cochables. Rien n'est écrit avant validation.
- **Ce qui entre** : une fiche PC, démat, avec sa boutique, sa référence
  boutique, ses genres (ramenés au vocabulaire du projet), sa description
  (nettoyée de son HTML, résumée au-delà de 900 caractères) et une infobox
  signée « IGDB (via Playnite) ». La date d'ajout reprend la date de sortie
  quand elle est complète.
- **Deux langues dans le même fichier** : Playnite répond dans la langue de son
  interface, mais ses sources ne sont pas toutes traduites. Un export réel de
  181 jeux porte « Solo » 130 fois et « Single Player » 17, « Indépendant » et
  « Indie », « Course automobile » et « Racing ». Les tables de genres et de
  modes couvrent donc les deux formes, sans quoi les filtres couperaient la
  bibliothèque en deux moitiés arbitraires.
- **Ce qui est ignoré** : une ligne sans titre, une ligne en double, et toute
  plateforme qui n'est pas celle d'un PC — les importateurs PSN et Xbox de
  Playnite et ses jeux émulés partagent la même base que Steam.
- **Ce qui n'est pas repris** : les jaquettes (des fichiers sur le disque du PC,
  pas des URL — elles continuent de venir de RAWG), le temps de jeu (retiré du
  modèle) et le statut de complétion de Playnite.

**La liste des écartés.** Un jeu importé puis supprimé est retenu par sa
référence de boutique dans `gl_exclusions`, et ne revient pas au prochain
import. Sans elle, chaque import ramène ce qu'on vient d'écarter et l'on cesse
d'importer. La liste voyage avec la sauvegarde en ligne (elle ne contient aucun
secret) et se vide depuis ⚙️ → Sauvegarde. Annuler une suppression retire
l'exclusion.

### Le même jeu chez deux boutiques

Sur PC, la boutique distingue une édition d'une autre — mais posséder
Borderlands 2 sur Steam **et** sur Epic ne donne pas deux jeux à jouer, seulement
deux façons de le lancer. Sur une bibliothèque réelle, neuf titres sur cent
quatre-vingts occupaient ainsi deux cartes voisines, identiques jusqu'à la
jaquette.

- **Une seule carte par titre**, côté PC uniquement : sur console, deux fiches
  d'un même titre sont deux machines, donc deux objets qu'on possède vraiment.
- **La carte gardée est la plus complète** — celle qui a la jaquette et la
  description, pas celle qui est arrivée la première. À égalité, l'ordre de la
  bibliothèque tranche, pour que deux affichages successifs montrent la même.
- **Rien n'est supprimé ni fusionné.** La fiche cachée garde sa référence de
  boutique, donc la liste des écartés et les prochains imports continuent de la
  reconnaître. Fusionner aurait demandé de changer le modèle — `boutique`
  devenant une liste — et fait perdre l'identifiant par boutique, qui est ce qui
  rend les réimports exacts.
- **L'en-tête le dit** : « 180 jeux · 9 doublons masqués ». Un jeu qui manque à
  l'appel doit s'expliquer là où on compte les jeux.
- **Filtres → Même jeu, deux boutiques** bascule entre « Une seule carte » et
  « Toutes les boutiques ». Le réglage vit avec la vue et le regroupement, pas
  avec les filtres : il change comment on regarde, pas ce qu'on possède.
- **Toucher « Aussi sur PC · Steam » sur la carte gardée montre les doublons** :
  la pastille désigne précisément une carte retirée de la liste, et c'est le seul
  moyen que le geste aboutisse. Le réglage reste alors sur « Toutes les
  boutiques » jusqu'à ce qu'on le remette.
- Les statistiques comptent les fiches, pas les cartes : elles annoncent donc
  180 là où la liste en montre 171. Elles disent ce qu'on possède, la liste dit
  ce qu'on peut lancer.

### Remplir une fiche depuis ses autres éditions

Posséder « Forza Horizon 5 » sur Xbox et sur PC, c'est avoir deux fiches pour un
seul jeu. La première a été remplie par Wikipédia et RAWG au fil des mois ; la
seconde arrive nue d'un import. Rien ne justifie d'aller réinterroger le réseau
pour ce qui est déjà là, à trois lignes de distance.

- **Ce qui se partage** décrit le jeu : jaquette, description, note, genres,
  infobox. **Ce qui ne se partage pas** décrit l'édition : date d'ajout,
  plateforme, boutique, format, prêts, liens et notes personnelles.
- **On ne remplit que le vide**, jamais on n'écrase — la règle de
  `fusionnerInfobox`, appliquée aux autres champs. L'infobox, elle, se fusionne
  champ par champ : une édition peut avoir les développeurs et l'autre la série.
- **La provenance ne ment pas** : une donnée reprise garde la source d'origine
  (Wikidata, RAWG…), parce que c'est bien de là qu'elle vient — seulement par le
  chemin de la fiche voisine.
- **Deux moments** : à l'import Playnite, où le récapitulatif annonce combien de
  lignes se rempliront toutes seules et lesquelles (« déjà sur Xbox One ») ; et
  par ⋯ → **« Remplir depuis les autres éditions »** pour les fiches déjà en
  place, qui annonce le détail par champ avant d'écrire.
- Sur une bibliothèque réelle de 155 jeux console et 180 jeux PC importés :
  **38 fiches remplies à l'import** — jaquette, description, note, genres — puis
  6 complétées par l'action, et plus rien ensuite.

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
- **Copie hors ligne** : Export / Import JSON, sans aucun relais à déployer.
  À l'import, un panneau annonce ce que contient le fichier — jeux valides,
  entrées ignorées, valeurs corrigées — et propose **Fusionner**, **Remplacer**
  ou **Annuler** ; chaque bouton dit sa conséquence, chiffres en main.

Une récupération ne remplace rien sans confirmation, chiffres en main, et les
préférences se reprennent sur une **seconde question** : on vient chercher une
bibliothèque, pas forcément se faire changer son thème.

Un envoi qui écraserait le travail d'un autre appareil est **refusé** : le
Worker compare l'horodatage annoncé à celui qu'il détient et répond 409, et
l'application pose alors le choix au lieu de trancher toute seule.

---

## Ergonomie et système visuel

L'interface a été confrontée à Material Design 3, aux lois de l'UX et à un
cahier des charges d'accessibilité. Ce qui en est ressorti ne vit pas dans une
note d'intention mais dans des jetons CSS (`src/index.css`) : une règle qu'on
peut recopier de travers finit par l'être.

| Jeton | Valeur | Ce qu'il tient |
|---|---|---|
| `--tap` | 48 px | Hauteur d'une commande principale (Material) |
| `--tap-min` | 44 px | Plancher d'une commande posée dans une ligne (Apple HIG, WCAG 2.5.5) |
| `--ecart-tap` | 8 px | Séparation entre deux cibles voisines |
| `--ecart-bloc` | 28 px | Séparation entre deux blocs — contre 12 px à l'intérieur d'un bloc |
| `--t-legende` → `--t-chiffre` | 12 → 24 px | Cinq rôles typographiques, texte courant à 16 |
| `--r-xs` → `--r-lg` | 4 → 16 px | Échelle de formes |

Quelques règles qui ne se voient qu'à l'usage :

- **Le texte courant fait 16 px, les champs de saisie aussi.** Sous ce seuil,
  Safari iOS zoome tout seul à la prise de focus : ce n'est pas un réglage,
  c'est un comportement du navigateur. Le prix est la densité — cinq jeux par
  écran au lieu de huit, contre une longueur de ligne qui rentre enfin dans la
  fourchette conseillée sur mobile.
- **`--accent` se lit SUR le fond, `--accent-fond` porte du blanc.** Un seul
  bleu ne peut pas satisfaire les deux contraintes ; les confondre fait tomber
  le contraste de 5,17 à 3,00:1.
- **Un bouton a cinq états** : repos, survol (réservé aux pointeurs fins),
  focus (anneau de 2 px sur `:focus-visible`, jamais au doigt), pressé, et
  désactivé.
- **L'aplat bleu est l'action principale, partout.** Le contour teinté ne dit
  pas « fais ceci » mais « c'est ce qui est choisi ».
- **Les panneaux sont de vrais dialogues** : `role="dialog"`, `aria-modal`,
  focus enfermé dedans et rendu à la fermeture, Échap qui ferme, défilement
  bloqué derrière.
- **Aucun choix destructeur ne se cache derrière « Annuler ».** L'import
  proposait autrefois « OK = REMPLACER / Annuler = FUSIONNER » dans une boîte
  du navigateur : Échap, qui ferme sur Annuler, importait le fichier. Trois
  boutons nommés, et annuler n'importe rien.

Ces règles ne se relisent pas, elles se mesurent : `npm run verif:ui` construit
l'application, la sert lui-même et échoue si une cible passe sous le plancher,
si un texte descend sous 12 px, si un libellé se tronque ou si la page déborde.

Un audit complet, mené en mesurant dans le navigateur sur quatorze écrans et
deux thèmes, a montré la limite de ce garde-fou : il ne visitait ni la fenêtre
d'ajout, ni l'édition à la main, ni une fiche assez longue pour afficher « Lire
la suite ». Trois défauts y ont vécu des mois derrière un « Rien à signaler » —
non pas parce qu'il n'y avait rien, mais parce qu'il ne regardait pas là. Ils
sont corrigés et ces écrans sont maintenant dans la promenade. Le même audit a
trouvé un jeton de couleur qui passait sur les cartes (4,91:1) et échouait sur
l'en-tête (4,31:1) : un jeton mesuré sur un seul de ses fonds n'est mesuré nulle
part.

Trois écarts restent assumés, et sont écrits ici plutôt que tus : les commandes
secondaires font 44 px et non 48 ; les listes contiguës — accordéon des filtres,
cases à cocher, segments — n'ont pas 8 px entre elles, la règle visant des
boutons distincts et non le motif de liste ; et tout se trouve en haut de
l'écran, dans la zone que la cartographie du pouce désigne comme la plus
difficile à atteindre à une main. Ce dernier point demanderait une barre de
navigation basse, c'est-à-dire une refonte de l'ossature.

---

## Sources de données

| Source | Clé | CORS | Usage |
|---|---|---|---|
| RAWG | oui | ✅ direct | Jaquettes, Metacritic, genres, dates de sortie |
| Wikipédia FR | non | ✅ direct | Titre officiel français, résumé, image d'infobox |
| Wikidata | non | ✅ direct | Développeur, éditeur, sorties, mode de jeu, série, note Metacritic |
| SteamGridDB | oui | ❌ via relais | Jaquettes verticales format boîte |
| xbl.io | oui | ❌ via relais | Historique de la bibliothèque Xbox |
| Playnite (fichier) | non | — | Jeux PC des boutiques, et leurs infos IGDB |
| Magasin Steam | non | ❌ via relais | Note Metacritic, demandée par appid |

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
  boutique,                          // PC uniquement : Steam, GOG, Epic…
  refBoutique,                       // identifiant chez la boutique (import Playnite)
  noteAbsente,                       // aucune source ne note ce jeu : on cesse de chercher
  infobox                            // données Wikidata / RAWG / IGDB, ou null
}
```

Sept champs ont été **supprimés** par la migration, pas seulement masqués :
`status`, `playedMinutes`, `manualMinutes`, `sessions`, `hltb`, `note`,
`progression`. Les garder ferait croire à des fonctions inexistantes, et ils
voyageaient à chaque écriture et à chaque synchronisation.

**Les genres parlent une seule langue.** Ils viennent de deux endroits qui ne
s'accordaient pas : la bibliothèque de départ, écrite à la main en français
(Aventure, Plateforme, Course, Furtif), et RAWG, qui répond en anglais. Sur une
bibliothèque réelle de 154 jeux, cela donnait **33 valeurs dont la moitié en
double** — « Adventure » 21 et « Aventure » 20, « Platformer » 16 et
« Plateforme » 17, « Racing » 10 et « Course » 6. Un filtre par genre aurait
coupé la collection en deux moitiés arbitraires, selon la source qui avait
répondu la première.

Une table de correspondance ramène chaque genre à la forme du projet, à
l'enregistrement comme à l'import et à l'édition : 33 valeurs deviennent 28, et
aucun jeu ne perd de genre. Elle règle aussi la casse — « aventure » tapé à la
main ne compte plus à part. La fonction est idempotente, donc la migration la
rejoue à chaque chargement sans numéro de version. Un genre absent de la table
garde sa forme : elle corrige des doublons connus, elle n'impose pas un
vocabulaire fermé.

**Ce que l'application accepte d'un fichier.** L'import ne fait pas confiance à
ce qu'on lui donne : une date illisible, une plateforme inconnue, un format
inventé ou une note en toutes lettres sont ramenés à une valeur sûre, et le
nombre d'entrées corrigées est annoncé. Le contrôle ne portait que sur les
types — « pas une date » est une chaîne, donc ça passait, et le `NaN` qui en
sortait remontait jusque dans les moyennes de l'onglet Stats, affiché comme une
statistique.

Le format ne suffit pourtant pas non plus. **« 0001-01-01 » est une date ISO
parfaitement valide**, et l'histogramme des ajouts, qui comble toutes les années
entre la plus ancienne et la plus récente, en tirait deux mille colonnes larges
de zéro pixel — quinze secondes de rendu pour une année mal tapée dans un champ
date. Une date doit donc aussi être **plausible** : entre 1970 et dix ans devant
(une date de retour convenue est légitimement dans le futur). Même raisonnement
pour les liens d'une fiche : ils finissent dans un `href`, et `javascript:` en
est un — seuls `http://` et `https://` entrent, et sont rendus.

Quatre autres clés vivent à part dans le `localStorage`, précisément pour ne
jamais entrer dans l'export : `gl_keys` (clés des services), `gl_sync` (code de
synchronisation), `gl_theme` (mode d'apparence) et `gl_affichage` (vue, tri, sens
et regroupement — pas les filtres, voir plus bas).

**Ce que la synchronisation emporte** : la totalité de chaque fiche, sans
exception — jusqu'à l'historique des prêts passés et la provenance des infos —
plus le mode d'apparence, plus les clés des services si la case est cochée. Ce
qu'elle n'emporte jamais : l'adresse du relais, sans laquelle on ne peut pas la
joindre (la restaurer depuis elle-même serait circulaire), et le code de
synchronisation, qui est ce qui la protège.

**Les réglages d'affichage survivent au lancement, les filtres non.** Un
réglage d'affichage change comment on regarde ; un filtre change ce qu'on voit.
Un filtre qui survit au redémarrage, c'est une bibliothèque amputée sans qu'on
sache pourquoi — exactement le défaut corrigé sur l'ajout d'un jeu, mais
permanent.

**L'âge de la sauvegarde se voit.** La synchronisation est manuelle, et le
reste : personne ne veut qu'une application pousse ses données sans qu'on le lui
demande. Mais une sauvegarde qu'on oublie de faire n'existe pas. Passé sept
jours, une pastille orange apparaît sur l'onglet ⚙️ et la ligne des réglages dit
« il y a 12 jours » au lieu d'une date à convertir de tête. Rien à écarter,
aucune bannière : seulement un retard qui cesse d'être invisible.

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
  panneaux glissants. La liste a longtemps été paginée par 30, jusqu'à ce que la
  mesure montre que tout monter d'un coup ne coûte qu'une seconde de plus au
  démarrage sur un vieux téléphone : le bouton « Charger 30 de plus » a disparu
  et la bibliothèque s'affiche entière. Les cibles principales, longtemps à 44 px « pour ne pas faire
  exploser la densité », sont passées à 48 — le chiffre de Material — après
  qu'un audit a montré que le compromis avait été fait avec nous-mêmes et non
  avec l'utilisateur. Les commandes secondaires restent à 44 : c'est le plancher
  d'Apple et de WCAG 2.5.8, et les passer à 48 reflowerait tous les panneaux
  pour quatre pixels.
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
npm test         # 122 tests (modèle, import, genres, filtres, tris, prêts,
                 #             stats, thème, préférences, cohérence, audit, Worker)
npm run test:worker                   # 32 vérifications du relais, sans déploiement
npm run verif:ui                      # mesure les écrans rendus (voir plus bas)
npm run audit -- ma-sauvegarde.json   # symptômes dans les données (voir plus bas)
```

En développement, le proxy du serveur Vite joue exactement le rôle du Worker : il
relaie `/sgdb/*` et `/xbl/*` **sans détenir de clé** (c'est le client qui envoie
l'en-tête d'authentification). Il n'est donc **pas nécessaire de déployer le
Worker pour travailler en local**.

### Vérifier l'interface rendue

Les règles d'ergonomie portent sur des pixels affichés, pas sur des
déclarations : un bouton peut être écrit correctement et mesurer 34 px une fois
la police appliquée et la ligne calculée. Trois défauts ont été trouvés ainsi,
et par aucun autre moyen.

```bash
npm run verif:ui
```

Le script construit, sert `dist/` lui-même et ouvre dix-sept écrans, à 360 et
412 px, dans les deux thèmes. Il échoue s'il trouve une cible sous 44 × 24 px,
un texte sous 12 px, un champ de saisie sous 16 px, un libellé tronqué, un
débordement horizontal ou une erreur JavaScript. Il demande Playwright et un
navigateur, d'où son absence de `npm test`, qui tourne sur des modules purs.

Deux angles morts ont été refermés en même temps, et ils valent d'être dits :
la promenade ne visitait ni la fenêtre d'ajout, ni l'édition à la main, ni une
fiche assez longue pour afficher « Lire la suite » — trois défauts y ont vécu
des mois derrière un « Rien à signaler ». Et le script mesurait un serveur
lancé à part, donc le dernier `dist/` construit : oublier de reconstruire, et
il validait la version d'avant les corrections. Un garde-fou qui mesure autre
chose que ce qu'on lui présente ne dit rien, il rassure.

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
dates illisibles), **années d'ajout invraisemblables** et **liens non ouvrables**
— les deux qui ont la bonne forme sans être des données —, dates d'ajout à
venir, prêts incomplets ou très anciens, retours antérieurs au prêt, et séries
Wikidata éloignées du titre, signe qu'une source a répondu pour un autre jeu.

Cette dernière règle demandait autrefois que le titre et la série se préfixent
l'un l'autre. C'est un test d'égalité déguisé appliqué à deux chaînes qui n'ont
aucune raison d'être égales : un titre nomme un jeu, une série nomme une
famille. Passée sur une bibliothèque réelle de 154 jeux, **elle s'est trompée
vingt fois sur vingt** — « Sonic Generations → Sonic the Hedgehog » signalé, le
mot « Sonic » sous les yeux. Une catégorie qui a toujours tort n'est pas neutre :
elle apprend à sauter la ligne. Elle exige désormais qu'aucun mot significatif
ne soit commun au titre et à la série (20 constats → 4), **et** qu'aucun autre
jeu ne porte cette série (4 → 2) : si quatre fiches annoncent « The Legend of
Zelda », la série existe.

L'audit lui-même est testé (`scripts/audit.test.mjs`) : il est lancé en
sous-processus avec sa sortie `--json`, pour vérifier le programme tel qu'il
s'exécute plutôt qu'une fonction extraite pour l'occasion. Une règle fausse ne
casse rien — elle ment, et rien ne le signale.

Ce n'est **pas** un test : `npm test` vérifie des invariants et doit rester vert,
l'audit signale des *symptômes* qui peuvent être parfaitement légitimes. Deux
exemplaires du même jeu, c'est possible ; deux entrées identiques après un
import, beaucoup moins.

### Structure

```
├── .github/workflows/deploy.yml   Build + publication GitHub Pages
├── worker/                        Relais CORS + sauvegarde en ligne (sans secret)
│   ├── index.js
│   ├── test.mjs                   32 vérifications, sans dépendance ni déploiement
│   ├── wrangler.toml
│   └── README.md
├── scripts/
│   ├── audit.mjs                  Audit des données d'un export (pas un test)
│   ├── audit.test.mjs             …mais l'audit, lui, est testé
│   └── verif-ui.mjs               Mesure les écrans rendus : cibles, tailles, débordements
├── public/                        Icônes PWA (192/512, any + maskable), favicon
├── src/
│   ├── App.jsx                    Ossature : état global, en-tête, onglets
│   ├── main.jsx                   Montage + garde-fou d'erreurs global
│   ├── index.css                  Jetons : couleurs, cibles tactiles, typographie, formes
│   ├── lib/                       Modules purs : testables sans navigateur
│   │   ├── api.js                 RAWG, Wikipédia, Wikidata, SteamGridDB, xbl.io
│   │   ├── model.js               Plateformes, prêts, migration, validation, édition
│   │   ├── stats.js               Agrégats des deux sous-onglets Stats
│   │   ├── apparence.js           Modes de thème et couleur de barre système
│   │   ├── playnite.js            Lecture d'un export Playnite (jeux PC)
│   │   ├── preferences.js         Ce que la sauvegarde emporte en plus des jeux
│   │   ├── garde-fous.js          Messages des confirmations destructrices
│   │   ├── maj.js                 Détection d'une version déjà installée
│   │   ├── seed.js                Bibliothèque de démarrage
│   │   ├── storage.js             localStorage instrumenté (alerte de quota)
│   │   ├── sync.js                Sauvegarde sur le Worker
│   │   ├── theme.js               Alias vers les jetons CSS
│   │   ├── tri.js                 Les tris de la liste et ce qu'ils veulent dire
│   │   ├── coherence.test.mjs     Ce qui est écrit deux fois doit concorder
│   │   └── *.test.mjs             Tests des modules ci-dessus (node --test)
│   └── components/
│       ├── GameCard.jsx  AddModal.jsx  ImportModal.jsx  PlayniteModal.jsx
│       ├── StatsView.jsx  SettingsView.jsx  ScoresSheet.jsx
│       ├── Sheet.jsx  FiltersSheet.jsx  SortSheet.jsx  ActionsSheet.jsx  SousOnglets.jsx
│       └── Cover.jsx  InfoboxView.jsx  ChampProtege.jsx  ErrorBoundary.jsx
├── index.html
├── vite.config.js                 base, PWA, proxys de dev
├── PROGRESS.md                    État des fonctionnalités
└── JOURNAL.md                     Journal de développement : décisions, bugs, impasses
```

---

## Déploiement

Deux workflows, deux cibles : le site et le Worker ne vivent pas au même
endroit et ne se publient pas ensemble.

Le site, à chaque push sur `main`
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) : `npm ci`,
`npm run lint`, `npm test`, `npm run build`, puis publication de
`dist/` sur GitHub Pages via les actions
officielles `configure-pages` / `upload-pages-artifact` / `deploy-pages`.

**Aucun secret n'est nécessaire pour publier le site** — c'est toute la raison
d'être du choix « clés saisies par l'utilisateur ». Le déploiement du Worker en
demande un seul, `CLOUDFLARE_API_TOKEN`, qui n'autorise que la mise à jour des
Workers du compte et ne donne accès à aucune donnée de l'application.

Le service worker est en `autoUpdate` : une nouvelle version est récupérée
automatiquement au chargement suivant. L'onglet déjà ouvert, lui, continue
d'exécuter l'ancien code — d'où la bannière **« ✨ Nouvelle version »** avec son
bouton Recharger, déclenchée par l'événement `controllerchange`. Sans elle, il
fallait fermer l'application et la rouvrir sans jamais savoir s'il y avait
quelque chose à voir.

**Le Worker se déploie tout seul, par un workflow à part.** GitHub Pages ne
publie que `dist/`, si bien que le Worker se déployait à la main : le code de
`/sync` a passé plusieurs heures dans le dépôt sans jamais atteindre la
production, et l'oubli n'était visible nulle part.
[`.github/workflows/worker.yml`](.github/workflows/worker.yml) s'en charge
désormais dès que `worker/**` change sur `main` — tests d'abord, déploiement
ensuite. `npx wrangler deploy` ne sert plus qu'à déployer sa propre copie.

---

## Limites connues

- **La synchronisation est manuelle.** ⚙️ → Sauvegarde dépose la bibliothèque
  sur le Worker et la récupère, avec le même code sur chaque appareil ; rien ne
  part ni n'arrive tout seul, et une récupération remplace la bibliothèque
  locale après confirmation. C'est un choix — personne ne veut qu'une
  application pousse ses données sans qu'on le lui demande — mais une sauvegarde
  qu'on oublie de faire n'existe pas : passé sept jours sans envoi, une pastille
  apparaît sur l'onglet ⚙️ et la ligne des réglages donne l'âge en clair.
  Cela signale le retard, cela ne le rattrape pas. Sans relais déployé, il reste la copie hors ligne.
  Le **code de synchronisation** est à saisir sur chaque appareil — il ne
  figure ni dans l'export ni dans la sauvegarde qu'il protège. Les clés des
  services peuvent voyager, mais seulement si on le demande explicitement.
- **Deux envois vraiment simultanés peuvent encore se marcher dessus.** Le
  Worker lit la sauvegarde, compare l'horodatage annoncé, puis écrit : entre la
  lecture et l'écriture, rien ne verrouille l'espace KV. Deux appareils qui
  envoient dans la même seconde passeraient donc tous deux le contrôle. Pour
  deux appareils pilotés par la même personne, le cas ne se présente pas ; il
  est écrit ici parce qu'il n'est pas couvert, pas parce qu'il est probable.
- **SteamGridDB et l'import Xbox exigent le relais** déployé et renseigné dans ⚙️.
- **xbl.io** expose l'historique joué, pas les achats, et aucun temps de jeu.
- **Wikidata est incomplet** sur certains jeux (souvent les titres Nintendo ou
  très récents) : l'infobox s'affiche alors partiellement, sans casser la fiche.
- **Le classement Xbox One / Series X repose sur `addedDate`**, faute de date de
  sortie stockée séparément.
- **La navigation est en haut de l'écran.** Les quatre onglets et le bouton
  « + Ajouter » occupent la zone que la cartographie du pouce désigne comme la
  plus difficile à atteindre à une main. Une barre basse et un bouton flottant
  y répondraient : c'est le seul écart structurel au cahier des charges, parce
  qu'il déplace l'ossature et non trois valeurs.
- **Toute la bibliothèque est montée d'un coup.** Mesuré sur 155 jeux et la
  version construite, cela coûte 0,2 s de plus au démarrage sur une machine de
  bureau, 0,7 sur un téléphone récent et 1,1 sur un ancien. À bibliothèque
  doublée, la question se repose : les chiffres sont en commentaire dans
  `App.jsx` pour qu'on n'ait pas à les redécouvrir.
- **Les filtres ne survivent pas au lancement, délibérément.** La vue, le tri,
  son sens et le regroupement, si. Un réglage d'affichage change comment on
  regarde ; un filtre change ce qu'on voit, et un filtre qui survit au
  redémarrage donne une bibliothèque amputée sans qu'on sache pourquoi.
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
