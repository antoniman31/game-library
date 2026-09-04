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
export const resoudreTheme = (mode, systemeSombre) =>
  mode === "auto" ? (systemeSombre ? "dark" : "light") : mode === "light" ? "light" : "dark";

// Ordre du cycle du bouton d'en-tête : automatique, clair, sombre.
export const modeSuivant = (mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length];

// Une valeur inconnue — un stockage corrompu, une version antérieure —
// retombe sur l'automatique plutôt que d'imposer un thème arbitraire. Les
// anciennes valeurs "light" et "dark" restent valides telles quelles.
export const modeValide = (v) => (MODES.includes(v) ? v : "auto");
