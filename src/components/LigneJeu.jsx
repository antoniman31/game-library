import { memo, useRef, useState } from "react";
import Cover from "./Cover.jsx";
import { card, bdr, txt, mut, demat, accent, accentFond, ok, okDoux, warn, warnDoux, warnFond, danger } from "../lib/theme.js";
import { PC, PLATFORM_COLORS, BACK_COMPAT_PARENT, joursDePret, pretEnRetard } from "../lib/model.js";
import { profondeurRetour } from "../lib/retour.js";

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
// Le balayage, et les trois nombres qui le rendent utilisable.
//
// Huit pixels avant de figer la direction : sans ce verrou, un doigt qui dévie
// pendant un défilement déclenche un balayage au milieu de la liste. Une fois
// l'axe choisi il ne change plus, même si le doigt part en diagonale.
//
// Soixante-quatre pixels pour valider : en deçà la carte revient en place. Un
// seuil plus bas transformerait chaque défilement hésitant en prêt.
//
// Cent soixante-dix millisecondes avant d'appliquer le changement : basculer
// tout de suite rerendrait la liste et couperait l'animation net. La carte
// finit de sortir, puis l'état change.
const SEUIL_AXE = 8;
const SEUIL_BALAYAGE = 64;
const DELAI_SORTIE = 170;

function LigneJeu({ g, onOuvrir, onPreter, onRendre }) {
  // Un geste par ligne, gardé hors de l'état React : le suivre dans un state
  // rerendrait la liste à chaque pixel parcouru.
  const geste = useRef(null);
  const carte = useRef(null);
  const [glisse, setGlisse] = useState(false);
  // Ce que le balayage va faire, écrit sous le doigt. Prêter demande un nom,
  // donc il ouvre une saisie ; rendre est immédiat.
  const action = g.lentA ? { signe: "🏠", quoi: "Rendu" } : { signe: "📤", quoi: "Prêter" };
  const balayable = g.platform !== PC && typeof onPreter === "function";

  const surDebut = (e) => {
    geste.current = null;
    // Un panneau ouvert a ses propres gestes : rien ne doit glisser dessous.
    if (!balayable || e.touches.length !== 1 || profondeurRetour() > 0) return;
    const t = e.touches[0];
    geste.current = { x0: t.clientX, y0: t.clientY, axe: null, dx: 0 };
  };

  const surMouvement = (e) => {
    const gg = geste.current;
    if (!gg || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - gg.x0;
    const dy = t.clientY - gg.y0;

    if (!gg.axe) {
      if (Math.abs(dx) < SEUIL_AXE && Math.abs(dy) < SEUIL_AXE) return;
      gg.axe = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (gg.axe !== "x") return;

    e.preventDefault();
    gg.dx = dx;
    setGlisse(true);
    if (carte.current) carte.current.style.transform = `translateX(${dx}px)`;
  };

  const surFin = () => {
    const gg = geste.current;
    geste.current = null;
    setGlisse(false);
    if (!gg || gg.axe !== "x" || !carte.current) return;

    if (Math.abs(gg.dx) < SEUIL_BALAYAGE) { carte.current.style.transform = ""; return; }

    carte.current.style.transform = `translateX(${gg.dx > 0 ? "100%" : "-100%"})`;
    setTimeout(() => {
      if (carte.current) carte.current.style.transform = "";
      if (g.lentA) onRendre(g.id); else onPreter(g.id);
    }, DELAI_SORTIE);
  };

  const enRetard = pretEnRetard(g);
  const jours = joursDePret(g);
  const baseBorder = enRetard ? warn : bdr;
  const noteCouleur = g.metacritic >= 80 ? ok : g.metacritic >= 60 ? warn : danger;

  return (
    <div className="gl-card" style={{ background: card, border: `1px ${enRetard ? "dashed" : "solid"} ${baseBorder}`, borderRadius: "var(--r-md)", overflow: "hidden", transition: "border-color 0.2s", position: "relative" }}
      onTouchStart={balayable ? surDebut : undefined}
      onTouchMove={balayable ? surMouvement : undefined}
      onTouchEnd={balayable ? surFin : undefined}
      onTouchCancel={balayable ? surFin : undefined}>
    {/* Ce qui attend sous la carte. Visible seulement pendant le geste :
        affiché en permanence, il annoncerait une action à chaque ligne d'une
        liste qu'on ne fait que parcourir. */}
    {balayable && glisse && (
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", background: g.lentA ? okDoux : warnDoux, color: g.lentA ? ok : warn,
        fontSize: "var(--t-petit)", fontWeight: 600, pointerEvents: "none",
      }}>
        <span>{action.signe} {action.quoi}</span>
        <span>{action.quoi} {action.signe}</span>
      </div>
    )}
    <div style={{ display: "flex", gap: 8, padding: "8px 10px", cursor: "pointer", background: card,
      position: "relative", transition: glisse ? "none" : "transform .18s ease-out" }}
      ref={carte} onClick={() => onOuvrir(g.id)}>
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
