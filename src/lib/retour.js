// Ce que le bouton Retour d'Android doit refermer, empilé.
//
// Le geste veut dire « reviens en arrière ». Dans une application à une seule
// page, il n'y a pas d'arrière : ce qu'il y a, ce sont des panneaux ouverts
// par-dessus la liste, et c'est le plus récent qu'il faut refermer — comme le
// fait Échap au clavier.
//
// Une pile plutôt qu'un simple drapeau « un panneau est ouvert » : un panneau
// peut en ouvrir un autre — une fiche, puis le choix d'une jaquette — et Retour
// doit alors les refermer un par un, dans l'ordre inverse de leur ouverture.
//
// Ce module ne connaît ni Android ni Capacitor : c'est une pile, et elle se
// teste comme telle. `natif.js` s'en sert pour répondre au système, et le web
// l'alimente sans jamais la lire — rien ne dépend de l'endroit où l'on tourne.

const pile = [];

// Déclarer qu'on est au premier plan, et rendre de quoi se retirer.
//
// La fonction rendue se comporte comme une désinscription d'écouteur : elle est
// sûre à appeler deux fois, et ne retire que son entrée à elle — pas le sommet
// de la pile, qui peut avoir changé entre-temps.
export function empilerRetour(fermer) {
  const entree = { fermer };
  pile.push(entree);
  return () => {
    const i = pile.indexOf(entree);
    if (i >= 0) pile.splice(i, 1);
  };
}

// Refermer ce qui est au sommet. Rend `false` si la pile est vide — c'est ce
// qui distingue « j'ai fermé quelque chose » de « il n'y avait rien à fermer »,
// et donc ce qui décide si l'application doit se quitter.
//
// L'entrée n'est pas retirée ici : c'est le composant qui se démonte qui
// appelle sa désinscription. Le faire des deux côtés retirerait deux entrées.
export function refermerLeDessus() {
  const entree = pile[pile.length - 1];
  if (!entree) return false;
  entree.fermer();
  return true;
}

// Pour les tests, et pour eux seuls.
export function profondeurRetour() {
  return pile.length;
}
