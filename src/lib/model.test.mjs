// Tests des fonctions qui décident du sort de la bibliothèque.
//
//   npm test
//
// Le Worker, qui ne détient rien, avait 23 vérifications ; le code qui garde
// toute la bibliothèque n'en avait aucune. Ce fichier couvre ce qui, en cas de
// régression, mange des données en silence : la migration jouée à chaque
// chargement, la validation d'un import, et la règle de rétrocompatibilité.
//
// Node suffit : ces fonctions sont pures, sans DOM ni réseau.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  migrateGames, validerJeuxImportes, compterFiltres,
  joursDePret, pretEnRetard, isBackCompatPlatform,
  brouillonDepuisJeu, validerEdition, sortiesDepuisTexte, sortiesVersTexte, listeDepuisTexte,
  normTitle, rapprochementDouteux, jeuxSansScore,
  rendreJeu, preterJeu, annulerPret, supprimerEntreeHistorique, dureeEntreeHistorique, MAX_HISTORIQUE_PRET, aujourdhuiISO,
  BACK_COMPAT, XBOX_SERIES_CUTOFF, PRET_LONG_JOURS, PLATFORMES_JEU,
  estDatePlausible, estLienSur, ANNEE_MIN, ANNEES_A_VENIR, normaliserGenres,
  modesDuJeu, jeuALeMode, genresPresents, MODES_JEU, jeuSurPlateforme, compterRetro,
  jeuPasseSeuil, jeuACompleter, completudeManquante, compterFichesIncompletes,
  dateDeSortie, serieDuJeu, empreinteMelange,
  fusionnerInfobox, infoboxDepuisRawg, sourcesInfobox, libelleSources, infoboxVide,
  viderChamps, CHAMPS_VIDABLES, FILTRES, FILTRES_VIDES,
  PC, estPC, universDuJeu, jeuDansUnivers, boutiquesPresentes, jeuDeLaBoutique,
  autresEditions, libelleEdition,
} from "./model.js";
import { ecouterMiseAJour } from "./maj.js";

const jeu = (p = {}) => ({
  id: 1, title: "Jeu", platform: "Xbox Series X", format: "physique",
  addedDate: "2022-01-01", genre: [], style: "", lentA: null, lentDate: null,
  myLinks: ["", "", ""], tips: "", tag: "", ...p,
});

const ilYA = (jours) => new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);

// ── Migration ──────────────────────────────────────────────────────────────
// Elle tourne à chaque chargement de l'application : une erreur ici réécrit
// silencieusement toute la bibliothèque.

test("l'ancienne plateforme Xbox se scinde selon la date de sortie", () => {
  const [avant, apres] = migrateGames([
    jeu({ platform: "Xbox", addedDate: "2019-05-01" }),
    jeu({ platform: "Xbox", addedDate: "2021-03-01" }),
  ]);
  assert.equal(avant.platform, "Xbox One");
  assert.equal(apres.platform, "Xbox Series X");
});

test("le seuil de bascule est inclusif", () => {
  const [g] = migrateGames([jeu({ platform: "Xbox", addedDate: XBOX_SERIES_CUTOFF })]);
  assert.equal(g.platform, "Xbox Series X");
});

test("la migration est idempotente", () => {
  const une = migrateGames([jeu({ platform: "Xbox", addedDate: "2019-05-01" })]);
  const deux = migrateGames(une);
  assert.deepEqual(deux, une);
});

test("un choix manuel de rétrocompatibilité survit aux rechargements", () => {
  // Le cas qui a motivé le champ bcV : une fois la version de migration posée,
  // l'exception saisie à la main ne doit plus jamais être écrasée.
  const manuel = migrateGames([jeu({ platform: "Switch 1", backCompat: false })])[0];
  assert.equal(manuel.backCompat, true, "le rattrapage v2 s'applique une fois");
  const rejoue = migrateGames([{ ...manuel, backCompat: false }])[0];
  assert.equal(rejoue.backCompat, false, "puis le choix manuel est respecté");
});

test("migrateGames tolère une entrée nulle", () => {
  assert.deepEqual(migrateGames(null), []);
  assert.deepEqual(migrateGames(undefined), []);
});

// ── Import ─────────────────────────────────────────────────────────────────
// C'est la porte d'entrée des données venues d'ailleurs : un fichier, ou la
// sauvegarde du relais écrite par une autre version de l'application.

test("un contenu qui n'est pas une liste est refusé", () => {
  assert.equal(validerJeuxImportes({ jeux: [] }).jeux, null);
  assert.equal(validerJeuxImportes("texte").jeux, null);
  assert.equal(validerJeuxImportes(null).jeux, null);
});

test("les entrées sans titre exploitable sont comptées, pas avalées", () => {
  const { jeux, rejetes } = validerJeuxImportes([
    jeu({ title: "Halo" }), { title: "   " }, null, "texte", { url: "x" },
  ]);
  assert.equal(jeux.length, 1);
  assert.equal(rejetes, 4);
});

test("les champs de mauvais type sont normalisés au lieu de casser le rendu", () => {
  const [g] = validerJeuxImportes([{
    id: 2, title: "X", genre: "action", myLinks: null, tips: 42,
  }]).jeux;
  assert.deepEqual(g.genre, []);
  assert.deepEqual(g.myLinks, ["", "", ""]);
  assert.equal(g.tips, "");
});

test("deux jeux ne peuvent pas repartir avec le même identifiant", () => {
  // Des identifiants en double casseraient les clés React et l'édition, qui
  // repose entièrement sur `id`.
  const { jeux } = validerJeuxImportes([{ id: 7, title: "A" }, { id: 7, title: "B" }]);
  assert.equal(new Set(jeux.map(g => g.id)).size, 2);
});

test("un import passe par la migration", () => {
  const [g] = validerJeuxImportes([{ id: 3, title: "Vieux", platform: "Xbox", addedDate: "2016-01-01" }]).jeux;
  assert.equal(g.platform, "Xbox One");
});

test("le titre est débarrassé de ses espaces", () => {
  assert.equal(validerJeuxImportes([{ id: 4, title: "  Halo  " }]).jeux[0].title, "Halo");
});

// ── Règles d'affichage ─────────────────────────────────────────────────────

test("compterFiltres ignore le tri et le mode d'affichage", () => {
  assert.equal(compterFiltres({ plat: "tous", pretFil: "tous", fmtFil: "tous" }), 0);
  assert.equal(compterFiltres({ plat: "Switch 2", pretFil: "tous", fmtFil: "démat" }), 2);
});

test("une plateforme récente accueille la précédente, l'inverse est faux", () => {
  assert.equal(BACK_COMPAT["Xbox Series X"], "Xbox One");
  assert.equal(BACK_COMPAT["Switch 2"], "Switch 1");
  assert.equal(isBackCompatPlatform("Xbox One"), true);
  assert.equal(isBackCompatPlatform("Xbox Series X"), false);
});

// ── Prêts ──────────────────────────────────────────────────────────────────
// Le prêt est l'une des deux raisons d'être de l'application et n'avait aucun
// test, alors que le statut, lui, en avait.

test("un jeu chez soi n'a pas de durée de prêt", () => {
  assert.equal(joursDePret(jeu()), null);
  assert.equal(pretEnRetard(jeu()), false);
});

test("un nom de prêt sans date ne compte pas comme un prêt", () => {
  // Donnée incohérente venue d'un import : elle ne doit pas produire un
  // « prêté depuis NaN jours ».
  assert.equal(joursDePret(jeu({ lentA: "Paul", lentDate: null })), null);
  assert.equal(pretEnRetard(jeu({ lentA: "Paul", lentDate: null })), false);
});

