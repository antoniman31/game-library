# Enrichissement des fiches

Comment une fiche se remplit depuis RAWG, Wikipédia, Wikidata, SteamGridDB et Steam. Retour au [README](../README.md).

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

**Bouton « 📤 Partager la liste »** (en-tête, sur Console et PC) : produit la liste **affichée** —
donc celle de l'univers où l'on se trouve, console ou PC, et le titre le dit — en
texte lisible — groupée par plateforme, un jeu par ligne avec son format et, le cas
échéant, le prêt en cours avec sa date de retour convenue ; la note Metacritic n'y figure
pas, elle sert à trier sa propre bibliothèque, pas à conseiller quelqu'un d'autre — et l'envoie au menu de partage du téléphone, ou la copie
dans le presse-papier ailleurs. Pas de sélecteur de plateforme : le panneau des filtres a
déjà composé la liste, et deux endroits pour dire la même chose finiraient par se
contredire.

**Bouton « Compléter les notes manquantes »** (⚙️ → Outils) : trois sources dans
l'ordre de leur sûreté, la première qui répond gagne.

1. **RAWG**, qui cherche par titre — et qu'un titre suffit à faire échouer :
   « Hogwarts Legacy : L'Héritage de Poudlard » ne lui disait rien.
2. **Le magasin Steam**, qui répond sur l'**appid** posé par l'import Playnite, donc sans
   aucune approximation. L'appid est cherché sur la fiche **puis sur ses autres éditions** :
   une fiche Xbox n'en a pas, mais le même jeu acheté sur Steam, si.
3. **Wikidata** (P444 « note de critique » qualifiée par P447 = Metacritic), sans clé et
   sans relais, valable aussi côté console — mais peuplée par des contributeurs, donc
   inégale.

**Un seul bouton, deux populations.** Il traite d'abord les fiches jamais
interrogées — donc les jeux ajoutés depuis la dernière fois. Quand il n'en reste
aucune, il propose de revenir sur celles déclarées sans note connue : un jeu de 1994
le restera, un jeu sorti l'an dernier peut avoir été noté depuis. Le bilan annonce
combien de fiches attendent cette seconde passe.

**Tout revérifier, notes existantes comprises.** La même question propose de
reprendre l'ensemble de la bibliothèque. Ce passage **n'écrit rien** : compléter une
note vide ne peut rien abîmer, mais rafraîchir une note existante peut écraser une
note juste — y compris une note corrigée à la main — quand une source se trompe de
jeu. Il rassemble donc ce qui changerait et l'affiche : une ligne par fiche, « 95 →
82 », la source qui répond, les plus grands écarts en tête parce que ce sont les
seuls qui demandent un jugement, et un rapprochement douteux signalé en orange. Les
fiches dont la note est confirmée n'apparaissent pas. On coche, on applique.

**Aucune clé n'est exigée** : Wikidata n'en demande pas, Steam répond par le relais
sur un appid, et RAWG est simplement sauté si sa clé manque.

**Et quand les trois disent non, la fiche cesse de réclamer.** Elle porte « Pas de note
connue » et sort de « À compléter → Note ». Le filtre **Note → « Sans note »**
reste le moyen de toutes les revoir, marquées ou non. Sur une bibliothèque réelle, sept des jeux
sans note sont antérieurs à Metacritic — Fallout est de 1997, Alone in the Dark 2 de
1993 — et deux autres sont des remasters gratuits. Aucune source ne leur inventera un
chiffre ; les redemander à chaque passage transformait une action qui se termine en
corvée qui recommence. Une note saisie à la main efface la mention, un champ vidé rend
la fiche aux sources.

**Bouton « Rattraper les jaquettes manquantes »** (⚙️ → Outils) : cherche sur
SteamGridDB une jaquette pour chaque fiche qui n'en a pas, avec progression et arrêt
possible. L'application en rattrape déjà douze à chaque ouverture, ce qui convenait à une
bibliothèque qui grandit d'un jeu par semaine ; un import Playnite en laisse cent
quarante d'un coup. SteamGridDB et lui seul : ses images sont des jaquettes verticales
600×900, du même format que celles des fiches console — RAWG rendrait des paysages, et
une grille où un jeu sur trois n'a pas la même forme se lit plus mal qu'une grille où il
manque une image. Un titre trop éloigné de ce que la recherche renvoie est laissé sans
image et compté à part : une jaquette fausse ne se remarque pas dans trois cents fiches.

**Bouton « Actualiser les descriptions »** (⚙️ → Outils) : régénère la description de
toute la bibliothèque depuis Wikipédia. Il est **annulable en cours de route**,
respecte un délai anti-rate-limit (~150 ms) et affiche en fin de course la
**liste des jeux sans page Wikipédia trouvée**. Il retient le **meilleur titre**
(exact → préfixe → premier résultat) pour éviter de récupérer la page de la
*série* au lieu de celle du jeu — sans quoi « Assassin's Creed Unity » héritait
de la description générique d'« Assassin's Creed ». Comme il **remplace** toutes
les descriptions, y compris celles corrigées à la main, il demande confirmation
en disant combien il va en écraser.

