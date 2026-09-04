// Tests des agrégats de l'onglet Stats.
//
// Un chiffre faux dans un tableau de bord ne se voit pas : il a l'air d'un
// chiffre. Ces vérifications portent donc sur les cas où un calcul naïf se
// trompe — la personne qui emprunte souvent n'est pas celle qui garde
// longtemps, un prêt en cours doit compter comme un prêt, et une moyenne sur
// zéro élément ne doit pas produire NaN.

import { test } from "node:test";
import assert from "node:assert/strict";
import { statsCirculation, statsCollection, lignesDePret } from "./stats.js";

const jeu = (p = {}) => ({
  id: 1, title: "Jeu", platform: "Xbox Series X", format: "physique",
  addedDate: "2022-01-01", genre: [], style: "", cover: null, metacritic: null,
  lentA: null, lentDate: null, lentRetourPrevu: null, pretsPasses: [],
  myLinks: ["", "", ""], tips: "", tag: "", infobox: null, ...p,
});
const ilYA = (jours) => new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);

// ── Circulation ────────────────────────────────────────────────────────────

test("un prêt en cours compte comme un prêt", () => {
  // Sans cela, les chiffres resteraient à zéro tant que rien n'est rendu :
  // l'historique vient d'exister, tout est encore dehors ou jamais sorti.
  const s = statsCirculation([jeu({ lentA: "Paul", lentDate: ilYA(10) })]);
  assert.equal(s.total, 1);
  assert.equal(s.enCours, 1);
  assert.equal(s.jamaisPretes, 0);
  assert.equal(s.dureeMoyenne, 10);
  assert.equal(s.record.enCours, true);
});

test("jamais prêtés ignore l'historique comme les prêts en cours", () => {
  const s = statsCirculation([
    jeu({ id: 1 }),
    jeu({ id: 2, lentA: "Paul", lentDate: ilYA(1) }),
    jeu({ id: 3, pretsPasses: [{ a: "Léa", du: "2024-01-01", au: "2024-01-05" }] }),
  ]);
  assert.equal(s.jamaisPretes, 1);
});

test("le plus fréquent et le plus lent ne sont pas la même personne", () => {
  const s = statsCirculation([
    jeu({ id: 1, pretsPasses: [
      { a: "Paul", du: "2024-01-01", au: "2024-01-03" },
      { a: "Paul", du: "2024-02-01", au: "2024-02-03" },
      { a: "Paul", du: "2024-03-01", au: "2024-03-03" },
    ] }),
    jeu({ id: 2, pretsPasses: [{ a: "Léa", du: "2024-01-01", au: "2024-07-01" }] }),
  ]);
  assert.equal(s.emprunteurs[0].nom, "Paul", "Paul emprunte le plus souvent");
  assert.equal(s.emprunteurs[0].moyenne, 2);
  assert.equal(s.lePlusLent.nom, "Léa", "mais Léa garde bien plus longtemps");
  assert.equal(s.lePlusLent.moyenne, 182);
});

test("les plus prêtés écartent ceux qui ne sont sortis qu'une fois", () => {
  const s = statsCirculation([
    jeu({ id: 1, title: "Deux fois", pretsPasses: [
      { a: "A", du: "2024-01-01", au: "2024-01-02" },
      { a: "B", du: "2024-02-01", au: "2024-02-02" },
    ] }),
    jeu({ id: 2, title: "Une fois", pretsPasses: [{ a: "C", du: "2024-01-01", au: "2024-01-02" }] }),
  ]);
  assert.deepEqual(s.plusPretes.map(j => j.titre), ["Deux fois"]);
});

test("le compteur sur douze mois exclut les prêts plus anciens", () => {
  const s = statsCirculation([jeu({ pretsPasses: [
    { a: "A", du: ilYA(30), au: ilYA(20) },
    { a: "B", du: ilYA(400), au: ilYA(390) },
  ] })]);
  assert.equal(s.total, 2);
  assert.equal(s.surUnAn, 1);
});

test("une bibliothèque sans le moindre prêt ne produit ni NaN ni plantage", () => {
  const s = statsCirculation([jeu()]);
  assert.equal(s.total, 0);
  assert.equal(s.dureeMoyenne, 0);
  assert.equal(s.record, null);
  assert.equal(s.lePlusLent, null);
  assert.deepEqual(s.emprunteurs, []);
  assert.deepEqual(statsCirculation(null).emprunteurs, []);
  assert.deepEqual(lignesDePret(null), []);
});