test("la durée de prêt se compte depuis la date de prêt", () => {
  assert.equal(joursDePret(jeu({ lentA: "Paul", lentDate: ilYA(12) })), 12);
});

test("un prêt dépasse le seuil au-delà de 30 jours, pas à 30", () => {
  assert.equal(pretEnRetard(jeu({ lentA: "Paul", lentDate: ilYA(PRET_LONG_JOURS) })), false);
  assert.equal(pretEnRetard(jeu({ lentA: "Paul", lentDate: ilYA(PRET_LONG_JOURS + 1) })), true);
});

test("la migration retire les champs de progression et de temps de jeu", () => {
  // Ils ne servent plus, et les laisser ferait croire à des fonctions
  // inexistantes tout en voyageant à chaque synchronisation.
  const [g] = migrateGames([jeu({
    status: "terminé", playedMinutes: 300, manualMinutes: 60,
    sessions: [{ date: "2024-01-01", minutes: 30 }], hltb: 40, note: 8, progression: "50%",
  })]);
  for (const mort of ["status", "playedMinutes", "manualMinutes", "sessions", "hltb", "note", "progression"]) {
    assert.equal(mort in g, false, `${mort} aurait dû disparaître`);
  }
  assert.equal(g.title, "Jeu", "le reste du jeu est intact");
});


// ── Ce qu'un fichier abîmé ne doit pas pouvoir faire entrer ────────────────
// Le contrôle ne portait que sur les types : « pas une date » est une chaîne,
// donc ça passait, et le NaN qui en sortait remontait jusque dans les moyennes
// de l'onglet Stats — affiché comme une statistique.

test("une date illisible ne devient jamais un prêt", () => {
  const { jeux, corriges } = validerJeuxImportes([
    { title: "Prêt sans date valide", lentA: "Paul", lentDate: "pas une date" },
    { title: "Prêt sans nom", lentDate: "2024-01-01" },
  ]);
  assert.equal(corriges, 2);
  for (const g of jeux) {
    assert.equal(g.lentA, null, `${g.title} : le prêt aurait dû être écarté`);
    assert.equal(g.lentDate, null);
    assert.equal(joursDePret(g), null, "un prêt à moitié renseigné produisait NaN");
  }
});

test("une entrée d'historique sans dates réelles est écartée", () => {
  const { jeux, corriges } = validerJeuxImportes([{
    title: "Halo",
    pretsPasses: [
      { a: "Léa", du: "n'importe quoi", au: "pareil" },
      { a: "Paul", du: "2024-01-01", au: "2024-01-11" },
      { a: "Max", du: "2024-02-01", au: "2024-02-05", prevu: "pas une date" },
    ],
  }]);
  assert.equal(corriges, 1, "la ligne illisible compte comme une correction");
  assert.equal(jeux[0].pretsPasses.length, 2);
  assert.equal(dureeEntreeHistorique(jeux[0].pretsPasses[0]), 10, "plus de NaN dans les durées");
  assert.equal(jeux[0].pretsPasses[1].prevu, undefined, "une date convenue illisible ne survit pas");
});

