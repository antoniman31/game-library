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

Une bibliothèque de jeux vidéo personnelle (Xbox / Switch) : catalogue, prêts,
statistiques, et enrichissement automatique des fiches depuis plusieurs bases
publiques.

> Le projet a longtemps suivi la **progression** et le **temps de jeu**, chronomètre
> de session compris. Les deux ont été retirés — voir la phase 9. Ce document garde la
> trace de cette période, puisque c'est son rôle.

**Contraintes fixées dès le départ, jamais remises en cause :**

- **Aucun backend applicatif.** L'application est entièrement statique et les données
  vivent dans le `localStorage` du navigateur. Le Worker Cloudflare ajouté plus tard
  ne fait que relayer et stocker : il ne connaît rien du domaine.
- **Français partout** : interface, descriptions, titres de jeux.

> La contrainte « un seul fichier » a tenu jusqu'à la phase 9, où `App.jsx` avait
> atteint 1 560 lignes et 136 Ko. Elle a été abandonnée, pas oubliée.

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

### Phase 9 — Ce que la console sait déjà

L'application suivait la progression (non commencé, en cours, terminé, platine,
abandonné) et le temps de jeu, avec chronomètre de session et historique. Les deux
ont été **retirés**, pas masqués : la console tient déjà ces données, mieux et sans
saisie manuelle, et les redoubler ici demandait du travail pour une information qu'on
possède ailleurs. Sept champs ont quitté le modèle (`status`, `playedMinutes`,
`manualMinutes`, `sessions`, `hltb`, `note`, `progression`), supprimés par la
migration : les garder ferait croire à des fonctions inexistantes, et ils voyageaient
à chaque écriture et à chaque synchronisation.

Reste ce que la console ne sait pas faire : voir toute la bibliothèque d'un coup, et
savoir chez qui sont les jeux.

Dans le même mouvement, `App.jsx` — 1 560 lignes, 136 Ko, styles inline compris — a
été découpé en `src/lib/` et `src/components/`. La contrainte du fichier unique avait
tenu longtemps ; elle rendait désormais chaque ajout plus coûteux que le précédent, et
une erreur ne se cherchait plus qu'à l'aveugle. Les couleurs sont sorties du
JavaScript vers des jetons CSS : tant que rien ne passait par une feuille de style,
aucune media query n'était possible — donc aucun thème qui suive le téléphone.

### Phase 10 — Le prêt comme sujet à part entière

« Rendu » remettait `lentA` et `lentDate` à `null` : le prêt disparaissait sans laisser
de trace. On ne savait plus à qui on avait déjà confié un jeu, ni que la même personne
met trois mois à chaque fois — alors que c'est précisément ce que cette application est
censée savoir. Un **historique borné à 20 entrées par jeu** est apparu, porté par le
jeu lui-même, donc voyageant dans l'export et la synchronisation.

Le seuil d'alerte unique de 30 jours traitait de la même façon le jeu passé à un frère
pour le week-end et celui confié à un collègue pour l'été : une **date de retour
convenue**, facultative, fait désormais foi quand elle existe.

Trois défauts trouvés en chemin, tous silencieux :

- `rendreJeu` **jetait la date convenue** en archivant. La fonctionnalité ne laissait
  donc aucune trace une fois le jeu rendu, et la seule question qui compte — a-t-il
  rendu quand il l'avait dit ? — devenait impossible à poser.
- Un prêt **encore dehors** comptait comme « rendu en retard » : son `au` vaut
  aujourd'hui. Repéré sur une capture d'écran de vérification, pas par un test.
- `Math.round` arrondit −0,5 vers le haut quand il arrondit +0,5 vers le bas : sur un
  écart de retard, le biais jouait systématiquement contre l'emprunteur. Un test l'a
  attrapé.

### Phase 11 — Le noir profond, et un bouton de moins

Le thème ne connaissait que deux états et ignorait le réglage du téléphone : un
appareil qui bascule en sombre le soir laissait une application restée en clair. Trois
modes sont apparus, dont un **automatique** qui suit le système en cours de route.

Le noir profond a d'abord été ajouté comme **préférence applicable par-dessus** le
sombre — un raisonnement défendable : l'OLED est une variante du sombre, pas un pair
de « clair » et « automatique ». Une capture d'écran a tranché autrement : quatre
commandes dans un panneau qui en comptait déjà trois pour la même question, et pour un
choix qui n'en est pas un. Entre un bleu nuit et un vrai noir, on tranche une fois. Le
sombre **est** devenu le noir profond, la valeur stockée restant `"dark"` pour n'avoir
rien à migrer.

### Phase 12 — Ce qui casse en silence

Une série de défauts qui avaient en commun de ne jamais se voir :

- **Le Worker** produisait `updatedAt` avec `toISOString()`, précis à la milliseconde.
  Deux envois dans la même milliseconde portaient le même horodatage — or c'est lui qui
  identifie la version. Un appareil resté en arrière présentait alors une base par
  accident identique à la version courante : le conflit passait inaperçu et son envoi
  **écrasait l'autre**. Trouvé par l'intégration continue, dont le runner est plus
  rapide que la machine de développement ; le test fige désormais l'horloge.
- **L'import ne validait que les types.** « pas une date » est une chaîne, donc ça
  passait, et le `NaN` qui en sortait remontait jusque dans les moyennes de l'onglet
  Stats, affiché comme une statistique. Une plateforme inconnue entrait sans apparaître
  dans aucun filtre ; un format inventé n'était compté ni en physique ni en démat, si
  bien que les trois tuiles de Collection cessaient de s'additionner.
- **Le thème clair** affichait son accent à 2,58:1 là où WCAG AA demande 4,5. Le jeton
  `--accent` existait mais ne servait à rien : le bleu était écrit en dur une
  cinquantaine de fois, donc le thème clair ne pouvait pas le corriger.
- **Échap ne fermait aucun panneau**, et la page défilait derrière eux. Le verrou de
  défilement posé sur `<body>` ne bloquait rien : c'est `<html>` qui défile ici.
- **Le manifeste PWA** habillait encore l'écran de démarrage en bleu nuit et la barre
  système en bleu, autour d'une application devenue noire.

### Phase 13 — L'application mesurée contre les règles

Jusqu'ici l'ergonomie se décidait à l'œil. Confrontée à Material Design 3, aux lois
de l'UX et à un cahier des charges d'accessibilité, elle a rendu une liste de défauts
qui avaient tous en commun d'être vérifiables — donc indiscutables.

- **Quatre contrastes sous la barre**, dont trois par oubli : le bouton « Voir N jeux »
  posait du blanc sur `--accent` (3,00:1) alors que `--accent-fond` existe exactement
  pour ça, et deux « Annuler » gardaient un gris écrit en dur, à 2,32:1 sur le thème
  clair. Le passage aux jetons avait été fait ; il n'avait pas été fini.
- **Le focus clavier était invisible.** Douze champs posaient `outline: none` en style
  inline sans rien mettre à la place. Retirer l'anneau du navigateur est un choix
  esthétique légitime ; ne pas le redessiner ne l'est pas.
- **Les croix de fermeture mesuraient une dizaine de pixels.** Sans cadre, sans
  remplissage, la cible valait la taille du glyphe. Material demande 48 dp, Apple 44 pt,
  WCAG 2.5.5 44 px : le plancher retenu est 44, le plus bas des trois, et il est
  désormais tenu par une variable plutôt que par la vigilance.
- **Les panneaux n'étaient pas des dialogues.** Ni `role`, ni `aria-modal`, ni piège de
  focus : Tab continuait de parcourir la page cachée derrière, et refermer renvoyait le
  focus au début du document.
- **`Annuler` déclenchait une fusion.** L'import demandait « OK = REMPLACER, Annuler =
  FUSIONNER » dans un `confirm()`. Deux actions distinctes ne tiennent pas dans un bouton
  binaire : Échap, qui ferme sur Annuler, importait le fichier. Trois boutons nommés
  remplacent la devinette, et annuler n'importe plus rien.
