import { test } from "node:test";
import assert from "node:assert/strict";
import { adresseDirecte, adresseAppel, CIBLES } from "./relais.js";

test("chaque chemin relayé connaît sa source", () => {
  assert.equal(adresseDirecte("/sgdb/search/autocomplete/zelda"),
    "https://www.steamgriddb.com/api/v2/search/autocomplete/zelda");
  assert.equal(adresseDirecte("/xbl/player/titleHistory"), "https://xbl.io/api/v2/player/titleHistory");
  assert.equal(adresseDirecte("/steam/appdetails?appids=12"), "https://store.steampowered.com/api/appdetails?appids=12");
});

test("un chemin inconnu n'est pas deviné", () => {
  assert.equal(adresseDirecte("/sync"), null);
  assert.equal(adresseDirecte("/rawg/games"), null);
  assert.equal(adresseDirecte(""), null);
  assert.equal(adresseDirecte(null), null);
});

test("un préfixe n'en avale pas un autre", () => {
  // Sans la barre obligatoire, /steamdb partirait chez Steam avec « db »
  // collé devant son chemin.
  assert.equal(adresseDirecte("/steamdb/quelque-chose"), null);
  assert.equal(adresseDirecte("/xblague"), null);
});

test("sur le web on passe par le relais", () => {
  assert.equal(adresseAppel("/sgdb/x", { natif: false, proxy: "https://relais.dev" }),
    "https://relais.dev/sgdb/x");
  // Une barre finale de trop ne doit pas en produire deux.
  assert.equal(adresseAppel("/sgdb/x", { natif: false, proxy: "https://relais.dev///" }),
    "https://relais.dev/sgdb/x");
});

test("sans relais, le web reste en chemins relatifs", () => {
  assert.equal(adresseAppel("/sgdb/x", { natif: false, proxy: "" }), "/sgdb/x");
  assert.equal(adresseAppel("/sgdb/x", {}), "/sgdb/x");
});

test("en natif on va à la source, relais configuré ou non", () => {
  for (const proxy of ["", "https://relais.dev"]) {
    assert.equal(adresseAppel("/sgdb/x", { natif: true, proxy }), "https://www.steamgriddb.com/api/v2/x");
  }
});

test("en natif, ce qui n'est pas relayé passe toujours par le relais", () => {
  // /sync n'est pas un relais mais un espace de stockage : sans Worker il n'y
  // a rien à joindre, et l'application native n'y change rien.
  assert.equal(adresseAppel("/sync", { natif: true, proxy: "https://relais.dev" }), "https://relais.dev/sync");
});

test("la table reste alignée sur celle du Worker", () => {
  assert.deepEqual(Object.keys(CIBLES).sort(), ["/sgdb", "/steam", "/xbl"]);
});
