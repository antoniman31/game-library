#!/usr/bin/env node
// Audit de la bibliothèque — cherche les incohérences dans les DONNÉES.
//
//     node scripts/audit.mjs ma-sauvegarde.json
//     node scripts/audit.mjs ma-sauvegarde.json --jaquettes   # vérifie les URLs (réseau)
//     node scripts/audit.mjs ma-sauvegarde.json --strict      # code de retour ≠ 0
//     node scripts/audit.mjs ma-sauvegarde.json --json        # pour comparer deux passages
//
// Par npm, `--json` demande `--silent` : sans lui la bannière de npm précède la
// sortie sur le même flux, et le fichier obtenu n'est plus du JSON.
//
//     npm run --silent audit -- ma-sauvegarde.json --json > avant.json
//
// Pourquoi un fichier permanent plutôt qu'un script jeté après usage : chaque
// vérification ci-dessous a été écrite un jour où quelque chose clochait —
// un import en double, une note récupérée pour un autre jeu, une jaquette
// dont l'hébergeur a disparu. À chaque fois le même réflexe, le même code
// réécrit, et rien qui reste pour la fois suivante.
//
// Ce n'est PAS un test. `src/lib/model.test.mjs` vérifie des invariants : s'il
// échoue, le code est faux. Ici on signale des symptômes, qui peuvent être
// parfaitement légitimes — deux éditions du même jeu sur deux plateformes ne
// sont pas un doublon. D'où le comportement par défaut : on rapporte, on ne
// fait pas échouer. `--strict` inverse ce choix.

import { readFileSync } from "node:fs";
import { migrateGames, normTitle, rapprochementDouteux, dureeEntreeHistorique, PRET_LONG_JOURS,
  estDateISO, PLATFORMES_JEU } from "../src/lib/model.js";

const args = process.argv.slice(2);
const fichier = args.find(a => !a.startsWith("--"));
const strict = args.includes("--strict");
const verifierJaquettes = args.includes("--jaquettes");
const enJson = args.includes("--json");

if (!fichier) {
  console.error("Usage : node scripts/audit.mjs <export.json> [--jaquettes] [--strict] [--json]");
  process.exit(2);
}

let brut;
try {
  brut = JSON.parse(readFileSync(fichier, "utf-8"));
} catch (e) {
  console.error(`Lecture impossible : ${e.message}`);
  process.exit(2);
}
// Vérifié avant la migration : sinon c'est elle qui échoue, sur un message
// technique qui ne dit rien du vrai problème.
if (!Array.isArray(brut)) {
  console.error("Ce fichier n'est pas un export de bibliothèque (un tableau de jeux est attendu).");
  process.exit(2);
}
const jeux = migrateGames(brut);

// Trois niveaux, parce qu'un rapport à plat se lit mal : « 60 jeux sans
// jaquette » y voisinait avec « identifiant en double », qui casse l'édition.
// Le premier est une liste de courses, le second un défaut. Les mettre au même
// rang, c'est obliger à tout relire pour trouver ce qui compte.
//
//   grave   quelque chose est cassé ou le sera
//   moyen   une valeur qui n'aurait pas dû entrer, ou une incohérence
//   info    un manque : légitime, à combler quand on veut
const GRAVITES = ["grave", "moyen", "info"];
const constats = [];
const signaler = (categorie, detail, gravite = "moyen") => constats.push({ gravite, categorie, detail });

// ── Doublons ───────────────────────────────────────────────────────────────
// Deux entrées du même titre SUR LA MÊME PLATEFORME : là c'est franchement
// suspect. Le même jeu sur Switch et sur Xbox, non — c'est deux exemplaires.
const parCle = new Map();
for (const g of jeux) {
  const cle = `${normTitle(g.title)}|${g.platform}`;
  (parCle.get(cle) || parCle.set(cle, []).get(cle)).push(g);
}
for (const [, groupe] of parCle) {
  if (groupe.length > 1) signaler("doublon", `« ${groupe[0].title} » (${groupe[0].platform}) × ${groupe.length}`);
}

