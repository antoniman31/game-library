// Ce que la sauvegarde en ligne transporte en plus de la bibliothèque.
//
// Jusqu'ici elle ne contenait que les jeux. Le reste — le thème choisi, les
// clés des services — ne vivait que dans le localStorage d'un appareil : un
// téléphone neuf retrouvait ses 154 jeux, puis fallait tout re-régler à la
// main.
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
export function preferencesASauvegarder({ modeTheme, keys, avecCles, exclusions }) {
  const p = { theme: modeTheme };
  // Les exclusions d'import voyagent toujours, sans case à cocher : ce ne sont
  // pas des secrets, et une liste d'exclusions qui reste sur le PC laisse le
  // téléphone réimporter les jeux qu'on vient d'écarter.
  const ex = nettoyerExclusions(exclusions);
  if (ex.length) p.exclusions = ex;
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

  // Un `oled` venu d'une version où le noir profond était une préférence à
  // part n'est plus lu : le sombre EST le noir profond, il n'y a plus rien à
  // choisir. Il est ignoré comme n'importe quel champ inconnu.
  if (MODES.includes(brut.theme)) sortie.modeTheme = brut.theme;

  const ex = nettoyerExclusions(brut.exclusions);
  if (ex.length) sortie.exclusions = ex;

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
  if (p.modeTheme) morceaux.push("l'apparence");
  const n = p.keys ? Object.keys(p.keys).length : 0;
  if (n) morceaux.push(`${n} clé${n > 1 ? "s" : ""} de service`);
  const e = p.exclusions ? p.exclusions.length : 0;
  if (e) morceaux.push(`${e} exclusion${e > 1 ? "s" : ""} d'import`);
  return morceaux.join(" et ");
}

// ── Exclusions d'import ────────────────────────────────────────────────────
//
// Un jeu supprimé après un import Playnite doit rester supprimé : sans cette
// liste, chaque import ramène les cent lignes qu'on vient d'écarter, et on
// cesse d'importer. Une exclusion est une référence de boutique, pas un jeu :
// elle survit à la suppression de la fiche, c'est tout son objet.
//
// Cette fonction est la porte d'entrée unique — fichier reçu, stockage local,
// sauvegarde distante passent tous par elle, parce qu'aucune de ces trois
// sources n'est écrite par cette version de l'application.
export const EXCLUSIONS_MAX = 5000;
export function nettoyerExclusions(brut) {
  if (!Array.isArray(brut)) return [];
  const vues = new Set();
  for (const v of brut) {
    if (typeof v !== "string") continue;
    const r = v.trim();
    if (r && r.length <= 200) vues.add(r);
    if (vues.size >= EXCLUSIONS_MAX) break;
  }
  return [...vues];
}


// ── Âge de la sauvegarde en ligne ──────────────────────────────────────────
//
// La synchronisation est manuelle, et c'est bien : personne ne veut qu'une
// application pousse ses données sans qu'on le lui demande. Mais une
// sauvegarde qu'on oublie de faire est une sauvegarde qui n'existe pas, et
// l'écran ne disait son âge que sous la forme d'une date à convertir de tête,
// dans un panneau qu'on n'ouvre jamais.
//
// Sept jours : assez long pour qu'une semaine sans jouer ne réclame rien,
// assez court pour qu'on ne perde jamais plus d'une semaine d'ajouts.
export const JOURS_SAUVEGARDE_VIEILLE = 7;

export function etatSauvegarde({ majLe, code, proxy } = {}, maintenant = Date.now()) {
  // Sans code ni relais, il n'y a pas de sauvegarde à vieillir : on ne
  // réclame pas une synchronisation à qui n'en a pas voulu.
  if (!String(code || "").trim() || !String(proxy || "").trim()) return { configuree: false, niveau: "aucune" };
  const t = majLe ? new Date(majLe).getTime() : NaN;
  if (!Number.isFinite(t)) return { configuree: true, niveau: "jamais", jours: null };
  const jours = Math.max(0, Math.floor((maintenant - t) / 86400000));
  return { configuree: true, niveau: jours >= JOURS_SAUVEGARDE_VIEILLE ? "vieille" : "fraiche", jours };
}

export function texteAgeSauvegarde(etat) {
  if (!etat?.configuree) return "";
  if (etat.niveau === "jamais") return "jamais envoyée depuis cet appareil";
  if (etat.jours === 0) return "aujourd'hui";
  if (etat.jours === 1) return "hier";
  return `il y a ${etat.jours} jours`;
}


// ── Réglages d'affichage ───────────────────────────────────────────────────
//
// La vue, le tri, son sens et le regroupement repartaient à zéro à chaque
// lancement : on rouvrait l'application en vue liste, triée de A à Z, alors
// qu'on l'avait quittée en grille par date de sortie. Ils vivent maintenant
// dans le stockage local.
//
// Les filtres, eux, n'y vont pas, et c'est délibéré. Un filtre survivant au
// lancement, c'est une bibliothèque amputée sans qu'on sache pourquoi — le
// défaut qu'on vient de corriger sur l'ajout d'un jeu, mais permanent. Un
// réglage d'affichage change comment on regarde, un filtre change ce qu'on
// voit : seul le premier a vocation à durer.
export const AFFICHAGE_DEFAUT = { view: "liste", sort: "titre", sortDir: 1, groupePar: "aucun" };

const VUES = ["liste", "compact", "grille"];
const GROUPES = ["aucun", "plateforme", "boutique", "serie", "genre"];

export function affichageRecu(brut, trisConnus = []) {
  const p = { ...AFFICHAGE_DEFAUT };
  if (!brut || typeof brut !== "object") return p;
  if (VUES.includes(brut.view)) p.view = brut.view;
  if (GROUPES.includes(brut.groupePar)) p.groupePar = brut.groupePar;
  if (trisConnus.includes(brut.sort)) p.sort = brut.sort;
  // Le sens ne vaut que 1 ou -1 : tout le reste renverserait le comparateur.
  if (brut.sortDir === -1 || brut.sortDir === 1) p.sortDir = brut.sortDir;
  return p;
}
