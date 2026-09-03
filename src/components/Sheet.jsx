import { card, bdr, txt } from "../lib/theme.js";

// Panneau glissant depuis le bas.
//
// Les filtres et les actions vivaient dépliés dans l'en-tête collant, qui
// occupait 317 px sur un écran de 915 : un tiers de la surface avant le premier
// jeu. Un panneau les sort du chemin sans les enterrer, et sa position basse
// les laisse sous le pouce.
export default function Sheet({ title, onClose, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000b", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{
          background: card, border: `1px solid ${bdr}`, borderRadius: "16px 16px 0 0",
          padding: "8px 20px calc(20px + var(--safe-bottom))", width: "100%", maxWidth: 500,
          margin: "0 auto", maxHeight: "85vh", overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* La poignée dit d'où vient le panneau et par où il repart. */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: bdr, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: txt }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: 8,
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
