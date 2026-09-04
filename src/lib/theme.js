// ── Palette ─────────────────────────────────────────────────────────────────
// Les couleurs sont définies dans src/index.css et basculées par l'attribut
// data-theme sur <html>. Ces constantes ne sont que des alias : les styles
// inline continuent de s'écrire `color: txt`, mais la valeur est résolue par
// le navigateur au lieu d'être recalculée à chaque rendu depuis une prop.
export const bg = "var(--bg)";        // fond de l'app et des accordéons
export const hdr = "var(--hdr)";      // en-tête collant
export const card = "var(--card)";    // cartes, modales, champs
export const bdr = "var(--bdr)";      // toutes les bordures
export const txt = "var(--txt)";
export const mut = "var(--mut)";
export const demat = "var(--demat)";  // fond du badge « démat »
// Le bleu de l'accent était écrit en dur une cinquantaine de fois : le jeton
// --accent existait mais ne servait à rien, si bien que le thème clair ne
// pouvait pas le corriger. Or sur fond clair il ne donnait que 2,58:1, très
// en dessous des 4,5:1 exigés — et c'est la couleur de presque tout le petit
// texte cliquable : « obtenir ↗ », « ▾ Lire la suite », les liens des fiches.
export const accent = "var(--accent)";
export const accentDoux = "var(--accent-doux)"; // même bleu, en fond discret
// Un aplat qui porte du texte blanc. Séparé d'`accent` parce que les deux
// contraintes s'opposent : plus le bleu est sombre, mieux le blanc s'y lit,
// moins il se lit lui-même sur du noir.
export const accentFond = "var(--accent-fond)";

// Les couleurs qui portent un jugement. Elles étaient écrites en dur une
// centaine de fois, donc le thème clair ne pouvait pas les corriger — or c'est
// là qu'elles étaient illisibles : 2,83:1 pour le vert.
export const ok = "var(--ok)";
export const okDoux = "var(--ok-doux)";
export const warn = "var(--warn)";
export const warnDoux = "var(--warn-doux)";
export const danger = "var(--danger)";
export const dangerDoux = "var(--danger-doux)";

// Les mêmes, en aplat : barres de graphique, pastilles, bandes. Aucun texte ne
// s'y lit, donc rien à assombrir — les assombrir rendait les barres brunes.
export const okFond = "var(--ok-fond)";
export const warnFond = "var(--warn-fond)";
export const dangerFond = "var(--danger-fond)";
