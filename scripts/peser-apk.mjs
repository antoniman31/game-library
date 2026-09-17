#!/usr/bin/env node
// Où va le poids de l'APK.
//
//     node scripts/peser-apk.mjs android/app/build/outputs/apk/release/app-release.apk
//
// Une taille totale ne dit pas quoi corriger. 22,5 Mo, c'est un chiffre ; « le
// modèle du lecteur de codes-barres pèse 4,9 Mo par architecture et il y en a
// quatre », c'est une décision. Le poids d'une optimisation se juge sur cette
// ventilation, pas sur le total — sans elle, « on est passé de 22,5 à 8 » ne
// dit pas si ce qui reste est réductible.
//
// La colonne retenue est la taille COMPRESSÉE, celle qui occupe vraiment de la
// place dans l'APK. Les bibliothèques natives y échappent souvent — Android les
// stocke sans compression pour pouvoir les charger en place — et c'est
// justement pour ça qu'elles dominent.

import { execFileSync } from "node:child_process";

// Chaque ligne utile de `unzip -v` : longueur, méthode, taille compressée,
// taux, date, heure, CRC, nom. Le nom peut contenir des espaces, d'où le
// découpage sur les sept premiers champs seulement.
const LIGNE = /^\s*(\d+)\s+\S+\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+?)\s*$/;

// Les catégories, dans l'ordre où elles sont essayées : la première qui
// reconnaît le chemin l'emporte. `lib/<abi>/` avant tout, parce que c'est la
// seule catégorie dont le nom dépend du contenu.
export function categorie(chemin) {
  const abi = chemin.match(/^lib\/([^/]+)\//);
  if (abi) return `natif · ${abi[1]}`;
  if (/^classes\d*\.dex$/.test(chemin)) return "code Java/Kotlin (dex)";
  if (chemin.startsWith("assets/public/")) return "application web";
  if (chemin.startsWith("assets/")) return "autres assets";
  if (chemin.startsWith("res/") || chemin === "resources.arsc") return "ressources Android";
  if (chemin.startsWith("META-INF/")) return "signature";
  return "divers";
}

export function ventiler(sortieUnzip) {
  const par = new Map();
  let total = 0;
  for (const ligne of String(sortieUnzip || "").split("\n")) {
    const m = ligne.match(LIGNE);
    if (!m) continue;
    const [, , compresse, chemin] = m;
    // Les entrées de dossier pèsent zéro et n'ont pas de catégorie utile.
    if (chemin.endsWith("/")) continue;
    // La ligne de total de `unzip -v` ressemble à une entrée : elle n'a pas de
    // chemin plausible, et la prendre doublerait tout.
    if (chemin.endsWith("files") || chemin === "Name") continue;
    const c = categorie(chemin);
    const octets = Number(compresse);
    par.set(c, (par.get(c) || 0) + octets);
    total += octets;
  }
  return { total, categories: [...par.entries()].sort((a, b) => b[1] - a[1]) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apk = process.argv[2];
  if (!apk) {
    console.error("Usage : node scripts/peser-apk.mjs <fichier.apk>");
    process.exit(2);
  }
  const { total, categories } = ventiler(execFileSync("unzip", ["-v", apk], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }));
  const ko = (o) => `${(o / 1024).toFixed(0).padStart(7)} Ko`;
  const pct = (o) => `${((o / total) * 100).toFixed(1).padStart(5)} %`;

  console.log(`APK : ${ko(total)} au total (taille compressée dans l'archive)`);
  console.log("");
  for (const [nom, octets] of categories) console.log(`  ${ko(octets)}  ${pct(octets)}  ${nom}`);

  // Ce que les deux optimisations retenues visent, dit explicitement : le
  // lecteur devient inutilement lourd dès qu'on empile les architectures.
  const emulateur = categories.filter(([n]) => /x86/.test(n)).reduce((s, [, o]) => s + o, 0);
  if (emulateur) {
    console.log("");
    console.log(`  dont ${ko(emulateur)} pour des architectures x86, qui n'existent que sur émulateur.`);
  }
}
