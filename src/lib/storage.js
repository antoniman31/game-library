// Accès au stockage local, avec signalement des échecs.
//
// Toutes les écritures étaient enveloppées dans un `catch {}` muet. Un quota
// dépassé — le cas courant : la bibliothèque grossit, les descriptions
// Wikipédia sont longues — faisait donc perdre la persistance sans le moindre
// signe : on continuait à jouer, à chronométrer, à noter, et tout disparaissait
// au rechargement suivant. Une écriture qui échoue doit se voir.

const abonnes = new Set();
let dernierEchec = null;

// L'app s'abonne pour afficher un bandeau.
//
// Le message est retenu et rejoué aux abonnés tardifs : le premier `ecrire`
// part d'un effet React déclaré avant celui qui s'abonne, donc sans cette
// mémoire le tout premier échec — le plus important, celui du chargement —
// tombait dans le vide, et la garde « une seule fois » interdisait à tous les
// suivants de le rattraper.
export function surEchecStockage(fn) {
  abonnes.add(fn);
  if (dernierEchec) fn(dernierEchec);
  return () => abonnes.delete(fn);
}

// Une seule alerte par session : l'écriture échoue à chaque changement, et cent
// bandeaux identiques ne disent rien de plus que le premier.
function signaler(message) {
  if (dernierEchec) return;
  dernierEchec = message;
  for (const fn of abonnes) {
    try { fn(message); } catch { /* un abonné cassé ne doit pas masquer l'échec */ }
  }
}

export function lire(cle) {
  try {
    return localStorage.getItem(cle);
  } catch (e) {
    console.error("Lecture impossible :", cle, e);
    return null;
  }
}

// Retourne true si l'écriture a bien eu lieu.
export function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
    return true;
  } catch (e) {
    console.error("Écriture impossible :", cle, e);
    const plein = e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");
    signaler(
      plein
        ? "Stockage local saturé : tes modifications ne sont plus enregistrées sur cet appareil. Exporte ta bibliothèque (Réglages → Sauvegarde → Copie hors ligne) avant de fermer."
        : "Le stockage local est inaccessible : tes modifications ne sont pas enregistrées. Navigation privée ou données de site bloquées ?"
    );
    return false;
  }
}
