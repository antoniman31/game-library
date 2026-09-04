// Choix du thème : automatique, clair, sombre.
//
// L'application ne connaissait que deux états et ignorait le réglage du
// téléphone. Un appareil qui bascule en sombre le soir laissait donc une
// application restée en clair, et le seul remède était d'aller le changer à
// la main dans les paramètres — puis de le rechanger le matin.
//
// « Automatique » est le défaut : c'est le seul qui n'oblige à rien. Les deux
// autres existent parce qu'un réglage système ne convient pas toujours à une
// application donnée, et parce qu'un choix explicite doit tenir.

export const MODES = ["auto", "light", "dark"];
export const LIBELLES = { auto: "Automatique", light: "Clair", dark: "Sombre" };
export const ICONES = { auto: "🌗", light: "☀️", dark: "🌙" };

// Le mode stocké se traduit en thème réellement appliqué. Seul « auto »
// dépend du système ; les autres tiennent, quoi que fasse le téléphone.
//
// `oled` n'est pas un quatrième mode mais une variante du sombre, et c'est
// pour ça qu'il est un paramètre séparé : en faire un pair d'auto/clair/sombre
// aurait allongé le cycle du bouton d'en-tête à quatre pressions, et surtout
// l'aurait rendu incompatible avec l'automatique — où l'on veut le noir
// profond *quand* le téléphone passe en sombre, pas à la place.
export const resoudreTheme = (mode, systemeSombre, noirProfond = false) => {
  const sombre = mode === "auto" ? systemeSombre : mode !== "light";
  return sombre ? (noirProfond ? "oled" : "dark") : "light";
};

// Couleur de la barre d'état du téléphone. Elle suit le fond de l'app, sinon
// le bleu du manifeste coiffe une application noire.
export const COULEUR_BARRE = { light: "#dde6f8", dark: "#12122a", oled: "#000000" };

// Ordre du cycle du bouton d'en-tête : automatique, clair, sombre.
export const modeSuivant = (mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length];

// Une valeur inconnue — un stockage corrompu, une version antérieure —
// retombe sur l'automatique plutôt que d'imposer un thème arbitraire. Les
// anciennes valeurs "light" et "dark" restent valides telles quelles.
export const modeValide = (v) => (MODES.includes(v) ? v : "auto");
