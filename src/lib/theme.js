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
