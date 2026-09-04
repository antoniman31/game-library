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
  BACK_COMPAT, XBOX_SERIES_CUTOFF, PRET_LONG_JOURS,
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
  assert.deepEqual(valeurs.infobox, g.infobox);
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
