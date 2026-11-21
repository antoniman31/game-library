// Contraste du texte, mesuré sur les jetons eux-mêmes (règle commune « Design », 21/11/2026).
//
// Pourquoi : `index.css` annonçait ses ratios en commentaire, mais rien ne les recalculait. Un jeton assombri ou éclairci
// faisait passer une paire sous 4,5:1 sans qu'aucun contrôle ne le voie : `verif:ui` mesure les cibles tactiles, le focus
// et les débordements, pas le contraste (constaté à l'audit du 21/11/2026, alors que CLAUDE.md affirmait le contraire).
//
// Les paires testées sont celles que l'interface pose vraiment : chaque couleur de texte sur chaque fond plein, le texte
// d'accent sur le fond « démat » (badge de boutique), chaque couleur sur son fond translucide « -doux » (badges), et le
// blanc sur l'aplat d'accent et sur la couleur de chaque console. Les aplats `--ok-fond`, `--warn-fond` et
// `--danger-fond` ne portent pas de texte (barres et courbes des statistiques) : ils ne sont pas des paires de texte.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLATEFORMES } from "./model.js";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf-8");
const AA = 4.5;

// Les jetons d'un bloc de règles (`:root { … }`), sans ses commentaires. Le thème clair hérite des jetons du sombre qu'il
// ne redéfinit pas, comme dans le navigateur.
function jetons(selecteur) {
  const debut = css.indexOf(selecteur);
  assert.ok(debut >= 0, `bloc ${selecteur} introuvable dans index.css`);
  const corps = css.slice(debut, css.indexOf("\n}", debut)).replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries([...corps.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)\b/g)].map(m => [m[1], m[2]]));
}
const SOMBRE = jetons(":root {");
const THEMES = { sombre: SOMBRE, clair: { ...SOMBRE, ...jetons('html[data-theme="light"] {') } };

const rvb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// Une couleur à 8 chiffres (« -doux ») est posée sur un fond : on compose, comme l'écran.
function surFond(couleur, fond) {
  if (couleur.length !== 9) return couleur;
  const a = parseInt(couleur.slice(7, 9), 16) / 255, c = rvb(couleur), f = rvb(fond);
  return "#" + c.map((v, i) => Math.round(v * a + f[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
}
// Ratio WCAG 2.x, sur la luminance relative.
function luminance(h) {
  return rvb(h).map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function paires(T) {
  const p = [];
  for (const texte of ["txt", "mut", "accent", "ok", "warn", "danger"])
    for (const fond of ["bg", "hdr", "card"]) p.push([`--${texte} sur --${fond}`, T[texte], T[fond]]);
  p.push(["--accent sur --demat", T.accent, T.demat]);
  for (const c of ["accent", "ok", "warn", "danger"])
    p.push([`--${c} sur --${c}-doux (posé sur --card)`, T[c], surFond(T[`${c}-doux`], T.card)]);
  p.push(["blanc sur --accent-fond", "#ffffff", T["accent-fond"]]);
  return p;
}

for (const [nom, T] of Object.entries(THEMES)) {
  test(`thème ${nom} : chaque texte posé sur un fond atteint 4,5:1`, () => {
    const faibles = paires(T).filter(([, a, b]) => !a || !b || ratio(a, b) < AA)
      .map(([quoi, a, b]) => `${quoi} : ${a && b ? ratio(a, b).toFixed(2) + ":1" : "jeton absent"}`);
    assert.deepEqual(faibles, [], `paires sous 4,5:1 en thème ${nom}`);
  });
}

test("le texte blanc sur la couleur de chaque console atteint 4,5:1 (étiquettes de plateforme)", () => {
  const faibles = PLATEFORMES.filter(p => ratio("#ffffff", p.couleur) < AA)
    .map(p => `${p.id} (${p.couleur}) : ${ratio("#ffffff", p.couleur).toFixed(2)}:1`);
  assert.deepEqual(faibles, []);
});

test("le calcul du ratio est le bon (valeurs de référence WCAG)", () => {
  // Le contrôle du contrôle : noir sur blanc vaut 21:1, une couleur sur elle-même 1:1, et #767676 sur blanc 4,54:1 (le
  // gris le plus clair qui passe AA). Sans cela, un ratio faux donnerait du vert partout.
  assert.equal(ratio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(ratio("#5493ff", "#5493ff").toFixed(2), "1.00");
  assert.equal(ratio("#767676", "#ffffff").toFixed(2), "4.54");
  assert.equal(surFond("#ffffff80", "#000000"), "#808080");
});
