import { bdr, mut, accent, accentDoux } from "../lib/theme.js";

// Le sélecteur de sous-onglets, défini une fois.
//
// Les Stats en avaient un, les Réglages en voulaient un : deux copies du même
// bouton dérivent au premier ajustement, et c'est exactement le genre d'écart
// qui fait qu'un écran a l'air d'appartenir à une autre application. Une seule
// définition, deux appels.

const ACCENT = accent;

export default function SousOnglets({ options, valeur, onChange }) {
  return (
    <div style={{ display: "flex", gap: "var(--ecart-tap)", marginBottom: 12 }}>
      {options.map(([cle, libelle]) => {
        const actif = valeur === cle;
        return (
          <button key={cle} onClick={() => onChange(cle)} aria-pressed={actif}
            style={{
              flex: 1, minHeight: "var(--tap)", borderRadius: "var(--r-sm)", fontSize: 13,
              cursor: "pointer", fontFamily: "inherit", fontWeight: actif ? 600 : 400,
              background: actif ? accentDoux : "transparent",
              border: `1px solid ${actif ? ACCENT : bdr}`,
              color: actif ? ACCENT : mut,
            }}>{libelle}</button>
        );
      })}
    </div>
  );
}
