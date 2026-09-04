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
    if (ng.lentRetourPrevu === undefined) ng.lentRetourPrevu = null;
    if (!Array.isArray(ng.pretsPasses)) ng.pretsPasses = [];
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

// Date de retour convenue, facultative, posée au moment du prêt.
// Un seuil unique de 30 jours traite de la même façon le jeu passé à un frère
// pour le week-end et celui confié à un collègue pour l'été. Quand la date est
// renseignée, c'est elle qui fait foi ; sinon le seuil reste le repli.
export const aujourdhuiISO = () => new Date().toISOString().slice(0, 10);

// Prêt qui s'éternise : le seul signal d'alerte que l'application ait encore
// à donner. Le traitement visuel qui marquait les jeux délaissés lui revient.
export function pretEnRetard(g) {
  if (!g.lentA || !g.lentDate) return false;
  if (g.lentRetourPrevu) return aujourdhuiISO() > g.lentRetourPrevu;
  const j = joursDePret(g);
  return j !== null && j > PRET_LONG_JOURS;
}

// ── Historique des prêts ────────────────────────────────────────────────────
// « Rendu » remettait lentA et lentDate à null : le prêt disparaissait sans
// laisser de trace. On ne savait plus à qui on avait déjà confié un jeu, ni
// que la même personne met trois mois à chaque fois — alors que c'est
// précisément ce que cette application est censée savoir.
//
// L'historique est porté par le jeu, donc il part dans l'export et dans la
// synchronisation avec le reste. Il est borné : une ligne pèse peu, mais rien
// ne doit croître sans limite dans un stockage plafonné à quelques Mo.
export const MAX_HISTORIQUE_PRET = 20;

export const dureeEntreeHistorique = (e) =>
  Math.max(0, Math.round((new Date(e.au) - new Date(e.du)) / 86400000));

// Rend le jeu et archive le prêt. Pure : retourne un nouvel objet.
// `prevu` conserve la date de retour convenue au moment du prêt. Sans elle,
// l'entrée archivée ne dit plus que la durée, et la question qui compte —
// a-t-il rendu quand il l'avait dit ? — devient impossible à poser une fois le
// jeu revenu. Les entrées d'avant n'en ont pas : elles sont simplement
// exclues du calcul de ponctualité, pas fausses.
export function rendreJeu(g) {
  if (!g.lentA || !g.lentDate) return g;
  const entree = { a: g.lentA, du: g.lentDate, au: aujourdhuiISO(), prevu: g.lentRetourPrevu || null };
  return {
    ...g,
    lentA: null, lentDate: null, lentRetourPrevu: null,
    pretsPasses: [entree, ...(g.pretsPasses || [])].slice(0, MAX_HISTORIQUE_PRET),
  };
}

// Efface un prêt SANS l'archiver : il n'a pas eu lieu.
//
// « ✓ Rendu » suppose un prêt réel qui se termine, et l'inscrit dans
// l'historique — donc dans les statistiques. Un prêt créé par erreur, ou un
// essai de la fonction, n'a rien à y faire : le corriger avec « Rendu »
// fabrique une ligne fausse que plus rien n'efface.
export function annulerPret(g) {
  if (!g.lentA && !g.lentDate) return g;
  return { ...g, lentA: null, lentDate: null, lentRetourPrevu: null };
}

// Retire une ligne de l'historique. Même raison : une erreur doit pouvoir
// disparaître, sinon elle fausse les moyennes pour toujours.
export function supprimerEntreeHistorique(g, index) {
  const hist = g.pretsPasses || [];
  if (index < 0 || index >= hist.length) return g;
  return { ...g, pretsPasses: hist.filter((_, i) => i !== index) };
}

// Prête le jeu. `retourPrevu` vide ou absent -> pas de date convenue.
export function preterJeu(g, nom, retourPrevu) {
  const n = String(nom || "").trim();
  if (!n) return g;
  const d = String(retourPrevu || "").trim();
  return {
    ...g, lentA: n, lentDate: aujourdhuiISO(),
    lentRetourPrevu: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
  };
}

// Compte les filtres réellement appliqués. Le tri et le mode d'affichage n'en
// sont pas : ils changent l'ordre ou la densité, jamais ce qui est montré.
export function compterFiltres({ plat, pretFil, fmtFil }) {
  return [plat, pretFil, fmtFil].filter(v => v !== "tous").length;
}

// Normalisation d'un titre pour comparaison : minuscules, sans accents ni
// ponctuation. Sert à la recherche, à la déduplication d'import, et à repérer
// un rapprochement RAWG douteux.
export const normTitle = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Le score récupéré vient du premier résultat RAWG pour le titre : sur une
// centaine de jeux, un titre approximatif ramène tôt ou tard la note d'un
// autre jeu. Deux titres qui ne se recouvrent pas méritent d'être signalés
// plutôt qu'écrits en silence.
export function rapprochementDouteux(titreLocal, titreSource) {
  const a = normTitle(titreLocal), b = normTitle(titreSource);
  if (!a || !b) return true;
  return a !== b && !a.startsWith(b) && !b.startsWith(a);
}

// Jeux dont la note Metacritic manque — 0 compte comme absent, RAWG ne
// distingue pas « pas de note » de « note nulle ».
export const jeuxSansScore = (games) => (games || []).filter(g => !g.metacritic);

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
    format: g.format === "démat" ? "démat" : "physique", backCompat: !!g.backCompat,
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

  // Une plateforme sans console parente ne peut pas être rétrocompatible.
  // Sans cette remise à zéro, faire passer un jeu de Xbox One à Xbox Series X
  // laisse un backCompat à true que plus rien n'affiche — et que les
  // statistiques continuent de compter parmi les jeux rétrocompatibles.
  const format = b.format === "démat" ? "démat" : "physique";
  const backCompat = !!b.backCompat && !!BACK_COMPAT_PARENT[b.platform];

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
      title: titre, platform: b.platform, format, backCompat,
      genre: listeDepuisTexte(b.genre),
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
  lentA: null, lentDate: null, lentRetourPrevu: null, pretsPasses: [],
  cover: null, metacritic: null,
  myLinks: ["", "", ""], tips: "", tag: "", infobox: null,
};

