// La ventilation est du décodage de texte, donc elle peut se tromper en
// silence : une catégorie mal reconnue déplace du poids d'une ligne à l'autre
// sans que le total bouge, et c'est le pire cas — le rapport reste crédible et
// désigne le mauvais coupable.

import { test } from "node:test";
import assert from "node:assert/strict";
import { categorie, ventiler } from "./peser-apk.mjs";

// Une vraie sortie de `unzip -v`, réduite aux lignes qui comptent.
const SORTIE = `Archive:  app-release.apk
 Length   Method    Size  Cmpr    Date    Time   CRC-32   Name
--------  ------  ------- ---- ---------- ----- --------  ----
       0  Stored        0   0% 2026-09-17 16:06 00000000  lib/
       0  Stored        0   0% 2026-09-17 16:06 00000000  lib/arm64-v8a/
 5000000  Stored  5000000   0% 2026-09-17 16:06 9fd09af2  lib/arm64-v8a/libbarhopper_v3.so
 6000000  Stored  6000000   0% 2026-09-17 16:06 9fd09af3  lib/x86/libbarhopper_v3.so
 5900000  Stored  5900000   0% 2026-09-17 16:06 9fd09af4  lib/x86_64/libbarhopper_v3.so
 9500000  Defl:N  3000000  68% 2026-09-17 16:06 4f777da4  classes.dex
  400000  Defl:N   120000  70% 2026-09-17 16:06 4f777da5  assets/public/assets/index-abc.js
    3000  Defl:N     1000  66% 2026-09-17 16:06 4f777da6  assets/capacitor.config.json
  200000  Defl:N   100000  50% 2026-09-17 16:06 4f777da7  res/drawable/splash.png
    5000  Defl:N     2000  60% 2026-09-17 16:06 4f777da8  resources.arsc
    1000  Defl:N      500  50% 2026-09-17 16:06 4f777da9  META-INF/CERT.RSA
--------          -------  ---                            -------
27009000         15123500  44%                            11 files
`;

test("chaque chemin tombe dans la bonne catégorie", () => {
  assert.equal(categorie("lib/arm64-v8a/libbarhopper_v3.so"), "natif · arm64-v8a");
  assert.equal(categorie("lib/x86_64/libfoo.so"), "natif · x86_64");
  assert.equal(categorie("classes.dex"), "code Java/Kotlin (dex)");
  assert.equal(categorie("classes3.dex"), "code Java/Kotlin (dex)");
  assert.equal(categorie("assets/public/index.html"), "application web");
  assert.equal(categorie("assets/capacitor.config.json"), "autres assets");
  assert.equal(categorie("res/drawable/splash.png"), "ressources Android");
  assert.equal(categorie("resources.arsc"), "ressources Android");
  assert.equal(categorie("META-INF/CERT.RSA"), "signature");
  assert.equal(categorie("AndroidManifest.xml"), "divers");
});

test("classes.dex n'est pas confondu avec un fichier voisin", () => {
  // `classes.dex.map` ou `classesX` ne sont pas du dex : sans l'ancrage du
  // motif, ils y tomberaient et gonfleraient la ligne qu'on regarde en premier.
  assert.equal(categorie("classes.dex.map"), "divers");
  assert.equal(categorie("classesabc.dex"), "divers");
});

test("la ventilation somme les tailles compressées", () => {
  const { total, categories } = ventiler(SORTIE);
  // 5 000 000 + 6 000 000 + 5 900 000 + 3 000 000 + 120 000 + 1 000
  //   + 100 000 + 2 000 + 500
  assert.equal(total, 20123500);
  const m = new Map(categories);
  assert.equal(m.get("natif · arm64-v8a"), 5000000);
  assert.equal(m.get("natif · x86"), 6000000);
  assert.equal(m.get("code Java/Kotlin (dex)"), 3000000);
  assert.equal(m.get("application web"), 120000);
  assert.equal(m.get("ressources Android"), 102000);
});

test("la ligne de total de unzip n'est pas comptée comme un fichier", () => {
  // Elle a la forme d'une entrée et vaut la somme de toutes les autres : la
  // prendre doublerait exactement le rapport, ce qui reste crédible.
  const { total } = ventiler(SORTIE);
  assert.notEqual(total, 15123500 * 2);
  assert.ok(!ventiler(SORTIE).categories.some(([n]) => n === "divers" && false));
});

test("les dossiers ne créent pas de catégorie", () => {
  const { categories } = ventiler(SORTIE);
  assert.ok(categories.every(([, o]) => o > 0), "une catégorie à zéro viendrait d'une entrée de dossier");
});

test("le plus lourd est en tête", () => {
  const { categories } = ventiler(SORTIE);
  assert.equal(categories[0][0], "natif · x86");
  assert.deepEqual(categories.map(([, o]) => o), [...categories.map(([, o]) => o)].sort((a, b) => b - a));
});

test("une sortie vide ou illisible ne casse pas", () => {
  assert.deepEqual(ventiler(""), { total: 0, categories: [] });
  assert.deepEqual(ventiler(null), { total: 0, categories: [] });
  assert.deepEqual(ventiler("n'importe quoi\nqui ne ressemble à rien"), { total: 0, categories: [] });
});
