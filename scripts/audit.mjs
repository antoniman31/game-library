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
import { migrateGames, normTitle, dureeEntreeHistorique, PRET_LONG_JOURS,
  estDateISO, estDatePlausible, estLienSur, ANNEE_MIN, PLATFORMES_JEU } from "../src/lib/model.js";

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
//
// Sur PC, la plateforme ne suffit plus depuis que la boutique existe : posséder
// Borderlands 2 sur Steam et sur Epic est un fait, pas une anomalie, et la
// liste le sait — elle n'en montre qu'une carte. Seules deux fiches du même
// titre CHEZ LA MÊME BOUTIQUE restent un doublon. Sans cette nuance, l'audit
// signalait six paires légitimes et disait le contraire de l'application.
const parCle = new Map();
for (const g of jeux) {
  const cle = g.platform === "PC"
    ? `${normTitle(g.title)}|PC|${normTitle(g.boutique)}`
    : `${normTitle(g.title)}|${g.platform}`;
  (parCle.get(cle) || parCle.set(cle, []).get(cle)).push(g);
}
for (const [, groupe] of parCle) {
  if (groupe.length > 1) {
    const ou = groupe[0].platform === "PC" && groupe[0].boutique ? `PC · ${groupe[0].boutique}` : groupe[0].platform;
    signaler("doublon", `« ${groupe[0].title} » (${ou}) × ${groupe.length}`);
  }
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
  // Une fiche que toutes les sources ont refusé de noter n'est pas un manque à
  // combler : c'est une question réglée. L'application le sait et cesse de la
  // proposer ; l'audit annonçait vingt-neuf jeux à noter quand elle en comptait
  // zéro — deux vérités sur la même bibliothèque, et rien pour les accorder.
  ["sans note", g => !g.metacritic && !g.noteAbsente],
]) {
  const titres = sans(predicat);
  if (titres.length) signaler(libelle, `${titres.length} : ${resume(titres)}`, "info");
}

// ── Dates ──────────────────────────────────────────────────────────────────
const aujourdhui = new Date().toISOString().slice(0, 10);
for (const g of jeux) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.addedDate || "")) {
    signaler("date d'ajout illisible", `« ${g.title} » : ${JSON.stringify(g.addedDate)}`, "grave");
  } else if (!estDatePlausible(g.addedDate, aujourdhui)) {
    // Lisible mais impossible. « 0001-01-01 » passe tous les contrôles de
    // format et faisait tracer à l'onglet Stats un histogramme allant de l'an 1
    // à aujourd'hui — deux mille colonnes pour une année mal tapée.
    signaler("année d'ajout invraisemblable",
      `« ${g.title} » : ${g.addedDate} (attendu : ${ANNEE_MIN} ou après)`, "grave");
  } else if (g.addedDate > aujourdhui) {
    signaler("date d'ajout à venir", `« ${g.title} » : ${g.addedDate}`);
  }
}

// ── Liens de fiche ─────────────────────────────────────────────────────────
// Un lien de fiche finit dans un `href`. Tout ce qui n'est pas http(s) en est
// un aussi — `javascript:` le premier — et s'exécuterait dans l'application,
// avec accès au stockage donc aux clés et au code de synchronisation.
for (const g of jeux) {
  for (const lien of g.myLinks || []) {
    if (lien && !estLienSur(lien)) {
      signaler("lien non ouvrable", `« ${g.title} » : ${JSON.stringify(lien)}`, "grave");
    }
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
// source a répondu pour un autre jeu. Ce n'est pas seulement la série qui est
// alors fausse — le développeur, l'éditeur et les dates de sortie viennent du
// même appel, et rien d'autre ne les vérifie.
//
// La règle exigeait auparavant que le titre et la série se préfixent l'un
// l'autre. C'est un test d'égalité déguisé, appliqué à deux chaînes qui n'ont
// aucune raison d'être égales : un titre nomme un jeu, une série nomme une
// famille. Sur une bibliothèque réelle de 154 jeux elle s'est trompée vingt
// fois sur vingt — « Sonic Generations → Sonic the Hedgehog » signalé, le mot
// « Sonic » sous les yeux. Une catégorie qui a toujours tort n'est pas neutre :
// elle apprend à sauter la ligne, et le jour où elle aura raison personne ne la
// lira.
//
// Deux conditions la remplacent, mesurées sur cette même bibliothèque :
//   1. aucun mot significatif commun au titre et à la série  (20 → 4) ;
//   2. et aucun autre jeu ne porte cette série               (4 → 2).
//
// La seconde est une corroboration : si quatre fiches annoncent « The Legend
// of Zelda », la série existe et aucune source n'a déliré. Les deux cas qui
// restent — une franchise dont le nom ne figure pas dans le titre, comme
// « 007 First Light → James Bond » — sont irréductibles sans un dictionnaire
// des franchises, qu'on n'écrira pas pour ça.
const LONGUEUR_MOT_SIGNIFICATIF = 3;
const motsSignificatifs = (s) =>
  new Set(normTitle(s).split(" ").filter(m => m.length > LONGUEUR_MOT_SIGNIFICATIF));

const jeuxParSerie = new Map();
for (const g of jeux) {
  const serie = g.infobox?.series;
  if (serie) jeuxParSerie.set(serie, (jeuxParSerie.get(serie) || 0) + 1);
}
for (const g of jeux) {
  const serie = g.infobox?.series;
  if (!serie) continue;
  const motsDuTitre = motsSignificatifs(g.title);
  if ([...motsSignificatifs(serie)].some(m => motsDuTitre.has(m))) continue;
  if (jeuxParSerie.get(serie) > 1) continue;
  signaler("série éloignée du titre",
    `« ${g.title} » → série « ${serie} », qu'aucun autre jeu ne porte`, "info");
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
