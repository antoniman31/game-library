// Lecture d'un export Playnite.
//
// Playnite est un gestionnaire de ludothèque PC (Windows, open source) qui sait
// lire Steam, Epic, GOG et Amazon depuis les clients installés, et télécharger
// les métadonnées d'IGDB. Écrire quatre intégrations ici aurait demandé une clé
// Steam, et rien du tout pour Epic, GOG et Amazon, qui n'ont pas d'API
// publique. Playnite fait ce travail sur le PC ; cette application lit son
// export.
//
// Ce module ne touche à rien : il lit un texte et rend trois listes — ce qui
// est nouveau, ce qui est déjà là, ce qui a été exclu — plus les lignes qu'il
// a écartées et pourquoi. L'écran d'import montre ça avant d'écrire quoi que
// ce soit ; c'est un import de cent lignes, il ne doit pas être une surprise.

import { PC, migrateGames, normTitle, normaliserGenres, modesDepuisNoms, infoboxVide, aujourdhuiISO, estDatePlausible,
  editionsDuJeu, completerDepuisEditions, libelleEdition, universDuJeu } from "./model.js";

// ── Ce que l'export contient ───────────────────────────────────────────────
//
// Deux formats sont acceptés, parce que deux outils produisent l'export :
//
//   1. le script PowerShell du README, qui écrit des objets plats en français
//      (`titre`, `boutique`, `genres`) ;
//   2. l'extension « Json Library Import Export », plus simple à installer,
//      qui sérialise les objets Playnite bruts — noms anglais capitalisés,
//      valeurs imbriquées (`Source: {Name}`, `Genres: [{Name}]`), date sous
//      la forme `{"ReleaseDate": "2010-10-21"}`.
//
// La seconde forme est ramenée à la première dès la lecture : tout le reste du
// module n'en connaît qu'une. Chaque champ est facultatif sauf le titre — une
// bibliothèque Playnite jamais enrichie n'a ni genres, ni éditeurs, ni
// description, et cet import doit quand même servir à quelque chose.

const texte = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const liste = (v) => (Array.isArray(v) ? v : [v]).map(texte).filter(Boolean);

// Une plateforme Playnite qui n'est pas celle d'un PC. Ses importateurs de
// consoles (PSN, Xbox) et ses jeux émulés partagent la même base que Steam :
// sans ce tri, l'import créerait des fiches « PC » pour des jeux Switch.
// La règle est permissive à dessein — « PC (Windows) », « Windows », « Linux »,
// « macOS » — et une ligne sans plateforme est prise pour un jeu PC, parce que
// c'est ce qu'est une bibliothèque Playnite par défaut.
const PLATEFORME_PC = /\b(pc|windows|linux|mac ?os|macintosh)\b/i;
export function estLignePC(plateformes) {
  const noms = liste(plateformes);
  return !noms.length || noms.some(n => PLATEFORME_PC.test(n));
}

// « 2017-3-3 » : Playnite sérialise ses dates sans zéro de tête, et tronque à
// l'année ou au mois quand il ne sait pas le jour. Seule une date complète et
// plausible peut servir de date d'ajout ; le reste ne se perd pas pour autant,
// il part dans la sortie de l'infobox telle quelle.
export function dateISOdepuisPlaynite(brut) {
  const m = texte(brut).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return estDatePlausible(iso) ? iso : "";
}

// Les descriptions d'IGDB arrivent en HTML. Les poser telles quelles dans la
// fiche afficherait « <p>Un jeu de… » en toutes lettres : React échappe le
// balisage, c'est heureux, mais il faut donc le retirer nous-mêmes.
const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#160": " " };
export function texteDepuisHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#?\w+);/g, (tout, nom) => (nom in ENTITES ? ENTITES[nom] : tout))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Les listes de l'export brut sont des objets nommés : `[{Id, Name}, …]`.
const nomsDe = (v) => (Array.isArray(v) ? v : []).map(x => texte(x?.Name)).filter(Boolean);

// La date de l'export brut. Playnite implémente `ISerializable` sur ce type,
// et la bibliothèque de sérialisation de l'extension en tire un objet à une
// seule clé — `{"ReleaseDate": "2010-10-21"}`. Une version future pourrait
// tout aussi bien écrire `{Year, Month, Day}` : les deux sont lues.
function dateBrute(v) {
  if (typeof v === "string") return texte(v);
  if (!v || typeof v !== "object") return "";
  if (typeof v.ReleaseDate === "string") return texte(v.ReleaseDate);
  if (Number.isFinite(v.Year)) {
    return [v.Year, v.Month, v.Day].filter(n => Number.isFinite(n)).join("-");
  }
  return "";
}

