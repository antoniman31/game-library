import { useEffect, useId, useRef } from "react";
import { card, bdr, txt } from "../lib/theme.js";

// Panneau glissant depuis le bas.
//
// Les filtres et les actions vivaient dépliés dans l'en-tête collant, qui
// occupait 317 px sur un écran de 915 : un tiers de la surface avant le premier
// jeu. Un panneau les sort du chemin sans les enterrer, et sa position basse
// les laisse sous le pouce.
export default function Sheet({ title, onClose, children }) {
  // Échap ferme, et la page cesse de défiler derrière.
  //
  // Le fond noir arrêtait les clics mais rien d'autre : sur un ordinateur,
  // Échap — le geste réflexe devant une fenêtre modale — ne faisait rien ; sur
  // un téléphone, un doigt qui glisse à côté du panneau faisait défiler la
  // liste derrière lui, si bien qu'en refermant on ne retrouvait plus l'endroit
  // qu'on regardait.
  // `onClose` est une fonction anonyme recréée à chaque rendu du parent : la
  // passer en dépendance ferait poser et retirer l'écouteur, et sauvegarder puis
  // restaurer le défilement, à chaque frappe dans le panneau. Une référence
  // évite ce va-et-vient tout en appelant toujours la version courante.
  const fermerRef = useRef(onClose);
  fermerRef.current = onClose;
  const panneauRef = useRef(null);
  const titreId = useId();
  useEffect(() => {
    // Le focus entre dans le panneau et n'en sort plus tant qu'il est ouvert.
    // Sans ça, Tab continuait de parcourir la page cachée derrière : on tabulait
    // dans une liste qu'on ne voyait pas, et le lecteur d'écran annonçait des
    // boutons hors du panneau qu'on venait d'ouvrir.
    const rendreLeFocus = document.activeElement;
    const focalisables = () => [...panneauRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
    // Le panneau lui-même reçoit le focus de départ plutôt que son premier
    // bouton : ouvrir « Filtres » ne doit pas donner l'air d'avoir déjà choisi.
    panneauRef.current?.focus();

    const surTouche = (e) => {
      if (e.key === "Escape") { fermerRef.current(); return; }
      if (e.key !== "Tab") return;
      const cibles = focalisables();
      if (!cibles.length) { e.preventDefault(); return; }
      const premier = cibles[0], dernier = cibles[cibles.length - 1];
      const courant = document.activeElement;
      if (!panneauRef.current.contains(courant)) { e.preventDefault(); premier.focus(); return; }
      if (e.shiftKey && courant === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && courant === dernier) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener("keydown", surTouche);
    // Sur <html>, pas sur <body> : `min-height: 100vh` est posé sur les deux,
    // et c'est l'élément racine qui défile ici — `document.scrollingElement` le
    // confirme. Le verrou posé sur <body> ne bloquait donc rien du tout.
    const racine = document.documentElement;
    const avant = racine.style.overflow;
    racine.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      racine.style.overflow = avant;
      // Refermer doit ramener là d'où l'on vient, sinon le focus repart au
      // début du document et il faut retraverser toute la page.
      if (rendreLeFocus instanceof HTMLElement) rendreLeFocus.focus();
    };
  }, []);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000b", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
        style={{
          background: card, border: `1px solid ${bdr}`,
          borderRadius: "var(--r-lg) var(--r-lg) 0 0",
          padding: "8px 20px calc(20px + var(--safe-bottom))", width: "100%", maxWidth: 500,
          // `dvh` et non `vh` : sur mobile, `vh` se calcule sur la fenêtre
          // barre d'adresse rétractée, si bien que le bas du panneau — donc ses
          // boutons — passait sous cette barre tant qu'elle était dépliée.
          margin: "0 auto", maxHeight: "85dvh", overflowY: "auto", outline: "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* La poignée dit d'où vient le panneau et par où il repart. */}
        <div style={{ width: 36, height: 4, borderRadius: "var(--r-xs)", background: bdr, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div id={titreId} style={{ fontWeight: 700, fontSize: 15, color: txt }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: "var(--r-sm)",
              width: "var(--tap)", height: "var(--tap)", fontSize: 15, cursor: "pointer", flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
