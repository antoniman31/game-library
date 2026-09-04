// Ce que la sauvegarde en ligne transporte en plus de la bibliothèque.
//
// Jusqu'ici elle ne contenait que les jeux. Le reste — le thème choisi, le
// noir profond, les clés des services — ne vivait que dans le localStorage
// d'un appareil : un téléphone neuf retrouvait ses 154 jeux, puis fallait
// tout re-régler à la main.
//
// Les clés sont un cas à part et n'y vont que sur demande explicite. Les
// synchroniser change la nature du code de synchronisation : il protège une
// liste de jeux, il protégerait des identifiants RAWG, SteamGridDB et xbl.io
// stockés en clair chez Cloudflare. Le risque n'est pas qu'on devine un code
// de 130 bits, c'est de le coller un jour dans un message en croyant ne
// partager qu'une liste de jeux.
//
// L'adresse du relais ne part jamais : elle est nécessaire pour joindre la
// sauvegarde, donc la restaurer depuis la sauvegarde serait circulaire.

import { MODES } from "./apparence.js";

export const CLES_SERVICES = ["rawg", "sgdb", "xbl"];

// Ce que cet appareil envoie. `avecCles` est une décision par appareil, pas
// une valeur synchronisée : chacun choisit ce qu'il expose.
export function preferencesASauvegarder({ modeTheme, noirProfond, keys, avecCles }) {
  const p = { theme: modeTheme, oled: !!noirProfond };
  if (avecCles) {
    const gardees = {};
    for (const c of CLES_SERVICES) {
      const v = String(keys?.[c] || "").trim();
      if (v) gardees[c] = v;
    }
    if (Object.keys(gardees).length) p.keys = gardees;
  }
  return p;
}

// Ce qu'on accepte d'une sauvegarde distante. Elle a été écrite par une autre
// version de l'application, peut-être plus ancienne, peut-être plus récente :
// c'est une donnée, pas une vérité. Tout champ absent ou aberrant est ignoré
// plutôt que corrigé, et l'appareil garde alors son réglage.
export function preferencesRecues(brut) {
  if (!brut || typeof brut !== "object") return {};
  const sortie = {};

  if (MODES.includes(brut.theme)) sortie.modeTheme = brut.theme;
  if (typeof brut.oled === "boolean") sortie.noirProfond = brut.oled;

  if (brut.keys && typeof brut.keys === "object") {
    const cles = {};
    for (const c of CLES_SERVICES) {
      const v = brut.keys[c];
      // Une clé vide n'efface pas la clé locale : une sauvegarde envoyée par
      // un appareil qui n'a pas la clé ne doit pas la retirer de celui-ci.
      if (typeof v === "string" && v.trim()) cles[c] = v.trim();
    }
    if (Object.keys(cles).length) sortie.keys = cles;
  }

  return sortie;
}

// De quoi le dire à l'écran avant d'appliquer : « des préférences » ne veut
// rien dire, « le thème et 2 clés » se décide.
export function resumePreferences(p) {
  const morceaux = [];
  if (p.modeTheme || p.noirProfond !== undefined) morceaux.push("l'apparence");
  const n = p.keys ? Object.keys(p.keys).length : 0;
  if (n) morceaux.push(`${n} clé${n > 1 ? "s" : ""} de service`);
  return morceaux.join(" et ");
}
