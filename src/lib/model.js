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

// ── Édition manuelle d'une fiche ────────────────────────────────────────────
// Tout ce que les sources automatiques écrivent (titre, plateforme, genres,
// note, jaquette, description, infobox Wikidata) était en lecture seule : une
// erreur de RAWG ou un mauvais article Wikipédia ne se corrigeait qu'en
// supprimant le jeu pour le recréer. La saisie passe par un brouillon de
// chaînes ; ces fonctions le traduisent en champs du modèle, et disent ce qui
// ne va pas plutôt que d'écrire n'importe quoi.
export const PLATFORMES_JEU = PLATFORMS.slice(1); // sans le "tous" du filtre

export function listeDepuisTexte(t) {
  return String(t || "").split(",").map(x => x.trim()).filter(Boolean);
}
export const listeVersTexte = (l) => (Array.isArray(l) ? l : []).join(", ");

// Une sortie par ligne : "2020-11-10 (Xbox Series X)", ou la date seule.
export function sortiesDepuisTexte(t) {
  return String(t || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)\s*\((.+)\)$/);
    return m ? { date: m[1].trim(), platform: m[2].trim() } : { date: l };
  });
}
export function sortiesVersTexte(rel) {
  return (Array.isArray(rel) ? rel : []).map(r => (r.platform ? `${r.date} (${r.platform})` : r.date)).join("\n");
}

// Brouillon (toutes les valeurs sont des chaînes) -> champs du jeu.
export function brouillonDepuisJeu(g) {
  const i = g.infobox || {};
  return {
    title: g.title || "", platform: g.platform || PLATFORMES_JEU[0],
    genre: listeVersTexte(g.genre), metacritic: g.metacritic == null ? "" : String(g.metacritic),
    addedDate: g.addedDate || "", style: g.style || "", cover: g.cover || "",
    developers: listeVersTexte(i.developers), publishers: listeVersTexte(i.publishers),
    releases: sortiesVersTexte(i.releases), modes: listeVersTexte(i.modes),
    series: i.series || "", follows: i.follows || "", followedBy: i.followedBy || "",
  };
}

const URL_JAQUETTE = /^(https?:\/\/|data:image\/)/;
export const estUrlImage = (u) => URL_JAQUETTE.test(String(u || "").trim());

// Retourne { erreurs, valeurs }. `valeurs` n'est exploitable que si `erreurs`
// est vide : mieux vaut un champ en rouge qu'un Metacritic à NaN dans le stock.
export function validerEdition(b) {
  const erreurs = {};
  const titre = String(b.title || "").trim();
  if (!titre) erreurs.title = "Titre obligatoire";
  if (!PLATFORMES_JEU.includes(b.platform)) erreurs.platform = "Plateforme inconnue";

  let mc = null;
  const mcBrut = String(b.metacritic || "").trim();
  if (mcBrut) {
    const n = Number(mcBrut);
    if (!Number.isInteger(n) || n < 0 || n > 100) erreurs.metacritic = "Entre 0 et 100, ou vide";
    else mc = n;
  }

  const date = String(b.addedDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) erreurs.addedDate = "Date invalide";

  const cover = String(b.cover || "").trim();
  if (cover && !URL_JAQUETTE.test(cover)) erreurs.cover = "URL d'image attendue (https://…)";

  // Une infobox vidée de tous ses champs redevient null : la section disparaît
  // au lieu d'afficher un cadre vide.
  const info = {
    developers: listeDepuisTexte(b.developers), publishers: listeDepuisTexte(b.publishers),
    releases: sortiesDepuisTexte(b.releases), modes: listeDepuisTexte(b.modes),
    series: String(b.series || "").trim(), follows: String(b.follows || "").trim(),
    followedBy: String(b.followedBy || "").trim(),
  };
  const infoVide = !info.developers.length && !info.publishers.length && !info.releases.length
    && !info.modes.length && !info.series && !info.follows && !info.followedBy;

  return {
    erreurs,
    valeurs: {
      title: titre, platform: b.platform, genre: listeDepuisTexte(b.genre),
      metacritic: mc, addedDate: date, style: String(b.style || "").trim(),
      cover: cover || null, infobox: infoVide ? null : info,
    },
  };
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
