import Sheet from "./Sheet.jsx";
import { bdr, txt, mut, danger } from "../lib/theme.js";

// Une action = une ligne pleine largeur : intitulé, explication, et la hauteur
// de cible qu'il faut. Dans l'en-tête, ces mêmes boutons tenaient sur une seule
// rangée qui débordait de l'écran de 13 px et faisait défiler la page
// latéralement.
// `destructif` et non `danger` : le jeton de couleur porte déjà ce nom, et
// une prop qui l'ombre transformerait la couleur en booléen.
function Action({ icone, titre, detail, onClick, disabled, destructif }) {
  const c = destructif ? danger : txt;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        minHeight: "var(--tap)", background: "transparent",
        border: `1px solid ${destructif ? danger : bdr}`, borderRadius: "var(--r-md)",
        padding: "10px 12px", marginBottom: 8, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: 19, flexShrink: 0 }}>{icone}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", color: c, fontSize: 13, fontWeight: 600 }}>{titre}</span>
        {detail && <span style={{ display: "block", color: mut, fontSize: 11, marginTop: 1 }}>{detail}</span>}
      </span>
    </button>
  );
}

// Le panneau ne garde que les opérations ponctuelles — celles qui se lancent,
// durent un moment et se terminent. Le thème, qui est une préférence, est passé
// dans Réglages avec le reste de ce qui se règle une fois.
export default function ActionsSheet({
  onClose,
  onRefreshDescriptions, refreshing, refreshProg, refreshTotal, onCancelRefresh,
  onImportXbox,
  onCompleterScores, scoresEnCours, scoresProg, scoresTotal, onAnnulerScores, scoresManquants,
}) {
  return (
    <Sheet title="Actions" onClose={onClose}>
      {refreshing ? (
        <Action
          icone="⏳"
          titre={`Actualisation… ${refreshProg}/${refreshTotal}`}
          detail="Toucher pour arrêter"
          onClick={onCancelRefresh}
          destructif
        />
      ) : (
        <Action
          icone="🌐"
          titre="Actualiser les descriptions"
          detail="Recharge chaque résumé depuis Wikipédia FR"
          onClick={() => { onClose(); onRefreshDescriptions(); }}
        />
      )}
      {scoresEnCours ? (
        <Action
          icone="⏳"
          titre={`Recherche des notes… ${scoresProg}/${scoresTotal}`}
          detail="Toucher pour arrêter"
          onClick={onAnnulerScores}
          destructif
        />
      ) : (
        <Action
          icone="🎯"
          titre="Compléter les notes manquantes"
          detail={scoresManquants > 0
            ? `${scoresManquants} jeu${scoresManquants > 1 ? "x" : ""} sans note · cherche sur RAWG`
            : "Tous les jeux ont déjà une note"}
          onClick={() => { onClose(); onCompleterScores(); }}
        />
      )}
      <Action
        icone="🎮"
        titre="Importer ma bibliothèque Xbox"
        detail="Via xbl.io — nécessite la clé et le relais"
        onClick={() => { onClose(); onImportXbox(); }}
      />
    </Sheet>
  );
}