// Identifiants réutilisés : l'édition et la suppression reposent entièrement
// dessus, deux jeux au même id se modifient l'un l'autre.
const vus = new Set();
for (const g of jeux) {
  if (vus.has(g.id)) signaler("id en double", `« ${g.title} » porte l'identifiant ${g.id}, déjà pris`, "grave");
  vus.add(g.id);
}

// ── Champs vides ───────────────────────────────────────────────────────────
const sans = (predicat) => jeux.filter(predicat).map(g => g.title);
const resume = (titres, max = 8) =>
  titres.slice(0, max).join(" · ") + (titres.length > max ? ` … (+${titres.length - max})` : "");

for (const [libelle, predicat] of [
  ["sans jaquette", g => !g.cover],
  ["sans genre", g => !g.genre?.length],
  ["sans description", g => !g.style],
  ["sans note", g => !g.metacritic],
]) {
  const titres = sans(predicat);
  if (titres.length) signaler(libelle, `${titres.length} : ${resume(titres)}`, "info");
}

// ── Dates ──────────────────────────────────────────────────────────────────
const aujourdhui = new Date().toISOString().slice(0, 10);
for (const g of jeux) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.addedDate || "")) {
    signaler("date d'ajout illisible", `« ${g.title} » : ${JSON.stringify(g.addedDate)}`, "grave");
  } else if (g.addedDate > aujourdhui) {
    signaler("date d'ajout à venir", `« ${g.title} » : ${g.addedDate}`);
  }
}

// ── Valeurs impossibles ────────────────────────────────────────────────────
// L'import ramène désormais ces valeurs à quelque chose de sûr, mais un fichier
// gardé de côté peut les contenir encore, et c'est justement ce qu'on veut
// savoir avant de l'importer : une plateforme inconnue n'apparaît dans aucun
// filtre, un format inventé n'est compté ni en physique ni en démat — les
// tuiles de l'onglet Collection cessent alors de s'additionner —, et une date
// illisible produit des NaN dans les statistiques.
const PLATEFORMES = new Set([...PLATFORMES_JEU, "Xbox"]);
for (const g of jeux) {
  if (!PLATEFORMES.has(g.platform)) {
    signaler("plateforme inconnue", `« ${g.title} » : ${JSON.stringify(g.platform)}`);
  }
  if (g.format !== "physique" && g.format !== "démat") {
    signaler("format inconnu", `« ${g.title} » : ${JSON.stringify(g.format)}`);
  }
  if (g.metacritic != null && (typeof g.metacritic !== "number" || !Number.isFinite(g.metacritic) || g.metacritic < 0 || g.metacritic > 100)) {
    signaler("note impossible", `« ${g.title} » : ${JSON.stringify(g.metacritic)}`);
  }
  if (g.lentDate && !estDateISO(g.lentDate)) {
    signaler("date de prêt illisible", `« ${g.title} » : ${JSON.stringify(g.lentDate)}`, "grave");
  }
  for (const e of g.pretsPasses || []) {
    if (!estDateISO(e.du) || !estDateISO(e.au)) {
      signaler("date d'historique illisible", `« ${g.title} » : ${e.a}, du ${JSON.stringify(e.du)} au ${JSON.stringify(e.au)}`, "grave");
    }
  }
}

// ── Prêts ──────────────────────────────────────────────────────────────────
for (const g of jeux) {
  // Un nom sans date, ou l'inverse : le prêt ne compte pas et n'alerte jamais.
  if (!!g.lentA !== !!g.lentDate) {
    signaler("prêt incomplet", `« ${g.title} » : lentA=${JSON.stringify(g.lentA)}, lentDate=${JSON.stringify(g.lentDate)}`, "grave");
  }
  if (g.lentA && g.lentDate) {
    const jours = Math.floor((Date.now() - new Date(g.lentDate)) / 86400000);
    if (jours > PRET_LONG_JOURS * 3) {
      signaler("prêt très ancien", `« ${g.title} » chez ${g.lentA} depuis ${jours} jours`, "info");
    }
    if (g.lentRetourPrevu && g.lentRetourPrevu < g.lentDate) {
      signaler("retour avant le prêt", `« ${g.title} » : prêté le ${g.lentDate}, à rendre le ${g.lentRetourPrevu}`);
    }
  }
  for (const e of g.pretsPasses || []) {
    // Les dates illisibles sont déjà signalées plus haut ; les comparer ici
    // ajouterait un second constat pour le même défaut.
    if (!estDateISO(e.du) || !estDateISO(e.au)) continue;
    if (e.au < e.du) signaler("historique incohérent", `« ${g.title} » : ${e.a}, rendu (${e.au}) avant le prêt (${e.du})`);
    if (dureeEntreeHistorique(e) > 365) signaler("prêt historique très long", `« ${g.title} » : ${e.a}, ${dureeEntreeHistorique(e)} jours`, "info");
  }
}

