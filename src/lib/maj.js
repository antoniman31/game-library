// Détection d'une nouvelle version déjà installée.
//
// Le service worker tourne en `autoUpdate` : il télécharge la nouvelle
// version et en prend le contrôle sans rien demander. Mais l'onglet déjà
// ouvert continue d'exécuter le JavaScript chargé à son démarrage — la
// mise à jour n'apparaît qu'au rechargement suivant. En pratique il fallait
// fermer l'application et la rouvrir pour voir un changement, sans jamais
// savoir s'il y en avait un.
//
// `controllerchange` dit exactement ce qu'on veut savoir : un autre service
// worker vient de prendre la main, donc le code servi n'est plus celui qui
// s'exécute ici.

// Séparé de navigator pour rester vérifiable sans navigateur : n'importe quel
// EventTarget fait l'affaire. Retourne une fonction de désabonnement.
export function ecouterMiseAJour(sw, avaitUnControleur, fn) {
  if (!sw) return () => {};
  // Première visite : il n'y avait pas de contrôleur, donc le changement qui
  // arrive est l'installation initiale. Rien n'est périmé, rien à signaler.
  const surChangement = () => { if (avaitUnControleur) fn(); };
  sw.addEventListener("controllerchange", surChangement);
  return () => sw.removeEventListener("controllerchange", surChangement);
}

// Câblage réel, côté navigateur.
export function surMiseAJour(fn) {
  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : null;
  return ecouterMiseAJour(sw, !!sw?.controller, fn);
}
