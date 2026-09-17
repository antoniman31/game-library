#!/usr/bin/env node
// Retrouver les dates d'ajout que la date de sortie avait écrasées.
//
//     node scripts/dates-suspectes.mjs ma-sauvegarde.json
//     node scripts/dates-suspectes.mjs ma-sauvegarde.json --corriger corrigee.json
//
// Le défaut : choisir une suggestion RAWG écrivait la date de SORTIE du jeu
// dans « Ajouté le ». Corrigé, mais les fiches ajoutées avant le correctif
// portent encore une date fausse — et `addedDate` trie « récemment ajoutés »
// et départage Xbox One de Series X.
//
// La date n'est pas perdue pour autant, et c'est tout l'intérêt de ce script :
// l'identifiant d'un jeu EST l'instant de sa création. `id: Date.now()` à
// l'ajout, à l'import Xbox, à l'import Playnite. Un identifiant au-dessus du
// milliard de millisecondes est donc un horodatage, pas un numéro — la vérité
// était dans la fiche depuis le début, personne ne l'avait lue.
//
// Ce n'est pas un test : un écart peut être parfaitement légitime. Qui saisit
// à la main la date d'achat d'un jeu acheté l'an dernier crée exactement le
// même écart qu'un défaut. D'où trois niveaux de certitude plutôt qu'un verdict
// — et `--corriger` qui n'écrit JAMAIS sur le fichier d'entrée.

import { readFileSync, writeFileSync } from "node:fs";
import { estDateISO } from "../src/lib/model.js";

// Les identifiants de la bibliothèque de démonstration valent 1, 2, 3. Ceux
// que l'application fabrique valent mille sept cents milliards. Aucune
// ambiguïté possible : le seuil est trois ordres de grandeur en dessous du
// plus petit horodatage réel, et trois au-dessus du plus grand compteur.
const SEUIL_HORODATAGE = 1e11; // ~mars 1973

export const dateDeLIdentifiant = (id) =>
  (Number.isFinite(id) && id >= SEUIL_HORODATAGE ? new Date(id).toISOString().slice(0, 10) : null);

// Quelques jours de battement, parce qu'un fuseau horaire déplace une date
// d'un jour et qu'une fiche corrigée à la main le lendemain n'est pas un
// défaut.
const JOURS_TOLERANCE = 2;
const ecartJours = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86400000;

// Trois niveaux, et la différence entre eux est la seule chose qui compte.
//
//   certain  — la date d'ajout est exactement une date de sortie inscrite dans
//              la fiche. C'est la signature du défaut, pas une coïncidence :
//              rien d'autre n'écrit la même valeur aux deux endroits.
//   probable — la date d'ajout précède de plus d'un an l'instant de création.
//              On n'ajoute pas un jeu un an avant de l'avoir ajouté.
//   possible — un écart plus court. Souvent légitime : une date d'achat saisie
//              à la main ressemble à ça.
export function examiner(jeu) {
  const vraie = dateDeLIdentifiant(jeu?.id);
  if (!vraie) return null;                      // jeu de démonstration, ou identifiant recomposé
  const posee = String(jeu?.addedDate || "").trim();
  if (!estDateISO(posee)) return null;          // une date illisible relève de l'audit, pas d'ici

  const ecart = ecartJours(posee, vraie);
  if (ecart <= JOURS_TOLERANCE) return null;

  const sorties = (jeu?.infobox?.releases || []).map(r => String(r?.date || "").slice(0, 10));
  const niveau = sorties.includes(posee) ? "certain"
    : posee < vraie && ecart > 365 ? "probable"
    : "possible";

  return { id: jeu.id, titre: jeu.title || "(sans titre)", posee, vraie, ecart: Math.round(ecart), niveau };
}

export function examinerTout(jeux) {
  return (jeux || []).map(examiner).filter(Boolean)
    .sort((a, b) => b.ecart - a.ecart);
}

