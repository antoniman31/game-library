// Ce qui est écrit deux fois, et que rien n'obligeait à rester d'accord.
//
// Deux duplications existent dans ce projet, toutes deux délibérées :
//
//   1. Le script anti-clignotement d'`index.html` réécrit la logique de
//      `resoudreTheme()` et les couleurs de `COULEUR_BARRE`. Il le doit : il
//      s'exécute avant que le bundle existe, donc il ne peut rien importer.
//   2. Les couleurs vivent dans `index.css` sous forme de jetons, et
//      `theme.js` ne fait que les nommer. Un jeton nommé mais jamais défini
//      rend du vide.
//
// Dans les deux cas, la dérive est silencieuse. Une couleur de fond changée
// dans le CSS et oubliée dans `index.html`, et la barre d'état du téléphone
// affiche l'ancienne teinte le temps du chargement — personne ne le verra,
// surtout pas celui qui vient de changer la couleur. Un jeton ajouté dans
// `theme.js` sans être défini, et l'élément concerné perd sa couleur sans que
// rien n'échoue.
//
// Ces vérifications ne testent donc pas un comportement de l'application :
// elles vérifient que deux copies d'une même vérité disent la même chose. Le
// jour où elles divergent, la CI le nomme précisément au lieu de laisser le
// défaut arriver chez l'utilisateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resoudreTheme, modeValide, COULEUR_BARRE, MODES } from "./apparence.js";

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf-8");
const html = lire("../../index.html");
const css = lire("../index.css");
const theme = lire("./theme.js");

// Le script inline est exécuté pour de vrai, dans un contexte minimal : on
// compare des comportements, pas des chaînes de caractères. Une réécriture qui
// change la forme sans changer le résultat ne doit pas faire échouer la CI.
function jouerScriptAntiClignotement({ stocke, systemeSombre }) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(scripts.length, 1, "index.html devrait contenir exactement un script inline");

  const meta = { content: null };
  const racine = { dataset: {} };
  const contexte = {
    localStorage: { getItem: (c) => (c === "gl_theme" ? stocke : null) },
    matchMedia: (q) => ({ matches: q.includes("light") ? !systemeSombre : systemeSombre }),
    document: {
      documentElement: racine,
      querySelector: (s) => (s.includes("theme-color") ? meta : null),
    },
  };
  vm.createContext(contexte);
  vm.runInContext(scripts[0], contexte);
  return { theme: racine.dataset.theme, barre: meta.content };
}

test("le script anti-clignotement décide comme resoudreTheme", () => {
  // Toutes les valeurs qui peuvent réellement se trouver dans gl_theme, y
  // compris celles qu'on n'y écrit pas : un stockage corrompu, une version
  // antérieure, un doigt sur la console.
  const stockees = [null, "auto", "light", "dark", "oled", "n'importe quoi", ""];
  for (const stocke of stockees) {
    for (const systemeSombre of [true, false]) {
      const attendu = resoudreTheme(modeValide(stocke), systemeSombre);
      const obtenu = jouerScriptAntiClignotement({ stocke, systemeSombre });
      assert.equal(obtenu.theme, attendu,
        `gl_theme=${JSON.stringify(stocke)}, système ${systemeSombre ? "sombre" : "clair"}`);
    }
  }
});

test("le script anti-clignotement pose la même couleur de barre que l'application", () => {
  // Sans quoi la barre d'état garde l'ancienne teinte le temps du chargement :
  // un défaut qui ne dure qu'une seconde et que personne ne signale jamais.
  for (const systemeSombre of [true, false]) {
    const { theme: t, barre } = jouerScriptAntiClignotement({ stocke: null, systemeSombre });
    assert.equal(barre, COULEUR_BARRE[t], `thème ${t}`);
  }
});

test("la balise theme-color de départ correspond au thème par défaut", () => {
  // Elle s'affiche avant même que le script tourne : si elle porte une couleur
  // d'un autre thème, le cadre autour de l'application clignote au lancement.
  const depart = html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1];
  assert.ok(depart, "la balise theme-color est introuvable dans index.html");
  assert.equal(depart.toLowerCase(), COULEUR_BARRE.dark,
    "le sombre est le thème par défaut quand rien n'est enregistré");
});

test("chaque jeton nommé par theme.js est défini, dans les deux thèmes", () => {
  // Un jeton nommé mais jamais défini rend du vide : l'élément perd sa couleur
  // et rien n'échoue.
  const utilises = [...theme.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]);
  assert.ok(utilises.length > 5, "theme.js devrait nommer plusieurs jetons");

  const bloc = (selecteur) => {
    const debut = css.indexOf(selecteur);
    assert.notEqual(debut, -1, `bloc ${selecteur} introuvable dans index.css`);
    const fin = css.indexOf("}", debut);
    return css.slice(debut, fin);
  };
  const sombre = bloc(":root {");
  const clair = bloc('html[data-theme="light"]');

  for (const jeton of utilises) {
    assert.ok(sombre.includes(`${jeton}:`), `${jeton} n'est pas défini dans :root`);
    assert.ok(clair.includes(`${jeton}:`), `${jeton} n'est pas redéfini pour le thème clair`);
  }
});

test("les modes de thème connus sont exactement ceux que le script sait traiter", () => {
  // Ajouter un quatrième mode sans toucher à index.html laisserait ce mode
  // retomber silencieusement sur l'automatique au chargement.
  assert.deepEqual(MODES, ["auto", "light", "dark"]);
  for (const mode of MODES.filter(m => m !== "auto")) {
    assert.ok(html.includes(`"${mode}"`), `index.html ne reconnaît pas le mode "${mode}"`);
  }
});
