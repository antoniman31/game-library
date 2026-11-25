// Une icône Material du jeu de src/lib/icones.js. Décorative : le nom accessible est porté par le bouton ou le texte
// voisin. Elle prend la couleur du texte (currentColor) et, par défaut, sa taille.
import { TRACES } from "../lib/icones.js";

export default function Icone({ nom, taille = "1.2em" }) {
  const d = TRACES[nom];
  if (!d) return null;
  return (
    <svg viewBox="0 -960 960 960" width={taille} height={taille} fill="currentColor" aria-hidden="true" focusable="false"
      style={{ verticalAlign: "-0.25em", flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}
