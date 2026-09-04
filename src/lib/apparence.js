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

// La valeur stockée reste "dark" : c'est ce qu'elle affiche qui a changé, et
// un réglage déjà enregistré n'a donc rien à migrer.
export const MODES = ["auto", "light", "dark"];
export const LIBELLES = { auto: "Automatique", light: "Clair", dark: "Noir profond" };
export const ICONES = { auto: "🌗", light: "☀️", dark: "🌑" };

// Le mode stocké se traduit en thème réellement appliqué. Seul « auto »
// dépend du système ; les autres tiennent, quoi que fasse le téléphone.
//
// Le noir profond a d'abord été une préférence à part, applicable par-dessus
// le sombre. Elle faisait un quatrième bouton dans un panneau qui en comptait
// déjà trois pour la même question, et pour un choix qui n'en était pas un :
// entre un bleu nuit et un vrai noir, on tranche une fois. Le sombre EST le
// noir profond, et l'automatique y bascule le soir comme avant.
export const resoudreTheme = (mode, systemeSombre) =>
  mode === "auto" ? (systemeSombre ? "dark" : "light") : mode === "light" ? "light" : "dark";

// Couleur de la barre d'état du téléphone. Elle suit le fond de l'app, sinon
// le bleu du manifeste coiffe une application noire.
export const COULEUR_BARRE = { light: "#dde6f8", dark: "#000000" };

// Ordre du cycle du bouton d'en-tête : automatique, clair, sombre.
export const modeSuivant = (mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length];

// Une valeur inconnue — un stockage corrompu, une version antérieure —
// retombe sur l'automatique plutôt que d'imposer un thème arbitraire. Les
// anciennes valeurs "light" et "dark" restent valides telles quelles.
export const modeValide = (v) => (MODES.includes(v) ? v : "auto");
