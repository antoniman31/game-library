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

// ── Ce que les nouveaux agrégats doivent éviter de dire ────────────────────

test("la ponctualité ne juge que les prêts qui avaient une date", () => {
  const s = statsCirculation([
    // Rendu deux jours après la date convenue.
    jeu({ id: 1, pretsPasses: [{ a: "Paul", du: "2024-01-01", au: "2024-01-12", prevu: "2024-01-10" }] }),
    // Rendu trois jours avant.
    jeu({ id: 2, pretsPasses: [{ a: "Léa", du: "2024-02-01", au: "2024-02-07", prevu: "2024-02-10" }] }),
    // Sans date convenue : une entrée d'avant, qui ne doit pas passer pour
    // ponctuelle sous prétexte qu'elle n'a rien promis.
    jeu({ id: 3, pretsPasses: [{ a: "Max", du: "2024-03-01", au: "2024-03-30" }] }),
  ]);
  assert.equal(s.ponctualite.combien, 2);
  assert.equal(s.ponctualite.aLHeure, 1);
  assert.equal(s.ponctualite.enRetard, 1);
  // +2 et −3 : l'écart moyen penche du côté de l'avance. Math.round aurait
  // rendu −0 ici, parce qu'il arrondit −0,5 vers le haut : le biais aurait
  // toujours joué contre l'emprunteur.
  assert.equal(s.ponctualite.ecartMoyen, -1);
  assert.equal(s.ponctualite.pire.titre, "Jeu");
  assert.equal(s.ponctualite.pire.jours, 2);
  // Un prêt encore dehors, dont la date est dépassée, n'est pas « rendu en
  // retard » : il n'est pas rendu. Il est signalé ailleurs, pas ici.
  const enCours = statsCirculation([
    jeu({ id: 1, lentA: "Max", lentDate: ilYA(70), lentRetourPrevu: ilYA(10) }),
  ]);
  assert.equal(enCours.ponctualite, null);
  assert.equal(enCours.enRetard, 1, "il reste compté comme prêt en retard, ailleurs");
  assert.equal(enCours.dehors[0].titre, "Jeu");

  // Aucune date convenue nulle part : le bloc n'a rien à dire et disparaît.
  assert.equal(statsCirculation([jeu({ pretsPasses: [{ a: "Max", du: "2024-03-01", au: "2024-03-30" }] })]).ponctualite, null);
});

