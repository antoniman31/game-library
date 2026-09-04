// Ce qui casse l'application quand on l'efface par mégarde.
//
// Les champs des réglages s'enregistraient sans un mot : vider une clé, ou
// remplacer le code de synchronisation, se faisait aussi facilement que le
// contraire. Or ces valeurs ne sont écrites nulle part ailleurs — pas dans
// l'export, pas dans le dépôt, pas dans la sauvegarde distante. Une clé
// effacée est à retrouver sur le site du service ; un code de synchronisation
// perdu emporte l'accès à la sauvegarde qu'il protégeait.
//
// Le module est pur pour que ces messages soient vérifiables : c'est
// justement le genre de garde-fou qu'on écrit une fois et qu'on ne relit
// jamais, jusqu'au jour où il ne se déclenche pas.

export const CONSEQUENCES = {
  rawg: ["la clé RAWG", "plus de jaquettes, de notes ni de genres automatiques"],
  sgdb: ["la clé SteamGridDB", "plus de recherche de jaquettes format boîte"],
  xbl: ["la clé xbl.io", "plus d'import de la bibliothèque Xbox"],
  proxy: ["l'adresse du relais", "SteamGridDB, l'import Xbox et la synchronisation cessent de fonctionner"],
};

// Ce qui disparaît entre deux états des réglages. Seul l'effacement compte :
// remplacer une clé par une autre est une correction, pas une perte.
export function pertesDeReglages(avant, apres) {
  return Object.keys(CONSEQUENCES)
    .filter(k => String(avant?.[k] || "").trim() && !String(apres?.[k] || "").trim())
    .map(k => ({ cle: k, quoi: CONSEQUENCES[k][0], consequence: CONSEQUENCES[k][1] }));
}

export function messageDePerte(pertes) {
  if (!pertes.length) return null;
  const lignes = pertes.map(p => `• ${p.quoi} — ${p.consequence}`).join("\n");
  return `Tu effaces ${pertes.length === 1 ? "une valeur" : `${pertes.length} valeurs`} :\n\n${lignes}\n\n` +
    `Rien ne les conserve ailleurs : ni l'export, ni la sauvegarde en ligne. Continuer ?`;
}

// Le code de synchronisation est la seule clé de la sauvegarde distante. Le
// perdre ne casse pas l'application, il rend une sauvegarde inaccessible —
// ce qui est pire, parce que ça ne se voit pas tout de suite.
export function messageCodeSync(avant, apres) {
  const a = String(avant || "").trim();
  const b = String(apres || "").trim();
  if (!a || a === b) return null;
  return b
    ? "Remplacer le code de synchronisation ?\n\nLa sauvegarde en ligne liée à l'ancien code deviendra inaccessible sans lui. Note-le si tu comptes y revenir."
    : "Effacer le code de synchronisation ?\n\nLa sauvegarde en ligne existera toujours, mais plus rien ici ne permettra de la retrouver.";
}