// Une description d'IGDB ou de Steam peut être un dossier de presse : la plus
// longue de la bibliothèque d'essai faisait 55 000 caractères, soit plus que
// tout le reste de la fiche réuni. On garde de quoi savoir ce qu'est le jeu,
// coupé à la fin d'une phrase pour ne pas laisser un mot tranché en deux.
export const DESCRIPTION_MAX = 900;
export function resumerDescription(t, max = DESCRIPTION_MAX) {
  const texteEntier = String(t || "");
  if (texteEntier.length <= max) return texteEntier;
  const debut = texteEntier.slice(0, max);
  const fin = Math.max(debut.lastIndexOf(". "), debut.lastIndexOf(".\n"));
  return (fin > max / 3 ? debut.slice(0, fin + 1) : debut.trimEnd()) + " […]";
}

// Une ligne de l'export brut prend la forme de celle du script maison. Le
// choix se fait sur `Name` : le script maison n'écrit que des clés en
// minuscules, l'export brut n'en écrit aucune.
function normaliserLigne(ligne) {
  if (ligne.titre !== undefined || ligne.Name === undefined) return ligne;
  return {
    titre: ligne.Name,
    boutique: ligne.Source?.Name || "",
    idBoutique: ligne.GameId,
    plateformes: nomsDe(ligne.Platforms),
    sortie: dateBrute(ligne.ReleaseDate),
    genres: nomsDe(ligne.Genres),
    developpeurs: nomsDe(ligne.Developers),
    editeurs: nomsDe(ligne.Publishers),
    series: nomsDe(ligne.Series),
    fonctionnalites: nomsDe(ligne.Features),
    description: ligne.Description,
  };
}

// ── L'identité d'une ligne ─────────────────────────────────────────────────
//
// Deux imports successifs doivent reconnaître le même jeu. Le titre ne suffit
// pas : « Resident Evil 4 » désigne deux jeux différents selon qu'il vient de
// Steam ou de GOG, et un titre se corrige à la main dans l'application. La
// référence de la boutique (l'appid Steam, par exemple) est stable et unique.
// Quand elle manque — un jeu ajouté à la main dans Playnite —, on retombe sur
// le titre normalisé, en le disant.
export function refImport({ boutique, refBoutique, titre }) {
  const b = normTitle(boutique) || "sans-boutique";
  const ref = texte(refBoutique);
  return ref ? `${b}#${ref}` : `${b}#t:${normTitle(titre)}`;
}

// ── Lecture du fichier ─────────────────────────────────────────────────────

const RAISONS = {
  sansTitre: "sans titre",
  console: "console ou émulé",
  doublon: "en double dans le fichier",
};

// Rend { entrees, ignorees, erreur }. Une erreur est un fichier qu'on ne peut
// pas lire du tout ; une ligne ignorée est un défaut local, qui n'empêche pas
// le reste d'entrer.
export function lirePlaynite(contenu) {
  let brut;
  try {
    brut = JSON.parse(String(contenu || ""));
  } catch {
    return { entrees: [], ignorees: [], erreur: "Fichier illisible : ce n'est pas du JSON." };
  }
  if (!Array.isArray(brut)) {
    return { entrees: [], ignorees: [], erreur: "Fichier inattendu : un tableau de jeux était attendu." };
  }

  const entrees = [];
  const ignorees = [];
  const vues = new Set();

  for (const ligneBrute of brut) {
    if (!ligneBrute || typeof ligneBrute !== "object") { ignorees.push({ titre: "(ligne vide)", raison: RAISONS.sansTitre }); continue; }
    const ligne = normaliserLigne(ligneBrute);
    const titre = texte(ligne.titre);
    if (!titre) { ignorees.push({ titre: "(sans titre)", raison: RAISONS.sansTitre }); continue; }
    if (!estLignePC(ligne.plateformes)) {
      ignorees.push({ titre, raison: RAISONS.console, detail: liste(ligne.plateformes).join(", ") });
      continue;
    }

    const entree = {
      titre,
      boutique: texte(ligne.boutique),
      refBoutique: texte(ligne.idBoutique),
      sortie: texte(ligne.sortie),
      genres: liste(ligne.genres),
      developpeurs: liste(ligne.developpeurs),
      editeurs: liste(ligne.editeurs),
      series: liste(ligne.series),
      modes: modesDepuisNoms(liste(ligne.fonctionnalites)),
      description: resumerDescription(texteDepuisHtml(ligne.description)),
    };
    entree.ref = refImport(entree);

    // Playnite lui-même peut porter deux fois le même jeu (le même titre chez
    // deux boutiques garde deux références, donc ne tombe pas ici).
    if (vues.has(entree.ref)) { ignorees.push({ titre, raison: RAISONS.doublon }); continue; }
    vues.add(entree.ref);
    entrees.push(entree);
  }

  return { entrees, ignorees, erreur: "" };
}

