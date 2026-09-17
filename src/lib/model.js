// Vocabulaire du domaine : plateformes, rétrocompatibilité, prêts, migration
// des jeux stockés.
// L'application suit un seul état : le jeu est-il chez moi, ou prêté ?
// La progression (terminé, en cours, platine…) était tenue en double avec la
// console, qui la connaît mieux ; elle a été retirée.
export const PRET_LONG_JOURS = 30;

// ── Deux univers ───────────────────────────────────────────────────────────
//
// Une console dit sur quelle machine le jeu tourne, et le format dit s'il est
// sur une galette ou dans un compte. Sur PC, la machine est toujours la même et
// ce qui distingue un jeu d'un autre est la boutique où il vit : Steam, Epic,
// GOG, et d'autres qu'on ne connaît pas encore.
//
// D'où « PC » comme plateforme et `boutique` comme champ à part, plutôt qu'une
// liste de plateformes « PC (Steam) », « PC (Epic) » qui mélangerait deux axes
// sans rapport — et qu'on paierait à chaque filtre, chaque statistique, chaque
// tri.
export const PC = "PC";

// ── La table des plateformes ───────────────────────────────────────────────
//
// Quatre plateformes tenaient dans un tableau de chaînes. Vingt-neuf, non :
// il faut savoir de quelle famille chacune relève, à quelle génération, et
// comment l'écrire court quand la place manque. C'est une table, et chaque
// colonne existe parce que quelque chose la lit.
//
// Deux mots pour deux choses, et il faut les tenir séparés :
//
//   - GÉNÉRATION (`actuelle` / `retro`) — l'âge de la machine. La coupure est
//     celle demandée : Xbox One, PS4 et Switch 1 sont actuelles, tout ce qui
//     est antérieur est rétro. La Switch 1 est de 2017, même génération que la
//     PS4 : elle ne bascule pas, aussi contre-intuitif que ça paraisse.
//   - RÉTROCOMPATIBILITÉ (`avecRetrocompatibles` plus bas) — un jeu d'une
//     machine jouable sur la suivante. Rien à voir, et le mot « rétro » les
//     confondait : c'est pourquoi le second porte désormais son nom entier.
//
// Les identifiants sont ceux déjà écrits dans les fiches : aucune des 288
// existantes n'a à être migrée. Et la console de 2001 s'appelle « Xbox
// originale », pas « Xbox » — `migrateGames` convertit encore l'ancien
// identifiant « Xbox » en Xbox One ou Series X selon la date, et lui donner ce
// nom ferait basculer en silence une vraie Xbox de 2001 vers une Xbox One.
export const FAMILLES = {
  nintendo: "Nintendo",
  xbox: "Xbox",
  playstation: "PlayStation",
  sega: "Sega",
  pc: "PC",
};

export const GENERATIONS = ["actuelle", "retro"];

// La couleur est écrite plateforme par plateforme plutôt que calculée depuis
// la famille : une teinte qu'on lit se corrige d'un coup d'œil, une teinte
// qu'on dérive demande d'exécuter la fonction dans sa tête. La règle qu'elles
// suivent, elle, tient en une ligne — teinte de la famille, et le rétro plus
// sourd que l'actuel.
export const PLATEFORMES = [
  // Actuelles
  { id: "Xbox Series X", court: "Series X", famille: "xbox", generation: "actuelle", couleur: "#107C10" },
  { id: "Xbox One", court: "Xbox One", famille: "xbox", generation: "actuelle", couleur: "#0a5c0a" },
  { id: "PS5", court: "PS5", famille: "playstation", generation: "actuelle", couleur: "#0b3d91" },
  { id: "PS4", court: "PS4", famille: "playstation", generation: "actuelle", couleur: "#082c6b" },
  { id: "Switch 2", court: "Switch 2", famille: "nintendo", generation: "actuelle", couleur: "#e4000f" },
  { id: "Switch 1", court: "Switch 1", famille: "nintendo", generation: "actuelle", couleur: "#b3000c" },
  { id: PC, court: "PC", famille: "pc", generation: "actuelle", couleur: "#4b5563" },

  // Rétro — Nintendo
  { id: "Wii U", court: "Wii U", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "Wii", court: "Wii", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "GameCube", court: "GameCube", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "Nintendo 64", court: "N64", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "Super Nintendo", court: "SNES", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "NES", court: "NES", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "Nintendo 3DS", court: "3DS", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "Nintendo DS", court: "DS", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "Game Boy Advance", court: "GBA", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },
  { id: "Game Boy", court: "Game Boy", famille: "nintendo", generation: "retro", couleur: "#8f4a4a" },

  // Rétro — Xbox
  { id: "Xbox 360", court: "Xbox 360", famille: "xbox", generation: "retro", couleur: "#3f6b3f" },
  { id: "Xbox originale", court: "Xbox", famille: "xbox", generation: "retro", couleur: "#3f6b3f" },

  // Rétro — PlayStation
  { id: "PlayStation 3", court: "PS3", famille: "playstation", generation: "retro", couleur: "#41557f" },
  { id: "PlayStation 2", court: "PS2", famille: "playstation", generation: "retro", couleur: "#41557f" },
  { id: "PlayStation", court: "PS1", famille: "playstation", generation: "retro", couleur: "#41557f" },
  { id: "PS Vita", court: "Vita", famille: "playstation", generation: "retro", couleur: "#41557f" },
  { id: "PSP", court: "PSP", famille: "playstation", generation: "retro", couleur: "#41557f" },

  // Rétro — Sega
  { id: "Dreamcast", court: "Dreamcast", famille: "sega", generation: "retro", couleur: "#3f7a99" },
  { id: "Saturn", court: "Saturn", famille: "sega", generation: "retro", couleur: "#3f7a99" },
  { id: "Mega Drive", court: "Mega Drive", famille: "sega", generation: "retro", couleur: "#3f7a99" },
  { id: "Master System", court: "Master System", famille: "sega", generation: "retro", couleur: "#3f7a99" },
  { id: "Game Gear", court: "Game Gear", famille: "sega", generation: "retro", couleur: "#3f7a99" },
];

const PAR_ID = new Map(PLATEFORMES.map(p => [p.id, p]));

// Une plateforme inconnue ne casse rien : une fiche importée d'ailleurs, ou
// écrite avant l'ajout d'une machine, garde son nom tel quel et se range en
// « actuelle ». Mieux vaut une fiche lisible qu'une fiche vide.
export const plateformeConnue = (id) => PAR_ID.get(id) || null;
export const nomCourt = (id) => PAR_ID.get(id)?.court || String(id || "");
export const generationDe = (id) => PAR_ID.get(id)?.generation || "actuelle";
export const familleDe = (id) => PAR_ID.get(id)?.famille || null;
export const nomFamille = (id) => FAMILLES[familleDe(id)] || "";

export const UNIVERS = ["console", "pc"];
export const estPC = (g) => g?.platform === PC;
export const universDuJeu = (g) => (estPC(g) ? "pc" : "console");
export const jeuDansUnivers = (g, univers) => universDuJeu(g) === univers;

