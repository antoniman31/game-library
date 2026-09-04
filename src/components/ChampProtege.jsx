import { useState } from "react";
import { bg, bdr, txt, mut, accent, danger } from "../lib/theme.js";
import { messageDeverrouillage, messageSuppression } from "../lib/garde-fous.js";

// Un champ dont la valeur ne s'écrase pas par inadvertance.
//
// Une clé de service et un code de synchronisation ont ceci de commun : ils
// n'existent nulle part ailleurs — pas dans l'export, pas dans la sauvegarde
// en ligne, pas dans le dépôt — et se perdent d'un geste. Tant qu'un champ de
// saisie ordinaire les porte, un doigt qui glisse suffit, et rien ne signale
// la perte avant le jour où le service cesse de répondre.
//
// Une fois renseignée, la valeur est donc en lecture seule. Deux boutons
// séparent explicitement les deux intentions — remplacer, effacer — et chacun
// demande confirmation avant d'agir. Un champ vide reste un champ normal :
// il n'y a rien à protéger.

const ACCENT = accent;

const bouton = (couleur) => ({
  minHeight: "var(--tap-min)", padding: "0 12px", background: "transparent",
  border: `1px solid ${couleur}`, color: couleur, borderRadius: "var(--r-sm)",
  fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
});

export default function ChampProtege({
  valeur, onChange, onSupprimer,
  quoi, consequence, placeholder, visible, ariaLabel, actions,
}) {
  const [deverrouille, setDeverrouille] = useState(false);
  const renseigne = !!String(valeur || "").trim();
  const verrou = renseigne && !deverrouille;

  const champ = (
    <input
      type={visible ? "text" : "password"}
      value={valeur}
      placeholder={placeholder}
      aria-label={ariaLabel}
      readOnly={verrou}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box", background: bg, minHeight: "var(--tap-min)",
        border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: verrou ? mut : txt,
        padding: "9px 10px", fontSize: 12,
        fontFamily: "ui-monospace, monospace", cursor: verrou ? "default" : "text",
      }}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--ecart-tap)", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
          {champ}
          {/* Dire que c'est verrouillé, sinon le champ passe pour cassé. */}
          {verrou && (
            <span aria-hidden="true" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.6 }}>🔒</span>
          )}
        </div>
        {actions}
      </div>

      {renseigne && (
        <div style={{ display: "flex", gap: "var(--ecart-tap)", marginTop: 6 }}>
          {verrou ? (
            <>
              <button style={bouton(ACCENT)} onClick={() => {
                if (!window.confirm(messageDeverrouillage(quoi))) return;
                setDeverrouille(true);
              }}>Modifier</button>
              <button style={bouton(danger)} onClick={() => {
                if (!window.confirm(messageSuppression(quoi, consequence))) return;
                onSupprimer();
              }}>Supprimer</button>
            </>
          ) : (
            <button style={bouton(bdr)} onClick={() => setDeverrouille(false)}>
              <span style={{ color: mut }}>🔒 Reverrouiller</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
