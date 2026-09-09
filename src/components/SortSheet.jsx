import Sheet from "./Sheet.jsx";
import { bdr, txt, mut, accent, accentDoux } from "../lib/theme.js";
import { TRIS } from "../lib/tri.js";

// Le choix du tri.
//
// Trois tris tenaient en trois puces au-dessus de la liste ; cinq n'y tiennent
// plus sur 360 px. Ils passent donc dans une feuille, mais le bouton qui
// l'ouvre porte le tri courant — ce que le panneau des filtres, où le tri
// vivait avant, ne disait jamais.
export default function SortSheet({ sort, setSort, onMelanger, onClose }) {
  return (
    <Sheet title="Trier" onClose={onClose}>
      {TRIS.map(([cle, libelle, explication]) => {
        const actif = sort === cle;
        return (
          <button
            key={cle}
            onClick={() => {
              // Redemander le hasard alors qu'il est déjà choisi, c'est vouloir
              // un autre tirage — sinon le bouton ne ferait rien.
              if (cle === "aleatoire" && actif) onMelanger();
              setSort(cle);
              onClose();
            }}
            aria-pressed={actif}
            style={{
              display: "block", width: "100%", boxSizing: "border-box", textAlign: "left",
              minHeight: "var(--tap)", marginBottom: 8, padding: "10px 12px",
              background: actif ? accentDoux : "transparent",
              border: `1px solid ${actif ? accent : bdr}`,
              borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <span style={{ display: "block", color: actif ? accent : txt, fontSize: "var(--t-corps)", fontWeight: actif ? 600 : 400 }}>
              {libelle}{cle === "aleatoire" && actif ? " · toucher pour rebattre" : ""}
            </span>
            <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5, marginTop: 2 }}>
              {explication}
            </span>
          </button>
        );
      })}
    </Sheet>
  );
}