- **Les champs de saisie sous 16 px** font zoomer Safari iOS à la prise de focus. C'est
  un comportement du navigateur, pas un réglage : un plancher CSS le neutralise.
- **Trois grammaires de bouton principal** cohabitaient — aplat bleu, contour teinté,
  aplat plat. L'effet von Restorff ne fonctionne que si la forme remarquable est la même
  partout : l'aplat est l'action principale, le contour teinté dit désormais « c'est ce
  qui est choisi ». Au passage, neuf rayons de bordure sont devenus quatre jetons et neuf
  tailles de police cinq.

Le tout est vérifié dans le navigateur plutôt qu'à la lecture : un script mesure chaque
élément interactif de chaque écran, à 360 et 412 px, dans les deux thèmes, et échoue s'il
trouve une cible sous le plancher, un texte sous 11 px ou un débordement horizontal.

### Phase 14 — Seize pixels

Le corps de texte tournait entre 11 et 13 px. C'est lisible sur la capture
d'écran d'un développeur assis devant son écran, moins dans un canapé à bout de
bras — et les référentiels mobiles donnent 16 px pour le texte courant.

Le passage n'est pas un remplacement de nombres : cinq rôles remplacent neuf
tailles choisies au coup par coup. Ce que l'écran dit (16), ce qu'il précise
(14), ce qu'il étiquette (12), ce qu'il titre (20), et le chiffre qu'on vient
lire dans une tuile (24). Rien ne descend sous 12 px.

Le coût est réel et assumé : la liste montre cinq jeux par écran au lieu de
huit. En échange, la longueur de ligne d'une description passe d'environ 55
caractères à 40 — dans la fourchette conseillée sur mobile, alors qu'elle en
sortait.

