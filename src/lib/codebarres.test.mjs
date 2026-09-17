import { test } from "node:test";
import assert from "node:assert/strict";
import { eanValide, titreDepuisProduit } from "./codebarres.js";

test("un EAN-13 valide l'est, un chiffre de travers ne l'est pas", () => {
  // The Witcher 3 GOTY PS4, code réel.
  assert.equal(eanValide("3391891990004"), true);
  assert.equal(eanValide("3391891990005"), false);
  assert.equal(eanValide("3391891990014"), false);
});

test("ce qui n'est pas un EAN-13 est refusé sans discuter", () => {
  for (const mauvais of ["", null, undefined, "12345", "339189199000", "33918919900041", "339189199000X"]) {
    assert.equal(eanValide(mauvais), false, String(mauvais));
  }
});

test("un EAN dont la clé vaut zéro passe", () => {
  // Le calcul (10 - somme % 10) % 10 rend 10 au lieu de 0 sans le modulo
  // final : ce cas est celui qui l'attrape.
  assert.equal(eanValide("5012345678900"), true);
  assert.equal(eanValide("5012345678901"), false);
});

test("le libellé d'un produit devient un titre cherchable", () => {
  const r = titreDepuisProduit("PS4 Witcher 3: Wild Hunt - Game Of The Year");
  assert.equal(r.titre, "Witcher 3: Wild Hunt - Game Of The Year");
  assert.equal(r.plateforme, null, "aucune PlayStation dans cette bibliothèque");
});

test("la plateforme de la boîte est reconnue quand elle existe ici", () => {
  assert.equal(titreDepuisProduit("Nintendo Switch - The Legend of Zelda").plateforme, "Switch 1");
  assert.equal(titreDepuisProduit("Mario Kart World (Switch 2)").plateforme, "Switch 2");
  assert.equal(titreDepuisProduit("Forza Horizon 5 Xbox Series X|S").plateforme, "Xbox Series X");
  assert.equal(titreDepuisProduit("Halo Infinite - Xbox One").plateforme, "Xbox One");
});

test("le plus précis gagne sur le plus court", () => {
  // « Xbox Series X » contient « Xbox » ; « Switch 2 » contient « Switch ».
  assert.equal(titreDepuisProduit("Xbox Series X Starfield").plateforme, "Xbox Series X");
  assert.equal(titreDepuisProduit("Jeu Switch 2 — Donkey Kong").plateforme, "Switch 2");
});

test("l'emballage part, le jeu reste", () => {
  assert.equal(titreDepuisProduit("Jeu Nintendo Switch - Zelda Tears of the Kingdom (Version Française)").titre,
    "Zelda Tears of the Kingdom");
  assert.equal(titreDepuisProduit("Hogwarts Legacy [PS5] PAL FR neuf").titre, "Hogwarts Legacy");
});

test("ce qui distingue deux jeux ne part pas", () => {
  // Ce sont des fiches distinctes, pas des variantes d'emballage : les
  // retirer ferait chercher le mauvais jeu.
  for (const garde of ["Remastered", "Definitive Edition", "Deluxe", "Director's Cut"]) {
    assert.match(titreDepuisProduit(`Xbox One Dead Space ${garde}`).titre, new RegExp(garde.replace("'", "'")));
  }
});

test("un libellé entièrement fait de bruit rend le libellé d'origine", () => {
  const r = titreDepuisProduit("Jeu Xbox One PAL FR");
  assert.equal(r.titre, "Jeu Xbox One PAL FR");
  assert.equal(r.brut, "Jeu Xbox One PAL FR");
});

test("le libellé d'origine est toujours rendu tel quel", () => {
  const libelle = "  Nintendo Switch - Mario Odyssey  ";
  assert.equal(titreDepuisProduit(libelle).brut, "Nintendo Switch - Mario Odyssey");
});

test("un libellé vide ne casse rien", () => {
  assert.deepEqual(titreDepuisProduit(""), { titre: "", plateforme: null, brut: "" });
  assert.deepEqual(titreDepuisProduit(null), { titre: "", plateforme: null, brut: "" });
});
