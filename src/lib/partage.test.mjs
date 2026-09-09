import test from "node:test";
import assert from "node:assert/strict";
import { texteListe, ligneJeu } from "./partage.js";

const jeu = (p = {}) => ({ title: "Jeu", platform: "Xbox Series X", format: "", metacritic: null, lentA: null, lentRetourPrevu: null, ...p });

test("une ligne dit le titre, le format et le prêt — et pas la note", () => {
  assert.equal(ligneJeu(jeu({ title: "Halo" })), "- Halo");
  // Le format compte pour qui reçoit la liste : un démat ne s'emprunte pas.
  assert.equal(ligneJeu(jeu({ title: "Halo", format: "démat" })), "- Halo · démat");
  assert.equal(ligneJeu(jeu({ title: "Halo", lentA: "Théo" })), "- Halo · prêté à Théo");
  // La note sert à trier sa propre bibliothèque, pas à conseiller quelqu'un.
  assert.equal(ligneJeu(jeu({ title: "Halo", metacritic: 87, format: "physique" })), "- Halo · physique");
  assert.equal(ligneJeu(jeu({ title: "Nul", metacritic: 0 })), "- Nul");
  assert.equal(ligneJeu({}), "- Sans titre");
});

test("un jeu prêté dit jusqu'à quand, quand la date a été convenue", () => {
  assert.equal(
    ligneJeu(jeu({ title: "Halo", format: "physique", metacritic: 87, lentA: "Théo", lentRetourPrevu: "2026-10-15" })),
    "- Halo · physique · prêté à Théo, retour le 15/10/2026");
  // Le prêt sans date convenue ne doit pas inventer d'échéance.
  assert.equal(ligneJeu(jeu({ title: "Halo", lentA: "Théo", lentRetourPrevu: "" })), "- Halo · prêté à Théo");
  // Ni une date illisible produire un « retour le Invalid Date ».
  assert.equal(ligneJeu(jeu({ title: "Halo", lentA: "Théo", lentRetourPrevu: "bientôt" })), "- Halo · prêté à Théo");
});

test("la liste groupe par plateforme et classe alphabétiquement", () => {
  const t = texteListe([
    jeu({ title: "Zelda", platform: "Switch 1" }),
    jeu({ title: "Alan Wake", platform: "Xbox Series X" }),
    jeu({ title: "Animal Crossing", platform: "Switch 1" }),
  ]);
  const lignes = t.split("\n");
  assert.equal(lignes[0], "Ma ludothèque — 3 jeux");
  // Les plateformes dans l'ordre, les jeux dans l'ordre — et non le tri qu'on
  // s'était choisi pour soi, qui peut être un tirage au hasard.
  assert.deepEqual(lignes.filter(l => /^\S.*\(\d+\)$/.test(l)), ["Switch 1 (2)", "Xbox Series X (1)"]);
  assert.ok(t.indexOf("- Animal Crossing") < t.indexOf("- Zelda"));
});

test("les jeux prêtés restent dans la liste, et le total le dit", () => {
  const t = texteListe([jeu({ title: "Halo", lentA: "Théo" }), jeu({ title: "Forza" })]);
  assert.ok(t.includes("- Halo · prêté à Théo"), "le jeu prêté figure bien dans la liste");
  assert.ok(t.includes("- Forza"));
  assert.ok(t.includes("1 jeu déjà prêté — dispo au retour."));
  // Rien de prêté, rien à dire.
  assert.ok(!texteListe([jeu({ title: "Forza" })]).includes("déjà prêté"));
});

test("une plateforme absente ne fabrique pas un groupe sans nom", () => {
  const t = texteListe([{ title: "Machin" }]);
  assert.ok(t.includes("Autres (1)"));
});

test("une liste vide se dit au lieu de produire un texte à trous", () => {
  assert.equal(texteListe([]), "Ma ludothèque — aucun jeu.");
  assert.equal(texteListe(null, "Mes jeux Switch"), "Mes jeux Switch — aucun jeu.");
});
