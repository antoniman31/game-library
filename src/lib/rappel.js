// Quand rappeler qu'une sauvegarde est en retard.
//
// L'écran le dit déjà : une pastille sur ⚙️, une ligne orange dans les
// réglages. Mais les deux supposent qu'on ouvre l'application — or c'est
// justement quand on ne l'ouvre plus qu'une sauvegarde vieillit. Le rappel est
// la seule chose du projet qui puisse parler à quelqu'un qui n'est pas là.
//
// Il n'y a rien de natif ici, uniquement le calcul : à quel instant. Le reste —
// permission, planification, annulation — vit dans natif.js, et ce fichier se
// teste sans téléphone.

import { JOURS_SAUVEGARDE_VIEILLE } from "./preferences.js";

// Dix heures du matin, et le choix n'est pas cosmétique : une notification qui
// tombe à trois heures du matin réveille, et la seule chose qu'on retienne
// d'un rappel qui réveille, c'est comment le couper. L'heure locale, pas UTC —
// c'est la seule chose que l'utilisateur ressent.
export const HEURE_RAPPEL = 10;

// L'instant du prochain rappel, ou null s'il n'y a rien à rappeler.
//
// La règle tient en une phrase : sept jours après la dernière sauvegarde, à
// dix heures. Deux cas particuliers, qui sont les cas réels :
//
//   - configuré mais jamais envoyé depuis cet appareil : il n'y a pas de date
//     d'où compter, et attendre une semaine avant de le signaler serait une
//     semaine sans aucune sauvegarde. Le prochain matin.
//   - la date est déjà passée — l'application n'a pas été ouverte depuis
//     longtemps : le prochain matin également. Pas tout de suite : une
//     notification qui arrive pendant qu'on regarde l'écran n'apprend rien.
export function prochainRappel({ configuree, majLe } = {}, maintenant = Date.now()) {
  if (!configuree) return null;

  const t = majLe ? new Date(majLe).getTime() : NaN;
  const vise = Number.isFinite(t) ? t + JOURS_SAUVEGARDE_VIEILLE * 86400000 : maintenant;
  return prochaineHeure(Math.max(vise, maintenant), maintenant);
}

// Le prochain HEURE_RAPPEL à partir d'un instant, jamais dans le passé.
//
// `setHours` sur une Date locale traverse correctement les changements
// d'heure : le 10:00 d'un dimanche de bascule est un vrai 10:00, pas 09:00 ni
// 11:00. C'est la raison pour laquelle on passe par une Date plutôt que par de
// l'arithmétique sur des millisecondes.
function prochaineHeure(depuis, maintenant) {
  const d = new Date(depuis);
  d.setHours(HEURE_RAPPEL, 0, 0, 0);
  if (d.getTime() <= Math.max(depuis, maintenant)) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// Faut-il replanifier ?
//
// Sans cette question, chaque ouverture de l'application repousserait le
// rappel : une sauvegarde déjà en retard verrait son rappel glisser au
// lendemain matin chaque fois qu'on ouvre, donc ne sonnerait jamais pour qui
// ouvre tous les jours — exactement l'inverse de ce qu'on veut. On compare
// donc sur la date de sauvegarde, pas sur l'instant calculé : tant que la
// sauvegarde n'a pas bougé, le rappel en attente reste le bon.
export function rappelAReplanifier({ enAttente, pour }) {
  if (!enAttente) return true;
  return String(enAttente.pour || "") !== String(pour || "");
}
