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
      <span style={{ fontSize: "var(--t-chiffre)", flexShrink: 0 }}>{icone}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", color: c, fontSize: "var(--t-corps)", fontWeight: 600 }}>{titre}</span>
        {detail && <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", marginTop: 1 }}>{detail}</span>}
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
  onCompleterEditions, editionsCompletables,
  onPartager, partageTotal, partageFiltre,
}) {
  return (
    <Sheet title="Actions" onClose={onClose}>
      {/* En tête : c'est la seule action qui s'adresse à quelqu'un d'autre, et
          la seule qu'on lance plusieurs fois par mois. Les autres rechargent
          des données et durent des minutes. */}
      <Action
        icone="📤"
        titre="Partager la liste"
        detail={`${partageTotal} jeu${partageTotal > 1 ? "x" : ""}${partageFiltre ? " — ceux que les filtres montrent" : ""} · texte à envoyer`}
        onClick={() => { onClose(); onPartager(); }}
      />
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
      {/* Avant d'aller chercher dehors : ce que la bibliothèque sait déjà.
          Un jeu possédé sur deux plateformes a une fiche remplie et une nue,
          et la seconde n'a rien à demander au réseau. */}
      <Action
        icone="🔗"
        titre="Remplir depuis les autres éditions"
        detail={editionsCompletables > 0
          ? `${editionsCompletables} fiche${editionsCompletables > 1 ? "s" : ""} à compléter · sans réseau`
          : "Rien à reprendre : chaque fiche est à jour"}
        onClick={() => { onClose(); onCompleterEditions(); }}
      />
      <Action
        icone="🎮"
        titre="Importer ma bibliothèque Xbox"
        detail="Via xbl.io — nécessite la clé et le relais"
        onClick={() => { onClose(); onImportXbox(); }}
      />
    </Sheet>
  );
}
