// Aucune couleur écrite en dur dans les composants (règle commune « Design », 21/11/2026).
//
// Pourquoi : à l'audit du 21/11/2026, 63 couleurs étaient écrites en dur dans le JavaScript (texte blanc sur l'accent,
// ombres, couleurs de console, jaquettes par défaut, badges). Le thème clair ne pouvait pas les corriger, et le contraste
// du texte posé dessus échappait à toute mesure. Elles vivent désormais dans index.css, en jetons : ce test empêche d'en
// réécrire une dans le code.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Exceptions écrites, avec leur raison :
//   main.jsx      le bandeau d'erreur s'affiche quand la feuille de style a pu ne pas se charger ;
//   apparence.js  la couleur de la barre d'état du téléphone se pose dans une balise <meta>, qui ne lit pas de jeton.
const EXCEPTIONS = new Set(["main.jsx", "lib/apparence.js"]);

const racine = new URL("../", import.meta.url);
function fichiers(dossier = "") {
  return readdirSync(new URL(dossier, racine), { withFileTypes: true }).flatMap((e) => {
    const chemin = dossier + e.name;
    if (e.isDirectory()) return fichiers(chemin + "/");
    return /\.(jsx|js)$/.test(e.name) && !/\.test\.mjs$/.test(e.name) ? [chemin] : [];
  });
}

// Les commentaires citent volontiers des couleurs (valeurs d'avant, ratios mesurés) : on les retire avant de chercher.
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
// Une couleur hexadécimale ou rgb()/hsl(). Une entité HTML (« "#160": " " ») n'en est pas une.
const COULEUR = /(?<![&\w])#[0-9a-fA-F]{3,8}\b(?!["']\s*:)|\b(?:rgba?|hsla?)\(/g;

test("aucune couleur en dur dans src/, hors exceptions écrites", () => {
  const trouvees = [];
  for (const f of fichiers()) {
    if (EXCEPTIONS.has(f)) continue;
    sansCommentaires(readFileSync(new URL(f, racine), "utf-8")).split("\n").forEach((ligne, i) => {
      for (const m of ligne.matchAll(COULEUR)) trouvees.push(`src/${f}:${i + 1} ${m[0]}`);
    });
  }
  assert.deepEqual(trouvees, [], "couleur à passer en jeton (index.css + theme.js)");
});

test("le détecteur voit bien une couleur, et ignore les entités HTML", () => {
  // Le contrôle du contrôle : sans lui, une expression régulière cassée donnerait du vert partout.
  const vues = (s) => [...sansCommentaires(s).matchAll(COULEUR)].map((m) => m[0]);
  assert.deepEqual(vues('style={{ color: "#fff", boxShadow: "0 0 4px rgba(0,0,0,.4)" }}'), ["#fff", "rgba("]);
  assert.deepEqual(vues('const E = { "#39": "\'", "#160": " " };'), []);
  assert.deepEqual(vues("// autrefois #8090b0, 2,76:1"), []);
});