// ── Rapprochements douteux ─────────────────────────────────────────────────
// Un titre local qui ne recouvre pas son entrée Wikidata : le signe qu'une
// source a répondu pour un autre jeu et que tout ce qu'elle a écrit est faux.
for (const g of jeux) {
  const serie = g.infobox?.series;
  if (serie && rapprochementDouteux(g.title, serie) && !normTitle(g.title).includes(normTitle(serie))) {
    signaler("série éloignée du titre", `« ${g.title} » → série « ${serie} »`, "info");
  }
}

// ── Jaquettes injoignables (réseau, donc sur demande) ──────────────────────
if (verifierJaquettes) {
  const avec = jeux.filter(g => /^https?:\/\//.test(g.cover || ""));
  process.stderr.write(`Vérification de ${avec.length} jaquettes…\n`);
  for (const g of avec) {
    try {
      const r = await fetch(g.cover, { method: "HEAD", redirect: "follow" });
      if (!r.ok) signaler("jaquette injoignable", `« ${g.title} » : HTTP ${r.status}`);
    } catch (e) {
      signaler("jaquette injoignable", `« ${g.title} » : ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 60));
  }
}

// ── Rapport ────────────────────────────────────────────────────────────────

// --json : de quoi comparer deux passages. Après un gros import, la question
// n'est pas « combien de constats » mais « lesquels sont apparus » — et ça, un
// rapport en prose ne permet pas de le calculer.
if (enJson) {
  console.log(JSON.stringify({
    fichier,
    jeux: jeux.length,
    constats,
    parGravite: Object.fromEntries(GRAVITES.map(g => [g, constats.filter(c => c.gravite === g).length])),
  }, null, 2));
  process.exit(strict && constats.length ? 1 : 0);
}

console.log(`${jeux.length} jeu${jeux.length > 1 ? "x" : ""} analysé${jeux.length > 1 ? "s" : ""}.\n`);
if (!constats.length) {
  console.log("Rien à signaler.");
  process.exit(0);
}

// Du plus grave au moins grave, et rien d'autre ne change l'ordre : ce qu'on
// vient chercher doit être en haut, pas noyé au milieu des champs à compléter.
const ETIQUETTES = { grave: "🔴 GRAVE", moyen: "🟠 À VÉRIFIER", info: "⚪ POUR INFORMATION" };
for (const gravite of GRAVITES) {
  const duNiveau = constats.filter(c => c.gravite === gravite);
  if (!duNiveau.length) continue;

  console.log(`${ETIQUETTES[gravite]} — ${duNiveau.length} constat(s)`);
  const parCategorie = new Map();
  for (const c of duNiveau) {
    if (!parCategorie.has(c.categorie)) parCategorie.set(c.categorie, []);
    parCategorie.get(c.categorie).push(c.detail);
  }
  for (const [categorie, details] of parCategorie) {
    console.log(`  ${categorie} (${details.length})`);
    for (const d of details) console.log(`    ${d}`);
  }
  console.log("");
}

const graves = constats.filter(c => c.gravite === "grave").length;
console.log(`${constats.length} constat(s)${graves ? `, dont ${graves} grave(s)` : ""}. Un constat n'est pas forcément un défaut.`);
// --strict échoue sur n'importe quel constat ; sans lui, seul le grave compte,
// puisqu'un champ vide n'est pas une raison de faire échouer quoi que ce soit.
process.exit(strict && constats.length ? 1 : 0);