test("une plateforme, un format ou une note inventés sont ramenés à une valeur sûre", () => {
  const { jeux, corriges } = validerJeuxImportes([
    { title: "Console imaginaire", platform: "PlayStation 5" },
    { title: "Format imaginaire", format: "cartouche" },
    { title: "Note en toutes lettres", metacritic: "quatre-vingts" },
    { title: "Note hors bornes", metacritic: 250 },
    { title: "Date d'ajout illisible", addedDate: "hier" },
  ]);
  assert.equal(corriges, 5);
  // Une plateforme inconnue n'apparaît dans aucun filtre et n'est pas rééditable.
  assert.ok(PLATFORMES_JEU.includes(jeux[0].platform));
  // Un format inventé n'est compté ni en physique ni en démat : les tuiles de
  // l'onglet Collection cessaient de s'additionner.
  assert.equal(jeux[1].format, "physique");
  assert.equal(jeux[2].metacritic, null);
  assert.equal(jeux[3].metacritic, null);
  assert.match(jeux[4].addedDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("un fichier sain traverse la validation sans être touché", () => {
  // Le garde-fou ne doit pas « corriger » ce qui va bien : un export normal
  // ressort identique, sinon la mise en garde à l'import crierait au loup.
  const propre = {
    id: 7, title: "Halo Infinite", platform: "Xbox Series X", format: "démat",
    addedDate: "2024-05-01", genre: ["FPS"], style: "Un jeu de tir.", cover: "https://x/y.jpg",
    metacritic: 87, lentA: "Paul", lentDate: "2024-06-01", lentRetourPrevu: "2024-07-01",
    pretsPasses: [{ a: "Léa", du: "2024-01-01", au: "2024-01-05" }],
    myLinks: ["", "", ""], tips: "", tag: "", infobox: null, backCompat: false,
  };
  const { jeux, rejetes, corriges } = validerJeuxImportes([propre]);
  assert.equal(rejetes, 0);
  assert.equal(corriges, 0, "un export sain ne doit déclencher aucune correction");
  for (const k of ["title", "platform", "format", "addedDate", "metacritic", "lentA", "lentDate", "lentRetourPrevu"]) {
    assert.deepEqual(jeux[0][k], propre[k], `${k} a été modifié sans raison`);
  }
});

// ── Édition manuelle ───────────────────────────────────────────────────────
// La fiche laisse désormais réécrire ce que les sources automatiques ont
// posé. Une validation trop laxiste met un NaN dans la note ou une date
// invalide dans le stock, et le jeu devient illisible pour toujours.

const brouillonValide = (p = {}) => ({
  ...brouillonDepuisJeu(jeu({ title: "Halo", addedDate: "2022-01-01" })), ...p,
});

test("un aller-retour brouillon → valeurs ne perd rien", () => {
  const g = jeu({
    title: "Halo Infinite", genre: ["FPS", "Action"], metacritic: 87, cover: "https://x/y.jpg",
    platform: "Xbox One", format: "démat", backCompat: true,
    style: "Un jeu de tir.", infobox: { developers: ["343"], publishers: ["Xbox"], releases: [{ date: "2021-12-08", platform: "Xbox Series X" }], modes: ["Solo", "Multijoueur"], series: "Halo", follows: "Halo 5", followedBy: "" },
  });
  const { erreurs, valeurs } = validerEdition(brouillonDepuisJeu(g));
  assert.deepEqual(erreurs, {});
  for (const k of ["title", "platform", "format", "backCompat", "genre", "metacritic", "addedDate", "style", "cover"]) {
    assert.deepEqual(valeurs[k], g[k], `${k} a changé en passant par le brouillon`);
  }
  // La provenance traverse le brouillon. Une infobox d'avant les deux sources
  // n'en portait pas : elle est réputée venir de Wikidata, seule source de
  // l'époque, plutôt que de ressortir sans origine.
  assert.deepEqual(valeurs.infobox, { ...g.infobox, sources: ["wikidata"] });
});

test("le format et la rétrocompatibilité passent par le brouillon", () => {
  const g = jeu({ title: "Alan Wake", platform: "Xbox One", format: "démat", backCompat: true });
  const { valeurs } = validerEdition(brouillonDepuisJeu(g));
  assert.equal(valeurs.format, "démat");
  assert.equal(valeurs.backCompat, true);
  // Une valeur de format inconnue — un import bricolé, une vieille sauvegarde —
  // retombe sur « physique » plutôt que d'entrer telle quelle dans le stock.
  assert.equal(validerEdition(brouillonValide({ format: "cartouche" })).valeurs.format, "physique");
});

test("changer pour une plateforme sans console parente efface la rétrocompatibilité", () => {
  // Le cas qui fausse les statistiques en silence : la ligne disparaît de
  // l'écran, mais la valeur restait dans les données et continuait d'être
  // comptée parmi les jeux rétrocompatibles.
  // « Xbox Series X » n'a pas de console parente ; « Xbox One » a la sienne.
  const b = brouillonValide({ platform: "Xbox Series X", backCompat: true });
  assert.equal(validerEdition(b).valeurs.backCompat, false);
  assert.equal(validerEdition({ ...b, platform: "Xbox One" }).valeurs.backCompat, true);
});

test("un titre vide est refusé", () => {
  const { erreurs } = validerEdition(brouillonValide({ title: "   " }));
  assert.ok(erreurs.title);
});

test("le Metacritic accepte le vide mais pas n'importe quoi", () => {
  assert.equal(validerEdition(brouillonValide({ metacritic: "" })).valeurs.metacritic, null);
  assert.equal(validerEdition(brouillonValide({ metacritic: "87" })).valeurs.metacritic, 87);
  for (const mauvais of ["abc", "-1", "101", "87.5"]) {
    assert.ok(validerEdition(brouillonValide({ metacritic: mauvais })).erreurs.metacritic, `${mauvais} aurait dû être refusé`);
  }
});

test("une date d'ajout invalide est refusée", () => {
  for (const mauvais of ["", "01/01/2022", "2022-13-45"]) {
    assert.ok(validerEdition(brouillonValide({ addedDate: mauvais })).erreurs.addedDate, `${mauvais} aurait dû être refusé`);
  }
  assert.deepEqual(validerEdition(brouillonValide({ addedDate: "2022-01-01" })).erreurs, {});
});

test("la jaquette veut une URL d'image, et le vide efface", () => {
  assert.equal(validerEdition(brouillonValide({ cover: "  " })).valeurs.cover, null);
  assert.ok(validerEdition(brouillonValide({ cover: "javascript:alert(1)" })).erreurs.cover);
  assert.equal(validerEdition(brouillonValide({ cover: "https://x/y.jpg" })).erreurs.cover, undefined);
});

test("une plateforme hors liste est refusée", () => {
  assert.ok(validerEdition(brouillonValide({ platform: "PlayStation 5" })).erreurs.platform);
});

test("vider tous les champs Wikidata fait disparaître la section", () => {
  const b = brouillonValide({ developers: "", publishers: "", releases: "", modes: "", series: "", follows: "", followedBy: "" });
  assert.equal(validerEdition(b).valeurs.infobox, null);
});

test("les sorties se relisent ligne par ligne, avec ou sans plateforme", () => {
  const rel = sortiesDepuisTexte("2021-12-08 (Xbox Series X)\n2022-03-01\n\n  ");
  assert.deepEqual(rel, [{ date: "2021-12-08", platform: "Xbox Series X" }, { date: "2022-03-01" }]);
  assert.deepEqual(sortiesDepuisTexte(sortiesVersTexte(rel)), rel, "l'aller-retour doit être stable");
});

test("une liste séparée par des virgules ignore les vides et les espaces", () => {
  assert.deepEqual(listeDepuisTexte(" Action , , Aventure "), ["Action", "Aventure"]);
  assert.deepEqual(listeDepuisTexte(""), []);
});


// ── Complétion des notes Metacritic ────────────────────────────────────────
// La note vient du premier résultat RAWG pour le titre : c'est le point où
// l'application écrit, sur cent jeux d'un coup, une donnée qu'elle n'a pas
// vérifiée.

test("un jeu sans note est visé, un jeu noté est laissé tranquille", () => {
  const liste = [jeu({ id: 1, metacritic: 87 }), jeu({ id: 2, metacritic: null }), jeu({ id: 3 }), jeu({ id: 4, metacritic: 0 })];
  assert.deepEqual(jeuxSansScore(liste).map(g => g.id), [2, 3, 4], "0 compte comme absent");
  assert.deepEqual(jeuxSansScore(null), []);
});

test("normTitle ignore casse, accents et ponctuation", () => {
  assert.equal(normTitle("Assassin's Creed: Odyssée"), "assassin s creed odyssee");
  assert.equal(normTitle(null), "");
});

test("un rapprochement est douteux quand les titres ne se recouvrent pas", () => {
  assert.equal(rapprochementDouteux("Halo Infinite", "Halo Infinite"), false);
  assert.equal(rapprochementDouteux("HALO INFINITE", "Halo: Infinite"), false, "casse et ponctuation ne comptent pas");
  assert.equal(rapprochementDouteux("Halo", "Halo Infinite"), false, "une édition plus précise reste plausible");
  assert.equal(rapprochementDouteux("Halo Infinite", "Doom Eternal"), true);
  assert.equal(rapprochementDouteux("Halo Infinite", ""), true, "sans titre en face, rien ne prouve le rapprochement");
});


// ── Prêts : historique et date de retour ───────────────────────────────────
// « Rendu » remettait simplement lentA à null : la seule chose que
// l'application soit censée savoir — à qui va ce jeu, et pour combien de
// temps — s'effaçait à chaque retour.

test("rendre un jeu archive le prêt au lieu de l'effacer", () => {
  const g = jeu({ lentA: "Paul", lentDate: ilYA(12) });
  const r = rendreJeu(g);
  assert.equal(r.lentA, null);
  assert.equal(r.lentDate, null);
  assert.equal(r.pretsPasses.length, 1);
  assert.equal(r.pretsPasses[0].a, "Paul");
  assert.equal(r.pretsPasses[0].du, ilYA(12));
  assert.equal(r.pretsPasses[0].au, aujourdhuiISO());
  assert.equal(dureeEntreeHistorique(r.pretsPasses[0]), 12);
  assert.equal(g.pretsPasses, undefined, "l'original n'est pas modifié");
});

test("rendre un jeu qui n'est pas prêté ne fabrique pas d'entrée", () => {
  const g = jeu({ pretsPasses: [] });
  assert.equal(rendreJeu(g), g);
  assert.equal(rendreJeu(jeu({ lentA: "Paul", lentDate: null })).pretsPasses, undefined);
});

test("l'historique est borné et garde les prêts les plus récents", () => {
  let g = jeu();
  for (let i = 0; i < MAX_HISTORIQUE_PRET + 5; i++) {
    g = rendreJeu({ ...g, lentA: `P${i}`, lentDate: ilYA(1) });
  }
  assert.equal(g.pretsPasses.length, MAX_HISTORIQUE_PRET);
  assert.equal(g.pretsPasses[0].a, `P${MAX_HISTORIQUE_PRET + 4}`, "le plus récent est en tête");
});

test("prêter pose la date du jour, et la date de retour seulement si elle est valable", () => {
  const g = jeu();
  assert.equal(preterJeu(g, " Paul ").lentA, "Paul");
  assert.equal(preterJeu(g, "Paul").lentDate, aujourdhuiISO());
  assert.equal(preterJeu(g, "Paul").lentRetourPrevu, null);
  assert.equal(preterJeu(g, "Paul", "2030-01-01").lentRetourPrevu, "2030-01-01");
  assert.equal(preterJeu(g, "Paul", "01/01/2030").lentRetourPrevu, null, "un format inattendu ne passe pas");
  assert.equal(preterJeu(g, "   "), g, "sans nom, rien ne bouge");
});

test("la date convenue remplace le seuil, dans les deux sens", () => {
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  // Prêt d'hier, mais la date convenue est déjà passée : en retard.
  assert.equal(pretEnRetard(jeu({ lentA: "Paul", lentDate: ilYA(1), lentRetourPrevu: hier })), true);
  // Prêt de 90 jours, mais convenu jusqu'à demain : pas en retard.
  assert.equal(pretEnRetard(jeu({ lentA: "Paul", lentDate: ilYA(90), lentRetourPrevu: demain })), false);
  // Sans date convenue, le seuil de 30 jours reste le repli.
  assert.equal(pretEnRetard(jeu({ lentA: "Paul", lentDate: ilYA(90) })), true);
  assert.equal(pretEnRetard(jeu({ lentA: "Paul", lentDate: ilYA(2) })), false);
});

test("la migration prépare les champs de prêt sans écraser l'existant", () => {
  const [neuf] = migrateGames([jeu()]);
  assert.deepEqual(neuf.pretsPasses, []);
  assert.equal(neuf.lentRetourPrevu, null);
  const garde = [{ a: "Paul", du: "2024-01-01", au: "2024-01-10" }];
  const [ancien] = migrateGames([jeu({ pretsPasses: garde, lentRetourPrevu: "2030-01-01" })]);
  assert.deepEqual(ancien.pretsPasses, garde);
  assert.equal(ancien.lentRetourPrevu, "2030-01-01");
});

test("un import n'avale que des entrées d'historique exploitables", () => {
  const { jeux } = validerJeuxImportes([{
    title: "Jeu",
    pretsPasses: [
      { a: "Paul", du: "2024-01-01", au: "2024-01-10" },
      { a: "", du: "2024-01-01", au: "2024-01-10" },
      { du: "2024-01-01", au: "2024-01-10" },
      "n'importe quoi", null,
    ],
  }]);
  assert.deepEqual(jeux[0].pretsPasses, [{ a: "Paul", du: "2024-01-01", au: "2024-01-10" }]);
  assert.deepEqual(validerJeuxImportes([{ title: "X", pretsPasses: "oups" }]).jeux[0].pretsPasses, []);
});

// ── Détection de mise à jour ───────────────────────────────────────────────
// Le service worker prend le contrôle tout seul, mais l'onglet ouvert exécute
// encore l'ancien code. La distinction qui compte : une installation initiale
// n'est pas une mise à jour, et un bandeau qui crierait à la nouveauté au
// premier lancement serait pire que pas de bandeau du tout.

test("un changement de contrôleur signale une mise à jour, sauf à la première visite", () => {
  const faireSW = () => {
    const abonnes = new Set();
    return {
      addEventListener: (_, fn) => abonnes.add(fn),
      removeEventListener: (_, fn) => abonnes.delete(fn),
      declencher: () => abonnes.forEach(fn => fn()),
      get nbAbonnes() { return abonnes.size; },
    };
  };

  let vues = 0;
  const avec = faireSW();
  const stop = ecouterMiseAJour(avec, true, () => vues++);
  avec.declencher();
  assert.equal(vues, 1);

  // Première visite : le contrôleur apparaît, ce n'est pas une mise à jour.
  let vuesPremiere = 0;
  const sans = faireSW();
  ecouterMiseAJour(sans, false, () => vuesPremiere++);
  sans.declencher();
  assert.equal(vuesPremiere, 0);

  // Le désabonnement rend la main : pas d'écouteur qui survit à l'app.
  stop();
  assert.equal(avec.nbAbonnes, 0);
  avec.declencher();
  assert.equal(vues, 1);

  // Sans service worker (navigateur qui n'en veut pas), rien ne casse.
  assert.doesNotThrow(() => ecouterMiseAJour(null, true, () => {})());
});


// ── Corriger une erreur de saisie ──────────────────────────────────────────
// « Rendu » archive : c'est ce qu'on veut d'un vrai prêt qui se termine, et
// c'est exactement ce qu'on ne veut pas d'un essai. Sans un geste qui efface
// sans archiver, tester la fonction fausse les statistiques pour toujours.

test("annuler un prêt ne laisse aucune trace, contrairement à le rendre", () => {
  const g = jeu({ lentA: "Paul", lentDate: ilYA(3), lentRetourPrevu: "2030-01-01" });
  const annule = annulerPret(g);
  assert.equal(annule.lentA, null);
  assert.equal(annule.lentDate, null);
  assert.equal(annule.lentRetourPrevu, null);
  assert.equal(annule.pretsPasses, undefined, "rien n'entre dans l'historique");
  // Le même jeu « rendu » y entre, lui : c'est toute la différence.
  assert.equal(rendreJeu(g).pretsPasses.length, 1);
  const vide = jeu();
  assert.equal(annulerPret(vide), vide, "sans prêt, rien ne bouge");
});

test("une entrée d'historique se supprime par sa position, pas par son nom", () => {
  // La même personne peut emprunter plusieurs fois : le nom ne désigne rien.
  const g = jeu({ pretsPasses: [
    { a: "Paul", du: "2024-01-01", au: "2024-01-05" },
    { a: "Paul", du: "2024-03-01", au: "2024-03-09" },
    { a: "Léa", du: "2024-05-01", au: "2024-05-03" },
  ] });
  const apres = supprimerEntreeHistorique(g, 1);
  assert.deepEqual(apres.pretsPasses.map(e => e.du), ["2024-01-01", "2024-05-01"]);
  assert.equal(g.pretsPasses.length, 3, "l'original n'est pas modifié");
  // Un index hors bornes ne doit rien casser ni rien supprimer au hasard.
  assert.equal(supprimerEntreeHistorique(g, -1), g);
  assert.equal(supprimerEntreeHistorique(g, 3), g);
  assert.equal(supprimerEntreeHistorique(jeu(), 0).pretsPasses, undefined);
});


// ── Ce qui passait le format sans être une donnée ──────────────────────────
//
// Les trois vérifications qui suivent portent sur des valeurs que rien ne
// refusait parce qu'elles ont la bonne forme : une date lisible mais
// impossible, une date de prêt illisible qui devenait un NaN affiché comme une
// durée, un tableau absent d'un enregistrement ancien.

test("une date lisible n'est pas forcément plausible", () => {
  const jour = "2026-09-08";
  assert.equal(estDatePlausible("2026-09-08", jour), true);
  assert.equal(estDatePlausible("1999-12-31", jour), true);
  // Une année mal tapée dans un champ date : le format est bon, l'année non.
  assert.equal(estDatePlausible("0001-01-01", jour), false);
  assert.equal(estDatePlausible("9999-12-31", jour), false);
  assert.equal(estDatePlausible(`${ANNEE_MIN}-01-01`, jour), true);
  assert.equal(estDatePlausible(`${ANNEE_MIN - 1}-12-31`, jour), false);
  // Une date de retour convenue est légitimement devant : la fenêtre s'ouvre
  // assez loin pour ne pas la refuser.
  const dansCinqAns = `${2026 + 5}-01-01`;
  assert.equal(estDatePlausible(dansCinqAns, jour), true);
  assert.equal(estDatePlausible(`${2026 + ANNEES_A_VENIR + 1}-01-01`, jour), false);
  assert.equal(estDatePlausible("pas une date", jour), false);
  assert.equal(estDatePlausible(null, jour), false);
});

test("l'import ramène une année invraisemblable à aujourd'hui", () => {
  // Sans quoi elle atteint l'histogramme des ajouts, qui comble toutes les
  // années entre la plus ancienne et la plus récente : deux mille colonnes.
  const { jeux, corriges } = validerJeuxImportes([
    { id: 1, title: "Année aberrante", addedDate: "0001-01-01" },
  ]);
  assert.equal(jeux[0].addedDate, aujourdhuiISO());
  assert.equal(corriges, 1, "la correction est annoncée, pas faite en silence");
});

test("un prêt daté d'une année impossible n'est pas un prêt", () => {
  const { jeux } = validerJeuxImportes([
    { id: 1, title: "T", lentA: "Paul", lentDate: "0001-05-05" },
  ]);
  assert.equal(jeux[0].lentA, null);
  assert.equal(jeux[0].lentDate, null);
});

test("une date de prêt illisible ne produit plus de NaN", () => {
  // L'onglet Prêts affichait « NaNj » comme une durée, et un commentaire de
  // l'application affirmait déjà que cette fonction s'en gardait.
  assert.equal(joursDePret({ lentA: "Paul", lentDate: "pas une date" }), null);
  assert.equal(joursDePret({ lentA: "Paul", lentDate: "0001-01-01" }), null,
    "hors fenêtre plausible mais lisible : le format seul ne suffit pas non plus");
  assert.equal(dureeEntreeHistorique({ du: "x", au: "y" }), 0);
  assert.equal(dureeEntreeHistorique({}), 0);
  // Une entrée saine continue de compter normalement.
  assert.equal(dureeEntreeHistorique({ du: "2024-01-01", au: "2024-01-11" }), 10);
});

test("la migration garantit les tableaux que le rendu déréference", () => {
  // `g.genre.some(...)` et `g.myLinks[i]` sont lus sans précaution à chaque
  // rendu : absents d'un enregistrement écrit par une version ancienne, ils
  // faisaient tomber l'application entière sur son garde-fou d'erreurs.
  const [g] = migrateGames([{ title: "Vieux jeu", platform: "Xbox One" }]);
  assert.deepEqual(g.genre, []);
  assert.deepEqual(g.myLinks, ["", "", ""]);
  assert.deepEqual(g.pretsPasses, []);
  // Ce qui est déjà correct n'est pas écrasé.
  const [h] = migrateGames([{ title: "T", genre: ["Action"], myLinks: ["https://a", "", ""] }]);
  assert.deepEqual(h.genre, ["Action"]);
  assert.equal(h.myLinks[0], "https://a");
});

test("seuls les liens http(s) entrent dans une fiche", () => {
  // Un lien de fiche finit dans un href : `javascript:` s'exécuterait dans
  // l'application, avec accès au stockage — donc aux clés et au code de
  // synchronisation.
  assert.equal(estLienSur("https://exemple.fr"), true);
  assert.equal(estLienSur("http://exemple.fr"), true);
  assert.equal(estLienSur("  https://exemple.fr  "), true);
  assert.equal(estLienSur("javascript:alert(1)"), false);
  assert.equal(estLienSur("JavaScript:alert(1)"), false);
  assert.equal(estLienSur("data:text/html,<script>"), false);
  assert.equal(estLienSur(""), false);
  assert.equal(estLienSur(null), false);

  const { jeux } = validerJeuxImportes([
    { id: 1, title: "T", myLinks: ["javascript:alert(1)", "https://ok.fr", 42] },
  ]);
  assert.deepEqual(jeux[0].myLinks, ["", "https://ok.fr", ""]);
});


// ── Genres ─────────────────────────────────────────────────────────────────
//
// Deux sources, deux langues : la bibliothèque de départ parle français, RAWG
// répond en anglais. Sur 154 jeux réels, 33 valeurs dont la moitié en double —
// « Adventure » 21 et « Aventure » 20, « Platformer » 16 et « Plateforme » 17.
// Un filtre par genre aurait coupé la bibliothèque en deux moitiés arbitraires.

test("les deux langues d'un même genre se rejoignent", () => {
  assert.deepEqual(normaliserGenres(["Adventure"]), ["Aventure"]);
  assert.deepEqual(normaliserGenres(["Platformer"]), ["Plateforme"]);
  assert.deepEqual(normaliserGenres(["Racing"]), ["Course"]);
  assert.deepEqual(normaliserGenres(["Sports"]), ["Sport"]);
  assert.deepEqual(normaliserGenres(["Fighting"]), ["Combat"]);
  assert.deepEqual(normaliserGenres(["Strategy"]), ["Stratégie"]);
  assert.deepEqual(normaliserGenres(["Horror"]), ["Horreur"]);
  assert.deepEqual(normaliserGenres(["Réflexion"]), ["Puzzle"]);
});

test("la casse et les accents ne créent plus de genres distincts", () => {
  // Saisis à la main, « aventure », « Aventure » et « AVENTURE » produisaient
  // trois entrées dans les filtres.
  assert.deepEqual(normaliserGenres(["aventure", "Aventure", "AVENTURE"]), ["Aventure"]);
  assert.deepEqual(normaliserGenres(["ADVENTURE", "aventure"]), ["Aventure"]);
  assert.deepEqual(normaliserGenres(["  Racing  "]), ["Course"]);
});

test("un genre inconnu garde sa forme", () => {
  // La table corrige des doublons connus ; elle n'impose pas un vocabulaire
  // fermé, sinon un genre saisi à la main disparaîtrait sans prévenir.
  assert.deepEqual(normaliserGenres(["Soulslike", "Musou", "Jeu de société"]),
    ["Soulslike", "Musou", "Jeu de société"]);
});

test("l'ordre est conservé et rien n'apparaît deux fois", () => {
  assert.deepEqual(normaliserGenres(["Action", "Adventure", "Aventure", "Action"]),
    ["Action", "Aventure"]);
  assert.deepEqual(normaliserGenres(["Racing", "Course"]), ["Course"]);
});

test("normaliserGenres est idempotente et supporte n'importe quelle entrée", () => {
  // Idempotente, donc pas besoin d'un numéro de version comme la migration
  // `bcV` : la migration peut la rejouer à chaque chargement.
  const une = normaliserGenres(["Adventure", "Racing"]);
  assert.deepEqual(normaliserGenres(une), une);
  assert.deepEqual(normaliserGenres([]), []);
  assert.deepEqual(normaliserGenres(null), []);
  assert.deepEqual(normaliserGenres("Action"), [], "une chaîne n'est pas une liste de genres");
  assert.deepEqual(normaliserGenres([null, 42, "", "   ", "Action"]), ["Action"]);
});

test("les trois portes d'entrée d'un genre appliquent la table", () => {
  // Le stockage, l'import et l'édition manuelle : si l'une d'elles l'oubliait,
  // le doublon reviendrait par là.
  assert.deepEqual(migrateGames([{ title: "T", genre: ["Adventure", "Racing"] }])[0].genre,
    ["Aventure", "Course"]);

  const { jeux } = validerJeuxImportes([{ id: 1, title: "T", genre: ["Platformer", "Plateforme"] }]);
  assert.deepEqual(jeux[0].genre, ["Plateforme"]);

  const { valeurs } = validerEdition({
    ...brouillonDepuisJeu(jeu()), genre: "Adventure, Racing, action",
  });
  assert.deepEqual(valeurs.genre, ["Aventure", "Course", "Action"]);
});


// ── Filtrer par mode de jeu et par genre ───────────────────────────────────

const avecModes = (...modes) => jeu({ infobox: { modes } });

test("les étiquettes de Wikidata se rangent en trois questions", () => {
  // Elles arrivent telles quelles et ne forment pas un vocabulaire : « solo »,
  // « Solo », « mode coopératif », « joueur contre joueur », « multijoueur en
  // écran divisé / partagé », « two-player video game ».
  assert.deepEqual([...modesDuJeu(avecModes("solo"))], ["solo"]);
  assert.deepEqual([...modesDuJeu(avecModes("Solo"))], ["solo"], "la casse ne compte pas");
  assert.deepEqual([...modesDuJeu(avecModes("multijoueur"))], ["multi"]);
  assert.deepEqual([...modesDuJeu(avecModes("multijoueur en écran divisé / partagé"))], ["multi"]);
  assert.deepEqual([...modesDuJeu(avecModes("two-player video game"))], ["multi"]);
  assert.deepEqual([...modesDuJeu(avecModes("joueur contre joueur"))], ["multi"]);
});

test("le coopératif est aussi un multijoueur", () => {
  // Qui demande « à plusieurs » veut aussi les jeux qu'on ne peut faire
  // qu'ensemble : les exclure serait le contraire de ce qu'il a demandé.
  const coop = modesDuJeu(avecModes("mode coopératif"));
  assert.ok(coop.has("coop"));
  assert.ok(coop.has("multi"));
  // L'inverse est faux : un multijoueur compétitif n'est pas coopératif.
  const versus = modesDuJeu(avecModes("multijoueur", "joueur contre joueur"));
  assert.ok(versus.has("multi"));
  assert.ok(!versus.has("coop"));
});

test("un jeu sans fiche Wikidata ne sort d'aucun filtre par mode", () => {
  // Il ne répond ni oui ni non : le prétendre solo serait inventer.
  const inconnu = jeu();
  assert.equal(modesDuJeu(inconnu).size, 0);
  for (const m of MODES_JEU) assert.equal(jeuALeMode(inconnu, m), false);
  assert.equal(jeuALeMode(inconnu, "tous"), true, "« Tous » ne filtre rien");
  assert.equal(jeuALeMode(undefined, "solo"), false, "une fiche absente ne casse rien");
});

test("les genres présents sont classés par nombre de jeux", () => {
  // Sur cent cinquante jeux, « Action » et un genre porté par un seul titre
  // n'ont pas à se présenter comme deux choix équivalents.
  const bibliotheque = [
    jeu({ genre: ["Action", "Aventure"] }),
    jeu({ genre: ["Action"] }),
    jeu({ genre: ["Action", "RPG"] }),
    jeu({ genre: ["Aventure"] }),
    jeu({ genre: [] }),
  ];
  assert.deepEqual(genresPresents(bibliotheque), [["Action", 3], ["Aventure", 2], ["RPG", 1]]);
  assert.deepEqual(genresPresents([]), []);
  assert.deepEqual(genresPresents(null), []);
});

test("le badge compte les cinq filtres, pas le tri ni l'affichage", () => {
  const aucun = { plat: "tous", pretFil: "tous", fmtFil: "tous", genreFil: "tous", modeFil: "tous" };
  assert.equal(compterFiltres(aucun), 0);
  assert.equal(compterFiltres({ ...aucun, genreFil: "RPG" }), 1);
  assert.equal(compterFiltres({ ...aucun, genreFil: "RPG", modeFil: "coop" }), 2);
  assert.equal(compterFiltres({ plat: "Switch 2", pretFil: "prêtés", fmtFil: "démat", genreFil: "RPG", modeFil: "solo" }), 5);
  // Les anciens appelants ne passaient que trois clés : elles ne doivent pas
  // compter comme des filtres actifs sous prétexte qu'elles sont absentes.
  assert.equal(compterFiltres({ plat: "tous", pretFil: "tous", fmtFil: "tous" }), 0);
});


// ── Rétrocompatibilité : la voir ou non ────────────────────────────────────
//
// Une plateforme récente montrait toujours ses jeux natifs ET ceux de la
// précédente marqués rétrocompatibles, sans qu'on puisse s'y opposer. Sur une
// bibliothèque réelle, demander « Xbox Series X » rendait 101 jeux dont 19
// seulement sont des jeux Series X : les 19 étaient devenus introuvables.

test("une plateforme récente hérite de la précédente, sauf si on le refuse", () => {
  const natif = jeu({ platform: "Xbox Series X" });
  const retro = jeu({ platform: "Xbox One", backCompat: true });
  const pasRetro = jeu({ platform: "Xbox One", backCompat: false });

  // Par défaut : le comportement d'avant, celui qu'on veut pour jouer ce soir.
  assert.equal(jeuSurPlateforme(natif, "Xbox Series X"), true);
  assert.equal(jeuSurPlateforme(retro, "Xbox Series X"), true);
  assert.equal(jeuSurPlateforme(pasRetro, "Xbox Series X"), false);

  // Refusé : la question du collectionneur — qu'ai-je VRAIMENT sur cette console.
  assert.equal(jeuSurPlateforme(natif, "Xbox Series X", false), true);
  assert.equal(jeuSurPlateforme(retro, "Xbox Series X", false), false);
});

test("l'héritage ne va que dans un sens, et « Toutes » ne filtre rien", () => {
  const series = jeu({ platform: "Xbox Series X", backCompat: true });
  // Une console ancienne n'accueille pas les jeux de la récente.
  assert.equal(jeuSurPlateforme(series, "Xbox One"), false);
  assert.equal(jeuSurPlateforme(series, "Xbox One", false), false);
  // Et une plateforme n'hérite pas d'une autre famille.
  assert.equal(jeuSurPlateforme(jeu({ platform: "Switch 1", backCompat: true }), "Xbox Series X"), false);
  for (const avecRetro of [true, false]) {
    assert.equal(jeuSurPlateforme(series, "tous", avecRetro), true);
  }
});

test("le nombre de jeux hérités est annoncé, pas laissé à deviner", () => {
  // « Inclure les jeux rétrocompatibles » ne dit pas s'il y en a deux ou
  // quatre-vingts : la case porte le compte.
  const bibliotheque = [
    jeu({ platform: "Xbox Series X" }),
    jeu({ platform: "Xbox One", backCompat: true }),
    jeu({ platform: "Xbox One", backCompat: true }),
    jeu({ platform: "Xbox One", backCompat: false }),
    jeu({ platform: "Switch 1", backCompat: true }),
  ];
  assert.equal(compterRetro(bibliotheque, "Xbox Series X"), 2);
  assert.equal(compterRetro(bibliotheque, "Switch 2"), 1);
  // Une plateforme qui n'hérite de rien n'a pas de case à cocher.
  assert.equal(compterRetro(bibliotheque, "Xbox One"), 0);
  assert.equal(compterRetro(bibliotheque, "tous"), 0);
  assert.equal(compterRetro(null, "Xbox Series X"), 0);
});


// ── Seuil de note, complétude, sortie, hasard ──────────────────────────────

test("le seuil de note prend au-dessus, pas entre deux bornes", () => {
  // La question n'est pas « lesquels sont entre 80 et 89 » mais « qu'est-ce que
  // j'ai de vraiment bien » : un seuil répond, une tranche oblige à les cocher
  // toutes.
  assert.equal(jeuPasseSeuil(jeu({ metacritic: 95 }), "90"), true);
  assert.equal(jeuPasseSeuil(jeu({ metacritic: 90 }), "90"), true, "le seuil est inclusif");
  assert.equal(jeuPasseSeuil(jeu({ metacritic: 89 }), "90"), false);
  assert.equal(jeuPasseSeuil(jeu({ metacritic: 95 }), "tous"), true);
  // Un jeu sans note ne passe aucun seuil : il n'est pas « mal noté », il
  // n'est pas noté — et c'est le filtre « À compléter » qui le retrouve.
  assert.equal(jeuPasseSeuil(jeu({ metacritic: null }), "70"), false);
  assert.equal(jeuPasseSeuil(jeu({ metacritic: null }), "tous"), true);
});

test("on ne propose de compléter que ce qui manque vraiment", () => {
  // Une option « Jaquette 0 » promettrait du travail inexistant, et une
  // bibliothèque complète ne doit plus rien proposer du tout.
  const bibliotheque = [
    jeu({ cover: "https://a", genre: ["Action"], style: "Un texte", metacritic: 80, infobox: { series: "S" } }),
    jeu({ cover: "https://b", genre: [], style: "", metacritic: null, infobox: null }),
  ];
  assert.deepEqual(completudeManquante(bibliotheque),
    [["genre", "Genre", 1], ["style", "Description", 1], ["metacritic", "Note", 1], ["infobox", "Fiche détaillée", 1]]);
  assert.equal(completudeManquante(bibliotheque).some(([cle]) => cle === "cover"), false,
    "aucune fiche sans jaquette : l'option n'existe pas");

  const complete = [bibliotheque[0]];
  assert.deepEqual(completudeManquante(complete), [], "rien à compléter, plus rien à proposer");
  assert.deepEqual(completudeManquante([]), []);
});

test("le filtre à compléter retient les fiches auxquelles il manque le champ", () => {
  const avec = jeu({ metacritic: 80 });
  const sans = jeu({ metacritic: null });
  assert.equal(jeuACompleter(sans, "metacritic"), true);
  assert.equal(jeuACompleter(avec, "metacritic"), false);
  assert.equal(jeuACompleter(avec, "tous"), true);
  assert.equal(jeuACompleter(jeu({ genre: [] }), "genre"), true);
  assert.equal(jeuACompleter(jeu({ genre: ["Action"] }), "genre"), false);
});

test("la date de sortie est la plus ancienne connue, ou rien", () => {
  // Wikidata en liste une par plateforme : c'est la première qui date le jeu.
  const g = jeu({ infobox: { releases: [{ date: "2017-03-03" }, { date: "2016-11-18" }] } });
  assert.equal(dateDeSortie(g), "2016-11-18");
  assert.equal(dateDeSortie(jeu({ infobox: { releases: [{ date: "pas une date" }] } })), null);
  assert.equal(dateDeSortie(jeu()), null, "sans fiche Wikidata, on ne sait pas");
  assert.equal(dateDeSortie(undefined), null);
  assert.equal(serieDuJeu(jeu({ infobox: { series: "  Halo  " } })), "Halo");
  assert.equal(serieDuJeu(jeu()), "");
});

test("le tri au hasard tient tant qu'on ne redemande pas à mélanger", () => {
  // `Math.random()` dans un comparateur rebattrait les cartes à chaque rendu :
  // la liste danserait sous le doigt à chaque frappe dans la recherche.
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ordre = (graine) => [...ids].sort((a, b) => empreinteMelange(a, graine) - empreinteMelange(b, graine));
  assert.deepEqual(ordre(7), ordre(7), "même graine, même ordre");
  assert.notDeepEqual(ordre(7), ordre(8), "graine différente, autre tirage");
  assert.deepEqual([...ordre(7)].sort((a, b) => a - b), ids, "personne ne disparaît au mélange");
  const v = empreinteMelange(3, 7);
  assert.ok(v >= 0 && v < 1, `empreinte hors bornes : ${v}`);
});


test("un manque comblé ne doit pas emporter le moyen d'enlever son filtre", () => {
  // Le scénario : on filtre sur « Note », on remplit la dernière note, et il
  // n'y a plus rien à compléter. Si le bloc disparaissait alors, on resterait
  // devant zéro jeu, avec un badge annonçant un filtre actif et rien à l'écran
  // pour l'enlever. C'est le composant qui garde le bloc affiché ; ce test
  // vérifie la donnée sur laquelle il s'appuie.
  const complete = [jeu({ cover: "https://a", genre: ["Action"], style: "t", metacritic: 80, infobox: { series: "S" } })];
  assert.deepEqual(completudeManquante(complete), [], "plus aucun manque à proposer");
  assert.equal(compterFichesIncompletes(complete), 0);
  // Et le filtre, lui, ne retient plus rien — d'où la liste vide qu'il faut
  // pouvoir expliquer et défaire.
  assert.equal(jeuACompleter(complete[0], "metacritic"), false);
  assert.equal(jeuACompleter(complete[0], "tous"), true);
});


// ── Deux sources pour une fiche ────────────────────────────────────────────

test("une source ne remplit que le vide et n'écrase jamais", () => {
  const existante = { developers: ["United Front"], publishers: [], releases: [{ date: "2014-10-10" }], modes: [], series: "", follows: "", followedBy: "", sources: ["rawg"] };
  const apport = { developers: ["Square Enix"], publishers: ["Square Enix"], releases: [{ date: "2012-08-14" }], modes: ["Solo"], series: "Sleeping Dogs", follows: "", followedBy: "" };
  const f = fusionnerInfobox(existante, apport, "wikidata");
  // Ce qui était là reste : la date de l'édition possédée survit à Wikipédia,
  // qui ne connaît que celle du jeu d'origine.
  assert.deepEqual(f.developers, ["United Front"]);
  assert.deepEqual(f.releases, [{ date: "2014-10-10" }]);
  // Et ce qui manquait est comblé.
  assert.deepEqual(f.publishers, ["Square Enix"]);
  assert.equal(f.series, "Sleeping Dogs");
  assert.deepEqual(f.sources, ["rawg", "wikidata"]);
});

test("une source qui n'apporte rien n'entre pas dans la provenance", () => {
  const existante = { developers: ["A"], publishers: ["B"], releases: [{ date: "2014-10-10" }], modes: ["Solo"], series: "S", follows: "F", followedBy: "G", sources: ["wikidata"] };
  const f = fusionnerInfobox(existante, { developers: ["Z"], publishers: [], releases: [], modes: [], series: "", follows: "", followedBy: "" }, "rawg");
  assert.deepEqual(f.sources, ["wikidata"], "RAWG n'a rien rempli, il ne se signe pas");
  assert.deepEqual(f.developers, ["A"]);
});

test("une fiche sans infobox en reçoit une, et un apport vide n'en crée pas", () => {
  const f = fusionnerInfobox(null, { developers: ["Sega"], publishers: [], releases: [], modes: [], series: "", follows: "", followedBy: "" }, "rawg");
  assert.deepEqual(f.developers, ["Sega"]);
  assert.deepEqual(f.sources, ["rawg"]);
  assert.equal(fusionnerInfobox(null, null, "rawg"), null);
  assert.equal(fusionnerInfobox(null, { developers: [], publishers: [], releases: [], modes: [], series: "" }, "rawg"), null);
});

test("une infobox d'avant les deux sources est réputée venir de Wikidata", () => {
  assert.deepEqual(sourcesInfobox({ series: "Halo" }), ["wikidata"]);
  assert.deepEqual(sourcesInfobox(null), []);
  assert.deepEqual(sourcesInfobox({ series: "H", sources: ["rawg", "inconnue", "rawg"] }), ["rawg"]);
  assert.equal(libelleSources({ series: "H", sources: ["wikidata", "rawg"] }), "Wikidata et RAWG");
  assert.equal(libelleSources({ series: "H" }), "Wikidata");
});

test("le détail RAWG donne une infobox, avec la date de l'édition possédée", () => {
  const info = infoboxDepuisRawg({
    developers: [{ name: "United Front Games" }], publishers: [{ name: "Square Enix" }],
    released: "2014-10-10",
    tags: [{ name: "Singleplayer" }, { name: "Co-op" }, { name: "Atmospheric" }],
  });
  assert.deepEqual(info.developers, ["United Front Games"]);
  assert.deepEqual(info.releases, [{ date: "2014-10-10" }]);
  // Les tags sont traduits dans le vocabulaire que le filtre par mode sait lire.
  assert.deepEqual(info.modes, ["solo", "coopératif"]);
  assert.deepEqual(info.sources, ["rawg"]);
  // « Atmospheric » n'est pas un mode de jeu.
  assert.ok(!info.modes.includes("Atmospheric"));
});

test("un détail RAWG sans rien d'exploitable ne fabrique pas d'infobox vide", () => {
  assert.equal(infoboxDepuisRawg(null), null);
  assert.equal(infoboxDepuisRawg({ tags: [{ name: "Indie" }], released: "" }), null);
  // Une date que RAWG donne mal ne doit pas entrer telle quelle dans le stock.
  assert.equal(infoboxDepuisRawg({ released: "bientôt" }), null);
  assert.ok(infoboxVide({ developers: [], publishers: [], releases: [], modes: [], series: "" }));
});

test("le vidage ne touche que ce qui est coché et présent", () => {
  const g = jeu({ cover: "https://a", genre: ["Action"], style: "Un texte.", metacritic: 80, infobox: { series: "S" } });
  assert.deepEqual(viderChamps(g, ["infobox", "metacritic"]), { infobox: null, metacritic: null });
  assert.deepEqual(viderChamps(g, ["genre", "style", "cover"]), { genre: [], style: "", cover: null });
  assert.deepEqual(viderChamps(g, []), {});
  // Un champ déjà vide n'est pas réécrit : cocher « Note » sur un jeu sans note
  // ne compte pas comme un vidage.
  assert.deepEqual(viderChamps(jeu({ infobox: { series: "S" } }), ["metacritic", "infobox"]), { infobox: null });
  // Les cinq champs vidables sont ceux que « À compléter » sait retrouver.
  assert.deepEqual(CHAMPS_VIDABLES.map(([c]) => c).sort(), ["cover", "genre", "infobox", "metacritic", "style"]);
});


test("la remise à zéro éteint tous les filtres, un par un", () => {
  assert.equal(compterFiltres(FILTRES_VIDES), 0);
  // Chacun compte pour un, et chacun s'éteint : un filtre absent de FILTRES
  // serait ici invisible, d'où la garde de cohérence sur App.jsx.
  for (const f of FILTRES) {
    assert.equal(compterFiltres({ ...FILTRES_VIDES, [f]: "quelque chose" }), 1, `${f} n'est pas compté`);
  }
  assert.equal(compterFiltres({}), 0, "un état vide n'invente pas de filtre actif");
  assert.equal(compterFiltres(null), 0);
});


// ── Console et PC ──────────────────────────────────────────────────────────

test("un jeu appartient à un univers, et un seul", () => {
  assert.equal(estPC(jeu({ platform: PC })), true);
  assert.equal(estPC(jeu({ platform: "Switch 1" })), false);
  assert.equal(universDuJeu(jeu({ platform: PC })), "pc");
  assert.equal(universDuJeu(jeu({ platform: "Xbox One" })), "console");
  // Une fiche sans plateforme n'est pas un jeu PC par défaut : le PC se déclare.
  assert.equal(universDuJeu({}), "console");
  assert.equal(jeuDansUnivers(jeu({ platform: PC }), "pc"), true);
  assert.equal(jeuDansUnivers(jeu({ platform: PC }), "console"), false);
  assert.ok(PLATFORMES_JEU.includes(PC), "PC doit être une plateforme acceptée à l'édition");
});

test("un jeu PC est toujours démat et jamais rétrocompatible", () => {
  // Même en le demandant explicitement : ces deux champs répondent à des
  // questions de console, et « PC physique » ferait apparaître un jeu Steam
  // dans un filtre « galettes ».
  const { valeurs } = validerEdition(brouillonValide({ platform: PC, format: "physique", backCompat: true, boutique: " Steam " }));
  assert.equal(valeurs.format, "démat");
  assert.equal(valeurs.backCompat, false);
  assert.equal(valeurs.boutique, "Steam", "la boutique est nettoyée de ses espaces");
  // Et une console n'a pas de boutique, même si le brouillon en porte une.
  assert.equal(validerEdition(brouillonValide({ platform: "Switch 1", boutique: "Steam" })).valeurs.boutique, "");
});

test("la migration donne un champ boutique à tout le monde et redresse les PC", () => {
  const [console_, pc] = migrateGames([
    { id: 1, title: "Halo", platform: "Xbox One" },
    { id: 2, title: "Hades", platform: PC, format: "physique", backCompat: true },
  ]);
  assert.equal(console_.boutique, "", "le champ existe même côté console");
  assert.equal(pc.format, "démat");
  assert.equal(pc.backCompat, false);
});

test("les boutiques sont dérivées de la bibliothèque, classées par nombre", () => {
  const g = [
    jeu({ id: 1, platform: PC, boutique: "Steam" }),
    jeu({ id: 2, platform: PC, boutique: "Epic" }),
    jeu({ id: 3, platform: PC, boutique: "Steam" }),
    jeu({ id: 4, platform: PC, boutique: "  " }),
    jeu({ id: 5, platform: "Switch 1", boutique: "Steam" }),
  ];
  // Une console ne compte pas, une boutique vide non plus.
  assert.deepEqual(boutiquesPresentes(g), [["Steam", 2], ["Epic", 1]]);
  assert.deepEqual(boutiquesPresentes([]), []);
  assert.deepEqual(boutiquesPresentes(null), []);
});

test("le filtre par boutique laisse tout passer quand il vaut « tous »", () => {
  const g = jeu({ platform: PC, boutique: "GOG" });
  assert.equal(jeuDeLaBoutique(g, "tous"), true);
  assert.equal(jeuDeLaBoutique(g, "GOG"), true);
  assert.equal(jeuDeLaBoutique(g, "Steam"), false);
});


// ── Le même jeu, ailleurs ──────────────────────────────────────────────────

test("un jeu possédé deux fois se reconnaît au titre normalisé", () => {
  const bib = [
    jeu({ id: 1, title: "Cyberpunk 2077", platform: "Xbox Series X" }),
    jeu({ id: 2, title: "cyberpunk 2077", platform: PC, boutique: "GOG" }),
    jeu({ id: 3, title: "Hadès", platform: "Switch 1" }),
  ];
  const autres = autresEditions(bib[0], bib);
  assert.equal(autres.length, 1);
  assert.deepEqual(autres[0], { id: 2, platform: PC, boutique: "GOG", univers: "pc" });
  // La réciproque tient : depuis la fiche PC on retrouve la console.
  assert.deepEqual(autresEditions(bib[1], bib).map(e => e.platform), ["Xbox Series X"]);
  // Un jeu ne se retrouve jamais lui-même.
  assert.deepEqual(autresEditions(bib[2], bib), []);
});

test("la correspondance est exacte, jamais approximative", () => {
  const bib = [
    jeu({ id: 1, title: "GTA V", platform: "Xbox One" }),
    jeu({ id: 2, title: "Grand Theft Auto V", platform: PC, boutique: "Steam" }),
  ];
  // Un manque silencieux, assumé : mieux vaut ne rien dire que d'affirmer à
  // tort qu'on possède un jeu deux fois.
  assert.deepEqual(autresEditions(bib[0], bib), []);
  // Un titre vide ne rapproche pas toutes les fiches sans titre.
  assert.deepEqual(autresEditions({ id: 9, title: "  " }, bib), []);
  assert.deepEqual(autresEditions(bib[0], null), []);
});

test("le même jeu sur deux consoles compte aussi", () => {
  const bib = [
    jeu({ id: 1, title: "Sonic Mania", platform: "Switch 1" }),
    jeu({ id: 2, title: "Sonic Mania", platform: "Xbox One" }),
  ];
  assert.deepEqual(autresEditions(bib[0], bib).map(e => e.platform), ["Xbox One"]);
});

test("le libellé dit la boutique sur PC, la machine sur console", () => {
  assert.equal(libelleEdition({ univers: "pc", platform: PC, boutique: "Steam" }), "PC · Steam");
  assert.equal(libelleEdition({ univers: "pc", platform: PC, boutique: "" }), "PC");
  assert.equal(libelleEdition({ univers: "console", platform: "Switch 2", boutique: "" }), "Switch 2");
});
