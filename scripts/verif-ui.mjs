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
//   - un texte sous 12 px ;
//   - un champ de saisie sous 16 px (sous quoi Safari iOS zoome tout seul) ;
//   - un débordement horizontal de la page ;
//   - une erreur JavaScript.
//
// Il n'est pas dans `npm test` : il demande un navigateur, là où les autres
// tests tournent sur des modules purs. `npm run verif:ui` construit puis
// mesure, dans cet ordre et sans qu'on ait à y penser.
//
// Cet ordre n'est pas un détail. Le script mesurait un serveur déjà lancé sur
// le port 4173, servant le dernier `dist/` construit — c'est-à-dire, si on
// oubliait de reconstruire, une version antérieure aux corrections qu'on
// venait d'écrire. Un garde-fou qui mesure autre chose que ce qu'on lui
// présente ne dit rien, il rassure. Il sert donc `dist/` lui-même.
//
// CHROMIUM= permet de désigner un binaire précis quand celui de Playwright
// n'est pas celui installé sur la machine. URL= permet de viser un serveur
// déjà lancé, par exemple celui de développement.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../dist/", import.meta.url));
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

// Un serveur statique de quinze lignes plutôt qu'une dépendance et un port à
// lancer à côté : ce qui se lance à côté finit par ne plus être lancé.
function servirDist(port) {
  const s = createServer((req, rep) => {
    let chemin = decodeURIComponent(req.url.split("?")[0]).replace(/^\/game-library/, "");
    if (chemin.endsWith("/")) chemin += "index.html";
    try {
      const corps = readFileSync(join(RACINE, normalize(chemin)));
      rep.writeHead(200, { "content-type": TYPES[extname(chemin)] || "application/octet-stream" });
      rep.end(corps);
    } catch { rep.writeHead(404); rep.end("absent"); }
  });
  return new Promise(res => s.listen(port, () => res(s)));
}

const PORT = 4179;
const serveurLocal = process.env.URL ? null : await servirDist(PORT);
const URL_APP = process.env.URL || `http://localhost:${PORT}/game-library/`;
const PLANCHER_HAUTEUR = 44;   // HIG, WCAG 2.5.5
const PLANCHER_LARGEUR = 24;   // WCAG 2.5.8, pour les commandes en ligne
const PLANCHER_TEXTE = 12;   // plancher d'une pastille ou d'un horodatage
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
    .filter(([t]) => t < 12)
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
  await page.goto(URL_APP, { waitUntil: "networkidle" });
  await page.evaluate(t => localStorage.setItem("gl_theme", t), theme);
  await page.reload({ waitUntil: "networkidle" });

  // Chaque onglet, puis un panneau, puis une fiche dépliée : les défauts de
  // taille se cachent dans ce qui n'est pas affiché au premier écran.
  const etapes = [
    ["Jeux", async () => {}],
    ["Filtres", async () => { await page.getByRole("button", { name: /^Filtres/ }).click(); }],
    // Les groupes sont repliés : sans les ouvrir, leurs puces ne sont pas
    // rendues et ne seraient donc jamais mesurées.
    // Les en-têtes de groupe portent leur valeur courante (« Plateforme
    // Toutes »), ce qui les distingue des puces de même nom ailleurs dans le
    // panneau — sans quoi « Plateforme » désignerait aussi le regroupement.
    ["Filtres · plateforme ouverte", async () => { await page.getByRole("button", { name: /^Plateforme Toutes/ }).click(); }],
    // L'accordéon referme le groupe précédent tout seul : il n'y a rien à
    // refermer avant d'ouvrir le suivant.
    ["Filtres · tous les genres", async () => {
      await page.getByRole("button", { name: /^Genre Tous/ }).click();
      const bouton = page.getByRole("button", { name: /^Tous les genres/ });
      if (await bouton.count()) await bouton.click();
    }],
    ["panneau de tri", async () => {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /^Trier/ }).click();
    }],
    ["fiche dépliée", async () => { await page.keyboard.press("Escape"); await page.locator(".gl-card").first().click(); }],
    ["feuille de vidage", async () => {
      await page.getByRole("button", { name: /Modifier la fiche/ }).first().click();
      await page.getByRole("button", { name: /^🧹 Vider/ }).first().click();
    }],
    ["vue compacte", async () => {
      // La feuille de vidage couvre l'écran : sans cette fermeture, « Filtres »
      // resterait parfaitement visible et parfaitement inatteignable.
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /^Filtres/ }).click();
      await page.getByRole("button", { name: "≡ Compacte" }).click();
      await page.getByRole("button", { name: /^Voir \d+ jeu/ }).click();
    }],
    ["liste groupée par plateforme", async () => {
      await page.getByRole("button", { name: /^Filtres/ }).click();
      await page.getByRole("button", { name: "☰ Liste" }).click();
      await page.getByRole("button", { name: "Plateforme", exact: true }).click();
      await page.getByRole("button", { name: /^Voir \d+ jeu/ }).click();
    }],
    ["retour à la liste simple", async () => {
      await page.getByRole("button", { name: /^Filtres/ }).click();
      await page.getByRole("button", { name: "Aucun", exact: true }).click();
      await page.getByRole("button", { name: /^Voir \d+ jeu/ }).click();
    }],
    ["Prêts", async () => { await page.getByRole("button", { name: /^Prêts/ }).click(); }],
    ["Stats", async () => { await page.getByRole("button", { name: "Stats" }).click(); }],
    ["panneau Actions", async () => {
      await page.getByRole("button", { name: "Actions" }).click();
    }],
    ["Réglages", async () => { await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Réglages" }).click(); }],
    ["Services", async () => { await page.getByRole("button", { name: "Services" }).click(); }],
    // Trois écrans que la promenade ne visitait pas, et où trois défauts ont
    // vécu des mois : des boutons de 26 et 40 px dans la fenêtre d'ajout, et
    // un « Lire la suite » de 20 px sur une fiche assez longue pour l'afficher.
    // Un garde-fou ne protège que ce qu'il regarde.
    ["Ajouter un jeu", async () => {
      await page.getByRole("button", { name: /^Jeux$/ }).click();
      await page.getByRole("button", { name: "+ Ajouter" }).click();
    }],
    ["édition à la main", async () => {
      await page.keyboard.press("Escape");
      await page.locator(".gl-card").first().click();
      await page.getByRole("button", { name: /Modifier la fiche/ }).first().click();
      await page.getByRole("button", { name: /À la main/ }).first().click();
    }],
    // Le bouton « Lire la suite » n'apparaît qu'au-delà de cent soixante
    // caractères de description : on en écrit une par l'édition plutôt que
    // d'espérer en croiser une. Écrire dans `localStorage` ne marcherait pas —
    // au rechargement, la sauvegarde `pagehide` de l'application réécrit la
    // clé avec ce qu'elle a en mémoire.
    ["fiche à longue description", async () => {
      await page.locator("textarea").first().fill(
        "Description délibérément longue pour faire apparaître le bouton de repli, "
        + "qui ne se montre qu'au-delà de cent soixante caractères et n'avait donc "
        + "jamais été mesuré par ce script.");
      await page.getByRole("button", { name: "Enregistrer" }).click();
    }],
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
serveurLocal?.close();
console.log(echecs ? `\n${echecs} constat(s).` : "\nRien à signaler.");
process.exit(echecs ? 1 : 0);