// La boutique n'est pas une liste fermée, contrairement aux plateformes.
// Personne ne sait aujourd'hui lesquelles seront là dans un an — Ubisoft
// Connect, EA App, Battle.net, itch.io — et une liste écrite dans le code
// demanderait une modification pour chaque nouvelle. Elle est donc dérivée de
// la bibliothèque, comme les genres, et classée par nombre de jeux.
export function boutiquesPresentes(games) {
  const compte = new Map();
  for (const g of games || []) {
    if (!estPC(g)) continue;
    const b = String(g.boutique || "").trim();
    if (b) compte.set(b, (compte.get(b) || 0) + 1);
  }
  return [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
}

// Les plateformes du filtre ne sont pas les vingt-neuf de la table.
//
// Vingt-neuf entrées dans un filtre seraient vingt-cinq lignes vides pour qui
// possède quatre consoles. C'est la règle que les genres et les boutiques
// suivent déjà : on propose ce qu'on possède. Les vingt-neuf ne servent qu'au
// menu d'ajout, où il faut bien pouvoir choisir une machine avant d'avoir un
// jeu dessus.
//
// L'ordre de la table est conservé plutôt que celui du nombre de jeux : le
// filtre d'une bibliothèque de collectionneur doit rester au même endroit d'une
// fois sur l'autre, alors qu'une boutique qui monte peut bouger.
export function plateformesPresentes(games, univers = "console") {
  const vues = new Set();
  for (const g of games || []) {
    if (universDuJeu(g) !== univers) continue;
    if (g?.platform) vues.add(g.platform);
  }
  const connues = PLATEFORMES.filter(p => vues.has(p.id)).map(p => p.id);
  // Une plateforme inconnue de la table — fiche importée, machine pas encore
  // ajoutée — se filtre quand même : l'ignorer rendrait ces jeux
  // inatteignables.
  const inconnues = [...vues].filter(id => !PAR_ID.has(id)).sort((a, b) => a.localeCompare(b, "fr"));
  return [...connues, ...inconnues];
}

export const jeuDeLaBoutique = (g, boutique) =>
  boutique === "tous" || String(g?.boutique || "").trim() === boutique;

// Dérivée de la table : une couleur ne s'écrit qu'à un seul endroit.
export const PLATFORM_COLORS = Object.fromEntries(PLATEFORMES.map(p => [p.id, p.couleur]));

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
//
// Trois de plus, retirés pour une raison différente : ils étaient écrits,
// lisibles, éditables — et vides. Mesuré sur la bibliothèque réelle de 288
// fiches : `myLinks` valait `["","",""]` partout, soit 864 champs de lien dont
// pas un seul rempli ; `tips`, la zone « Notes & tips perso », 0 sur 288 ; et
// `tag` ne portait qu'une valeur, `eshop-import`, posée par un import et par
// personne. Un champ que personne ne remplit ne répond à aucune question qu'on
// se pose — il occupe l'écran de l'édition, l'export et la synchronisation.
const CHAMPS_RETIRES = ["status", "playedMinutes", "manualMinutes", "sessions", "hltb", "note", "progression",
  "myLinks", "tips", "tag"];

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
    // La boutique n'a de sens que sur PC, mais le champ existe partout : un
    // champ absent est lu `undefined` par les composants, et une fiche console
    // qui basculerait en PC n'aurait rien où écrire.
    if (typeof ng.boutique !== "string") ng.boutique = "";
    // L'identifiant du jeu chez sa boutique (l'appid Steam, par exemple), posé
    // par l'import Playnite et par lui seul. Il est ce qui permet de retrouver
    // une fiche à l'import suivant sans se fier au titre : deux éditions d'un
    // même jeu portent le même titre, jamais la même référence.
    if (typeof ng.refBoutique !== "string") ng.refBoutique = "";
    // Une fiche que toutes les sources ont refusé de noter. Sans ce champ, les
    // sept jeux de 1994 de la bibliothèque resteraient éternellement dans
    // « À compléter → Note » : un travail qui ne finit jamais parce qu'il n'a
    // pas d'objet — Metacritic n'existait pas encore.
    if (typeof ng.noteAbsente !== "boolean") ng.noteAbsente = false;
    // La série, débarrassée de ce qui n'en est pas une.
    if (ng.infobox?.series) {
      const serie = sansBalisageWiki(ng.infobox.series);
      const gardee = estNomDeStudio(serie, ng.infobox) ? "" : serie;
      if (gardee !== ng.infobox.series) ng.infobox = { ...ng.infobox, series: gardee };
    }
    if (typeof ng.metacritic === "number") ng.noteAbsente = false;
    // Un jeu PC est toujours démat, et n'est jamais rétrocompatible : ces deux
    // champs répondent à des questions de console.
    if (ng.platform === PC) { ng.format = "démat"; ng.backCompat = false; }
    if (!Array.isArray(ng.pretsPasses)) ng.pretsPasses = [];
    // `genre` est lu sans précaution à chaque rendu de la liste
    // (`g.genre.some(...)`) : absent d'un enregistrement écrit par une version
    // ancienne, il fait échouer le premier rendu et l'application entière tombe
    // sur son garde-fou d'erreurs. Cette fonction existe pour rendre sûr ce qui
    // vient du stockage.
    ng.genre = normaliserGenres(ng.genre);
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
//
// Une date qui n'est pas plausible rend null, elle aussi. Illisible, elle
// produisait un NaN que l'onglet Prêts affichait tel quel — « NaNj » présenté
// comme une durée, alors qu'un commentaire de l'application affirmait déjà que
// cette fonction s'en gardait. Lisible mais impossible, elle donnait pire : un
// « 739866 j » qui a l'air d'un nombre. L'import refuse déjà ces prêts-là ;
// cette fonction applique la même règle sur ce qui est déjà en place.
export function joursDePret(g) {
  if (!g.lentA || !estDatePlausible(g.lentDate)) return null;
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

// Une entrée dont les dates sont illisibles vaut zéro jour plutôt que NaN :
// un NaN se propage dans toutes les moyennes de l'onglet Stats et les rend
// toutes illisibles, là où un zéro ne fausse que sa propre ligne. L'audit des
// données signale l'entrée fautive, c'est son travail.
export const dureeEntreeHistorique = (e) => {
  if (!estDatePlausible(e?.du) || !estDatePlausible(e?.au)) return 0;
  return Math.max(0, Math.round((new Date(e.au) - new Date(e.du)) / 86400000));
};

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

// Les filtres, nommés une fois pour toutes.
//
// Trois endroits les remettaient à zéro, chacun avec sa propre énumération :
// le bouton « Réinitialiser » du panneau, l'ajout d'un jeu et l'import Xbox.
// Les deux derniers n'en citaient que trois — ceux qui existaient le jour où
// ils ont été écrits — si bien qu'ajouter un jeu depuis une liste filtrée par
// série le faisait entrer dans la bibliothèque sans l'afficher. Il avait l'air
// supprimé ; il était caché par un filtre que personne n'avait songé à lever.
//
// Une seule liste, donc, et un test qui vérifie que la remise à zéro les couvre
// tous : le prochain filtre ajouté ne pourra plus être oublié en silence.
export const FILTRES = ["plat", "genFil", "pretFil", "fmtFil", "genreFil", "modeFil", "noteFil", "completFil", "serieFil",
  "boutiqueFil"];

export const FILTRES_VIDES = Object.freeze(Object.fromEntries(FILTRES.map(f => [f, "tous"])));

// Compte les filtres réellement appliqués. Le tri et le mode d'affichage n'en
// sont pas : ils changent l'ordre ou la densité, jamais ce qui est montré.
export function compterFiltres(etat) {
  return FILTRES.map(f => etat?.[f]).filter(v => v && v !== "tous").length;
}

// ── Genres ─────────────────────────────────────────────────────────────────
// Les genres viennent de deux endroits qui ne parlent pas la même langue : la
// bibliothèque de départ, écrite à la main en français (Aventure, Plateforme,
// Course, Furtif), et RAWG, qui répond en anglais. Sur une bibliothèque réelle
// de 154 jeux, ça donnait 33 valeurs dont la moitié en double :
//
//   Adventure 21 · Aventure 20    Platformer 16 · Plateforme 17
//   Racing 10 · Course 6          Sports 2 · Sport 4
//
// Un filtre par genre — le premier auquel on pense — aurait coupé la
// bibliothèque en deux moitiés arbitraires selon la source qui a répondu la
// première. Aucune fiche ne portait les deux formes : chacune tenait ses genres
// d'une seule source, ce qui rend la fusion sûre.
//
// Le français est la forme de référence parce que c'est celle du projet, pas
// parce qu'elle est plus juste. La table se lit et se corrige d'un coup d'œil :
// c'est un choix de vocabulaire, pas un algorithme.
// Le vocabulaire du projet : la forme exacte sous laquelle chaque genre
// s'affiche et se filtre. Saisi autrement — « aventure », « ADVENTURE » — un
// genre est ramené à sa forme d'ici. Sans cette liste, un genre tapé en
// minuscules restait en minuscules et se comptait à part.
const GENRES_CONNUS = [
  "Action", "Aventure", "Plateforme", "Course", "Combat", "Sport", "Stratégie",
  "Horreur", "Puzzle", "RPG", "Simulation", "Arcade", "Furtif", "Exploration",
  "Multijoueur", "Open World", "Indie", "Shooter", "FPS", "TPS", "Beat'em up",
  "Soulslike", "Musou", "Jeu de société", "Créatif", "Vie",
  "Massivement multijoueur", "Action-aventure", "Occasionnel", "Tactique", "Famille", "Autre",
];

// Ce que RAWG répond en anglais, et la forme du projet en face.
//
// Playnite ajoute une difficulté : il répond dans la langue de son interface,
// mais ses sources ne sont pas toutes traduites. Un même export porte donc
// « Indépendant » et « Indie », « Course automobile » et « Racing », « Jeux de
// rôles » et « RPG » — le doublon franco-anglais qu'on avait déjà réglé pour
// RAWG, revenu par une autre porte. La table s'élargit plutôt que de laisser
// le filtre par genre couper la bibliothèque en deux.
const SYNONYMES_GENRE = {
  adventure: "Aventure",
  platformer: "Plateforme",
  platform: "Plateforme",
  racing: "Course",
  courseautomobile: "Course",
  courseetpilotage: "Course",
  sports: "Sport",
  fighting: "Combat",
  strategy: "Stratégie",
  realtimestrategyrts: "Stratégie",
  horror: "Horreur",
  independant: "Indie",
  simulator: "Simulation",
  roleplayingrpg: "RPG",
  jeuxderoles: "RPG",
  jeuxdetir: "Shooter",
  actionetaventure: "Action-aventure",
  actionadventure: "Action-aventure",
  massivelymultiplayer: "Massivement multijoueur",
  massivelymultiplayeronlineroleplaying: "Massivement multijoueur",
  familleetenfants: "Famille",
  family: "Famille",
  cardboardgame: "Jeu de société",
  boardgame: "Jeu de société",
  tactical: "Tactique",
  casual: "Occasionnel",
  autres: "Autre",
  // « Puzzle » et « Réflexion » cohabitaient dans les seules données de départ,
  // sans qu'aucune source n'impose l'un ou l'autre. « Puzzle » l'emporte parce
  // que c'est la forme que RAWG renvoie et la seule des deux qu'on trouve dans
  // une bibliothèque réelle.
  reflexion: "Puzzle",
};

// Ce que Steam range parmi les genres sans que ce soit un genre de jeu.
// L'export Playnite d'une bibliothèque réelle en a ramené sept : ils décrivent
// un logiciel (Wallpaper Engine est un utilitaire), un modèle économique ou un
// stade de développement, jamais une manière de jouer. Les garder remplissait
// le filtre par genre de rubriques sous lesquelles on ne cherche jamais.
//
// Ils sont écartés à la lecture, pas seulement à l'import : la migration
// rejoue `normaliserGenres` à chaque chargement, donc les fiches déjà en place
// se nettoient toutes seules.
const GENRES_ECARTES = new Set([
  "utilitaires", "utilities",
  "retouchephoto", "photoediting",
  "productionvideo", "videoproduction",
  "animationmodelisation", "animationmodeling",
  "conceptionillustration", "designillustration",
  "accesanticipe", "earlyaccess",
  "freetoplay",
]);

// Clé de comparaison d'un genre : minuscules, sans accents, sans ponctuation.
// « aventure », « Aventure » et « AVENTURE » sont le même genre — saisis à la
// main, ils produisaient trois entrées distinctes dans les filtres.
const cleGenre = (v) => String(v || "").toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").trim();

const FORMES_GENRE = new Map([
  ...GENRES_CONNUS.map(v => [cleGenre(v), v]),
  ...Object.entries(SYNONYMES_GENRE),
]);

// Ramène une liste de genres à la forme de référence, sans doublon et dans
// l'ordre d'origine. Idempotente : l'appliquer deux fois ne change rien, donc
// elle n'a pas besoin d'un numéro de version comme la migration `bcV`.
export function normaliserGenres(liste) {
  if (!Array.isArray(liste)) return [];
  const sortie = [];
  const vues = new Set();
  for (const brut of liste) {
    if (typeof brut !== "string") continue;
    const nettoye = brut.trim();
    if (!nettoye) continue;
    const cle = cleGenre(nettoye);
    if (!cle || vues.has(cle) || GENRES_ECARTES.has(cle)) continue;
    const canonique = FORMES_GENRE.get(cle);
    // Un genre qu'on ne connaît pas garde sa forme : la table corrige les
    // doublons connus, elle n'impose pas un vocabulaire fermé.
    const valeur = canonique || nettoye;
    const cleFinale = cleGenre(valeur);
    if (vues.has(cleFinale)) continue;
    vues.add(cle);
    vues.add(cleFinale);
    sortie.push(valeur);
  }
  return sortie;
}

// ── Note, complétude, sortie ───────────────────────────────────────────────

// Un seuil plutôt que des tranches : la question n'est pas « lesquels sont
// entre 80 et 89 » mais « qu'est-ce que j'ai de vraiment bien ».
export const SEUILS_NOTE = [90, 80, 70];

// Le filtre répond aussi à la question inverse — « lesquels n'ont pas de note ».
// « À compléter → Note » ne les montre plus tous depuis qu'une fiche peut être
// réglée sans note connue, et il fallait bien un moyen de les revoir.
export const SANS_NOTE = "sans";
export const jeuPasseSeuil = (g, seuil) => {
  if (seuil === "tous") return true;
  if (seuil === SANS_NOTE) return !g.metacritic;
  return typeof g.metacritic === "number" && g.metacritic >= Number(seuil);
};

// ── Provenance et fusion des infobox ───────────────────────────────────────
//
// Deux sources décrivent désormais une fiche, et elles ne décrivent pas tout à
// fait la même chose. Wikipédia range un remaster sous la page du jeu
// d'origine : « Sonic The Hedgehog » y sort en 1991, quelle que soit la
// compilation qu'on possède. RAWG, lui, a une entrée par édition, avec la date
// de celle qu'on a achetée, mais ses éditeurs et développeurs sont d'une base
// communautaire, moins sûre sur les vieux titres.
//
// D'où la règle : une source ne remplit que les champs vides et n'écrase
// jamais. Passer RAWG puis Wikipédia sur un remaster garde la date de la
// version possédée et complète le reste. Et pour repartir d'une base propre
// quand le mélange a mal tourné, il y a le vidage.
export const SOURCES_INFO = { wikidata: "Wikidata", rawg: "RAWG", playnite: "IGDB (via Playnite)" };

// Une infobox sans provenance vient de Wikidata : c'était la seule source
// jusqu'ici, et les cent trente fiches déjà remplies n'ont pas à mentir.
export function sourcesInfobox(info) {
  if (!info) return [];
  const connues = (Array.isArray(info.sources) ? info.sources : []).filter(x => SOURCES_INFO[x]);
  return connues.length ? [...new Set(connues)] : ["wikidata"];
}

export const libelleSources = (info) =>
  sourcesInfobox(info).map(s => SOURCES_INFO[s]).join(" et ");

// ── Hygiène de la série ────────────────────────────────────────────────────
//
// Deux saletés arrivent des sources et se voient dans le filtre par série :
// le balisage wiki d'un titre — « \'\'Half-Life\'\' », apostrophes comprises — et
// le nom d'un studio pris pour une série, « AmplitudeStudios » sur un jeu
// d'AMPLITUDE Studios. Les deux se nettoient sans rien savoir de la source,
// donc à la lecture : la migration les rattrape sur les fiches déjà là.
export const sansBalisageWiki = (s) => String(s || "").replace(/''+/g, "").replace(/\[\[|\]\]/g, "").trim();

// Une clé qui ignore la ponctuation ET les espaces : « AmplitudeStudios » et
// « AMPLITUDE Studios » sont le même nom écrit deux fois.
const cleNom = (v) => normTitle(v).replace(/ /g, "");

// Les formes juridiques. Une série ne s'appelle jamais « Inc. » : c'est la fin
// d'un nom d'entreprise dont le début s'est perdu en route. Playnite range
// « Plague Inc: Evolved » sous deux séries, « Plague Inc. » et « Inc. », et
// rien ne dit laquelle est la bonne — sauf que celle-ci n'en est pas une.
//
// La liste s'arrête aux formes juridiques, qui ne désignent jamais rien
// d'autre. « Games », « Studios » ou « Entertainment » terminent des noms de
// studio mais peuvent aussi porter une vraie franchise, et les écarter seuls
// coûterait plus qu'ils ne rapportent.
const FORMES_JURIDIQUES = new Set([
  "inc", "ltd", "llc", "llp", "gmbh", "sa", "sarl", "sas", "co", "corp",
  "corporation", "plc", "ab", "oy", "bv", "nv", "pty", "srl", "spa", "kk",
]);

// Les mots qui terminent un nom de studio. Ils ne suffisent pas à condamner
// une série — c'est leur combinaison avec une abréviation qui le fait.
const SUFFIXES_STUDIO = new Set([
  "games", "studio", "studios", "entertainment", "interactive", "software",
  "productions", "digital", "media", "works", "arts",
]);

// « WB Games » est-il le nom du studio « Warner Bros. Games » ?
//
// Les deux désignent la même entreprise sans se ressembler assez pour être
// rapprochés caractère à caractère. Mais ils partagent leur dernier mot, qui
// est un suffixe de studio, et ce qui précède est d'un côté les initiales de
// l'autre : « WB » pour « Warner Bros. ». Cette double condition est ce qui
// rend la règle sûre — un suffixe partagé seul écarterait « Hunger Games »
// d'un éditeur nommé « X Games », des initiales seules écarteraient n'importe
// quel sigle.
function estAbreviationDe(serie, studio) {
  const a = normTitle(serie).split(" ").filter(Boolean);
  const b = normTitle(studio).split(" ").filter(Boolean);
  if (a.length < 2 || b.length < 2) return false;
  const suffixe = a[a.length - 1];
  if (suffixe !== b[b.length - 1] || !SUFFIXES_STUDIO.has(suffixe)) return false;
  // Le sigle est écrit collé (« wb ») ou espacé (« w b ») : on le compare aux
  // initiales des mots qu'il remplace.
  const sigle = a.slice(0, -1).join("");
  const initiales = b.slice(0, -1).map(m => m[0]).join("");
  return sigle.length > 1 && sigle === initiales;
}

export function estNomDeStudio(serie, info) {
  const cle = cleNom(serie);
  if (!cle) return false;
  // Une forme juridique seule n'est le nom de personne, studio compris : elle
  // n'a pas besoin d'un studio à qui se comparer pour être écartée.
  if (FORMES_JURIDIQUES.has(normTitle(serie).replace(/ /g, ""))) return true;
  const studios = [...(info?.developers || []), ...(info?.publishers || [])];
  return studios.some(x => cleNom(x) === cle || estAbreviationDe(serie, x));
}

const LISTES_INFO = ["developers", "publishers", "releases", "modes"];
const TEXTES_INFO = ["series", "follows", "followedBy"];

const listeInfo = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const texteInfo = (v) => String(v || "").trim();

// Deux infobox qui disent la même chose. `fusionnerInfobox` rend toujours un
// objet neuf, même quand elle n'a rien rempli : comparer les références fait
// donc croire à un apport à chaque passage — une fiche « complétée » qui se
// représente indéfiniment, et un compteur qui ne descend jamais.
export function memeInfobox(a, b) {
  if (!a || !b) return a === b;
  return LISTES_INFO.every(c => JSON.stringify(listeInfo(a[c])) === JSON.stringify(listeInfo(b[c])))
    && TEXTES_INFO.every(c => texteInfo(a[c]) === texteInfo(b[c]));
}

export const infoboxVide = (info) =>
  !info || (LISTES_INFO.every(c => !listeInfo(info[c]).length) && TEXTES_INFO.every(c => !texteInfo(info[c])));

// Complète sans écraser. La source n'est inscrite dans la provenance que si
// elle a effectivement rempli quelque chose : dire « et RAWG » sur une fiche où
// RAWG n'a rien apporté serait une fausse piste au moment de démêler une date.
export function fusionnerInfobox(existante, apport, source) {
  if (infoboxVide(apport)) return existante || null;
  const base = existante || {};
  const fusion = {};
  let aRempli = false;
  for (const c of LISTES_INFO) {
    const deja = listeInfo(base[c]);
    const neuf = listeInfo(apport[c]);
    if (!deja.length && neuf.length) aRempli = true;
    fusion[c] = deja.length ? deja : neuf;
  }
  for (const c of TEXTES_INFO) {
    const deja = texteInfo(base[c]);
    const neuf = texteInfo(apport[c]);
    if (!deja && neuf) aRempli = true;
    fusion[c] = deja || neuf;
  }
  if (infoboxVide(fusion)) return null;
  const sources = existante ? sourcesInfobox(existante) : [];
  // `source` accepte une liste : ce qui vient d'une autre édition du même jeu
  // porte la provenance de cette édition-là, qui peut en compter deux.
  const apportees = (Array.isArray(source) ? source : [source]).filter(x => SOURCES_INFO[x]);
  fusion.sources = aRempli && apportees.length ? [...new Set([...sources, ...apportees])] : sources;
  if (!fusion.sources.length) fusion.sources = ["wikidata"];
  return fusion;
}

// Le détail RAWG que la fiche demandait déjà pour la jaquette et la note
// contient aussi de quoi bâtir une infobox : on cessait simplement de le lire.
// Une seule date de sortie, celle de l'édition — c'est moins riche que les
// dates par plateforme de Wikidata, et c'est justement ce qu'on venait
// chercher pour un remaster.
// Les tags de RAWG sont en anglais, les « features » de Playnite suivent la
// langue de l'application — la bibliothèque réelle porte « Solo » 130 fois et
// « Single Player » 17 fois, dans le même export. Les deux langues sont donc
// dans la même table, sans quoi le filtre par mode ne verrait qu'une partie
// des jeux.
const MODES_CONNUS = [
  [/^single[- ]?player$/i, "solo"],
  [/^solo$/i, "solo"],
  [/^multi[- ]?player/i, "multijoueur"],
  [/^multijoueur/i, "multijoueur"],
  // « Coopération », « Coopération En Ligne », « Co-op » : le même mode.
  [/co[- ]?op/i, "coopératif"],
];

// Solo, multijoueur, coopératif : la même table sert aux tags RAWG et aux
// « features » de Playnite, qui les nomment pareil. Deux tables pour trois
// modes finiraient par diverger, et le filtre par mode ne verrait plus qu'une
// moitié de la bibliothèque.
export function modesDepuisNoms(noms) {
  const modes = [];
  for (const nom of (Array.isArray(noms) ? noms : [])) {
    for (const [regle, libelle] of MODES_CONNUS) {
      if (regle.test(String(nom || "").trim()) && !modes.includes(libelle)) modes.push(libelle);
    }
  }
  return modes;
}

export function infoboxDepuisRawg(detail) {
  if (!detail || typeof detail !== "object") return null;
  const noms = (liste) => (Array.isArray(liste) ? liste : []).map(x => String(x?.name || "").trim()).filter(Boolean);
  const modes = modesDepuisNoms(noms(detail.tags));
  const info = {
    developers: noms(detail.developers), publishers: noms(detail.publishers),
    releases: estDateISO(detail.released) ? [{ date: detail.released }] : [],
    modes, series: "", follows: "", followedBy: "",
  };
  return infoboxVide(info) ? null : { ...info, sources: ["rawg"] };
}

// ── Vider une fiche ────────────────────────────────────────────────────────
// Puisque les sources ne s'écrasent plus, il faut un moyen de repartir propre :
// sans lui, une infobox fausse resterait fausse, chaque nouvelle source la
// respectant poliment.
export const CHAMPS_VIDABLES = [
  ["infobox", "Infos Wikidata / RAWG", null],
  ["style", "Description", ""],
  ["cover", "Jaquette", null],
  ["metacritic", "Note", null],
  ["genre", "Genres", []],
];

// Retourne les champs à écrire, et seulement ceux que la fiche a vraiment.
// Cocher « Note » sur un jeu sans note ne doit pas compter comme un vidage.
export function viderChamps(g, choisis) {
  const vides = {};
  for (const [cle, , valeur] of CHAMPS_VIDABLES) {
    if (!choisis?.includes(cle)) continue;
    if (!jeuACompleter(g, cle)) vides[cle] = Array.isArray(valeur) ? [] : valeur;
  }
  return vides;
}

// ── Le même jeu, ailleurs ──────────────────────────────────────────────────
//
// Un jeu possédé deux fois — sur console et sur PC, ou sur deux consoles — a
// deux fiches, et rien ne les reliait. L'information existait pourtant déjà :
// deux titres identiques une fois normalisés, c'est le même jeu.
//
// Rien n'est stocké, tout se déduit à la lecture, comme les modes de jeu. Un
// lien enregistré entre deux fiches devrait être tenu à jour, et il finirait
// par mentir : supprimer la version PC laisserait une console qui prétend
// l'avoir. Ici, la mention disparaît d'elle-même.
//
// La correspondance est exacte sur le titre normalisé, jamais approximative.
// « GTA V » et « Grand Theft Auto V » ne se rejoindront pas — c'est un manque
// silencieux, qu'on corrige en harmonisant les titres. L'inverse, un
// rapprochement à la louche, produirait des affirmations fausses sur ce qu'on
// possède, et la règle des séries de l'audit a montré ce que ça vaut.
// Les autres fiches du même jeu, en entier. `autresEditions` n'en garde que de
// quoi afficher une pastille ; la complétion, elle, a besoin des fiches.
export function editionsDuJeu(jeu, games) {
  const cle = normTitle(jeu?.title);
  if (!cle) return [];
  return (games || []).filter(g => g.id !== jeu.id && normTitle(g.title) === cle);
}

export function autresEditions(jeu, games) {
  return editionsDuJeu(jeu, games)
    .map(g => ({ id: g.id, platform: g.platform, boutique: String(g.boutique || "").trim(), univers: universDuJeu(g) }))
    .sort((a, b) => a.platform.localeCompare(b.platform, "fr"));
}

// « Aussi sur PC · Steam », « Aussi sur Xbox Series X ». La boutique n'est dite
// que sur PC, où elle est ce qui distingue une édition d'une autre ; sur
// console, le nom de la machine suffit.
// ── Le même jeu chez deux boutiques ────────────────────────────────────────
//
// Sur PC, la boutique est ce qui distingue une édition d'une autre — mais
// posséder Borderlands 2 sur Steam ET sur Epic ne donne pas deux jeux à jouer,
// seulement deux façons de le lancer. Neuf titres sur cent quatre-vingts
// occupaient ainsi deux cartes voisines, identiques jusqu'à la jaquette.
//
// Rien n'est supprimé ni fusionné : la fiche cachée garde sa référence de
// boutique, donc la liste des écartés et les prochains imports continuent de
// la reconnaître. C'est une règle d'affichage, et elle ne vaut que côté PC —
// sur console, deux fiches du même titre sont deux machines différentes, donc
// deux objets qu'on possède vraiment.
//
// La carte gardée est la plus complète : celle qui a la jaquette et la
// description, pas celle qui est arrivée la première. À égalité, l'ordre de la
// bibliothèque tranche, pour que deux affichages successifs montrent la même.
// Un champ qui n'a rien à dire : la liste vide, la note absente, le texte
// blanc. Sert à mesurer ce qu'une fiche porte, ici comme à la complétion.
const champVide = (g, champ) => {
  const v = g?.[champ];
  if (champ === "genre") return !Array.isArray(v) || !v.length;
  if (champ === "metacritic") return typeof v !== "number";
  return !String(v || "").trim();
};

const REMPLIS = ["cover", "style", "metacritic", "genre", "infobox"];
const completude = (g) => REMPLIS.filter(c => !champVide(g, c)).length;

export function masquerDoublons(liste) {
  const gardees = new Map();
  for (const g of liste || []) {
    const cle = normTitle(g.title);
    if (!cle) { gardees.set(g.id, g); continue; }
    const deja = gardees.get(cle);
    if (!deja || completude(g) > completude(deja)) gardees.set(cle, g);
  }
  const retenus = new Set([...gardees.values()].map(g => g.id));
  return (liste || []).filter(g => retenus.has(g.id));
}

// L'appid Steam du jeu, cherché sur la fiche puis sur ses autres éditions.
//
// « Age of Mythology: Retold » est ici une fiche Xbox, sans appid — mais la
// même bibliothèque en tient une seconde, achetée sur Steam, qui en a un. Le
// jeu est le même : son numéro Steam vaut pour les deux.
export function appidSteam(jeu, games) {
  for (const g of [jeu, ...editionsDuJeu(jeu, games)]) {
    const ref = String(g?.refBoutique || "").trim();
    if (normTitle(g?.boutique) === "steam" && /^\d+$/.test(ref)) return ref;
  }
  return "";
}

// ── Ce qu'une édition peut donner à une autre ──────────────────────────────
//
// Posséder « Forza Horizon 5 » sur Xbox et sur PC, c'est avoir deux fiches pour
// un seul jeu : même jaquette, même description, même note, mêmes genres. La
// première a été remplie par Wikipédia et RAWG au fil des mois ; la seconde
// arrive nue d'un import Playnite, et rien ne justifie de retourner interroger
// le réseau pour ce qui est déjà là, à trois lignes de distance.
//
// Ne se partage que ce qui décrit LE JEU. Ce qui décrit l'ÉDITION reste à elle
// — la date d'ajout, la plateforme, la boutique, le format, les prêts, les
// liens et les notes personnelles. Et la règle habituelle vaut ici comme
// ailleurs : on ne remplit que le vide, on n'écrase jamais.
// Les épisodes qu'une fiche cite, et ce que la bibliothèque en a.
//
// Chaque fiche sait déjà nommer l'épisode qui la précède et celui qui la suit —
// Wikidata le donne, la fiche le stocke, l'infobox le récite. Personne ne
// rapprochait jamais ces noms de ce qui est réellement possédé. Or sur la
// bibliothèque d'aujourd'hui, dix-neuf titres cités par les fiches n'y sont
// pas : Halo 2, Gears of War 2, Red Dead Redemption.
//
// L'égalité est stricte, sur le titre normalisé, et ce n'est pas un détail :
// une comparaison par inclusion conclurait qu'on possède *Red Dead Redemption*
// parce qu'on a *Red Dead Redemption 2*, ce qui est exactement le contraire de
// ce qu'on cherche à dire.
//
// La limite, qu'il vaut mieux écrire que découvrir : un jeu possédé sous un
// autre titre que celui cité — l'anglais contre le français — sera annoncé
// absent à tort. C'est pourquoi la fiche le mentionne discrètement au lieu de
// l'affirmer, et pourquoi il n'y a pas de compteur qui en ferait une corvée.
//
// Reçoit l'ensemble des titres possédés, déjà normalisés : construit une fois
// pour la liste entière plutôt qu'une fois par fiche.
export function episodesCites(jeu, titresPossedes) {
  const cite = (brut) => {
    const titre = String(brut || "").trim();
    if (!titre) return null;
    return { titre, possede: !!titresPossedes?.has(normTitle(titre)) };
  };
  return {
    precedent: cite(jeu?.infobox?.follows),
    suivant: cite(jeu?.infobox?.followedBy),
  };
}

export const CHAMPS_PARTAGES = [
  ["cover", "jaquette"],
  ["style", "description"],
  ["metacritic", "note"],
  ["genre", "genres"],
];

// Rend { jeu, champs } quand quelque chose a été repris, sinon null. Les champs
// sont nommés pour pouvoir le dire à l'écran : « jaquette et description »
// vaut mieux que « 2 champs ».
export function completerDepuisEditions(jeu, games) {
  const editions = editionsDuJeu(jeu, games);
  if (!editions.length) return null;

  const nouveau = { ...jeu };
  const champs = [];
  for (const [champ, libelle] of CHAMPS_PARTAGES) {
    if (!champVide(nouveau, champ)) continue;
    // La première édition qui a la réponse : les fiches sont parcourues dans
    // l'ordre de la bibliothèque, donc le résultat ne dépend pas du hasard.
    const donneuse = editions.find(g => !champVide(g, champ));
    if (!donneuse) continue;
    nouveau[champ] = champ === "genre" ? [...donneuse.genre] : donneuse[champ];
    champs.push(libelle);
  }

  // L'infobox suit sa propre règle de fusion, champ par champ : une édition
  // peut avoir les développeurs et l'autre la série.
  let info = nouveau.infobox;
  for (const e of editions) {
    if (!e.infobox) continue;
    info = fusionnerInfobox(info, e.infobox, sourcesInfobox(e.infobox));
  }
  if (!memeInfobox(info, nouveau.infobox)) {
    nouveau.infobox = info;
    champs.push("infos");
  }

  return champs.length ? { jeu: nouveau, champs } : null;
}

export const libelleEdition = (e) =>
  e.univers === "pc" ? `PC${e.boutique ? ` · ${e.boutique}` : ""}` : e.platform;

// Ce qui manque à une fiche, et qu'on peut aller remplir.
//
// L'onglet Stats savait déjà compter les manques — « 21 jeux sans note » — mais
// on ne pouvait pas y aller : un constat sans porte de sortie. Ces prédicats
// servent aux deux, si bien que le chiffre affiché et la liste obtenue ne
// peuvent pas diverger.
export const CHAMPS_A_COMPLETER = [
  ["cover", "Jaquette", g => !g.cover],
  ["genre", "Genre", g => !g.genre?.length],
  ["style", "Description", g => !g.style],
  ["metacritic", "Note", g => !g.metacritic && !g.noteAbsente],
  ["infobox", "Fiche détaillée", g => !g.infobox],
];

// Combien de fiches il manque, champ par champ, en n'annonçant que ce qui
// manque réellement. Une option « Jaquette 0 » promettrait du travail qui
// n'existe pas — et le jour où tout est complet, il n'y a plus rien à proposer.
export function completudeManquante(games) {
  const jeux = games || [];
  return CHAMPS_A_COMPLETER
    .map(([cle, label, manque]) => [cle, label, jeux.filter(manque).length])
    .filter(([, , n]) => n > 0);
}

// Combien de fiches ont au moins un manque. Ce n'est pas la somme des colonnes
// — un même jeu peut manquer de trois choses — et c'est pourtant ce nombre-là
// qui dit l'ampleur du travail restant.
export function compterFichesIncompletes(games) {
  return (games || []).filter(g => CHAMPS_A_COMPLETER.some(([, , manque]) => manque(g))).length;
}

export function jeuACompleter(g, champ) {
  if (champ === "tous") return true;
  const trouve = CHAMPS_A_COMPLETER.find(([cle]) => cle === champ);
  return trouve ? trouve[2](g) : true;
}

// Date de sortie la plus ancienne connue pour un jeu : Wikidata en liste une
// par plateforme, et c'est la première qui date le jeu. Elle sert à l'onglet
// Stats comme au tri de la liste — un seul endroit, sinon les deux finiraient
// par ne plus dater le même jour.
export const dateDeSortie = (g) => {
  const dates = (g?.infobox?.releases || []).map(r => r?.date).filter(d => /^\d{4}/.test(d || ""));
  return dates.length ? dates.sort()[0] : null;
};

// Un ordre aléatoire, mais stable.
//
// « Je joue à quoi ce soir » est la question qu'une ludothèque de cent
// cinquante jeux rend difficile, et un tri au hasard y répond mieux qu'un
// classement. Encore faut-il qu'il tienne : `Math.random()` dans un
// comparateur rebat les cartes à chaque rendu — la liste danserait sous le
// doigt à chaque frappe dans la recherche. D'où une empreinte calculée à
// partir de l'identifiant du jeu et d'une graine : le même mélange tant qu'on
// ne redemande pas à mélanger.
export function empreinteMelange(id, graine) {
  let x = (Number(id) ^ Number(graine)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// La série d'un jeu, telle que Wikidata la nomme.
export const serieDuJeu = (g) => String(g?.infobox?.series || "").trim();

// Un jeu appartient-il à la plateforme demandée ?
//
// Une plateforme récente montre ses jeux natifs ET ceux de la précédente
// marqués rétrocompatibles — c'est ce qu'on veut presque toujours, puisque ce
// sont des jeux qu'on peut lancer sur la console qu'on a sous la main. Mais
// « presque toujours » n'est pas « toujours », et le mélange était imposé :
// sur une bibliothèque réelle, demander « Xbox Series X » rendait 101 jeux
// dont 19 seulement sont des jeux Series X. Les 19 étaient devenus
// introuvables.
//
// `avecRetrocompatibles` reste vrai par défaut : c'est le comportement d'avant, et celui
// qu'on veut quand on cherche quoi jouer ce soir. Le décocher répond à l'autre
// question, celle du collectionneur — qu'est-ce que j'ai VRAIMENT sur cette
// console.
export function jeuSurPlateforme(g, plat, avecRetrocompatibles = true) {
  if (plat === "tous") return true;
  if (g.platform === plat) return true;
  return avecRetrocompatibles && BACK_COMPAT[plat] === g.platform && !!g.backCompat;
}

// La génération, qui n'est pas la rétrocompatibilité.
//
// Ce filtre répond à « montre-moi mes vieilles machines » ou « oublie-les » ;
// la case à cocher juste au-dessus répond à « compte aussi les jeux d'avant
// jouables sur celle-ci ». Deux questions différentes, et c'est pour ne plus
// pouvoir les confondre que l'autre s'appelle maintenant
// `avecRetrocompatibles` en toutes lettres.
export function jeuDeLaGeneration(g, gen) {
  if (!gen || gen === "tous") return true;
  return generationDe(g?.platform) === gen;
}

// Combien de jeux la case à cocher ajoute, pour le dire plutôt que le faire
// deviner : « inclure les jeux rétrocompatibles » n'annonce pas s'il y en a
// deux ou quatre-vingts.
export function compterRetro(games, plat) {
  const enfant = BACK_COMPAT[plat];
  if (!enfant) return 0;
  return (games || []).filter(g => g.platform === enfant && g.backCompat).length;
}

// ── Modes de jeu ───────────────────────────────────────────────────────────
// « On est deux ce soir, on lance quoi ? » est la question qu'une ludothèque
// de cent cinquante jeux rend difficile, et l'application avait la réponse sans
// savoir la donner : Wikidata renseigne le mode de jeu, il n'était affiché que
// fiche par fiche.
//
// Les étiquettes viennent telles quelles de Wikidata et ne forment pas un
// vocabulaire : « solo », « Solo », « mode coopératif », « joueur contre
// joueur », « multijoueur en écran divisé / partagé », « two-player video
// game ». Trois questions suffisent pourtant à les couvrir toutes.
//
// Contrairement aux genres, ces étiquettes ne sont PAS réécrites dans les
// fiches : la formulation de Wikidata est une information — « écran divisé »
// n'est pas « en ligne » — et la perdre pour trois boutons serait un mauvais
// change. Le classement se fait donc à la lecture, à chaque filtrage.
export const MODES_JEU = ["solo", "multi", "coop"];

const REGLES_MODE = [
  ["solo", /solo|un joueur|single/],
  // Le coopératif est un multijoueur : qui demande « à plusieurs » veut aussi
  // les jeux qu'on ne peut faire qu'ensemble.
  ["coop", /coop/],
  ["multi", /coop|multi|joueur contre joueur|two-player|versus|pvp/],
];

export function modesDuJeu(g) {
  const trouves = new Set();
  for (const brut of g?.infobox?.modes || []) {
    const t = String(brut || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const [mode, regle] of REGLES_MODE) if (regle.test(t)) trouves.add(mode);
  }
  return trouves;
}

// Un jeu sans fiche Wikidata n'a aucun mode connu : il ne répond ni oui ni non,
// et disparaît donc de tout filtre par mode. C'est dit à l'écran plutôt que
// laissé deviner — sinon un filtre « Solo » a l'air d'affirmer que les jeux
// absents ne sont pas solo.
export const jeuALeMode = (g, mode) => mode === "tous" || modesDuJeu(g).has(mode);

// ── Genres présents ────────────────────────────────────────────────────────
// Les plateformes et les formats sont une liste fermée, écrite ici ; les genres
// dépendent de la bibliothèque et changent avec elle. Ils sont donc dérivés,
// et classés par nombre de jeux : sur cent cinquante jeux, « Action » et un
// genre porté par un seul titre n'ont pas à se présenter côte à côte comme
// deux choix équivalents.
export function genresPresents(games) {
  const compte = new Map();
  for (const g of games || []) {
    for (const genre of g.genre || []) compte.set(genre, (compte.get(genre) || 0) + 1);
  }
  return [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Normalisation d'un titre pour comparaison : minuscules, sans accents ni
// ponctuation. Sert à la recherche, à la déduplication d'import, et à repérer
// un rapprochement RAWG douteux.
// Le titre tel qu'il se classe, article initial mis de côté.
//
// « The Legend of Zelda », « The Last of Us », « The Sims 4 » : rangés à la
// lettre T, ils formaient un bloc où l'on ne trouve rien, et le PC en a ajouté
// des dizaines. L'affichage ne change pas — c'est un ordre, pas un titre.
//
// Les articles anglais et français seulement, et uniquement suivis d'un espace :
// « A Plague Tale » se range à P, « Alone in the Dark » reste à A.
// « L'Ombre » n'a pas d'espace après son article : il est traité à part, sans
// quoi la liste l'aurait mentionné sans jamais le retirer.
const ARTICLE_INITIAL = /^(?:(?:the|a|an|le|la|les|un|une|des)\s+|l['\u2019]\s*)/i;
export const titreDeTri = (t) => String(t || "").trim().replace(ARTICLE_INITIAL, "").trim() || String(t || "");

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
// Une fiche dont on sait qu'aucune source ne la note n'est plus « sans score » :
// elle est réglée. La reproposer à chaque passage ferait d'une action qui se
// termine une corvée qui recommence.
export const jeuxSansScore = (games) => (games || []).filter(g => !g.metacritic && !g.noteAbsente);

// Celles qu'on a déclarées sans note. Un jeu de 1994 le restera ; un jeu sorti
// l'an dernier peut recevoir un Metascore plus tard, et il faut un moyen d'y
// revenir sans rouvrir chaque fiche.
// Ce qu'une source propose vaut-il d'être montré ? Seulement si elle répond, et
// si sa réponse diffère de ce qui est en place. Une source qui confirme la note
// déjà là n'a rien à faire dans une liste de modifications à valider.
export const noteChangee = (avant, apres) =>
  Number.isInteger(apres) && apres !== (Number.isInteger(avant) ? avant : null);

export const jeuxNoteDeclareeAbsente = (games) => (games || []).filter(g => g.noteAbsente && !g.metacritic);

// ── Édition manuelle d'une fiche ────────────────────────────────────────────
// Tout ce que les sources automatiques écrivent (titre, plateforme, genres,
// note, jaquette, description, infobox Wikidata) était en lecture seule : une
// erreur de RAWG ou un mauvais article Wikipédia ne se corrigeait qu'en
// supprimant le jeu pour le recréer. La saisie passe par un brouillon de
// chaînes ; ces fonctions le traduisent en champs du modèle, et disent ce qui
// ne va pas plutôt que d'écrire n'importe quoi.
// Les plateformes qu'un jeu peut porter, PC compris : c'est la liste que
// valide l'édition et l'import.
// L'ordre de la table est celui du menu d'ajout : les actuelles d'abord, puis
// le rétro par famille, du plus récent au plus ancien.
export const PLATFORMES_JEU = PLATEFORMES.map(p => p.id);

// Le menu d'ajout, en sections.
//
// Vingt-neuf entrées à plat, c'est une liste où l'on cherche. En sections —
// « Actuelles », puis une par famille — c'est une liste où l'on trouve : le
// sélecteur natif d'Android affiche les intitulés de groupe, et faire défiler
// jusqu'à « Sega » est un geste, pas une lecture.
export function plateformesGroupees() {
  const groupes = [["Actuelles", PLATEFORMES.filter(p => p.generation === "actuelle")]];
  for (const [cle, nom] of Object.entries(FAMILLES)) {
    const dedans = PLATEFORMES.filter(p => p.generation === "retro" && p.famille === cle);
    if (dedans.length) groupes.push([`${nom} — rétro`, dedans]);
  }
  return groupes;
}

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
    boutique: g.boutique || "",
    genre: listeVersTexte(g.genre), metacritic: g.metacritic == null ? "" : String(g.metacritic),
    addedDate: g.addedDate || "", style: g.style || "", cover: g.cover || "",
    developers: listeVersTexte(i.developers), publishers: listeVersTexte(i.publishers),
    releases: sortiesVersTexte(i.releases), modes: listeVersTexte(i.modes),
    series: i.series || "", follows: i.follows || "", followedBy: i.followedBy || "",
    // Pas un champ de saisie : la provenance traverse le brouillon pour ne pas
    // être perdue à la première correction manuelle.
    sources: sourcesInfobox(g.infobox),
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
  // Un jeu PC est toujours démat et jamais rétrocompatible : ces deux champs
  // répondent à des questions de console, et laisser passer « PC physique »
  // ferait apparaître un jeu Steam dans un filtre « galettes ».
  const estUnPC = b.platform === PC;
  const format = estUnPC ? "démat" : b.format === "démat" ? "démat" : "physique";
  const backCompat = !estUnPC && !!b.backCompat && !!BACK_COMPAT_PARENT[b.platform];
  // Et la boutique ne se garde que sur PC : une console n'en a pas.
  const boutique = estUnPC ? String(b.boutique || "").trim() : "";

  let mc = null;
  const mcBrut = String(b.metacritic || "").trim();
  if (mcBrut) {
    const n = Number(mcBrut);
    if (!Number.isInteger(n) || n < 0 || n > 100) erreurs.metacritic = "Entre 0 et 100, ou vide";
    else mc = n;
  }

  const date = String(b.addedDate || "").trim();
  const anneeMax = Number(aujourdhuiISO().slice(0, 4)) + ANNEES_A_VENIR;
  if (!estDateISO(date)) erreurs.addedDate = "Date invalide";
  else if (!estDatePlausible(date)) erreurs.addedDate = `Année attendue entre ${ANNEE_MIN} et ${anneeMax}`;

  const cover = String(b.cover || "").trim();
  if (cover && !URL_JAQUETTE.test(cover)) erreurs.cover = "URL d'image attendue (https://…)";

  // Une infobox vidée de tous ses champs redevient null : la section disparaît
  // au lieu d'afficher un cadre vide.
  const info = {
    developers: listeDepuisTexte(b.developers), publishers: listeDepuisTexte(b.publishers),
    releases: sortiesDepuisTexte(b.releases), modes: listeDepuisTexte(b.modes),
    series: String(b.series || "").trim(), follows: String(b.follows || "").trim(),
    followedBy: String(b.followedBy || "").trim(),
    sources: (Array.isArray(b.sources) ? b.sources : []).filter(x => SOURCES_INFO[x]),
  };
  const infoVide = infoboxVide(info);
  if (!info.sources.length) info.sources = ["wikidata"];

  return {
    erreurs,
    valeurs: {
      title: titre, platform: b.platform, format, backCompat, boutique,
      genre: normaliserGenres(listeDepuisTexte(b.genre)),
      metacritic: mc, addedDate: date, style: String(b.style || "").trim(),
      // Une note saisie efface le « pas de note connue » ; un champ vidé à la
      // main rend la fiche aux sources, qui la chercheront à nouveau.
      noteAbsente: false,
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
  cover: null, metacritic: null, boutique: "", refBoutique: "",
  infobox: null,
};

const estTexte = (v) => typeof v === "string";

// Une date exploitable, et pas seulement une chaîne. Le contrôle ne portait que
// sur le type : « pas une date » passait, puis `new Date()` en tirait un NaN qui
// remontait jusque dans les moyennes de l'onglet Stats — « NaN j » affiché
// comme une statistique. Un fichier bricolé à la main, un export tronqué, une
// version future du format suffisent à produire ce cas.
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const estDateISO = (v) => estTexte(v) && DATE_ISO.test(v) && !Number.isNaN(Date.parse(v));

// Lisible ne veut pas dire plausible. « 0001-01-01 » respecte le format, se
// lit sans erreur, et fait tracer à l'onglet Stats un histogramme de deux mille
// colonnes larges de zéro pixel : quinze secondes de rendu et huit mille
// éléments, pour une année mal tapée dans un champ date — ce qu'un doigt fait
// en une seconde sur un téléphone.
//
// La fenêtre est large exprès : elle n'est pas là pour juger une date, mais
// pour écarter celles qui ne peuvent pas appartenir à la vie de cette
// bibliothèque. Elle va jusqu'à dix ans devant parce qu'une date de retour
// convenue, elle, est légitimement dans le futur.
export const ANNEE_MIN = 1970;
export const ANNEES_A_VENIR = 10;
export function estDatePlausible(v, aujourdhui = aujourdhuiISO()) {
  if (!estDateISO(v)) return false;
  const an = Number(v.slice(0, 4));
  return an >= ANNEE_MIN && an <= Number(aujourdhui.slice(0, 4)) + ANNEES_A_VENIR;
}

// Une entrée d'historique venue d'un fichier : un nom et deux dates réelles.
const estEntreePret = (e) => !!e && typeof e === "object"
  && estTexte(e.a) && !!e.a.trim() && estDatePlausible(e.du) && estDatePlausible(e.au);

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
  const addedDate = garder(estDatePlausible(brut.addedDate), brut.addedDate, aujourdhuiISO());

  // Un prêt se mesure en jours : sans nom ou sans date valide, il n'est pas
  // « incomplet », il n'existe pas. Le laisser à moitié renseigné produit un
  // jeu marqué prêté dont la durée est NaN et que rien ne signale jamais.
  const pretValide = estTexte(brut.lentA) && !!brut.lentA.trim() && estDatePlausible(brut.lentDate);
  const lentA = pretValide ? brut.lentA.trim() : garder(!brut.lentA && !brut.lentDate, null, null);
  const lentDate = pretValide ? brut.lentDate : null;
  const lentRetourPrevu = !pretValide ? null
    : garder(brut.lentRetourPrevu == null || estDatePlausible(brut.lentRetourPrevu), brut.lentRetourPrevu ?? null, null);

  const historique = Array.isArray(brut.pretsPasses) ? brut.pretsPasses : [];
  const retenues = historique.filter(estEntreePret).slice(0, MAX_HISTORIQUE_PRET);
  if (retenues.length !== Math.min(historique.length, MAX_HISTORIQUE_PRET)) corrige = true;
  const pretsPasses = retenues.map(e => (estDatePlausible(e.prevu) ? e : { a: e.a, du: e.du, au: e.au }));

  return {
    corrige,
    champs: {
      platform, format, metacritic, addedDate, lentA, lentDate, lentRetourPrevu, pretsPasses,
      backCompat: typeof brut.backCompat === "boolean" ? brut.backCompat : undefined,
      // La boutique est libre : on n'en connaît pas la liste, et un import qui
      // en refuserait une inconnue perdrait l'information au lieu de la garder.
      boutique: estTexte(brut.boutique) ? brut.boutique.trim() : "",
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
      genre: normaliserGenres(brut.genre),
      style: estTexte(brut.style) ? brut.style : "",
    });
    // `backCompat: undefined` doit disparaître pour que la migration le décide.
    if (champs.backCompat === undefined) delete jeux[jeux.length - 1].backCompat;
  }
  return { jeux: migrateGames(jeux), rejetes, corriges };
}
