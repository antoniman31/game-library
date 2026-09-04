// Ce qu'on ne voit pas en relisant le code.
//
// Les règles d'ergonomie tactile portent sur des pixels rendus, pas sur des
// déclarations : un bouton peut être écrit correctement et mesurer 34 px une
// fois la police appliquée, la marge héritée et la ligne calculée. Trois
// défauts de la phase 13 étaient exactement de cette nature — des cibles sous
// le plancher, un texte sous le seuil de lisibilité, un libellé tronqué — et
// aucun n'était visible autrement qu'en mesurant.
//
// Ce script ouvre l'application construite, à la largeur de deux téléphones
// courants, dans les deux thèmes, et échoue s'il trouve :
//   - une cible interactive sous 44 × 24 px (Apple HIG, WCAG 2.5.5) ;
//   - un texte sous 11 px ;
//   - un champ de saisie sous 16 px (sous quoi Safari iOS zoome tout seul) ;
//   - un débordement horizontal de la page ;
//   - une erreur JavaScript.
//
// Il n'est pas dans `npm test` : il demande un navigateur et un serveur, là où
// les autres tests tournent sur des modules purs. Il se lance à la main avant
// une modification d'interface un peu large :
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/verif-ui.mjs
//
// CHROMIUM= permet de désigner un binaire précis quand celui de Playwright
// n'est pas celui installé sur la machine.

import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4173/game-library/";
const PLANCHER_HAUTEUR = 44;   // HIG, WCAG 2.5.5
const PLANCHER_LARGEUR = 24;   // WCAG 2.5.8, pour les commandes en ligne
const PLANCHER_TEXTE = 11;
const PLANCHER_CHAMP = 16;     // au-dessous, Safari iOS zoome à la prise de focus

const ECRANS = [[360, "dark"], [360, "light"], [412, "dark"]];

// Mesuré dans la page : ce que le navigateur affiche vraiment.
const mesurer = () => ({
  debordement: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  // La surface sensible d'une case à cocher enveloppée dans un <label> est
  // celle du label entier : mesurer la case seule signalerait un faux défaut.
  cibles: [...new Set([...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
    .map(el => [el, (el.closest("label") || el).getBoundingClientRect()])
    .filter(([, b]) => b.width && b.height)
    .filter(([, b]) => b.height < 43.5 || b.width < 23.5)
    .map(([el, b]) => {
      const nom = (el.innerText || el.getAttribute("aria-label") || el.type || el.tagName).trim().slice(0, 28);
      return `${nom} — ${Math.round(b.width)}×${Math.round(b.height)}`;
    }))],
  textes: [...new Set([...document.querySelectorAll("*")]
    .filter(el => !el.children.length && el.textContent.trim())
    .map(el => [parseFloat(getComputedStyle(el).fontSize), el.textContent.trim().slice(0, 24)])
    .filter(([t]) => t < 11)
    .map(([t, c]) => `${Math.round(t)}px — ${c}`))],
  champs: [...new Set([...document.querySelectorAll("input, textarea, select")]
    .map(el => parseFloat(getComputedStyle(el).fontSize))
    .filter(t => t < 16))],
  // Un libellé coupé par `text-overflow` fait passer l'écran pour cassé.
  tronques: [...new Set([...document.querySelectorAll("button, a, span, div")]
    .filter(el => !el.children.length && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim())
    .map(el => el.textContent.trim().slice(0, 28)))],
});

let echecs = 0;
const signaler = (ou, quoi, details) => {
  echecs++;
  console.log(`✕ ${ou} — ${quoi}`);
  for (const d of details) console.log(`    ${d}`);
};

const nav = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

for (const [largeur, theme] of ECRANS) {
  const ctx = await nav.newContext({
    viewport: { width: largeur, height: 800 },
    // Sans quoi le service worker de la PWA sert sa propre copie de la page.
    serviceWorkers: "block",
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", e => erreurs.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(t => localStorage.setItem("gl_theme", t), theme);
  await page.reload({ waitUntil: "networkidle" });

  // Chaque onglet, puis un panneau, puis une fiche dépliée : les défauts de
  // taille se cachent dans ce qui n'est pas affiché au premier écran.
  const etapes = [
    ["Jeux", async () => {}],
    ["Filtres", async () => { await page.getByRole("button", { name: /^Filtres/ }).click(); }],
    ["fiche dépliée", async () => { await page.keyboard.press("Escape"); await page.locator(".gl-card").first().click(); }],
    ["Prêts", async () => { await page.getByRole("button", { name: /^Prêts/ }).click(); }],
    ["Stats", async () => { await page.getByRole("button", { name: "Stats" }).click(); }],
    ["Réglages", async () => { await page.getByRole("button", { name: "Réglages" }).click(); }],
    ["Services", async () => { await page.getByRole("button", { name: "Services" }).click(); }],
  ];

  for (const [nom, aller] of etapes) {
    await aller();
    await page.waitForTimeout(150);
    const r = await page.evaluate(mesurer);
    const ou = `${largeur}px ${theme} · ${nom}`;
    if (r.debordement) signaler(ou, "la page déborde horizontalement", []);
    if (r.cibles.length) signaler(ou, `${r.cibles.length} cible(s) sous ${PLANCHER_HAUTEUR}×${PLANCHER_LARGEUR} px`, r.cibles);
    if (r.textes.length) signaler(ou, `texte sous ${PLANCHER_TEXTE} px`, r.textes);
    if (r.champs.length) signaler(ou, `champ sous ${PLANCHER_CHAMP} px (zoom iOS)`, r.champs.map(t => `${t}px`));
    if (r.tronques.length) signaler(ou, "libellé tronqué", r.tronques);
  }

  if (erreurs.length) signaler(`${largeur}px ${theme}`, "erreur JavaScript", erreurs);
  await ctx.close();
}

await nav.close();
console.log(echecs ? `\n${echecs} constat(s).` : "\nRien à signaler.");
process.exit(echecs ? 1 : 0);
