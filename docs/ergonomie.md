# Ergonomie et système visuel

Retour au [README](../README.md).

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
| `--large-lisible` | 720 px | Largeur maximale du contenu ; le fond des barres collantes reste pleine largeur |
| `--bdr` / `--bdr-champ` | — | Filet décoratif / contour d'un contrôle, à 3:1 (WCAG 1.4.11) |
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
- **`--bdr` sépare, `--bdr-champ` délimite.** Un filet entre deux lignes n'a
  rien à prouver ; la bordure d'un champ de saisie ou d'un bouton fantôme est
  la seule chose qui dise où le contrôle commence, et WCAG 1.4.11 la chiffre à
  3:1. `--bdr` n'en donnait que 1,3 sur son fond. Relever `--bdr` lui-même
  aurait quadrillé chaque carte de traits durs pour rien : une carte se
  distingue déjà par son fond.
- **Le contenu s'arrête à 720 px, les barres collantes non.** Sans plafond, un
  écran de bureau étirait chaque onglet à 350 px et faisait courir une
  description sur cent soixante caractères par ligne, deux fois la longueur que
  l'œil suit. C'est le contenu des barres qui se centre, pas leur fond : un
  en-tête centré laisserait voir la liste défiler dans les bandes nues.
- **Un formulaire tient sur une colonne.** Deux colonnes sur mobile font sauter
  des champs au regard, qui descend la première sans voir la seconde.
- **Ce qui se clique est un bouton.** Une suggestion de recherche ou une
  vignette de jaquette posée sur un `<div onClick>` ne répond pas à Entrée, ne
  reçoit pas le focus — donc échappe au piège à focus du panneau, que Tab
  traverse sans la voir — et s'annonce comme du texte.
- **Chaque valeur masquée porte son propre œil.** Un seul « Afficher » pour
  quatre champs oblige à défiler jusqu'en bas pour relire une clé, et
  n'atteignait pas du tout le code de synchronisation, qui vit dans l'autre
  onglet.
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
si deux cibles voisines sont séparées de moins de 8 px, si un texte descend
sous 12 px, si un bandeau flottant oublie la zone sûre du bas, si un libellé se
tronque ou si la page déborde.

Un audit complet, mené en mesurant dans le navigateur sur quatorze écrans et
deux thèmes, a montré la limite de ce garde-fou : il ne visitait ni la fenêtre
d'ajout, ni l'édition à la main, ni une fiche assez longue pour afficher « Lire
la suite ». Trois défauts y ont vécu des mois derrière un « Rien à signaler » —
non pas parce qu'il n'y avait rien, mais parce qu'il ne regardait pas là. Ils
sont corrigés et ces écrans sont maintenant dans la promenade. Le même audit a
trouvé un jeton de couleur qui passait sur les cartes (4,91:1) et échouait sur
l'en-tête (4,31:1) : un jeton mesuré sur un seul de ses fonds n'est mesuré nulle
part.

Un second audit, mené contre le même cahier des charges, a montré que la
première correction n'avait pas suffi — et pour la même raison. Le garde-fou ne
visitait toujours ni les accordéons d'une fiche (trois champs de liens et un
mémo, à 27 px), ni les trois panneaux de source (un champ de recherche à 32 px
chacun), ni les bandeaux flottants, qui n'apparaissent qu'après une action et
portaient donc depuis toujours des boutons de 26 px. La fenêtre d'import Xbox,
elle, n'y était jamais entrée du tout : elle demande une clé xbl.io pour
s'ouvrir. C'était la seule à réimplémenter le panneau glissant au lieu
d'utiliser `Sheet`, et elle avait gardé tous les défauts que les autres écrans
avaient corrigés depuis — pas de piège à focus, pas d'Échap, des boutons de
39 px. Une fenêtre écrite à part ne reçoit aucune des corrections faites
ailleurs.

Le garde-fou a donc gagné deux règles de plus — la séparation de 8 px et la
zone sûre du bas — et l'une comme l'autre a trouvé quelque chose le jour même :
six paires de boutons à 6 px, dont la barre d'onglets entière, et les trois
bandeaux posés à vingt pixels du bord, c'est-à-dire dans la bande où le
balayage du système passe avant l'application. La zone sûre ne se mesure pas en
pixels sur une machine sans encoche, où `env(safe-area-inset-bottom)` vaut
zéro : c'est la déclaration qui se lit, pas son résultat.

Deux écarts restent assumés, et sont écrits ici plutôt que tus : les commandes
secondaires font 44 px et non 48 ; et l'échelle typographique
s'arrête à 24 px et n'a ni Display ni H1 au sens des référentiels : c'est une
liste dense, pas un article, et un titre de 32 px y prendrait la place de deux
jeux sans rien apprendre. Les listes contiguës — accordéon des filtres, cases à
cocher, segments — n'ont toujours pas 8 px entre elles, et c'est volontaire :
la règle vise deux boutons distincts qu'on risque de confondre, pas le motif
d'une liste, où le contact est justement ce qui dit qu'on lit la même chose.
