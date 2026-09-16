// Les icônes Android, fabriquées depuis celles du site.
//
// Android ne veut pas une image mais une icône adaptative : deux couches, un
// avant-plan et un fond, que le système recadre en rond, en carré ou en
// « squircle » selon le téléphone. Livrer une seule image carrée donne une
// icône rognée de travers sur la moitié des lanceurs.
//
// Les deux couches ne se dessinent pas pour autant : elles existent déjà. Le
// `maskable` de la PWA est précisément une image qui garde ses marges de
// sécurité, donc un avant-plan valable ; le fond est le noir de l'application,
// le même que `background_color` du manifeste et que l'écran de démarrage.
// Rien de neuf n'est inventé ici, tout est dérivé — c'est pourquoi ce fichier
// est un script et non un dossier d'images dans le dépôt.
//
//   node scripts/icones-android.mjs
//
// Écrit dans `assets/`, que `capacitor-assets` lit ensuite. Les deux dossiers
// sont ignorés par git : ce sont des produits, pas des sources.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const src = (f) => racine + "public/" + f;
const out = (f) => racine + "assets/" + f;

// 1024 px : la taille attendue pour une source d'icône adaptative. Les
// originaux font 512, et l'agrandissement se fait UNE fois ici plutôt qu'une
// fois par densité — au plus proche voisin, parce que ces icônes sont des
// aplats et que le lissage ne ferait que les rendre floues.
const TAILLE = 1024;
// L'écran de démarrage est recadré par le système selon la forme de l'écran :
// il lui faut de la marge, d'où un carré nettement plus grand que le logo.
const SPLASH = 2732;
const NOIR = "#000000";

await mkdir(racine + "assets", { recursive: true });

const agrandir = (f) => sharp(src(f)).resize(TAILLE, TAILLE, { kernel: "nearest" }).png();

await Promise.all([
  // L'icône simple, pour les lanceurs qui ne gèrent pas l'adaptatif.
  agrandir("icon-512.png").toFile(out("icon.png")),
  // L'avant-plan de l'icône adaptative : le maskable, dont les marges ont
  // justement été dessinées pour survivre au recadrage.
  agrandir("icon-512-maskable.png").toFile(out("icon-foreground.png")),
  // Le fond : le noir de l'application, uni.
  sharp({ create: { width: TAILLE, height: TAILLE, channels: 3, background: NOIR } })
    .png().toFile(out("icon-background.png")),
]);

// L'écran de démarrage, clair et sombre. L'application n'a qu'un fond noir au
// lancement — c'est déjà ce que fait la PWA installée — donc les deux sont
// identiques, et le dire explicitement évite que l'outil en invente un autre.
//
// Vérifié depuis, en retirant `splash-dark.png` pour voir : `capacitor-assets`
// engendre alors un écran sombre à lui, d'un gris moyen, au lieu du noir.
// Cette ligne n'est donc pas une précaution mais une correction.
//
// Les deux fichiers étant identiques, les dossiers `night` qu'ils produisent le
// sont aussi, et `elaguer-android.mjs` les retire après coup — 350 Ko d'images
// qu'Android irait chercher pour y trouver exactement la même chose.
const splash = await sharp({ create: { width: SPLASH, height: SPLASH, channels: 3, background: NOIR } })
  .composite([{ input: src("icon-512.png"), gravity: "center" }])
  .png().toBuffer();
await Promise.all([
  sharp(splash).toFile(out("splash.png")),
  sharp(splash).toFile(out("splash-dark.png")),
]);

console.log("assets/ : icône, avant-plan, fond et écran de démarrage écrits depuis public/.");
