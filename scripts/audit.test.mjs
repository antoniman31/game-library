// Tests de l'audit des données.
//
//     npm test
//
// Trois cents lignes de règles de décision n'en avaient aucun. C'est le fichier
// qui dit à l'utilisateur ce qui ne va pas dans sa bibliothèque : une règle qui
// se trompe ne casse rien, elle ment — et c'est pire, parce que rien ne le
// signale. La règle « série éloignée du titre » se trompait vingt fois sur
// vingt sur une bibliothèque réelle avant d'être reprise ; ces vérifications
// existent pour que ça se voie la prochaine fois.
//
// L'audit est lancé pour de vrai, en sous-processus, avec sa sortie `--json` :
// on teste le programme tel qu'il s'exécute, pas une fonction extraite pour
// l'occasion qui pourrait diverger de lui.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./audit.mjs", import.meta.url));
const dossier = mkdtempSync(join(tmpdir(), "audit-"));
let n = 0;

const jeu = (p = {}) => ({
  id: ++n, title: `Jeu ${n}`, platform: "Xbox Series X", format: "physique",
  addedDate: "2024-01-01", genre: ["Action"], style: "Une description.",
  cover: "https://exemple.fr/j.jpg", metacritic: 80,
  myLinks: ["", "", ""], tips: "", tag: "", lentA: null, lentDate: null, pretsPasses: [],
  ...p,
});

// Retourne { constats, code } — le code de sortie compte autant que le rapport :
// c'est lui que lirait une intégration continue.
function auditer(jeux, options = []) {
  const fichier = join(dossier, `lib-${++n}.json`);
  writeFileSync(fichier, JSON.stringify(jeux));
  try {
    const sortie = execFileSync(process.execPath, [SCRIPT, fichier, "--json", ...options], { encoding: "utf-8" });
    return { ...JSON.parse(sortie), code: 0 };
  } catch (e) {
    // `--strict` sort en 1 tout en écrivant son rapport : ce n'est pas un plantage.
    if (e.stdout) return { ...JSON.parse(e.stdout), code: e.status };
    throw e;
  }
}

const categories = (r, categorie) => r.constats.filter(c => c.categorie === categorie);

test("une bibliothèque saine ne fait remonter aucun constat", () => {
  const r = auditer([jeu(), jeu({ platform: "Switch 1" })]);
  assert.deepEqual(r.constats, [], JSON.stringify(r.constats));
  assert.equal(r.code, 0);
});

test("une série qui partage un mot avec le titre n'est pas signalée", () => {
  // Le cas qui se trompait vingt fois sur vingt : « Sonic Generations » et
  // « Sonic the Hedgehog » ne se préfixent pas l'un l'autre, mais le mot est là.
  const r = auditer([
    jeu({ title: "Sonic Generations", infobox: { series: "Sonic the Hedgehog" } }),
    jeu({ title: "Gears 5", infobox: { series: "Gears of War" } }),
    jeu({ title: "Pokémon Épée", infobox: { series: "série principale de jeux Pokémon" } }),
    jeu({ title: "Crash Team Racing: Nitro-Fueled", infobox: { series: "Crash Bandicoot" } }),
  ]);
  assert.deepEqual(categories(r, "série éloignée du titre"), []);
});

test("une série lointaine mais portée par plusieurs jeux n'est pas signalée", () => {
  // Corroboration : si trois fiches annoncent la même série, elle existe, et
  // aucune source n'a répondu pour un autre jeu.
  const r = auditer([
    jeu({ title: "Hyrule Warriors : L'Ère du fléau", infobox: { series: "The Legend of Zelda" } }),
    jeu({ title: "The Legend of Zelda: Breath of the Wild", infobox: { series: "The Legend of Zelda" } }),
    jeu({ title: "Tears of the Kingdom", infobox: { series: "The Legend of Zelda" } }),
  ]);
  assert.deepEqual(categories(r, "série éloignée du titre"), []);
});

test("une série lointaine et isolée est signalée, pour information", () => {
  const r = auditer([
    jeu({ title: "Halo Infinite", infobox: { series: "Doom" } }),
    jeu({ title: "Forza Horizon 5", infobox: { series: "Forza Horizon" } }),
  ]);
  const trouves = categories(r, "série éloignée du titre");
  assert.equal(trouves.length, 1);
  assert.match(trouves[0].detail, /Halo Infinite/);
  assert.match(trouves[0].detail, /Doom/);
  assert.equal(trouves[0].gravite, "info", "un symptôme, pas un défaut : il peut être légitime");
});

test("les défauts graves sont classés comme tels", () => {
  // Le classement porte le rapport : « 60 jeux sans jaquette » au même rang
  // qu'un identifiant en double oblige à tout relire pour trouver ce qui compte.
  const r = auditer([
    jeu({ id: 7, title: "Premier" }),
    jeu({ id: 7, title: "Même identifiant" }),
    jeu({ title: "Année impossible", addedDate: "0001-01-01" }),
    jeu({ title: "Lien piégé", myLinks: ["javascript:alert(1)", "", ""] }),
  ]);
  const graves = r.constats.filter(c => c.gravite === "grave").map(c => c.categorie);
  assert.ok(graves.includes("id en double"), JSON.stringify(graves));
  assert.ok(graves.includes("année d'ajout invraisemblable"), JSON.stringify(graves));
  assert.ok(graves.includes("lien non ouvrable"), JSON.stringify(graves));
  assert.equal(r.parGravite.grave, graves.length);
});

test("deux fiches du même titre : sur la même plateforme seulement", () => {
  // Le même jeu sur Switch et sur Xbox, ce sont deux exemplaires ; deux fois
  // sur la même plateforme, c'est une saisie en double.
  const surDeux = auditer([
    jeu({ title: "Hades", platform: "Switch 1" }),
    jeu({ title: "Hades", platform: "Xbox Series X" }),
  ]);
  assert.deepEqual(categories(surDeux, "doublon"), []);

  const surUne = auditer([
    jeu({ title: "Hades", platform: "Switch 1" }),
    jeu({ title: "HADES", platform: "Switch 1" }),
  ]);
  assert.equal(categories(surUne, "doublon").length, 1, "la casse ne doit pas masquer un doublon");
});

test("--strict fait échouer le code de sortie, sans changer le rapport", () => {
  const jeux = [jeu({ title: "Sans jaquette", cover: null })];
  assert.equal(auditer(jeux).code, 0, "par défaut on rapporte, on ne fait pas échouer");
  const strict = auditer(jeux, ["--strict"]);
  assert.equal(strict.code, 1);
  assert.ok(strict.constats.length > 0);
});