// ── Collection ─────────────────────────────────────────────────────────────

test("formats, plateformes et rétrocompatibilité s'additionnent", () => {
  const s = statsCollection([
    jeu({ id: 1, platform: "Xbox One", format: "physique", backCompat: true }),
    jeu({ id: 2, platform: "Xbox One", format: "démat", backCompat: false }),
    jeu({ id: 3, platform: "Switch 1", format: "physique", backCompat: true }),
    jeu({ id: 4, platform: "Xbox Series X", format: "physique" }),
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.physique, 3);
  assert.equal(s.demat, 1);
  assert.deepEqual(s.parPlateforme, [["Xbox One", 2], ["Switch 1", 1], ["Xbox Series X", 1]]);
  // Un seul Xbox One est marqué compatible, et Series X n'a pas de parent.
  assert.deepEqual(s.retrocompatibles.sort(), [["Switch 2", 1], ["Xbox Series X", 1]].sort());
});

test("les notes se rangent par tranche, sans compter les jeux sans note", () => {
  const s = statsCollection([
    jeu({ id: 1, title: "Chef-d'œuvre", metacritic: 96 }),
    jeu({ id: 2, metacritic: 84 }),
    jeu({ id: 3, title: "Navet", metacritic: 41 }),
    jeu({ id: 4, metacritic: null }),
    jeu({ id: 5, metacritic: 0 }),
  ]);
  assert.equal(s.note.combien, 3, "ni null ni 0 ne comptent");
  assert.equal(s.note.moyenne, 74);
  assert.equal(s.note.meilleur.titre, "Chef-d'œuvre");
  assert.equal(s.note.pire.titre, "Navet");
  assert.deepEqual(s.note.tranches.map(([l, n]) => [l, n]), [["90 et +", 1], ["80 – 89", 1], ["moins de 60", 1]]);
});

test("un seul jeu noté n'est pas à la fois le meilleur et le pire", () => {
  const s = statsCollection([jeu({ metacritic: 80 })]);
  assert.equal(s.note.meilleur.note, 80);
  assert.equal(s.note.pire, null);
});

test("séries, studios et éditeurs n'apparaissent qu'à partir de deux jeux", () => {
  const info = (p) => ({ developers: [], publishers: [], releases: [], modes: [], series: null, ...p });
  const s = statsCollection([
    jeu({ id: 1, infobox: info({ series: "Halo", developers: ["343"], publishers: ["Xbox"] }) }),
    jeu({ id: 2, infobox: info({ series: "Halo", developers: ["343"], publishers: ["Xbox"] }) }),
    jeu({ id: 3, infobox: info({ series: "Doom", developers: ["id"], publishers: ["Bethesda"] }) }),
  ]);
  assert.deepEqual(s.series, [["Halo", 2]]);
  assert.deepEqual(s.developpeurs, [["343", 2]]);
  assert.deepEqual(s.editeurs, [["Xbox", 2]]);
});

test("la complétude compte ce qui est rempli, pas ce qui manque", () => {
  const s = statsCollection([
    jeu({ id: 1, cover: "https://x/y.jpg", genre: ["Action"], style: "Texte", metacritic: 80, infobox: {} }),
    jeu({ id: 2 }),
  ]);
  assert.deepEqual(s.completude, [
    ["Jaquette", 1], ["Genre", 1], ["Description", 1], ["Note", 1], ["Fiche Wikidata", 1],
  ]);
});

test("les années d'ajout sont chronologiques, et les années creuses valent zéro", () => {
  const s = statsCollection([
    jeu({ id: 1, addedDate: "2024-05-01" }),
    jeu({ id: 2, addedDate: "2022-01-01" }),
    jeu({ id: 3, addedDate: "2022-06-01" }),
    jeu({ id: 4, addedDate: "pas une date" }),
  ]);
  // 2023 n'a rien vu arriver : l'omettre resserrerait le temps et donnerait
  // l'illusion d'un rythme régulier.
  assert.deepEqual(s.parAnnee, [["2022", 2], ["2023", 0], ["2024", 1]]);
  assert.deepEqual(statsCollection([jeu({ addedDate: "pas une date" })]).parAnnee, []);
});

test("une bibliothèque vide ne produit ni NaN ni plantage", () => {
  const s = statsCollection([]);
  assert.equal(s.total, 0);
  assert.equal(s.note.moyenne, 0);
  assert.equal(s.note.meilleur, null);
  assert.deepEqual(s.parPlateforme, []);
  assert.equal(statsCollection(null).total, 0);
});
