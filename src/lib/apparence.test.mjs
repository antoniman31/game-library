// Thème et garde-fous des réglages.
//
// Deux sujets où l'erreur est silencieuse : un thème qui ne suit pas le
// téléphone n'a l'air de rien, et un avertissement de suppression qui ne se
// déclenche pas ne se remarque qu'une fois la valeur perdue.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resoudreTheme, modeSuivant, modeValide, MODES, COULEUR_BARRE } from "./apparence.js";
import { pertesDeReglages, messageDePerte, messageCodeSync } from "./garde-fous.js";

test("seul le mode automatique dépend du téléphone", () => {
  assert.equal(resoudreTheme("auto", true), "dark");
  assert.equal(resoudreTheme("auto", false), "light");
  // Un choix explicite tient, quoi que fasse le système.
  assert.equal(resoudreTheme("light", true), "light");
  assert.equal(resoudreTheme("dark", false), "dark");
});

test("le noir profond décide quel sombre, jamais s'il fait sombre", () => {
  // La variante ne doit pas transformer le clair en noir : c'est une variante
  // du sombre, pas un quatrième mode.
  assert.equal(resoudreTheme("light", true, true), "light");
  assert.equal(resoudreTheme("auto", false, true), "light");
  // Partout où le thème est sombre, elle s'applique — y compris quand c'est
  // l'automatique qui a décidé du sombre, ce qui est le cas courant le soir.
  assert.equal(resoudreTheme("dark", false, true), "oled");
  assert.equal(resoudreTheme("auto", true, true), "oled");
  // Sans la préférence, rien ne change pour qui ne la connaît pas.
  assert.equal(resoudreTheme("dark", false), "dark");
  assert.equal(resoudreTheme("auto", true), "dark");
  // Le cycle du bouton d'en-tête reste à trois pressions.
  assert.equal(MODES.length, 3);
});

test("la barre d'état a une couleur pour chaque thème rendu", () => {
  // Un thème sans couleur laisserait le bleu du manifeste coiffer l'app.
  for (const t of ["light", "dark", "oled"]) {
    assert.match(COULEUR_BARRE[t], /^#[0-9a-f]{6}$/, `${t} n'a pas de couleur de barre`);
  }
  assert.equal(COULEUR_BARRE.oled, "#000000");
});

test("le bouton d'en-tête boucle sur les trois modes", () => {
  assert.equal(modeSuivant("auto"), "light");
  assert.equal(modeSuivant("light"), "dark");
  assert.equal(modeSuivant("dark"), "auto");
  // Trois pressions ramènent au point de départ, pour chaque mode.
  for (const m of MODES) assert.equal(modeSuivant(modeSuivant(modeSuivant(m))), m);
});

test("une valeur stockée inconnue retombe sur l'automatique", () => {
  assert.equal(modeValide("light"), "light");
  assert.equal(modeValide("dark"), "dark");
  assert.equal(modeValide(null), "auto");
  assert.equal(modeValide("n'importe quoi"), "auto");
});

// ── Garde-fous ─────────────────────────────────────────────────────────────

test("seul l'effacement compte comme une perte, pas le remplacement", () => {
  const avant = { rawg: "abc", sgdb: "def", xbl: "", proxy: "https://x" };
  // Remplacer une clé par une autre est une correction.
  assert.deepEqual(pertesDeReglages(avant, { ...avant, rawg: "nouvelle" }), []);
  // Une clé déjà vide ne peut pas être perdue.
  assert.deepEqual(pertesDeReglages(avant, { ...avant, xbl: "" }), []);

  const pertes = pertesDeReglages(avant, { ...avant, rawg: "", proxy: "   " });
  assert.deepEqual(pertes.map(p => p.cle), ["rawg", "proxy"], "les espaces seuls comptent comme vide");
  assert.ok(pertes[1].consequence.includes("synchronisation"), "la conséquence du relais est nommée");
});

test("le message de perte nomme chaque valeur et sa conséquence", () => {
  assert.equal(messageDePerte([]), null, "sans perte, pas de question");
  const m = messageDePerte(pertesDeReglages({ rawg: "abc", sgdb: "def" }, {}));
  assert.match(m, /2 valeurs/);
  assert.match(m, /la clé RAWG/);
  assert.match(m, /la clé SteamGridDB/);
  assert.match(m, /ni l'export, ni la sauvegarde en ligne/);
  assert.match(messageDePerte(pertesDeReglages({ rawg: "abc" }, {})), /une valeur/, "l'accord suit le nombre");
});

test("le code de synchronisation ne se remplace ni ne s'efface en silence", () => {
  assert.equal(messageCodeSync("", "nouveau"), null, "poser un premier code ne détruit rien");
  assert.equal(messageCodeSync("abc", "abc"), null, "un code inchangé ne demande rien");
  assert.match(messageCodeSync("abc", "def"), /Remplacer/);
  assert.match(messageCodeSync("abc", "def"), /inaccessible/);
  assert.match(messageCodeSync("abc", ""), /Effacer/);
  // Effacer ne détruit pas la sauvegarde, il en perd la clé : le message doit
  // dire cette nuance, sans quoi on croit avoir tout perdu.
  assert.match(messageCodeSync("abc", "  "), /existera toujours/);
});
