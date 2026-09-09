// Les tris de la liste, et ce que chacun veut dire.
//
// Dans un fichier à part parce que le panneau de tri les affiche et que
// l'en-tête de liste en montre le libellé courant : deux composants, une seule
// définition. Les garder dans le composant obligeait à l'importer pour une
// simple chaîne de caractères, ce que le lint signale à juste titre.
//
// Chaque tri s'explique en une ligne : « Date » ne dit pas de quelle date il
// parle, et l'application en connaît deux — celle où le jeu est entré dans la
// bibliothèque, et celle où il est sorti dans le monde.
export const TRIS = [
  ["titre", "A → Z", "Par titre, ordre alphabétique."],
  ["date", "Ajout", "Les derniers arrivés dans la bibliothèque d'abord."],
  ["sortie", "Sortie", "Par date de sortie du jeu, la plus récente d'abord."],
  ["metacritic", "Note", "Les mieux notés d'abord ; les jeux sans note ferment la marche."],
  ["aleatoire", "Au hasard", "Pour quand la question est « je joue à quoi ce soir »."],
];

export const libelleTri = (cle) => TRIS.find(([k]) => k === cle)?.[1] || TRIS[0][1];
