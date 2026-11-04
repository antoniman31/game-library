# Modèle de données

Retour au [README](../README.md).

Un jeu est un objet simple, persisté dans `localStorage` sous la clé `gl_v2` :

```js
{
  id, title, platform, format,       // "physique" | "démat"
  addedDate,                         // sert aussi de date de sortie (proxy)
  genre: [], style,                  // style = description
  cover, metacritic,
  lentA, lentDate, lentRetourPrevu,  // prêt en cours, date de retour convenue
  pretsPasses: [{ a, du, au, prevu }],   // historique, borné à 20 par jeu
                                     // `myLinks`, `tips` et `tag` ont vécu ici.
                                     // 864 champs de lien vides, 0 note, un
                                     // seul tag posé par un import : retirés.
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