// ── Ce qu'une entrée deviendrait ───────────────────────────────────────────
//
// La date d'ajout reprend la date de sortie quand elle est complète, comme le
// fait déjà l'import Xbox : sur cent jeux achetés en solde, la date du jour
// n'apprendrait rien, et le tri par date deviendrait un tas.
export function jeuDepuisEntree(entree, aujourdhui = aujourdhuiISO()) {
  const info = {
    developers: entree.developpeurs,
    publishers: entree.editeurs,
    releases: entree.sortie ? [{ date: entree.sortie }] : [],
    modes: entree.modes,
    series: entree.series[0] || "",
    follows: "",
    followedBy: "",
  };
  return {
    title: entree.titre,
    platform: PC,
    boutique: entree.boutique,
    refBoutique: entree.refBoutique,
    addedDate: dateISOdepuisPlaynite(entree.sortie) || aujourdhui,
    genre: normaliserGenres(entree.genres),
    style: entree.description,
    cover: null,
    metacritic: null,
    infobox: infoboxVide(info) ? null : { ...info, sources: ["playnite"] },
  };
}

// ── Le tri avant écriture ──────────────────────────────────────────────────
//
// Trois sorts possibles pour une entrée : elle correspond à une fiche PC déjà
// présente, elle a été exclue explicitement, ou elle est nouvelle. Une fiche
// console du même titre n'est pas un doublon : posséder « Hades » sur Switch et
// sur Steam est un fait, et « Aussi sur » le dira sur les deux fiches.
export function analyserImport(entrees, { games = [], exclusions = [] } = {}, aujourdhui = aujourdhuiISO()) {
  const exclus = new Set(exclusions);
  // Les fiches PC déjà là, reconnues d'abord par leur référence de boutique,
  // à défaut par titre et boutique — c'est l'état d'une bibliothèque remplie
  // à la main avant que cet import existe.
  const parRef = new Map();
  for (const g of games) {
    if (g.platform !== PC) continue;
    parRef.set(refImport({ boutique: g.boutique, refBoutique: g.refBoutique, titre: g.title }), g);
    if (g.refBoutique) parRef.set(refImport({ boutique: g.boutique, refBoutique: "", titre: g.title }), g);
  }

  const nouveaux = [];
  const deja = [];
  const rejetes = [];
  for (const e of entrees) {
    const sansRef = refImport({ boutique: e.boutique, refBoutique: "", titre: e.titre });
    if (exclus.has(e.ref) || exclus.has(sansRef)) { rejetes.push(e); continue; }
    const existante = parRef.get(e.ref) || parRef.get(sansRef);
    if (existante) { deja.push({ ...e, idExistant: existante.id }); continue; }
    // Une fiche du même jeu ailleurs — sur console, ou chez une autre boutique
    // — remplira celle-ci sans réseau. Le dire avant l'import, pas après.
    const [jumelle] = editionsDuJeu({ id: null, title: e.titre }, games);
    nouveaux.push({
      ...e,
      jeu: jeuDepuisEntree(e, aujourdhui),
      jumelle: jumelle
        ? libelleEdition({
            platform: jumelle.platform,
            boutique: String(jumelle.boutique || "").trim(),
            univers: universDuJeu(jumelle),
          })
        : "",
    });
  }
  return { nouveaux, deja, exclus: rejetes };
}

// Les jeux prêts à entrer dans la bibliothèque. `migrateGames` pose les champs
// que le reste de l'application lit sans précaution (prêts, liens, bcV) et
// force le démat et l'absence de rétrocompatibilité qu'impose une fiche PC :
// les redire ici, c'est promettre de les mettre à jour deux fois.
export function jeuxAImporter(nouveaux, base = Date.now(), games = []) {
  const jeux = migrateGames(nouveaux.map((n, i) => ({ ...n.jeu, id: base + i })));
  // Une fiche qui existe déjà ailleurs a été remplie au fil des mois : sa
  // jaquette, sa description et sa note valent pour toutes ses éditions.
  // Les jeux importés se voient les uns les autres — deux boutiques pour un
  // même titre s'entraident si l'une des deux a quelque chose.
  const tous = [...jeux, ...games];
  return jeux.map(j => completerDepuisEditions(j, tous)?.jeu || j);
}