const estTexte = (v) => typeof v === "string";

// Une date exploitable, et pas seulement une chaîne. Le contrôle ne portait que
// sur le type : « pas une date » passait, puis `new Date()` en tirait un NaN qui
// remontait jusque dans les moyennes de l'onglet Stats — « NaN j » affiché
// comme une statistique. Un fichier bricolé à la main, un export tronqué, une
// version future du format suffisent à produire ce cas.
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const estDateISO = (v) => estTexte(v) && DATE_ISO.test(v) && !Number.isNaN(Date.parse(v));

// Une entrée d'historique venue d'un fichier : un nom et deux dates réelles.
const estEntreePret = (e) => !!e && typeof e === "object"
  && estTexte(e.a) && !!e.a.trim() && estDateISO(e.du) && estDateISO(e.au);

// Les valeurs qui alimentent des calculs ou des filtres ne peuvent pas être
// n'importe quoi : une plateforme inconnue n'apparaît dans aucun filtre et
// n'est pas rééditable, un format inventé n'est compté ni en physique ni en
// démat — les trois tuiles de l'onglet Collection cessent alors de s'additionner
// —, et une note en toutes lettres passe pour renseignée sans jamais compter.
// Elles sont ramenées à une valeur sûre plutôt que de faire rejeter le jeu :
// c'est le titre qui a de la valeur, le reste se recorrige.
const PLATEFORMES_ACCEPTEES = new Set([...PLATFORMES_JEU, "Xbox"]); // "Xbox" : ancien format, migrateGames tranche ensuite
const FORMATS = new Set(["physique", "démat"]);

function assainir(brut) {
  let corrige = false;
  const garder = (ok, valeur, defaut) => { if (ok) return valeur; corrige = true; return defaut; };

  const platform = garder(PLATEFORMES_ACCEPTEES.has(brut.platform), brut.platform, JEU_VIDE.platform);
  const format = garder(FORMATS.has(brut.format), brut.format, JEU_VIDE.format);
  const metacritic = garder(
    brut.metacritic == null || (typeof brut.metacritic === "number" && Number.isFinite(brut.metacritic) && brut.metacritic >= 0 && brut.metacritic <= 100),
    brut.metacritic ?? null, null,
  );
  const addedDate = garder(estDateISO(brut.addedDate), brut.addedDate, aujourdhuiISO());

  // Un prêt se mesure en jours : sans nom ou sans date valide, il n'est pas
  // « incomplet », il n'existe pas. Le laisser à moitié renseigné produit un
  // jeu marqué prêté dont la durée est NaN et que rien ne signale jamais.
  const pretValide = estTexte(brut.lentA) && !!brut.lentA.trim() && estDateISO(brut.lentDate);
  const lentA = pretValide ? brut.lentA.trim() : garder(!brut.lentA && !brut.lentDate, null, null);
  const lentDate = pretValide ? brut.lentDate : null;
  const lentRetourPrevu = !pretValide ? null
    : garder(brut.lentRetourPrevu == null || estDateISO(brut.lentRetourPrevu), brut.lentRetourPrevu ?? null, null);

  const historique = Array.isArray(brut.pretsPasses) ? brut.pretsPasses : [];
  const retenues = historique.filter(estEntreePret).slice(0, MAX_HISTORIQUE_PRET);
  if (retenues.length !== Math.min(historique.length, MAX_HISTORIQUE_PRET)) corrige = true;
  const pretsPasses = retenues.map(e => (estDateISO(e.prevu) ? e : { a: e.a, du: e.du, au: e.au }));

  return {
    corrige,
    champs: {
      platform, format, metacritic, addedDate, lentA, lentDate, lentRetourPrevu, pretsPasses,
      backCompat: typeof brut.backCompat === "boolean" ? brut.backCompat : undefined,
      cover: estTexte(brut.cover) && brut.cover.trim() ? brut.cover : null,
      infobox: brut.infobox && typeof brut.infobox === "object" && !Array.isArray(brut.infobox) ? brut.infobox : null,
    },
  };
}

export function validerJeuxImportes(data) {
  if (!Array.isArray(data)) return { jeux: null, rejetes: 0, corriges: 0 };

  const jeux = [];
  const idsVus = new Set();
  let rejetes = 0;
  let corriges = 0;

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

    const { corrige, champs } = assainir(brut);
    if (corrige) corriges++;

    jeux.push({
      ...JEU_VIDE,
      ...brut,
      ...champs,
      id,
      title: brut.title.trim(),
      genre: Array.isArray(brut.genre) ? brut.genre.filter(estTexte) : [],
      myLinks: Array.isArray(brut.myLinks) ? [0, 1, 2].map(i => (estTexte(brut.myLinks[i]) ? brut.myLinks[i] : "")) : ["", "", ""],
      style: estTexte(brut.style) ? brut.style : "",
      tips: estTexte(brut.tips) ? brut.tips : "",
      tag: estTexte(brut.tag) ? brut.tag : "",
    });
    // `backCompat: undefined` doit disparaître pour que la migration le décide.
    if (champs.backCompat === undefined) delete jeux[jeux.length - 1].backCompat;
  }
  return { jeux: migrateGames(jeux), rejetes, corriges };
}
