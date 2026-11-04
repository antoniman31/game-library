# Fonctionnalités

Détail du comportement de l'application. Pour la vue d'ensemble, voir le [README](../README.md) ; pour l'historique des décisions, [`JOURNAL.md`](../JOURNAL.md).

## Deux univers — onglets « Console » et « PC »

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

**Et tant qu'aucun prêt n'a jamais eu lieu, l'onglet n'est pas là non plus.**
Mesuré sur la bibliothèque réelle : zéro prêt en cours, zéro dans l'historique,
sur 288 jeux dont 89 physiques — un onglet sur quatre pour une fonctionnalité
qui n'a jamais servi. Prêter reste à portée, le bouton est sur la fiche du jeu,
et le premier prêt fait apparaître l'onglet, le groupe « Prêt » du panneau de
filtres et la vue « Circulation » des statistiques. L'onglet qu'on regarde ne
s'évapore pas sous le doigt : il reste tant qu'il est sélectionné.

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

## La bibliothèque

- **94 jeux** pré-remplis en données de départ ; ajout, édition et suppression libres.
- **Recherche** sur titre + genre, **insensible à la casse et aux accents**
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
- **La navigation est en bas.** Les quatre onglets vivaient en haut, dans la zone que
  la cartographie du pouce désigne comme la plus difficile à atteindre à une main,
  alors que ce sont les commandes les plus touchées. L'engrenage, lui, ne descend pas :
  il reste dans l'en-tête avec sa pastille de sauvegarde, plutôt que d'être la cinquième
  entrée étriquée d'une barre à quatre. « + Ajouter » devient un bouton rond flottant —
  il recouvre un coin de la liste, c'est le prix connu de ce motif, et il **s'efface
  tant qu'un bandeau occupe la même bande** : sans cela il se posait exactement sur le
  « Annuler » d'une suppression. La hauteur de la barre est un jeton, `--barre-basse`,
  parce que trois autres endroits doivent s'en écarter.
- **Toucher un jeu ouvre sa fiche dans un panneau, depuis n'importe quelle vue.**
  La grille et la vue compacte ne savaient pas afficher un détail : elles basculaient
  la liste entière pour aller le chercher, et on perdait la vue qu'on avait choisie
  avec sa position. Le détail vit désormais dans un composant à part
  ([`FicheDetail`](../src/components/FicheDetail.jsx)) de la ligne qui le résume
  ([`LigneJeu`](../src/components/LigneJeu.jsx)) : un seul détail est monté à la fois, et
  le même geste donne le même résultat partout. Le titre n'apparaît plus qu'une fois,
  dans l'en-tête du panneau, qui reste visible pendant qu'on défile.
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

## Prêts

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

## Fiche de jeu

Toujours visibles : l'identité du jeu, l'infobox Wikidata et le bloc **Prêt**,
seule action qu'on répète. La description est repliée avec un « Lire la suite ».
Les liens personnels, les conseils et la note libre ont été retirés du modèle :
864 champs de lien vides et aucune note sur la bibliothèque réelle.

Le format et la rétrocompatibilité ont quitté la fiche pour le panneau
d'édition : on les règle une fois dans la vie d'un jeu, alors qu'ils occupaient
une place permanente. Les pastilles « démat » et « 🔄 Compatible Series X » en
haut de la carte continuent de les annoncer.

Les quatre sources — correction manuelle, RAWG, titre français, jaquette —
s'ouvrent en **panneau au premier plan** plutôt qu'à l'intérieur de la fiche,
qui devenait interminable.
## Le même jeu chez deux boutiques

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

## Remplir une fiche depuis ses autres éditions

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
  par ⚙️ → Outils → **« Remplir depuis les autres éditions »** pour les fiches déjà en
  place, qui annonce le détail par champ avant d'écrire.
- Sur une bibliothèque réelle de 155 jeux console et 180 jeux PC importés :
  **38 fiches remplies à l'import** — jaquette, description, note, genres — puis
  6 complétées par l'action, et plus rien ensuite.

## Plateformes et rétrocompatibilité

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

## Statistiques

Deux sous-onglets côté console, parce que les deux familles ne répondent pas à
la même question. Chaque bloc disparaît quand il n'a rien à dire : un « aucune
donnée » répété six fois occupe autant de place qu'un vrai contenu.

Côté PC, il n'y en a qu'un — et donc aucun sélecteur, puisqu'un choix unique
n'est pas un choix. « Circulation » ne compte que des prêts, et un jeu Steam ne
se prête pas : c'est la même règle que l'onglet « Prêts » de la barre
principale, absent du même univers pour la même raison.

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

Les répartitions se lisent en graphiques : anneaux pour plateforme, boutique, format et tranches de notes, jauges pour la complétude, courbes pour le rythme d'ajouts et de prêts, comparaison d'une année sur l'autre, ponctualité par personne, et le genre dominant de chaque plateforme ou boutique. Les graphiques sont décoratifs (`aria-hidden`) : chaque valeur reste écrite à côté.

Côté PC, trois de ces blocs changent de sujet. La plateforme y est constante
par construction — une seule barre à 100 % — et le format aussi, puisqu'un jeu
PC est forcé en démat à l'import : les tuiles « Physiques / Démat » y affichaient
0 et le total. C'est la **boutique** qui distingue une bibliothèque PC, et c'est
elle qui prend la place : répartition par boutique, moyenne par boutique, et les
tuiles deviennent Total / Boutiques / Notés. Une fiche sans boutique est comptée
sous « Sans boutique » plutôt qu'écartée — sans quoi la somme des barres serait
inférieure au total affiché juste au-dessus.

S'y ajoutent deux listes qui ne sont pas des statistiques mais qui valent le
reste : les **doublons possibles** — deux fiches sur deux plateformes, c'est
normal ; deux fois la même plateforme, en rouge, est une saisie en double — et
les **épisodes manquants**, déduits des champs « épisode précédent / suivant »
de Wikidata : tu as Halo 5, tu n'as pas Halo 4, l'application te le dit.

Un bouton **Recalculer**, en bas, relit l'heure. Les chiffres suivent la
bibliothèque en direct ; seuls les jours écoulés et la fenêtre des douze mois se
figent quand l'application reste ouverte plusieurs jours.

## Sauvegarde

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
