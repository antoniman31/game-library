// La pile du bouton Retour. Elle ne touche ni Android ni le DOM : c'est
// exactement pour cela qu'elle vit à part et qu'elle se teste ici.

import test from "node:test";
import assert from "node:assert/strict";
import { empilerRetour, refermerLeDessus, profondeurRetour } from "./retour.js";

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
