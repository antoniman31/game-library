import test from "node:test";
import assert from "node:assert/strict";
import { lirePlaynite, analyserImport, jeuxAImporter, jeuDepuisEntree, dateISOdepuisPlaynite, texteDepuisHtml, estLignePC, refImport } from "./playnite.js";
import { PC } from "./model.js";

const ligne = (p = {}) => ({ titre: "Hades", boutique: "Steam", idBoutique: "1145360", ...p });
const texte = (lignes) => JSON.stringify(lignes);

test("un fichier illisible ou d'un autre format se dit, il ne se devine pas", () => {
  assert.match(lirePlaynite("pas du json").erreur, /JSON/);
  assert.match(lirePlaynite('{"jeux": []}').erreur, /tableau/);
  assert.equal(lirePlaynite("[]").erreur, "");
  assert.deepEqual(lirePlaynite("[]").entrees, []);
});

test("une ligne sans titre, de console ou en double est écartée en le disant", () => {
  const { entrees, ignorees } = lirePlaynite(texte([
    ligne(),
    ligne({ titre: "" }),
    ligne({ titre: "Mario Kart 8", plateformes: ["Nintendo Switch"], idBoutique: "mk8" }),
    ligne(),
  ]));
  assert.equal(entrees.length, 1);
  assert.deepEqual(ignorees.map(i => i.raison), ["sans titre", "console ou émulé", "en double dans le fichier"]);
});

test("une plateforme PC, absente ou exotique, reste un jeu PC", () => {
  assert.equal(estLignePC(["PC (Windows)"]), true);
  assert.equal(estLignePC([]), true);
  assert.equal(estLignePC(undefined), true);
  assert.equal(estLignePC(["Linux"]), true);
  assert.equal(estLignePC(["macOS"]), true);
  assert.equal(estLignePC(["Sony PlayStation 5"]), false);
  // « PC Engine » est une console de 1987 : le mot « PC » n'y désigne pas un
  // ordinateur. C'est le prix d'une règle par mots, et il est assumé — une
  // fiche de trop se supprime, une bibliothèque absente ne se devine pas.
  assert.equal(estLignePC(["NEC PC Engine"]), true);
});

test("les dates de Playnite n'ont pas de zéro de tête, et sont parfois incomplètes", () => {
  assert.equal(dateISOdepuisPlaynite("2017-3-3"), "2017-03-03");
  assert.equal(dateISOdepuisPlaynite("2020-11-10"), "2020-11-10");
  // Une année ou un mois seuls ne font pas une date d'ajout.
  assert.equal(dateISOdepuisPlaynite("2017"), "");
  assert.equal(dateISOdepuisPlaynite("2017-3"), "");
  assert.equal(dateISOdepuisPlaynite(""), "");
  // Et une date lisible mais impossible reste refusée, comme partout ailleurs.
  assert.equal(dateISOdepuisPlaynite("0001-1-1"), "");
});

test("la description arrive en HTML et doit finir en texte", () => {
  assert.equal(texteDepuisHtml("<p>Un jeu de <b>rogue</b></p>"), "Un jeu de rogue");
  assert.equal(texteDepuisHtml("Deux<br>lignes"), "Deux\nlignes");
  assert.equal(texteDepuisHtml("Fran&#231;ais &amp; anglais"), "Fran&#231;ais & anglais");
  assert.equal(texteDepuisHtml("a&nbsp;b"), "a b");
  assert.equal(texteDepuisHtml(null), "");
});

test("la référence identifie la ligne par sa boutique, et retombe sur le titre", () => {
  assert.equal(refImport({ boutique: "Steam", refBoutique: "42", titre: "Hades" }), "steam#42");
  assert.equal(refImport({ boutique: "GOG", refBoutique: "", titre: "Hadès !" }), "gog#t:hades");
  // Le même jeu chez deux boutiques est deux lignes, jamais un doublon.
  assert.notEqual(
    refImport({ boutique: "Steam", refBoutique: "", titre: "Hades" }),
    refImport({ boutique: "GOG", refBoutique: "", titre: "Hades" }));
  assert.equal(refImport({ boutique: "", refBoutique: "", titre: "Hades" }), "sans-boutique#t:hades");
});