test("la rotation compte les jeux sortis, pas les prêts", () => {
  const s = statsCirculation([
    // Trois prêts, mais un seul jeu : la rotation vaut un tiers, pas 100 %.
    jeu({ id: 1, pretsPasses: [
      { a: "Paul", du: "2024-01-01", au: "2024-01-05" },
      { a: "Léa", du: "2024-02-01", au: "2024-02-05" },
      { a: "Max", du: "2024-03-01", au: "2024-03-05" },
    ] }),
    jeu({ id: 2 }), jeu({ id: 3 }),
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.rotation.sortis, 1);
  assert.equal(s.rotation.pourcent, 33);
  assert.equal(s.personnesDistinctes, 3);
});

test("les douze derniers mois gardent les mois vides et ignorent le reste", () => {
  const s = statsCollection([
    jeu({ id: 1, addedDate: "2026-09-04" }),
    jeu({ id: 2, addedDate: "2015-01-01" }), // hors fenêtre : ne doit pas y entrer
  ]);
  assert.equal(s.parMoisAjout.length, 12);
  assert.equal(s.parMoisAjout.reduce((a, [, n]) => a + n, 0), 1, "seul le mois dans la fenêtre compte");
  assert.ok(s.parMoisAjout.every(([cle]) => /^\d{4}-\d{2}$/.test(cle)));
});

test("la médiane des notes ne suit pas la moyenne", () => {
  // 20, 88, 90 : moyenne 66, médiane 88. Une seule bouse ne doit pas faire
  // passer une bonne collection pour médiocre.
  const s = statsCollection([
    jeu({ id: 1, metacritic: 20 }), jeu({ id: 2, metacritic: 88 }), jeu({ id: 3, metacritic: 90 }),
  ]);
  assert.equal(s.note.moyenne, 66);
  assert.equal(s.note.mediane, 88);
});

test("une moyenne par groupe demande au moins trois jeux notés", () => {
  const s = statsCollection([
    ...[90, 80, 70].map((n, i) => jeu({ id: i + 1, platform: "Switch 1", metacritic: n })),
    jeu({ id: 4, platform: "Xbox One", metacritic: 100 }),
  ]);
  assert.deepEqual(s.noteParPlateforme, [["Switch 1", 80, 3]], "Xbox One n'a qu'un jeu noté");
});

test("les doublons distinguent l'achat multiplateforme de la saisie en double", () => {
  const d = statsCollection([
    jeu({ id: 1, title: "Halo", platform: "Xbox One" }),
    jeu({ id: 2, title: "halo", platform: "Xbox Series X" }),
    jeu({ id: 3, title: "Zelda", platform: "Switch 1" }),
    jeu({ id: 4, title: "Zelda", platform: "Switch 1" }),
  ]).doublons;
  // La saisie en double passe devant : c'est la seule erreur certaine.
  assert.equal(d[0].titre, "Zelda");
  assert.equal(d[0].memePlateforme, true);
  assert.equal(d[1].memePlateforme, false, "le même jeu sur deux consoles n'est pas une erreur");
});

test("un épisode manquant n'est signalé que s'il manque vraiment", () => {
  const s = statsCollection([
    jeu({ id: 1, title: "Halo 5", infobox: { follows: "Halo 4", followedBy: "Halo Infinite" } }),
    jeu({ id: 2, title: "Halo Infinite", infobox: { follows: "Halo 5" } }),
  ]);
  assert.deepEqual(s.seriesIncompletes.map(m => m.titre), ["Halo 4"]);
  assert.deepEqual(s.seriesIncompletes[0].depuis, ["Halo 5"]);
});

test("le délai d'achat ignore les dates impossibles", () => {
  const s = statsCollection([
    jeu({ id: 1, addedDate: "2024-01-01", infobox: { releases: [{ date: "2023-01-01" }] } }),
    // Ajouté avant sa propre sortie : une date fausse, pas un achat anticipé.
    jeu({ id: 2, addedDate: "2020-01-01", infobox: { releases: [{ date: "2023-01-01" }] } }),
    jeu({ id: 3, addedDate: "2024-01-01" }),
  ]);
  assert.equal(s.delaiAchat.combien, 1);
  assert.equal(s.delaiAchat.median, 365);
  assert.equal(s.delaiAchat.apresUnAn, 0, "365 jours ne fait pas encore plus d'un an");
  assert.equal(statsCollection([jeu({ id: 1 })]).delaiAchat, null);
});

test("l'âge des jeux se lit sur la sortie la plus ancienne, pas la première listée", () => {
  const s = statsCollection([
    jeu({ id: 1, infobox: { releases: [{ date: "2021-11-15", platform: "Xbox Series X" }, { date: "2009-03-01", platform: "Xbox 360" }] } }),
  ]);
  assert.deepEqual(s.parDecennie, [["2000", 1]]);
});

test("la date du calcul est une entrée, pas une lecture cachée de l'horloge", () => {
  // Un prêt en cours se mesure jusqu'à « aujourd'hui ». Tant que l'horloge
  // était lue à l'intérieur, l'application ouverte trois jours affichait
  // encore l'avant-veille, et rien ne pouvait le corriger.
  const jeux = [jeu({ id: 1, lentA: "Paul", lentDate: "2026-01-01" })];
  assert.equal(statsCirculation(jeux, "2026-01-11").dureeMoyenne, 10);
  assert.equal(statsCirculation(jeux, "2026-01-14").dureeMoyenne, 13);
  // La fenêtre des douze mois suit la même date.
  const s = statsCollection([jeu({ id: 1, addedDate: "2026-01-05" })], "2026-01-31");
  assert.equal(s.parMoisAjout.at(-1)[0], "2026-01");
  assert.equal(statsCollection([jeu({ id: 1, addedDate: "2026-01-05" })], "2027-06-01").parMoisAjout.at(-1)[0], "2027-06");
});
