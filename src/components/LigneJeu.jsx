import { memo } from "react";
import Cover from "./Cover.jsx";
import { card, bdr, txt, mut, demat, accent, accentFond, ok, warn, warnFond, danger } from "../lib/theme.js";
import { PC, PLATFORM_COLORS, BACK_COMPAT_PARENT, joursDePret, pretEnRetard } from "../lib/model.js";

// Une ligne de la liste : ce qu'on lit sans ouvrir.
//
// Elle vivait dans le même composant que le détail de la fiche, replié en
// dessous. Les deux cent quatre-vingt-huit lignes de la bibliothèque montaient
// donc vingt-huit `useState` et quatre `useRef` chacune — la machinerie des
// cinq panneaux d'édition — pour afficher une jaquette et un titre.
//
// Séparées, la liste ne monte plus que des lignes, et un seul détail existe à
// la fois. C'est aussi ce qui permet à la grille et à la vue compacte d'ouvrir
// une fiche sans basculer en liste : avant, elles ne savaient pas montrer un
// détail, elles ne pouvaient que changer de vue pour aller le chercher.
function LigneJeu({ g, onOuvrir }) {
  const enRetard = pretEnRetard(g);
  const jours = joursDePret(g);
  const baseBorder = enRetard ? warn : bdr;
  const noteCouleur = g.metacritic >= 80 ? ok : g.metacritic >= 60 ? warn : danger;

  return (
    <div className="gl-card" style={{ background: card, border: `1px ${enRetard ? "dashed" : "solid"} ${baseBorder}`, borderRadius: "var(--r-md)", overflow: "hidden", transition: "border-color 0.2s" }}>
    <div style={{ display: "flex", gap: 8, padding: "8px 10px", cursor: "pointer" }} onClick={() => onOuvrir(g.id)}>
      <Cover src={g.cover} title={g.title} size={46} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ background: PLATFORM_COLORS[g.platform] || accentFond, color: "#fff", fontSize: "var(--t-legende)", fontWeight: 700, borderRadius: "var(--r-xs)", padding: "1px 5px" }}>{g.platform}</span>
          {/* Sur PC, « démat » ne dit rien : ils le sont tous. La pastille
              porte donc la boutique, qui est ce qui distingue un jeu d'un
              autre — et reste muette tant qu'aucune n'est renseignée. */}
          {g.platform === PC
            ? (g.boutique ? <span style={{ background: demat, color: accent, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px" }}>{g.boutique}</span> : null)
            : g.format === "démat" && <span style={{ background: demat, color: accent, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px" }}>démat</span>}
          {BACK_COMPAT_PARENT[g.platform] && g.backCompat && <span title={`Rétrocompatible ${BACK_COMPAT_PARENT[g.platform]}`} style={{ background: "#107C1022", color: ok, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px" }}>🔄 Compatible {BACK_COMPAT_PARENT[g.platform].replace("Xbox ", "")}</span>}
          {g.lentA && <span key={g.lentA} style={{ background: "#7c320044", color: warn, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px", animation: "statusPop 200ms ease" }}>📤 {g.lentA}{jours !== null ? ` · ${jours}j` : ""}</span>}
          {/* Rien d'autre ici : les badges disent l'exemplaire, pas le contenu. */}
        </div>
        <div style={{ fontWeight: 600, fontSize: "var(--t-corps)", color: txt, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{g.title}</div>
        {/* Le titre laissait un grand vide à sa droite ; la note, le genre et
            la date d'ajout le remplissent, et la liste se lit sans déplier. */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", fontSize: "var(--t-legende)", color: mut }}>
          {g.metacritic && <span style={{ color: noteCouleur, fontWeight: 700 }}>MC {g.metacritic}</span>}
          {g.genre[0] && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{g.genre[0]}</span>}
          <span style={{ flexShrink: 0 }}>{new Date(g.addedDate).toLocaleDateString("fr-FR")}</span>
        </div>
      </div>
      <span style={{ color: mut, alignSelf: "center" }}>›</span>
    </div>
    {/* La barre encodait le statut ; elle encode désormais le seul état suivi. */}
    <div style={{ height: 2, background: g.lentA ? warnFond : "transparent" }} />
    </div>
  );
}

// Mémoïsée : une ligne ne se rerend que si son jeu change.
//
// Encore faut-il que ses props soient stables. `onOuvrir` reçoit directement le
// `setState` de la fiche ouverte, et la ligne lui passe son identifiant
// elle-même : lui fabriquer une fermeture par ligne dans la liste aurait donné
// une prop neuve à chaque rendu, donc 288 lignes rerendues à chaque ouverture —
// mesuré, le défilement sautait de 2000 à 1184 px en ouvrant une fiche, les
// boîtes hors écran étant recalculées sous l'ancre de défilement.
export default memo(LigneJeu);
