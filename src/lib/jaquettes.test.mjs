// Les parties du stockage des jaquettes qui ne demandent ni téléphone ni
// réseau : le nom de fichier, l'index, et la liste de ce qui reste à
// descendre. Le téléchargement lui-même appartient au système de fichiers
// natif, qui n'existe pas ici.

import test from "node:test";
import assert from "node:assert/strict";

// `localStorage` n'existe pas dans Node : le module en lit un au chargement.
globalThis.localStorage = {
  _: new Map(),
  getItem(k) { return this._.has(k) ? this._.get(k) : null; },
  setItem(k, v) { this._.set(k, String(v)); },
  removeItem(k) { this._.delete(k); },
};

const { nomFichier, lireIndex, aDescendre } = await import("./jaquettes.js");

test("un nom de fichier est stable, distinct et garde l'extension", () => {
  const a = "https://cdn2.steamgriddb.com/grid/abc.png";
  const b = "https://cdn2.steamgriddb.com/grid/abd.png";
  // Stable : deux appels sur la même URL doivent nommer le même fichier, sinon
  // chaque descente en créerait un de plus.
  assert.equal(nomFichier(a), nomFichier(a));
  assert.notEqual(nomFichier(a), nomFichier(b));
  assert.match(nomFichier(a), /\.png$/);
  assert.match(nomFichier("https://x/y.JPG?v=2"), /\.jpg$/);
  // Une adresse sans extension reste nommable.
  assert.match(nomFichier("https://media.rawg.io/media/games/xyz"), /\.img$/);
});

test("un index absent ou abîmé rend un objet vide, pas une exception", () => {
  localStorage.removeItem("gl_jaquettes");
  assert.deepEqual(lireIndex(), {});
  localStorage.setItem("gl_jaquettes", "pas du json");
  assert.deepEqual(lireIndex(), {});
  // Un tableau n'est pas un index : le prendre ferait échouer la lecture des
  // clés plus loin, au moment d'afficher une fiche.
  localStorage.setItem("gl_jaquettes", "[1,2,3]");
  assert.deepEqual(lireIndex(), {});
});

test("on ne descend ni deux fois la même image, ni ce qui est déjà là", () => {
  const partagee = "https://cdn2.steamgriddb.com/grid/meme.png";
  const jeux = [
    { cover: partagee },                       // le même jeu chez deux boutiques
    { cover: partagee },
    { cover: "https://media.rawg.io/a.jpg" },
    { cover: "" },                             // sans jaquette
    { cover: "data:image/png;base64,AAAA" },   // pas une adresse à descendre
    {},
  ];
  assert.deepEqual(aDescendre(jeux, {}), [partagee, "https://media.rawg.io/a.jpg"]);
  // Ce que l'index connaît déjà ne repart pas : c'est ce qui rend l'opération
  // reprenable après une interruption.
  assert.deepEqual(aDescendre(jeux, { [partagee]: "jaquettes/x.png" }),
    ["https://media.rawg.io/a.jpg"]);
  assert.deepEqual(aDescendre([], {}), []);
  assert.deepEqual(aDescendre(null, {}), []);
});
