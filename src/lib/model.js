// Vocabulaire du domaine : plateformes, rétrocompatibilité, prêts, migration
// des jeux stockés.
// L'application suit un seul état : le jeu est-il chez moi, ou prêté ?
// La progression (terminé, en cours, platine…) était tenue en double avec la
// console, qui la connaît mieux ; elle a été retirée.
export const PRET_LONG_JOURS = 30;
export const PLATFORMS = ["tous", "Xbox Series X", "Xbox One", "Switch 2", "Switch 1"];
// S4 : Series X vert vif (marque Xbox), One vert plus foncé, Switch rouge.
export const PLATFORM_COLORS = { "Xbox Series X": "#107C10", "Xbox One": "#0a5c0a", "Switch 2": "#e4000f", "Switch 1": "#e4000f" };

// Rétrocompatibilité : plateforme récente -> plateforme précédente dont les jeux
// marqués backCompat sont aussi jouables dessus. Sert au filtre (platMatch) et à la
// valeur par défaut de backCompat à la création/migration d'un jeu.
export const BACK_COMPAT = { "Xbox Series X": "Xbox One", "Switch 2": "Switch 1" };
export const BACK_COMPAT_CHILDREN = new Set(Object.values(BACK_COMPAT)); // "Xbox One", "Switch 1"
export const isBackCompatPlatform = (p) => BACK_COMPAT_CHILDREN.has(p);
// Plateforme "récente" qui accueille les jeux rétrocompatibles d'une plateforme donnée.
export const BACK_COMPAT_PARENT = Object.fromEntries(Object.entries(BACK_COMPAT).map(([parent, child]) => [child, parent]));

// Sépare l'ancienne plateforme "Xbox" en "Xbox One" / "Xbox Series X" selon la date
// (seuil 10/11/2020, sortie Series X ; addedDate sert de proxy de date de sortie).
// Renseigne backCompat (true par défaut pour Xbox One et Switch 1). Pure et idempotente.
//
// bcV = version de migration de backCompat, stockée PAR JEU :
//   v1 (ou absent) : backCompat ne concernait que Xbox One, les Switch 1 valaient false
//   v2             : Switch 1 rétrocompatibles Switch 2 -> rattrapage une seule fois
// Une fois bcV=2 posé, le champ n'est plus jamais forcé : le toggle manuel de la fiche
// (exception au cas par cas) survit donc aux rechargements.
// Champs devenus sans objet : la progression et le temps de jeu, que la console
// tient déjà, plus `note` et `progression` qui n'ont jamais été ni écrits ni lus.
const CHAMPS_RETIRES = ["status", "playedMinutes", "manualMinutes", "sessions", "hltb", "note", "progression"];

export const XBOX_SERIES_CUTOFF = "2020-11-10";
export const BACK_COMPAT_VERSION = 2;
export function migrateGames(list) {
  return (list || []).map(g => {
    const ng = { ...g };
    if (ng.platform === "Xbox") ng.platform = (ng.addedDate || "") >= XBOX_SERIES_CUTOFF ? "Xbox Series X" : "Xbox One";
    if (ng.backCompat === undefined) ng.backCompat = isBackCompatPlatform(ng.platform);
    else if ((ng.bcV || 1) < 2 && ng.platform === "Switch 1" && ng.backCompat === false) ng.backCompat = true;
    ng.bcV = BACK_COMPAT_VERSION;
    if (ng.infobox === undefined) ng.infobox = null;
    // Sept champs devenus sans objet : la progression et le temps de jeu, que
    // la console tient déjà, plus `note` et `progression` qui n'ont jamais été
    // ni écrits ni lus. Les garder ferait croire à des fonctions inexistantes,
    // et ils voyagent à chaque écriture et à chaque synchronisation.
    for (const mort of CHAMPS_RETIRES) delete ng[mort];
    return ng;
  });
}

export function daysSince(date) { return Math.floor((Date.now() - date) / 86400000); }
// Nombre de jours depuis le prêt, ou null si le jeu est chez soi.
export function joursDePret(g) {
  if (!g.lentA || !g.lentDate) return null;
  return daysSince(new Date(g.lentDate));
}

// Prêt qui s'éternise : le seul signal d'alerte que l'application ait encore
// à donner. Le traitement visuel qui marquait les jeux délaissés lui revient.
export function pretEnRetard(g) {
  const j = joursDePret(g);
  return j !== null && j > PRET_LONG_JOURS;
}

// Compte les filtres réellement appliqués. Le tri et le mode d'affichage n'en
// sont pas : ils changent l'ordre ou la densité, jamais ce qui est montré.
export function compterFiltres({ plat, pretFil, fmtFil }) {
  return [plat, pretFil, fmtFil].filter(v => v !== "tous").length;
}

// ── Import d'un fichier JSON ────────────────────────────────────────────────
// L'import faisait `JSON.parse` puis vérifiait seulement que le résultat était
// un tableau : un fichier au bon format mais au mauvais contenu (un export
// d'autre chose, un fichier tronqué) remplaçait la bibliothèque par des objets
// sans `genre` ni `sessions`, et la première fiche rendue plantait l'app.
//
// Chaque entrée doit avoir un titre exploitable ; tout le reste est complété.
// Retourne { jeux, rejetes } — `rejetes` sert à le dire à l'utilisateur plutôt
// qu'à laisser croire à un import complet.
const JEU_VIDE = {
  platform: "Xbox Series X", format: "physique", genre: [], style: "",
  lentA: null, lentDate: null, cover: null, metacritic: null,
  myLinks: ["", "", ""], tips: "", tag: "", infobox: null,
};

const estTexte = (v) => typeof v === "string";

export function validerJeuxImportes(data) {
  if (!Array.isArray(data)) return { jeux: null, rejetes: 0 };

  const jeux = [];
  const idsVus = new Set();
  let rejetes = 0;

  for (const brut of data) {
    if (!brut || typeof brut !== "object" || !estTexte(brut.title) || !brut.title.trim()) {
      rejetes++;
      continue;
    }
    // Deux jeux au même identifiant casseraient les clés React et l'édition,
    // qui repose entièrement sur `id`.
    let id = Number.isFinite(brut.id) ? brut.id : Date.now() + jeux.length;
    while (idsVus.has(id)) id = Date.now() + Math.floor(Math.random() * 1e6);
    idsVus.add(id);

    jeux.push({
      ...JEU_VIDE,
      ...brut,
      id,
      title: brut.title.trim(),
      addedDate: estTexte(brut.addedDate) && brut.addedDate ? brut.addedDate : new Date().toISOString().slice(0, 10),
      genre: Array.isArray(brut.genre) ? brut.genre.filter(estTexte) : [],
      myLinks: Array.isArray(brut.myLinks) ? [0, 1, 2].map(i => (estTexte(brut.myLinks[i]) ? brut.myLinks[i] : "")) : ["", "", ""],
      style: estTexte(brut.style) ? brut.style : "",
      tips: estTexte(brut.tips) ? brut.tips : "",
      tag: estTexte(brut.tag) ? brut.tag : "",
    });
  }
  return { jeux: migrateGames(jeux), rejetes };
}
