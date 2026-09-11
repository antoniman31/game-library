import Sheet from "./Sheet.jsx";
import { bdrChamp, txt, mut, danger } from "../lib/theme.js";

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
        border: `1px solid ${destructif ? danger : bdrChamp}`, borderRadius: "var(--r-md)",
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

// Trois groupes, et non six lignes à la file.
//
// Le temps de décision croît avec le nombre d'options offertes ensemble, et six
// rectangles identiques en offrent six. Les nommer n'en retire aucune : ça
// ramène le premier choix à trois — sortir quelque chose, remplir des fiches,
// faire entrer des jeux — et le second à deux ou trois voisines qui se
// ressemblent vraiment. C'est le même geste que l'accordéon des filtres, en
// moins cher : ici rien n'est replié, seulement rangé.
const Groupe = ({ titre, children }) => (
  <div style={{ marginBottom: "var(--ecart-bloc)" }}>
    <div style={{ color: mut, fontSize: "var(--t-legende)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
      {titre}
    </div>
    {children}
  </div>
);

// Le panneau ne garde que les opérations ponctuelles — celles qui se lancent,
// durent un moment et se terminent. Le thème, qui est une préférence, est passé
// dans Réglages avec le reste de ce qui se règle une fois.
export default function ActionsSheet({
  onClose,
  onRefreshDescriptions, refreshing, refreshProg, refreshTotal, onCancelRefresh,
  onImportXbox,
  onCompleterScores, scoresEnCours, scoresProg, scoresTotal, onAnnulerScores, scoresManquants, notesDeclarees,
  onCompleterEditions, editionsCompletables,
  onRattraperJaquettes, jaquettesEnCours, jaquettesProg, jaquettesTotal, onAnnulerJaquettes, jaquettesManquantes,
  onPartager, partageTotal, partageFiltre,
}) {
  return (
    <Sheet title="Actions" onClose={onClose}>
      {/* En tête : c'est la seule action qui s'adresse à quelqu'un d'autre, et
          la seule qu'on lance plusieurs fois par mois. Les autres rechargent
          des données et durent des minutes. */}
      <Groupe titre="Sortir la liste">
      <Action
        icone="📤"
        titre="Partager la liste"
        detail={`${partageTotal} jeu${partageTotal > 1 ? "x" : ""}${partageFiltre ? " — ceux que les filtres montrent" : ""} · texte à envoyer`}
        onClick={() => { onClose(); onPartager(); }}
      />
      </Groupe>

      <Groupe titre="Compléter les fiches">
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
            ? `${scoresManquants} jeu${scoresManquants > 1 ? "x" : ""} sans note · RAWG, puis Steam, puis Wikidata`
            : notesDeclarees > 0
              ? `${notesDeclarees} sans note connue · relance pour tout revérifier`
              : "Toutes notées · relance pour tout revérifier"}
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
      {jaquettesEnCours ? (
        <Action
          icone="⏳"
          titre={`Recherche des jaquettes… ${jaquettesProg}/${jaquettesTotal}`}
          detail="Toucher pour arrêter"
          onClick={onAnnulerJaquettes}
          destructif
        />
      ) : (
        <Action
          icone="🖼"
          titre="Rattraper les jaquettes manquantes"
          detail={jaquettesManquantes > 0
            ? `${jaquettesManquantes} fiche${jaquettesManquantes > 1 ? "s" : ""} sans image · cherche sur SteamGridDB`
            : "Toutes les fiches ont une jaquette"}
          onClick={() => { onClose(); onRattraperJaquettes(); }}
        />
      )}
      </Groupe>

      <Groupe titre="Faire entrer des jeux">
      <Action
        icone="🎮"
        titre="Importer ma bibliothèque Xbox"
        detail="Via xbl.io — nécessite la clé et le relais"
        onClick={() => { onClose(); onImportXbox(); }}
      />
      </Groupe>
    </Sheet>
  );
}
