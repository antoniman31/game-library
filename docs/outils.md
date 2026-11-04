# Outils de vérification

Retour au [README](../README.md).

## Vérifier l'interface rendue

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

## Auditer ses données

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

## Retrouver une date d'ajout écrasée

```bash
node scripts/dates-suspectes.mjs ma-sauvegarde.json                     # rapport
node scripts/dates-suspectes.mjs ma-sauvegarde.json --corriger sortie.json
```

Choisir une suggestion RAWG écrivait la **date de sortie** du jeu dans
« Ajouté le ». Corrigé, mais les fiches créées avant le correctif portent
encore une date fausse — et `addedDate` trie « récemment ajoutés » et départage
Xbox One de Series X.

La date n'est pas perdue : **l'identifiant d'un jeu est l'instant de sa
création** (`id: Date.now()`, à l'ajout comme aux imports). La vérité était dans
la fiche depuis le début, personne ne l'avait lue.

Trois niveaux de certitude, parce qu'un écart peut être légitime — qui saisit à
la main la date d'achat d'un jeu acheté l'an dernier crée exactement le même
écart qu'un défaut. **Certain** : la date d'ajout est une date de sortie
inscrite dans la fiche, ce qui est la signature du défaut et pas une
coïncidence. **Probable** : elle précède de plus d'un an la création de la
fiche. **Possible** : écart plus court, à juger à la main.

`--corriger` n'écrit jamais sur le fichier d'entrée, refuse une sortie qui lui
est identique, ne remet que les niveaux « certain » et « probable », et rend
une copie qui ne diffère de l'entrée que par ces dates — pas par les champs que
la migration aurait complétés au passage.

## Ce que l'audit signale

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
