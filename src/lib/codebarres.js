// Du code-barres d'une boîte au titre d'un jeu.
//
// C'est une expérience, et elle est écrite comme telle. La chaîne a trois
// maillons — la caméra lit un EAN, une base de produits rend un libellé, la
// recherche existante cherche ce libellé — et c'est le deuxième qui décide de
// tout. Rien ne garantit qu'une boîte européenne d'un jeu de 2019 figure dans
// une base de produits dont la raison d'être est le commerce en ligne.
//
// Ce fichier ne contient que ce qui se vérifie sans caméra et sans réseau :
// la validité du code et le nettoyage du libellé. Le reste — l'appel natif,
// l'appel réseau — vit ailleurs, parce que le jour où l'expérience échoue, ce
// qui échouera ne sera pas ici.

// Un EAN-13 porte sa propre clé de contrôle.
//
// La vérifier coûte trois lignes et distingue deux pannes qu'on confondrait
// autrement : « la caméra a mal lu » et « ce produit n'est pas dans la base ».
// Sans elle, un chiffre de travers ressort comme un produit introuvable, et on
// chercherait le défaut du mauvais côté.
export function eanValide(code) {
  const c = String(code || "").trim();
  if (!/^\d{13}$/.test(c)) return false;
  let somme = 0;
  for (let i = 0; i < 12; i++) somme += Number(c[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (somme % 10)) % 10 === Number(c[12]);
}

// Les plateformes que cette bibliothèque connaît, et ce qu'une boîte écrit
// dessus. Une boîte PlayStation ne donne rien : il n'y en a pas ici, et
// inventer une plateforme absente vaudrait moins que ne rien proposer.
//
// Ordre important : « Xbox Series X » avant « Xbox One » avant « Xbox », sans
// quoi le motif le plus court gagnerait sur le plus précis.
const PLATEFORMES_BOITE = [
  [/\bxbox\s*series\s*(x\|?s?|s)?\b/i, "Xbox Series X"],
  [/\bxbox\s*one\b|\bxone\b/i, "Xbox One"],
  [/\bswitch\s*2\b/i, "Switch 2"],
  [/\b(nintendo\s*)?switch\b/i, "Switch 1"],
];

// Ce qu'on retire d'un libellé de produit.
//
// Un libellé de commerce n'est pas un titre : « PS4 Witcher 3: Wild Hunt -
// Game Of The Year », « Jeu Nintendo Switch - Zelda (Version Française) ». Le
// nettoyage reste volontairement timide — il enlève l'emballage, jamais le
// jeu. Retirer « Remastered » ou « Definitive Edition » serait une erreur :
// ce sont des jeux distincts, avec des fiches distinctes.
const BRUIT = [
  /\bjeu(x)?\s+(vid[ée]o\s+)?(pour\s+)?/gi,
  /\b(ps5|ps4|ps3|playstation\s*\d?|psvita|ps\s*vita)\b/gi,
  /\bxbox\s*series\s*(x\|?s?|s)?\b/gi,
  /\bxbox\s*(one|360)\b|\bxone\b/gi,
  /\b(nintendo\s*)?switch\s*2?\b/gi,
  /\b(nintendo\s*)?(wii\s*u|wii|3ds|2ds|ds)\b/gi,
  /\b(pc|windows)\s*(dvd|cd[\s-]*rom)?\b/gi,
  /\bversion\s+fran[çc]aise\b|\b(vf|fr|pal|euro|eu)\b/gi,
  /\b(import|neuf|occasion|blu[\s-]*ray|disque|bo[îi]te)\b/gi,
  /\b[ée]dition\s+standard\b|\bstandard\s+edition\b/gi,
];

// Le libellé d'un produit, ramené à quelque chose qu'on peut chercher.
//
// Rend aussi la plateforme si la boîte la dit, et le libellé d'origine : c'est
// ce dernier qui permet de juger, quand la recherche ne trouve rien, si c'est
// le nettoyage qui a trop coupé ou la base qui s'est trompée de produit.
export function titreDepuisProduit(libelle) {
  const brut = String(libelle || "").trim();
  if (!brut) return { titre: "", plateforme: null, brut: "" };

  const plateforme = PLATEFORMES_BOITE.find(([motif]) => motif.test(brut))?.[1] || null;

  let t = brut;
  // Les parenthèses et crochets d'un libellé de commerce ne portent jamais le
  // titre — ils portent la langue, la région, l'état du produit.
  t = t.replace(/[([][^)\]]*[)\]]/g, " ");
  for (const motif of BRUIT) t = t.replace(motif, " ");
  // Un séparateur resté seul après le nettoyage : « - Zelda », « Zelda : ».
  t = t.replace(/\s+/g, " ").replace(/^[\s\-–—:,/|]+|[\s\-–—:,/|]+$/g, "").trim();

  // Tout enlever revient à n'avoir rien compris : mieux vaut chercher le
  // libellé d'origine qu'une chaîne vide.
  return { titre: t || brut, plateforme, brut };
}
