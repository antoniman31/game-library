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