Deux conséquences ont dû être réglées : « 🌑 Noir profond » ne tenait plus dans
un tiers de 360 px et faisait déborder la page (le libellé passe sur deux lignes
plutôt que d'être raccourci, ce qui lui coûterait son sens), et un titre de jeu
sur deux se coupait dans la liste (« Animal Crossing New… » ne dit pas quel
épisode c'est : deux lignes au lieu d'une).

Deux règles du cahier des charges restaient par ailleurs non appliquées :

- **L'état pressé n'existait nulle part.** Un bouton doit cinq états ; quatre
  étaient là. Sur un écran tactile, le pressé est le seul retour immédiat qu'on
  ait, puisque le doigt cache le bouton.
- **Les erreurs de champ ne portaient que du rouge.** La couleur seule ne dit
  rien à qui ne la distingue pas ; un pictogramme la double désormais.

### Phase 15 — Ce qui a la bonne forme sans être une donnée

L'application se défendait bien contre ce qui ne ressemble à rien : un fichier
qui n'est pas du JSON, un titre absent, un tableau qui n'en est pas un. Elle ne
se défendait pas contre ce qui a la bonne forme et n'est pourtant pas une
donnée — et c'est là que se trouvaient les cinq défauts de cet audit.

- **« 0001-01-01 » est une date ISO valide.** Elle passait tous les contrôles,
  et l'histogramme des ajouts, qui comble toutes les années entre la plus
  ancienne et la plus récente, en tirait deux mille vingt-six colonnes larges
  de zéro pixel : huit mille éléments, quinze secondes de rendu. Une année mal
  tapée dans un champ date suffit, et le champ est là, dans « Modifier la
  fiche ». Trois défenses désormais : l'import ramène la date à aujourd'hui en
  l'annonçant, l'édition refuse en disant quelle année elle attend, et le calcul
  cesse de combler au-delà de quarante ans d'étendue — le graphique perd son
  échelle régulière, mais il s'affiche.
- **`joursDePret` produisait un NaN** sur une date illisible, que l'onglet
  Prêts affichait tel quel : « NaNj » présenté comme une durée. Un commentaire
  de l'application affirmait déjà que cette fonction s'en gardait ; il décrivait
  une intention, pas le code.
- **La migration ne garantissait pas `genre` ni `myLinks`**, alors que la liste
  les déréférence sans précaution à chaque rendu (`g.genre.some(...)`,
  `g.myLinks[i]`). Un enregistrement écrit par une version ancienne faisait
  donc tomber l'application entière sur son garde-fou d'erreurs. Cette fonction
  existe pour rendre sûr ce qui vient du stockage ; elle le faisait pour trois
  champs sur cinq.
- **Un lien de fiche finit dans un `href`, et `javascript:` en est un.** React
  ne filtre rien. Un fichier importé, ou une sauvegarde récupérée avec un code
  partagé un jour d'imprudence, suffisait à placer dans une fiche un lien qui
  s'exécute dans l'application — avec accès au stockage, donc aux clés et au
  code de synchronisation. Filtré à l'entrée et au rendu ; un lien refusé reste
  affiché en texte, pour qu'on comprenne pourquoi il ne s'ouvre plus.
- **Une réponse du Worker sortait sans en-têtes CORS.** Le navigateur refuse
  alors d'en lire le corps et signale une erreur d'origine à la place du vrai
  statut : on cherche un problème de configuration là où il n'y a qu'une méthode
  interdite.

Les cinq sont couverts par des tests qui échouent sur le code d'avant — c'est
la seule preuve qu'un test vaut quelque chose. L'audit des données a gagné deux
règles au passage : une année d'ajout invraisemblable et un lien non ouvrable
sont désormais signalés comme graves.

### Phase 16 — Deux langues pour la même chose

La question de départ était d'ajouter des filtres. En mesurant lesquels
vaudraient quelque chose sur une bibliothèque réelle de 154 jeux, le filtre
auquel on pense en premier s'est révélé inutilisable : les genres comptaient
33 valeurs dont la moitié étaient le même genre écrit deux fois.

    Adventure 21 · Aventure 20      Platformer 16 · Plateforme 17
    Racing 10 · Course 6            Sports 2 · Sport 4

La cause n'est pas une faute mais une rencontre : la bibliothèque de départ a
été écrite à la main en français, et RAWG répond en anglais. Chaque fiche tenait
ses genres d'une seule source — aucune ne portait les deux formes — si bien que
la collection s'était silencieusement séparée en deux moitiés selon qui avait
répondu le premier. Un filtre par genre aurait donné, pour « Aventure », la
moitié des jeux d'aventure.

Le français est la forme de référence parce que c'est celle du projet, pas parce
qu'elle serait plus juste. Une table de correspondance, lisible et corrigeable
d'un coup d'œil, s'applique aux trois portes d'entrée d'un genre : le stockage,
l'import, l'édition manuelle. Elle règle au passage la casse — « aventure » tapé
à la main comptait à part.

Deux choix méritent d'être dits parce qu'ils sont discutables. « Puzzle »
l'emporte sur « Réflexion », qui cohabitaient dans les seules données de départ,
parce que c'est la forme que RAWG renvoie et la seule des deux qu'on trouve dans
une bibliothèque réelle. Et « Shooter », « FPS » et « TPS » restent trois genres
distincts : ce ne sont pas des synonymes, la vue à la première ou à la troisième
personne est une information, pas une traduction.

Résultat mesuré : 33 valeurs deviennent 28, aucun jeu ne perd de genre, et les
comptes s'additionnent exactement — Aventure passe de 20 à 41, Plateforme de 17
à 33. La fonction est idempotente, donc la migration la rejoue à chaque
chargement sans numéro de version, contrairement à `bcV`.

### Phase 17 — Deux questions que la bibliothèque savait déjà

Deux filtres, choisis parmi neuf candidats en mesurant ce que chacun donnerait
sur une bibliothèque réelle plutôt qu'en imaginant.

**Le mode de jeu** répond à « on est deux ce soir, on lance quoi » — la question
que cent cinquante jeux rendent difficile. L'application avait la réponse depuis
le début sans savoir la donner : Wikidata renseigne le mode, il n'était affiché
que fiche par fiche. Sur la bibliothèque réelle : 121 jeux solo, 85 à plusieurs,
31 en coopératif.

Les étiquettes de Wikidata ne forment pas un vocabulaire — « solo », « Solo »,
« mode coopératif », « joueur contre joueur », « multijoueur en écran divisé /
partagé », « two-player video game ». Contrairement aux genres, elles ne sont
PAS réécrites dans les fiches : « écran divisé » n'est pas « en ligne », et
perdre cette nuance pour trois boutons serait un mauvais change. Le classement
se fait à la lecture. Le coopératif compte comme un multijoueur, jamais
l'inverse : qui demande « à plusieurs » veut aussi les jeux qu'on ne peut faire
qu'ensemble.

Trente-deux jeux n'ont pas de fiche Wikidata et ne sortent donc d'aucun de ces
choix. C'est écrit dans le panneau, avec le nombre : sans cette phrase, un
filtre « Solo » a l'air d'affirmer que les jeux absents ne sont pas solo, alors
qu'il dit seulement qu'on ne sait pas.

**Le genre** n'était possible que depuis la normalisation de la phase 16. Il
est dérivé de la bibliothèque et non d'une liste fermée, et classé par nombre de
jeux : « Action » à 83 et un genre porté par un seul titre n'ont pas à se
présenter comme deux choix équivalents. Vingt-huit genres, ce n'est plus un
choix mais un mur, alors huit sont affichés et le reste attend derrière un
bouton — sauf le genre sélectionné, qui reste visible même s'il vient de la
traîne, sans quoi le filtre actif disparaît de l'écran et on ne sait plus
comment l'enlever.

### Phase 18 — Un panneau qu'on n'ouvre plus en apnée

Le panneau des filtres montrait ses sept groupes dépliés : quarante boutons
d'un coup, cinquante quand la liste des genres s'ouvrait. La loi de Hick dit ce
qui se passe alors — on ne filtre plus, on renonce — et il fallait faire défiler
pour découvrir qu'un filtre par mode de jeu existait.

Chaque groupe tient désormais sur une ligne qui porte sa valeur courante et
s'ouvre au toucher, un seul à la fois. Cinq lignes au lieu de quarante boutons,
et surtout on voit d'un coup d'œil toutes les dimensions disponibles et
lesquelles sont déjà posées — ce que la version dépliée rendait impossible.
Les lignes sont séparées par un filet et non par du vide : elles forment une
liste, pas des blocs.

Le tri est sorti du panneau. Ce n'était pas un filtre — le badge ne le comptait
pas, et le panneau devait s'appeler « Filtres & affichage » pour l'accueillir.
Il vit au-dessus de la liste, visible sans rien ouvrir, sur une ligne qui dit
aussi combien de jeux l'écran montre quand ce nombre diffère du total.

**Et une chose qu'on ne cherchait pas.** En posant la case à cocher demandée
pour la rétrocompatibilité, les chiffres ont montré que le problème était plus
grave que le confort : « Xbox Series X » rendait 101 jeux dont 19 seulement sont
des jeux Series X, et « Switch 2 » 53 pour 6 natifs. Le mélange était imposé
depuis toujours, si bien que la question « qu'est-ce que j'ai vraiment sur cette
console » n'avait aucune réponse dans l'application. La case répond aux deux
questions au lieu d'une : cochée par défaut pour « quoi jouer ce soir »,
décochée pour l'inventaire. Elle ne s'affiche que pour une console qui en
accueille une autre, elle annonce combien de jeux elle ajoute, et la ligne
repliée dit « Xbox Series X seul » quand elle est décochée — un filtre plus
étroit que la normale doit se voir sans être ouvert.

Les statistiques disaient alors autre chose que les filtres. Le bloc « Par
plateforme » annonçait « 82 jeux jouables sur Xbox Series X » juste sous une
barre marquée 19 : deux chiffres justes que rien ne reliait, et c'est leur somme
— 101, exactement ce que montre le filtre — qui répond à la question posée à une
ludothèque. Chaque console qui en accueille une autre porte désormais la phrase
entière. Les barres continuent de compter chaque jeu une fois, sur la console
pour laquelle il a été acheté ; ces lignes disent l'autre vérité, celle du soir
où l'on choisit quoi jouer.

### Phase 19 — Ce qu'on demande à cent cinquante jeux

Le reste de la liste de filtres, d'un coup. Trois d'entre eux méritent d'être
racontés parce qu'ils ont demandé une décision, pas seulement du code.

**« À compléter » est le seul filtre qui fasse travailler.** L'onglet Stats
savait compter les manques depuis longtemps — « 21 jeux sans note » — mais on
ne pouvait pas y aller : un constat sans porte de sortie. Le filtre les sort, et
il n'annonce que ce qui manque réellement : une option disparaît dès que son
champ est rempli partout, le bloc entier disparaît quand la bibliothèque est
complète. Une case « Jaquette 0 » promettrait du travail qui n'existe pas. Les
prédicats sont partagés avec le bloc des Stats, si bien que le chiffre affiché
et la liste obtenue ne peuvent plus diverger.

Il a d'abord été rangé dans l'accordéon avec les autres, ce qui était une
erreur de rang : les autres filtres répondent à « montre-moi », celui-ci répond
à « qu'est-ce qu'il me reste à faire ». Il est remonté en tête du panneau, hors
de l'accordéon, en bloc plein cerné d'accent — le seul du panneau, et il n'y en
aura jamais deux, sans quoi l'effet von Restorff ne joue plus. Il porte le
nombre de fiches concernées, 42 sur une bibliothèque réelle : pas la somme des
colonnes, puisqu'un même jeu peut manquer de trois choses.

La question « il disparaît quand il n'y a plus rien à compléter ? » a trouvé le
défaut que la réponse « oui » cachait. Oui, sauf qu'il disparaissait AUSSI quand
le filtre était posé au moment où le dernier manque était comblé — et il
emportait alors le seul moyen de retirer un filtre qui venait de vider la liste :
zéro jeu à l'écran, un badge annonçant un filtre actif, et plus rien pour
l'enlever sauf « Réinitialiser », qui efface aussi tout le reste. Le bloc reste
donc affiché tant que le filtre est posé, et dit alors autre chose : « Plus rien
à compléter : toutes les fiches sont remplies. » C'est exactement le piège déjà
évité pour le genre, où la valeur choisie reste visible même quand elle sort de
la traîne — et il a fallu qu'on repose la question pour le voir ici.

**Le hasard devait tenir.** « Je joue à quoi ce soir » est la vraie question
d'une ludothèque de cette taille, et un tirage y répond mieux qu'un classement.
Mais `Math.random()` dans un comparateur rebat les cartes à chaque rendu : la
liste danserait sous le doigt à chaque frappe dans la recherche, et le
comparateur lui-même serait incohérent. D'où une empreinte calculée depuis
l'identifiant du jeu et une graine, changée seulement quand on redemande à
mélanger.

**Ce qui n'a pas de valeur va toujours à la fin.** Inverser le tri par note
aurait remonté en tête les vingt-et-un jeux sans note, c'est-à-dire exactement
ce qu'on ne cherche pas. La clé de tri vaut donc `null` quand elle est inconnue,
et ce cas est traité avant le sens : l'inversion ne porte que sur ce qui a une
valeur.

La série, elle, n'a pas de place dans le panneau — cinquante-huit valeurs ne
tiennent pas dans une grille de boutons. Elle se pose en touchant son nom sur
une fiche, et le groupe n'apparaît alors que pour montrer le filtre posé et
permettre de l'enlever : sans lui, on ne saurait plus comment revenir.

Deux défauts trouvés en vérifiant, tous deux invisibles à la lecture. Le bouton
« Réinitialiser » du panneau calculait le nombre de filtres actifs sans les
nouveaux, et restait donc grisé alors qu'il y avait bien quelque chose à
réinitialiser. Et le nombre d'une puce était collé à son libellé dans l'arbre
d'accessibilité — un lecteur d'écran annonçait « Note21 » — parce que l'espace
était dessinée par une marge au lieu d'être écrite.

### Phase 20 — Une ligne au lieu de deux

Le tri sorti du panneau avait pris une rangée à lui, sous la recherche, avec le
nombre de jeux affichés à sa gauche. Deux rangées de commandes empilées avant la
première jaquette : sur un écran de 780 px de haut, c'est un huitième de la
liste dépensé en boutons. Tout tient maintenant sur la ligne de recherche.

Quatre commandes sur 360 px ne rentrent qu'à deux conditions. Le champ abrège
son invite — « Rechercher… » au lieu d'énumérer titre, genre et tag, ce que la
recherche montre d'elle-même dès la première lettre — et passe de 20 à 16 px,
la plus petite taille qui n'appelle pas le zoom automatique d'iOS. Le bouton de
tri, lui, ne porte son libellé que lorsqu'il ne trie plus par défaut : afficher
« A → Z » quand rien n'a été choisi prend la place d'un autre bouton pour ne
rien apprendre. Le compteur de jeux filtrés remonte dans l'en-tête, à côté du
total, où il se lit « 154 jeux · 23 affichés ».

Mesuré à 360 px : quatre cibles de 48 px, la ligne finit à 346 px sur les 346
disponibles. Au pire cas — un tri choisi et un filtre posé — le champ tombe à
88 px, et ce qu'il affichait alors ne ressemblait à rien : « Reche ». L'invite
d'un champ ne s'abrège pas comme un texte, elle se coupe net. Elle se réduit
donc à une loupe dès que le bouton de tri porte son libellé — un signe entier
plutôt qu'un mot amputé. Le nom accessible du champ est écrit à part, sinon un
lecteur d'écran annoncerait l'émoji.

Relue contre les règles du document, la ligne avait un défaut qu'elle venait
d'introduire : un tri choisi et un filtre posé donnaient deux boutons au
traitement identique — contour accentué, texte accentué — côte à côte et sans
la même importance, ce que le document interdit et qui affaiblit l'effet von
Restorff. Le contour accentué est désormais réservé à « Filtres », seul bouton
qui porte un compteur et ouvre un panneau ; le tri se signale par la couleur de
son texte, le sens par un fond légèrement teinté.

### Phase 21 — Le chemin vers Wikidata

Vingt-cinq fiches sur cent cinquante-quatre n'ont pas d'infobox, et rien dans
l'application ne disait comment leur en donner une. Le chemin existait pourtant
depuis le début : « Modifier la fiche », puis « 🇫🇷 Titre français », dont la
recherche rapporte quatre choses — le titre français, le résumé, la jaquette et
les infos Wikidata. L'étiquette n'en annonçait qu'une sur quatre, et la seule
qui mène à Wikidata n'était nommée nulle part.

Le bouton s'appelle donc « 📚 Wikipédia », et la feuille « Compléter depuis
Wikipédia ». Surtout, le manque se dit maintenant là où il se voit : une fiche
sans infobox affichait un blanc à l'endroit de la section, ce qui la faisait
paraître complète. Elle affiche « Aucune fiche Wikidata » et un bouton qui ouvre
la recherche directement, sans repasser par « Modifier la fiche ».

Reste écartée pour l'instant l'action groupée qui remplirait les vingt-cinq d'un
coup. Leurs titres sont « Sleeping Dogs™ Definitive Edition », « GTA: Vice City
– The Definitive Edition », les Sonic d'une compilation : précisément ceux qu'une
correspondance exacte rate, parce que Wikipédia les range sous le nom du jeu
d'origine. Et le rapprochement approximatif, la règle des séries de l'audit a
montré ce qu'il vaut.

### Phase 22 — Deux sources qui ne se marchent plus dessus

Les vingt-cinq fiches sans infobox ont un point commun : ce sont des remasters
et des compilations. Wikipédia les range sous la page du jeu d'origine, si bien
que « Sonic The Hedgehog » y sort en 1991 quelle que soit la compilation qu'on
possède. RAWG, lui, a une entrée par édition, avec la date de celle qu'on a
achetée — mais ses éditeurs et développeurs viennent d'une base communautaire,
moins sûre sur les vieux titres.

Aucune des deux ne gagne partout, d'où le mélange. Et le détail RAWG que la
fiche demandait déjà pour la jaquette et la note contenait depuis toujours les
développeurs, les éditeurs, la date et les tags : on les jetait. Les lire ne
coûte pas un appel réseau de plus.

La règle qui rend le mélange sûr : une source ne remplit que les champs vides et
n'écrase jamais. Passer RAWG puis Wikipédia sur un remaster garde la date de la
version possédée et complète le reste. Une source qui n'a rien rempli ne signe
pas la provenance — dire « et RAWG » sur une fiche où RAWG n'a rien apporté
serait une fausse piste au moment de démêler une date. Car la fiche dit
maintenant d'où elle vient : « Source : RAWG et Wikidata ». Sans cette ligne,
dans six mois, une date ne dit plus si elle décrit le jeu de 1991 ou la
compilation de 2022.

Deux conséquences. Les infobox d'avant, qui ne portent aucune provenance, sont
réputées venir de Wikidata — c'était la seule source de l'époque, et les faire
ressortir sans origine serait mentir par omission. Et surtout, puisque plus rien
ne s'écrase, il fallait de quoi repartir propre : sans cela, une infobox fausse
le resterait, chaque nouvelle source la respectant poliment. D'où « 🧹 Vider »,
cinq cases plutôt qu'un bouton unique — « repartir propre » ne veut pas dire la
même chose selon qu'une infobox est fausse ou qu'une jaquette l'est, et tout
effacer d'un geste ferait perdre ce qui était bon. Ce qui est déjà vide reste
décoché et inerte : le proposer laisserait croire qu'il y a là quelque chose à
enlever.

Le manque, enfin, ne s'appelle plus « Fiche Wikidata » mais « Fiche détaillée » :
deux sources la remplissent désormais, et la nommer d'après une seule était
devenu faux.

Deux défauts trouvés en relisant ce travail contre les règles d'interface, l'un
et l'autre dans du code écrit une heure plus tôt. La ligne de provenance portait
une opacité de 0,8 pour rester discrète : à 12 px, sur le fond clair, cela la
faisait tomber à 3,34:1 contre les 4,5:1 exigés — la discrétion se paie en
taille et en couleur, jamais en transparence. Et dans la feuille de vidage, le
bouton « Vider » occupait deux tiers de la barre contre un tiers pour
« Annuler » : la place d'un bouton dit son importance, et inviter le pouce vers
l'action irréversible est un mauvais conseil. Il était de surcroît grisé et muet
tant qu'aucune case n'était cochée — exactement ce qu'on venait de reprocher
ailleurs. Il reste actif et dit ce qui manque.

### Phase 23 — Une liste qu'on peut envoyer

L'export JSON existait depuis le début, mais il sert à déménager une
bibliothèque, pas à la montrer : personne ne choisit un jeu dans un objet à
accolades. Le besoin était autre — envoyer à quelqu'un de quoi choisir ce qu'il
veut emprunter.

Du texte, donc, et pas un document : dans une conversation, un texte reste
cherchable et citable, on peut répondre « je prends celui-là » en collant la
ligne. Un PDF oblige à ouvrir un lecteur, ne se cite pas, et coûterait une
bibliothèque de deux cents kilo-octets dans le pré-cache d'une application qui
n'en a aucune.

Le partage n'a pas de sélecteur de plateforme, alors que c'est ainsi qu'il avait
été demandé. Il exporte la liste affichée, celle que les filtres ont déjà
composée : choisir Switch puis partager donne les jeux Switch, et la même
mécanique donne aussi les jeux notés plus de 80, ceux d'un genre ou d'une série.
Un second sélecteur aurait redit ce que le panneau des filtres dit mieux, et
deux endroits pour dire la même chose finissent toujours par se contredire.

La note Metacritic, elle, a été retirée après coup. Elle sert à trier sa propre
bibliothèque ; affichée dans une liste qu'on envoie, elle range les jeux qu'on
prête en bons et en mauvais avant même qu'on les ait proposés.

Chaque ligne porte le format, et pas pour faire joli : un jeu démat est attaché à
un compte, personne ne peut l'emprunter, et sans la mention la liste promet des
jeux qu'on ne peut pas prêter. Les jeux prêtés y restent avec la date de retour
convenue quand il y en a une — les cacher donnerait à croire qu'on ne les possède
pas, et dire « prêté » sans dire jusqu'à quand n'apprend pas si l'on peut espérer
son tour.

Un défaut trouvé en vérifiant, et vieux de plusieurs phases : les trois bandeaux
de bas d'écran sont posés à `left: 50%`, ce qui ne leur laisse pour largeur
disponible que la moitié droite de l'écran. « Liste copiée — colle-la où tu
veux » s'y repliait sur trois lignes dans une boîte de 175 px alors qu'il en
restait 347 de libres. Invisible tant que les textes étaient courts, mais
« 🗑 « Grand Theft Auto: San Andreas – The Definitive Edition » supprimé »
l'aurait montré depuis longtemps.

### Phase 24 — Un jeu ajouté qui avait l'air supprimé

Signalé ainsi : « j'ai plusieurs Zelda et quand je les ajoute il se supprime
tout seul, c'est pas ton truc de déduplication qui merde ». Ce n'était pas la
déduplication — il n'y en a aucune sur le chemin d'ajout, pas une ligne.

Le scénario se reproduit en trois gestes. On touche le nom d'une série sur une
fiche, ce qui pose le filtre « série » ; on ajoute un autre jeu de cette série ;
il n'apparaît pas. Il est pourtant bien là : l'en-tête dit « 4 jeux · 3
affichés » et le badge des filtres affiche 1. Mais le jeu neuf n'a pas encore de
fiche Wikidata, donc pas de série, donc il ne passe pas le filtre qui l'a amené
là. Ajouter ressemblait trait pour trait à supprimer.

La cause tient en une ligne d'histoire. `addGame` remettait à zéro la
plateforme, le filtre de prêt et la recherche — les trois filtres qui existaient
le jour où il a été écrit. Les six ajoutés depuis, dont la série, ne l'étaient
pas. L'import Xbox avait exactement le même trou, et le bouton
« Réinitialiser » du panneau, lui, énumérait bien les neuf. Trois copies d'une
même liste, dont deux avaient cessé de suivre.

D'où `FILTRES` dans le modèle, une seule liste, et `SETTEURS_FILTRE` dans
App.jsx, qui dit comment on éteint chacun. Rien dans le langage n'oblige les
deux à s'accorder : un test de cohérence lit la table dans le source et échoue
si un filtre n'a pas son effacement, ou si un effacement ne correspond à aucun
filtre connu. Vérifié en retirant un filtre à la main — la CI le nomme.

### Phase 25 — Le bouton qui cachait cent vingt-cinq jeux

« On pourrait pas enlever le truc chargé en bas et vraiment afficher tous les
jeux ? » La réponse spontanée fut non, chiffres à l'appui : monter trente fiches
coûte environ 170 ms ici et 800 sur un processeur quatre fois plus lent, donc
tout monter d'un coup approcherait les quatre secondes d'écran figé.

Cette estimation était fausse d'un facteur quatre, et elle l'était pour une
raison instructive : elle extrapolait le coût d'un clic sur « Charger 30 de
plus », qui remonte la liste déjà en place en même temps que les nouvelles
fiches. Monter les cent cinquante-cinq d'un seul tenant coûte bien moins que la
somme des paliers.

La vraie mesure, sur la bibliothèque réelle et la version construite, trois
essais par ligne, médiane retenue :

| Processeur | Avec le bouton | Tout affiché |
| --- | --- | --- |
| Machine de bureau | 330 ms | 522 ms |
| Ralenti ×4 | 1,0 s | 1,7 s |
| Ralenti ×6 | 1,4 s | 2,5 s |

Et une fois tout monté, filtrer prend vingt millisecondes ; le pire cas —
effacer la recherche pour faire revenir les cent cinquante-cinq — quatre cent
quatre-vingts sur le plus lent des trois, soit à peine au-dessus du seuil de
Doherty. Une seconde au démarrage contre un bouton en moins et la bibliothèque
entière visible : le change est bon, et les trente-cinq états par fiche qu'on
s'apprêtait à refondre peuvent attendre.

Deux leçons de mesure, notées pour la prochaine fois. Le serveur de
développement fausse tout : son optimiseur de dépendances ajoutait treize
secondes identiques à chaque essai, et il fallait mesurer sur `dist/`. Et
`page.goto` attend par défaut le chargement complet, donc les polices Google et
les jaquettes distantes que le proxy de cet environnement refuse — treize
secondes de plus, constantes, qui n'avaient rien à voir avec l'application.

### Phase 26 — Ce qu'on retrouve en rouvrant, et l'âge de la sauvegarde

Deux manques trouvés en répondant à une question — « la synchronisation envoie
vraiment le plus de choses possible ? ». Sur le fond, oui : la sauvegarde
emporte la totalité de chaque fiche, jusqu'à l'historique des prêts passés et la
provenance des infos, plus le mode d'apparence, plus les clés si la case est
cochée. Les seules exclusions sont voulues et se justifient l'une comme l'autre
— l'adresse du relais, qu'on ne peut pas restaurer depuis la sauvegarde qu'elle
sert à joindre, et le code, qui est ce qui la protège.

Mais deux choses manquaient autour.

La vue, le tri, son sens et le regroupement ne survivaient à aucun lancement :
on rouvrait en liste triée de A à Z ce qu'on avait quitté en grille par date de
sortie. Ce n'était pas un trou de la synchronisation, c'était une absence de
persistance — ces réglages n'étaient écrits nulle part, pas même en local. Ils
le sont maintenant, et relus comme tout ce qui vient du stockage : une valeur
inconnue retombe sur le défaut plutôt que d'entrer telle quelle.

Les filtres, eux, restent volontairement dehors. Un réglage d'affichage change
comment on regarde ; un filtre change ce qu'on voit. Un filtre qui survivrait au
redémarrage donnerait une bibliothèque amputée sans qu'on sache pourquoi —
exactement le défaut de la phase précédente, mais permanent.

L'autre manque était plus sérieux. La synchronisation est manuelle, et c'est
bien ainsi ; mais une sauvegarde qu'on oublie de faire n'existe pas, et son âge
ne se lisait que sous forme de date brute, dans un panneau qu'on n'ouvre jamais.
Passé sept jours — assez long pour qu'une semaine sans jouer ne réclame rien,
assez court pour ne jamais perdre plus d'une semaine d'ajouts — une pastille
apparaît sur l'onglet des réglages, et la ligne y dit « il y a 12 jours » suivie
de ce que ça coûte : ce qui a été ajouté depuis n'existe que sur cet appareil.
Pas de bannière, rien à écarter : le retard cesse simplement d'être invisible.

Deux cas limites traités par les tests plutôt que découverts en usage : une date
de sauvegarde illisible ne produit pas un âge de `NaN` jours, et une date dans le
futur — deux appareils dont les horloges divergent — ne donne pas un âge négatif.

### Phase 27 — Un audit, et le garde-fou qui l'avait manqué

Audit complet contre le document d'ergonomie, mesuré dans le navigateur sur
quatorze écrans et deux thèmes. Quatre défauts réels, et une cause commune plus
intéressante qu'eux trois.

Le contraste d'abord. Le jeton du texte secondaire donnait 4,91:1 sur les
cartes et 4,63:1 dans le corps, mais 4,31:1 sur le fond de l'en-tête, plus
sombre — or c'est là que vivent la ligne « 155 jeux » et les libellés des
onglets inactifs. Un jeton mesuré sur un seul de ses fonds n'est mesuré nulle
part : il passe à 4,92:1 partout.

Puis la fenêtre « Ajouter un jeu », seule pièce jamais reprise depuis l'audit
d'ergonomie : deux boutons de source à 26 px, « Annuler » et « Ajouter » à 40,
et aucun libellé visible — le titre n'avait que son invite, le menu déroulant de
plateforme, celui de format et le champ de date n'avaient rien du tout, pas même
un nom pour un lecteur d'écran. Et le bouton « Lire la suite » d'une fiche, à
20 px de haut, le seul de la carte à n'avoir jamais reçu de hauteur de cible.

**La cause commune, et le vrai sujet de cette phase :** `verif-ui` ne visitait
ni la fenêtre d'ajout, ni l'édition à la main, ni une fiche assez longue pour
afficher « Lire la suite ». Trois défauts ont vécu des mois derrière un garde-fou
qui affichait « Rien à signaler » — non pas parce qu'il n'y avait rien, mais
parce qu'il ne regardait pas là. La promenade couvre maintenant ces trois
écrans, et la description longue est écrite par l'édition plutôt qu'injectée
dans `localStorage` : au rechargement, la sauvegarde `pagehide` de
l'application aurait réécrit la clé avec ce qu'elle avait en mémoire.

Un second angle mort, découvert en corrigeant : le script mesurait un serveur
lancé à part, servant le dernier `dist/` construit. Oublier de reconstruire, et
il mesurait la version d'avant les corrections en répondant « Rien à signaler ».
`npm run verif:ui` construit désormais avant de mesurer, et le script sert
`dist/` lui-même — ce qui se lance à côté finit par ne plus être lancé.

Restent trois écarts assumés, inchangés : 44 px et non 48 sur les commandes
secondaires (conforme Apple et WCAG, pas au chiffre de Material), les listes
contiguës sans les 8 px de séparation (c'est le motif de liste standard, la
règle vise des boutons distincts), et tout en haut de l'écran.

### Phase 28 — Deux univers : console et PC

Une ludothèque de console et une bibliothèque PC ne se décrivent pas avec les
mêmes mots. Sur console, la plateforme dit sur quelle machine le jeu tourne et
le format dit s'il est sur une galette ou dans un compte. Sur PC, la machine est
toujours la même, et ce qui distingue un jeu d'un autre est la boutique où il
vit. D'où « PC » comme plateforme et `boutique` comme champ séparé, plutôt
qu'une liste « PC (Steam) », « PC (Epic) » qui aurait mélangé deux axes sans
rapport — et qu'on aurait payée à chaque filtre, chaque statistique, chaque tri.

**La boutique n'est pas une liste fermée**, contrairement aux plateformes. Elle
est dérivée de la bibliothèque, comme les genres. La décision vient d'une phrase :
« j'ai Steam, Epic, GOG, et d'autres je pense, faut que je check ». Une liste
écrite dans le code aurait demandé une modification à chaque découverte ; là,
taper le nom une fois suffit, et Ubisoft Connect ou itch.io entreront sans que
personne touche au code.

L'onglet « Jeux » se scinde en « Console » et « PC », ce qui en fait cinq avec
Prêts, Stats et l'engrenage. « Prêts » disparaît côté PC : un jeu Steam ne se
prête pas, et un onglet qui ne mène qu'à un écran vide est pire qu'un onglet
absent. Le prix est que la barre change sous le doigt en basculant d'univers —
c'est un choix, pris en connaissance de cause.

Deux défauts trouvés en vérifiant, et tous deux de la même famille que celui des
Zelda de la semaine dernière.

Le premier : l'univers se déduisait de l'onglet actif, or « Stats » et
« Réglages » n'en désignent aucun. Les statistiques annonçaient donc « ta
bibliothèque console — 155 jeux » alors qu'on venait de l'onglet PC. L'univers
se retient maintenant à part et ne change qu'en touchant « Console » ou « PC ».

Le second, plus grave : les filtres ne tombaient qu'en passant directement d'un
univers à l'autre. En passant par Stats, le filtre « boutique : Steam » repassait
intact côté console — cent cinquante-cinq jeux, zéro affiché, un badge annonçant
un filtre actif, et rien pour comprendre. Exactement le défaut du jeu ajouté sous
un filtre de série, transposé au changement d'onglet. La remise à zéro compare
désormais l'univers retenu, pas l'onglet courant.

Enfin, la barre d'onglets : « Console » demandait 71 px et n'en recevait que 63,
donc se tronquait. C'est `verif-ui` qui l'a dit, pas l'œil — et il l'a dit parce
qu'on venait d'étendre sa promenade. Rembourrage ramené de 8 à 4 px et écart de
8 à 6 : les cinq onglets tiennent à 360 comme à 412 px, sans troncature.

### Phase 29 — Le même jeu, ailleurs

« Faut aussi, sur n'importe quelle fiche console ou PC, préciser si j'ai le jeu
sur console et PC. » L'information existait déjà et personne ne la lisait : deux
fiches dont les titres sont identiques une fois normalisés, c'est le même jeu.

Rien n'est donc stocké, tout se déduit à la lecture, comme les modes. Un lien
enregistré entre deux fiches devrait être tenu à jour et finirait par mentir :
supprimer la version PC laisserait une console qui prétend l'avoir. Ici, la
mention disparaît d'elle-même. La correspondance est exacte, jamais
approximative : « GTA V » et « Grand Theft Auto V » ne se rejoindront pas —
un manque silencieux, assumé, contre des affirmations fausses sur ce qu'on
possède. La règle des séries de l'audit avait montré ce que vaut le
rapprochement à la louche.

Toucher la mention ouvre l'autre fiche : changement d'univers si besoin, filtres
levés — celui qui nous a amené là masquerait la fiche visée — et ouverture.

**Trois défauts trouvés en vérifiant, tous par la mesure et aucun à l'œil.**

Le lien faisait d'abord 14 px de haut, au fil du texte. Le document exempte de
la règle des 44 px ce qui est pris dans une phrase, mais il s'agit ici d'aller
ouvrir une autre fiche, pas de lire : c'est devenu une pastille de 44 px sous
l'identité. Et la fiche PC proposait « Prêter ce jeu » alors que l'onglet
« Prêts » avait déjà disparu de cet univers — un geste impossible offert par
une moitié de l'application qui ignorait ce que l'autre avait décidé.

Le troisième est le plus intéressant, et concerne le garde-fou lui-même. Deux
fois de suite, `verif-ui` a répondu « Rien à signaler » sur des défauts bien
réels. La première parce que sa promenade ne croisait aucun jeu possédé deux
fois — aucune bibliothèque de départ n'a de doublon — et qu'il fallait donc en
fabriquer un en renommant une fiche. La seconde parce que son contrôle de
troncature reposait sur `scrollWidth`, qui rend `clientWidth` sur un élément à
`text-overflow: ellipsis` : un onglet « Cons… » lui échappait alors qu'il
sautait aux yeux sur une capture. La largeur voulue se mesure désormais par un
Range sur le texte, et le contrôle a été vérifié en le faisant échouer exprès.

Un garde-fou qu'on n'a jamais vu échouer ne prouve rien. Les deux corrections
de cette phase ont été validées de la même façon : casser volontairement, voir
la CI le nommer, puis remettre.

### Phase 30 — Les jeux PC arrivent par Playnite

Le plan initial était une intégration Steam par l'API Web, puis Epic, GOG et
Amazon « selon ce que donnerait la première ». Le dépouillement des mails avait
déjà montré la difficulté : les titres ne figurent que dans le corps HTML des
confirmations, et il n'existe aucun mail Amazon Gaming. Steam demande une clé,
les trois autres n'ont pas d'API publique du tout.

Antoni a envoyé un lien vers **Playnite** — gestionnaire de ludothèque PC,
Windows, C#/WPF, licence MIT — en demandant si ça pouvait servir. Lecture du
dépôt plutôt que de la mémoire : ses importateurs intégrés couvrent Steam,
Epic, GOG, Amazon, EA, Battle.net, Ubisoft, itch.io, Humble, Xbox et PSN
(`BuiltInExtensions.cs`), et il embarque un exporteur PowerShell. Autrement dit,
le travail qu'on s'apprêtait à écrire quatre fois existe déjà, tourne sur le PC,
et rend un fichier.

D'où la décision : **ne rien intégrer, lire un export**. Un script PowerShell
d'une trentaine de lignes (documenté dans le README) sort un JSON portant le
titre, la boutique, l'identifiant boutique, la plateforme, la date, les genres,
les studios, la série, les modes et la description ; l'application le lit.

**Ce que Playnite a validé au passage.** Son modèle sépare `Platform` (la
machine) de `Source` (la boutique) : exactement le découpage adopté la veille.
Et sa fusion de métadonnées ne remplit que les champs vides
(`SkipExistingValues`), la règle de `fusionnerInfobox` — avec un raffinement
qu'on n'a pas repris, la priorité des sources réglable **par champ**. À deux
sources, ça ne vaut pas son coût ; à trois, ce sera la bonne forme. Ce qu'on n'a
pas copié non plus : son système de plugins. Trois types d'extensions, un
manifeste, un annuaire d'addons — tout cela n'a de sens qu'avec des auteurs
tiers, et ce projet a un utilisateur et un dépôt.

**La liste des écartés est la brique qui décide de tout.** Sans elle, l'import
est jetable : chaque passage ramène les jeux qu'on vient de supprimer, et on
cesse d'importer au deuxième essai. Playnite tient la même
(`ImportExclusionItem`, identifiant boutique + source). Ici, supprimer un jeu
venu d'un import retient sa référence ; annuler la suppression la retire. Elle
voyage avec la sauvegarde en ligne — ce ne sont pas des secrets, et une liste
restée sur le PC laisserait le téléphone tout réimporter.

D'où aussi le champ **`refBoutique`** : l'appid Steam plutôt que le titre. Un
titre se corrige à la main, et « Resident Evil 4 » désigne deux jeux différents
selon qu'il vient de Steam ou de GOG. Quand la référence manque — un jeu ajouté
à la main dans Playnite — on retombe sur le titre normalisé, en le disant.

**Un défaut trouvé en vérifiant**, encore par `verif-ui` : la raison d'une ligne
ignorée, « plateforme de console ou émulée · Nintendo Switch », demandait 275 px
pour 211 disponibles et se tronquait en « plateforme de console ou ému… ». Deux
corrections plutôt qu'une : la raison a été raccourcie en « console ou émulé »,
et cette seconde ligne a le droit de passer à la ligne — le titre, lui, reste
sur une seule. Un motif d'exclusion tronqué n'apprend rien à celui qui cherche
pourquoi son jeu n'est pas entré.

Le panneau, enfin, est un `Sheet` comme les autres et non une fenêtre écrite à
part comme l'import Xbox : Échap referme, le focus reste dedans, la liste ne
défile pas derrière. Trois comportements qu'une fenêtre maison perd sans que
personne ne s'en aperçoive avant longtemps.

### Phase 31 — Ce que la bibliothèque sait déjà

Le plan suivant était IGDB : une application Twitch, un jeton, deux cibles de
plus dans le relais, une demi-journée. Antoni l'a abandonné pour une remarque
plus juste : « s'il trouve qu'il y a déjà un jeu sur une autre plateforme, il
faudrait qu'il récupère déjà tout ce qu'il y a en description, les jaquettes,
et cetera sur l'autre plateforme. »

Il avait raison, et les chiffres le disaient avant qu'on écrive une ligne : sur
ses 180 jeux PC importés, 38 ont une jumelle console, et les 38 jumelles sont
complètes — jaquette, description, note, genres, infobox. Trente-huit fiches
remplies sans un seul appel réseau, contre une intégration entière pour aller
chercher dehors ce qui était à trois lignes de distance.

La règle de partage est celle qu'on tenait déjà ailleurs : ne se partage que ce
qui décrit LE JEU — jaquette, description, note, genres, infobox. Ce qui décrit
l'ÉDITION lui reste : la date d'ajout, la plateforme, la boutique, le format,
les prêts, les liens et les notes personnelles. Une fiche Steam ne prend pas la
date d'acquisition de sa jumelle Xbox.

La provenance a demandé une décision. Une donnée reprise vient bien de Wikidata
ou de RAWG, seulement par le chemin de la fiche voisine : elle garde donc sa
source d'origine, et `fusionnerInfobox` accepte maintenant une liste de sources
plutôt qu'une seule. Inventer une source « autre édition » aurait été plus
bavard et moins vrai.

**Le défaut de la phase, et comment il s'est montré.** L'action annonçait 82
fiches à compléter sur la bibliothèque réelle. Une fois complétées, elle en
annonçait 82. Puis 82. La détection de l'apport comparait les références de
l'infobox avant et après fusion — or `fusionnerInfobox` rend toujours un objet
neuf, même quand elle n'a rien rempli. Toutes les fiches ayant une jumelle avec
infobox se déclaraient donc complétées, indéfiniment.

Aucun test unitaire ne l'aurait attrapé : chacun vérifiait un passage, et un
passage donnait le bon résultat. C'est une boucle de quatre passages sur les
vraies données qui l'a nommé, en montrant un compteur qui ne descend jamais.
La comparaison porte désormais sur le contenu (`memeInfobox`), le compte réel
tombe à 6, puis à 0, et un test d'idempotence garde la porte.

Un compteur qui ne descend pas est pire qu'un compteur absent : il fait douter
de l'action au moment précis où elle vient de faire son travail.

### Phase 32 — Quatre décisions, dont une qui en cachait un défaut

Quatre questions posées d'un coup après l'import des cent quatre-vingts jeux PC,
quatre réponses, quatre changements. Trois sont des choix de goût ; la
quatrième a révélé un défaut vieux de deux phases.

**Les jaquettes** manquaient sur cent quarante-deux fiches. Le rattrapage
automatique en fait douze par ouverture — un rythme dimensionné pour une
bibliothèque qui grandit d'un jeu par semaine, pas pour un import. L'action de
masse reprend la mécanique de « Compléter les notes » : progression, arrêt,
bilan. Et SteamGridDB seul, contre RAWG : ses images sont des jaquettes
verticales 600×900, du même format que les fiches console. Une grille où un jeu
sur trois n'a pas la même forme se lit plus mal qu'une grille où il manque une
image. Le contrôle de rapprochement douteux s'applique : une jaquette fausse ne
se remarque pas dans trois cents fiches, alors qu'une case vide, si.

**Les genres.** L'export Playnite ramenait sept rubriques Steam qui n'en sont
pas — Utilitaires, Retouche photo, Production vidéo, Animation & Modélisation,
Conception & Illustration, Accès anticipé, Free-to-play. Elles décrivent un
logiciel, un modèle économique ou un stade de développement. Écartées dans
`normaliserGenres`, donc à la lecture : la migration la rejoue à chaque
chargement, et les fiches déjà importées se sont nettoyées seules, sans action
ni numéro de version.

**Le tri.** « The Legend of Zelda » se rangeait à T, et le PC a ajouté des
dizaines de titres en « The ». L'article initial est mis de côté au classement,
l'affichage ne bouge pas. Le piège était de retirer un préfixe plutôt qu'un
article : « Alone in the Dark » doit rester à A. D'où l'espace obligatoire après
le mot — et un cas à part pour « L'Ombre », dont l'article n'a pas d'espace, que
la première écriture listait sans jamais pouvoir le retirer.

**Le partage**, enfin, devait suivre l'onglet. Il le suivait déjà : la liste
partagée est la liste affichée, elle-même filtrée par univers. Mais ses libellés,
eux, comparaient encore à la bibliothèque entière. Depuis Console, cent
cinquante-cinq jeux sur trois cent trente-cinq passaient donc pour une
« sélection », le panneau annonçait « ceux que les filtres montrent » alors
qu'aucun filtre n'était posé, et le titre envoyé au copain annonçait « Ma
ludothèque » sans dire laquelle. Un défaut introduit par la séparation console /
PC, invisible tant qu'un seul univers existait, et qu'aucune question sur le
partage n'aurait fait apparaître : il a fallu demander « c'est ce que tu veux ? »
pour aller relire le code et voir que la réponse était déjà non.

### Phase 33 — Deux boutiques, un seul jeu

Neuf titres sur cent quatre-vingts occupaient deux cartes voisines côté PC :
Borderlands 2 sur Steam et Epic, Sims 4 sur Steam et EA app, Fortnite sur Epic
et Xbox. Identiques jusqu'à la jaquette, puisque la complétion de la phase
précédente les avait remplies l'une par l'autre.

Trois voies étaient possibles. Fusionner pour de bon — `boutique` devenant une
liste — est le plus juste dans le modèle, et le plus cher : filtres,
statistiques, import, exclusions, partage, et surtout la perte de l'identifiant
par boutique, qui est ce qui rend les réimports exacts. Supprimer à la main
coûte deux minutes et fait perdre l'information que Tomb Raider est aussi sur
GOG, donc sans DRM. Reste la troisième : masquer à l'affichage.

C'est une règle de rendu, pas une transformation de données. Rien n'est
supprimé, rien n'est migré, la fiche cachée garde sa référence de boutique, et
un interrupteur la fait revenir. Le genre de fonctionnalité qu'on peut retirer
sans rien réparer — ce qui est exactement ce qu'on veut d'un choix de confort.

Deux détails ont demandé une décision. La carte gardée est la plus complète, pas
la première : une bibliothèque où l'on masque la seule fiche à jaquette pour
garder une fiche nue serait pire que le doublon. Et la pastille « Aussi sur PC ·
Steam » désigne précisément une carte retirée de la liste : la toucher rend donc
les doublons visibles, sinon le geste ne fait rien du tout — un bouton qui ne
répond pas est un défaut, pas une protection.

Enfin l'en-tête a été raccourci en cours de route. « 180 jeux · 171 affichés ·
9 doublons masqués » disait trois fois la même soustraction ; « affichés » ne
parle plus que du filtrage, et la ligne tient en deux mentions.

---

## 3. Architecture finale

```
├── .github/workflows/deploy.yml   Build Vite + publication GitHub Pages (aucun secret)
├── worker/                        Relais CORS + sauvegarde KV (aucun secret) + sa doc
├── scripts/audit.mjs              Audit des données d'un export (pas un test)
├── public/                        Icônes PWA 192/512 (any + maskable), favicon
├── src/App.jsx                    Ossature : état global, en-tête, onglets
├── src/lib/                       Modules purs, testables sans navigateur
├── src/components/                Fiches, modales, panneaux glissants
├── vite.config.js                 base '/game-library/', PWA, proxys de dev
├── README.md · PROGRESS.md · JOURNAL.md
└── LICENSE                        MIT
```

**Stockage navigateur** — des entrées volontairement séparées :

| Clé | Contenu | Dans l'export JSON ? | Dans la sauvegarde en ligne ? |
|---|---|---|---|
| `gl_v2` | Les jeux | ✅ oui | ✅ oui |
| `gl_keys` | Les clés API + URL du relais | ❌ **jamais** | Sur demande explicite, sauf l'URL du relais |
| `gl_sync` | Le code de synchronisation | ❌ **jamais** | ❌ **jamais** — il est la clé de cette sauvegarde |
| `gl_theme` | Le mode d'apparence | ❌ non | ✅ oui |

Cette séparation est délibérée : un export doit pouvoir être partagé ou sauvegardé sans
fuiter de clé. La sauvegarde en ligne peut, elle, emporter les clés — mais seulement si
l'on coche une case décochée par défaut, parce que cocher change la nature du code de
synchronisation : il protège une liste de jeux, il protégerait des identifiants.
L'URL du relais ne voyage jamais : elle est nécessaire pour joindre la sauvegarde, donc
la restaurer depuis la sauvegarde serait circulaire.

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
| **Bibliothèque** | 94 jeux de départ · 4 plateformes · un seul état suivi : chez moi ou dehors |
| **Code** | ~5 900 lignes réparties entre `lib/` et `components/` · lint sans avertissement |
| **Tests** | 83 sur les modules purs + 29 vérifications du Worker, sans dépendance ni déploiement |
| **PWA** | Manifest, service worker Workbox, icônes 192/512 (any + maskable), bannière de mise à jour |
| **Secrets** | **Aucune clé dans les fichiers ni dans l'historique git** (revérifié sur les trois) |
| **Coût** | 0 € — GitHub Pages, Actions, Cloudflare Workers et toutes les API utilisées sont sur des offres gratuites |

**Sources intégrées** : RAWG, Wikipédia FR, Wikidata, SteamGridDB, xbl.io.

---

## 8. Ce qui reste

**À faire sur chaque appareil :**

1. Coller l'**URL du relais** dans ⚙️ → Services : elle ne voyage jamais, et sans elle
   la synchronisation ne peut pas être jointe.
2. Saisir le **code de synchronisation**, puis « ⬇ Récupérer ». Il ne figure ni dans
   l'export ni dans la sauvegarde qu'il protège. Les clés des services suivent, si la
   case a été cochée sur l'appareil d'origine ; sinon, les ressaisir.
3. Sans relais : **⚙️ → Sauvegarde → Exporter** depuis l'ancien appareil, **Importer**
   sur le nouveau.
4. Sur mobile : « Installer l'application » depuis le menu du navigateur.

**Pistes ouvertes, volontairement non traitées :**

- **Notifications push pour les prêts dépassés** — l'application calcule déjà l'alerte,
  et le pattern VAPID est éprouvé dans un autre projet de l'auteur. Écarté : cela
  suppose un backend qui pousse, donc envoyer la liste des prêts à un serveur pour un
  gain quasi nul.
- **Navigation en bas d'écran** — les quatre onglets et le bouton « + Ajouter » sont en
  haut, dans la zone que la cartographie du pouce désigne comme la plus difficile à
  atteindre à une main. Une barre basse et un bouton flottant y répondraient ; c'est une
  refonte de l'ossature, pas un correctif.
- **Parcours SteamGridDB de bout en bout en ligne** — validé par le bouton « Tester »,
  mais le choix d'une jaquette depuis une fiche n'a pas été rejoué en production.
- **Import Nintendo** — voir section 6. La bibliothèque Switch a finalement été
  reconstituée à la main depuis les reçus d'achat reçus par mail : 22 jeux retrouvés,
  plus quatre déduits d'achats de DLC dont le reçu du jeu manquait.

**Points de vigilance :**

- **Le Worker se déploie par un workflow à part**, `worker.yml`, déclenché quand
  `worker/**` change sur `main`. GitHub Pages ne publie que `dist/` : le site et le
  relais ne partent donc pas ensemble, mais les deux partent tout seuls. Ce point de
  vigilance décrivait encore l'état d'avant — le déploiement à la main — alors que le
  secret `CLOUDFLARE_API_TOKEN` est en place et que le workflow a déployé cinq fois
  sans échec. Une note périmée sur un sujet pareil coûte plus qu'une note absente :
  elle fait croire à un travail restant qui n'existe pas.
- Après un déploiement, le service worker sert l'ancienne version : **la nouvelle
  s'applique au chargement suivant**. Une bannière « ✨ Nouvelle version » le signale
  désormais, déclenchée par `controllerchange` — auparavant il fallait fermer et
  rouvrir l'application sans jamais savoir s'il y avait quelque chose à voir.
- Le classement Xbox One / Series X repose sur `addedDate` : approximatif pour les titres
  antérieurs à la Xbox One (Halo 4, sorti en 2012 sur Xbox 360, est classé Xbox One).
- `localStorage` n'est pas un coffre-fort : les clés y sont lisibles par tout script
  s'exécutant sur la page. Acceptable pour une application personnelle sans contenu tiers.