// Corriger, c'est remettre la date que l'identifiant porte. Pas une date
// inventée, pas aujourd'hui : l'instant réel de la création de la fiche.
export function corriger(jeux, aCorriger) {
  const parId = new Map(aCorriger.map(c => [c.id, c.vraie]));
  return (jeux || []).map(g => (parId.has(g.id) ? { ...g, addedDate: parId.get(g.id) } : g));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const fichier = args.find(a => !a.startsWith("--"));
  const iCorriger = args.indexOf("--corriger");
  const sortie = iCorriger === -1 ? null : args[iCorriger + 1];

  if (!fichier) {
    console.error("Usage : node scripts/dates-suspectes.mjs <export.json> [--corriger <sortie.json>]");
    process.exit(2);
  }
  if (iCorriger !== -1 && (!sortie || sortie.startsWith("--"))) {
    console.error("--corriger demande un fichier de sortie. Le fichier d'entrée n'est jamais modifié.");
    process.exit(2);
  }
  if (sortie === fichier) {
    console.error("Le fichier de sortie doit être différent de l'entrée : une sauvegarde ne s'écrase pas.");
    process.exit(2);
  }

  // Lues telles quelles, sans passer par `migrateGames`.
  //
  // La migration complète les fiches — backCompat, infobox, boutique — et le
  // fichier ressorti aurait donc différé de l'entrée par bien plus que des
  // dates. Un script qui promet de ne toucher qu'aux dates et qui réécrit la
  // moitié des champs ment, même si le résultat est correct. Rien de ce que
  // `examiner` lit ne dépend de la migration.
  const brut = JSON.parse(readFileSync(fichier, "utf-8"));
  const jeux = Array.isArray(brut) ? brut : brut.games || [];
  const constats = examinerTout(jeux);

  const horodates = jeux.filter(g => dateDeLIdentifiant(g.id)).length;
  console.log(`${jeux.length} jeu(x), dont ${horodates} dont l'identifiant porte sa date de création.`);
  if (horodates < jeux.length) {
    console.log(`${jeux.length - horodates} sans horodatage : rien à dire d'eux, leur date n'est pas vérifiable.`);
  }
  console.log("");

  const ETIQUETTES = {
    certain: "CERTAIN — la date d'ajout est une date de sortie inscrite dans la fiche",
    probable: "PROBABLE — la date d'ajout précède de plus d'un an la création de la fiche",
    possible: "POSSIBLE — écart plus court, souvent une date saisie à la main",
  };

  for (const niveau of ["certain", "probable", "possible"]) {
    const duNiveau = constats.filter(c => c.niveau === niveau);
    if (!duNiveau.length) continue;
    console.log(`${ETIQUETTES[niveau]} (${duNiveau.length})`);
    for (const c of duNiveau) {
      console.log(`  ${c.titre} — posée ${c.posee}, réelle ${c.vraie} (${c.ecart} jours)`);
    }
    console.log("");
  }

  if (!constats.length) {
    console.log("Aucune date suspecte. Rien à corriger.");
    process.exit(0);
  }

  if (!sortie) {
    console.log(`${constats.length} fiche(s) concernée(s). Rien n'a été modifié.`);
    console.log("Pour écrire une copie corrigée : --corriger <sortie.json>");
    process.exit(0);
  }

  // Seuls « certain » et « probable » sont corrigés. « Possible » ressemble
  // trop à une date saisie exprès, et écraser une valeur voulue serait pire
  // que le défaut qu'on répare.
  const surs = constats.filter(c => c.niveau !== "possible");
  const corrigee = corriger(jeux, surs);
  writeFileSync(sortie, JSON.stringify(corrigee, null, 2));
  console.log(`${surs.length} date(s) remise(s) dans ${sortie}. ${fichier} n'a pas été touché.`);
  const laisses = constats.length - surs.length;
  if (laisses) console.log(`${laisses} « possible » laissée(s) telle(s) quelle(s) : à juger à la main.`);
}
