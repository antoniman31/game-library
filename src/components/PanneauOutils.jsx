import { bdrChamp, txt, mut, danger } from "../lib/theme.js";

// L'onglet « Outils » des Réglages : ce qui se lance, dure un moment et se
// termine.
//
// C'était un panneau glissant ouvert par un bouton « ⋯ » dans l'en-tête. Deux
// raisons de l'avoir déménagé ici. La première est une incohérence : « Importer
// ma bibliothèque Xbox » vivait dans ce panneau pendant que « Importer un export
// Playnite » vivait dans les Réglages, alors que c'est le même geste, fait pour
// la même raison, à quinze jours d'intervalle. Ils sont maintenant voisins.
//
// La seconde est que rien ici ne dépend de l'écran d'où l'on vient : ces
// actions travaillent sur `games`, la bibliothèque entière, sans regarder ni
// l'univers courant ni les filtres. Un panneau qui s'ouvre par-dessus la liste
// laissait croire le contraire.
//
// « Partager la liste » est restée dans l'en-tête, et c'est la seule : elle
// partage ce que les filtres montrent en ce moment. Depuis les Réglages, on
// partagerait une sélection qu'on ne voit pas et qu'on n'a pas posée.

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
        opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: "var(--t-chiffre)", flexShrink: 0 }}>{icone}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", color: c, fontSize: "var(--t-corps)", fontWeight: 600 }}>{titre}</span>
        {detail && <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", lineHeight: 1.35, marginTop: 1 }}>{detail}</span>}
      </span>
    </button>
  );
}

// Deux groupes, et non six lignes à la file.
//
// Le temps de décision croît avec le nombre d'options offertes ensemble, et six
// rectangles identiques en offrent six. Les nommer n'en retire aucune : ça
// ramène le premier choix à deux — remplir des fiches, faire entrer des jeux —
// et le second à deux ou quatre voisines qui se ressemblent vraiment. C'est le
// même geste que l'accordéon des filtres, en moins cher : ici rien n'est
// replié, seulement rangé.
const Groupe = ({ titre, children }) => (
  <div style={{ marginBottom: "var(--ecart-bloc)" }}>
    <div style={{ color: mut, fontSize: "var(--t-legende)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
      {titre}
    </div>
    {children}
  </div>
);

export default function PanneauOutils({
  onRefreshDescriptions, refreshing, refreshProg, refreshTotal, onCancelRefresh,
  onImportXbox,
  onPlaynite, exclusions, onViderExclusions,
  onCompleterScores, scoresEnCours, scoresProg, scoresTotal, onAnnulerScores, scoresManquants, notesDeclarees,
  onCompleterEditions, editionsCompletables,
  onRattraperJaquettes, jaquettesEnCours, jaquettesProg, jaquettesTotal, onAnnulerJaquettes, jaquettesManquantes,
}) {
  return (
    <div>
      {/* Une opération lancée d'ici continue quand on retourne à la
          bibliothèque : sa progression et son bouton « Arrêter » vivent dans
          les bandeaux de l'en-tête, qui s'affichent sur tous les onglets. */}
      <p style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5, margin: "0 0 14px" }}>
        Ces opérations portent sur toute la bibliothèque, pas sur ce que les filtres montrent.
        Elles durent quelques minutes et continuent si tu reviens à la liste — leur progression
        s'affiche en haut de l'écran, avec de quoi les arrêter.
      </p>

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
            onClick={onRefreshDescriptions}
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
            onClick={onCompleterScores}
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
          onClick={onCompleterEditions}
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
            onClick={onRattraperJaquettes}
          />
        )}
      </Groupe>

      {/* Les deux imports, enfin côte à côte. Rien n'est écrit avant d'avoir
          vu la liste, dans un cas comme dans l'autre. */}
      <Groupe titre="Faire entrer des jeux">
        <Action
          icone="🖥️"
          titre="Importer un export Playnite"
          detail="Steam, Epic, GOG, Amazon — depuis le fichier produit par le logiciel sur ton PC"
          onClick={onPlaynite}
        />
        <Action
          icone="🎮"
          titre="Importer ma bibliothèque Xbox"
          detail="Via xbl.io — nécessite la clé et le relais"
          onClick={onImportXbox}
        />
        {exclusions?.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <p style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5, margin: "0 0 8px" }}>
              {exclusions.length} jeu(x) écarté(s) d'un import Playnite : supprimés après coup, ils ne
              reviendront pas au suivant.
            </p>
            <button onClick={onViderExclusions}
              style={{ minHeight: "var(--tap)", padding: "0 14px", background: "transparent",
                border: `1px solid ${bdrChamp}`, color: txt, borderRadius: "var(--r-sm)",
                fontSize: "var(--t-petit)", cursor: "pointer", fontFamily: "inherit" }}>
              Vider la liste des écartés
            </button>
          </div>
        )}
      </Groupe>
    </div>
  );
}
