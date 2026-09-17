// La pile du bouton Retour. Elle ne touche ni Android ni le DOM : c'est
// exactement pour cela qu'elle vit à part et qu'elle se teste ici.

import test from "node:test";
import assert from "node:assert/strict";
import { empilerRetour, refermerLeDessus, profondeurRetour, estAuSommet } from "./retour.js";

test("une pile vide ne ferme rien, et le dit", () => {
  // C'est ce `false` qui décide que l'application se quitte : sans lui, le
  // bouton Retour ne ferait rien du tout, ce qu'il faisait justement avant.
  assert.equal(refermerLeDessus(), false);
  assert.equal(profondeurRetour(), 0);
});

test("on referme le dernier ouvert, pas le premier", () => {
  const vus = [];
  const d1 = empilerRetour(() => vus.push("liste"));
  const d2 = empilerRetour(() => vus.push("fiche"));
  assert.equal(refermerLeDessus(), true);
  assert.deepEqual(vus, ["fiche"]);
  // Le composant fermé se démonte et se retire : c'est lui qui dépile.
  d2();
  assert.equal(refermerLeDessus(), true);
  assert.deepEqual(vus, ["fiche", "liste"]);
  d1();
  assert.equal(profondeurRetour(), 0);
});

test("se retirer deux fois, ou dans le désordre, ne retire pas le voisin", () => {
  const d1 = empilerRetour(() => {});
  const d2 = empilerRetour(() => {});
  d1();            // celui du dessous part le premier
  d1();            // et le redire ne doit rien coûter à personne
  assert.equal(profondeurRetour(), 1);
  let ferme = false;
  const d3 = empilerRetour(() => { ferme = true; });
  assert.equal(refermerLeDessus(), true);
  assert.equal(ferme, true, "c'est bien le dernier empilé qui se ferme");
  d3(); d2();
  assert.equal(profondeurRetour(), 0);
});

test("seul le panneau du dessus se reconnaît comme tel", () => {
  // Échap ne peut pas se contenter de fermer : chaque panneau pose son propre
  // écouteur sur le document, et ils s'exécutent tous. Un panneau ouvert
  // par-dessus une fiche fermait les deux d'un seul appui.
  const dessous = () => {};
  const dessus = () => {};
  const d1 = empilerRetour(dessous);
  assert.equal(estAuSommet(dessous), true);
  const d2 = empilerRetour(dessus);
  assert.equal(estAuSommet(dessus), true);
  assert.equal(estAuSommet(dessous), false, "celui du dessous doit se taire");
  d2();
  assert.equal(estAuSommet(dessous), true, "il redevient le dessus quand l'autre part");
  d1();
  // Pile vide : personne n'est au sommet, et surtout pas une fonction inconnue.
  assert.equal(estAuSommet(dessous), false);
  assert.equal(estAuSommet(() => {}), false);
  assert.equal(profondeurRetour(), 0);
});
