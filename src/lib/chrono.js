// Chrono en cours, conservé hors de React.
//
// `activeTimer` et `timerStart` ne vivaient que dans la mémoire du composant.
// Android tue régulièrement une PWA laissée en arrière-plan : on lançait une
// session, on posait le téléphone, et elle disparaissait sans laisser de trace
// ni de temps comptabilisé.

import { lire, ecrire } from "./storage.js";

const CLE = "gl_chrono";

// Un chrono qui traîne depuis plus de 12 heures est une session qu'on a oublié
// d'arrêter, pas une partie : la reprendre ajouterait des heures fictives.
const DUREE_MAX = 12 * 60 * 60 * 1000;

export function chargerChrono() {
  try {
    const v = JSON.parse(lire(CLE) || "null");
    if (!v || !Number.isFinite(v.debut) || v.id === undefined) return { id: null, debut: null };
    if (Date.now() - v.debut > DUREE_MAX) return { id: null, debut: null };
    return { id: v.id, debut: v.debut };
  } catch {
    return { id: null, debut: null };
  }
}

// `null` efface le chrono enregistré.
export function enregistrerChrono(v) {
  ecrire(CLE, v ? JSON.stringify(v) : "null");
}
