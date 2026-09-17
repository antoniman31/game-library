// Ce script propose de réécrire des dates dans une sauvegarde. C'est la chose
// la plus intrusive du dépôt, et ce qui se vérifie ici n'est pas qu'il trouve
// les fiches fausses — c'est qu'il ne touche pas aux autres.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dateDeLIdentifiant, examiner, examinerTout, corriger } from "./dates-suspectes.mjs";

const HORODATAGE = new Date("2026-03-10T14:00:00Z").getTime();

test("un identifiant de la bibliothèque de démonstration n'est pas une date", () => {
  // 1, 2, 3 : les jeux de démarrage. Les prendre pour des horodatages les
  // daterait de janvier 1970 et ferait crier le script sur tout.
  for (const id of [1, 2, 157, 99999, null, undefined, "1770000000000"]) {
    assert.equal(dateDeLIdentifiant(id), null, String(id));
  }
  assert.equal(dateDeLIdentifiant(HORODATAGE), "2026-03-10");
});

test("la signature du défaut est reconnue comme certaine", () => {
  // La date d'ajout vaut exactement une date de sortie inscrite dans la fiche :
  // rien d'autre n'écrit la même valeur aux deux endroits.
  const c = examiner({
    id: HORODATAGE, title: "Halo 5", addedDate: "2015-10-27",
    infobox: { releases: [{ date: "2015-10-27" }] },
  });
  assert.equal(c.niveau, "certain");
  assert.equal(c.vraie, "2026-03-10");
  assert.equal(c.posee, "2015-10-27");
});

test("un an d'écart vers le passé est probable, pas certain", () => {
  const c = examiner({ id: HORODATAGE, title: "Vieux jeu", addedDate: "2019-04-01" });
  assert.equal(c.niveau, "probable");
});

test("un écart court reste seulement possible", () => {
  // Une date d'achat saisie à la main ressemble exactement à ça : la corriger
  // d'office écraserait une valeur voulue.
  const c = examiner({ id: HORODATAGE, title: "Acheté le mois dernier", addedDate: "2026-02-01" });
  assert.equal(c.niveau, "possible");
});

test("une date juste n'est pas signalée", () => {
  assert.equal(examiner({ id: HORODATAGE, title: "Correct", addedDate: "2026-03-10" }), null);
  // Un fuseau horaire déplace une date d'un jour : ce n'est pas un défaut.
  assert.equal(examiner({ id: HORODATAGE, title: "Veille", addedDate: "2026-03-09" }), null);
});

test("une date illisible ou absente relève de l'audit, pas d'ici", () => {
  assert.equal(examiner({ id: HORODATAGE, title: "Vide", addedDate: "" }), null);
  assert.equal(examiner({ id: HORODATAGE, title: "Illisible", addedDate: "avant-hier" }), null);
  assert.equal(examiner({ id: 3, title: "Démo", addedDate: "2014-05-27" }), null);
});

test("le rapport va du plus gros écart au plus petit", () => {
  const constats = examinerTout([
    { id: HORODATAGE, title: "Proche", addedDate: "2026-01-01" },
    { id: HORODATAGE, title: "Lointain", addedDate: "2010-01-01" },
    { id: 1, title: "Démo", addedDate: "2014-05-27" },
  ]);
  assert.deepEqual(constats.map(c => c.titre), ["Lointain", "Proche"]);
});

test("corriger ne touche que les fiches nommées", () => {
  const jeux = [
    { id: HORODATAGE, title: "À corriger", addedDate: "2015-10-27", metacritic: 84 },
    { id: 7, title: "Intacte", addedDate: "2014-05-27" },
  ];
  const sortie = corriger(jeux, [{ id: HORODATAGE, vraie: "2026-03-10" }]);
  assert.equal(sortie[0].addedDate, "2026-03-10");
  assert.equal(sortie[0].metacritic, 84, "le reste de la fiche est intact");
  assert.equal(sortie[0].title, "À corriger");
  assert.deepEqual(sortie[1], jeux[1], "une fiche non nommée ressort identique");
});

test("corriger ne modifie pas la liste d'origine", () => {
  // La sauvegarde de l'utilisateur passe par cette fonction : la muter
  // reviendrait à écrire dans son fichier sans le lui dire.
  const jeux = [{ id: HORODATAGE, title: "X", addedDate: "2015-10-27" }];
  corriger(jeux, [{ id: HORODATAGE, vraie: "2026-03-10" }]);
  assert.equal(jeux[0].addedDate, "2015-10-27");
});

test("corriger sans rien à corriger rend la même chose", () => {
  const jeux = [{ id: HORODATAGE, title: "X", addedDate: "2026-03-10" }];
  assert.deepEqual(corriger(jeux, []), jeux);
  assert.deepEqual(corriger([], []), []);
});

test("une fiche corrigée ne diffère que par sa date", () => {
  // Le premier jet faisait passer la sauvegarde par `migrateGames` : le
  // fichier ressorti différait de l'entrée par backCompat, infobox, boutique.
  // Correct, et malhonnête — un script qui promet de ne toucher qu'aux dates
  // ne réécrit pas la moitié des champs.
  const avant = {
    id: HORODATAGE, title: "Halo 5", addedDate: "2015-10-27", platform: "Xbox One",
    format: "physique", genre: ["Action"], lentA: null, cover: null, metacritic: 84,
  };
  const [apres] = corriger([avant], [{ id: HORODATAGE, vraie: "2026-03-10" }]);
  assert.deepEqual(Object.keys(apres).sort(), Object.keys(avant).sort());
  for (const cle of Object.keys(avant)) {
    if (cle === "addedDate") continue;
    assert.deepEqual(apres[cle], avant[cle], cle);
  }
});
