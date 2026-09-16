// Les jaquettes, gardées sur l'appareil.
//
// Une jaquette est une URL — SteamGridDB, RAWG, Microsoft. Sur le site, le
// service worker les met en cache soixante jours et on les revoit hors ligne ;
// dans l'application, ce service worker n'existe pas, si bien qu'elle
// retéléchargeait les deux cent quatre-vingt-huit images à chaque lancement et
// n'affichait que des cadres vides sans réseau. Le site était devenu meilleur
// que l'application sur le seul point où l'application devait gagner.
//
// Ce module descend les images dans le stockage privé de l'application et tient
// l'index de ce qui est descendu.
//
// Ce qu'il ne fait PAS, et c'est le choix qui compte : il ne touche pas au champ
// `cover` de la fiche. L'URL reste la référence — c'est elle qui part dans
// l'export et dans la synchronisation, c'est elle que lit le site, c'est elle
// qu'un autre appareil saura redescendre. Un chemin de fichier local ne veut
// rien dire ailleurs que sur ce téléphone-ci, et l'écrire dans la bibliothèque
// aurait rendu l'export illisible partout ailleurs. L'index vit donc à côté,
// dans sa propre clé, comme les clés d'API et le code de synchronisation.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { estNatif } from "./natif.js";

const CLE = "gl_jaquettes";
const DOSSIER = "jaquettes";

// Un nom de fichier stable pour une URL.
//
// Une empreinte plutôt que l'adresse assainie : deux URL différentes peuvent
// finir sur le même nom une fois la ponctuation retirée, et le nom d'origine
// dépasse allègrement la longueur qu'un système de fichiers accepte. C'est un
// hachage court et non cryptographique — il nomme, il ne protège rien.
export function nomFichier(url) {
  let h = 2166136261;
  const s = String(url || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const ext = /\.(png|jpe?g|webp|gif)(\?|$)/i.exec(s)?.[1]?.toLowerCase() || "img";
  return `${(h >>> 0).toString(36)}.${ext}`;
}

// Où l'image se range, relativement au dossier privé de l'application.
//
// La descente et le ménage passent par ce même calcul plutôt que par deux
// constructions parallèles : le jour où l'une change, l'autre suit, au lieu de
// supprimer à côté sans rien dire.
export function cheminLocal(url) {
  return `${DOSSIER}/${nomFichier(url)}`;
}

// L'index : URL d'origine → chemin du fichier descendu.
export function lireIndex() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || "{}");
    return brut && typeof brut === "object" && !Array.isArray(brut) ? brut : {};
  } catch { return {}; }
}

function ecrireIndex(index) {
  try { localStorage.setItem(CLE, JSON.stringify(index)); } catch { /* quota : tant pis */ }
}

// Les URL qu'il reste à descendre, sans doublon.
//
// Deux fiches peuvent porter la même jaquette — le même jeu chez deux boutiques
// — et il serait absurde de la descendre deux fois.
export function aDescendre(jeux, index = lireIndex()) {
  const vues = new Set();
  const liste = [];
  for (const g of jeux || []) {
    const url = String(g?.cover || "");
    if (!/^https?:/i.test(url) || vues.has(url) || index[url]) continue;
    vues.add(url);
    liste.push(url);
  }
  return liste;
}

// L'adresse à donner à <img> : le fichier local s'il existe, l'URL sinon.
//
// Hors de l'application, il n'y a pas d'index et cette fonction rend l'URL
// telle quelle — le service worker du site fait déjà le travail.
export function sourceJaquette(url, index) {
  if (!estNatif() || !url) return url;
  const nom = (index || lireIndex())[url];
  if (!nom) return url;
  return Capacitor.convertFileSrc(nom);
}

// Descend ce qui manque, une image à la fois.
//
// Séquentiel et non parallèle : deux cent quatre-vingt-huit requêtes lancées
// ensemble sur un réseau mobile finissent en délais dépassés, et l'opération
// n'est pas pressée. `onProgress` permet de l'afficher, `doitArreter` de
// l'interrompre — une descente de cinquante mégaoctets doit pouvoir être
// annulée.
//
// Chaque succès est écrit dans l'index immédiatement : interrompue à la
// centième image, l'opération garde les quatre-vingt-dix-neuf premières et
// reprendra où elle s'est arrêtée.
export async function descendreJaquettes(jeux, { onProgress, doitArreter } = {}) {
  if (!estNatif()) return { descendues: 0, echouees: 0, total: 0 };

  const index = lireIndex();
  const liste = aDescendre(jeux, index);
  let descendues = 0, echouees = 0, motif = "";

  // Le dossier est créé d'abord, et ce n'est pas une précaution de style.
  // `downloadFile` accepte bien une option `recursive`, mais son implémentation
  // Android — la voie héritée que ce greffon garde par compatibilité — ne la
  // lit nulle part : elle ne crée que le dossier racine, puis ouvre le fichier
  // dans un sous-dossier qui n'existe pas. Sans cette ligne, les deux cent
  // soixante-quatre images échouent, toutes, avec la même erreur.
  try {
    await Filesystem.mkdir({ path: DOSSIER, directory: Directory.Data, recursive: true });
  } catch { /* il existe déjà, c'est le cas normal dès la deuxième fois */ }

  for (const [i, url] of liste.entries()) {
    if (doitArreter?.()) break;
    try {
      const { path } = await Filesystem.downloadFile({
        url,
        path: cheminLocal(url),
        directory: Directory.Data,
      });
      if (path) { index[url] = path; ecrireIndex(index); descendues++; }
      else { echouees++; motif ||= "chemin vide"; }
    } catch (e) {
      // Une jaquette qui ne descend pas n'est pas une panne : l'URL reste, et
      // l'image s'affichera quand le réseau sera là. Mais le premier motif est
      // retenu — « 264 échecs » sans rien d'autre n'apprend rien à personne.
      echouees++;
      motif ||= String(e?.message || e || "").slice(0, 120);
    }
    onProgress?.(i + 1, liste.length);
  }
  return { descendues, echouees, total: liste.length, motif };
}

// Les fichiers dont plus aucune fiche ne veut.
//
// Supprimer un jeu ou changer sa jaquette laisse une image orpheline dans le
// stockage. Sans ce ménage, le dossier ne fait que croître.
export async function menageJaquettes(jeux) {
  if (!estNatif()) return { retirees: 0 };
  const index = lireIndex();
  const vivantes = new Set((jeux || []).map(g => String(g?.cover || "")).filter(Boolean));
  let retirees = 0;
  for (const url of Object.keys(index)) {
    if (vivantes.has(url)) continue;
    // Le chemin est recalculé plutôt que relu dans l'index : celui-ci retient
    // l'adresse absolue rendue par la descente, alors que la suppression
    // attend un chemin relatif à un dossier nommé.
    try {
      await Filesystem.deleteFile({ path: cheminLocal(url), directory: Directory.Data });
    } catch { /* déjà partie */ }
    delete index[url];
    retirees++;
  }
  if (retirees) ecrireIndex(index);
  return { retirees };
}
