// Aucun emoji comme icône d'interface, et chaque icône appelée existe (règle commune « Design », 25/11/2026).
//
// Pourquoi : à l'audit du 25/11/2026, une quarantaine d'emojis différents servaient d'icônes (📤 ⚠️ ✕ ⏳ 🎮…). Leur dessin
// dépend de la police du téléphone, ils ne suivent ni la couleur ni le thème. Les icônes viennent maintenant de
// src/lib/icones.js (Material Symbols arrondis) par le composant Icone ; ce test refuse d'en réécrire un.
//
// Ce qui reste permis : les flèches (→ ↑ ↓ ↗ ⇅ ↻, ▲ ▼ ▸ ▾), qui sont du texte ; le 😊 du SMS de rappel d'un prêt, qui part
// dans un message, pas à l'écran ; les commentaires.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { TRACES } from "./icones.js";

const racine = new URL("../", import.meta.url);
function fichiers(dossier = "") {
  return readdirSync(new URL(dossier, racine), { withFileTypes: true }).flatMap((e) => {
    const chemin = dossier + e.name;
    if (e.isDirectory()) return fichiers(chemin + "/");
    return /\.(jsx|js)$/.test(e.name) && !/\.test\.mjs$/.test(e.name) ? [chemin] : [];
  });
}
const sansCommentaires = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
// Un pictogramme, flèches exclues (U+2190 à U+21FF) ; les coches et croix (✓ ✕) et les ☰ ≡ ⊞ sont des icônes.
const PICTO = /(?![←-⇿])[\p{Extended_Pictographic}✓-✖☰≡⊞]/gu;

function emojisIcones(source, nom = "x") {
  const trouves = [];
  sansCommentaires(source).split("\n").forEach((ligne, i) => {
    if (ligne.includes("sms:?body=")) return;
    for (const m of ligne.matchAll(PICTO)) trouves.push(`src/${nom}:${i + 1} ${m[0]}`);
  });
  return trouves;
}

test("aucun emoji comme icône dans src/", () => {
  const trouves = fichiers().flatMap((f) => emojisIcones(readFileSync(new URL(f, racine), "utf-8"), f));
  assert.deepEqual(trouves, [], "emoji à remplacer par <Icone nom=… />");
});

test("chaque icône appelée existe dans icones.js", () => {
  const appelees = new Set();
  for (const f of fichiers()) {
    const s = readFileSync(new URL(f, racine), "utf-8");
    for (const m of s.matchAll(/<Icone nom="([\w]+)"/g)) appelees.add(m[1]);
    // nom={cond ? "a" : "b"} : seuls les noms placés après « ? » et « : » sont des icônes (« === "ok" » n'en est pas une).
    for (const m of s.matchAll(/<Icone nom=\{([^}]*)\}/g)) for (const n of m[1].matchAll(/[?:]\s*"([\w]+)"/g)) appelees.add(n[1]);
    for (const m of s.matchAll(/ETAT_CLE = \{([^}]*)\}/g)) for (const n of m[1].matchAll(/: "([\w]+)"/g)) appelees.add(n[1]);
    for (const m of s.matchAll(/\bicone="([\w]+)"/g)) appelees.add(m[1]);
    for (const m of s.matchAll(/\bsigne: "([\w]+)"/g)) appelees.add(m[1]);
  }
  const apparence = readFileSync(new URL("lib/apparence.js", racine), "utf-8");
  for (const m of apparence.matchAll(/ICONES = \{([^}]*)\}/g)) for (const n of m[1].matchAll(/: "([\w]+)"/g)) appelees.add(n[1]);
  assert.ok(appelees.size >= 30, `icônes appelées trouvées : ${appelees.size}`);
  assert.deepEqual([...appelees].filter((n) => !TRACES[n]), []);
});

test("le détecteur voit un emoji et une croix, et laisse flèches, SMS et commentaires", () => {
  // Le contrôle du contrôle : une expression cassée donnerait du vert partout.
  assert.equal(emojisIcones('<b>📤</b>\n<button>✕</button>').length, 2);
  assert.deepEqual(emojisIcones('<a>obtenir ↗</a>\n{a ? "▲" : "▼"} → ↻\n// ⚠️ commentaire\nhref={`sms:?body=Salut 😊`}'), []);
});
