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
  fmtTime, isDusty, staleKey, isBackCompatPlatform,
  BACK_COMPAT, XBOX_SERIES_CUTOFF,
} from "./model.js";

const jeu = (p = {}) => ({
  id: 1, title: "Jeu", platform: "Xbox Series X", format: "physique",
  addedDate: "2022-01-01", genre: [], style: "", status: "non commencé",
  sessions: [], playedMinutes: 0, manualMinutes: 0, myLinks: ["", "", ""],
  tips: "", tag: "", ...p,
});

const ilYA = (jours) => new Date(Date.now() - jours * 86400000).toISOString();

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
    id: 2, title: "X", genre: "action", sessions: 5,
    playedMinutes: -3, manualMinutes: "beaucoup", myLinks: null, tips: 42,
  }]).jeux;
  assert.deepEqual(g.genre, []);
  assert.deepEqual(g.sessions, []);
  assert.equal(g.playedMinutes, 0);
  assert.equal(g.manualMinutes, 0);
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
  assert.equal(compterFiltres({ plat: "tous", statFil: "tous", fmtFil: "tous" }), 0);
  assert.equal(compterFiltres({ plat: "Switch 2", statFil: "tous", fmtFil: "démat" }), 2);
});

test("une plateforme récente accueille la précédente, l'inverse est faux", () => {
  assert.equal(BACK_COMPAT["Xbox Series X"], "Xbox One");
  assert.equal(BACK_COMPAT["Switch 2"], "Switch 1");
  assert.equal(isBackCompatPlatform("Xbox One"), true);
  assert.equal(isBackCompatPlatform("Xbox Series X"), false);
});

test("un jeu en cours devient poussiéreux après 30 jours sans session", () => {
  assert.equal(isDusty(jeu({ status: "en cours", sessions: [{ date: ilYA(40), minutes: 60 }] })), true);
  assert.equal(isDusty(jeu({ status: "en cours", sessions: [{ date: ilYA(5), minutes: 60 }] })), false);
  assert.equal(isDusty(jeu({ status: "terminé", sessions: [{ date: ilYA(400), minutes: 60 }] })), false,
    "un jeu terminé n'est jamais en retard");
});

test("sans session, l'ancienneté se compte depuis la date d'ajout", () => {
  const g = jeu({ status: "en cours", addedDate: "2020-01-01", sessions: [] });
  assert.equal(isDusty(g), true);
  assert.equal(staleKey(g), new Date("2020-01-01").getTime());
});

test("fmtTime rend des durées lisibles", () => {
  assert.equal(fmtTime(0), "0h");
  assert.equal(fmtTime(null), "0h");
  assert.equal(fmtTime(45), "45m");
  assert.equal(fmtTime(60), "1h");
  assert.equal(fmtTime(125), "2h5m");
});