test("une entrée devient une fiche PC, démat, avec sa boutique et sa provenance", () => {
  const [e] = lirePlaynite(texte([ligne({
    sortie: "2020-9-17", genres: ["Action", "Roguelike"], developpeurs: ["Supergiant Games"],
    editeurs: ["Supergiant Games"], series: ["Hades"], fonctionnalites: ["Single Player"],
    description: "<p>Un rogue-like</p>",
  })])).entrees;
  const [jeu] = jeuxAImporter([{ ...e, jeu: jeuDepuisEntree(e, "2026-09-10") }], 1000);

  assert.equal(jeu.platform, PC);
  assert.equal(jeu.format, "démat");
  assert.equal(jeu.backCompat, false);
  assert.equal(jeu.boutique, "Steam");
  assert.equal(jeu.refBoutique, "1145360");
  // La date de sortie sert de date d'ajout : cent jeux datés d'aujourd'hui ne
  // se trieraient plus.
  assert.equal(jeu.addedDate, "2020-09-17");
  assert.equal(jeu.style, "Un rogue-like");
  assert.deepEqual(jeu.infobox.developers, ["Supergiant Games"]);
  assert.deepEqual(jeu.infobox.modes, ["solo"]);
  assert.deepEqual(jeu.infobox.releases, [{ date: "2020-9-17" }]);
  assert.equal(jeu.infobox.series, "Hades");
  assert.deepEqual(jeu.infobox.sources, ["playnite"]);
  // Les champs que le reste de l'application lit sans précaution sont posés.
  assert.deepEqual(jeu.pretsPasses, []);
  assert.deepEqual(jeu.myLinks, ["", "", ""]);
});

test("une entrée sans rien à dire n'invente pas d'infobox", () => {
  const [e] = lirePlaynite(texte([ligne()])).entrees;
  const jeu = jeuDepuisEntree(e, "2026-09-10");
  assert.equal(jeu.infobox, null);
  assert.equal(jeu.addedDate, "2026-09-10");
});

test("l'analyse sépare le nouveau, le déjà présent et l'écarté", () => {
  const { entrees } = lirePlaynite(texte([
    ligne(),
    ligne({ titre: "Celeste", idBoutique: "504230" }),
    ligne({ titre: "Braid", idBoutique: "26800" }),
  ]));
  const games = [
    { id: 1, platform: PC, title: "Hades", boutique: "Steam", refBoutique: "1145360" },
    // Le même titre sur console n'est pas un doublon : on possède les deux.
    { id: 2, platform: "Switch 1", title: "Celeste", boutique: "", refBoutique: "" },
  ];
  const r = analyserImport(entrees, { games, exclusions: ["steam#26800"] });
  assert.deepEqual(r.deja.map(e => e.titre), ["Hades"]);
  assert.deepEqual(r.deja.map(e => e.idExistant), [1]);
  assert.deepEqual(r.nouveaux.map(e => e.titre), ["Celeste"]);
  assert.deepEqual(r.exclus.map(e => e.titre), ["Braid"]);
});

test("une fiche PC saisie à la main est reconnue par son titre et sa boutique", () => {
  const { entrees } = lirePlaynite(texte([ligne({ titre: "Hollow Knight", idBoutique: "367520" })]));
  const games = [{ id: 3, platform: PC, title: "Hollow Knight", boutique: "Steam", refBoutique: "" }];
  const r = analyserImport(entrees, { games });
  assert.equal(r.nouveaux.length, 0);
  assert.deepEqual(r.deja.map(e => e.idExistant), [3]);
});

test("les identifiants des jeux importés sont distincts", () => {
  const { entrees } = lirePlaynite(texte([ligne(), ligne({ titre: "Celeste", idBoutique: "504230" })]));
  const { nouveaux } = analyserImport(entrees, {});
  const ids = jeuxAImporter(nouveaux, 5000).map(j => j.id);
  assert.deepEqual(ids, [5000, 5001]);
});
